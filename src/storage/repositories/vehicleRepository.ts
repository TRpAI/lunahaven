import { VehicleProfile } from '../../types';
import { dbBatchPut, dbDelete, dbGet, dbGetAll, dbPut, STORES } from '../db';

export const vehicleRepository = {
  async getAll(): Promise<VehicleProfile[]> {
    const all = await dbGetAll<VehicleProfile>(STORES.VEHICLES);
    return all.filter((v) => !v.deletedAt);
  },

  async getRawAll(): Promise<VehicleProfile[]> {
    return dbGetAll<VehicleProfile>(STORES.VEHICLES);
  },

  async getById(id: string): Promise<VehicleProfile | undefined> {
    return dbGet<VehicleProfile>(STORES.VEHICLES, id);
  },

  async save(record: VehicleProfile): Promise<void> {
    const now = new Date().toISOString();
    const updated: VehicleProfile = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
      deletedAt: undefined,
    };
    await dbPut(STORES.VEHICLES, updated);
  },

  async softDelete(id: string): Promise<void> {
    const existing = await dbGet<VehicleProfile>(STORES.VEHICLES, id);
    if (existing) {
      existing.deletedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      await dbPut(STORES.VEHICLES, existing);
    }
  },

  async hardDelete(id: string): Promise<void> {
    await dbDelete(STORES.VEHICLES, id);
  },

  async batchSave(records: VehicleProfile[]): Promise<void> {
    await dbBatchPut(STORES.VEHICLES, records);
  },
};
