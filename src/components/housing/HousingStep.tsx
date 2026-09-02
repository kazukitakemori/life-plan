import { useMemo, useState } from 'react';
import {
  countHousingItems,
  getHousingTargetData,
  migrateHousingState,
} from '../../lib/housingDefaults';
import { getInsurancesForHousingProperty } from '../../lib/insuranceDefaults';
import { getHousingLinkedLoansForProperty } from '../../lib/loanResolution';
import {
  getIncomeEligibleMembers,
  getLoanContractorMembers,
} from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import {
  HOUSEHOLD_HOUSING_KEY,
  type HousingState,
  type HousingTargetData,
  type OwnedProperty,
  type RentalProperty,
} from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { VehicleState } from '../../types/vehicle';
import type { HousingLinkedLoanView, LoanEntry, LoanState, LoanStructureType } from '../../types/loan';
import { MemberLivingTabs } from '../living/MemberLivingTabs';
import { SecondLifeTemplatePanel } from '../shared/SecondLifeTemplatePanel';
import { OwnedPropertySection } from './OwnedPropertySection';
import { RentalPropertySection } from './RentalPropertySection';

interface HousingStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  loanState: LoanState;
  vehicleState: VehicleState;
  insuranceState?: InsuranceState;
  referenceDate: Date;
  secondLifeStartAge?: number;
  purposeNote?: string;
  onChange: (state: HousingState) => void;
  onAddHousingLoan: (
    targetId: string,
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
  onAddFireInsurance?: (
    targetId: string,
    property: OwnedProperty | RentalProperty,
    propertyKind: 'owned' | 'rental',
    contractorMemberId: string,
  ) => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
  onAddSecondLifeRental?: () => void;
}

