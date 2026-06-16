import { useEffect, useState } from 'react';
import {
  LIVING_ITEM_PRESET_LABELS,
  type LivingItemPresetLabel,
} from '../../lib/livingItemPresets';

interface AddLivingItemModalProps {
  open: boolean;
  existingLabels: string[];
  onClose: () => void;
  onAdd: (labels: string[]) => void;
}

export function AddLivingItemModal({
  open,
  existingLabels,
  onClose,
  onAdd,
}: AddLivingItemModalProps) {
  const [selected, setSelected] = useState<Set<LivingItemPresetLabel>>(
    new Set(),
  );

  useEffect(() => {
    if (open) {
      setSelected(new Set());
    }
  }, [open]);

  if (!open) return null;

  const toggle = (preset: LivingItemPresetLabel) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(preset)) {
        next.delete(preset);
      } else {
        next.add(preset);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === LIVING_ITEM_PRESET_LABELS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(LIVING_ITEM_PRESET_LABELS));
    }
  };

  const handleAdd = () => {
    const labels: string[] = [];
    const normalizedExisting = new Set(
      existingLabels.map((l) => l.trim()).filter(Boolean),
    );

    for (const preset of LIVING_ITEM_PRESET_LABELS) {
      if (!selected.has(preset)) continue;
      const label = preset === '(自由入力)' ? '' : preset;
      if (label && normalizedExisting.has(label)) continue;
      labels.push(label);
      if (label) normalizedExisting.add(label);
    }

    if (labels.length > 0) {
      onAdd(labels);
    }
    onClose();
  };

  const allChecked = selected.size === LIVING_ITEM_PRESET_LABELS.length;

  return (
    <div className="living-modal-overlay" onClick={onClose}>
      <div
        className="living-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="living-modal-title"
      >
        <button
          type="button"
          className="living-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>

        <h3 id="living-modal-title" className="living-modal-title">
          追加する項目を選択してください
        </h3>

        <label className="living-modal-check-all">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
          />
          <span>一括チェック</span>
        </label>

        <div className="living-modal-grid">
          {LIVING_ITEM_PRESET_LABELS.map((preset) => (
            <label key={preset} className="living-modal-option">
              <input
                type="checkbox"
                checked={selected.has(preset)}
                onChange={() => toggle(preset)}
              />
              <span>{preset}</span>
            </label>
          ))}
        </div>

        <div className="living-modal-footer">
          <button
            type="button"
            className="living-modal-add-btn"
            onClick={handleAdd}
            disabled={selected.size === 0}
          >
            ＋ 項目を追加
          </button>
          <p className="living-modal-note">
            項目のカスタマイズは設定オプションから行えます
          </p>
        </div>
      </div>
    </div>
  );
}
