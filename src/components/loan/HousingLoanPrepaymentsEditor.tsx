import { HOUSING_LOAN_PREPAYMENT_TYPE_LABELS } from '../../lib/loanLabels';
import { getMemberAgeMonth } from '../../lib/birthDate';
import { formatOwnedPeriodOffsetLabel } from '../../lib/housingLabels';
import {
  createHousingLoanPrepaymentEntry,
  formatPrepaymentExecutionTimingLabel,
  resolvePrepaymentExecutionCalendar,
} from '../../lib/loanInterestRatePeriod';
import type { FamilyMember } from '../../types/family';
import type {
  HousingLoanPrepaymentEntry,
  HousingLoanPrepaymentType,
  OwnedProperty,
  OwnedPropertyLoanSettings,
} from '../../types/housing';
import { HousingManInput } from '../housing/HousingManInput';

const PREPAYMENT_TYPES: HousingLoanPrepaymentType[] = [
  'period_shortening',
  'payment_reduction',
];

interface HousingLoanPrepaymentsEditorProps {
  settings: OwnedPropertyLoanSettings;
  prepayments: HousingLoanPrepaymentEntry[];
  fieldIdPrefix: string;
  referenceDate: Date;
  member?: FamilyMember;
  linkedHousingProperty?: OwnedProperty;
  onChange: (prepayments: HousingLoanPrepaymentEntry[]) => void;
}

function PrepaymentTypeRadios({
  fieldIdPrefix,
  entryId,
  value,
  onChange,
}: {
  fieldIdPrefix: string;
  entryId: string;
  value: HousingLoanPrepaymentType;
  onChange: (type: HousingLoanPrepaymentType) => void;
}) {
  return (
    <div className="housing-owned-payment-options housing-owned-payment-options--compact">
      {PREPAYMENT_TYPES.map((type) => (
        <label key={type} className="housing-owned-payment-option">
          <input
            type="radio"
            name={`${fieldIdPrefix}-prepayment-type-${entryId}`}
            checked={value === type}
            onChange={() => onChange(type)}
          />
          <span>{HOUSING_LOAN_PREPAYMENT_TYPE_LABELS[type]}</span>
        </label>
      ))}
    </div>
  );
}

function resolveRepaymentExecutionTimingLabel(
  settings: OwnedPropertyLoanSettings,
  offsetYears: number,
  referenceDate: Date,
  member: FamilyMember | undefined,
  linkedHousingProperty: OwnedProperty | undefined,
): string {
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const calendar = resolvePrepaymentExecutionCalendar(settings, offsetYears, {
    property: linkedHousingProperty,
    memberAgeAtReference: member?.age ?? undefined,
    referenceYear,
    referenceMonth,
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

export function HousingLoanPrepaymentsEditor({
  settings,
  prepayments,
  fieldIdPrefix,
  referenceDate,
  member,
  linkedHousingProperty,
  onChange,
}: HousingLoanPrepaymentsEditorProps) {
  const repaymentOffsetOptions = Array.from(
    { length: Math.max(1, settings.years) },
    (_, index) => index,
  );

  const updateEntry = (
    entryId: string,
    patch: Partial<HousingLoanPrepaymentEntry>,
  ) => {
    onChange(
      prepayments.map((entry) =>
        entry.id === entryId ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const removeEntry = (entryId: string) => {
    onChange(prepayments.filter((entry) => entry.id !== entryId));
  };

  const addEntry = () => {
    onChange([
      ...prepayments,
      createHousingLoanPrepaymentEntry(settings.years),
    ]);
  };

  if (prepayments.length === 0) {
    return (
      <div className="loan-prepayment-entry-actions">
        <button
          type="button"
          className="loan-prepayment-add"
          onClick={addEntry}
        >
          ＋ 繰上げ返済を追加
        </button>
      </div>
    );
  }

  return (
    <div className="loan-prepayment-entry-list">
      {prepayments.map((entry, index) => {
        const isLast = index === prepayments.length - 1;
        const canRemove = prepayments.length > 1;
        const timingLabel = resolveRepaymentExecutionTimingLabel(
          settings,
          entry.offsetYears,
          referenceDate,
          member,
          linkedHousingProperty,
        );

        return (
          <div key={entry.id} className="loan-prepayment-entry">
            <div className="loan-repayment-type-line">
              <PrepaymentTypeRadios
                fieldIdPrefix={fieldIdPrefix}
                entryId={entry.id}
                value={entry.type}
                onChange={(type) => updateEntry(entry.id, { type })}
              />
            </div>
            <div className="loan-prepayment-execution-line">
              <span className="loan-prepayment-execution-label">実行する時期：</span>
              <select
                id={`${fieldIdPrefix}-prepayment-offset-${entry.id}`}
                className="select-input select-input--compact loan-prepayment-year-select"
                value={entry.offsetYears}
                onChange={(e) =>
                  updateEntry(entry.id, {
                    offsetYears: Number(e.target.value),
                  })
                }
              >
                {repaymentOffsetOptions.map((optionOffsetYears) => (
                  <option key={optionOffsetYears} value={optionOffsetYears}>
                    {formatOwnedPeriodOffsetLabel(optionOffsetYears)}
                  </option>
                ))}
              </select>
              <span className="loan-prepayment-timing-label">{timingLabel}</span>
            </div>
            <div className="loan-prepayment-execution-line">
              <span className="loan-prepayment-execution-label">繰り上げ金額：</span>
              <HousingManInput
                compact
                value={entry.amountMan}
                min={0}
                step={1}
                onChange={(amountMan) => updateEntry(entry.id, { amountMan })}
              />
            </div>
            <div className="loan-prepayment-entry-actions">
              {isLast ? (
                <button
                  type="button"
                  className="loan-prepayment-add"
                  onClick={addEntry}
                >
                  ＋ 繰上げ返済を追加
                </button>
              ) : null}
              {canRemove ? (
                <button
                  type="button"
                  className="loan-prepayment-remove"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`繰上げ返済${index + 1}を削除`}
                >
                  削除
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
