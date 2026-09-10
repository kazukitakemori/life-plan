import { useId, useState, type ReactNode } from 'react';

interface HousingOwnedDetailFoldProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** 所有物件詳細内の段階開示。ローン・保険・保守など重い塊をデフォルト折りたたみにする。 */
export function HousingOwnedDetailFold({
  title,
  summary,
  defaultOpen = false,
  children,
}: HousingOwnedDetailFoldProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className={
        open
          ? 'housing-owned-detail-section housing-owned-detail-fold is-open'
          : 'housing-owned-detail-section housing-owned-detail-fold'
      }
    >
      <button
        type="button"
        className="housing-owned-detail-fold-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="housing-owned-detail-fold-main">
          <span className="housing-owned-detail-title housing-owned-detail-fold-title">
            {title}
          </span>
          {!open && summary ? (
            <span className="housing-owned-detail-fold-summary">{summary}</span>
          ) : null}
        </span>
        <span className="housing-owned-detail-fold-chevron" aria-hidden>
          {open ? '∧' : '›'}
        </span>
        <span className="housing-owned-detail-fold-action">
          {open ? '閉じる' : '開く'}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="housing-owned-detail-fold-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}
