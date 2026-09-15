import type { ReactNode } from 'react';
import {
  getFormControlWidthClassName,
  type FormControlWidth,
} from './controlWidth';

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  controlWidth?: FormControlWidth;
}

export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className,
  controlWidth,
}: FormFieldProps) {
  return (
    <div className={['ui-field', className].filter(Boolean).join(' ')}>
      {label ? (
        <label className="ui-field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      <div
        className={[
          'ui-field-controls',
          getFormControlWidthClassName(controlWidth),
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
      {hint ? <p className="ui-field-hint">{hint}</p> : null}
    </div>
  );
}
