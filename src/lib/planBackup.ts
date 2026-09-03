import { migratePlanRecord } from './planDocument';
import type { PlanRecord } from '../types/plan';

/** ブラウザ間でプランを移すためのバックアップ形式 */
export const PLAN_BACKUP_FORMAT = 'life-plan-backup' as const;
export const PLAN_BACKUP_VERSION = 1;

export interface PlanBackupFile {
  format: typeof PLAN_BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  plans: PlanRecord[];
}

export type PlanImportConflictPolicy = 'keep_newer' | 'prefer_incoming' | 'prefer_existing';

export interface PlanImportResult {
  added: number;
  updated: number;
  skipped: number;
  totalInFile: number;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isPlanRecordLike(value: unknown): value is PlanRecord {
  if (!isRecordLike(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.customerName === 'string' &&
    isRecordLike(value.payload)
  );
}

export function buildPlanBackup(
  plans: PlanRecord[],
  now = new Date(),
): PlanBackupFile {
  return {
    format: PLAN_BACKUP_FORMAT,
    version: PLAN_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    plans: plans.map((plan) => migratePlanRecord(plan)),
  };
}

export function serializePlanBackup(backup: PlanBackupFile): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function parsePlanBackupJson(text: string): PlanBackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON として読み込めませんでした。ファイル内容を確認してください。');
  }

  if (!isRecordLike(parsed)) {
    throw new Error('バックアップ形式が不正です。');
  }

  if (parsed.format !== PLAN_BACKUP_FORMAT) {
    throw new Error(
      'このファイルはライフプランのバックアップではありません。',
    );
  }

  if (typeof parsed.version !== 'number' || !Number.isFinite(parsed.version)) {
    throw new Error('バックアップのバージョン情報が不正です。');
  }

  if (!Array.isArray(parsed.plans)) {
    throw new Error('バックアップに plans 配列がありません。');
  }

  const plans: PlanRecord[] = [];
  for (const item of parsed.plans) {
    if (!isPlanRecordLike(item)) {
      throw new Error('バックアップ内に不正なプランデータがあります。');
    }
    plans.push(migratePlanRecord(item));
  }

  return {
    format: PLAN_BACKUP_FORMAT,
    version: parsed.version,
    exportedAt:
      typeof parsed.exportedAt === 'string'
        ? parsed.exportedAt
        : new Date(0).toISOString(),
    plans,
  };
}

function pickWinner(
  existing: PlanRecord,
  incoming: PlanRecord,
  policy: PlanImportConflictPolicy,
): 'existing' | 'incoming' {
  if (policy === 'prefer_existing') return 'existing';
  if (policy === 'prefer_incoming') return 'incoming';
  return incoming.updatedAt.localeCompare(existing.updatedAt) >= 0
    ? 'incoming'
    : 'existing';
}

/**
 * 既存プランと取り込みプランを統合する。
 * 同一 id は conflictPolicy に従い、それ以外は追加する。
 */
export function mergePlanRecords(
  existing: PlanRecord[],
  incoming: PlanRecord[],
  policy: PlanImportConflictPolicy = 'keep_newer',
): {
  next: PlanRecord[];
  toSave: PlanRecord[];
  result: PlanImportResult;
} {
  const byId = new Map<string, PlanRecord>();
  for (const plan of existing) {
    byId.set(plan.id, migratePlanRecord(plan));
  }

  const toSave: PlanRecord[] = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of incoming) {
    const plan = migratePlanRecord(raw);
    const current = byId.get(plan.id);
    if (!current) {
      byId.set(plan.id, plan);
      toSave.push(plan);
      added += 1;
      continue;
    }
    const winner = pickWinner(current, plan, policy);
    if (winner === 'incoming') {
      byId.set(plan.id, plan);
      toSave.push(plan);
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    next: [...byId.values()],
    toSave,
    result: {
      added,
      updated,
      skipped,
      totalInFile: incoming.length,
    },
  };
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function formatBackupFilename(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `life-plan-backup-${y}${m}${d}-${hh}${mm}.json`;
}

export function formatImportResultMessage(result: PlanImportResult): string {
  const parts = [
    `取り込み完了（ファイル内 ${result.totalInFile} 件）`,
    `追加 ${result.added} 件`,
    `更新 ${result.updated} 件`,
    `スキップ ${result.skipped} 件`,
  ];
  return parts.join('\n');
}
