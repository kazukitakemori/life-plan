import { migratePlanRecord, toPlanSummary } from './planDocument';
import type { PlanRepository } from './planRepository';
import type { PlanRecord, PlanSummary } from '../types/plan';

const DB_NAME = 'life-plan';
const DB_VERSION = 1;
const STORE_PLANS = 'plans';

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
      await reqToPromise(store.put(toSave));
      await txDone(tx);
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
      await reqToPromise(store.delete(id));
      await txDone(tx);
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
