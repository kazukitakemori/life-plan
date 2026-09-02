import { useEffect, useId, useState } from 'react';

import { formatLicenseKeyInput } from '../../lib/license/storage';

interface LicenseKeyModalProps {
  open: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (key: string) => Promise<boolean>;
}

function isKeyComplete(key: string): boolean {
  const normalized = key.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return normalized.length >= 14 && normalized.startsWith('LP');
}

export function LicenseKeyModal({
  open,
  busy = false,
  errorMessage,
  onClose,
  onSubmit,
}: LicenseKeyModalProps) {
  const [key, setKey] = useState('');
  const titleId = useId();
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!open) {
      setKey('');
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = isKeyComplete(key) && !busy;

  const handleSubmit = () => {
    if (!canSubmit) return;
    void onSubmit(key);
  };

  return (
    <div
      className="education-ref-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="education-ref-modal license-key-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="education-ref-modal-close"
          aria-label="閉じる"
          onClick={onClose}
        >
          ×
        </button>

        <h3 id={titleId} className="education-ref-modal-title">
          ライセンスキーの登録
        </h3>
        <p id={hintId} className="education-ref-modal-summary">
          ライフプラン分析には、購入時にお渡ししたキーが必要です。データの入力は、キーなしでも行えます。
        </p>

        <div className="education-ref-modal-body">
          <label className="plan-meta-label" htmlFor="license-key-input">
            ライセンスキー
          </label>
          <input
            id="license-key-input"
            className="plan-meta-input license-key-input"
            value={key}
            onChange={(event) => setKey(formatLicenseKeyInput(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="LP-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            inputMode="text"
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? errorId : undefined}
          />
          <p className="license-key-format-hint">
            形式: LP-XXXX-XXXX-XXXX（ハイフンは自動で入ります）
          </p>

          {errorMessage ? (
            <p id={errorId} className="license-inline-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="plan-save-as-actions license-modal-footer">
            <button type="button" className="plan-bar-btn" onClick={onClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="plan-bar-btn plan-bar-btn--primary"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {busy ? '確認中…' : '登録して分析を使う'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
