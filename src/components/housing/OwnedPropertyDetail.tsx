import { useEffect, useMemo, useState } from 'react';
import {
  calcBirthYear,
  formatEndYearLabel,
  formatYearAtAgeLabel,
} from '../../lib/birthDate';
import { formatOwnedAcquisitionTotalMan } from '../../lib/housingOwnedAmount';
import {
  OWNED_PROPERTY_CURRENT_EXPENSE_MODE_LABELS,
  OWNED_PROPERTY_CURRENT_LOAN_STATUS_LABELS,
  OWNED_PROPERTY_LOAN_PAYMENT_LABELS,
} from '../../lib/housingLabels';
import { getLivingAgeOptions } from '../../lib/livingDefaults';
import {
  clampFutureStartFields,
  clampPastInclusiveStartFields,
  filterAgesAtOrAfter,
  filterAgesAtOrBefore,
  filterMonthsAtOrAfter,
  filterMonthsAtOrBefore,
  pinStartToAgeMonth,
  resolveReferenceNowAgeMonth,
  resolveSimulationStartAgeMonth,
} from '../../lib/periodTimingBounds';
import type { FamilyMember } from '../../types/family';
import type {
  OwnedProperty,
  OwnedPropertyCurrentExpenseMode,
  OwnedPropertyLoanPaymentType,
} from '../../types/housing';
import type {
  HousingLinkedLoanView,
  LoanEntry,
  LoanState,
  LoanStructureType,
} from '../../types/loan';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { HousingLoanLinks } from './HousingLoanLinks';
import { HousingInsuranceLinks } from './HousingInsuranceLinks';
import {
  AcquisitionReferenceModal,
  type AcquisitionFeeBreakdown,
  type AcquisitionReferenceSection,
} from './AcquisitionReferenceModal';
import { AcquisitionTaxDetailModal } from './AcquisitionTaxDetailModal';
import { buildAcquisitionFeeBreakdownFromProperty } from '../../lib/housingAcquisitionFees';
import { isPairLoanEntry } from '../../lib/pairLoanShare';
import { HousingManInput } from './HousingManInput';
import { HousingOwnedDetailFold } from './HousingOwnedDetailFold';
import { OwnedPropertyAcquisitionSection } from './OwnedPropertyAcquisitionSection';
import { OwnedPropertyMaintenanceSection } from './OwnedPropertyMaintenanceSection';
import { OwnedPropertyTargetSection } from './OwnedPropertyTargetSection';

