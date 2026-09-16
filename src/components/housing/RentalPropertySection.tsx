import type { RentalTabView } from '../../lib/housingRentalPayer';
import type { FamilyMember } from '../../types/family';
import type { RentalPayerMode, RentalProperty } from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { RentalPropertyCard } from './RentalPropertyCard';

interface RentalPropertySectionProps {
  rentalViews: RentalTabView[];
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedInsurancesByPropertyId?: Record<string, InsuranceEntry[]>;
  insuranceState?: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  hasSpouse: boolean;
  onAdd: () => void;
  onChangeRental: (storageTargetId: string, rental: RentalProperty) => void;
  onRemoveRental: (storageTargetId: string, rentalId: string) => void;
  onPayerModeChange: (
    storageTargetId: string,
    rentalId: string,
    payerMode: RentalPayerMode,
  ) => void;
  onAddInsurance?: (storageTargetId: string, rental: RentalProperty) => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

export function RentalPropertySection({
  rentalViews,
  member,
  members,
  referenceDate,
  linkedInsurancesByPropertyId = {},
  insuranceState,
  housingState,
  vehicleState,
  hasSpouse,
  onAdd,
  onChangeRental,
  onRemoveRental,
  onPayerModeChange,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: RentalPropertySectionProps) {
  return (
    <section className="housing-section" id="housing-rental-section">
      <div className="housing-section-header">
        <h3 className="housing-section-title">賃貸物件</h3>
      </div>

      <div className="housing-rental-schedules">
        {rentalViews.length === 0 ? (
          <div className="housing-rental-empty">
            賃貸物件が登録されていません。下のボタンから追加してください。
          </div>
        ) : (
          rentalViews.map((view) => {
            const periodMember =
              members.find((item) => item.id === view.periodMemberId) ?? member;
            return (
              <RentalPropertyCard
                key={`${view.storageTargetId}:${view.rental.id}:${view.amountRole}`}
                rental={view.rental}
                storageTargetId={view.storageTargetId}
                amountRole={view.amountRole}
                member={member}
                periodMember={periodMember}
                members={members}
                referenceDate={referenceDate}
                linkedInsurances={
                  linkedInsurancesByPropertyId[view.rental.id] ?? []
                }
                insuranceState={insuranceState}
                housingState={housingState}
                vehicleState={vehicleState}
                hasSpouse={hasSpouse}
                onChange={(updated) =>
                  onChangeRental(view.storageTargetId, updated)
                }
                onPayerModeChange={(payerMode) =>
                  onPayerModeChange(
                    view.storageTargetId,
                    view.rental.id,
                    payerMode,
                  )
                }
                onRemove={() =>
                  onRemoveRental(view.storageTargetId, view.rental.id)
                }
                onAddInsurance={
                  onAddInsurance
                    ? () => onAddInsurance(view.storageTargetId, view.rental)
                    : undefined
                }
                onUpdateInsurance={onUpdateInsurance}
                onRemoveInsurance={onRemoveInsurance}
              />
            );
          })
        )}
      </div>

      <div className="living-footer-actions housing-rental-add-actions">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onAdd}>
          ＋ 賃貸物件を追加
        </button>
      </div>
    </section>
  );
}
