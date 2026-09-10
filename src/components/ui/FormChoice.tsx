import type { InputHTMLAttributes, ReactNode } from 'react';

interface FormChoiceProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: 'checkbox' | 'radio';
  children: ReactNode;
  className?: string;
}

export function FormChoice({
  type = 'checkbox',
  children,
  className,
  ...props
}: FormChoiceProps) {
  return (
    <label className={['ui-choice', className].filter(Boolean).join(' ')}>
      <input type={type} {...props} />
      <span className="ui-choice-label">{children}</span>
    </label>
  );
}
