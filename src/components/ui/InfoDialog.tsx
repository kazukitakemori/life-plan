import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

interface InfoDialogProps {
  title: string;
  children: ReactNode;
  label?: string;
  className?: string;
}

export function InfoDialog({
  title,
  children,
  label = '詳しく見る',
  className,
}: InfoDialogProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  const dialog =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="ui-info-dialog-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section
              className="ui-info-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div className="ui-info-dialog-head">
                <h2 id={titleId} className="ui-info-dialog-title">
                  {title}
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  className="ui-info-dialog-close"
                  aria-label="説明を閉じる"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="ui-info-dialog-body">{children}</div>
              <div className="ui-info-dialog-footer">
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary"
                  onClick={() => setOpen(false)}
                >
                  閉じる
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={['ui-info-trigger', className].filter(Boolean).join(' ')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="ui-info-trigger-icon" aria-hidden>
          i
        </span>
        <span>{label}</span>
      </button>
      {dialog}
    </>
  );
}
