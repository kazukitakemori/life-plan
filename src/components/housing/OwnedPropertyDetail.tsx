import { useEffect, useState } from 'react';
import {
  calcBirthYear,
  formatEndYearLabel,
  formatYearAtAgeLabel,
} from '../../lib/birthDate';
import { formatOwnedAcquisitionTotalMan } from '../../lib/housingOwnedAmount';
import {
  OWNED_PROPERTY_CURRENT_EXPENSE_MODE_LABELS,
  OWNED_PROPERTY_LOAN_PAYMENT_LABELS,
} from '../../lib/housingLabels';
import { getLivingAgeOptions } from '../../lib/livingDefaults';
import type { FamilyMember } from '../../types/family';
import type {
  OwnedProperty,
  OwnedPropertyCurrentExpenseMode,
  OwnedPropertyLoanPaymentType,
} from '../../types/housing';
import type { HousingLinkedLoanView, LoanEntry, LoanState, LoanStructureType } from '../../types/loan';
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
  'analysis',
  'simple',
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
  const isSimpleMode = isCurrentlyOccupied && property.currentExpenseMode === 'simple';
  // ローン分析時は借入額の元になる取得価格・諸費用が必要なため、居住中でも表示する
  const showAcquisitionSection = !isSimpleMode;
  const hasAcquisitionAmount =
    property.buildingMan + property.landMan > 0;
  const simpleExpenseSectionNumber = 2;
  const targetSectionNumber = 2;
  const acquisitionSectionNumber = showAcquisitionSection ? 3 : null;
  const paymentSectionNumber = showAcquisitionSection ? 4 : 3;
  const insuranceSectionNumber = isSimpleMode
    ? 3
    : showAcquisitionSection
      ? 5
      : 4;
  const maintenanceSectionNumber = showAcquisitionSection ? 6 : 5;
  const [acqRefSection, setAcqRefSection] = useState<AcquisitionReferenceSection | null>(null);
  const [acqDetailOpen, setAcqDetailOpen] = useState(false);
  const [acqBreakdown, setAcqBreakdown] = useState<AcquisitionFeeBreakdown | null>(null);
  const canFetchAcquisitionFees = property.buildingMan + property.landMan > 0;
  const hasPairLoan =
    linkedLoans.filter((loan) => isPairLoanEntry(loan.entry)).length >= 2;

  const update = (patch: Partial<OwnedProperty>) => {
    onChange({ ...property, ...patch });
  };

  // 居住中は過去の支出を試算しないため、現金一括の選択肢を持たせない
  useEffect(() => {
    if (isCurrentlyOccupied && property.paymentMethod === 'cash') {
      update({ paymentMethod: 'loan' });
    }
  }, [isCurrentlyOccupied, property.paymentMethod]);

  // 簡単入力（ローン分析なし）に切り替えたら、紐づくローンは解除する
  useEffect(() => {
    if (isSimpleMode && linkedLoans.length > 0) {
      linkedLoans.forEach((loan) => onRemoveLoan(loan.entry.id));
    }
  }, [isSimpleMode, linkedLoans]);

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

  const insuranceSection =
    onAddInsurance && onUpdateInsurance && onRemoveInsurance && insuranceState ? (
      <section className="housing-owned-detail-section">
        <h4 className="housing-owned-detail-title">
          ({insuranceSectionNumber}) 保険
        </h4>
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
      </section>
    ) : null;

  return (
    <div className="housing-owned-detail">
      {isCurrentlyOccupied && (
        <div
          className="housing-owned-expense-mode"
          role="radiogroup"
          aria-label="ローン分析"
        >
          {CURRENT_EXPENSE_MODES.map((mode) => (
            <label key={mode} className="housing-owned-expense-mode-option">
              <input
                type="radio"
                name={`owned-expense-mode-${property.id}`}
                checked={property.currentExpenseMode === mode}
                onChange={() => update({ currentExpenseMode: mode })}
              />
              <span>{OWNED_PROPERTY_CURRENT_EXPENSE_MODE_LABELS[mode]}</span>
            </label>
          ))}
        </div>
      )}

      <section className="housing-owned-detail-section">
        <h4 className="housing-owned-detail-title">(1) 所有期間</h4>
        <div className="housing-owned-period">
          <div className="living-schedule-inputs">
            <div className="living-schedule-side">
              <div className="living-schedule-fields">
                <select
                  className="select-input select-input--compact select-input--schedule"
                  value={property.startAge}
                  onChange={(e) =>
                    update({ startAge: Number(e.target.value) })
                  }
                >
                  {ageOptions.map((age) => (
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
                  {MONTHS.map((month) => (
                    <option key={month} value={month}>
                      {month}月
                    </option>
                  ))}
                </select>
              </div>
              <p className="period-start-label">
                {formatYearAtAgeLabel(
                  property.startAge,
                  property.startMonth,
                  birthYear,
                  member.birthMonth,
                )}
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
                <span
                  className="housing-help-icon"
                  title="所有期間の終了は、売却や用途変更の予定がある場合に設定します"
                >
                  ?
                </span>
              </div>
              {property.endMode === 'until' && (
                <p className="period-end-label">
                  {formatEndYearLabel(
                    property.endAge,
                    property.endMonth,
                    birthYear,
                    member.birthMonth,
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {isSimpleMode && (
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
            ローン返済・管理費・修繕積立金・税金等をまとめてご入力ください。住宅ローン控除などの税制優遇は試算に反映されません。
          </p>
        </section>
      )}

      {isSimpleMode ? insuranceSection : null}

      {!isSimpleMode && (
        <>
      <OwnedPropertyTargetSection
        property={property}
        member={member}
        members={members}
        referenceDate={referenceDate}
        sectionNumber={targetSectionNumber}
        onChange={onChange}
      />

      {showAcquisitionSection && (
      <section className="housing-owned-detail-section">
        <h4 className="housing-owned-detail-title">({acquisitionSectionNumber}) 取得価格</h4>
        <div className="housing-owned-acquisition-total">
          <span className="housing-owned-acquisition-total-label">取得価格</span>
          <strong className="housing-owned-acquisition-total-amount">
            {acquisitionTotal}
          </strong>
          <span className="housing-owned-acquisition-note">
            ※ 建物 + 土地 + 仲介手数料から自動計算
          </span>
        </div>
        {isCurrentlyOccupied && (
          <p className="housing-owned-loan-existing-note">
            居住中でも、当時の取得価格・諸費用を入力してください。ローン借入額はこれらと「諸費用のローン組み込み」から計算します。過去の購入時現金支出はキャッシュフローには含めません。
          </p>
        )}

        <div className="housing-rental-card">
          <div
            className={[
              'housing-rental-table',
              'housing-rental-table--owned-acquisition',
              showBuildingField ? '' : 'housing-rental-table--owned-acquisition-land',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="housing-rental-table-header">
              {showBuildingField && (
                <div className="housing-table-header-cell housing-col-amount">
                  建物
                </div>
              )}
              <div className="housing-table-header-cell housing-col-amount">土地</div>
              <div className="housing-table-header-cell housing-col-amount housing-col-fetch">
                費用取得
              </div>
              <div className="housing-table-header-cell housing-col-amount">
                仲介手数料
              </div>
              <div className="housing-table-header-cell housing-col-amount">
                登記手数料
              </div>
              <div className="housing-table-header-cell housing-col-amount">
                不動産取得税
              </div>
            </div>

            <div className="housing-rental-table-body">
              <div className="housing-rental-table-row">
                {showBuildingField && (
                  <div className="housing-table-cell housing-col-amount">
                    <HousingManInput
                      compact
                      value={property.buildingMan}
                      onChange={(buildingMan) => update({ buildingMan })}
                    />
                  </div>
                )}
                <div className="housing-table-cell housing-col-amount">
                  <HousingManInput
                    compact
                    value={property.landMan}
                    onChange={(landMan) => update({ landMan })}
                  />
                </div>
                <div className="housing-table-cell housing-col-amount housing-col-fetch">
                  <div className="housing-fetch-field">
                    <button
                      type="button"
                      className="education-fetch-btn"
                      disabled={!canFetchAcquisitionFees}
                      onClick={handleFetchAcquisitionFees}
                    >
                      参考
                    </button>
                  </div>
                </div>
                <div className="housing-table-cell housing-col-amount housing-table-cell--stacked">
                  <HousingManInput
                    compact
                    value={property.brokerageFeeMan}
                    onChange={(brokerageFeeMan) => update({ brokerageFeeMan })}
                  />
                  {acqBreakdown && (
                    <button
                      type="button"
                      className="education-fetch-detail-link"
                      onClick={() => setAcqRefSection('brokerage')}
                    >
                      詳細
                    </button>
                  )}
                </div>
                <div className="housing-table-cell housing-col-amount housing-table-cell--stacked">
                  <HousingManInput
                    compact
                    value={property.registrationFeeMan}
                    onChange={(registrationFeeMan) =>
                      update({ registrationFeeMan })
                    }
                  />
                  {acqBreakdown && (
                    <button
                      type="button"
                      className="education-fetch-detail-link"
                      onClick={() => setAcqRefSection('registration')}
                    >
                      詳細
                    </button>
                  )}
                </div>
                <div className="housing-table-cell housing-col-amount housing-table-cell--stacked">
                  <HousingManInput
                    compact
                    value={property.acquisitionTaxMan}
                    onChange={(acquisitionTaxMan) =>
                      update({ acquisitionTaxMan })
                    }
                  />
                  <button
                    type="button"
                    className="education-fetch-detail-link"
                    disabled={!canFetchAcquisitionFees}
                    onClick={() => setAcqDetailOpen(true)}
                  >
                    詳細計算
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

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

      <section className="housing-owned-detail-section">
        <h4 className="housing-owned-detail-title">
          ({paymentSectionNumber}) {isCurrentlyOccupied ? 'ローン' : '支払い方法'}
        </h4>

        {!isCurrentlyOccupied && (
          <div className="housing-owned-payment-options" role="radiogroup" aria-label="支払い方法">
            {PAYMENT_METHODS.map((method) => (
              <label key={method} className="housing-owned-payment-option">
                <input
                  type="radio"
                  name={`owned-payment-${property.id}`}
                  checked={property.paymentMethod === method}
                  onChange={() => update({ paymentMethod: method })}
                />
                <span>{OWNED_PROPERTY_LOAN_PAYMENT_LABELS[method]}</span>
              </label>
            ))}
          </div>
        )}

        {property.paymentMethod === 'loan' && onUpdateLoan ? (
          <>
            {isCurrentlyOccupied && (
              <p className="housing-owned-loan-existing-note">
                契約済みローンの条件（金利・返済年数・開始年月）と、諸費用のローン組み込みを設定してください。
              </p>
            )}
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
              addLoanEnabled={hasAcquisitionAmount}
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
      </section>

      {insuranceSection}

      <section className="housing-owned-detail-section">
        <h4 className="housing-owned-detail-title">({maintenanceSectionNumber}) 保守設定</h4>
        <OwnedPropertyMaintenanceSection
          property={property}
          member={member}
          referenceDate={referenceDate}
          onChange={onChange}
        />
      </section>
        </>
      )}
    </div>
  );
}
