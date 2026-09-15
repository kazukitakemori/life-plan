import { useId, useState, type ReactNode } from 'react';

interface AddDisclosureProps {
  label: string;
  children: (close: () => void) => ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddDisclosure({
  label,
  children,
  className,
  open,
  onOpenChange,
}: AddDisclosureProps) {
  const panelId = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const resolvedOpen = controlled ? open : internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!controlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const close = () => setOpen(false);

  return (
    <section
      className={`ui-add-disclosure${resolvedOpen ? ' is-open' : ''}${
        className ? ` ${className}` : ''
      }`}
      aria-label={label}
    >
      <div className="ui-add-disclosure__actions">
        <button
          type="button"
          className="ui-btn ui-btn--secondary ui-add-disclosure__toggle"
          aria-expanded={resolvedOpen}
          aria-controls={panelId}
          onClick={() => setOpen(!resolvedOpen)}
        >
          ＋ {label}
        </button>
      </div>

      {resolvedOpen ? (
        <div id={panelId} className="ui-add-disclosure__panel">
          {children(close)}
        </div>
      ) : null}
    </section>
  );
}
