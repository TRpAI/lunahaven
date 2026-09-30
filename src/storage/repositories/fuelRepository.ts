import { FuelRecord } from '../../types';
import { dbBatchPut, dbDelete, dbGet, dbGetAll, dbPut, STORES } from '../db';

export const fuelRepository = {
  async getAll(): Promise<FuelRecord[]> {
    const all = await dbGetAll<FuelRecord>(STORES.FUELS);
    return all.filter((f) => !f.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
  },

  async getRawAll(): Promise<FuelRecord[]> {
    return dbGetAll<FuelRecord>(STORES.FUELS);
  },

  async getById(id: string): Promise<FuelRecord | undefined> {
    return dbGet<FuelRecord>(STORES.FUELS, id);
  },

  async save(record: FuelRecord): Promise<void> {
    const now = new Date().toISOString();
    const updated: FuelRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
      deletedAt: undefined,
    };
    await dbPut(STORES.FUELS, updated);
  },

  async softDelete(id: string): Promise<void> {
    const existing = await dbGet<FuelRecord>(STORES.FUELS, id);
    if (existing) {
      existing.deletedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      await dbPut(STORES.FUELS, existing);
    }
  },

  async hardDelete(id: string): Promise<void> {
    await dbDelete(STORES.FUELS, id);
  },

  async batchSave(records: FuelRecord[]): Promise<void> {
    await dbBatchPut(STORES.FUELS, records);
  },
};
