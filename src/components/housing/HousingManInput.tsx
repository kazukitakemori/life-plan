interface HousingManInputProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
  disabled?: boolean;
  min?: number;
  step?: number;
  unit?: string;
}

export function HousingManInput({
  value,
  onChange,
  compact = false,
  disabled = false,
  min = 0,
  step = 1,
  unit = '万円',
}: HousingManInputProps) {
  return (
    <div className="housing-man-input">
      <input
        type="number"
        className={`amount-input${compact ? ' amount-input--compact' : ''}`}
        value={value}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <span className="amount-unit">{unit}</span>
    </div>
  );
}
