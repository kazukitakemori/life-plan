import { createRentalProperty } from '../../lib/housingDefaults';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty, RentalProperty } from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { RentalPropertyCard } from './RentalPropertyCard';

interface RentalPropertySectionProps {
  rentals: RentalProperty[];
  owned: OwnedProperty[];
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedInsurancesByPropertyId?: Record<string, InsuranceEntry[]>;
  insuranceState?: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  onChange: (rentals: RentalProperty[]) => void;
  onAddInsurance?: (rental: RentalProperty) => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

export function RentalPropertySection({
  rentals,
  owned,
  member,
  members,
  referenceDate,
  linkedInsurancesByPropertyId = {},
  insuranceState,
  housingState,
  vehicleState,
  onChange,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: RentalPropertySectionProps) {
  const refMonth = referenceDate.getMonth() + 1;
  const refYear = referenceDate.getFullYear();

  const updateRental = (id: string, updated: RentalProperty) => {
    onChange(rentals.map((rental) => (rental.id === id ? updated : rental)));
  };

  const removeRental = (id: string) => {
    onChange(rentals.filter((rental) => rental.id !== id));
  };

  const addRental = () => {
    onChange([
      ...rentals,
      createRentalProperty(member, refMonth, refYear, {}, { rentals, owned }),
    ]);
  };

  return (
    <section className="housing-section">
      <h3 className="housing-section-title">1. 賃貸物件</h3>

      <div className="housing-rental-schedules">
        {rentals.length === 0 ? (
          <div className="housing-rental-empty">
            賃貸物件が登録されていません。下のボタンから追加してください。
          </div>
        ) : (
          rentals.map((rental) => (
            <RentalPropertyCard
              key={rental.id}
              rental={rental}
              member={member}
              members={members}
              referenceDate={referenceDate}
              linkedInsurances={linkedInsurancesByPropertyId[rental.id] ?? []}
              insuranceState={insuranceState}
              housingState={housingState}
              vehicleState={vehicleState}
              onChange={(updated) => updateRental(rental.id, updated)}
              onRemove={() => removeRental(rental.id)}
              onAddInsurance={
                onAddInsurance ? () => onAddInsurance(rental) : undefined
              }
              onUpdateInsurance={onUpdateInsurance}
              onRemoveInsurance={onRemoveInsurance}
            />
          ))
        )}
      </div>

      <button type="button" className="footer-action-btn" onClick={addRental}>
        ＋ 賃貸物件を追加
      </button>
    </section>
  );
}
