import type { ReactNode } from 'react';

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={['ui-field', className].filter(Boolean).join(' ')}>
      {label ? (
        <label className="ui-field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      <div className="ui-field-controls">{children}</div>
      {hint ? <p className="ui-field-hint">{hint}</p> : null}
    </div>
  );
}
