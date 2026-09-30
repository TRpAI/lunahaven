import { SalaryRecord } from '../../types';
import { dbBatchPut, dbDelete, dbGet, dbGetAll, dbPut, STORES } from '../db';

export const salaryRepository = {
  async getAll(): Promise<SalaryRecord[]> {
    const all = await dbGetAll<SalaryRecord>(STORES.SALARIES);
    return all.filter((s) => !s.deletedAt).sort((a, b) => b.month.localeCompare(a.month));
  },

  async getRawAll(): Promise<SalaryRecord[]> {
    return dbGetAll<SalaryRecord>(STORES.SALARIES);
  },

  async getById(id: string): Promise<SalaryRecord | undefined> {
    return dbGet<SalaryRecord>(STORES.SALARIES, id);
  },

  async save(record: SalaryRecord): Promise<void> {
    const now = new Date().toISOString();
    const updated: SalaryRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
      deletedAt: undefined,
    };
    await dbPut(STORES.SALARIES, updated);
  },

  async softDelete(id: string): Promise<void> {
    const existing = await dbGet<SalaryRecord>(STORES.SALARIES, id);
    if (existing) {
      existing.deletedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      await dbPut(STORES.SALARIES, existing);
    }
  },

  async hardDelete(id: string): Promise<void> {
    await dbDelete(STORES.SALARIES, id);
  },

  async batchSave(records: SalaryRecord[]): Promise<void> {
    await dbBatchPut(STORES.SALARIES, records);
  },
};
