import { useCallback, useMemo, useState } from 'react';
import { getInsurancesForVehicle } from '../../lib/insuranceDefaults';
import { getVehicleLinkedLoans } from '../../lib/loanResolution';
import { createVehicleEntryFromPreset } from '../../lib/vehicleDefaults';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import { memberHasVehicleData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { LoanEntry, LoanState, VehicleLinkedLoanView } from '../../types/loan';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { VehicleEntry, VehiclePresetId, VehicleState } from '../../types/vehicle';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { CopySettingsBar, StepHeading } from '../ui';
import { VehicleTable } from './VehicleTable';

interface VehicleStepProps {
  members: FamilyMember[];
  vehicleState: VehicleState;
  loanState: LoanState;
  housingState: HousingState;
  insuranceState?: InsuranceState;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  purposeNote?: string;
  onChange: (state: VehicleState) => void;
  onAddVehicleLoan: (memberId: string, vehicle: VehicleEntry) => void;
  onRemoveVehicleLoan: (entryId: string) => void;
  onUpdateLoan?: (entry: LoanEntry) => void;
  onAddAutoInsurance?: (memberId: string, vehicle: VehicleEntry) => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

export function VehicleStep({
  members,
  vehicleState,
  loanState,
  housingState,
  insuranceState,
  referenceDate,
  memberTabExtras,
  onMemberTabExtrasChange,
  purposeNote,
  onChange,
  onAddVehicleLoan,
  onRemoveVehicleLoan,
  onUpdateLoan,
  onAddAutoInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: VehicleStepProps) {
  const headMember = members.find((m) => m.role === 'head');
  const [activeMemberId, setActiveMemberId] = useState(headMember?.id ?? '');
  const [copySourceId, setCopySourceId] = useState(headMember?.id ?? '');

  const memberHasData = useCallback(
    (memberId: string) => memberHasVehicleData(vehicleState, memberId),
    [vehicleState],
  );

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'vehicle',
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
  const entries = activeMember
    ? (vehicleState.byMember[activeMember.id] ?? [])
    : [];

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of visibleMembers) {
      counts[member.id] = vehicleState.byMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [visibleMembers, vehicleState.byMember]);

  const linkedLoansByVehicleId = useMemo(() => {
    const map: Record<string, VehicleLinkedLoanView[]> = {};
    for (const entry of entries) {
      map[entry.id] = getVehicleLinkedLoans(
        loanState,
        members,
        resolvedActiveId,
        entry.id,
      );
    }
    return map;
  }, [entries, loanState, members, resolvedActiveId]);

  const linkedInsurancesByVehicleId = useMemo(() => {
    const map: Record<string, ReturnType<typeof getInsurancesForVehicle>> = {};
    if (!insuranceState) return map;
    for (const entry of entries) {
      map[entry.id] = getInsurancesForVehicle(
        insuranceState,
        resolvedActiveId,
        entry.id,
      );
    }
    return map;
  }, [entries, insuranceState, resolvedActiveId]);

  const copySourceOptions = useMemo(
    () =>
      visibleMembers.map((member) => ({
        id: member.id,
        label: getMemberTabLabel(member),
      })),
    [visibleMembers],
  );

  const persistEntries = (memberId: string, updated: typeof entries) => {
    onChange({
      ...vehicleState,
      byMember: { ...vehicleState.byMember, [memberId]: updated },
    });
  };

  const addEntryFromPreset = (presetId: VehiclePresetId) => {
    if (!activeMember) return;
    const nextEntry = createVehicleEntryFromPreset(
      presetId,
      activeMember,
      referenceDate,
    );
    const sameTypeEntries = entries.filter((entry) => entry.type === nextEntry.type);
    let nextIndex = sameTypeEntries.length + 1;
    for (const entry of sameTypeEntries) {
      const label = entry.label.trim();
      if (label === nextEntry.label) {
        nextIndex = Math.max(nextIndex, 2);
        continue;
      }
      if (!label.startsWith(nextEntry.label)) continue;
      const suffix = Number(label.slice(nextEntry.label.length));
      if (Number.isInteger(suffix) && suffix >= 2) {
        nextIndex = Math.max(nextIndex, suffix + 1);
      }
    }
    const namedEntry = sameTypeEntries.length === 0
      ? nextEntry
      : { ...nextEntry, label: `${nextEntry.label}${nextIndex}` };
    persistEntries(resolvedActiveId, [...entries, namedEntry]);
  };

  const copySettingsFrom = () => {
    const source = vehicleState.byMember[copySourceId] ?? [];
    if (source.length === 0 || copySourceId === resolvedActiveId) return;

    const cloned = source.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      insurances: (entry.insurances ?? []).map((insurance) => ({
        ...insurance,
        id: crypto.randomUUID(),
      })),
    }));
    persistEntries(resolvedActiveId, cloned);
  };

  if (!headMember || !activeMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page vehicle-step">
      <StepHeading number={6} title="乗り物" />

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

      <CopySettingsBar
        value={copySourceId}
        options={copySourceOptions}
        onChange={setCopySourceId}
        onCopy={copySettingsFrom}
        disabled={
          copySourceId === resolvedActiveId ||
          (vehicleState.byMember[copySourceId]?.length ?? 0) === 0
        }
      />

      <VehicleTable
        entries={entries}
        member={activeMember}
        members={members}
        referenceDate={referenceDate}
        linkedLoansByVehicleId={linkedLoansByVehicleId}
        linkedInsurancesByVehicleId={linkedInsurancesByVehicleId}
        insuranceState={insuranceState}
        loanState={loanState}
        housingState={housingState}
        vehicleState={vehicleState}
        onChange={(updated) => persistEntries(resolvedActiveId, updated)}
        onAdd={addEntryFromPreset}
        onAddLoan={(entry) => onAddVehicleLoan(resolvedActiveId, entry)}
        onRemoveLoan={onRemoveVehicleLoan}
        onUpdateLoan={onUpdateLoan}
        onAddInsurance={
          onAddAutoInsurance
            ? (entry) => onAddAutoInsurance(resolvedActiveId, entry)
            : undefined
        }
        onUpdateInsurance={onUpdateInsurance}
        onRemoveInsurance={onRemoveInsurance}
      />
    </div>
  );
}
