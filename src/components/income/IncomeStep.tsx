import { useMemo, useState } from 'react';
import { createIncomeEntry } from '../../lib/incomeDefaults';
import { getIncomeEligibleMembers } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import type {
  IncomeByMember,
  IncomeCategory,
  IncomeEntry,
  PriorYearIncomeByMember,
} from '../../types/income';
import { AddIncomeBar } from './AddIncomeBar';
import { IncomeEntryCard } from './IncomeEntryCard';
import { MemberIncomeTabs } from './MemberIncomeTabs';
import { PriorYearIncomeSection } from './PriorYearIncomeSection';

interface IncomeStepProps {
  members: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  onChange: (income: IncomeByMember) => void;
  onPriorYearIncomeChange: (priorYearIncome: PriorYearIncomeByMember) => void;
}

export function IncomeStep({
  members,
  incomeByMember,
  priorYearIncomeByMember,
  referenceDate,
  onChange,
  onPriorYearIncomeChange,
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

  const addEntry = (category: IncomeCategory) => {
    if (!resolvedActiveId || !activeMember) return;
    persistEntries(resolvedActiveId, [
      ...entries,
      createIncomeEntry(
        resolvedActiveId,
        category,
        activeMember.age,
        referenceDate.getMonth() + 1,
        activeMember,
      ),
    ]);
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

      <MemberIncomeTabs
        members={eligibleMembers}
        activeMemberId={resolvedActiveId}
        entryCounts={entryCounts}
        referenceDate={referenceDate}
        onSelect={setActiveMemberId}
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
              referenceDate={referenceDate}
              index={index}
              onChange={(updated) => updateEntry(entry.id, updated)}
              onRemove={() => removeEntry(entry.id)}
            />
          ))
        )}
      </div>

      <PriorYearIncomeSection
        member={activeMember}
        members={members}
        incomeByMember={incomeByMember}
        priorYearIncomeByMember={priorYearIncomeByMember}
        referenceDate={referenceDate}
        onChange={onPriorYearIncomeChange}
      />

      <AddIncomeBar onAdd={addEntry} />
    </div>
  );
}
