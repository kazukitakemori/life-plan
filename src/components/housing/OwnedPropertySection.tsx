import {
  OWNED_PROPERTY_TYPE_LABELS,
} from '../../lib/housingLabels';
import type { OwnedTabView } from '../../lib/housingOwnedViews';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty, OwnedPropertyType } from '../../types/housing';
import type { HousingLinkedLoanView, LoanEntry, LoanState, LoanStructureType } from '../../types/loan';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { AddDisclosure } from '../ui';
import { OwnedPropertyCard } from './OwnedPropertyCard';

interface OwnedPropertySectionProps {
  ownedViews: OwnedTabView[];
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
  highlightTokenById?: ReadonlyMap<string, number>;
  endedPropertyIds?: ReadonlySet<string>;
  onAddProperty: (type: OwnedPropertyType) => void;
  onChangeProperty: (storageTargetId: string, property: OwnedProperty) => void;
  onRemoveProperty: (storageTargetId: string, propertyId: string) => void;
  onAddHousingLoan: (
    storageTargetId: string,
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
  onAddInsurance?: (storageTargetId: string, property: OwnedProperty) => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

const ADD_OPTIONS: OwnedPropertyType[] = [
  'condominium',
  'detached_house',
  'land',
];

const ADD_DESCRIPTIONS: Record<OwnedPropertyType, string> = {
  condominium: '集合住宅',
  detached_house: '戸建住宅',
  land: '土地・用地',
};

export function OwnedPropertySection({
  ownedViews,
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
  highlightTokenById,
  endedPropertyIds,
  onAddProperty,
  onChangeProperty,
  onRemoveProperty,
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
  return (
    <section className="housing-section" id="housing-owned-section">
      <div className="housing-section-header">
        <h3 className="housing-section-title">所有物件</h3>
        <p className="housing-section-desc">
          購入・ローン・税金など。詳細は各カードを開いて入力します。
        </p>
      </div>

      {ownedViews.length > 0 ? (
        <div className="housing-owned-list">
          {ownedViews.map((view) => {
            const periodMember =
              members.find((item) => item.id === view.periodMemberId) ?? member;
            return (
              <OwnedPropertyCard
                key={`${view.storageTargetId}:${view.property.id}:${view.viewRole}`}
                property={view.property}
                member={periodMember}
                members={members}
                referenceDate={referenceDate}
                linkedLoans={linkedLoansByPropertyId[view.property.id] ?? []}
                linkedInsurances={
                  linkedInsurancesByPropertyId[view.property.id] ?? []
                }
                insuranceState={insuranceState}
                loanState={loanState}
                housingState={housingState}
                vehicleState={vehicleState}
                contractorMembers={contractorMembers}
                hasSpouse={hasSpouse}
                viewRole={view.viewRole}
                canRemove={view.viewRole === 'owner'}
                canAddLoan={view.viewRole === 'owner'}
                highlightToken={highlightTokenById?.get(view.property.id)}
                endedBySecondLife={endedPropertyIds?.has(view.property.id)}
                onChange={(updated) =>
                  onChangeProperty(view.storageTargetId, updated)
                }
                onRemove={() =>
                  onRemoveProperty(view.storageTargetId, view.property.id)
                }
                onAddLoan={(structureType, contractorMemberIds) =>
                  onAddHousingLoan(
                    view.storageTargetId,
                    view.property,
                    structureType,
                    contractorMemberIds,
                  )
                }
                onRemoveLoan={onRemoveHousingLoan}
                onUpdateLoan={onUpdateLoan}
                onUpdatePairPartnerLoan={onUpdatePairPartnerLoan}
                onPairShareChange={onPairShareChange}
                onJointDebtShareChange={onJointDebtShareChange}
                onLoanPropertyFeeChange={onLoanPropertyFeeChange}
                onAddInsurance={
                  onAddInsurance && view.viewRole === 'owner'
                    ? () => onAddInsurance(view.storageTargetId, view.property)
                    : undefined
                }
                onUpdateInsurance={onUpdateInsurance}
                onRemoveInsurance={onRemoveInsurance}
              />
            );
          })}
        </div>
      ) : (
        <div className="housing-owned-empty">
          所有物件が登録されていません。下から追加してください。
        </div>
      )}

      <AddDisclosure label="所有物件を追加" className="housing-owned-add-panel">
        {(close) => (
          <div className="housing-owned-add-options ui-add-card-grid">
            {ADD_OPTIONS.map((type) => (
              <button
                key={type}
                type="button"
                className="housing-owned-add-option ui-add-card"
                onClick={() => {
                  onAddProperty(type);
                  close();
                }}
              >
                <span className="housing-owned-add-title ui-add-card__title">
                  {OWNED_PROPERTY_TYPE_LABELS[type]}
                </span>
                <span className="housing-owned-add-desc ui-add-card__description">
                  {ADD_DESCRIPTIONS[type]}
                </span>
              </button>
            ))}
          </div>
        )}
      </AddDisclosure>
    </section>
  );
}
