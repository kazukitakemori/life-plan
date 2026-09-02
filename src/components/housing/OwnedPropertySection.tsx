import { createOwnedProperty } from '../../lib/housingDefaults';
import {
  OWNED_PROPERTY_TYPE_DESCRIPTIONS,
  OWNED_PROPERTY_TYPE_ICONS,
  OWNED_PROPERTY_TYPE_LABELS,
} from '../../lib/housingLabels';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty, OwnedPropertyType, RentalProperty } from '../../types/housing';
import type { HousingLinkedLoanView, LoanEntry, LoanState, LoanStructureType } from '../../types/loan';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { OwnedPropertyCard } from './OwnedPropertyCard';

interface OwnedPropertySectionProps {
  owned: OwnedProperty[];
  rentals: RentalProperty[];
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedLoansByPropertyId: Record<string, HousingLinkedLoanView[]>;
  linkedInsurancesByPropertyId?: Record<string, InsuranceEntry[]>;
  insuranceState?: InsuranceState;
  loanState: LoanState;
  housingState: HousingState;
  vehicleState: VehicleState;
  contractorMembers: FamilyMember[];
  hasSpouse: boolean;
  onChange: (owned: OwnedProperty[]) => void;
  onAddHousingLoan: (
    property: OwnedProperty,
    structureType: LoanStructureType,
    contractorMemberIds: [string] | [string, string],
  ) => void;
  onRemoveHousingLoan: (entryId: string) => void;
  onUpdateLoan?: (entry: LoanEntry) => void;
  onUpdatePairPartnerLoan?: (entry: LoanEntry) => void;
  onPairShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onJointDebtShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onLoanPropertyFeeChange?: (
    entry: LoanEntry,
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => void;
  onAddInsurance?: (property: OwnedProperty) => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

const ADD_OPTIONS: OwnedPropertyType[] = [
  'condominium',
  'detached_house',
  'land',
];

export function OwnedPropertySection({
  owned,
  rentals,
  member,
  members,
  referenceDate,
  linkedLoansByPropertyId,
  linkedInsurancesByPropertyId = {},
  insuranceState,
  loanState,
  housingState,
  vehicleState,
  contractorMembers,
  hasSpouse,
  onChange,
  onAddHousingLoan,
  onRemoveHousingLoan,
  onUpdateLoan,
  onUpdatePairPartnerLoan,
  onPairShareChange,
  onJointDebtShareChange,
  onLoanPropertyFeeChange,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: OwnedPropertySectionProps) {
  const refMonth = referenceDate.getMonth() + 1;
  const refYear = referenceDate.getFullYear();

  const updateProperty = (id: string, updated: OwnedProperty) => {
    onChange(owned.map((property) => (property.id === id ? updated : property)));
  };

  const removeProperty = (id: string) => {
    onChange(owned.filter((property) => property.id !== id));
  };

  const addProperty = (type: OwnedPropertyType) => {
    onChange([
      ...owned,
      createOwnedProperty(type, member, refMonth, refYear, {}, { rentals, owned }),
    ]);
  };

  return (
    <section className="housing-section">
      <h3 className="housing-section-title">2. 所有物件</h3>

      {owned.length > 0 ? (
        <div className="housing-owned-list">
          {owned.map((property) => (
            <OwnedPropertyCard
              key={property.id}
              property={property}
              member={member}
              members={members}
              referenceDate={referenceDate}
              linkedLoans={linkedLoansByPropertyId[property.id] ?? []}
              linkedInsurances={linkedInsurancesByPropertyId[property.id] ?? []}
              insuranceState={insuranceState}
              loanState={loanState}
              housingState={housingState}
              vehicleState={vehicleState}
              contractorMembers={contractorMembers}
              hasSpouse={hasSpouse}
              canRemove
              onChange={(updated) => updateProperty(property.id, updated)}
              onRemove={() => removeProperty(property.id)}
              onAddLoan={(structureType, contractorMemberIds) =>
                onAddHousingLoan(property, structureType, contractorMemberIds)
              }
              onRemoveLoan={onRemoveHousingLoan}
              onUpdateLoan={onUpdateLoan}
              onUpdatePairPartnerLoan={onUpdatePairPartnerLoan}
              onPairShareChange={onPairShareChange}
              onJointDebtShareChange={onJointDebtShareChange}
              onLoanPropertyFeeChange={onLoanPropertyFeeChange}
              onAddInsurance={
                onAddInsurance ? () => onAddInsurance(property) : undefined
              }
              onUpdateInsurance={onUpdateInsurance}
              onRemoveInsurance={onRemoveInsurance}
            />
          ))}
        </div>
      ) : (
        <div className="housing-owned-empty">
          所有物件が登録されていません。下から追加してください。
        </div>
      )}

      <div className="housing-owned-add-panel">
        <p className="housing-owned-add-label">所有物件を追加</p>

        <div className="housing-owned-add-options">
          {ADD_OPTIONS.map((type) => (
            <button
              key={type}
              type="button"
              className="housing-owned-add-option"
              onClick={() => addProperty(type)}
            >
              <span className="housing-owned-add-icon" aria-hidden>
                {OWNED_PROPERTY_TYPE_ICONS[type]}
              </span>
              <span className="housing-owned-add-title">
                {OWNED_PROPERTY_TYPE_LABELS[type]}
              </span>
              <span className="housing-owned-add-desc">
                {OWNED_PROPERTY_TYPE_DESCRIPTIONS[type]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
