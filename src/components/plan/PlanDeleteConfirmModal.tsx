import { formatPlanDisplayName } from '../../types/plan';

interface PlanDeleteConfirmModalProps {
  open: boolean;
  customerName: string;
  showHonorific?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function PlanDeleteConfirmModal({
  open,
  customerName,
  showHonorific = false,
  onClose,
  onConfirm,
}: PlanDeleteConfirmModalProps) {
  if (!open) return null;

  const displayName = formatPlanDisplayName(customerName, {
    honorific: showHonorific,
  });

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal plan-delete-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-delete-modal-title"
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
        <h3 id="plan-delete-modal-title" className="education-ref-modal-title">
          プランを削除
        </h3>
        <p className="education-ref-modal-summary">
          「{displayName}」を削除しますか？この操作は取り消せません。
        </p>
        <div className="plan-save-as-actions">
          <button type="button" className="plan-bar-btn" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="plan-bar-btn plan-bar-btn--danger"
            onClick={onConfirm}
            autoFocus
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
