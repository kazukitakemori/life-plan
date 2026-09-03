import { useMemo, useRef, useState } from 'react';

import {
  formatPlanDisplayName,
  getDefaultCreateStatus,
  getPlanStatusLabel,
  PLAN_STATUS_OPTIONS,
  type PlanCreateInput,
  type PlanEditInput,
  type PlanMetaInput,
  type PlanStatus,
  type PlanSummary,
} from '../../types/plan';
import {
  getDefaultPlanPurposes,
  getPlanPurposeShortLabel,
  getPlanPurposesShortLabel,
} from '../../lib/planPurpose';
import type { LicenseEntitlements } from '../../types/licenseEdition';
import { canCreatePlan } from '../../types/licenseEdition';
import { PlanCreateModal } from './PlanMetaModal';
import { PlanDeleteConfirmModal } from './PlanDeleteConfirmModal';
import { PlanMetaModal } from './PlanMetaModal';

interface PlanAdminViewProps {
  summaries: PlanSummary[];
  currentPlanId: string | null;
  transferBusy?: boolean;
  entitlements: LicenseEntitlements;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: (meta: PlanCreateInput) => void;
  onUpdateMeta: (id: string, meta: PlanEditInput) => void;
  onExportAll: () => void;
  onImportFile: (file: File) => void;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

const EMPTY_META: PlanMetaInput = {
  customerName: '',
  phone: '',
  email: '',
  note: '',
  status: getDefaultCreateStatus(),
};

export function PlanAdminView({
  summaries,
  currentPlanId,
  transferBusy = false,
  entitlements,
  onOpen,
  onDelete,
  onCreate,
  onUpdateMeta,
  onExportAll,
  onImportFile,
}: PlanAdminViewProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlanStatus | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlanSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanSummary | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const canCreate = canCreatePlan(entitlements, summaries.length);
  const showToolbar =
    entitlements.allowMultiPlanAdmin && summaries.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.customerName.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        getPlanPurposesShortLabel(item.purposes).toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter, summaries]);

  const pageDescription = entitlements.allowMultiPlanAdmin
    ? 'プランを一覧・編集し、入力画面を開きます。ブラウザをまたぐ場合は書き出し／読み込みでまとめられます。'
    : 'ご自身のプランを編集し、入力画面を開きます。一般向けライセンスではプランは1件までです。';

  const emptyDescription = entitlements.allowMultiPlanAdmin
    ? '新規作成からはじめるか、他のブラウザで書き出した JSON ファイルを読み込んでください。入力内容は自動で保存されます。'
    : '新規作成からはじめてください。入力内容は自動で保存されます。';

  return (
    <div className="plan-admin">
      <div className="plan-admin-header">
        <div>
          <h2 className="plan-admin-title">プラン管理</h2>
          <p className="plan-admin-desc">{pageDescription}</p>
        </div>
        <div className="plan-admin-header-actions">
          <button
            type="button"
            className="plan-bar-btn"
            disabled={transferBusy || summaries.length === 0}
            title="このブラウザ内の全プランを JSON ファイルに書き出します"
            onClick={() => onExportAll()}
          >
            書き出し
          </button>
          {entitlements.allowMultiPlanAdmin ? (
            <button
              type="button"
              className="plan-bar-btn"
              disabled={transferBusy}
              title="他ブラウザで書き出した JSON を読み込み、このブラウザへ統合します"
              onClick={() => importInputRef.current?.click()}
            >
              読み込み
            </button>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              className="plan-bar-btn plan-bar-btn--primary"
              disabled={transferBusy}
              onClick={() => setCreateOpen(true)}
            >
              新規作成
            </button>
          ) : null}
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="plan-admin-import-input"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onImportFile(file);
            }}
          />
        </div>
      </div>

      {showToolbar && (
        <div className="plan-admin-toolbar">
          <input
            type="search"
            className="plan-open-search"
            placeholder={
              entitlements.showCrmFields
                ? 'お名前・電話・メールで検索'
                : 'お名前で検索'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {entitlements.showPlanStatusFilter ? (
            <select
              className="plan-admin-status-filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as PlanStatus | 'all')
              }
              aria-label="ステータスで絞り込み"
            >
              <option value="all">すべてのステータス</option>
              {PLAN_STATUS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      )}

      {summaries.length === 0 ? (
        <div className="plan-admin-empty">
          <h3 className="plan-admin-empty-title">プランがまだありません</h3>
          <p className="plan-admin-empty-desc">{emptyDescription}</p>
          <div className="plan-admin-empty-actions">
            {entitlements.allowMultiPlanAdmin ? (
              <button
                type="button"
                className="plan-bar-btn"
                disabled={transferBusy}
                onClick={() => importInputRef.current?.click()}
              >
                バックアップを読み込む
              </button>
            ) : null}
            <button
              type="button"
              className="plan-bar-btn plan-bar-btn--primary plan-admin-empty-cta"
              disabled={transferBusy || !canCreate}
              onClick={() => setCreateOpen(true)}
            >
              新規作成してはじめる
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="plan-open-empty">条件に一致するプランがありません。</p>
      ) : (
        <div className="plan-admin-table-wrap">
          <table className="plan-admin-table">
            <thead>
              <tr>
                <th>お名前</th>
                <th>目的</th>
                <th>ステータス</th>
                <th>更新日時</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isCurrent = item.id === currentPlanId;
                return (
                  <tr
                    key={item.id}
                    className={isCurrent ? 'is-current' : undefined}
                  >
                    <td>
                      <div className="plan-admin-name">
                        <span className="plan-admin-name-text">
                          {formatPlanDisplayName(item.customerName, {
                            honorific: entitlements.showHonorific,
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="plan-admin-purpose-cell">
                      <div className="plan-admin-purpose-list">
                        {item.purposes.map((purpose) => (
                          <span key={purpose} className="plan-admin-purpose">
                            {getPlanPurposeShortLabel(purpose)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="plan-admin-status-cell">
                      <span
                        className={`plan-admin-status plan-admin-status--${item.status}`}
                        title={
                          item.status === 'in_progress'
                            ? '入力・編集中のプラン'
                            : 'ライフプラン分析を実行済みのプラン'
                        }
                      >
                        {getPlanStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="plan-admin-date">
                      {formatUpdatedAt(item.updatedAt)}
                    </td>
                    <td className="plan-admin-actions-cell">
                      <div className="plan-admin-row-actions">
                        <button
                          type="button"
                          className="plan-bar-btn plan-bar-btn--primary"
                          title="入力画面を開きます"
                          onClick={() => onOpen(item.id)}
                        >
                          入力画面を開く
                        </button>
                        <button
                          type="button"
                          className="plan-bar-btn"
                          title={
                            entitlements.showCrmFields
                              ? '目的・お名前・連絡先・ステータス・メモを編集します'
                              : '目的・お名前・メモを編集します'
                          }
                          onClick={() => setEditTarget(item)}
                        >
                          プラン情報
                        </button>
                        {entitlements.allowMultiPlanAdmin ? (
                          <button
                            type="button"
                            className="plan-bar-btn plan-bar-btn--danger"
                            title="このプランを削除します"
                            onClick={() => setDeleteTarget(item)}
                          >
                            削除
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PlanCreateModal
        open={createOpen}
        title="新規プラン"
        confirmLabel="作成して開く"
        initial={EMPTY_META}
        showCrmFields={entitlements.showCrmFields}
        onClose={() => setCreateOpen(false)}
        onConfirm={(meta) => {
          setCreateOpen(false);
          onCreate(meta);
        }}
      />

      <PlanMetaModal
        open={editTarget != null}
        title="プラン情報の編集"
        confirmLabel="更新"
        initial={
          editTarget
            ? {
                customerName: editTarget.customerName,
                phone: editTarget.phone,
                email: editTarget.email,
                note: editTarget.note,
                status: editTarget.status,
                purposes: editTarget.purposes,
              }
            : {
                ...EMPTY_META,
                purposes: getDefaultPlanPurposes(),
              }
        }
        showCrmFields={entitlements.showCrmFields}
        onClose={() => setEditTarget(null)}
        onConfirm={(meta) => {
          if (!editTarget) return;
          const id = editTarget.id;
          setEditTarget(null);
          onUpdateMeta(id, meta);
        }}
      />

      <PlanDeleteConfirmModal
        open={deleteTarget != null}
        customerName={deleteTarget?.customerName ?? ''}
        showHonorific={entitlements.showHonorific}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          onDelete(id);
        }}
      />
    </div>
  );
}
