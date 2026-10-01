import { LedgerFullData } from '../types';
import { generateInitialSampleData } from '../utils/storage';
import { dbBatchPut, dbClear, dbGetAll, STORES } from './db';
import { fuelRepository } from './repositories/fuelRepository';
import { expenseRepository } from './repositories/expenseRepository';
import { giftRepository } from './repositories/giftRepository';
import { maintenanceRepository } from './repositories/maintenanceRepository';
import { overtimeRepository } from './repositories/overtimeRepository';
import { salaryRepository } from './repositories/salaryRepository';
import { settingsRepository } from './repositories/settingsRepository';
import { syncMetaRepository } from './repositories/syncMetaRepository';
import { vehicleRepository } from './repositories/vehicleRepository';

const LOCAL_STORAGE_KEY = 'qiyue_ledger_v1';
const MIGRATION_FLAG_KEY = 'qiyue_indexeddb_migrated_v2';

/**
 * Check if IndexedDB is populated
 */
async function isIndexedDBPopulated(): Promise<boolean> {
  const [salaries, vehicles] = await Promise.all([
    dbGetAll(STORES.SALARIES),
    dbGetAll(STORES.VEHICLES),
  ]);
  return salaries.length > 0 || vehicles.length > 0;
}

/**
 * Migrate legacy LocalStorage data into IndexedDB
 */
export async function migrateFromLocalStorageIfNeeded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 若已经完成初始化或用户已主动清空数据，切勿重复注入或重新生成示例数据
  const isMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
  if (isMigrated === 'true') {
    return false;
  }

  const isPopulated = await isIndexedDBPopulated();
  if (isPopulated) {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return false;
  }

  // Check if legacy LocalStorage data exists
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed: LedgerFullData = JSON.parse(raw);
      if (parsed.salaries || parsed.vehicles || parsed.overtimes) {
        // Save to IndexedDB
        if (parsed.salaries) await salaryRepository.batchSave(parsed.salaries);
        if (parsed.overtimes) await overtimeRepository.batchSave(parsed.overtimes);
        if (parsed.expenses) await expenseRepository.batchSave(parsed.expenses);
        if (parsed.gifts) await giftRepository.batchSave(parsed.gifts);
        if (parsed.vehicles) await vehicleRepository.batchSave(parsed.vehicles);
        if (parsed.fuels) await fuelRepository.batchSave(parsed.fuels);
        if (parsed.maintenances) await maintenanceRepository.batchSave(parsed.maintenances);
        if (parsed.settings) await settingsRepository.saveSettings(parsed.settings);

        await syncMetaRepository.getSyncMeta();
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        return true;
      }
    }
  } catch (err) {
    console.warn('Failed to parse legacy LocalStorage data:', err);
  }

  // If no LocalStorage data either, seed initial sample data
  const sample = generateInitialSampleData();
  await saveAllToIndexedDB(sample);
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  return true;
}

/**
 * Load complete dataset from IndexedDB
 */
export async function loadAllFromIndexedDB(): Promise<LedgerFullData> {
  await migrateFromLocalStorageIfNeeded();

  const [
    salaries,
    overtimes,
    expenses,
    gifts,
    vehicles,
    fuels,
    maintenances,
    settings,
    syncMeta,
  ] = await Promise.all([
    salaryRepository.getAll(),
    overtimeRepository.getAll(),
    expenseRepository.getAll(),
    giftRepository.getAll(),
    vehicleRepository.getAll(),
    fuelRepository.getAll(),
    maintenanceRepository.getAll(),
    settingsRepository.getSettings(),
    syncMetaRepository.getSyncMeta(),
  ]);

  return {
    salaries,
    overtimes,
    expenses,
    gifts,
    vehicles,
    fuels,
    maintenances,
    settings,
    syncMeta,
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Save complete dataset into IndexedDB
 */
export async function saveAllToIndexedDB(data: LedgerFullData): Promise<void> {
  await Promise.all([
    dbClear(STORES.SALARIES),
    dbClear(STORES.OVERTIMES),
    dbClear(STORES.EXPENSES),
    dbClear(STORES.GIFTS),
    dbClear(STORES.VEHICLES),
    dbClear(STORES.FUELS),
    dbClear(STORES.MAINTENANCES),
  ]);

  await Promise.all([
    dbBatchPut(STORES.SALARIES, data.salaries || []),
    dbBatchPut(STORES.OVERTIMES, data.overtimes || []),
    dbBatchPut(STORES.EXPENSES, data.expenses || []),
    dbBatchPut(STORES.GIFTS, data.gifts || []),
    dbBatchPut(STORES.VEHICLES, data.vehicles || []),
    dbBatchPut(STORES.FUELS, data.fuels || []),
    dbBatchPut(STORES.MAINTENANCES, data.maintenances || []),
    settingsRepository.saveSettings(data.settings),
  ]);

  if (data.syncMeta) {
    await syncMetaRepository.updateSyncMeta(data.syncMeta);
  } else {
    await syncMetaRepository.incrementRevision();
  }
}

/**
 * Clear all records in IndexedDB
 */
export async function clearAllIndexedDB(): Promise<void> {
  await Promise.all([
    dbClear(STORES.SALARIES),
    dbClear(STORES.OVERTIMES),
    dbClear(STORES.EXPENSES),
    dbClear(STORES.GIFTS),
    dbClear(STORES.VEHICLES),
    dbClear(STORES.FUELS),
    dbClear(STORES.MAINTENANCES),
    dbClear(STORES.SYNC_QUEUE),
  ]);
  if (typeof window !== 'undefined') {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  }
  await syncMetaRepository.incrementRevision();
}

/**
 * Reset to sample data in IndexedDB
 */
export async function resetSampleIndexedDB(): Promise<LedgerFullData> {
  const fresh = generateInitialSampleData();
  await saveAllToIndexedDB(fresh);
  return fresh;
}
