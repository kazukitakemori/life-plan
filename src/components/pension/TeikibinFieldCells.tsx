import {
  formatNumericDisplay,
  parseNumericInput,
} from '../../lib/pensionTeikibinLabels';

interface MonthInputCellProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export function MonthInputCell({ value, onChange }: MonthInputCellProps) {
  return (
    <div className="teikibin-period-cell">
      <input
        type="text"
        className="pension-field-input"
        value={formatNumericDisplay(value)}
        onChange={(e) => onChange(parseNumericInput(e.target.value))}
      />
      <span className="pension-field-unit">月</span>
    </div>
  );
}

export function CalcMonthCell({
  value,
  highlight = false,
}: {
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`teikibin-period-cell teikibin-period-cell--calc${highlight ? ' teikibin-period-cell--highlight' : ''}`}
    >
      <span className="pension-field-calc">{value.toLocaleString()}</span>
      <span className="pension-field-unit">月</span>
    </div>
  );
}
