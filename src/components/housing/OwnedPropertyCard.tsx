import { useState } from 'react';
import {
  OWNED_PROPERTY_TYPE_LABELS,
  OWNED_PROPERTY_USAGE_LABELS,
} from '../../lib/housingLabels';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty, OwnedPropertyUsage } from '../../types/housing';
import type {
  HousingLinkedLoanView,
  LoanEntry,
  LoanState,
  LoanStructureType,
} from '../../types/loan';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { OwnedPropertyDetail } from './OwnedPropertyDetail';

interface OwnedPropertyCardProps {
  property: OwnedProperty;
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedLoans: HousingLinkedLoanView[];
  linkedInsurances?: InsuranceEntry[];
  insuranceState?: InsuranceState;
  loanState: LoanState;
  housingState: HousingState;
  vehicleState: VehicleState;
  contractorMembers: FamilyMember[];
  hasSpouse: boolean;
  viewRole?: 'owner' | 'linked';
  canRemove: boolean;
  canAddLoan?: boolean;
  onChange: (property: OwnedProperty) => void;
  onRemove: () => void;
  onAddLoan: (
    structureType: LoanStructureType,
    contractorMemberIds: [string] | [string, string],
  ) => void;
  onRemoveLoan: (entryId: string) => void;
  onUpdateLoan?: (entry: LoanEntry) => void;
  onUpdatePairPartnerLoan?: (entry: LoanEntry) => void;
  onPairShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onJointDebtShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onLoanPropertyFeeChange?: (
    entry: LoanEntry,
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => void;
  onAddInsurance?: () => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

const USAGE_OPTIONS = Object.keys(
  OWNED_PROPERTY_USAGE_LABELS,
) as OwnedPropertyUsage[];

export function OwnedPropertyCard({
  property,
  member,
  members,
  referenceDate,
  linkedLoans,
  linkedInsurances = [],
  insuranceState,
  loanState,
  housingState,
  vehicleState,
  contractorMembers,
  hasSpouse,
  viewRole = 'owner',
  canRemove,
  canAddLoan = true,
  onChange,
  onRemove,
  onAddLoan,
  onRemoveLoan,
  onUpdateLoan,
  onUpdatePairPartnerLoan,
  onPairShareChange,
  onJointDebtShareChange,
  onLoanPropertyFeeChange,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: OwnedPropertyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = OWNED_PROPERTY_TYPE_LABELS[property.type];

  return (
    <div
      className={[
        'housing-owned-card-wrap',
        expanded ? 'housing-owned-card-wrap--expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="housing-owned-card">
        <div className="housing-owned-card-identity">
          <span className="ui-entry-type-badge housing-owned-type">{typeLabel}</span>
          {viewRole === 'linked' ? (
            <span className="housing-owned-linked-badge">ローン契約に連動</span>
          ) : null}
        </div>

        <label className="housing-owned-card-field housing-owned-card-name-field">
          <span className="housing-owned-card-field-label">物件名</span>
          <input
            type="text"
            className="housing-owned-name-input"
            value={property.name}
            onChange={(e) => onChange({ ...property, name: e.target.value })}
          />
        </label>

        <label className="housing-owned-card-field housing-owned-card-usage-field">
          <span className="housing-owned-card-field-label">入居状況</span>
          <select
            className="select-input select-input--compact housing-owned-usage-select"
            value={property.usage}
            onChange={(e) =>
              onChange({
                ...property,
                usage: e.target.value as OwnedPropertyUsage,
              })
            }
          >
            {USAGE_OPTIONS.map((usage) => (
              <option key={usage} value={usage}>
                {OWNED_PROPERTY_USAGE_LABELS[usage]}
              </option>
            ))}
          </select>
        </label>

        <div className="housing-owned-card-actions">
          <button
            type="button"
            className={`ui-entry-disclosure-btn${expanded ? ' is-active' : ''}`}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            <span aria-hidden>{expanded ? '−' : '＋'}</span>
            {expanded ? '詳細を閉じる' : '詳細を入力'}
          </button>

          {canRemove ? (
            <button
              type="button"
              className="ui-entry-delete-button housing-owned-remove-btn"
              onClick={onRemove}
              aria-label="所有物件を削除"
            >
              削除
            </button>
          ) : null}
        </div>
      </div>

      {expanded && (
        <OwnedPropertyDetail
          property={property}
          member={member}
          members={members}
          referenceDate={referenceDate}
          linkedLoans={linkedLoans}
          linkedInsurances={linkedInsurances}
          insuranceState={insuranceState}
          loanState={loanState}
          housingState={housingState}
          vehicleState={vehicleState}
          contractorMembers={contractorMembers}
          hasSpouse={hasSpouse}
          canAddLoan={canAddLoan}
          onChange={onChange}
          onAddLoan={onAddLoan}
          onRemoveLoan={onRemoveLoan}
          onUpdateLoan={onUpdateLoan}
          onUpdatePairPartnerLoan={onUpdatePairPartnerLoan}
          onPairShareChange={onPairShareChange}
          onJointDebtShareChange={onJointDebtShareChange}
          onLoanPropertyFeeChange={onLoanPropertyFeeChange}
          onAddInsurance={onAddInsurance}
          onUpdateInsurance={onUpdateInsurance}
          onRemoveInsurance={onRemoveInsurance}
        />
      )}
    </div>
  );
}
