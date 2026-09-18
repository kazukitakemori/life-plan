import { useEffect, useState } from 'react';

import {
  requestEmailLoginCode,
  startGoogleLogin,
  verifyEmailLoginCode,
} from '../../lib/account/api';
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
  /** Previewだけログインなしで全機能を使える状態 */
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
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailStep, setEmailStep] = useState<'email' | 'code'>('email');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (licenseState !== 'inactive' && licenseState !== 'error') {
      setEmailStep('email');
      setCode('');
      setAuthError(null);
    }
  }, [licenseState]);

  const description = isDevUnlock
    ? '確認版ではログインを要求せず、開発確認用として全機能を使えます。'
    : licenseState === 'checking'
      ? 'アカウントの状態を確認しています。'
      : licenseState === 'inactive'
        ? 'Googleまたはメールアドレスでログインすると、プランをクラウドに保存して別のブラウザやPCから続きが使えます。'
        : licenseState === 'trial'
          ? trialAnalysisUsed
            ? 'ログイン済みです。無料体験のライフプラン分析は利用済みです。'
            : 'ログイン済みです。データ入力とライフプラン分析1回を無料で体験できます。'
          : licenseState === 'active'
            ? '利用権とプランはアカウントに紐付いています。ブラウザを変えても同じデータを利用できます。'
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
        : 'ログイン後に利用できます';

  const statusLabel = isDevUnlock ? '確認版' : STATE_LABELS[licenseState];
  const statusClass =
    isDevUnlock || licenseState === 'active'
      ? 'active'
      : licenseState === 'trial'
        ? 'inactive'
        : licenseState;
  const showLogin =
    !isDevUnlock && (licenseState === 'inactive' || licenseState === 'error');

  const handleSendCode = async () => {
    if (!email.trim() || authBusy) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await requestEmailLoginCode(email.trim());
      if (!result.ok) {
        setAuthError(result.message ?? '認証コードを送信できませんでした。');
        return;
      }
      setEmailStep('code');
      setCode('');
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : '認証コードを送信できませんでした。',
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!/^\d{6}$/.test(code) || authBusy) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await verifyEmailLoginCode(email.trim(), code);
      if (!result.ok) {
        setAuthError(result.message ?? '認証コードを確認できませんでした。');
        return;
      }
      window.location.reload();
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : '認証コードを確認できませんでした。',
      );
    } finally {
      setAuthBusy(false);
    }
  };

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
              <dd>{isDevUnlock ? 'この確認版のブラウザ内' : 'アカウントにクラウド保存'}</dd>
            </div>
          ) : null}
          <div>
            <dt>利用可能な機能</dt>
            <dd>{featureSummary}</dd>
          </div>
        </dl>

        {errorMessage && !isDevUnlock && !showLogin ? (
          <p className="license-inline-error">{errorMessage}</p>
        ) : null}

        {showLogin ? (
          <div className="license-account-login">
            <button
              type="button"
              className="plan-bar-btn plan-bar-btn--primary"
              disabled={authBusy || busy}
              onClick={startGoogleLogin}
            >
              Googleで続ける
            </button>

            <div className="license-account-login-divider" aria-hidden="true">
              <span>または</span>
            </div>

            {emailStep === 'email' ? (
              <div className="license-account-email-form">
                <label className="plan-meta-label" htmlFor="account-login-email">
                  メールアドレス
                </label>
                <input
                  id="account-login-email"
                  className="plan-meta-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  disabled={authBusy}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleSendCode();
                    }
                  }}
                  placeholder="name@example.com"
                />
                <button
                  type="button"
                  className="plan-bar-btn"
                  disabled={!email.trim() || authBusy}
                  onClick={() => void handleSendCode()}
                >
                  {authBusy ? '送信中…' : '認証コードを送信'}
                </button>
              </div>
            ) : (
              <div className="license-account-email-form">
                <p className="license-account-code-sent">
                  {email.trim()} に6桁の認証コードを送信しました。
                </p>
                <label className="plan-meta-label" htmlFor="account-login-code">
                  認証コード
                </label>
                <input
                  id="account-login-code"
                  className="plan-meta-input license-account-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  disabled={authBusy}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleVerifyCode();
                    }
                  }}
                  placeholder="123456"
                  autoFocus
                />
                <div className="license-account-email-actions">
                  <button
                    type="button"
                    className="plan-bar-btn"
                    disabled={authBusy}
                    onClick={() => {
                      setEmailStep('email');
                      setCode('');
                      setAuthError(null);
                    }}
                  >
                    メールアドレスを変更
                  </button>
                  <button
                    type="button"
                    className="plan-bar-btn plan-bar-btn--primary"
                    disabled={!/^\d{6}$/.test(code) || authBusy}
                    onClick={() => void handleVerifyCode()}
                  >
                    {authBusy ? '確認中…' : 'ログイン'}
                  </button>
                </div>
              </div>
            )}

            {authError ? (
              <p className="license-inline-error" role="alert">
                {authError}
              </p>
            ) : null}
          </div>
        ) : null}

        {!isDevUnlock && !showLogin ? (
          <div className="license-admin-card-actions">
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
                      'アカウントからログアウトしますか？',
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