interface OwnedPropertyDetailProps {
  property: OwnedProperty;
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedLoans: HousingLinkedLoanView[];
  linkedInsurances?: InsuranceEntry[];
  insuranceState?: InsuranceState;
  loanState: LoanState;
  housingState: HousingState;
  vehicleState: VehicleState;
  contractorMembers: FamilyMember[];
  hasSpouse: boolean;
  canAddLoan?: boolean;
  onChange: (property: OwnedProperty) => void;
  onAddLoan: (
    structureType: LoanStructureType,
    contractorMemberIds: [string] | [string, string],
  ) => void;
  onRemoveLoan: (entryId: string) => void;
  onUpdateLoan?: (entry: LoanEntry) => void;
  onUpdatePairPartnerLoan?: (entry: LoanEntry) => void;
  onPairShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onJointDebtShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onLoanPropertyFeeChange?: (
    entry: LoanEntry,
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => void;
  onAddInsurance?: () => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const END_AGES = Array.from({ length: 101 }, (_, index) => index);

const PAYMENT_METHODS: OwnedPropertyLoanPaymentType[] = ['loan', 'cash'];
const CURRENT_EXPENSE_MODES: OwnedPropertyCurrentExpenseMode[] = [
  'simple',
  'analysis',
];

export function OwnedPropertyDetail({
  property,
  member,
  members,
  referenceDate,
  linkedLoans,
  linkedInsurances = [],
  insuranceState,
  loanState,
  housingState,
  vehicleState,
  contractorMembers,
  hasSpouse,
  canAddLoan = true,
  onChange,
  onAddLoan,
  onRemoveLoan,
  onUpdateLoan,
  onUpdatePairPartnerLoan,
  onPairShareChange,
  onJointDebtShareChange,
  onLoanPropertyFeeChange,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: OwnedPropertyDetailProps) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageOptions = getLivingAgeOptions(member);
  const acquisitionTotal = formatOwnedAcquisitionTotalMan(property);
  const showBuildingField = property.type !== 'land';
  const isCurrentlyOccupied = property.usage === 'current';
  const isUpcoming = property.usage === 'upcoming';
  const isSimpleMode =
    isCurrentlyOccupied && property.currentExpenseMode === 'simple';
  const isCurrentDetailedMode = isCurrentlyOccupied && !isSimpleMode;
  const simStart = useMemo(
    () => resolveSimulationStartAgeMonth(member, referenceDate),
    [member, referenceDate],
  );
  const refNow = useMemo(
    () => resolveReferenceNowAgeMonth(member, referenceDate),
    [member, referenceDate],
  );
  const startAgeOptions = isUpcoming
    ? filterAgesAtOrAfter(ageOptions, simStart)
    : isCurrentlyOccupied && !isSimpleMode
      ? filterAgesAtOrBefore(ageOptions, refNow)
      : ageOptions;
  const startMonthOptions = isUpcoming
    ? filterMonthsAtOrAfter(property.startAge, simStart, MONTHS)
    : isCurrentlyOccupied && !isSimpleMode
      ? filterMonthsAtOrBefore(property.startAge, refNow, MONTHS)
      : MONTHS;
  // 居住中は過去の取得価格を通常入力させない。保存済みデータは保持する。
  const showAcquisitionSection = !isSimpleMode && !isCurrentlyOccupied;
  const hasAcquisitionAmount = property.buildingMan + property.landMan > 0;
  const simpleExpenseSectionNumber = 2;
  const targetSectionNumber = isCurrentDetailedMode ? 3 : 2;
  const acquisitionSectionNumber = showAcquisitionSection ? 3 : null;
  const paymentSectionNumber = isCurrentDetailedMode
    ? 2
    : showAcquisitionSection
      ? 4
      : 3;
  const insuranceSectionNumber = isSimpleMode
    ? 3
    : isCurrentDetailedMode
      ? 4
      : 5;
  const maintenanceSectionNumber = isCurrentDetailedMode ? 5 : 6;
  const [acqRefSection, setAcqRefSection] =
    useState<AcquisitionReferenceSection | null>(null);
  const [acqDetailOpen, setAcqDetailOpen] = useState(false);
  const [acqBreakdown, setAcqBreakdown] =
    useState<AcquisitionFeeBreakdown | null>(null);
  const canFetchAcquisitionFees = property.buildingMan + property.landMan > 0;
  const hasRegisteredPairLoan = linkedLoans.some((loan) =>
    isPairLoanEntry(loan.entry),
  );
  const hasPairLoan =
    linkedLoans.filter((loan) => isPairLoanEntry(loan.entry)).length >= 2;

  const update = (patch: Partial<OwnedProperty>) => {
    let next = { ...property, ...patch };
    const nextSimple =
      (patch.usage ?? next.usage) === 'current' &&
      (patch.currentExpenseMode ?? next.currentExpenseMode) === 'simple';
    const nextUpcoming = (patch.usage ?? next.usage) === 'upcoming';
    const nextCurrentDetail =
      (patch.usage ?? next.usage) === 'current' && !nextSimple;
    if (nextUpcoming) {
      next = clampFutureStartFields(next, simStart);
    } else if (nextSimple) {
      next = pinStartToAgeMonth(next, refNow);
    } else if (nextCurrentDetail) {
      next = clampPastInclusiveStartFields(next, refNow);
    }
    onChange(next);
  };

  const handleCurrentExpenseModeChange = (
    mode: OwnedPropertyCurrentExpenseMode,
  ) => {
    if (mode === 'simple' && hasRegisteredPairLoan) {
      return;
    }
    update({ currentExpenseMode: mode });
  };

  useEffect(() => {
    if (isUpcoming) {
      const clamped = clampFutureStartFields(property, simStart);
      if (
        clamped.startAge !== property.startAge ||
        clamped.startMonth !== property.startMonth
      ) {
        onChange(clamped);
      }
      return;
    }
    if (isSimpleMode) {
      const pinned = pinStartToAgeMonth(property, refNow);
      if (
        pinned.startAge !== property.startAge ||
        pinned.startMonth !== property.startMonth
      ) {
        onChange(pinned);
      }
      return;
    }
    if (isCurrentlyOccupied) {
      const clamped = clampPastInclusiveStartFields(property, refNow);
      if (
        clamped.startAge !== property.startAge ||
        clamped.startMonth !== property.startMonth
      ) {
        onChange(clamped);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    simStart.age,
    simStart.month,
    refNow.age,
    refNow.month,
    isUpcoming,
    isSimpleMode,
    isCurrentlyOccupied,
  ]);

  const handleFetchAcquisitionFees = () => {
    // 所有開始の約6ヶ月後を取得税の納付時期に設定
    const startYear =
      referenceDate.getFullYear() + (property.startAge - (member.age ?? 0));
    const rawMonth = property.startMonth + 6;
    const taxYear = rawMonth > 12 ? startYear + 1 : startYear;
    const taxMonth = rawMonth > 12 ? rawMonth - 12 : rawMonth;

    const breakdown = buildAcquisitionFeeBreakdownFromProperty(
      property,
      taxYear,
      taxMonth,
      { hasPairLoan },
    );

    update({
      brokerageFeeMan: breakdown.brokerageFeeMan,
      registrationFeeMan: breakdown.registrationFeeMan,
      acquisitionTaxMan: breakdown.acquisitionTaxMan,
      acquisitionTaxYear: taxYear,
      acquisitionTaxMonth: taxMonth,
    });
    setAcqBreakdown(breakdown);
  };

  const insuranceSummary =
    linkedInsurances.length > 0
      ? `${linkedInsurances.length}件登録済み`
      : '未設定';

  const loanSummary = isCurrentlyOccupied
    ? property.paymentMethod === 'cash'
      ? '住宅ローンなし'
      : linkedLoans.length > 0
        ? `住宅ローンあり・${linkedLoans.length}件登録済み`
        : '住宅ローンあり・未登録'
    : property.paymentMethod === 'cash'
      ? '現金一括'
      : linkedLoans.length > 0
        ? `ローン ${linkedLoans.length}件`
        : 'ローン未設定';

  const insuranceSection =
    onAddInsurance && onUpdateInsurance && onRemoveInsurance && insuranceState ? (
      <HousingOwnedDetailFold
        title={`(${insuranceSectionNumber}) 保険`}
        summary={insuranceSummary}
      >
        <HousingInsuranceLinks
          propertyName={property.name}
          insurances={linkedInsurances}
          members={members}
          insuranceState={insuranceState}
          housingState={housingState}
          vehicleState={vehicleState}
          referenceDate={referenceDate}
          onAddInsurance={onAddInsurance}
          onUpdateInsurance={onUpdateInsurance}
          onRemoveInsurance={onRemoveInsurance}
        />
      </HousingOwnedDetailFold>
    ) : null;

  const targetSection = !isSimpleMode ? (
    <OwnedPropertyTargetSection
      property={property}
      member={member}
      members={members}
      referenceDate={referenceDate}
      sectionNumber={targetSectionNumber}
      onChange={onChange}
    />
  ) : null;

  const acquisitionSection =
    showAcquisitionSection && acquisitionSectionNumber !== null ? (
      <OwnedPropertyAcquisitionSection
        sectionNumber={acquisitionSectionNumber}
        property={property}
        acquisitionTotal={acquisitionTotal}
        showBuildingField={showBuildingField}
        isCurrentlyOccupied={isCurrentlyOccupied}
        canFetchAcquisitionFees={canFetchAcquisitionFees}
        breakdown={acqBreakdown}
        onChange={update}
        onFetchReference={handleFetchAcquisitionFees}
        onOpenReference={setAcqRefSection}
        onOpenTaxDetail={() => setAcqDetailOpen(true)}
      />
    ) : null;

  const paymentSection = !isSimpleMode ? (
    <HousingOwnedDetailFold
      title={`(${paymentSectionNumber}) ${isCurrentlyOccupied ? '住宅ローン' : '支払い方法'}`}
      summary={loanSummary}
    >
      <div
        className="housing-owned-payment-options"
        role="radiogroup"
        aria-label={isCurrentlyOccupied ? '住宅ローンの有無' : '支払い方法'}
      >
        {PAYMENT_METHODS.map((method) => (
          <label key={method} className="housing-owned-payment-option">
            <input
              type="radio"
              name={`owned-payment-${property.id}`}
              checked={property.paymentMethod === method}
              onChange={() => update({ paymentMethod: method })}
            />
            <span>
              {isCurrentlyOccupied
                ? OWNED_PROPERTY_CURRENT_LOAN_STATUS_LABELS[method]
                : OWNED_PROPERTY_LOAN_PAYMENT_LABELS[method]}
            </span>
          </label>
        ))}
      </div>

      {property.paymentMethod === 'loan' && onUpdateLoan ? (
        <>
          {isCurrentlyOccupied ? (
            <p className="housing-owned-loan-existing-note">
              居住中の住宅ローンは、取得価格ではなく「月々の返済額」または「現在残高」から入力します。
            </p>
          ) : null}
          <HousingLoanLinks
            propertyName={property.name}
            loans={linkedLoans}
            contractorMembers={contractorMembers}
            hasSpouse={hasSpouse}
            members={members}
            loanState={loanState}
            housingState={housingState}
            vehicleState={vehicleState}
            referenceDate={referenceDate}
            preferMonthlyRepayment={isCurrentlyOccupied}
            addLoanEnabled={
              canAddLoan && (isCurrentlyOccupied || hasAcquisitionAmount)
            }
            onAddLoan={onAddLoan}
            onUpdateLoan={onUpdateLoan}
            onUpdatePairPartnerLoan={onUpdatePairPartnerLoan}
            onPairShareChange={onPairShareChange}
            onJointDebtShareChange={onJointDebtShareChange}
            onPropertyFeeChange={onLoanPropertyFeeChange}
            onRemoveLoan={onRemoveLoan}
          />
        </>
      ) : null}
    </HousingOwnedDetailFold>
  ) : null;

  return (
    <div className="housing-owned-detail">
      {isCurrentlyOccupied ? (
        <div className="housing-owned-detail-section">
          <div
            className="ui-workspace-tabs"
            role="group"
            aria-label="住居費の入力方法"
          >
            {CURRENT_EXPENSE_MODES.map((mode) => {
              const active = property.currentExpenseMode === mode;
              const blocked =
                mode === 'simple' && hasRegisteredPairLoan && !isSimpleMode;
              return (
                <button
                  key={mode}
                  type="button"
                  className={`ui-workspace-tab${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  disabled={blocked}
                  onClick={() => handleCurrentExpenseModeChange(mode)}
                >
                  {OWNED_PROPERTY_CURRENT_EXPENSE_MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
          {hasRegisteredPairLoan ? (
            <p className="housing-owned-loan-existing-note" role="alert">
              {isSimpleMode
                ? 'ペアローンが登録されています。ペアローンを計算するには「内訳を詳しく入力」へ切り替えてください。まとめ入力へ戻す場合は、住宅ローンからペアローンを削除してください。'
                : 'ペアローンが登録されているため、「住居費をまとめて入力」には切り替えられません。まとめて入力する場合は、住宅ローンからペアローンを削除してください。'}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="housing-owned-detail-section">
        <h4 className="housing-owned-detail-title">(1) 所有期間</h4>
        <div className="housing-owned-period">
          <div className="living-schedule-inputs">
            <div className="living-schedule-side">
              <div className="living-schedule-fields">
                {isSimpleMode ? (
                  <>
                    <select
                      className="select-input select-input--compact select-input--schedule"
                      value={property.startAge}
                      disabled
                      aria-label="所有開始年齢（基準月）"
                    >
                      <option value={property.startAge}>
                        {property.startAge}才
                      </option>
                    </select>
                    <select
                      className="select-input select-input--compact select-input--schedule"
                      value={property.startMonth}
                      disabled
                      aria-label="所有開始月（基準月）"
                    >
                      <option value={property.startMonth}>
                        {property.startMonth}月
                      </option>
                    </select>
                  </>
                ) : (
                  <>
                    <select
                      className="select-input select-input--compact select-input--schedule"
                      value={property.startAge}
                      onChange={(e) =>
                        update({ startAge: Number(e.target.value) })
                      }
                    >
                      {startAgeOptions.map((age) => (
                        <option key={age} value={age}>
                          {age}才
                        </option>
                      ))}
                    </select>
                    <select
                      className="select-input select-input--compact select-input--schedule"
                      value={property.startMonth}
                      onChange={(e) =>
                        update({ startMonth: Number(e.target.value) })
                      }
                    >
                      {startMonthOptions.map((month) => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <p className="period-start-label">
                {formatYearAtAgeLabel(
                  property.startAge,
                  property.startMonth,
                  birthYear,
                  member.birthMonth,
                )}
                {isSimpleMode ? '（基準月）' : ''}
              </p>
            </div>

            <span className="living-schedule-arrow" aria-hidden>
              →
            </span>

            <div className="living-schedule-side">
              <div className="living-schedule-fields">
                {property.endMode === 'lifetime' ? (
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value="lifetime"
                    onChange={(e) => {
                      if (e.target.value !== 'lifetime') {
                        update({
                          endMode: 'until',
                          endAge: Math.max(
                            property.startAge + 1,
                            Number(e.target.value),
                          ),
                        });
                      }
                    }}
                  >
                    <option value="lifetime">生涯</option>
                    {END_AGES.filter((age) => age > property.startAge).map(
                      (age) => (
                        <option key={age} value={age}>
                          {age}才
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <>
                    <select
                      className="select-input select-input--compact select-input--schedule"
                      value={property.endAge}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'lifetime') {
                          update({ endMode: 'lifetime' });
                        } else {
                          update({ endAge: Number(value) });
                        }
                      }}
                    >
                      <option value="lifetime">生涯</option>
                      {END_AGES.filter((age) => age > property.startAge).map(
                        (age) => (
                          <option key={age} value={age}>
                            {age}才
                          </option>
                        ),
                      )}
                    </select>
                    <select
                      className="select-input select-input--compact select-input--schedule"
                      value={property.endMonth}
                      onChange={(e) =>
                        update({ endMonth: Number(e.target.value) })
                      }
                    >
                      {MONTHS.map((month) => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              {property.endMode === 'until' ? (
                <p className="period-end-label">
                  {formatEndYearLabel(
                    property.endAge,
                    property.endMonth,
                    birthYear,
                    member.birthMonth,
                  )}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {isSimpleMode ? (
        <section className="housing-owned-detail-section">
          <h4 className="housing-owned-detail-title">
            ({simpleExpenseSectionNumber}) 月々の住居費
          </h4>
          <div className="housing-owned-simple-expense">
            <HousingManInput
              compact
              value={property.simpleMonthlyExpenseMan}
              onChange={(simpleMonthlyExpenseMan) =>
                update({ simpleMonthlyExpenseMan })
              }
            />
          </div>
          <p className="housing-owned-simple-expense-note">
            住宅ローン返済・管理費・修繕積立金・固定資産税などを含む毎月の住居費をまとめて入力します。住宅ローン控除などの税制優遇は試算に反映されません。
          </p>
        </section>
      ) : null}

      {isSimpleMode ? insuranceSection : null}

      {!isSimpleMode ? (
        <>
          {isCurrentlyOccupied ? (
            <>
              {paymentSection}
              {targetSection}
            </>
          ) : (
            <>
              {targetSection}
              {acquisitionSection}
              {paymentSection}
            </>
          )}

          {showAcquisitionSection ? (
            <>
              <AcquisitionReferenceModal
                open={acqRefSection !== null}
                section={acqRefSection ?? 'brokerage'}
                breakdown={acqBreakdown}
                onClose={() => setAcqRefSection(null)}
              />

              <AcquisitionTaxDetailModal
                open={acqDetailOpen}
                property={property}
                referenceYear={referenceDate.getFullYear()}
                onClose={() => setAcqDetailOpen(false)}
                onConfirm={(patch) => {
                  update(patch);
                  if (acqBreakdown) {
                    const nextProperty = { ...property, ...patch };
                    const breakdown = buildAcquisitionFeeBreakdownFromProperty(
                      nextProperty,
                      patch.acquisitionTaxYear,
                      patch.acquisitionTaxMonth,
                      { hasPairLoan },
                    );
                    setAcqBreakdown(breakdown);
                  }
                }}
              />
            </>
          ) : null}

          {insuranceSection}

          <HousingOwnedDetailFold
            title={`(${maintenanceSectionNumber}) 保守設定`}
            summary="管理費・修繕・固定資産税など"
          >
            <OwnedPropertyMaintenanceSection
              property={property}
              member={member}
              referenceDate={referenceDate}
              onChange={onChange}
            />
          </HousingOwnedDetailFold>
        </>
      ) : null}
    </div>
  );
}
