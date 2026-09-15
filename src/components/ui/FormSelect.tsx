import type { SelectHTMLAttributes } from 'react';
import {
  getFormControlWidthClassName,
  type FormControlWidth,
} from './controlWidth';

export interface FormSelectOption {
  value: number | string;
  label: string;
}

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: FormSelectOption[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  compact?: boolean;
  wide?: boolean;
  controlWidth?: FormControlWidth;
  onValueChange?: (value: string) => void;
}

export function FormSelect({
  options,
  allowEmpty = false,
  emptyLabel = '選択',
  compact = false,
  wide = false,
  controlWidth,
  className,
  value,
  onValueChange,
  onChange,
  ...props
}: FormSelectProps) {
  const classes = [
    'ui-select',
    compact ? 'ui-select--compact' : '',
    wide ? 'ui-select--wide' : '',
    getFormControlWidthClassName(controlWidth),
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <select
      className={classes}
      value={value ?? ''}
      onChange={(e) => {
        onChange?.(e);
        onValueChange?.(e.target.value);
      }}
      {...props}
    >
      {allowEmpty && (
        <option value="" disabled={value !== '' && value != null}>
          {emptyLabel}
        </option>
      )}
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
