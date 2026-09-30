import { useCallback, useEffect, useState } from 'react';
import {
  AppSettings,
  FuelRecord,
  LedgerFullData,
  MaintenanceRecord,
  OvertimeRecord,
  SalaryRecord,
  SocialGiftRecord,
  VehicleProfile,
} from '../types';
import { syncToCloudflareWorker } from '../utils/d1Sync';
import { processFuelRecords } from '../utils/fuelCalculator';
import { clearAllLedgerData, loadLedgerData, resetToSampleData } from '../utils/storage';
import {
  clearAllIndexedDB,
  fuelRepository,
  giftRepository,
  loadAllFromIndexedDB,
  maintenanceRepository,
  overtimeRepository,
  resetSampleIndexedDB,
  salaryRepository,
  saveAllToIndexedDB,
  settingsRepository,
  syncMetaRepository,
  vehicleRepository,
} from '../storage';

export function useLedgerData() {
  // 快速同步初始数据（保障 SSR 或首次渲染无闪烁）
  const [data, setData] = useState<LedgerFullData>(() => loadLedgerData());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 页面加载时自动从 IndexedDB 异步读取完整最新数据（并自动完成 LocalStorage 迁移）
  useEffect(() => {
    let isMounted = true;
    loadAllFromIndexedDB()
      .then((idbData) => {
        if (isMounted && idbData) {
          setData(idbData);
        }
      })
      .catch((err) => {
        console.warn('读取 IndexedDB 失败，使用本地沙盒缓存:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 1. 工资 CRUD - 针对单个 salary 记录操作 IndexedDB
  const saveSalary = useCallback((record: SalaryRecord) => {
    const now = new Date().toISOString();
    const enrichedRecord: SalaryRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    setData((prev) => {
      const exists = prev.salaries.some((s) => s.id === record.id);
      const salaries = exists
        ? prev.salaries.map((s) => (s.id === record.id ? enrichedRecord : s))
        : [enrichedRecord, ...prev.salaries];
      salaries.sort((a, b) => b.month.localeCompare(a.month));
      return { ...prev, salaries };
    });

    // 单记录异步写入 IndexedDB
    salaryRepository.save(enrichedRecord).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  const deleteSalary = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      salaries: prev.salaries.filter((s) => s.id !== id),
    }));

    // 软删除标记并更新版本号
    salaryRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  // 2. 加班工时 CRUD - 针对单个 overtime 记录操作 IndexedDB
  const saveOvertime = useCallback((record: OvertimeRecord) => {
    const now = new Date().toISOString();
    const enrichedRecord: OvertimeRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    setData((prev) => {
      const exists = prev.overtimes.some((o) => o.id === record.id);
      const overtimes = exists
        ? prev.overtimes.map((o) => (o.id === record.id ? enrichedRecord : o))
        : [enrichedRecord, ...prev.overtimes];
      overtimes.sort((a, b) => b.date.localeCompare(a.date));
      return { ...prev, overtimes };
    });

    overtimeRepository.save(enrichedRecord).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  const deleteOvertime = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      overtimes: prev.overtimes.filter((o) => o.id !== id),
    }));

    overtimeRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  // 3. 人情往来 CRUD - 针对单个 gift 记录操作 IndexedDB
  const saveGift = useCallback((record: SocialGiftRecord) => {
    const now = new Date().toISOString();
    const enrichedRecord: SocialGiftRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    setData((prev) => {
      const exists = prev.gifts.some((g) => g.id === record.id);
      const gifts = exists
        ? prev.gifts.map((g) => (g.id === record.id ? enrichedRecord : g))
        : [enrichedRecord, ...prev.gifts];
      gifts.sort((a, b) => b.date.localeCompare(a.date));
      return { ...prev, gifts };
    });

    giftRepository.save(enrichedRecord).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  const deleteGift = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      gifts: prev.gifts.filter((g) => g.id !== id),
    }));

    giftRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  // 4. 车辆档案 CRUD - 针对单个 vehicle 记录操作 IndexedDB
  const saveVehicle = useCallback((record: VehicleProfile) => {
    const now = new Date().toISOString();
    const enrichedRecord: VehicleProfile = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    setData((prev) => {
      const exists = prev.vehicles.some((v) => v.id === record.id);
      const vehicles = exists
        ? prev.vehicles.map((v) => (v.id === record.id ? enrichedRecord : v))
        : [...prev.vehicles, enrichedRecord];
      return { ...prev, vehicles };
    });

    vehicleRepository.save(enrichedRecord).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  const deleteVehicle = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      vehicles: prev.vehicles.filter((v) => v.id !== id),
      fuels: prev.fuels.filter((f) => f.vehicleId !== id),
      maintenances: prev.maintenances.filter((m) => m.vehicleId !== id),
    }));

    vehicleRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  // 5. 加油/充电记录 CRUD - 针对单个 fuel 记录操作 IndexedDB
  const saveFuel = useCallback((record: FuelRecord) => {
    const now = new Date().toISOString();
    const enrichedRecord: FuelRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    setData((prev) => {
      const exists = prev.fuels.some((f) => f.id === record.id);
      let fuels = exists
        ? prev.fuels.map((f) => (f.id === record.id ? enrichedRecord : f))
        : [enrichedRecord, ...prev.fuels];
      fuels = processFuelRecords(fuels);

      // 同步更新对应车辆当前最新里程
      const vehicleId = record.vehicleId;
      const vehicle = prev.vehicles.find((v) => v.id === vehicleId);
      let vehicles = prev.vehicles;
      if (vehicle && record.odometer > (vehicle.currentOdometer || 0)) {
        const updatedVehicle = { ...vehicle, currentOdometer: record.odometer, updatedAt: now };
        vehicles = prev.vehicles.map((v) => (v.id === vehicleId ? updatedVehicle : v));
        vehicleRepository.save(updatedVehicle).catch(console.error);
      }

      return { ...prev, fuels, vehicles };
    });

    fuelRepository.save(enrichedRecord).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  const deleteFuel = useCallback((id: string) => {
    setData((prev) => {
      let fuels = prev.fuels.filter((f) => f.id !== id);
      fuels = processFuelRecords(fuels);
      return { ...prev, fuels };
    });

    fuelRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  // 6. 汽车维保 CRUD - 针对单个 maintenance 记录操作 IndexedDB
  const saveMaintenance = useCallback((record: MaintenanceRecord) => {
    const now = new Date().toISOString();
    const enrichedRecord: MaintenanceRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    setData((prev) => {
      const exists = prev.maintenances.some((m) => m.id === record.id);
      const maintenances = exists
        ? prev.maintenances.map((m) => (m.id === record.id ? enrichedRecord : m))
        : [enrichedRecord, ...prev.maintenances];
      maintenances.sort((a, b) => b.date.localeCompare(a.date));

      // 更新车辆最近保养信息
      const vehicleId = record.vehicleId;
      const vehicle = prev.vehicles.find((v) => v.id === vehicleId);
      let vehicles = prev.vehicles;
      if (vehicle) {
        const updatedVehicle: VehicleProfile = {
          ...vehicle,
          lastMaintenanceDate: record.date,
          lastMaintenanceOdometer: record.odometer,
          currentOdometer: Math.max(vehicle.currentOdometer || 0, record.odometer),
          updatedAt: now,
        };
        vehicles = prev.vehicles.map((v) => (v.id === vehicleId ? updatedVehicle : v));
        vehicleRepository.save(updatedVehicle).catch(console.error);
      }

      return { ...prev, maintenances, vehicles };
    });

    maintenanceRepository.save(enrichedRecord).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  const deleteMaintenance = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      maintenances: prev.maintenances.filter((m) => m.id !== id),
    }));

    maintenanceRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  // 7. 设置项更新 - 独立存储在 IndexedDB settings store
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setData((prev) => {
      const nextSettings: AppSettings = { ...prev.settings, ...newSettings };
      settingsRepository.saveSettings(nextSettings).catch(console.error);
      return { ...prev, settings: nextSettings };
    });
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  // 8. 导入完整数据 - 全量批量写入 IndexedDB
  const importFullData = useCallback((imported: LedgerFullData) => {
    setData(imported);
    saveAllToIndexedDB(imported).catch(console.error);
  }, []);

  // 9. 恢复演示数据 / 完全清空
  const resetDemo = useCallback(async () => {
    const fresh = await resetSampleIndexedDB();
    resetToSampleData(); // 同时重置本地兼容缓存
    setData(fresh);
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllIndexedDB();
    clearAllLedgerData();
    const cleanSettings: AppSettings = {
      ...data.settings,
      activeVehicleId: '',
    };
    await settingsRepository.saveSettings(cleanSettings).catch(console.error);
    const empty: LedgerFullData = {
      salaries: [],
      overtimes: [],
      gifts: [],
      vehicles: [],
      fuels: [],
      maintenances: [],
      settings: cleanSettings,
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
    };
    setData(empty);
  }, [data.settings]);

  // 10. Cloudflare D1 一键主动推送同步
  const syncWithCloudflare = useCallback(async () => {
    const { workerUrl, apiToken } = data.settings.d1Config;
    if (!workerUrl) {
      throw new Error('未配置 Cloudflare Worker API 地址');
    }

    setIsSyncing(true);
    setSyncError(null);
    try {
      await syncToCloudflareWorker(workerUrl, apiToken, data);
      const nowStr = new Date().toLocaleString('zh-CN');
      updateSettings({
        d1Config: {
          ...data.settings.d1Config,
          lastSyncTime: nowStr,
          syncStatus: 'success',
          errorMessage: undefined,
        },
      });
      setIsSyncing(false);
      return true;
    } catch (err: any) {
      const errMsg = err.message || '同步出错';
      setSyncError(errMsg);
      updateSettings({
        d1Config: {
          ...data.settings.d1Config,
          syncStatus: 'error',
          errorMessage: errMsg,
        },
      });
      setIsSyncing(false);
      throw err;
    }
  }, [data, updateSettings]);

  return {
    data,
    saveSalary,
    deleteSalary,
    saveOvertime,
    deleteOvertime,
    saveGift,
    deleteGift,
    saveVehicle,
    deleteVehicle,
    saveFuel,
    deleteFuel,
    saveMaintenance,
    deleteMaintenance,
    updateSettings,
    importFullData,
    resetDemo,
    clearAll,
    syncWithCloudflare,
    isSyncing,
    syncError,
  };
}
