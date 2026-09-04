import { useMemo, useRef, useState } from 'react';
import {
  createSavingsEntry,
  getMemberSavingsEntries,
  getSavingsEntryCounts,
  reconcileMemberIdecoCorporatePensions,
  syncIdecoCorporateDcFlags,
  updateSavingsByMember,
} from '../../lib/savingsDefaults';
import {
  applyIdecoOccupancySelection,
  calcMemberCorporateDcMonthlyYen,
  calcMemberDbOtherSystemMonthlyYen,
  defaultIdecoCorporatePensionFlags,
  isIdecoCategory,
  resolveIdecoMonthlyLimitYen,
  resolveIdecoOccupancy,
  yenToMan,
} from '../../lib/idecoContributionLimit';
import { ensureDcContributionFields } from '../../lib/dcContribution';
import { resolveMemberAge } from '../../lib/familyDefaults';
import { getIncomeEligibleMembers } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type {
  SavingsCategory,
  SavingsEntry,
  SavingsState,
} from '../../types/savings';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { AddSavingsCards } from './AddSavingsCards';
import { SavingsEntryCard } from './SavingsEntryCard';

interface SavingsStepProps {
  members: FamilyMember[];
  savingsState: SavingsState;
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  onChange: (state: SavingsState) => void;
}

