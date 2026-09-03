import type { ReactNode } from 'react';

interface SecondLifeChoiceCardProps {
  active: boolean;
  label: string;
  onSelect: () => void;
  name: string;
  placeholder?: boolean;
  children: ReactNode;
}

export function SecondLifeChoiceCard({
  active,
  label,
  onSelect,
  name,
  placeholder = false,
  children,
}: SecondLifeChoiceCardProps) {
  const cardClass = placeholder
    ? 'second-life-choice-card is-placeholder'
    : active
      ? 'second-life-choice-card is-active'
      : 'second-life-choice-card';

  return (
    <div
      className={cardClass}
      role={placeholder ? undefined : 'radio'}
      aria-checked={placeholder ? undefined : active}
      aria-label={label}
      aria-disabled={placeholder || undefined}
    >
      <button
        type="button"
        className="second-life-choice-header"
        onClick={onSelect}
        disabled={placeholder}
        tabIndex={placeholder ? -1 : 0}
      >
        {!placeholder ? (
          <span
            className={
              active
                ? 'second-life-choice-marker is-checked'
                : 'second-life-choice-marker'
            }
            aria-hidden="true"
          />
        ) : null}
        <span className="second-life-choice-label">{label}</span>
        {active && !placeholder ? (
          <span className="second-life-choice-badge">選択中</span>
        ) : null}
      </button>
      <div className="second-life-choice-body">{children}</div>
      {!placeholder ? (
        <input
          type="radio"
          className="second-life-choice-radio"
          name={name}
          checked={active}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

interface SecondLifePlaceholderBodyProps {
  totalLabel: string;
  lines?: number;
}

export function SecondLifePlaceholderBody({
  totalLabel,
  lines = 2,
}: SecondLifePlaceholderBodyProps) {
  return (
    <div className="second-life-placeholder-body">
      {Array.from({ length: lines }, (_, index) => (
        <p key={index} className="second-life-placeholder-line" aria-hidden="true">
          —
        </p>
      ))}
      <p className="second-life-choice-total">
        {totalLabel} <strong>—</strong> 万円
      </p>
    </div>
  );
}
