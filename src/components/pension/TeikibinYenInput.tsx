import {
  formatNumericDisplay,
  parseNumericInput,
} from '../../lib/pensionTeikibinLabels';

interface TeikibinYenInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  compact?: boolean;
}

export function TeikibinYenInput({
  value,
  onChange,
  compact = false,
}: TeikibinYenInputProps) {
  return (
    <div className="teikibin-amount-input">
      <input
        type="text"
        className={`pension-field-input pension-field-input--yen${compact ? ' pension-field-input--yen-compact' : ''}`}
        value={formatNumericDisplay(value)}
        onChange={(e) => onChange(parseNumericInput(e.target.value))}
      />
      <span className="pension-field-unit">円</span>
    </div>
  );
}
