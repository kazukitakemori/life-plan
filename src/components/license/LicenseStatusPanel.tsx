interface LicenseStatusPanelProps {
  licenseState: 'checking' | 'inactive' | 'active' | 'error';
  keyHint?: string | null;
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
  active: 'この端末ではライフプラン分析を利用できます。',
  error: 'ライセンスサーバーに接続できませんでした。',
} as const;

export function LicenseStatusPanel({
  licenseState,
  keyHint,
  deviceLabel,
  errorMessage,
  onManageLicense,
  onReleaseDevice,
  busy = false,
}: LicenseStatusPanelProps) {
  return (
    <section className="license-admin-card" aria-label="ライセンス">
      <div className="license-admin-card-head">
        <div>
          <h3 className="license-admin-card-title">ライセンス</h3>
          <p className="license-admin-card-desc">{STATE_DESCRIPTIONS[licenseState]}</p>
        </div>
        <span className={`license-status-badge license-status-badge--${licenseState}`}>
          {STATE_LABELS[licenseState]}
        </span>
      </div>

      <dl className="license-admin-card-grid">
        <div>
          <dt>この端末</dt>
          <dd>{deviceLabel}</dd>
        </div>
        <div>
          <dt>登録キー</dt>
          <dd>{keyHint ?? '未登録'}</dd>
        </div>
        <div>
          <dt>利用可能な機能</dt>
          <dd>
            {licenseState === 'active'
              ? 'データ入力 / ライフプラン分析'
              : 'データ入力のみ'}
          </dd>
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
            この端末の登録を解除
          </button>
        ) : null}
      </div>
    </section>
  );
}
