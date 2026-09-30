import { MaintenanceRecord } from '../../types';
import { dbBatchPut, dbDelete, dbGet, dbGetAll, dbPut, STORES } from '../db';

export const maintenanceRepository = {
  async getAll(): Promise<MaintenanceRecord[]> {
    const all = await dbGetAll<MaintenanceRecord>(STORES.MAINTENANCES);
    return all.filter((m) => !m.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
  },

  async getRawAll(): Promise<MaintenanceRecord[]> {
    return dbGetAll<MaintenanceRecord>(STORES.MAINTENANCES);
  },

  async getById(id: string): Promise<MaintenanceRecord | undefined> {
    return dbGet<MaintenanceRecord>(STORES.MAINTENANCES, id);
  },

  async save(record: MaintenanceRecord): Promise<void> {
    const now = new Date().toISOString();
    const updated: MaintenanceRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
      deletedAt: undefined,
    };
    await dbPut(STORES.MAINTENANCES, updated);
  },

  async softDelete(id: string): Promise<void> {
    const existing = await dbGet<MaintenanceRecord>(STORES.MAINTENANCES, id);
    if (existing) {
      existing.deletedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      await dbPut(STORES.MAINTENANCES, existing);
    }
  },

  async hardDelete(id: string): Promise<void> {
    await dbDelete(STORES.MAINTENANCES, id);
  },

  async batchSave(records: MaintenanceRecord[]): Promise<void> {
    await dbBatchPut(STORES.MAINTENANCES, records);
  },
};
