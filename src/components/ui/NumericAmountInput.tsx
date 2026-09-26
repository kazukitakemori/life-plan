import {
  formatNumericDisplay,
  parseNumericInput,
} from '../../lib/pensionTeikibinLabels';

interface NumericAmountInputProps {
  value: number;
  onChange: (value: number) => void;
  unit: string;
  id?: string;
  ariaLabel?: string;
  min?: number;
  className?: string;
}

export function NumericAmountInput({
  value,
  onChange,
  unit,
  id,
  ariaLabel,
  min = 0,
  className,
}: NumericAmountInputProps) {
  return (
    <div className={['ui-amount', className].filter(Boolean).join(' ')}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="ui-input ui-input--amount"
        value={formatNumericDisplay(value)}
        aria-label={ariaLabel}
        onChange={(event) => {
          const parsed = parseNumericInput(event.target.value);
          onChange(Math.max(min, parsed ?? 0));
        }}
      />
      <span className="ui-amount-unit">{unit}</span>
    </div>
  );
}
