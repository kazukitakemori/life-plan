import type { ReactNode } from 'react';

interface DisclosureSectionProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/** Progressive disclosure: keep advanced fields collapsed by default. */
export function DisclosureSection({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: DisclosureSectionProps) {
  return (
    <details
      className={['ui-disclosure', className].filter(Boolean).join(' ')}
      defaultOpen={defaultOpen}
    >
      <summary className="ui-disclosure-summary">
        <span className="ui-disclosure-title">{title}</span>
        {summary ? (
          <span className="ui-disclosure-meta">{summary}</span>
        ) : null}
      </summary>
      <div className="ui-disclosure-body">{children}</div>
    </details>
  );
}
