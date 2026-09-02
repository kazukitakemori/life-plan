import {
  formatNumericDisplay,
  parseNumericInput,
} from '../../lib/pensionTeikibinLabels';

interface HousingYenInputProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
  unit?: string;
}

export function HousingYenInput({
  value,
  onChange,
  compact = false,
  unit = '円',
}: HousingYenInputProps) {
  return (
    <div className="housing-yen-input">
      <input
        type="text"
        className={`housing-yen-field${compact ? ' housing-yen-field--compact' : ''}`}
        value={formatNumericDisplay(value)}
        onChange={(e) => onChange(parseNumericInput(e.target.value) ?? 0)}
      />
      <span className="housing-yen-unit">{unit}</span>
    </div>
  );
}
