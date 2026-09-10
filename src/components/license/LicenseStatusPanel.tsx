import { LICENSE_EDITION_LABELS } from '../../types/licenseEdition';
import type { LicenseEntitlements } from '../../types/licenseEdition';

interface LicenseStatusPanelProps {
  licenseState: 'checking' | 'inactive' | 'active' | 'error';
  entitlements: LicenseEntitlements;
  deviceLabel: string;
  errorMessage?: string | null;
  onManageLicense: () => void;
  onStartWithoutKey?: () => void;
  onReleaseDevice?: () => Promise<boolean> | boolean;
  busy?: boolean;
  trialAnalysisUsed?: boolean;
  /** 開発中だけキーなしで全機能が使える状態 */
  isDevUnlock?: boolean;
}

const STATE_LABELS = {
  checking: '確認中',
  inactive: '未登録',
  active: '利用可能',
  error: '確認エラー',
} as const;

const STATE_DESCRIPTIONS = {
  checking: 'ライセンス状態を確認しています。',
  inactive: 'データ入力とライフプラン分析1回は、キーなしで体験できます。',
  active: 'このブラウザではライフプラン分析を利用できます。',
  error: 'ライセンスサーバーに接続できませんでした。',
} as const;

export function LicenseStatusPanel({
  licenseState,
  entitlements,
  deviceLabel,
  errorMessage,
  onManageLicense,
  onStartWithoutKey,
  onReleaseDevice,
  busy = false,
  trialAnalysisUsed = false,
  isDevUnlock = false,
}: LicenseStatusPanelProps) {
  const description = isDevUnlock
    ? '開発中のため、ライセンスキーなしで全機能を使えます。完成版（本番）ではキーが必要です。'
    : licenseState === 'inactive' && trialAnalysisUsed
      ? '体験分析は利用済みです。2回目以降の分析と書き出しにはキーの登録が必要です。'
      : STATE_DESCRIPTIONS[licenseState];
  const featureSummary = isDevUnlock
    ? 'データ入力 / ライフプラン分析 / 複数プラン管理（開発用）'
    : licenseState === 'active'
      ? entitlements.edition === 'advisor'
        ? 'データ入力 / ライフプラン分析 / 複数プラン管理'
        : 'データ入力 / ライフプラン分析（プラン1件）'
      : trialAnalysisUsed
        ? 'データ入力 / 体験分析済み'
        : 'データ入力 / ライフプラン分析（1回まで）';
  const statusLabel = isDevUnlock ? '開発モード' : STATE_LABELS[licenseState];

  return (
    <div className="license-admin-page">
      <section className="license-admin-card" aria-label="ライセンス">
        <div className="license-admin-card-head">
          <div>
            <h2 className="license-admin-card-title">ライセンス</h2>
            <p className="license-admin-card-desc">{description}</p>
          </div>
          <span
            className={`license-status-badge license-status-badge--${isDevUnlock ? 'active' : licenseState}`}
          >
            {statusLabel}
          </span>
        </div>

        <dl className="license-admin-card-grid">
          {licenseState === 'active' || isDevUnlock ? (
            <div>
              <dt>プラン種別</dt>
              <dd>
                {isDevUnlock
                  ? `${LICENSE_EDITION_LABELS[entitlements.edition]}（開発用）`
                  : LICENSE_EDITION_LABELS[entitlements.edition]}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>このブラウザ</dt>
            <dd>{deviceLabel}</dd>
          </div>
          <div>
            <dt>利用可能な機能</dt>
            <dd>{featureSummary}</dd>
          </div>
        </dl>

        {errorMessage && !isDevUnlock ? (
          <p className="license-inline-error">{errorMessage}</p>
        ) : null}

        {!isDevUnlock ? (
          <div className="license-admin-card-actions">
            <button
              type="button"
              className="plan-bar-btn plan-bar-btn--primary"
              onClick={onManageLicense}
            >
              {licenseState === 'active' ? 'キーを変更' : 'ライセンスキーを登録'}
            </button>
            {licenseState !== 'active' && licenseState !== 'checking' && onStartWithoutKey ? (
              <button
                type="button"
                className="plan-bar-btn"
                onClick={onStartWithoutKey}
              >
                キーなしで体験をはじめる
              </button>
            ) : null}
            {licenseState === 'active' && onReleaseDevice ? (
              <button
                type="button"
                className="plan-bar-btn"
                disabled={busy}
                onClick={() => {
                  const confirmed = window.confirm(
                    [
                      'このブラウザのライセンス登録を解除しますか？',
                      '',
                      '解除すると、ライフプラン分析を使うには再度キーの登録が必要です。',
                    ].join('\n'),
                  );
                  if (!confirmed || !onReleaseDevice) return;
                  void (async () => {
                    const ok = await onReleaseDevice();
                    window.alert(
                      ok
                        ? 'このブラウザの登録を解除しました。'
                        : 'このブラウザの登録解除に失敗しました。',
                    );
                  })();
                }}
              >
                このブラウザの登録を解除
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
