import { useState } from 'react';
import {
  formatHousingLoanName,
  formatVehicleLoanName,
  LOAN_STRUCTURE_TYPE_LABELS,
} from '../../lib/loanLabels';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty } from '../../types/housing';
import type { LoanEntry, LoanState } from '../../types/loan';
import type { VehicleEntry } from '../../types/vehicle';
import { formatLoanEntrySummary } from './LoanSettingsFields';
import { LoanEntryDetail } from './LoanEntryDetail';

interface LoanEntryCardProps {
  entry: LoanEntry;
  housingPropertyName?: string;
  vehicleName?: string;
  linkedHousingProperty?: OwnedProperty;
  linkedVehicle?: VehicleEntry;
  referenceDate: Date;
  member?: FamilyMember;
  members?: FamilyMember[];
  loanState?: LoanState;
  onChange: (entry: LoanEntry) => void;
  onPairPartnerChange?: (entry: LoanEntry) => void;
  onPairShareChange?: (sharePct: number) => void;
  onJointDebtShareChange?: (sharePct: number) => void;
  onPropertyFeeChange?: (
    entry: LoanEntry,
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => void;
  onRemove: () => void;
}

export function LoanEntryCard({
  entry,
  housingPropertyName,
  vehicleName,
  linkedHousingProperty,
  linkedVehicle,
  referenceDate,
  member,
  members,
  loanState,
  onChange,
  onPairPartnerChange,
  onPairShareChange,
  onJointDebtShareChange,
  onPropertyFeeChange,
  onRemove,
}: LoanEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isHousingLinked = Boolean(entry.housingLink && housingPropertyName);
  const isVehicleLinked = Boolean(entry.vehicleLink && vehicleName);
  const isLinked = isHousingLinked || isVehicleLinked;
  const displayName = isHousingLinked
    ? formatHousingLoanName(housingPropertyName!)
    : isVehicleLinked
      ? formatVehicleLoanName(vehicleName!)
      : entry.name;
  const structureLabel =
    entry.category === 'housing' && entry.structureType
      ? LOAN_STRUCTURE_TYPE_LABELS[entry.structureType]
      : undefined;

  return (
    <div
      className={`loan-entry-card-wrap${expanded ? ' loan-entry-card-wrap--expanded' : ''}`}
    >
      <div className="loan-entry-card">
        {isLinked ? (
          <span className="loan-entry-name-label">{displayName}</span>
        ) : (
          <input
            type="text"
            className="loan-entry-name-input"
            value={entry.name}
            onChange={(e) => onChange({ ...entry, name: e.target.value })}
          />
        )}
        {structureLabel ? (
          <span className="loan-entry-structure-badge">{structureLabel}</span>
        ) : null}
        <span className="loan-entry-summary">
          {formatLoanEntrySummary(entry, referenceDate)}
        </span>
        <button
          type="button"
          className={`loan-entry-open-btn${expanded ? ' loan-entry-open-btn--active' : ''}`}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span aria-hidden>{expanded ? '∧' : '›'}</span>
          {expanded ? '閉じる' : '開く'}
        </button>
        <button
          type="button"
          className="housing-row-remove"
          onClick={onRemove}
          aria-label="ローンを削除"
        >
          −
        </button>
      </div>

      {expanded && (
        <LoanEntryDetail
          entry={entry}
          housingPropertyName={housingPropertyName}
          vehicleName={vehicleName}
          linkedHousingProperty={linkedHousingProperty}
          linkedVehicle={linkedVehicle}
          referenceDate={referenceDate}
          member={member}
          members={members}
          loanState={loanState}
          onChange={onChange}
          onPairPartnerChange={onPairPartnerChange}
          onPairShareChange={onPairShareChange}
          onJointDebtShareChange={onJointDebtShareChange}
          onPropertyFeeChange={
            onPropertyFeeChange
              ? (patch) => onPropertyFeeChange(entry, patch)
              : undefined
          }
        />
      )}
    </div>
  );
}
