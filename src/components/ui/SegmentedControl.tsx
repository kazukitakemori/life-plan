export interface SegmentedControlOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  value: string;
  options: readonly SegmentedControlOption[];
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  const rootClassName = ['ui-segmented', className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClassName}
      role="group"
      aria-label={ariaLabel ?? label}
    >
      {label ? <span className="ui-segmented-label">{label}</span> : null}
      <div className="ui-segmented-options">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={`ui-segmented-button${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
