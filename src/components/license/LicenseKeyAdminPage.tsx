import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  deleteLicenseKey,
  generateLicenseKeys,
  listLicenseKeys,
  setLicenseKeyStatus,
  verifyAdminSecret,
} from '../../lib/license/adminApi';
import {
  clearAdminSecret,
  loadAdminSecret,
  saveAdminSecret,
} from '../../lib/license/adminStorage';
import type { LicenseAdminGeneratedKey, LicenseAdminKeySummary } from '../../types/license';
import {
  LICENSE_EDITION_LABELS,
  type LicenseEdition,
} from '../../types/licenseEdition';

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

function statusLabel(status: LicenseAdminKeySummary['status']): string {
  return status === 'active' ? '有効' : '無効';
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback below
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function LicenseKeyTable({
  keys,
  busyId,
  onCopy,
  onSetStatus,
  onDelete,
}: {
  keys: LicenseAdminKeySummary[];
  busyId: string | null;
  onCopy: (key: string) => void;
  onSetStatus: (entry: LicenseAdminKeySummary, status: 'active' | 'revoked') => void;
  onDelete: (entry: LicenseAdminKeySummary) => void;
}) {
  if (keys.length === 0) {
    return <p className="license-key-admin-empty">まだキーは発行されていません。</p>;
  }

  return (
    <div className="license-key-admin-table-wrap">
      <table className="license-key-admin-table">
        <thead>
          <tr>
            <th>ライセンスキー</th>
            <th>購入者名</th>
            <th>状態</th>
            <th>登録数</th>
            <th>発行日</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((entry) => {
            const displayKey = entry.key_display ?? entry.key_hint;
            const copyValue = entry.key_display ?? '';
            return (
              <tr key={entry.id}>
                <td>
                  <div className="license-key-admin-table-key">
                    <code>{displayKey}</code>
                    {copyValue ? (
                      <button
                        type="button"
                        className="plan-bar-btn plan-bar-btn--compact"
                        onClick={() => onCopy(copyValue)}
                      >
                        コピー
                      </button>
                    ) : null}
                  </div>
                </td>
                <td>{entry.note?.trim() || '—'}</td>
                <td>
                  <span
                    className={`license-key-admin-status license-key-admin-status--${entry.status}`}
                  >
                    {statusLabel(entry.status)}
                  </span>
                </td>
                <td>
                  {entry.device_count} / {entry.max_devices}
                </td>
                <td>{formatDateTime(entry.created_at)}</td>
                <td>
                  <div className="license-key-admin-row-actions">
                    {entry.status === 'active' ? (
                      <button
                        type="button"
                        className="plan-bar-btn plan-bar-btn--danger"
                        disabled={busyId === entry.id}
                        onClick={() => onSetStatus(entry, 'revoked')}
                      >
                        {busyId === entry.id ? '処理中…' : '無効化'}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="plan-bar-btn"
                          disabled={busyId === entry.id}
                          onClick={() => onSetStatus(entry, 'active')}
                        >
                          {busyId === entry.id ? '処理中…' : '有効化'}
                        </button>
                        <button
                          type="button"
                          className="plan-bar-btn plan-bar-btn--danger"
                          disabled={busyId === entry.id}
                          onClick={() => onDelete(entry)}
                        >
                          {busyId === entry.id ? '処理中…' : '削除'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LicenseKeyAdminPage() {
  const [adminSecret, setAdminSecret] = useState<string | null>(() => loadAdminSecret());
  const [passwordInput, setPasswordInput] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [customerNote, setCustomerNote] = useState('');
  const [keyEdition, setKeyEdition] = useState<LicenseEdition>('personal');
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [issuedKeys, setIssuedKeys] = useState<LicenseAdminGeneratedKey[]>([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const [keys, setKeys] = useState<LicenseAdminKeySummary[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const personalKeys = useMemo(
    () => keys.filter((entry) => (entry.edition ?? 'personal') === 'personal'),
    [keys],
  );
  const advisorKeys = useMemo(
    () => keys.filter((entry) => entry.edition === 'advisor'),
    [keys],
  );

  const refreshList = useCallback(async (secret: string) => {
    setListBusy(true);
    setListError(null);
    try {
      const body = await listLicenseKeys(secret);
      if (!body.ok || !body.keys) {
        setListError('一覧の取得に失敗しました。');
        return;
      }
      setKeys(body.keys);
    } catch {
      setListError('サーバーに接続できませんでした。');
    } finally {
      setListBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!adminSecret) return;
    void refreshList(adminSecret);
  }, [adminSecret, refreshList]);

  const handleLogin = async () => {
    const secret = passwordInput.trim();
    if (!secret) {
      setLoginError('管理用パスワードを入力してください。');
      return;
    }

    setLoginBusy(true);
    setLoginError(null);
    try {
      const ok = await verifyAdminSecret(secret);
      if (!ok) {
        setLoginError('パスワードが正しくありません。');
        return;
      }
      saveAdminSecret(secret);
      setAdminSecret(secret);
      setPasswordInput('');
    } catch {
      setLoginError('サーバーに接続できませんでした。');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = () => {
    clearAdminSecret();
    setAdminSecret(null);
    setIssuedKeys([]);
    setKeys([]);
    setCustomerNote('');
    setGenerateError(null);
    setListError(null);
    setCopyMessage(null);
  };

  const handleGenerate = async () => {
    if (!adminSecret) return;

    setGenerateBusy(true);
    setGenerateError(null);
    setIssuedKeys([]);
    setCopyMessage(null);

    try {
      const body = await generateLicenseKeys(adminSecret, {
        count: 1,
        note: customerNote,
        edition: keyEdition,
      });
      if (!body.ok || !body.keys?.length) {
        setGenerateError('キーの発行に失敗しました。');
        return;
      }
      setIssuedKeys(body.keys);
      await refreshList(adminSecret);
    } catch {
      setGenerateError('サーバーに接続できませんでした。');
    } finally {
      setGenerateBusy(false);
    }
  };

  const handleCopyKey = async (key: string) => {
    const ok = await copyTextToClipboard(key);
    setCopyMessage(
      ok
        ? 'キーをコピーしました。'
        : 'コピーできませんでした。キーを手動で選択してコピーしてください。',
    );
  };

  const handleSetStatus = async (
    entry: LicenseAdminKeySummary,
    status: 'active' | 'revoked',
  ) => {
    if (!adminSecret) return;
    const label = entry.note?.trim() || entry.key_hint;
    const confirmed = window.confirm(
      status === 'revoked'
        ? `「${label}」のキーを無効にしますか？\n\n無効のあいだは使えません。あとから有効に戻せます。`
        : `「${label}」のキーを有効に戻しますか？`,
    );
    if (!confirmed) return;

    setActionBusyId(entry.id);
    try {
      const body = await setLicenseKeyStatus(adminSecret, entry.id, status);
      if (!body.ok) {
        window.alert(body.message ?? '状態の変更に失敗しました。');
        return;
      }
      await refreshList(adminSecret);
    } catch {
      window.alert('サーバーに接続できませんでした。');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDelete = async (entry: LicenseAdminKeySummary) => {
    if (!adminSecret) return;
    const label = entry.note?.trim() || entry.key_hint;
    const confirmed = window.confirm(
      `「${label}」の無効化されたキーを削除しますか？\n\nこの操作は取り消せません。`,
    );
    if (!confirmed) return;

    setActionBusyId(entry.id);
    try {
      const body = await deleteLicenseKey(adminSecret, entry.id);
      if (!body.ok) {
        window.alert(body.message ?? '削除に失敗しました。');
        return;
      }
      await refreshList(adminSecret);
    } catch {
      window.alert('サーバーに接続できませんでした。');
    } finally {
      setActionBusyId(null);
    }
  };

  if (!adminSecret) {
    return (
      <div className="license-key-admin">
        <div className="license-key-admin-shell">
          <header className="license-key-admin-header">
            <h1 className="license-key-admin-title">ライセンスキー管理</h1>
            <p className="license-key-admin-lead">
              振込確認後、ここからお客様へ渡すキーを発行できます。
            </p>
          </header>

          <section className="license-key-admin-card">
            <h2 className="license-key-admin-card-title">ログイン</h2>
            <p className="license-key-admin-card-desc">
              PCに保存している管理用パスワード（<code>.license-secrets.local.txt</code> の
              ADMIN_SECRET）を入力してください。
            </p>

            <label className="plan-meta-label" htmlFor="license-admin-password">
              管理用パスワード
            </label>
            <input
              id="license-admin-password"
              className="plan-meta-input"
              type="password"
              autoComplete="current-password"
              value={passwordInput}
              disabled={loginBusy}
              onChange={(event) => setPasswordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleLogin();
                }
              }}
            />

            {loginError ? <p className="license-inline-error">{loginError}</p> : null}

            <div className="license-key-admin-actions">
              <button
                type="button"
                className="plan-bar-btn plan-bar-btn--primary"
                disabled={loginBusy}
                onClick={() => {
                  void handleLogin();
                }}
              >
                {loginBusy ? '確認中…' : 'ログイン'}
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="license-key-admin">
      <div className="license-key-admin-shell">
        <header className="license-key-admin-header">
          <div className="license-key-admin-header-row">
            <div>
              <h1 className="license-key-admin-title">ライセンスキー管理</h1>
              <p className="license-key-admin-lead">
                お客様1人につき、キーを1つ発行してメールでお渡しください。
              </p>
            </div>
            <button type="button" className="plan-bar-btn" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        </header>

        <section className="license-key-admin-card">
          <h2 className="license-key-admin-card-title">新しいキーを発行</h2>
          <p className="license-key-admin-card-desc">
            キーの文字列は自動で作られます。購入者名は管理用メモとして残ります（アプリ内には表示されません）。
          </p>

          <label className="plan-meta-label" htmlFor="license-admin-edition">
            プラン種別
          </label>
          <select
            id="license-admin-edition"
            className="plan-meta-input"
            value={keyEdition}
            disabled={generateBusy}
            onChange={(event) => setKeyEdition(event.target.value as LicenseEdition)}
          >
            <option value="personal">{LICENSE_EDITION_LABELS.personal}</option>
            <option value="advisor">{LICENSE_EDITION_LABELS.advisor}</option>
          </select>

          <label className="plan-meta-label" htmlFor="license-admin-customer">
            購入者名（メモ）
          </label>
          <input
            id="license-admin-customer"
            className="plan-meta-input"
            type="text"
            placeholder="例：山田太郎様"
            value={customerNote}
            disabled={generateBusy}
            onChange={(event) => setCustomerNote(event.target.value)}
          />

          {generateError ? <p className="license-inline-error">{generateError}</p> : null}

          <div className="license-key-admin-actions">
            <button
              type="button"
              className="plan-bar-btn plan-bar-btn--primary"
              disabled={generateBusy}
              onClick={() => {
                void handleGenerate();
              }}
            >
              {generateBusy ? '発行中…' : 'キーを発行'}
            </button>
          </div>

          {issuedKeys.length > 0 ? (
            <div className="license-key-admin-issued">
              <p className="license-key-admin-issued-label">発行したキー</p>
              {issuedKeys.map((entry) => (
                <div key={entry.key} className="license-key-admin-issued-item">
                  <code className="license-key-admin-issued-code">{entry.key}</code>
                  <button
                    type="button"
                    className="plan-bar-btn plan-bar-btn--primary"
                    onClick={() => {
                      void handleCopyKey(entry.key);
                    }}
                  >
                    コピー
                  </button>
                </div>
              ))}
              <p className="license-key-admin-issued-note">
                発行したキーは下の一覧にも表示されます。メール送信前にコピーしてください。
              </p>
            </div>
          ) : null}
          {copyMessage ? <p className="license-key-admin-copy-message">{copyMessage}</p> : null}
        </section>

        <section className="license-key-admin-card">
          <div className="license-key-admin-list-head">
            <h2 className="license-key-admin-card-title">
              {LICENSE_EDITION_LABELS.personal}
            </h2>
            <button
              type="button"
              className="plan-bar-btn"
              disabled={listBusy}
              onClick={() => {
                void refreshList(adminSecret);
              }}
            >
              {listBusy ? '更新中…' : '一覧を更新'}
            </button>
          </div>
          {listError ? <p className="license-inline-error">{listError}</p> : null}
          <LicenseKeyTable
            keys={personalKeys}
            busyId={actionBusyId}
            onCopy={(key) => {
              void handleCopyKey(key);
            }}
            onSetStatus={(entry, status) => {
              void handleSetStatus(entry, status);
            }}
            onDelete={(entry) => {
              void handleDelete(entry);
            }}
          />
        </section>

        <section className="license-key-admin-card">
          <div className="license-key-admin-list-head">
            <h2 className="license-key-admin-card-title">
              {LICENSE_EDITION_LABELS.advisor}
            </h2>
          </div>
          <LicenseKeyTable
            keys={advisorKeys}
            busyId={actionBusyId}
            onCopy={(key) => {
              void handleCopyKey(key);
            }}
            onSetStatus={(entry, status) => {
              void handleSetStatus(entry, status);
            }}
            onDelete={(entry) => {
              void handleDelete(entry);
            }}
          />
        </section>
      </div>
    </div>
  );
}

export function isLicenseKeyAdminRoute(): boolean {
  const path = window.location.pathname.replace(/\/$/, '');
  return path === '/keys' || window.location.hash === '#/keys';
}
