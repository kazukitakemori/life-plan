import { useCallback, useMemo, useState } from 'react';
import {
  createInsuranceEntry,
  getInsuranceEntryCounts,
  getMemberInsuranceEntries,
  updateInsuranceByMember,
} from '../../lib/insuranceDefaults';
import { INSURANCE_CATEGORY_DEFAULT_NAMES } from '../../lib/insuranceLabels';
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
  const [newEntryId, setNewEntryId] = useState<string | null>(null);

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

  const defaultNamePositions = useMemo(() => {
    const positions: Record<string, { index: number; count: number }> = {};
    const groups = new Map<InsuranceCategory, InsuranceEntry[]>();

    for (const entry of entries) {
      const isLinked = Boolean(entry.housingLink || entry.vehicleLink);
      const defaultName = INSURANCE_CATEGORY_DEFAULT_NAMES[entry.category];
      const usesDefaultName =
        !isLinked &&
        (entry.name.trim() === '' || entry.name.trim() === defaultName);

      if (!usesDefaultName) continue;
      const group = groups.get(entry.category) ?? [];
      group.push(entry);
      groups.set(entry.category, group);
    }

    for (const group of groups.values()) {
      group.forEach((entry, index) => {
        positions[entry.id] = { index: index + 1, count: group.length };
      });
    }

    return positions;
  }, [entries]);

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

  const addEntry = (category: InsuranceCategory) => {
    if (!resolvedActiveId || !activeMember) return;
    const created = createInsuranceEntry(
      category,
      activeMember,
      referenceDate,
      {},
      members,
    );
    setNewEntryId(created.id);
    persistEntries(resolvedActiveId, [...entries, created]);
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
      <StepHeading number={10} title="保険" />

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
        <h3 className="insurance-section-title">登録済みの保険</h3>

        {entries.length > 0 ? (
          <div className="insurance-entry-list">
            {entries.map((entry) => (
              <div key={entry.id} className="insurance-entry-list-item">
                <InsuranceEntryCard
                  entry={entry}
                  member={activeMember}
                  members={eligibleMembers}
                  housingState={housingState}
                  vehicleState={vehicleState}
                  referenceDate={referenceDate}
                  housingPropertyName={housingPropertyNames[entry.id]}
                  vehicleName={vehicleNames[entry.id]}
                  defaultNamePosition={defaultNamePositions[entry.id]}
                  initiallyExpanded={newEntryId === entry.id}
                  onChange={updateEntry}
                  onRemove={() => removeEntry(entry.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="insurance-empty">保険はまだ登録されていません。</div>
        )}
      </section>

      <AddInsuranceCards onAdd={addEntry} />
    </div>
  );
}
