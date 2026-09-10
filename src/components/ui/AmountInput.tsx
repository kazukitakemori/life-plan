import { DebouncedTextInput } from '../shared/DebouncedTextInput';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/** Shared amount field shell — adopt in income/housing/etc. next. */
export function AmountInput({
  value,
  onChange,
  unit,
  ariaLabel,
  className,
  placeholder,
  disabled,
}: AmountInputProps) {
  return (
    <div className={['ui-amount', className].filter(Boolean).join(' ')}>
      <DebouncedTextInput
        className="ui-input ui-input--amount"
        value={value}
        onChange={onChange}
        inputMode="decimal"
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      {unit ? <span className="ui-amount-unit">{unit}</span> : null}
    </div>
  );
}
