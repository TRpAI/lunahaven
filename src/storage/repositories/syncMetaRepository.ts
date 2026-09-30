import { SyncMeta } from '../../types';
import { dbGet, dbPut, STORES } from '../db';

export const syncMetaRepository = {
  async getSyncMeta(): Promise<SyncMeta> {
    const meta = await dbGet<SyncMeta>(STORES.SYNC_META, 'global');
    if (!meta) {
      const defaultMeta: SyncMeta = {
        id: 'global',
        revision: 1,
        schemaVersion: 2,
        lastSyncedAt: null,
        updatedAt: new Date().toISOString(),
      };
      await dbPut(STORES.SYNC_META, defaultMeta);
      return defaultMeta;
    }
    return meta;
  },

  async updateSyncMeta(partial: Partial<SyncMeta>): Promise<SyncMeta> {
    const current = await this.getSyncMeta();
    const updated: SyncMeta = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    await dbPut(STORES.SYNC_META, updated);
    return updated;
  },

  async incrementRevision(lastSyncedAt?: string): Promise<SyncMeta> {
    const current = await this.getSyncMeta();
    const updated: SyncMeta = {
      ...current,
      revision: current.revision + 1,
      lastSyncedAt: lastSyncedAt || current.lastSyncedAt,
      updatedAt: new Date().toISOString(),
    };
    await dbPut(STORES.SYNC_META, updated);
    return updated;
  },
};
