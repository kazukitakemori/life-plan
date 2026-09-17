import { LICENSE_EDITION_LABELS } from '../../types/licenseEdition';
import type { LicenseEntitlements } from '../../types/licenseEdition';
import type { LicenseState } from '../../types/license';

interface LicenseStatusPanelProps {
  licenseState: LicenseState;
  entitlements: LicenseEntitlements;
  deviceLabel: string;
  errorMessage?: string | null;
  onManageLicense: () => void;
  onStartWithoutKey?: () => void;
  onReleaseDevice?: () => Promise<boolean> | boolean;
  busy?: boolean;
  trialAnalysisUsed?: boolean;
  /** PreviewだけGoogleログインなしで全機能を使える状態 */
  isDevUnlock?: boolean;
}

const STATE_LABELS: Record<LicenseState, string> = {
  checking: '確認中',
  inactive: '未ログイン',
  trial: '無料体験',
  active: '利用可能',
  error: '確認エラー',
};

export function LicenseStatusPanel({
  licenseState,
  entitlements,
  errorMessage,
  onManageLicense,
  onStartWithoutKey,
  onReleaseDevice,
  busy = false,
  trialAnalysisUsed = false,
  isDevUnlock = false,
}: LicenseStatusPanelProps) {
  const description = isDevUnlock
    ? '確認版ではGoogleログインを要求せず、開発確認用として全機能を使えます。'
    : licenseState === 'checking'
      ? 'Googleアカウントの状態を確認しています。'
      : licenseState === 'inactive'
        ? 'Googleアカウントでログインすると、プランをクラウドに保存して別のブラウザやPCから続きが使えます。'
        : licenseState === 'trial'
          ? trialAnalysisUsed
            ? 'Googleアカウントにログイン済みです。無料体験のライフプラン分析は利用済みです。'
            : 'Googleアカウントにログイン済みです。データ入力とライフプラン分析1回を無料で体験できます。'
          : licenseState === 'active'
            ? '利用権とプランはGoogleアカウントに紐付いています。ブラウザを変えても同じデータを利用できます。'
            : 'アカウント情報を確認できませんでした。';

  const featureSummary = isDevUnlock
    ? 'データ入力 / ライフプラン分析 / 複数プラン管理（確認版）'
    : licenseState === 'active'
      ? entitlements.edition === 'advisor'
        ? 'データ入力 / ライフプラン分析 / 複数プラン管理 / クラウド保存'
        : 'データ入力 / ライフプラン分析（プラン1件） / クラウド保存'
      : licenseState === 'trial'
        ? trialAnalysisUsed
          ? 'データ入力 / クラウド保存 / 体験分析済み'
          : 'データ入力 / クラウド保存 / ライフプラン分析（1回まで）'
        : 'Googleログイン後に利用できます';

  const statusLabel = isDevUnlock ? '確認版' : STATE_LABELS[licenseState];
  const statusClass =
    isDevUnlock || licenseState === 'active'
      ? 'active'
      : licenseState === 'trial'
        ? 'inactive'
        : licenseState;

  return (
    <div className="license-admin-page">
      <section className="license-admin-card" aria-label="アカウント">
        <div className="license-admin-card-head">
          <div>
            <h2 className="license-admin-card-title">アカウント</h2>
            <p className="license-admin-card-desc">{description}</p>
          </div>
          <span className={`license-status-badge license-status-badge--${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <dl className="license-admin-card-grid">
          {licenseState === 'active' || isDevUnlock ? (
            <div>
              <dt>プラン種別</dt>
              <dd>
                {isDevUnlock
                  ? `${LICENSE_EDITION_LABELS[entitlements.edition]}（確認版）`
                  : LICENSE_EDITION_LABELS[entitlements.edition]}
              </dd>
            </div>
          ) : null}
          {licenseState === 'trial' || licenseState === 'active' || isDevUnlock ? (
            <div>
              <dt>データ保存</dt>
              <dd>{isDevUnlock ? 'この確認版のブラウザ内' : 'Googleアカウントにクラウド保存'}</dd>
            </div>
          ) : null}
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
            {(licenseState === 'inactive' || licenseState === 'error') ? (
              <button
                type="button"
                className="plan-bar-btn plan-bar-btn--primary"
                disabled={busy}
                onClick={onManageLicense}
              >
                Googleでログイン
              </button>
            ) : null}

            {licenseState === 'trial' && !trialAnalysisUsed && onStartWithoutKey ? (
              <button
                type="button"
                className="plan-bar-btn plan-bar-btn--primary"
                disabled={busy}
                onClick={onStartWithoutKey}
              >
                無料体験をはじめる
              </button>
            ) : null}

            {licenseState === 'trial' ? (
              <button
                type="button"
                className="plan-bar-btn"
                disabled={busy}
                onClick={onManageLicense}
              >
                利用コードを登録
              </button>
            ) : null}

            {(licenseState === 'trial' || licenseState === 'active') && onReleaseDevice ? (
              <button
                type="button"
                className="plan-bar-btn"
                disabled={busy}
                onClick={() => {
                  const confirmed = window.confirm(
                    [
                      'Googleアカウントからログアウトしますか？',
                      '',
                      'クラウドに保存されたプランは削除されません。',
                    ].join('\n'),
                  );
                  if (!confirmed || !onReleaseDevice) return;
                  void onReleaseDevice();
                }}
              >
                ログアウト
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
