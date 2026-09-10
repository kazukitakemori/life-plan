import type { ReactNode } from 'react';

interface StepHeadingProps {
  number?: number | null;
  title: string;
  subtitle?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Shared step page heading — replaces legacy "Qn." titles. */
export function StepHeading({
  number,
  title,
  subtitle,
  lead,
  actions,
  className,
}: StepHeadingProps) {
  return (
    <div className={['step-header', className].filter(Boolean).join(' ')}>
      <div>
        <h2 className="step-title">
          {number != null ? (
            <span className="step-index" aria-hidden>
              {number}
            </span>
          ) : null}
          <span className="step-title-text">{title}</span>
          {subtitle ? (
            <span className="step-subtitle">{subtitle}</span>
          ) : null}
        </h2>
        {lead ? <div className="step-lead">{lead}</div> : null}
      </div>
      {actions ? <div className="step-header-right">{actions}</div> : null}
    </div>
  );
}
