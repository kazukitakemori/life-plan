import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { getStepGuidance } from './stepGuidance';

interface StepHeadingProps {
  number?: number | null;
  title: string;
  subtitle?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Shared step page heading — Q1〜Q12はタイトルから共通ガイダンスを開く。 */
export function StepHeading({
  number,
  title,
  subtitle,
  lead,
  actions,
  className,
}: StepHeadingProps) {
  const guidance = getStepGuidance(number);
  const [guideOpen, setGuideOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeGuide = () => setGuideOpen(false);

  useEffect(() => {
    if (!guideOpen || !guidance) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeGuide();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [guideOpen, guidance]);

  const guideDialog =
    guideOpen && guidance && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="step-guide-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeGuide();
            }}
          >
            <section
              className="step-guide-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
            >
              <div className="step-guide-dialog-head">
                <div>
                  <p className="step-guide-dialog-kicker">
                    {number != null ? `Q${number}` : '入力ガイド'}
                  </p>
                  <h2 id={titleId} className="step-guide-dialog-title">
                    {title}
                  </h2>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  className="step-guide-close"
                  aria-label={`${title}の説明を閉じる`}
                  onClick={closeGuide}
                >
                  ×
                </button>
              </div>

              <div className="step-guide-dialog-body">
                <section className="step-guide-section">
                  <h3 className="step-guide-section-title">この画面で考えること</h3>
                  <p id={descriptionId} className="step-guide-overview">
                    {guidance.overview}
                  </p>
                  {subtitle || lead ? (
                    <div className="step-guide-current-context">
                      {subtitle ? (
                        <p className="step-guide-context-line">{subtitle}</p>
                      ) : null}
                      {lead ? <div className="step-guide-context-line">{lead}</div> : null}
                    </div>
                  ) : null}
                </section>

                <section className="step-guide-section">
                  <h3 className="step-guide-section-title">まず入力すること</h3>
                  <ol className="step-guide-list">
                    {guidance.firstSteps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </section>

                <section className="step-guide-section step-guide-section--hint">
                  <h3 className="step-guide-section-title">迷ったときは</h3>
                  <p>{guidance.whenUnsure}</p>
                </section>

                {guidance.note ? (
                  <aside className="step-guide-note" role="note">
                    {guidance.note}
                  </aside>
                ) : null}
              </div>

              <div className="step-guide-dialog-footer">
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary step-guide-done"
                  onClick={closeGuide}
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
      <div className={['step-header', className].filter(Boolean).join(' ')}>
        <div>
          <h2 className="step-title">
            {guidance ? (
              <button
                ref={triggerRef}
                type="button"
                className="step-title-guide-trigger"
                aria-haspopup="dialog"
                aria-expanded={guideOpen}
                aria-label={`${number != null ? `Q${number} ` : ''}${title}の説明を見る`}
                onClick={() => setGuideOpen(true)}
              >
                {number != null ? (
                  <span className="step-index" aria-hidden>
                    {number}
                  </span>
                ) : null}
                <span className="step-title-text">{title}</span>
                <span className="step-title-guide-icon" aria-hidden>
                  i
                </span>
              </button>
            ) : (
              <>
                {number != null ? (
                  <span className="step-index" aria-hidden>
                    {number}
                  </span>
                ) : null}
                <span className="step-title-text">{title}</span>
                {subtitle ? (
                  <span className="step-subtitle">{subtitle}</span>
                ) : null}
              </>
            )}
          </h2>
          {!guidance && lead ? <div className="step-lead">{lead}</div> : null}
        </div>
        {actions ? <div className="step-header-right">{actions}</div> : null}
      </div>
      {guideDialog}
    </>
  );
}