export function SavingsStep({
  members,
  savingsState,
  incomeByMember,
  referenceDate,
  onChange,
}: SavingsStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );

  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = headMember?.id ?? eligibleMembers[0]?.id ?? '';

  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  const [expandRequest, setExpandRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const dragEntryIdRef = useRef<string | null>(null);
  const dropInsertIndexRef = useRef<number | null>(null);

  const requestExpandEntry = (entryId: string) => {
    setExpandRequest((prev) => ({
      id: entryId,
      nonce: prev ? prev.nonce + 1 : 1,
    }));
  };

  const resolvedActiveId = eligibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : defaultActiveId;

  const activeMember = eligibleMembers.find((m) => m.id === resolvedActiveId);

  const entries = useMemo(
    () => getMemberSavingsEntries(savingsState, resolvedActiveId),
    [savingsState, resolvedActiveId],
  );

  const incomeEntries = incomeByMember[resolvedActiveId] ?? [];

  const entryCounts = useMemo(
    () =>
      getSavingsEntryCounts(
        savingsState,
        eligibleMembers.map((m) => m.id),
      ),
    [eligibleMembers, savingsState],
  );

  const persistEntries = (memberId: string, updated: SavingsEntry[]) => {
    onChange(updateSavingsByMember(savingsState, memberId, updated));
  };

  const updateEntry = (updated: SavingsEntry) => {
    if (!resolvedActiveId) return;
    persistEntries(
      resolvedActiveId,
      entries.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
  };

  const updateMemberEntries = (updated: SavingsEntry[]) => {
    if (!resolvedActiveId) return;
    persistEntries(resolvedActiveId, updated);
  };

  const removeEntry = (id: string) => {
    if (!resolvedActiveId || !activeMember) return;
    const removed = entries.find((entry) => entry.id === id);
    let next = entries.filter((entry) => entry.id !== id);
    if (removed?.category === 'dc' || removed?.category === 'db') {
      next = reconcileMemberIdecoCorporatePensions(
        next,
        activeMember,
        incomeByMember[resolvedActiveId] ?? [],
        referenceDate,
      );
    }
    persistEntries(resolvedActiveId, next);
  };

  const reorderEntries = (fromId: string, insertIndex: number) => {
    if (!resolvedActiveId) return;
    const fromIndex = entries.findIndex((entry) => entry.id === fromId);
    if (fromIndex < 0) return;
    let toIndex = insertIndex;
    if (fromIndex < insertIndex) toIndex -= 1;
    if (toIndex === fromIndex || toIndex < 0 || toIndex > entries.length - 1) {
      return;
    }
    const next = [...entries];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persistEntries(resolvedActiveId, next);
  };

  const updateDropInsertIndex = (index: number) => {
    dropInsertIndexRef.current = index;
    setDropInsertIndex(index);
  };

  const beginDrag = (entryId: string) => {
    dragEntryIdRef.current = entryId;
    dropInsertIndexRef.current = null;
    setDragEntryId(entryId);
    setDropInsertIndex(null);
  };

  const clearDragState = () => {
    dragEntryIdRef.current = null;
    dropInsertIndexRef.current = null;
    setDragEntryId(null);
    setDropInsertIndex(null);
  };

  const commitDrop = () => {
    const fromId = dragEntryIdRef.current;
    const insertIndex = dropInsertIndexRef.current;
    if (fromId != null && insertIndex != null) {
      reorderEntries(fromId, insertIndex);
    }
    clearDragState();
  };

  const handleDragEnd = () => {
    window.setTimeout(() => {
      if (dragEntryIdRef.current != null) {
        clearDragState();
      }
    }, 0);
  };

  const addEntry = (category: SavingsCategory) => {
    if (!resolvedActiveId || !activeMember) return;
    const incomeEntries = incomeByMember[resolvedActiveId] ?? [];
    let nextEntries = [...entries];

    if (isIdecoCategory(category)) {
      const startAge = resolveMemberAge(activeMember);
      const startMonth = referenceDate.getMonth() + 1;
      const occupancy = resolveIdecoOccupancy(
        activeMember,
        incomeEntries,
        referenceDate,
        { age: startAge, month: startMonth },
      );
      const flags = defaultIdecoCorporatePensionFlags({
        occupancy,
        memberHasCorporateDcEntry: entries.some(
          (entry) => entry.category === 'dc',
        ),
        memberHasDbEntry: entries.some((entry) => entry.category === 'db'),
      });
      const employerDcMonthlyYen =
        calcMemberCorporateDcMonthlyYen(entries).employerYen;
      const dbOtherSystemMonthlyYen =
        calcMemberDbOtherSystemMonthlyYen(entries);
      const base = createSavingsEntry(category, activeMember, referenceDate, {
        ...flags,
        idecoOccupancy: occupancy,
        contributionMan: Math.min(
          3,
          yenToMan(
            resolveIdecoMonthlyLimitYen(occupancy, flags, {
              employerDcMonthlyYen,
              dbOtherSystemMonthlyYen,
            }),
          ),
        ),
      });
      nextEntries = [
        ...entries,
        applyIdecoOccupancySelection(
          base,
          occupancy,
          activeMember,
          incomeEntries,
          referenceDate,
          entries,
        ),
      ];
      if (flags.hasDb && !entries.some((entry) => entry.category === 'db')) {
        nextEntries = [
          ...nextEntries,
          createSavingsEntry('db', activeMember, referenceDate),
        ];
        nextEntries = reconcileMemberIdecoCorporatePensions(
          nextEntries,
          activeMember,
          incomeEntries,
          referenceDate,
        );
      }
    } else {
      let created = createSavingsEntry(category, activeMember, referenceDate);
      if (category === 'dc') {
        created = ensureDcContributionFields(created, activeMember, {
          incomeEntries,
          referenceDate,
        });
      }
      nextEntries = [...entries, created];
    }

    if (category === 'dc' || category === 'db') {
      nextEntries = reconcileMemberIdecoCorporatePensions(
        syncIdecoCorporateDcFlags(nextEntries),
        activeMember,
        incomeEntries,
        referenceDate,
      );
    }

    persistEntries(resolvedActiveId, nextEntries);
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
    <div className="step-page savings-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">
            Q11. 貯蓄・運用
            <span className="step-subtitle">
              現在残高・積立・利息／想定利回りを登録
            </span>
          </h2>
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
        </div>
      </div>

      <MemberIncomeTabs
        members={eligibleMembers}
        activeMemberId={resolvedActiveId}
        entryCounts={entryCounts}
        referenceDate={referenceDate}
        onSelect={setActiveMemberId}
      />

      <section className="savings-section">
        <h3 className="savings-section-title">登録済み口座</h3>

        {entries.length > 0 ? (
          <div
            className={`savings-entry-list${dragEntryId ? ' savings-entry-list--dragging' : ''}`}
          >
            {entries.map((entry, index) => (
              <div key={entry.id} className="savings-entry-list-item">
                <div
                  className={`savings-drop-line${
                    dragEntryId && dropInsertIndex === index
                      ? ' savings-drop-line--active'
                      : ''
                  }`}
                  aria-hidden
                />
                <SavingsEntryCard
                  entry={entry}
                  member={activeMember}
                  memberEntries={entries}
                  incomeEntries={incomeEntries}
                  referenceDate={referenceDate}
                  isDragging={dragEntryId === entry.id}
                  expandRequest={expandRequest}
                  onChange={updateEntry}
                  onChangeMemberEntries={updateMemberEntries}
                  onRequestExpandEntry={requestExpandEntry}
                  onRemove={() => removeEntry(entry.id)}
                  onDragStart={() => beginDrag(entry.id)}
                  onDragEnd={handleDragEnd}
                  onDragOverCard={(insertBefore) => {
                    updateDropInsertIndex(insertBefore ? index : index + 1);
                  }}
                  onDropOnCard={commitDrop}
                />
              </div>
            ))}
            <div
              className={`savings-drop-line${
                dragEntryId && dropInsertIndex === entries.length
                  ? ' savings-drop-line--active'
                  : ''
              }`}
              aria-hidden
            />
          </div>
        ) : (
          <div className="savings-empty">
            口座が登録されていません。下から貯蓄・運用を追加してください。未登録の場合、資産（金融）は年間収支の累積のみで推移します。
          </div>
        )}
      </section>

      <AddSavingsCards onAdd={addEntry} />
    </div>
  );
}
