import {
  formatNumericDisplay,
  parseNumericInput,
} from '../../lib/pensionTeikibinLabels';

interface EducationYenInputProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}

export function EducationYenInput({
  value,
  onChange,
  compact = false,
}: EducationYenInputProps) {
  return (
    <div className="education-yen-input">
      <input
        type="text"
        className={`education-yen-field${compact ? ' education-yen-field--compact' : ''}`}
        value={formatNumericDisplay(value)}
        onChange={(e) => onChange(parseNumericInput(e.target.value) ?? 0)}
      />
      <span className="education-yen-unit">円</span>
    </div>
  );
}
