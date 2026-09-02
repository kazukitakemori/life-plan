import { useMemo, useState } from 'react';
import { getInsurancesForVehicle } from '../../lib/insuranceDefaults';
import { getVehicleLinkedLoans } from '../../lib/loanResolution';
import { createVehicleEntryFromPreset } from '../../lib/vehicleDefaults';
import {
  getIncomeEligibleMembers,
  getMemberTabLabel,
} from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { LoanEntry, LoanState, VehicleLinkedLoanView } from '../../types/loan';
import type { VehicleEntry, VehiclePresetId, VehicleState } from '../../types/vehicle';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { AddVehicleCards } from './AddVehicleCards';
import { VehicleTable } from './VehicleTable';

interface VehicleStepProps {
  members: FamilyMember[];
  vehicleState: VehicleState;
  loanState: LoanState;
  housingState: HousingState;
  insuranceState?: InsuranceState;
  referenceDate: Date;
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
  purposeNote,
  onChange,
  onAddVehicleLoan,
  onRemoveVehicleLoan,
  onUpdateLoan,
  onAddAutoInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: VehicleStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );
  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = headMember?.id ?? eligibleMembers[0]?.id ?? '';

  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);
  const [copySourceId, setCopySourceId] = useState(
    headMember?.id ?? eligibleMembers[0]?.id ?? '',
  );

  const resolvedActiveId = eligibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : defaultActiveId;

  const activeMember = eligibleMembers.find((m) => m.id === resolvedActiveId);
  const entries = activeMember
    ? (vehicleState.byMember[activeMember.id] ?? [])
    : [];

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of eligibleMembers) {
      counts[member.id] = vehicleState.byMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [eligibleMembers, vehicleState.byMember]);

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
      eligibleMembers.map((member) => ({
        id: member.id,
        label: getMemberTabLabel(member),
      })),
    [eligibleMembers],
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
    persistEntries(resolvedActiveId, [...entries, nextEntry]);
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
          ご家族（Q1）で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page vehicle-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">
            Q6. 乗り物
            <span className="step-subtitle">
              自動車・バイク・自転車などの購入と維持
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

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      <div className="vehicle-toolbar">
        <MemberIncomeTabs
          members={eligibleMembers}
          activeMemberId={resolvedActiveId}
          entryCounts={entryCounts}
          referenceDate={referenceDate}
          onSelect={setActiveMemberId}
        />

        <div className="life-event-copy-bar">
          <select
            className="select-input"
            value={copySourceId}
            onChange={(e) => setCopySourceId(e.target.value)}
          >
            {copySourceOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="life-event-copy-from">から</span>
          <button
            type="button"
            className="life-event-copy-btn"
            onClick={copySettingsFrom}
            disabled={
              copySourceId === resolvedActiveId ||
              (vehicleState.byMember[copySourceId]?.length ?? 0) === 0
            }
          >
            設定をコピー
          </button>
        </div>
      </div>

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

      <AddVehicleCards onAdd={addEntryFromPreset} />
    </div>
  );
}
