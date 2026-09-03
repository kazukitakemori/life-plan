import { LICENSE_EDITION_LABELS } from '../../types/licenseEdition';
import type { LicenseEntitlements } from '../../types/licenseEdition';

interface LicenseStatusPanelProps {
  licenseState: 'checking' | 'inactive' | 'active' | 'error';
  entitlements: LicenseEntitlements;
  deviceLabel: string;
  errorMessage?: string | null;
  onManageLicense: () => void;
  onReleaseDevice?: () => void;
  busy?: boolean;
}

const STATE_LABELS = {
  checking: '確認中',
  inactive: '未登録',
  active: '利用可能',
  error: '確認エラー',
} as const;

const STATE_DESCRIPTIONS = {
  checking: 'ライセンス状態を確認しています。',
  inactive: 'ライフプラン分析を使うには、キーの登録が必要です。',
  active: 'このブラウザではライフプラン分析を利用できます。',
  error: 'ライセンスサーバーに接続できませんでした。',
} as const;

export function LicenseStatusPanel({
  licenseState,
  entitlements,
  deviceLabel,
  errorMessage,
  onManageLicense,
  onReleaseDevice,
  busy = false,
}: LicenseStatusPanelProps) {
  const featureSummary =
    licenseState === 'active'
      ? entitlements.edition === 'advisor'
        ? 'データ入力 / ライフプラン分析 / 複数プラン管理'
        : 'データ入力 / ライフプラン分析（プラン1件）'
      : 'データ入力のみ';

  return (
    <div className="license-admin-page">
      <section className="license-admin-card" aria-label="ライセンス">
        <div className="license-admin-card-head">
          <div>
            <h2 className="license-admin-card-title">ライセンス</h2>
            <p className="license-admin-card-desc">{STATE_DESCRIPTIONS[licenseState]}</p>
          </div>
          <span className={`license-status-badge license-status-badge--${licenseState}`}>
            {STATE_LABELS[licenseState]}
          </span>
        </div>

        <dl className="license-admin-card-grid">
          <div>
            <dt>プラン種別</dt>
            <dd>{LICENSE_EDITION_LABELS[entitlements.edition]}</dd>
          </div>
          <div>
            <dt>このブラウザ</dt>
            <dd>{deviceLabel}</dd>
          </div>
          <div>
            <dt>利用可能な機能</dt>
            <dd>{featureSummary}</dd>
          </div>
        </dl>

        {errorMessage ? <p className="license-inline-error">{errorMessage}</p> : null}

        <div className="license-admin-card-actions">
          <button
            type="button"
            className="plan-bar-btn plan-bar-btn--primary"
            onClick={onManageLicense}
          >
            {licenseState === 'active' ? 'キーを変更' : 'ライセンスキーを登録'}
          </button>
          {licenseState === 'active' && onReleaseDevice ? (
            <button
              type="button"
              className="plan-bar-btn"
              disabled={busy}
              onClick={onReleaseDevice}
            >
              このブラウザの登録を解除
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
