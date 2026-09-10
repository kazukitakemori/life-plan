import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SecondLifeHousingSection } from '../secondLife/SecondLifeHousingSection';
import { SecondLifeRefinePanel } from '../shared/SecondLifeRefinePanel';
import { StepHeading } from '../ui';
import { OwnedPropertySection } from './OwnedPropertySection';
import { RentalPropertySection } from './RentalPropertySection';
import { HousingSecondLifeApplyConfirmModal } from './HousingSecondLifeApplyConfirmModal';
import {
  getHousingApplyHighlightSets,
  housingPropertyElementId,
  HousingSecondLifeApplySummary,
  resolveHousingDomainFilterFromApplyChanges,
  type HousingSecondLifeApplyFeedback,
} from './HousingSecondLifeApplySummary';
import {
  formatSecondLifeHousingApplyPreviewLines,
  getSecondLifeHousingApplyWarnings,
} from '../../lib/secondLifeHousingApplySummary';
import type { SecondLifeState } from '../../types/secondLife';
import { getSecondLifeHousingDesignSummary } from '../../lib/secondLifeLabels';
import type { SecondLifeHousingApplyResult } from '../../lib/secondLifeTemplates';
import type { StepId } from '../../types/steps';

type HousingDomainFilter = 'rental' | 'owned';

const HOUSING_DOMAIN_FILTERS: {
  id: HousingDomainFilter;
  label: string;
}[] = [
  { id: 'rental', label: '賃貸' },
  { id: 'owned', label: '所有' },
];

