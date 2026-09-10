interface HousingSecondLifeApplyConfirmModalProps {
  open: boolean;
  previewLines: string[];
  warnings?: string[];
  onClose: () => void;
  onConfirm: () => void;
}

export function HousingSecondLifeApplyConfirmModal({
  open,
  previewLines,
  warnings = [],
  onClose,
  onConfirm,
}: HousingSecondLifeApplyConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="housing-second-life-apply-confirm-overlay"
      onClick={onClose}
    >
      <div
        className="housing-second-life-apply-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="housing-second-life-apply-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="housing-second-life-apply-confirm-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
        <h3
          id="housing-second-life-apply-confirm-title"
          className="housing-second-life-apply-confirm-title"
        >
          住まいに反映する内容
        </h3>
        <p className="housing-second-life-apply-confirm-lead">
          次の内容で住まい入力へ反映します。よろしいですか？
        </p>
        <ul className="housing-second-life-apply-confirm-list">
          {previewLines.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
        {warnings.length > 0 ? (
          <ul className="housing-second-life-apply-confirm-warnings">
            {warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <div className="housing-second-life-apply-confirm-actions">
          <button
            type="button"
            className="housing-second-life-apply-confirm-cancel"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="housing-second-life-apply-confirm-ok"
            onClick={onConfirm}
            autoFocus
          >
            反映する
          </button>
        </div>
      </div>
    </div>
  );
}
