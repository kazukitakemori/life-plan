import {
  tuitionAnnualToMonthly,
  tuitionMonthlyToAnnual,
} from '../../lib/educationAmount';
import { OTHER_EXPENSE_PAYMENT_OPTIONS } from '../../lib/educationLabels';
import { getEnrollmentYearSelectOptions } from '../../lib/educationPeriod';
import type {
  EducationExpenseEntry,
  EducationOtherExpense,
} from '../../types/education';
import { EducationYenInput } from './EducationYenInput';

interface EducationOtherExpenseItemProps {
  item: EducationOtherExpense;
  entry: Pick<
    EducationExpenseEntry,
    'startAge' | 'startMonth' | 'endAge' | 'endMonth'
  >;
  onChange: (item: EducationOtherExpense) => void;
  onRemove: () => void;
}

export function EducationOtherExpenseItem({
  item,
  entry,
  onChange,
  onRemove,
}: EducationOtherExpenseItemProps) {
  const yearSelectOptions = getEnrollmentYearSelectOptions(
    entry.startAge,
    entry.startMonth,
    entry.endAge,
    entry.endMonth,
  );

  const setPaymentCycle = (paymentCycle: EducationOtherExpense['paymentCycle']) => {
    if (paymentCycle === item.paymentCycle) return;

    const amount =
      paymentCycle === 'yearly'
        ? tuitionMonthlyToAnnual(item.amount)
        : tuitionAnnualToMonthly(item.amount);

    onChange({ ...item, paymentCycle, amount });
  };

  return (
    <div className="education-other-item">
      <div className="education-other-item-top">
        <select
          className="select-input select-input--compact education-select education-other-year-select"
          value={item.enrollmentYear}
          onChange={(e) =>
            onChange({ ...item, enrollmentYear: Number(e.target.value) })
          }
        >
          {yearSelectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="select-input select-input--compact education-select education-other-cycle-select"
          value={item.paymentCycle}
          onChange={(e) =>
            setPaymentCycle(
              e.target.value as EducationOtherExpense['paymentCycle'],
            )
          }
        >
          {OTHER_EXPENSE_PAYMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <EducationYenInput
          value={item.amount}
          onChange={(amount) => onChange({ ...item, amount })}
          compact
        />
        <button
          type="button"
          className="education-other-remove"
          onClick={onRemove}
          aria-label="項目を削除"
        >
          −
        </button>
      </div>
      <input
        type="text"
        className="education-text-input education-other-label-input"
        placeholder="内容など"
        value={item.label}
        onChange={(e) => onChange({ ...item, label: e.target.value })}
      />
    </div>
  );
}
