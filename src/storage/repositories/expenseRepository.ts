import { ExpenseRecord } from '../../types';
import { dbBatchPut, dbDelete, dbGet, dbGetAll, dbPut, STORES } from '../db';

export const expenseRepository = {
  async getAll(): Promise<ExpenseRecord[]> {
    const all = await dbGetAll<ExpenseRecord>(STORES.EXPENSES);
    return all.filter((e) => !e.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
  },

  async getRawAll(): Promise<ExpenseRecord[]> {
    return dbGetAll<ExpenseRecord>(STORES.EXPENSES);
  },

  async getById(id: string): Promise<ExpenseRecord | undefined> {
    return dbGet<ExpenseRecord>(STORES.EXPENSES, id);
  },

  async save(record: ExpenseRecord): Promise<void> {
    const now = new Date().toISOString();
    const updated: ExpenseRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
      deletedAt: undefined,
    };
    await dbPut(STORES.EXPENSES, updated);
  },

  async softDelete(id: string): Promise<void> {
    const existing = await dbGet<ExpenseRecord>(STORES.EXPENSES, id);
    if (existing) {
      existing.deletedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      await dbPut(STORES.EXPENSES, existing);
    }
  },

  async hardDelete(id: string): Promise<void> {
    await dbDelete(STORES.EXPENSES, id);
  },

  async batchSave(records: ExpenseRecord[]): Promise<void> {
    await dbBatchPut(STORES.EXPENSES, records);
  },
};
