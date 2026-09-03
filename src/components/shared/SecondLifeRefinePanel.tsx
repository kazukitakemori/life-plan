import { useEffect, useId, useState, type ReactNode } from 'react';

interface SecondLifeRefinePanelProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SecondLifeRefinePanel({
  title,
  summary,
  defaultOpen = false,
  children,
}: SecondLifeRefinePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <section className="second-life-refine" aria-label={title}>
        <button
          type="button"
          className="second-life-refine-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <div className="second-life-refine-trigger-main">
            <h3 className="second-life-refine-title">{title}</h3>
            {summary ? (
              <p className="second-life-refine-summary">{summary}</p>
            ) : null}
          </div>
          <span className="second-life-refine-trigger-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </section>

      {open ? (
        <div
          className="second-life-refine-modal-overlay"
          onClick={() => setOpen(false)}
        >
          <div
            className="second-life-refine-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="second-life-refine-modal-close"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
            >
              ×
            </button>
            <h3 id={titleId} className="second-life-refine-modal-title">
              {title}
            </h3>
            <div className="second-life-refine-modal-body">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
