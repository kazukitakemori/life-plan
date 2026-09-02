import { useState } from 'react';

import { formatHousingLoanName } from '../../lib/loanLabels';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type {
  HousingLinkedLoanView,
  LoanEntry,
  LoanState,
  LoanStructureType,
} from '../../types/loan';
import type { OwnedProperty } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { HousingLinkedLoanList } from '../loan/LinkedLoanList';
import { HousingLoanStructurePicker } from '../loan/HousingLoanStructurePicker';

interface HousingLoanLinksProps {
  propertyName: string;
  loans: HousingLinkedLoanView[];
  contractorMembers: FamilyMember[];
  hasSpouse: boolean;
  members: FamilyMember[];
  loanState: LoanState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  /** false のとき「ローンを追加」をプレースホルダー表示（取得価格未入力など） */
  addLoanEnabled?: boolean;
  onAddLoan: (
    structureType: LoanStructureType,
    contractorMemberIds: [string] | [string, string],
  ) => void;
  onUpdateLoan: (entry: LoanEntry) => void;
  onUpdatePairPartnerLoan?: (entry: LoanEntry) => void;
  onPairShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onJointDebtShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onPropertyFeeChange?: (
    entry: LoanEntry,
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => void;
  onRemoveLoan: (entryId: string) => void;
}

export function HousingLoanLinks({
  propertyName,
  loans,
  contractorMembers,
  hasSpouse,
  members,
  loanState,
  housingState,
  vehicleState,
  referenceDate,
  addLoanEnabled = true,
  onAddLoan,
  onUpdateLoan,
  onUpdatePairPartnerLoan,
  onPairShareChange,
  onJointDebtShareChange,
  onPropertyFeeChange,
  onRemoveLoan,
}: HousingLoanLinksProps) {
  const [showStructurePicker, setShowStructurePicker] = useState(false);
  const [pickingContractor, setPickingContractor] = useState(false);
  const [pendingStructureType, setPendingStructureType] =
    useState<LoanStructureType | null>(null);

  const loanLabel = formatHousingLoanName(propertyName);
  const canAddLoan = addLoanEnabled && contractorMembers.length > 0;
  const addLoanPlaceholder = !addLoanEnabled;

  const headMember = contractorMembers.find((member) => member.role === 'head');
  const spouseMember = contractorMembers.find((member) => member.role === 'spouse');

  const handleAddClick = () => {
    if (!canAddLoan) return;
    setShowStructurePicker(true);
  };

  const finishAdd = (
    structureType: LoanStructureType,
    contractorMemberIds: [string] | [string, string],
  ) => {
    onAddLoan(structureType, contractorMemberIds);
    setShowStructurePicker(false);
    setPickingContractor(false);
    setPendingStructureType(null);
  };

  const handleStructureConfirm = (structureType: LoanStructureType) => {
    if (structureType === 'pair') {
      if (headMember && spouseMember) {
        finishAdd('pair', [headMember.id, spouseMember.id]);
      }
      return;
    }

    if (contractorMembers.length === 1) {
      finishAdd(structureType, [contractorMembers[0].id]);
      return;
    }

    setPendingStructureType(structureType);
    setShowStructurePicker(false);
    setPickingContractor(true);
  };

  const handleSelectContractor = (memberId: string) => {
    if (pendingStructureType) {
      finishAdd(pendingStructureType, [memberId]);
    }
  };

  const handleStructureCancel = () => {
    setShowStructurePicker(false);
    setPickingContractor(false);
    setPendingStructureType(null);
  };

  return (
    <div className="housing-owned-loan-links">
      <HousingLinkedLoanList
        loans={loans}
        itemLabel={loanLabel}
        layout="card"
        members={members}
        loanState={loanState}
        housingState={housingState}
        vehicleState={vehicleState}
        referenceDate={referenceDate}
        housingPropertyName={propertyName}
        rowClassName="housing-loan-item"
        itemClassName="housing-owned-loan-card-wrap"
        nameClassName="housing-loan-item-name"
        removeClassName="housing-row-remove"
        onUpdateLoan={onUpdateLoan}
        onUpdatePairPartnerLoan={onUpdatePairPartnerLoan}
        onPairShareChange={onPairShareChange}
        onJointDebtShareChange={onJointDebtShareChange}
        onPropertyFeeChange={onPropertyFeeChange}
        onRemoveLoan={onRemoveLoan}
      />

      {showStructurePicker ? (
        <HousingLoanStructurePicker
          hasSpouse={hasSpouse}
          confirmLabel="この形態でローンを追加"
          onConfirm={handleStructureConfirm}
          onCancel={handleStructureCancel}
        />
      ) : pickingContractor ? (
        <div className="housing-owned-loan-contractor-picker">
          <p className="housing-owned-loan-contractor-label">契約者を選択</p>
          <div className="housing-owned-loan-contractor-options">
            {contractorMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                className="housing-owned-loan-contractor-btn"
                onClick={() => handleSelectContractor(member.id)}
              >
                {getMemberTabLabel(member)}
              </button>
            ))}
            <button
              type="button"
              className="housing-owned-loan-contractor-cancel"
              onClick={handleStructureCancel}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={[
            'housing-owned-loan-add-btn',
            addLoanPlaceholder ? 'housing-owned-loan-add-btn--placeholder' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleAddClick}
          disabled={!canAddLoan}
          title={
            addLoanPlaceholder
              ? '取得価格（建物・土地）を入力するとローンを追加できます'
              : undefined
          }
          aria-disabled={addLoanPlaceholder || undefined}
        >
          ＋ ローンを追加
        </button>
      )}
    </div>
  );
}
