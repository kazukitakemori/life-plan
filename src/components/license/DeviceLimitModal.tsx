import { useId } from 'react';

import type { LicenseDevice } from '../../types/license';

interface DeviceLimitModalProps {
  open: boolean;
  busy?: boolean;
  devices: LicenseDevice[];
  currentDeviceId: string;
  maxDevices: number;
  errorMessage?: string | null;
  onClose: () => void;
  onReplace: (targetDeviceId: string) => Promise<boolean>;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

export function DeviceLimitModal({
  open,
  busy = false,
  devices,
  currentDeviceId,
  maxDevices,
  errorMessage,
  onClose,
  onReplace,
}: DeviceLimitModalProps) {
  const titleId = useId();
  const hintId = useId();
  const errorId = useId();

  if (!open) return null;

  return (
    <div
      className="education-ref-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="education-ref-modal license-device-modal"
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
          利用できる端末数の上限に達しています
        </h3>
        <p id={hintId} className="education-ref-modal-summary">
          このライセンスキーは最大 {maxDevices} 台まで登録できます。新しい端末で使うには、登録済みの端末を1台解除してください。
        </p>

        <div className="education-ref-modal-body">
          <ul className="license-device-list">
            {devices.map((device) => {
              const isCurrent = device.deviceId === currentDeviceId;
              return (
                <li key={device.deviceId} className="license-device-card">
                  <div className="license-device-card-main">
                    <p className="license-device-card-title">
                      {device.deviceLabel}
                      {isCurrent ? (
                        <span className="license-device-card-badge">この端末</span>
                      ) : null}
                    </p>
                    <p className="license-device-card-meta">
                      登録日時: {formatDateTime(device.activatedAt)}
                    </p>
                  </div>
                  {!isCurrent ? (
                    <button
                      type="button"
                      className="plan-bar-btn plan-bar-btn--primary license-device-card-action"
                      disabled={busy}
                      onClick={() => {
                        void onReplace(device.deviceId);
                      }}
                    >
                      {busy ? '処理中…' : 'この端末を解除して登録'}
                    </button>
                  ) : (
                    <span className="license-device-card-note">現在利用中</span>
                  )}
                </li>
              );
            })}
          </ul>

          {errorMessage ? (
            <p id={errorId} className="license-inline-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="plan-save-as-actions license-modal-footer">
            <button type="button" className="plan-bar-btn" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