function scrollToHousingElement(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

interface HousingStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  loanState: LoanState;
  vehicleState: VehicleState;
  insuranceState?: InsuranceState;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  secondLifeState?: SecondLifeState;
  purposeNote?: string;
  onChange: (state: HousingState) => void;
  onHousingBundleChange?: (bundle: {
    housingState: HousingState;
    loanState: LoanState;
    insuranceState?: InsuranceState;
  }) => void;
  onSecondLifeChange?: (state: SecondLifeState) => void;
  onApplySecondLifeHousing?: () => SecondLifeHousingApplyResult | void;
  /** 反映前プレビュー用。状態は更新しない */
  onPreviewSecondLifeHousing?: () => SecondLifeHousingApplyResult | void;
  onNavigateToStep?: (stepId: StepId) => void;
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
  secondLifeState,
  purposeNote,
  onChange,
  onHousingBundleChange,
  onSecondLifeChange,
  onApplySecondLifeHousing,
  onPreviewSecondLifeHousing,
  onNavigateToStep,
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
  const [refineOpen, setRefineOpen] = useState(false);
  const [applyFeedback, setApplyFeedback] =
    useState<HousingSecondLifeApplyFeedback | null>(null);
  const [applyConfirm, setApplyConfirm] = useState<{
    previewLines: string[];
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    if (!applyFeedback) return;
    scrollToHousingElement('housing-second-life-apply-summary');
  }, [applyFeedback?.id]);

  const commitApplySecondLifeHousing = useCallback(() => {
    const result = onApplySecondLifeHousing?.();
    if (!result) return;

    setRefineOpen(false);
    setDomainFilter(resolveHousingDomainFilterFromApplyChanges(result.changes));
    setApplyFeedback({
      id: Date.now(),
      kind: result.kind,
      changeLines: result.changeLines,
      changes: result.changes,
    });
  }, [onApplySecondLifeHousing]);

  const applyHighlight = useMemo(() => {
    if (!applyFeedback) {
      return {
        highlightTokenById: undefined as Map<string, number> | undefined,
        endedPropertyIds: undefined as Set<string> | undefined,
      };
    }
    const { highlightedIds, endedIds } = getHousingApplyHighlightSets(
      applyFeedback.changes,
    );
    const highlightTokenById = new Map<string, number>();
    for (const id of highlightedIds) {
      highlightTokenById.set(id, applyFeedback.id);
    }
    return {
      highlightTokenById,
      endedPropertyIds: endedIds,
    };
  }, [applyFeedback]);

  const scrollToApplyProperty = useCallback(
    (kind: 'rental' | 'owned') => {
      if (!applyFeedback) {
        scrollToHousingElement(
          kind === 'rental' ? 'housing-rental-section' : 'housing-owned-section',
        );
        return;
      }
      const { highlightedIds, endedIds } = getHousingApplyHighlightSets(
        applyFeedback.changes,
      );
      const preferredId =
        [...highlightedIds].find((id) =>
          applyFeedback.changes.some(
            (change) =>
              change.type === 'added' &&
              change.propertyKind === kind &&
              change.id === id,
          ),
        ) ??
        [...endedIds].find((id) =>
          applyFeedback.changes.some(
            (change) =>
              change.type === 'ended' &&
              change.propertyKind === kind &&
              change.id === id,
          ),
        );
      if (preferredId) {
        scrollToHousingElement(housingPropertyElementId(kind, preferredId));
        return;
      }
      scrollToHousingElement(
        kind === 'rental' ? 'housing-rental-section' : 'housing-owned-section',
      );
    },
    [applyFeedback],
  );

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

  const handleRequestApplySecondLifeHousing = useCallback(() => {
    const preview = onPreviewSecondLifeHousing?.();
    if (!preview) {
      commitApplySecondLifeHousing();
      return;
    }

    setApplyConfirm({
      previewLines: formatSecondLifeHousingApplyPreviewLines(preview.changes),
      warnings: secondLifeState
        ? getSecondLifeHousingApplyWarnings({
            secondLifeState,
            existingHousingCount: rentalViews.length + ownedViews.length,
          })
        : [],
    });
  }, [
    onPreviewSecondLifeHousing,
    commitApplySecondLifeHousing,
    rentalViews.length,
    ownedViews.length,
    secondLifeState,
  ]);

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
        lead="物件は負担する人のタブへ。賃貸は負担者を選べ、持ち家はローン契約者に連動します。"
        actions={
          <button type="button" className="show-all-btn" disabled>
            全員まとめて表示
          </button>
        }
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
        {secondLifeState && onSecondLifeChange ? (
          <button
            type="button"
            className="housing-domain-filter-jump"
            onClick={() => {
              document
                .getElementById('housing-second-life')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            セカンドライフへ
          </button>
        ) : null}
      </div>

      {applyFeedback ? (
        <HousingSecondLifeApplySummary
          feedback={applyFeedback}
          onDismiss={() => setApplyFeedback(null)}
          onShowRental={() => {
            setDomainFilter('rental');
            requestAnimationFrame(() => scrollToApplyProperty('rental'));
          }}
          onShowOwned={() => {
            setDomainFilter('owned');
            requestAnimationFrame(() => scrollToApplyProperty('owned'));
          }}
          onOpenLifeEvent={
            onNavigateToStep
              ? () => onNavigateToStep('life-event')
              : undefined
          }
        />
      ) : null}

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
        highlightTokenById={applyHighlight.highlightTokenById}
        endedPropertyIds={applyHighlight.endedPropertyIds}
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
        highlightTokenById={applyHighlight.highlightTokenById}
        endedPropertyIds={applyHighlight.endedPropertyIds}
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

      {secondLifeState && onSecondLifeChange ? (
        <div id="housing-second-life" className="housing-second-life-anchor">
          <SecondLifeRefinePanel
            title="セカンドライフの住まいを具体化する"
            summary={getSecondLifeHousingDesignSummary(secondLifeState)}
            open={refineOpen}
            onOpenChange={setRefineOpen}
          >
            <SecondLifeHousingSection
              state={secondLifeState}
              onChange={(patch) =>
                onSecondLifeChange({
                  ...secondLifeState,
                  ...patch,
                })
              }
              onApply={handleRequestApplySecondLifeHousing}
            />
          </SecondLifeRefinePanel>
        </div>
      ) : null}

      <HousingSecondLifeApplyConfirmModal
        open={applyConfirm != null}
        previewLines={applyConfirm?.previewLines ?? []}
        warnings={applyConfirm?.warnings ?? []}
        onClose={() => setApplyConfirm(null)}
        onConfirm={() => {
          setApplyConfirm(null);
          commitApplySecondLifeHousing();
        }}
      />
    </div>
  );
}
