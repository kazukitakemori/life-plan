import { useMemo, useRef, useState } from 'react';
import {
  createInsuranceEntry,
  getInsuranceEntryCounts,
  getMemberInsuranceEntries,
  updateInsuranceByMember,
} from '../../lib/insuranceDefaults';
import { getIncomeEligibleMembers } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type {
  InsuranceCategory,
  InsuranceEntry,
  InsuranceState,
} from '../../types/insurance';
import type { VehicleState } from '../../types/vehicle';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { AddInsuranceCards } from './AddInsuranceCards';
import { InsuranceEntryCard } from './InsuranceEntryCard';

interface InsuranceStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  vehicleState: VehicleState;
  insuranceState: InsuranceState;
  referenceDate: Date;
  onChange: (state: InsuranceState) => void;
}

function findHousingPropertyName(
  housingState: HousingState,
  entry: InsuranceEntry,
): string | undefined {
  if (!entry.housingLink) return undefined;
  const data = housingState.byTarget[entry.housingLink.targetId];
  if (!data) return undefined;
  if (entry.housingLink.propertyKind === 'rental') {
    return data.rentals.find((p) => p.id === entry.housingLink?.propertyId)
      ?.name;
  }
  return data.owned.find((p) => p.id === entry.housingLink?.propertyId)?.name;
}

function findVehicleName(
  vehicleState: VehicleState,
  entry: InsuranceEntry,
): string | undefined {
  if (!entry.vehicleLink) return undefined;
  return vehicleState.byMember[entry.vehicleLink.memberId]?.find(
    (vehicle) => vehicle.id === entry.vehicleLink?.vehicleId,
  )?.label;
}

export function InsuranceStep({
  members,
  housingState,
  vehicleState,
  insuranceState,
  referenceDate,
  onChange,
}: InsuranceStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );

  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = headMember?.id ?? eligibleMembers[0]?.id ?? '';

  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  const dragEntryIdRef = useRef<string | null>(null);
  const dropInsertIndexRef = useRef<number | null>(null);

  const resolvedActiveId = eligibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : defaultActiveId;

  const activeMember = eligibleMembers.find((m) => m.id === resolvedActiveId);

  const entries = useMemo(
    () => getMemberInsuranceEntries(insuranceState, resolvedActiveId),
    [insuranceState, resolvedActiveId],
  );

  const entryCounts = useMemo(
    () =>
      getInsuranceEntryCounts(
        insuranceState,
        eligibleMembers.map((m) => m.id),
      ),
    [eligibleMembers, insuranceState],
  );

  const housingPropertyNames = useMemo(() => {
    const names: Record<string, string | undefined> = {};
    for (const entry of entries) {
      names[entry.id] = findHousingPropertyName(housingState, entry);
    }
    return names;
  }, [entries, housingState]);

  const vehicleNames = useMemo(() => {
    const names: Record<string, string | undefined> = {};
    for (const entry of entries) {
      names[entry.id] = findVehicleName(vehicleState, entry);
    }
    return names;
  }, [entries, vehicleState]);

  const persistEntries = (memberId: string, updated: InsuranceEntry[]) => {
    onChange(updateInsuranceByMember(insuranceState, memberId, updated));
  };

  const updateEntry = (updated: InsuranceEntry) => {
    if (!resolvedActiveId) return;
    persistEntries(
      resolvedActiveId,
      entries.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
  };

  const removeEntry = (id: string) => {
    if (!resolvedActiveId) return;
    persistEntries(
      resolvedActiveId,
      entries.filter((entry) => entry.id !== id),
    );
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
    // drop が dragend より後に来る環境向けに、次フレームまで待ってから解除する
    window.setTimeout(() => {
      if (dragEntryIdRef.current != null) {
        clearDragState();
      }
    }, 0);
  };

  const addEntry = (category: InsuranceCategory) => {
    if (!resolvedActiveId || !activeMember) return;
    persistEntries(resolvedActiveId, [
      ...entries,
      createInsuranceEntry(
        category,
        activeMember,
        referenceDate,
        {},
        members,
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
    <div className="step-page insurance-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">
            Q10. 保険
            <span className="step-subtitle">
              損害保険・生命保険の保険料を登録
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

      <section className="insurance-section">
        <h3 className="insurance-section-title">登録済み保険</h3>

        {entries.length > 0 ? (
          <div
            className={`insurance-entry-list${dragEntryId ? ' insurance-entry-list--dragging' : ''}`}
          >
            {entries.map((entry, index) => (
              <div key={entry.id} className="insurance-entry-list-item">
                <div
                  className={`insurance-drop-line${
                    dragEntryId && dropInsertIndex === index
                      ? ' insurance-drop-line--active'
                      : ''
                  }`}
                  aria-hidden
                />
                <InsuranceEntryCard
                  entry={entry}
                  member={activeMember}
                  members={eligibleMembers}
                  housingState={housingState}
                  vehicleState={vehicleState}
                  referenceDate={referenceDate}
                  housingPropertyName={housingPropertyNames[entry.id]}
                  vehicleName={vehicleNames[entry.id]}
                  isDragging={dragEntryId === entry.id}
                  onChange={updateEntry}
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
              className={`insurance-drop-line${
                dragEntryId && dropInsertIndex === entries.length
                  ? ' insurance-drop-line--active'
                  : ''
              }`}
              aria-hidden
            />
          </div>
        ) : (
          <div className="insurance-empty">
            保険が登録されていません。下から追加するか、住まい（Q5）・乗り物（Q6）から追加してください。
          </div>
        )}
      </section>

      <AddInsuranceCards onAdd={addEntry} />
    </div>
  );
}
