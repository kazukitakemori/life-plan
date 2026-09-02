import { useState } from 'react';
import {
  OWNED_PROPERTY_TYPE_ICONS,
  OWNED_PROPERTY_TYPE_LABELS,
  OWNED_PROPERTY_USAGE_LABELS,
} from '../../lib/housingLabels';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty, OwnedPropertyUsage } from '../../types/housing';
import type { HousingLinkedLoanView, LoanEntry, LoanState, LoanStructureType } from '../../types/loan';
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
  canRemove: boolean;
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
  canRemove,
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
  const icon = OWNED_PROPERTY_TYPE_ICONS[property.type];
  const typeLabel = OWNED_PROPERTY_TYPE_LABELS[property.type];

  return (
    <div
      className={`housing-owned-card-wrap${expanded ? ' housing-owned-card-wrap--expanded' : ''}`}
    >
      <div className="housing-owned-card">
        <span className="housing-owned-icon" aria-hidden>
          {icon}
        </span>
        <span className="housing-owned-type">{typeLabel}</span>
        <input
          type="text"
          className="housing-owned-name-input"
          value={property.name}
          onChange={(e) => onChange({ ...property, name: e.target.value })}
        />
        <select
          className="select-input select-input--compact housing-owned-usage-select"
          value={property.usage}
          onChange={(e) =>
            onChange({
              ...property,
              usage: e.target.value as OwnedPropertyUsage,
            })
          }
          aria-label="入居状況"
        >
          {USAGE_OPTIONS.map((usage) => (
            <option key={usage} value={usage}>
              {OWNED_PROPERTY_USAGE_LABELS[usage]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`housing-owned-open-btn${expanded ? ' housing-owned-open-btn--active' : ''}`}
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
          disabled={!canRemove}
          aria-label="所有物件を削除"
        >
          −
        </button>
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
