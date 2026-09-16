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
      <div className="housing-linked-overview">
        <div className="housing-linked-overview-main">
          <strong className="housing-linked-overview-title">火災・地震保険</strong>
          <span className="housing-linked-overview-status">
            {insurances.length > 0 ? `${insurances.length}件登録済み` : '未登録'}
          </span>
        </div>
        <p className="housing-linked-overview-note">
          この物件に連動する火災・地震保険を登録・編集します。
        </p>
      </div>

      {insurances.length > 0 ? (
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
      ) : (
        <div className="housing-linked-empty">火災・地震保険はまだ登録されていません。</div>
      )}

      <div className="housing-linked-add-area">
        <button
          type="button"
          className="housing-owned-loan-add-btn"
          onClick={onAddInsurance}
        >
          ＋ 火災・地震保険を追加
        </button>
      </div>
    </div>
  );
}
