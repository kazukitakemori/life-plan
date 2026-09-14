import { migratePlanRecord, toPlanSummary } from './planDocument';
import type { PlanRepository } from './planRepository';
import type { PlanRecord, PlanSummary } from '../types/plan';

const DB_NAME = 'life-plan';
const DB_VERSION = 1;
const STORE_PLANS = 'plans';
const UNDO_STORAGE_KEY = 'life-plan:undo-history:v1';
const MAX_UNDO_HISTORY = 20;
const USER_MUTATION_WINDOW_MS = 15_000;

export const LOCAL_PLAN_UNDO_HISTORY_EVENT = 'life-plan:undo-history-changed';

type LocalPlanUndoEntry =
  | { kind: 'restore'; record: PlanRecord }
  | { kind: 'delete'; id: string };

let lastUserMutationAt = 0;

if (typeof window !== 'undefined') {
  const noteUserMutation = () => {
    lastUserMutationAt = Date.now();
  };
  window.addEventListener('input', noteUserMutation, true);
  window.addEventListener('change', noteUserMutation, true);
  window.addEventListener('click', noteUserMutation, true);
}

function shouldRecordUndo(): boolean {
  return Date.now() - lastUserMutationAt <= USER_MUTATION_WINDOW_MS;
}

function readUndoHistory(): LocalPlanUndoEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(UNDO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is LocalPlanUndoEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Partial<LocalPlanUndoEntry> & {
        kind?: unknown;
        id?: unknown;
        record?: unknown;
      };
      if (candidate.kind === 'delete') {
        return typeof candidate.id === 'string';
      }
      if (candidate.kind === 'restore') {
        return Boolean(candidate.record && typeof candidate.record === 'object');
      }
      return false;
    });
  } catch {
    return [];
  }
}

function notifyUndoHistoryChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOCAL_PLAN_UNDO_HISTORY_EVENT));
}

function writeUndoHistory(history: LocalPlanUndoEntry[]): void {
  if (typeof window === 'undefined') return;
  let next = history.slice(-MAX_UNDO_HISTORY);
  while (next.length > 0) {
    try {
      window.sessionStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(next));
      notifyUndoHistoryChanged();
      return;
    } catch {
      next = next.slice(1);
    }
  }
  try {
    window.sessionStorage.removeItem(UNDO_STORAGE_KEY);
  } catch {
    // sessionStorage が使えない環境では Undo 履歴だけ無効化する。
  }
  notifyUndoHistoryChanged();
}

function pushUndoEntry(entry: LocalPlanUndoEntry): void {
  if (!shouldRecordUndo()) return;
  writeUndoHistory([...readUndoHistory(), entry]);
}

export function hasLocalPlanUndo(): boolean {
  return readUndoHistory().length > 0;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PLANS)) {
        const store = db.createObjectStore(STORE_PLANS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('customerName', 'customerName', { unique: false });
      }
    };
  });
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB tx aborted'));
  });
}

export async function undoLastLocalPlanChange(): Promise<boolean> {
  const history = readUndoHistory();
  const entry = history.at(-1);
  if (!entry) return false;

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_PLANS, 'readwrite');
    const store = tx.objectStore(STORE_PLANS);
    if (entry.kind === 'restore') {
      await reqToPromise(store.put(migratePlanRecord(entry.record)));
    } else {
      await reqToPromise(store.delete(entry.id));
    }
    await txDone(tx);
    writeUndoHistory(history.slice(0, -1));
    return true;
  } finally {
    db.close();
  }
}

export class LocalPlanRepository implements PlanRepository {
  async listSummaries(): Promise<PlanSummary[]> {
    const records = await this.listAll();
    return records
      .map((record) => toPlanSummary(record))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listAll(): Promise<PlanRecord[]> {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PLANS, 'readonly');
      const store = tx.objectStore(STORE_PLANS);
      const records = (await reqToPromise(store.getAll())) as PlanRecord[];
      await txDone(tx);
      return records.map((record) => migratePlanRecord(record));
    } finally {
      db.close();
    }
  }

  async get(id: string): Promise<PlanRecord | null> {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PLANS, 'readonly');
      const store = tx.objectStore(STORE_PLANS);
      const record = (await reqToPromise(store.get(id))) as
        | PlanRecord
        | undefined;
      await txDone(tx);
      if (!record) return null;
      return migratePlanRecord(record);
    } finally {
      db.close();
    }
  }

  async save(record: PlanRecord): Promise<PlanRecord> {
    const toSave = migratePlanRecord(record);
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PLANS, 'readwrite');
      const store = tx.objectStore(STORE_PLANS);
      const previous = (await reqToPromise(store.get(toSave.id))) as
        | PlanRecord
        | undefined;
      await reqToPromise(store.put(toSave));
      await txDone(tx);
      if (previous) {
        pushUndoEntry({ kind: 'restore', record: migratePlanRecord(previous) });
      } else {
        pushUndoEntry({ kind: 'delete', id: toSave.id });
      }
      return toSave;
    } finally {
      db.close();
    }
  }

  async delete(id: string): Promise<void> {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_PLANS, 'readwrite');
      const store = tx.objectStore(STORE_PLANS);
      const previous = (await reqToPromise(store.get(id))) as
        | PlanRecord
        | undefined;
      await reqToPromise(store.delete(id));
      await txDone(tx);
      if (previous) {
        pushUndoEntry({ kind: 'restore', record: migratePlanRecord(previous) });
      }
    } finally {
      db.close();
    }
  }
}

let singleton: LocalPlanRepository | null = null;

export function getLocalPlanRepository(): PlanRepository {
  if (!singleton) singleton = new LocalPlanRepository();
  return singleton;
}
