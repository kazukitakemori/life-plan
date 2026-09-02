import { HOUSING_LOAN_PREPAYMENT_TYPE_LABELS, HOUSING_LOAN_REPAYMENT_METHOD_LABELS } from '../../lib/loanLabels';
import { getMemberAgeMonth } from '../../lib/birthDate';
import { formatOwnedPeriodOffsetLabel } from '../../lib/housingLabels';
import {
  calcHousingLoanBalanceAtRepaymentOffsetMan,
} from '../../lib/housingLoanAmount';
import {
  createHousingLoanPrepaymentEntry,
  formatPrepaymentExecutionTimingLabel,
  resolvePrepaymentExecutionCalendar,
} from '../../lib/loanInterestRatePeriod';
import type { FamilyMember } from '../../types/family';
import type {
  HousingLoanPrepaymentType,
  HousingLoanRepaymentMethod,
  OwnedProperty,
  OwnedPropertyLoanSettings,
} from '../../types/housing';
import type { VehicleEntry } from '../../types/vehicle';
import { HousingManInput } from '../housing/HousingManInput';
import { HousingLoanPrepaymentsEditor } from './HousingLoanPrepaymentsEditor';
import { LoanSettingsField } from './LoanSettingsFields';

interface HousingLoanRepaymentMethodEditorProps {
  settings: OwnedPropertyLoanSettings;
  onChange: (settings: OwnedPropertyLoanSettings) => void;
  fieldIdPrefix: string;
  referenceDate: Date;
  member?: FamilyMember;
  linkedHousingProperty?: OwnedProperty;
  linkedVehicle?: VehicleEntry;
  pairSharePct?: number;
  /** false のとき元金均等を出さず元利均等のみ（非住宅ローン向け） */
  allowEqualPrincipal?: boolean;
}

const REPAYMENT_METHODS: HousingLoanRepaymentMethod[] = [
  'equal_payment',
  'equal_principal',
];

const PREPAYMENT_TYPES: HousingLoanPrepaymentType[] = [
  'period_shortening',
  'payment_reduction',
];

function FeatureToggleSelect({
  id,
  enabled,
  onChange,
}: {
  id: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <select
      id={id}
      className="select-input select-input--compact loan-settings-feature-select"
      value={enabled ? 'enabled' : 'disabled'}
      onChange={(e) => onChange(e.target.value === 'enabled')}
    >
      <option value="disabled">利用しない</option>
      <option value="enabled">利用する</option>
    </select>
  );
}

function PrepaymentTypeRadios({
  fieldIdPrefix,
  nameSuffix,
  value,
  onChange,
}: {
  fieldIdPrefix: string;
  nameSuffix: string;
  value: HousingLoanPrepaymentType;
  onChange: (type: HousingLoanPrepaymentType) => void;
}) {
  return (
    <div className="housing-owned-payment-options housing-owned-payment-options--compact">
      {PREPAYMENT_TYPES.map((type) => (
        <label key={type} className="housing-owned-payment-option">
          <input
            type="radio"
            name={`${fieldIdPrefix}-${nameSuffix}-type`}
            checked={value === type}
            onChange={() => onChange(type)}
          />
          <span>{HOUSING_LOAN_PREPAYMENT_TYPE_LABELS[type]}</span>
        </label>
      ))}
    </div>
  );
}

function RepaymentExecutionTimingLine({
  fieldIdPrefix,
  idSuffix,
  offsetYears,
  offsetOptions,
  timingLabel,
  onOffsetChange,
}: {
  fieldIdPrefix: string;
  idSuffix: string;
  offsetYears: number;
  offsetOptions: number[];
  timingLabel: string;
  onOffsetChange: (offsetYears: number) => void;
}) {
  return (
    <div className="loan-prepayment-execution-line">
      <span className="loan-prepayment-execution-label">実行する時期：</span>
      <select
        id={`${fieldIdPrefix}-${idSuffix}`}
        className="select-input select-input--compact loan-prepayment-year-select"
        value={offsetYears}
        onChange={(e) => onOffsetChange(Number(e.target.value))}
      >
        {offsetOptions.map((optionOffsetYears) => (
          <option key={optionOffsetYears} value={optionOffsetYears}>
            {formatOwnedPeriodOffsetLabel(optionOffsetYears)}
          </option>
        ))}
      </select>
      <span className="loan-prepayment-timing-label">{timingLabel}</span>
    </div>
  );
}

function resolveRepaymentExecutionTimingLabel(
  settings: OwnedPropertyLoanSettings,
  offsetYears: number,
  referenceDate: Date,
  member: FamilyMember | undefined,
  linkedHousingProperty: OwnedProperty | undefined,
  linkedVehicle?: VehicleEntry,
): string {
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const calendar = resolvePrepaymentExecutionCalendar(settings, offsetYears, {
    property: linkedHousingProperty,
    vehicle: linkedVehicle,
    memberAgeAtReference: member?.age ?? undefined,
    referenceYear,
    referenceMonth,
    birthMonth: member?.birthMonth,
  });
  const age =
    member != null
      ? getMemberAgeMonth(
          member,
          referenceDate,
          calendar.year,
          calendar.month,
        )?.age ?? null
      : null;
  return formatPrepaymentExecutionTimingLabel(age, calendar.year);
}

