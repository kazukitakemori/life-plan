import { useCallback, useMemo, useRef, useState } from 'react';
import {
  createInsuranceEntry,
  getInsuranceEntryCounts,
  getMemberInsuranceEntries,
  updateInsuranceByMember,
} from '../../lib/insuranceDefaults';
import { getIncomeEligibleMembers } from '../../lib/memberDisplay';
import { memberHasInsuranceData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type {
  InsuranceCategory,
  InsuranceEntry,
  InsuranceState,
} from '../../types/insurance';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { VehicleState } from '../../types/vehicle';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { StepHeading } from '../ui';
import { AddInsuranceCards } from './AddInsuranceCards';
import { InsuranceEntryCard } from './InsuranceEntryCard';

interface InsuranceStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  vehicleState: VehicleState;
  insuranceState: InsuranceState;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
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
  memberTabExtras,
  onMemberTabExtrasChange,
  onChange,
}: InsuranceStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );

  const headMember = members.find((m) => m.role === 'head');
  const [activeMemberId, setActiveMemberId] = useState(headMember?.id ?? '');
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  const dragEntryIdRef = useRef<string | null>(null);
  const dropInsertIndexRef = useRef<number | null>(null);

  const memberHasData = useCallback(
    (memberId: string) => memberHasInsuranceData(insuranceState, memberId),
    [insuranceState],
  );

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'insurance',
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

  const entries = useMemo(
    () => getMemberInsuranceEntries(insuranceState, resolvedActiveId),
    [insuranceState, resolvedActiveId],
  );

  const entryCounts = useMemo(
    () =>
      getInsuranceEntryCounts(
        insuranceState,
        visibleMembers.map((m) => m.id),
      ),
    [visibleMembers, insuranceState],
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
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page insurance-step">
      <StepHeading
        number={10}
        title="保険"
        subtitle="損害保険・生命保険の保険料を登録"
      />

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
            保険が登録されていません。下から追加するか、住まい・乗り物から追加してください。
          </div>
        )}
      </section>

      <AddInsuranceCards onAdd={addEntry} />
    </div>
  );
}
