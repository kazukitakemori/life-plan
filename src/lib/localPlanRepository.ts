import { fetchAccountMe } from './account/api';
import { CloudPlanRepository } from './cloudPlanRepository';
import { isLicenseDevUnlock } from './license/devUnlock';
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

class AccountAwarePlanRepository implements PlanRepository {
  private readonly local = new LocalPlanRepository();
  private readonly cloud = new CloudPlanRepository();
  private lastMode: 'local' | 'cloud' | null = null;
  private cloudMigrationPromise: Promise<void> | null = null;

  private async resolveMode(): Promise<'local' | 'cloud'> {
    if (isLicenseDevUnlock()) return 'local';
    const account = await fetchAccountMe();
    return account.authenticated && account.entitlement?.cloudStorageEnabled
      ? 'cloud'
      : 'local';
  }

  /**
   * When cloud storage is enabled for an account, carry forward plans that
   * still exist only in this browser's IndexedDB. Existing cloud plans are
   * never overwritten automatically; D1 remains authoritative once present.
   *
   * Local copies are intentionally kept as a safety backup. They are ignored
   * while cloud storage is enabled.
   */
  private async migrateLocalPlansToCloud(): Promise<void> {
    let localPlans: PlanRecord[];
    try {
      localPlans = await this.local.listAll();
    } catch (error) {
      // Cloud access must not depend on legacy IndexedDB being available.
      console.warn('Could not inspect local plans for cloud migration', error);
      return;
    }

    if (localPlans.length === 0) return;

    const cloudPlans = await this.cloud.listAll();
    const cloudPlanIds = new Set(cloudPlans.map((plan) => plan.id));

    for (const plan of localPlans) {
      if (cloudPlanIds.has(plan.id)) continue;

      try {
        await this.cloud.save(plan);
        cloudPlanIds.add(plan.id);
      } catch (error) {
        // Another browser may have created the same plan after listAll().
        // If it now exists in D1, keep the cloud copy and continue.
        const existing = await this.cloud.get(plan.id);
        if (existing) {
          cloudPlanIds.add(plan.id);
          continue;
        }
        throw error;
      }
    }
  }

  private async repository(): Promise<PlanRepository> {
    const mode = await this.resolveMode();

    if (mode !== this.lastMode) {
      this.lastMode = mode;
      this.cloudMigrationPromise = null;
    }

    if (mode === 'cloud') {
      if (!this.cloudMigrationPromise) {
        this.cloudMigrationPromise = this.migrateLocalPlansToCloud().catch((error) => {
          this.cloudMigrationPromise = null;
          throw error;
        });
      }
      await this.cloudMigrationPromise;
      return this.cloud;
    }

    return this.local;
  }

  async listSummaries(): Promise<PlanSummary[]> {
    return (await this.repository()).listSummaries();
  }

  async listAll(): Promise<PlanRecord[]> {
    return (await this.repository()).listAll();
  }

  async get(id: string): Promise<PlanRecord | null> {
    return (await this.repository()).get(id);
  }

  async save(record: PlanRecord): Promise<PlanRecord> {
    return (await this.repository()).save(record);
  }

  async delete(id: string): Promise<void> {
    return (await this.repository()).delete(id);
  }
}

let singleton: PlanRepository | null = null;

/**
 * Compatibility entry point used by App.tsx.
 * Preview uses IndexedDB. Production uses D1 only when the account has a
 * cloud-storage entitlement; otherwise plans remain in IndexedDB.
 */
export function getLocalPlanRepository(): PlanRepository {
  if (!singleton) singleton = new AccountAwarePlanRepository();
  return singleton;
}
