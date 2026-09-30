import { OvertimeRecord } from '../../types';
import { dbBatchPut, dbDelete, dbGet, dbGetAll, dbPut, STORES } from '../db';

export const overtimeRepository = {
  async getAll(): Promise<OvertimeRecord[]> {
    const all = await dbGetAll<OvertimeRecord>(STORES.OVERTIMES);
    return all.filter((o) => !o.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
  },

  async getRawAll(): Promise<OvertimeRecord[]> {
    return dbGetAll<OvertimeRecord>(STORES.OVERTIMES);
  },

  async getById(id: string): Promise<OvertimeRecord | undefined> {
    return dbGet<OvertimeRecord>(STORES.OVERTIMES, id);
  },

  async save(record: OvertimeRecord): Promise<void> {
    const now = new Date().toISOString();
    const updated: OvertimeRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
      deletedAt: undefined,
    };
    await dbPut(STORES.OVERTIMES, updated);
  },

  async softDelete(id: string): Promise<void> {
    const existing = await dbGet<OvertimeRecord>(STORES.OVERTIMES, id);
    if (existing) {
      existing.deletedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      await dbPut(STORES.OVERTIMES, existing);
    }
  },

  async hardDelete(id: string): Promise<void> {
    await dbDelete(STORES.OVERTIMES, id);
  },

  async batchSave(records: OvertimeRecord[]): Promise<void> {
    await dbBatchPut(STORES.OVERTIMES, records);
  },
};