export function HousingLoanRepaymentMethodEditor({
  settings,
  onChange,
  fieldIdPrefix,
  referenceDate,
  member,
  linkedHousingProperty,
  linkedVehicle,
  pairSharePct,
  allowEqualPrincipal = true,
}: HousingLoanRepaymentMethodEditorProps) {
  const update = (patch: Partial<OwnedPropertyLoanSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const repaymentOffsetOptions = Array.from(
    { length: Math.max(1, settings.years) },
    (_, index) => index,
  );
  const lumpSumExecutionTimingLabel = resolveRepaymentExecutionTimingLabel(
    settings,
    settings.lumpSumRepaymentOffsetYears,
    referenceDate,
    member,
    linkedHousingProperty,
    linkedVehicle,
  );
  const lumpSumBalanceMan = calcHousingLoanBalanceAtRepaymentOffsetMan(
    linkedHousingProperty,
    settings,
    settings.lumpSumRepaymentOffsetYears,
    member?.age ?? undefined,
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    {
      ...(pairSharePct != null ? { pairSharePct } : {}),
      birthMonth: member?.birthMonth,
      referenceMonth: referenceDate.getMonth() + 1,
    },
  );

  return (
    <div className="housing-rental-card loan-settings-table-card">
      <div className="loan-settings-form-table">
        <LoanSettingsField label="返済方式">
          {allowEqualPrincipal ? (
            <div className="housing-owned-payment-options housing-owned-payment-options--compact">
              {REPAYMENT_METHODS.map((method) => (
                <label key={method} className="housing-owned-payment-option">
                  <input
                    type="radio"
                    name={`${fieldIdPrefix}-repayment-method`}
                    checked={settings.repaymentMethod === method}
                    onChange={() => update({ repaymentMethod: method })}
                  />
                  <span>{HOUSING_LOAN_REPAYMENT_METHOD_LABELS[method]}</span>
                </label>
              ))}
            </div>
          ) : (
            <span>{HOUSING_LOAN_REPAYMENT_METHOD_LABELS.equal_payment}</span>
          )}
        </LoanSettingsField>

        <LoanSettingsField
          label="ボーナス返済"
          labelFor={`${fieldIdPrefix}-bonus-repayment`}
          cellClassName="loan-settings-form-value--bonus-repayment"
        >
          <div className="loan-repayment-feature-panel">
            <FeatureToggleSelect
              id={`${fieldIdPrefix}-bonus-repayment`}
              enabled={settings.bonusRepaymentEnabled}
              onChange={(bonusRepaymentEnabled) =>
                update({ bonusRepaymentEnabled })
              }
            />
            {settings.bonusRepaymentEnabled ? (
              <>
                <div className="loan-repayment-type-line">
                  <PrepaymentTypeRadios
                    fieldIdPrefix={fieldIdPrefix}
                    nameSuffix="bonus-repayment"
                    value={settings.bonusRepaymentType}
                    onChange={(bonusRepaymentType) => update({ bonusRepaymentType })}
                  />
                </div>
                <div className="loan-repayment-bonus-detail">
                  <span className="loan-repayment-bonus-detail-label">
                    ボーナス1回あたりの支払額：
                  </span>
                  <HousingManInput
                    compact
                    value={settings.bonusRepaymentAmountMan}
                    min={0}
                    step={1}
                    onChange={(bonusRepaymentAmountMan) =>
                      update({ bonusRepaymentAmountMan })
                    }
                  />
                  <span className="loan-repayment-bonus-detail-suffix">
                    （ボーナス支払月は夏・冬の年2回を想定）
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </LoanSettingsField>

        <LoanSettingsField
          label="繰上げ返済"
          labelFor={`${fieldIdPrefix}-prepayment`}
          cellClassName="loan-settings-form-value--prepayment"
        >
          <div className="loan-repayment-feature-panel">
            <FeatureToggleSelect
              id={`${fieldIdPrefix}-prepayment`}
              enabled={settings.prepaymentEnabled}
              onChange={(prepaymentEnabled) => {
                if (prepaymentEnabled && settings.prepayments.length === 0) {
                  update({
                    prepaymentEnabled,
                    prepayments: [
                      createHousingLoanPrepaymentEntry(settings.years),
                    ],
                  });
                  return;
                }
                update({ prepaymentEnabled });
              }}
            />
            {settings.prepaymentEnabled ? (
              <HousingLoanPrepaymentsEditor
                settings={settings}
                prepayments={settings.prepayments}
                fieldIdPrefix={fieldIdPrefix}
                referenceDate={referenceDate}
                member={member}
                linkedHousingProperty={linkedHousingProperty}
                onChange={(prepayments) => update({ prepayments })}
              />
            ) : null}
          </div>
        </LoanSettingsField>

        <LoanSettingsField
          label="一括返済"
          labelFor={`${fieldIdPrefix}-lump-sum-repayment`}
          cellClassName="loan-settings-form-value--lump-sum-repayment"
        >
          <div className="loan-repayment-feature-panel">
            <FeatureToggleSelect
              id={`${fieldIdPrefix}-lump-sum-repayment`}
              enabled={settings.lumpSumRepaymentEnabled}
              onChange={(lumpSumRepaymentEnabled) =>
                update({ lumpSumRepaymentEnabled })
              }
            />
            {settings.lumpSumRepaymentEnabled ? (
              <>
                <RepaymentExecutionTimingLine
                  fieldIdPrefix={fieldIdPrefix}
                  idSuffix="lump-sum-offset"
                  offsetYears={settings.lumpSumRepaymentOffsetYears}
                  offsetOptions={repaymentOffsetOptions}
                  timingLabel={lumpSumExecutionTimingLabel}
                  onOffsetChange={(lumpSumRepaymentOffsetYears) =>
                    update({ lumpSumRepaymentOffsetYears })
                  }
                />
                <div className="loan-prepayment-execution-line">
                  <span className="loan-prepayment-execution-label">一括返済額：</span>
                  <span className="loan-lump-sum-balance-value">
                    すべての残債（{lumpSumBalanceMan}万円）
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </LoanSettingsField>
      </div>
    </div>
  );
}
