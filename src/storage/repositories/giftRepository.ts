import { SocialGiftRecord } from '../../types';
import { dbBatchPut, dbDelete, dbGet, dbGetAll, dbPut, STORES } from '../db';

export const giftRepository = {
  async getAll(): Promise<SocialGiftRecord[]> {
    const all = await dbGetAll<SocialGiftRecord>(STORES.GIFTS);
    return all.filter((g) => !g.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
  },

  async getRawAll(): Promise<SocialGiftRecord[]> {
    return dbGetAll<SocialGiftRecord>(STORES.GIFTS);
  },

  async getById(id: string): Promise<SocialGiftRecord | undefined> {
    return dbGet<SocialGiftRecord>(STORES.GIFTS, id);
  },

  async save(record: SocialGiftRecord): Promise<void> {
    const now = new Date().toISOString();
    const updated: SocialGiftRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
      deletedAt: undefined,
    };
    await dbPut(STORES.GIFTS, updated);
  },

  async softDelete(id: string): Promise<void> {
    const existing = await dbGet<SocialGiftRecord>(STORES.GIFTS, id);
    if (existing) {
      existing.deletedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      await dbPut(STORES.GIFTS, existing);
    }
  },

  async hardDelete(id: string): Promise<void> {
    await dbDelete(STORES.GIFTS, id);
  },

  async batchSave(records: SocialGiftRecord[]): Promise<void> {
    await dbBatchPut(STORES.GIFTS, records);
  },
};
