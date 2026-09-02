import type { ReactNode } from 'react';
import { HOUSING_LOAN_DEDUCTION_CATEGORY_LABELS } from '../../lib/housingLoanDeduction';
import { getOwnershipStartCalendar } from '../../lib/housingLoanAmortization';
import {
  calcHousingLoanFeeBreakdown,
  calcHousingLoanBaseBorrowingMan,
  formatHousingLoanAmountBreakdownDetail,
  roundLoanAmountMan,
} from '../../lib/housingLoanAmount';
import {
  formatLoanInterestRateSummary,
  LOAN_REPAYMENT_COUNT_OPTIONS,
  formatLoanRepaymentCountLabel,
  resolveLoanRepaymentCount,
  yearsFromRepaymentCount,
} from '../../lib/loanInterestRatePeriod';
import type {
  HousingLoanDeductionCategory,
  OwnedProperty,
  OwnedPropertyLoanSettings,
} from '../../types/housing';
import type { LoanEntry, LoanStructureType } from '../../types/loan';
import type { VehicleEntry } from '../../types/vehicle';
import {
  formatLoanMonthlyRepaymentSummary,
  isLoanMonthlyRepaymentMode,
} from '../../lib/loanPaymentMode';
import { HousingManInput } from '../housing/HousingManInput';
import { HousingRenewalDateFields } from '../housing/HousingRenewalDateFields';
import {
  HousingLoanGroupCreditLifeEditor,
  type GroupCreditLifePairSide,
} from './HousingLoanGroupCreditLifeEditor';
import { LoanInterestRatePeriodsEditor } from './LoanInterestRatePeriodsEditor';
import { HousingLoanBankFeesEditor } from './HousingLoanBankFeesEditor';

interface LoanSettingsFieldsProps {
  settings: OwnedPropertyLoanSettings;
  onChange: (settings: OwnedPropertyLoanSettings) => void;
  fieldIdPrefix: string;
  referenceDate: Date;
  showHousingFields?: boolean;
  linkedAcquisitionAmountMan?: number;
  hideAmountField?: boolean;
  hideBankFees?: boolean;
  linkedHousingProperty?: OwnedProperty;
  linkedVehicle?: VehicleEntry;
  memberAgeAtReference?: number;
  memberBirthMonth?: number | null;
  structureType?: LoanStructureType;
  groupCreditLifePairSides?: GroupCreditLifePairSide[];
  pairSharePct?: number;
}

const DEDUCTION_CATEGORIES: HousingLoanDeductionCategory[] = [
  'certified_long_term',
  'zeh',
  'energy_standard',
  'general',
  'none',
];

