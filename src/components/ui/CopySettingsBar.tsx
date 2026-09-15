interface CopySettingsOption {
  id: string;
  label: string;
}

interface CopySettingsBarProps {
  value: string;
  options: CopySettingsOption[];
  onChange: (value: string) => void;
  onCopy: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

/** Shared member-to-member settings copy control. */
export function CopySettingsBar({
  value,
  options,
  onChange,
  onCopy,
  disabled = false,
  className,
  label = 'コピー元',
}: CopySettingsBarProps) {
  return (
    <div
      className="ui-copy-bar-region"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        width: '100%',
        minWidth: 0,
      }}
    >
      <div className={['ui-copy-bar', className].filter(Boolean).join(' ')}>
        <span className="ui-copy-bar-label">{label}</span>
        <select
          className="ui-copy-bar-select"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ui-copy-bar-button"
          onClick={onCopy}
          disabled={disabled}
        >
          設定をコピー
        </button>
      </div>
    </div>
  );
}
