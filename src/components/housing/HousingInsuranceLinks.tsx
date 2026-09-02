import { formatFireInsuranceName } from '../../lib/insuranceLabels';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { VehicleState } from '../../types/vehicle';
import { LinkedInsuranceList } from '../insurance/LinkedInsuranceList';

interface HousingInsuranceLinksProps {
  propertyName: string;
  insurances: InsuranceEntry[];
  members: FamilyMember[];
  insuranceState: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  onAddInsurance: () => void;
  onUpdateInsurance: (entry: InsuranceEntry) => void;
  onRemoveInsurance: (entryId: string) => void;
}

export function HousingInsuranceLinks({
  propertyName,
  insurances,
  members,
  insuranceState,
  housingState,
  vehicleState,
  referenceDate,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: HousingInsuranceLinksProps) {
  const insuranceLabel = formatFireInsuranceName(propertyName);

  return (
    <div className="housing-owned-insurance-links">
      <LinkedInsuranceList
        insurances={insurances}
        itemLabel={insuranceLabel}
        variant="housing-linked"
        layout="card"
        members={members}
        insuranceState={insuranceState}
        housingState={housingState}
        vehicleState={vehicleState}
        referenceDate={referenceDate}
        housingPropertyName={propertyName}
        rowClassName="housing-insurance-item"
        itemClassName="housing-owned-insurance-card-wrap"
        nameClassName="housing-insurance-item-name"
        removeClassName="housing-insurance-remove"
        onUpdateInsurance={onUpdateInsurance}
        onRemoveInsurance={onRemoveInsurance}
      />

      <button
        type="button"
        className="housing-owned-loan-add-btn"
        onClick={onAddInsurance}
      >
        ＋ 保険の追加
      </button>
    </div>
  );
}