export function LoanSettingsField({
  label,
  labelFor,
  help,
  children,
  cellClassName = '',
  labelClassName = '',
}: {
  label: ReactNode;
  labelFor?: string;
  /** ラベル横の ? にホバーで表示する説明 */
  help?: string;
  children: ReactNode;
  cellClassName?: string;
  labelClassName?: string;
}) {
  return (
    <div className="loan-settings-form-row">
      <div
        className={`housing-table-header-cell loan-settings-form-label ${labelClassName}`.trim()}
      >
        {labelFor ? <label htmlFor={labelFor}>{label}</label> : label}
        {help ? (
          <span className="field-help-icon" title={help} aria-label={help}>
            ?
          </span>
        ) : null}
      </div>
      <div className={`housing-table-cell loan-settings-form-value ${cellClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
}

export function resolveAcquisitionStartCalendar(
  linkedHousingProperty: OwnedProperty,
  memberAgeAtReference: number,
  referenceYear: number,
  birthMonth?: number | null,
  referenceMonth = 1,
): { year: number; month: number } {
  return getOwnershipStartCalendar(
    linkedHousingProperty,
    memberAgeAtReference,
    referenceYear,
    birthMonth,
    referenceMonth,
  );
}

export function resolveVehiclePurchaseStartCalendar(
  linkedVehicle: VehicleEntry,
  memberAgeAtReference: number,
  referenceYear: number,
  birthMonth?: number | null,
  referenceMonth = 1,
): { year: number; month: number } {
  return getOwnershipStartCalendar(
    {
      startAge: linkedVehicle.startAge,
      startMonth: linkedVehicle.startMonth,
    },
    memberAgeAtReference,
    referenceYear,
    birthMonth,
    referenceMonth,
  );
}

export function isLoanAcquisitionTiming(
  settings: OwnedPropertyLoanSettings,
  linkedAsset?: OwnedProperty | VehicleEntry | null,
): boolean {
  return (
    linkedAsset != null &&
    settings.startYear <= 0 &&
    settings.startMonth <= 0
  );
}

function resolveLoanStartYearMonth(
  settings: OwnedPropertyLoanSettings,
  referenceDate: Date,
  linkedHousingProperty?: OwnedProperty,
  linkedVehicle?: VehicleEntry,
  memberAgeAtReference?: number,
  memberBirthMonth?: number | null,
): { year: number; month: number } {
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;

  if (settings.startYear > 0 && settings.startMonth > 0) {
    return { year: settings.startYear, month: settings.startMonth };
  }

  if (linkedHousingProperty && memberAgeAtReference != null) {
    return resolveAcquisitionStartCalendar(
      linkedHousingProperty,
      memberAgeAtReference,
      referenceYear,
      memberBirthMonth,
      referenceMonth,
    );
  }

  if (linkedVehicle && memberAgeAtReference != null) {
    return resolveVehiclePurchaseStartCalendar(
      linkedVehicle,
      memberAgeAtReference,
      referenceYear,
      memberBirthMonth,
      referenceMonth,
    );
  }

  return {
    year: settings.startYear > 0 ? settings.startYear : referenceYear,
    month: settings.startMonth > 0 ? settings.startMonth : referenceMonth,
  };
}

function formatAcquisitionTimingLabel(year: number, month: number): string {
  return `物件取得時（${year}年${month}月）`;
}

function formatVehiclePurchaseTimingLabel(year: number, month: number): string {
  return `購入時（${year}年${month}月）`;
}

export function LoanSettingsFields({
  settings,
  onChange,
  fieldIdPrefix,
  referenceDate,
  showHousingFields = true,
  linkedAcquisitionAmountMan,
  hideAmountField = false,
  hideBankFees = false,
  linkedHousingProperty,
  linkedVehicle,
  memberAgeAtReference,
  memberBirthMonth,
  structureType,
  groupCreditLifePairSides,
  pairSharePct,
}: LoanSettingsFieldsProps) {
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const linkedAsset = linkedHousingProperty ?? linkedVehicle ?? null;
  const acquisitionTiming = isLoanAcquisitionTiming(settings, linkedAsset);
  const acquisitionStart =
    linkedHousingProperty && memberAgeAtReference != null
      ? resolveAcquisitionStartCalendar(
          linkedHousingProperty,
          memberAgeAtReference,
          referenceYear,
          memberBirthMonth,
          referenceMonth,
        )
      : linkedVehicle && memberAgeAtReference != null
        ? resolveVehiclePurchaseStartCalendar(
            linkedVehicle,
            memberAgeAtReference,
            referenceYear,
            memberBirthMonth,
            referenceMonth,
          )
        : null;
  const customStart = resolveLoanStartYearMonth(
    settings,
    referenceDate,
    linkedHousingProperty,
    linkedVehicle,
    memberAgeAtReference,
    memberBirthMonth,
  );
  const housingLoanBreakdown =
    hideAmountField && linkedHousingProperty
      ? calcHousingLoanFeeBreakdown(linkedHousingProperty, settings, {
          pairSharePct,
        })
      : null;
  const bankFeeReferenceLoanAmountMan = calcHousingLoanBaseBorrowingMan(
    linkedHousingProperty,
    settings,
    pairSharePct != null ? { pairSharePct } : undefined,
  );
  const acquisitionOptionLabel = linkedHousingProperty
    ? formatAcquisitionTimingLabel(
        acquisitionStart?.year ?? referenceYear,
        acquisitionStart?.month ?? 1,
      )
    : formatVehiclePurchaseTimingLabel(
        acquisitionStart?.year ?? referenceYear,
        acquisitionStart?.month ?? 1,
      );

  const update = (patch: Partial<OwnedPropertyLoanSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const handleTimingModeChange = (mode: 'acquisition' | 'custom') => {
    if (mode === 'acquisition') {
      update({ startYear: 0, startMonth: 0 });
      return;
    }
    update({
      startYear: customStart.year,
      startMonth: customStart.month,
    });
  };

  const timingInput = acquisitionStart ? (
    <>
      <select
        id={`${fieldIdPrefix}-timing`}
        className="select-input select-input--compact loan-settings-timing-select"
        value={acquisitionTiming ? 'acquisition' : 'custom'}
        onChange={(e) =>
          handleTimingModeChange(e.target.value as 'acquisition' | 'custom')
        }
      >
        <option value="acquisition">{acquisitionOptionLabel}</option>
        <option value="custom">日付を指定</option>
      </select>
      {!acquisitionTiming && (
        <HousingRenewalDateFields
          year={customStart.year}
          month={customStart.month}
          referenceYear={referenceYear}
          minYear={acquisitionStart.year}
          onChange={(startYear, startMonth) => update({ startYear, startMonth })}
        />
      )}
    </>
  ) : (
    <HousingRenewalDateFields
      year={customStart.year}
      month={customStart.month}
      referenceYear={referenceYear}
      minYear={referenceYear - 40}
      onChange={(startYear, startMonth) => update({ startYear, startMonth })}
    />
  );

  return (
    <div className="housing-rental-card loan-settings-table-card">
      <div className="loan-settings-form-table">
        <LoanSettingsField
          label="借入額"
          cellClassName="loan-settings-form-value--loan-amount"
        >
          {!hideAmountField ? (
            <HousingManInput
              compact
              value={settings.amountMan}
              step={1}
              onChange={(amountMan) =>
                update({ amountMan: roundLoanAmountMan(amountMan) })
              }
            />
          ) : (
            <div className="loan-amount-linked loan-amount-linked--table">
              <span className="loan-amount-linked-value">
                {linkedAcquisitionAmountMan ?? 0}万円
              </span>
              {pairSharePct != null ? (
                <span className="loan-amount-linked-share">
                  （分担 {pairSharePct}%）
                </span>
              ) : null}
              {housingLoanBreakdown ? (
                <span className="loan-amount-linked-detail">
                  {formatHousingLoanAmountBreakdownDetail(housingLoanBreakdown)}
                </span>
              ) : linkedVehicle ? (
                <span className="loan-amount-linked-detail">
                  ※ Q6の購入費用から自動計算
                </span>
              ) : null}
            </div>
          )}
        </LoanSettingsField>

        <LoanSettingsField label="借入時期" labelFor={`${fieldIdPrefix}-timing`}>
          {timingInput}
        </LoanSettingsField>

        {showHousingFields ? (
          <LoanSettingsField label="返済期間">
            <HousingManInput
              compact
              value={settings.years}
              onChange={(years) => update({ years })}
              unit="年"
              min={1}
              step={1}
            />
          </LoanSettingsField>
        ) : (
          <LoanSettingsField
            label="返済回数"
            labelFor={`${fieldIdPrefix}-repayment-count`}
          >
            <select
              id={`${fieldIdPrefix}-repayment-count`}
              className="select-input select-input--compact"
              value={resolveLoanRepaymentCount(settings)}
              onChange={(e) => {
                const repaymentCount = Number(e.target.value);
                update({
                  repaymentCount,
                  years: yearsFromRepaymentCount(repaymentCount),
                });
              }}
            >
              {LOAN_REPAYMENT_COUNT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {formatLoanRepaymentCountLabel(count)}
                </option>
              ))}
            </select>
          </LoanSettingsField>
        )}

        <LoanSettingsField label="金利" cellClassName="loan-settings-form-value--rate-periods">
          <LoanInterestRatePeriodsEditor
            periods={settings.interestRatePeriods}
            fieldIdPrefix={fieldIdPrefix}
            referenceYear={referenceYear}
            referenceMonth={referenceDate.getMonth() + 1}
            loanYears={settings.years}
            loanStartYear={settings.startYear}
            loanStartMonth={settings.startMonth}
            linkedHousingProperty={linkedHousingProperty}
            linkedVehicle={linkedVehicle}
            memberAgeAtReference={memberAgeAtReference}
            memberBirthMonth={memberBirthMonth}
            allowAddPeriod={showHousingFields}
            onChange={(interestRatePeriods) => update({ interestRatePeriods })}
          />
        </LoanSettingsField>

        {showHousingFields && structureType ? (
          <LoanSettingsField
            label="団信"
            cellClassName="loan-settings-form-value--group-credit-life"
          >
            <HousingLoanGroupCreditLifeEditor
              structureType={structureType}
              settings={settings}
              onChange={onChange}
              fieldIdPrefix={fieldIdPrefix}
              pairSides={groupCreditLifePairSides}
            />
          </LoanSettingsField>
        ) : null}

        {showHousingFields && !hideBankFees && (
          <LoanSettingsField
            label="手数料"
            cellClassName="loan-settings-form-value--bank-fees"
          >
            <HousingLoanBankFeesEditor
              settings={settings}
              onChange={update}
              fieldIdPrefix={fieldIdPrefix}
              referenceLoanAmountMan={bankFeeReferenceLoanAmountMan}
            />
          </LoanSettingsField>
        )}

        {showHousingFields && !linkedHousingProperty && (
          <>
            <LoanSettingsField label="新築/中古">
              <div className="housing-owned-payment-options housing-owned-payment-options--compact">
                <label className="housing-owned-payment-option">
                  <input
                    type="radio"
                    name={`${fieldIdPrefix}-condition`}
                    checked={settings.isNewConstruction}
                    onChange={() => update({ isNewConstruction: true })}
                  />
                  <span>新築</span>
                </label>
                <label className="housing-owned-payment-option">
                  <input
                    type="radio"
                    name={`${fieldIdPrefix}-condition`}
                    checked={!settings.isNewConstruction}
                    onChange={() => update({ isNewConstruction: false })}
                  />
                  <span>中古</span>
                </label>
              </div>
            </LoanSettingsField>

            <LoanSettingsField label="住宅ローン控除">
              <select
                className="select-input select-input--compact loan-settings-deduction-select"
                value={settings.deductionCategory}
                onChange={(e) =>
                  update({
                    deductionCategory: e.target
                      .value as HousingLoanDeductionCategory,
                  })
                }
              >
                {DEDUCTION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {HOUSING_LOAN_DEDUCTION_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </LoanSettingsField>
          </>
        )}
      </div>
    </div>
  );
}

export function formatLoanSettingsSummary(
  settings: OwnedPropertyLoanSettings,
  configured = true,
): string {
  if (!configured) {
    return '未登録';
  }
  if (settings.amountMan <= 0) {
    return '借入金額未入力';
  }
  const termLabel =
    settings.repaymentCount != null && settings.repaymentCount > 0
      ? formatLoanRepaymentCountLabel(settings.repaymentCount)
      : `${settings.years}年`;
  return `${roundLoanAmountMan(settings.amountMan)}万円 / ${formatLoanInterestRateSummary(settings)} / ${termLabel}`;
}

export function formatLoanEntrySummary(
  entry: LoanEntry,
  referenceDate: Date,
): string {
  const configured = entry.settingsConfigured ?? false;
  if (isLoanMonthlyRepaymentMode(entry)) {
    return formatLoanMonthlyRepaymentSummary(entry, referenceDate, configured);
  }
  return formatLoanSettingsSummary(entry.settings, configured);
}
