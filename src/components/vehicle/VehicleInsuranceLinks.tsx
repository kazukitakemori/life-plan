import { formatAutoInsuranceName } from '../../lib/insuranceLabels';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { VehicleState } from '../../types/vehicle';
import { LinkedInsuranceList } from '../insurance/LinkedInsuranceList';

interface VehicleInsuranceLinksProps {
  vehicleName: string;
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

export function VehicleInsuranceLinks({
  vehicleName,
  insurances,
  members,
  insuranceState,
  housingState,
  vehicleState,
  referenceDate,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: VehicleInsuranceLinksProps) {
  const insuranceLabel = formatAutoInsuranceName(vehicleName);

  return (
    <div className="housing-owned-insurance-links">
      <LinkedInsuranceList
        insurances={insurances}
        itemLabel={insuranceLabel}
        variant="vehicle-linked"
        layout="card"
        members={members}
        insuranceState={insuranceState}
        housingState={housingState}
        vehicleState={vehicleState}
        referenceDate={referenceDate}
        vehicleName={vehicleName}
        rowClassName="vehicle-insurance-link-row"
        itemClassName="housing-owned-insurance-card-wrap"
        nameClassName="vehicle-insurance-link-label"
        removeClassName="housing-row-remove"
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
