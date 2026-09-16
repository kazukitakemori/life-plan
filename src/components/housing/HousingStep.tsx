import { useCallback, useMemo, useState } from 'react';
import {
  countHousingItems,
  createOwnedProperty,
  createRentalProperty,
  getHousingTargetData,
  migrateHousingState,
} from '../../lib/housingDefaults';
import { getInsurancesForHousingProperty } from '../../lib/insuranceDefaults';
import { getHousingLinkedLoansForProperty } from '../../lib/loanResolution';
import {
  getIncomeEligibleMembers,
  getLoanContractorMembers,
} from '../../lib/memberDisplay';
import { memberHasHousingData } from '../../lib/memberTabVisibility';
import {
  addRentalToTarget,
  applyRentalPayerModeChange,
  defaultPayerModeForTarget,
  listRentalViewsForTarget,
  removeStoredRental,
  updateStoredRental,
} from '../../lib/housingRentalPayer';
import {
  addOwnedToTarget,
  listOwnedViewsForTarget,
  memberHasLinkedOwnedHousing,
  removeStoredOwned,
  updateStoredOwned,
} from '../../lib/housingOwnedViews';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type {
  HousingState,
  OwnedProperty,
  OwnedPropertyType,
  RentalProperty,
} from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { VehicleState } from '../../types/vehicle';
import type {
  HousingLinkedLoanView,
  LoanEntry,
  LoanState,
  LoanStructureType,
} from '../../types/loan';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { StepHeading } from '../ui';
import { OwnedPropertySection } from './OwnedPropertySection';
import { RentalPropertySection } from './RentalPropertySection';

type HousingDomainFilter = 'rental' | 'owned';

const HOUSING_DOMAIN_FILTERS: {
  id: HousingDomainFilter;
  label: string;
}[] = [
  { id: 'rental', label: '賃貸' },
  { id: 'owned', label: '所有' },
];

interface HousingStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  loanState: LoanState;
  vehicleState: VehicleState;
  insuranceState?: InsuranceState;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  purposeNote?: string;
  onChange: (state: HousingState) => void;
  onHousingBundleChange?: (bundle: {
    housingState: HousingState;
    loanState: LoanState;
    insuranceState?: InsuranceState;
  }) => void;
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
}

