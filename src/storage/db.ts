/**
 * Native Promise-based IndexedDB engine for Qiyue Ledger
 * Local-First Personal Finance Database
 */

export const DB_NAME = 'qiyue_ledger_db';
export const DB_VERSION = 3;

export const STORES = {
  SALARIES: 'salaries',
  OVERTIMES: 'overtimes',
  EXPENSES: 'expenses', // 日常生活开销与教育支出
  GIFTS: 'gifts',
  VEHICLES: 'vehicles',
  FUELS: 'fuel_records',
  MAINTENANCES: 'maintenance_records',
  SETTINGS: 'settings',
  SYNC_META: 'sync_meta',
  SYNC_QUEUE: 'sync_queue',
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or initialize IndexedDB connection
 */
export function openLedgerDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // 1. Salaries
      if (!db.objectStoreNames.contains(STORES.SALARIES)) {
        const store = db.createObjectStore(STORES.SALARIES, { keyPath: 'id' });
        store.createIndex('month', 'month', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 2. Overtimes
      if (!db.objectStoreNames.contains(STORES.OVERTIMES)) {
        const store = db.createObjectStore(STORES.OVERTIMES, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 3. Expenses (日常生活与教育支出)
      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const store = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 4. Social Gifts
      if (!db.objectStoreNames.contains(STORES.GIFTS)) {
        const store = db.createObjectStore(STORES.GIFTS, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('direction', 'direction', { unique: false });
      }

      // 4. Vehicles
      if (!db.objectStoreNames.contains(STORES.VEHICLES)) {
        db.createObjectStore(STORES.VEHICLES, { keyPath: 'id' });
      }

      // 5. Fuel Records
      if (!db.objectStoreNames.contains(STORES.FUELS)) {
        const store = db.createObjectStore(STORES.FUELS, { keyPath: 'id' });
        store.createIndex('vehicleId', 'vehicleId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }

      // 6. Maintenance Records
      if (!db.objectStoreNames.contains(STORES.MAINTENANCES)) {
        const store = db.createObjectStore(STORES.MAINTENANCES, { keyPath: 'id' });
        store.createIndex('vehicleId', 'vehicleId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }

      // 7. Settings
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // 8. Sync Meta
      if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
        db.createObjectStore(STORES.SYNC_META, { keyPath: 'id' });
      }

      // 9. Sync Queue
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

/**
 * Generic query to get all items from an object store
 */
export async function dbGetAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openLedgerDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic query to get item by primary key
 */
export async function dbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openLedgerDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic put item
 */
export async function dbPut<T>(storeName: StoreName, item: T): Promise<void> {
  const db = await openLedgerDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic batch put items
 */
export async function dbBatchPut<T>(storeName: StoreName, items: T[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openLedgerDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const it of items) {
      store.put(it);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Generic delete item by key
 */
export async function dbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openLedgerDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic clear store
 */
export async function dbClear(storeName: StoreName): Promise<void> {
  const db = await openLedgerDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
