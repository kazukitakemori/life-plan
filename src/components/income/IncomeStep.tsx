import { useCallback, useMemo, useState } from 'react';
import {
  createIncomeEntry,
  createSideBusinessIncomeEntry,
} from '../../lib/incomeDefaults';
import { canAddSideBusinessIncome } from '../../lib/incomeGuidance';
import type { AddIncomeOption } from '../../lib/incomeLabels';
import { retirementAllowancesForEntry } from '../../lib/retirementAllowance';
import { getMemberSavingsEntries } from '../../lib/savingsDefaults';
import {
  isPensionStylePayoutCategory,
  resolveSavingsWithdrawalMode,
} from '../../lib/savingsLabels';
import { memberHasIncomeData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type {
  IncomeByMember,
  IncomeEntry,
  PriorYearIncomeByMember,
} from '../../types/income';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { SavingsState } from '../../types/savings';
import { RetirementDeductionTimingGuide } from '../shared/RetirementDeductionTimingGuide';
import { StepHeading } from '../ui';
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
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
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
  memberTabExtras,
  onMemberTabExtrasChange,
  onChange,
  onPriorYearIncomeChange,
  purposeNote,
}: IncomeStepProps) {
  const headMember = members.find((m) => m.role === 'head');
  const [activeMemberId, setActiveMemberId] = useState(headMember?.id ?? '');

  const memberHasData = useCallback(
    (memberId: string) => memberHasIncomeData(incomeByMember, memberId),
    [incomeByMember],
  );

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'income',
    members,
    memberTabExtras,
    onMemberTabExtrasChange,
    memberHasData,
    fallbackActiveId: headMember?.id ?? '',
    activeId: activeMemberId,
    setActiveId: setActiveMemberId,
  });

  const fallbackActiveId = headMember?.id ?? visibleMembers[0]?.id ?? '';

  const resolvedActiveId = visibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : fallbackActiveId;

  const activeMember = visibleMembers.find((m) => m.id === resolvedActiveId);
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
    for (const member of visibleMembers) {
      counts[member.id] = incomeByMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [visibleMembers, incomeByMember]);

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
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page income-step">
      <StepHeading
        number={7}
        title="収入"
        lead="働き方と収入額を登録します。扶養や上昇率などの細かい設定は各収入の詳細から変更できます。"
      />

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      <MemberIncomeTabs
        members={visibleMembers}
        activeMemberId={resolvedActiveId}
        entryCounts={entryCounts}
        referenceDate={referenceDate}
        onSelect={setActiveMemberId}
        addableMembers={addableMembers}
        onAddMemberTab={handleAddMemberTab}
        removableMemberIds={removableMemberIds}
        onRemoveMemberTab={handleRemoveMemberTab}
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