export function HousingStep({
  members,
  housingState,
  loanState,
  vehicleState,
  insuranceState,
  referenceDate,
  secondLifeStartAge,
  purposeNote,
  onChange,
  onAddHousingLoan,
  onRemoveHousingLoan,
  onUpdateLoan,
  onUpdatePairPartnerLoan,
  onPairShareChange,
  onJointDebtShareChange,
  onLoanPropertyFeeChange,
  onAddFireInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
  onAddSecondLifeRental,
}: HousingStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );
  const contractorMembers = useMemo(
    () => getLoanContractorMembers(members),
    [members],
  );
  const headMember = members.find((member) => member.role === 'head');

  const [activeTargetId, setActiveTargetId] = useState(HOUSEHOLD_HOUSING_KEY);

  const resolvedTargetId = (() => {
    if (activeTargetId === HOUSEHOLD_HOUSING_KEY) {
      return HOUSEHOLD_HOUSING_KEY;
    }
    return eligibleMembers.some((member) => member.id === activeTargetId)
      ? activeTargetId
      : HOUSEHOLD_HOUSING_KEY;
  })();

  const contextMember =
    resolvedTargetId === HOUSEHOLD_HOUSING_KEY
      ? headMember
      : eligibleMembers.find((member) => member.id === resolvedTargetId);

  const targetData = getHousingTargetData(housingState, resolvedTargetId);
  const hasSpouse = contractorMembers.some((member) => member.role === 'spouse');

  const linkedLoansByPropertyId = useMemo(() => {
    const map: Record<string, HousingLinkedLoanView[]> = {};
    for (const property of targetData.owned) {
      map[property.id] = getHousingLinkedLoansForProperty(
        loanState,
        members,
        resolvedTargetId,
        property.id,
      );
    }
    return map;
  }, [loanState, members, resolvedTargetId, targetData.owned]);

  const linkedInsurancesByOwnedId = useMemo(() => {
    const map: Record<string, ReturnType<typeof getInsurancesForHousingProperty>> =
      {};
    if (!insuranceState) return map;
    for (const property of targetData.owned) {
      map[property.id] = getInsurancesForHousingProperty(
        insuranceState,
        resolvedTargetId,
        property.id,
      );
    }
    return map;
  }, [insuranceState, resolvedTargetId, targetData.owned]);

  const linkedInsurancesByRentalId = useMemo(() => {
    const map: Record<string, ReturnType<typeof getInsurancesForHousingProperty>> =
      {};
    if (!insuranceState) return map;
    for (const rental of targetData.rentals) {
      map[rental.id] = getInsurancesForHousingProperty(
        insuranceState,
        resolvedTargetId,
        rental.id,
      );
    }
    return map;
  }, [insuranceState, resolvedTargetId, targetData.rentals]);

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [targetId, data] of Object.entries(housingState.byTarget)) {
      counts[targetId] = countHousingItems(data);
    }
    for (const member of eligibleMembers) {
      counts[member.id] ??= 0;
    }
    counts[HOUSEHOLD_HOUSING_KEY] ??= 0;
    return counts;
  }, [eligibleMembers, housingState.byTarget]);

  const persistTargetData = (
    targetId: string,
    updated: HousingTargetData,
  ) => {
    onChange(
      migrateHousingState({
        ...housingState,
        byTarget: { ...housingState.byTarget, [targetId]: updated },
      }),
    );
  };

  const contractorMemberId =
    resolvedTargetId === HOUSEHOLD_HOUSING_KEY
      ? (headMember?.id ?? '')
      : resolvedTargetId;

  if (!headMember || !contextMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族（Q1）で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page housing-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">Q5. 住まい</h2>
        </div>
        <div className="step-header-right">
          <button type="button" className="step-action-btn" disabled>
            解説
          </button>
          <button type="button" className="step-action-btn" disabled>
            ガイド
          </button>
          <button type="button" className="step-action-btn" disabled>
            参考リンク
          </button>
          <button type="button" className="step-action-btn" disabled>
            メモ
          </button>
          <button type="button" className="show-all-btn" disabled>
            全員まとめて表示
          </button>
        </div>
      </div>

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      {onAddSecondLifeRental ? (
        <SecondLifeTemplatePanel
          startAge={secondLifeStartAge}
          title="セカンドライフの住まい"
          description={`世帯主 ${secondLifeStartAge}歳からの賃貸物件（入居予定）を追加します。家賃・初期費用はあとから編集できます。`}
          buttonLabel="セカンドライフ用の賃貸を追加"
          onAdd={onAddSecondLifeRental}
        />
      ) : null}

      <MemberLivingTabs
        members={eligibleMembers}
        activeTargetId={resolvedTargetId}
        scheduleCounts={itemCounts}
        referenceDate={referenceDate}
        onSelect={setActiveTargetId}
      />

      <RentalPropertySection
        rentals={targetData.rentals}
        owned={targetData.owned}
        member={contextMember}
        members={members}
        referenceDate={referenceDate}
        linkedInsurancesByPropertyId={linkedInsurancesByRentalId}
        insuranceState={insuranceState}
        housingState={housingState}
        vehicleState={vehicleState}
        onChange={(rentals) =>
          persistTargetData(resolvedTargetId, { ...targetData, rentals })
        }
        onAddInsurance={
          onAddFireInsurance && contractorMemberId
            ? (rental) =>
                onAddFireInsurance(
                  resolvedTargetId,
                  rental,
                  'rental',
                  contractorMemberId,
                )
            : undefined
        }
        onUpdateInsurance={onUpdateInsurance}
        onRemoveInsurance={onRemoveInsurance}
      />

      <OwnedPropertySection
        owned={targetData.owned}
        rentals={targetData.rentals}
        member={contextMember}
        members={members}
        referenceDate={referenceDate}
        linkedLoansByPropertyId={linkedLoansByPropertyId}
        linkedInsurancesByPropertyId={linkedInsurancesByOwnedId}
        insuranceState={insuranceState}
        loanState={loanState}
        housingState={housingState}
        vehicleState={vehicleState}
        contractorMembers={contractorMembers}
        hasSpouse={hasSpouse}
        onChange={(owned) =>
          persistTargetData(resolvedTargetId, { ...targetData, owned })
        }
        onAddHousingLoan={(property, structureType, contractorMemberIds) =>
          onAddHousingLoan(
            resolvedTargetId,
            property,
            structureType,
            contractorMemberIds,
          )
        }
        onRemoveHousingLoan={onRemoveHousingLoan}
        onUpdateLoan={onUpdateLoan}
        onUpdatePairPartnerLoan={onUpdatePairPartnerLoan}
        onPairShareChange={onPairShareChange}
        onJointDebtShareChange={onJointDebtShareChange}
        onLoanPropertyFeeChange={onLoanPropertyFeeChange}
        onAddInsurance={
          onAddFireInsurance && contractorMemberId
            ? (property) =>
                onAddFireInsurance(
                  resolvedTargetId,
                  property,
                  'owned',
                  contractorMemberId,
                )
            : undefined
        }
        onUpdateInsurance={onUpdateInsurance}
        onRemoveInsurance={onRemoveInsurance}
      />
    </div>
  );
}
