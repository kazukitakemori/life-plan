import { formatVehicleLoanName } from '../../lib/loanLabels';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type { LoanEntry, LoanState, VehicleLinkedLoanView } from '../../types/loan';
import type { VehicleState } from '../../types/vehicle';
import { VehicleLinkedLoanList } from '../loan/LinkedLoanList';

interface VehicleLoanLinksProps {
  vehicleName: string;
  loans: VehicleLinkedLoanView[];
  members: FamilyMember[];
  loanState: LoanState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  addLoanEnabled?: boolean;
  onAddLoan: () => void;
  onUpdateLoan: (entry: LoanEntry) => void;
  onRemoveLoan: (entryId: string) => void;
}

export function VehicleLoanLinks({
  vehicleName,
  loans,
  members,
  loanState,
  housingState,
  vehicleState,
  referenceDate,
  addLoanEnabled = true,
  onAddLoan,
  onUpdateLoan,
  onRemoveLoan,
}: VehicleLoanLinksProps) {
  const loanLabel = formatVehicleLoanName(vehicleName);
  const addLoanPlaceholder = !addLoanEnabled;

  return (
    <div className="housing-owned-loan-links">
      <VehicleLinkedLoanList
        loans={loans}
        itemLabel={loanLabel}
        layout="card"
        members={members}
        loanState={loanState}
        housingState={housingState}
        vehicleState={vehicleState}
        referenceDate={referenceDate}
        vehicleName={vehicleName}
        rowClassName="vehicle-loan-link-row"
        itemClassName="housing-owned-loan-card-wrap"
        nameClassName="vehicle-loan-link-label"
        removeClassName="housing-row-remove"
        onUpdateLoan={onUpdateLoan}
        onRemoveLoan={onRemoveLoan}
      />

      <button
        type="button"
        className={[
          'housing-owned-loan-add-btn',
          addLoanPlaceholder ? 'housing-owned-loan-add-btn--placeholder' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onAddLoan}
        disabled={!addLoanEnabled}
        title={
          addLoanPlaceholder
            ? '購入費用を入力するとローンを追加できます'
            : undefined
        }
      >
        ＋ ローンを追加
      </button>
    </div>
  );
}
