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
  defaultExpanded?: boolean;
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
  defaultExpanded = false,
  onRemove,
}: LoanEntryCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
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
  const linkedSourceLabel = isHousingLinked
    ? 'Q5 住まい連携'
    : isVehicleLinked
      ? 'Q6 乗り物連携'
      : undefined;

  return (
    <div
      className={`loan-entry-card-wrap${expanded ? ' loan-entry-card-wrap--expanded' : ''}`}
    >
      <div className="loan-entry-card">
        <div className="loan-entry-card-main">
          <div className="loan-entry-card-heading">
            {isLinked ? (
              <span className="loan-entry-name-label">{displayName}</span>
            ) : (
              <input
                type="text"
                className="loan-entry-name-input"
                value={entry.name}
                aria-label="ローン名"
                onChange={(e) => onChange({ ...entry, name: e.target.value })}
              />
            )}
            {structureLabel ? (
              <span className="loan-entry-structure-badge">{structureLabel}</span>
            ) : null}
            {linkedSourceLabel ? (
              <span className="loan-entry-link-badge">{linkedSourceLabel}</span>
            ) : null}
          </div>
          <span className="loan-entry-summary">
            {formatLoanEntrySummary(entry, referenceDate)}
          </span>
        </div>

        <button
          type="button"
          className={`loan-entry-open-btn${expanded ? ' loan-entry-open-btn--active' : ''}`}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? '閉じる −' : '詳細を開く ＋'}
        </button>
      </div>

      {expanded && (
        <>
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
          <div className="loan-entry-card-footer">
            <button
              type="button"
              className="loan-entry-remove-btn"
              onClick={onRemove}
              aria-label={`${displayName}を削除`}
            >
              このローンを削除
            </button>
          </div>
        </>
      )}
    </div>
  );
}
