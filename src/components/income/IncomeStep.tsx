import { useMemo, useState } from 'react';
import {
  createIncomeEntry,
  createSideBusinessIncomeEntry,
} from '../../lib/incomeDefaults';
import { getIncomeEligibleMembers } from '../../lib/memberDisplay';
import { canAddSideBusinessIncome } from '../../lib/incomeGuidance';
import type { AddIncomeOption } from '../../lib/incomeLabels';
import { retirementAllowancesForEntry } from '../../lib/retirementAllowance';
import { getMemberSavingsEntries } from '../../lib/savingsDefaults';
import {
  isPensionStylePayoutCategory,
  resolveSavingsWithdrawalMode,
} from '../../lib/savingsLabels';
import type { FamilyMember } from '../../types/family';
import type {
  IncomeByMember,
  IncomeEntry,
  PriorYearIncomeByMember,
} from '../../types/income';
import type { SavingsState } from '../../types/savings';
import { RetirementDeductionTimingGuide } from '../shared/RetirementDeductionTimingGuide';
import { AddIncomeBar } from './AddIncomeBar';
import { IncomeAnnualChart } from './IncomeAnnualChart';
import { IncomeEntryCard } from './IncomeEntryCard';
import { MemberIncomeTabs } from './MemberIncomeTabs';
import { PriorYearIncomeSection } from './PriorYearIncomeSection';

interface IncomeStepProps {
  members: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  savingsState: SavingsState;
  referenceDate: Date;
  onChange: (income: IncomeByMember) => void;
  onPriorYearIncomeChange: (priorYearIncome: PriorYearIncomeByMember) => void;
  /** 教育費試算など、目的に応じた注記 */
  purposeNote?: string;
}

export function IncomeStep({
  members,
  incomeByMember,
  priorYearIncomeByMember,
  savingsState,
  referenceDate,
  onChange,
  onPriorYearIncomeChange,
  purposeNote,
}: IncomeStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );

  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = headMember?.id ?? eligibleMembers[0]?.id ?? '';

  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);

  const resolvedActiveId = eligibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : defaultActiveId;

  const activeMember = eligibleMembers.find((m) => m.id === resolvedActiveId);
  const entries = incomeByMember[resolvedActiveId] ?? [];
  const savingsEntries = useMemo(
    () => getMemberSavingsEntries(savingsState, resolvedActiveId),
    [savingsState, resolvedActiveId],
  );

  const showRetirementTimingGuide = useMemo(() => {
    const hasPensionOnce = savingsEntries.some(
      (entry) =>
        isPensionStylePayoutCategory(entry.category) &&
        resolveSavingsWithdrawalMode(entry.withdrawalMode) === 'once',
    );
    const hasCompanyRetirement = entries.some((entry) =>
      retirementAllowancesForEntry(entry).some(
        (allowance) => (Number(allowance.amountMan) || 0) > 0,
      ),
    );
    return hasPensionOnce || hasCompanyRetirement;
  }, [savingsEntries, entries]);

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of eligibleMembers) {
      counts[member.id] = incomeByMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [eligibleMembers, incomeByMember]);

  const persistEntries = (memberId: string, updated: IncomeEntry[]) => {
    onChange({ ...incomeByMember, [memberId]: updated });
  };

  const updateEntry = (entryId: string, updated: IncomeEntry) => {
    if (!resolvedActiveId) return;
    persistEntries(
      resolvedActiveId,
      entries.map((e) => (e.id === entryId ? updated : e)),
    );
  };

  const removeEntry = (entryId: string) => {
    if (!resolvedActiveId) return;
    persistEntries(
      resolvedActiveId,
      entries.filter((e) => e.id !== entryId),
    );
  };

  const addEntry = (option: AddIncomeOption) => {
    if (!resolvedActiveId || !activeMember) return;
    const newEntry =
      option.variant === 'side_business'
        ? createSideBusinessIncomeEntry(
            resolvedActiveId,
            activeMember.age,
            referenceDate.getMonth() + 1,
            activeMember,
          )
        : createIncomeEntry(
            resolvedActiveId,
            option.category,
            activeMember.age,
            referenceDate.getMonth() + 1,
            activeMember,
          );
    persistEntries(resolvedActiveId, [...entries, newEntry]);
  };

  if (!activeMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族（Q1）で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page income-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">Q7. 収入</h2>
          <p className="step-description">
            扶養関係や産休育休を含む働き方設定
          </p>
        </div>
        <div className="step-header-right">
          <button type="button" className="step-action-btn" disabled>
            解説
          </button>
          <button type="button" className="step-action-btn" disabled>
            ガイド
          </button>
          <button type="button" className="step-action-btn" disabled>
            メモ
          </button>
          <button type="button" className="show-all-btn" disabled>
            全員まとめて表示
          </button>
        </div>
      </div>

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      <MemberIncomeTabs
        members={eligibleMembers}
        activeMemberId={resolvedActiveId}
        entryCounts={entryCounts}
        referenceDate={referenceDate}
        onSelect={setActiveMemberId}
      />

      <PriorYearIncomeSection
        member={activeMember}
        incomeByMember={incomeByMember}
        priorYearIncomeByMember={priorYearIncomeByMember}
        referenceDate={referenceDate}
        onChange={onPriorYearIncomeChange}
      />

      <div className="income-entries">
        {entries.length === 0 ? (
          <div className="income-empty">
            <p>収入が登録されていません。下の「収入を追加」から登録してください。</p>
          </div>
        ) : (
          entries.map((entry, index) => (
            <IncomeEntryCard
              key={entry.id}
              entry={entry}
              member={activeMember}
              memberEntries={entries}
              familyMembers={members}
              incomeByMember={incomeByMember}
              referenceDate={referenceDate}
              index={index}
              onChange={(updated) => updateEntry(entry.id, updated)}
              onRemove={() => removeEntry(entry.id)}
            />
          ))
        )}
      </div>

      <AddIncomeBar
        canAddSideBusiness={canAddSideBusinessIncome(entries)}
        onAdd={addEntry}
      />

      {activeMember ? (
        <IncomeAnnualChart
          member={activeMember}
          familyMembers={members}
          incomeByMember={incomeByMember}
          referenceDate={referenceDate}
        />
      ) : null}

      {showRetirementTimingGuide && activeMember ? (
        <section className="income-retirement-timing-section">
          <RetirementDeductionTimingGuide
            className="retirement-timing-guide--in-income"
            member={activeMember}
            incomeEntries={entries}
            memberEntries={savingsEntries}
            referenceDate={referenceDate}
            defaultOpen
          />
        </section>
      ) : null}
    </div>
  );
}