export function HousingStep({
  members,
  housingState,
  loanState,
  vehicleState,
  insuranceState,
  referenceDate,
  memberTabExtras,
  onMemberTabExtrasChange,
  purposeNote,
  onChange,
  onHousingBundleChange,
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
  const spouseMember = members.find((member) => member.role === 'spouse');

  const [activeTargetId, setActiveTargetId] = useState(headMember?.id ?? '');
  const [domainFilter, setDomainFilter] = useState<HousingDomainFilter>('rental');

  const memberHasData = useCallback(
    (memberId: string) =>
      memberHasHousingData(housingState, memberId) ||
      memberHasLinkedOwnedHousing(
        housingState,
        loanState,
        members,
        memberId,
      ),
    [housingState, loanState, members],
  );

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'housing',
    members,
    memberTabExtras,
    onMemberTabExtrasChange,
    memberHasData,
    fallbackActiveId: headMember?.id ?? '',
    activeId: activeTargetId,
    setActiveId: setActiveTargetId,
  });

  const resolvedTargetId = visibleMembers.some(
    (member) => member.id === activeTargetId,
  )
    ? activeTargetId
    : (headMember?.id ?? visibleMembers[0]?.id ?? '');

  const contextMember =
    eligibleMembers.find((member) => member.id === resolvedTargetId) ??
    visibleMembers.find((member) => member.id === resolvedTargetId) ??
    headMember;

  const targetData = getHousingTargetData(housingState, resolvedTargetId);
  const hasSpouse = contractorMembers.some((member) => member.role === 'spouse');

  const rentalViews = useMemo(() => {
    if (!headMember) return [];
    return listRentalViewsForTarget(
      housingState,
      resolvedTargetId,
      headMember.id,
      spouseMember?.id,
    );
  }, [housingState, resolvedTargetId, headMember, spouseMember?.id]);

  const ownedViews = useMemo(() => {
    if (!headMember || !resolvedTargetId) return [];
    return listOwnedViewsForTarget(
      housingState,
      loanState,
      members,
      resolvedTargetId,
      headMember.id,
      spouseMember?.id,
    );
  }, [
    housingState,
    loanState,
    members,
    resolvedTargetId,
    headMember,
    spouseMember?.id,
  ]);

  const linkedLoansByPropertyId = useMemo(() => {
    const map: Record<string, HousingLinkedLoanView[]> = {};
    for (const view of ownedViews) {
      map[view.property.id] = getHousingLinkedLoansForProperty(
        loanState,
        members,
        view.storageTargetId,
        view.property.id,
      );
    }
    return map;
  }, [loanState, members, ownedViews]);

  const linkedInsurancesByOwnedId = useMemo(() => {
    const map: Record<string, ReturnType<typeof getInsurancesForHousingProperty>> =
      {};
    if (!insuranceState) return map;
    for (const view of ownedViews) {
      map[view.property.id] = getInsurancesForHousingProperty(
        insuranceState,
        view.storageTargetId,
        view.property.id,
      );
    }
    return map;
  }, [insuranceState, ownedViews]);

  const linkedInsurancesByRentalId = useMemo(() => {
    const map: Record<string, ReturnType<typeof getInsurancesForHousingProperty>> =
      {};
    if (!insuranceState) return map;
    for (const view of rentalViews) {
      map[view.rental.id] = getInsurancesForHousingProperty(
        insuranceState,
        view.storageTargetId,
        view.rental.id,
      );
    }
    return map;
  }, [insuranceState, rentalViews]);

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [targetId, data] of Object.entries(housingState.byTarget)) {
      counts[targetId] = countHousingItems(data);
    }
    for (const member of visibleMembers) {
      counts[member.id] ??= 0;
    }
    if (headMember && spouseMember) {
      const bothRentals = listRentalViewsForTarget(
        housingState,
        spouseMember.id,
        headMember.id,
        spouseMember.id,
      ).filter((view) => view.storageTargetId === headMember.id).length;
      const linkedOwned = listOwnedViewsForTarget(
        housingState,
        loanState,
        members,
        spouseMember.id,
        headMember.id,
        spouseMember.id,
      ).filter((view) => view.viewRole === 'linked').length;
      counts[spouseMember.id] =
        (counts[spouseMember.id] ?? 0) + bothRentals + linkedOwned;
    }
    return counts;
  }, [visibleMembers, housingState, loanState, members, headMember, spouseMember]);

  const persistHousing = (next: HousingState) => {
    onChange(
      migrateHousingState(
        next,
        headMember,
        referenceDate.getMonth() + 1,
        referenceDate.getFullYear(),
        { headId: headMember?.id },
      ),
    );
  };

  if (!headMember || !contextMember || !resolvedTargetId) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page housing-step">
      <StepHeading
        number={5}
        title="住まい"
        lead="現在とこれからの住まいを登録します。まず入力する人を選び、賃貸または所有から物件を追加してください。"
      />

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      <MemberIncomeTabs
        members={visibleMembers}
        activeMemberId={resolvedTargetId}
        entryCounts={itemCounts}
        referenceDate={referenceDate}
        onSelect={setActiveTargetId}
        addableMembers={addableMembers}
        onAddMemberTab={handleAddMemberTab}
        removableMemberIds={removableMemberIds}
        onRemoveMemberTab={handleRemoveMemberTab}
      />

      <div className="housing-domain-filter" role="toolbar" aria-label="住まいの表示切替">
        <div
          className="housing-domain-filter-tabs"
          role="group"
          aria-label="賃貸・所有の表示"
        >
          {HOUSING_DOMAIN_FILTERS.map((filter) => {
            const count =
              filter.id === 'rental' ? rentalViews.length : ownedViews.length;
            const active = domainFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                className={
                  active
                    ? 'housing-domain-filter-tab is-active'
                    : 'housing-domain-filter-tab'
                }
                aria-pressed={active}
                onClick={() => setDomainFilter(filter.id)}
              >
                {filter.label}
                <span className="housing-domain-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {domainFilter === 'rental' ? (
        <RentalPropertySection
          rentalViews={rentalViews}
          member={contextMember}
          members={members}
          referenceDate={referenceDate}
          linkedInsurancesByPropertyId={linkedInsurancesByRentalId}
          insuranceState={insuranceState}
          housingState={housingState}
          vehicleState={vehicleState}
          hasSpouse={Boolean(spouseMember)}
          onAdd={() => {
            const payerMode = defaultPayerModeForTarget(
              resolvedTargetId,
              headMember.id,
              spouseMember?.id,
            );
            const rental = createRentalProperty(
              contextMember,
              referenceDate.getMonth() + 1,
              referenceDate.getFullYear(),
              { payerMode },
              { rentals: targetData.rentals, owned: targetData.owned },
            );
            persistHousing(
              addRentalToTarget(housingState, resolvedTargetId, rental),
            );
          }}
          onChangeRental={(storageTargetId, rental) => {
            persistHousing(
              updateStoredRental(housingState, storageTargetId, rental),
            );
          }}
          onRemoveRental={(storageTargetId, rentalId) => {
            persistHousing(
              removeStoredRental(housingState, storageTargetId, rentalId),
            );
          }}
          onPayerModeChange={(storageTargetId, rentalId, payerMode) => {
            const result = applyRentalPayerModeChange({
              housingState,
              loanState,
              insuranceState,
              storageTargetId,
              rentalId,
              payerMode,
              headId: headMember.id,
              spouseId: spouseMember?.id,
            });
            if (onHousingBundleChange) {
              onHousingBundleChange({
                housingState: result.housingState,
                loanState: result.loanState,
                insuranceState: result.insuranceState,
              });
            } else {
              persistHousing(result.housingState);
            }
            if (
              payerMode === 'spouse' &&
              spouseMember &&
              resolvedTargetId !== spouseMember.id
            ) {
              setActiveTargetId(spouseMember.id);
            }
            if (
              (payerMode === 'head' || payerMode === 'both') &&
              resolvedTargetId !== headMember.id &&
              storageTargetId !== headMember.id
            ) {
              setActiveTargetId(headMember.id);
            }
          }}
          onAddInsurance={
            onAddFireInsurance
              ? (storageTargetId, rental) =>
                  onAddFireInsurance(
                    storageTargetId,
                    rental,
                    'rental',
                    storageTargetId,
                  )
              : undefined
          }
          onUpdateInsurance={onUpdateInsurance}
          onRemoveInsurance={onRemoveInsurance}
        />
      ) : null}

      {domainFilter === 'owned' ? (
        <OwnedPropertySection
          ownedViews={ownedViews}
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
          onAddProperty={(type: OwnedPropertyType) => {
            const property = createOwnedProperty(
              type,
              contextMember,
              referenceDate.getMonth() + 1,
              referenceDate.getFullYear(),
              {},
              { rentals: targetData.rentals, owned: targetData.owned },
            );
            persistHousing(
              addOwnedToTarget(housingState, resolvedTargetId, property),
            );
          }}
          onChangeProperty={(storageTargetId, property) => {
            persistHousing(
              updateStoredOwned(housingState, storageTargetId, property),
            );
          }}
          onRemoveProperty={(storageTargetId, propertyId) => {
            persistHousing(
              removeStoredOwned(housingState, storageTargetId, propertyId),
            );
          }}
          onAddHousingLoan={(
            storageTargetId,
            property,
            structureType,
            contractorMemberIds,
          ) =>
            onAddHousingLoan(
              storageTargetId,
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
            onAddFireInsurance
              ? (storageTargetId, property) =>
                  onAddFireInsurance(
                    storageTargetId,
                    property,
                    'owned',
                    storageTargetId,
                  )
              : undefined
          }
          onUpdateInsurance={onUpdateInsurance}
          onRemoveInsurance={onRemoveInsurance}
        />
      ) : null}
    </div>
  );
}
