import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppSettings,
  ExpenseRecord,
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
import { clearAllLedgerData, loadLedgerData, resetToSampleData, saveLedgerData } from '../utils/storage';
import {
  clearAllIndexedDB,
  expenseRepository,
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

  // 记录最新数据与自动同步倒计时
  const latestDataRef = useRef<LedgerFullData>(data);
  latestDataRef.current = data;

  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingAutoSyncSeconds, setPendingAutoSyncSeconds] = useState<number | null>(null);

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

  // 用户操作触发后的自动推送调度（防抖合并 + 可配置延迟时间）
  const scheduleAutoPushSync = useCallback(() => {
    const current = latestDataRef.current;
    const d1Config = current.settings.d1Config;
    if (!d1Config?.workerUrl || d1Config.autoSync === false) {
      return;
    }

    const delaySeconds = typeof d1Config.autoSyncDelaySeconds === 'number'
      ? d1Config.autoSyncDelaySeconds
      : 15;

    // 清除旧的定时器防抖重新计时
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    // 0 秒表示即时同步
    if (delaySeconds <= 0) {
      setPendingAutoSyncSeconds(null);
      syncToCloudflareWorker(d1Config.workerUrl, d1Config.apiToken, current)
        .then(() => {
          const nowStr = new Date().toLocaleString('zh-CN');
          const updatedSettings: AppSettings = {
            ...current.settings,
            d1Config: {
              ...d1Config,
              lastSyncTime: nowStr,
              syncStatus: 'success',
              errorMessage: undefined,
            },
          };
          setData((prev) => ({ ...prev, settings: updatedSettings }));
          settingsRepository.saveSettings(updatedSettings).catch(console.error);
          saveLedgerData({ ...current, settings: updatedSettings });
        })
        .catch((err) => {
          console.warn('Instant auto push error:', err);
          setSyncError(err.message || '自动同步失败');
        });
      return;
    }

    setPendingAutoSyncSeconds(delaySeconds);
    let remaining = delaySeconds;

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setPendingAutoSyncSeconds(null);
      } else {
        setPendingAutoSyncSeconds(remaining);
      }
    }, 1000);

    autoSyncTimerRef.current = setTimeout(async () => {
      try {
        const curData = latestDataRef.current;
        const curConfig = curData.settings.d1Config;
        if (!curConfig?.workerUrl) return;

        setIsSyncing(true);
        setSyncError(null);
        await syncToCloudflareWorker(curConfig.workerUrl, curConfig.apiToken, curData);
        const nowStr = new Date().toLocaleString('zh-CN');
        const updatedSettings: AppSettings = {
          ...curData.settings,
          d1Config: {
            ...curConfig,
            lastSyncTime: nowStr,
            syncStatus: 'success',
            errorMessage: undefined,
          },
        };
        setData((prev) => ({ ...prev, settings: updatedSettings }));
        settingsRepository.saveSettings(updatedSettings).catch(console.error);
        saveLedgerData({ ...curData, settings: updatedSettings });
      } catch (err: any) {
        console.warn('Auto push sync error:', err);
        setSyncError(err.message || '自动同步失败');
      } finally {
        setIsSyncing(false);
        setPendingAutoSyncSeconds(null);
      }
    }, delaySeconds * 1000);
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

    // 单记录异步写入 IndexedDB 并调度自动同步
    salaryRepository.save(enrichedRecord).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  const deleteSalary = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      salaries: prev.salaries.filter((s) => s.id !== id),
    }));

    // 软删除标记并更新版本号
    salaryRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

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
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  const deleteOvertime = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      overtimes: prev.overtimes.filter((o) => o.id !== id),
    }));

    overtimeRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

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
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  const deleteGift = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      gifts: prev.gifts.filter((g) => g.id !== id),
    }));

    giftRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  // 3.5 日常生活开销与教育支出 CRUD - 针对单个 expense 记录操作 IndexedDB
  const saveExpense = useCallback((record: ExpenseRecord) => {
    const now = new Date().toISOString();
    const enrichedRecord: ExpenseRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
    };

    setData((prev) => {
      const expenses = prev.expenses || [];
      const exists = expenses.some((e) => e.id === record.id);
      const nextExpenses = exists
        ? expenses.map((e) => (e.id === record.id ? enrichedRecord : e))
        : [enrichedRecord, ...expenses];
      nextExpenses.sort((a, b) => b.date.localeCompare(a.date));
      return { ...prev, expenses: nextExpenses };
    });

    expenseRepository.save(enrichedRecord).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  const deleteExpense = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      expenses: (prev.expenses || []).filter((e) => e.id !== id),
    }));

    expenseRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

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
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  const deleteVehicle = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      vehicles: prev.vehicles.filter((v) => v.id !== id),
      fuels: prev.fuels.filter((f) => f.vehicleId !== id),
      maintenances: prev.maintenances.filter((m) => m.vehicleId !== id),
    }));

    vehicleRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

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
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  const deleteFuel = useCallback((id: string) => {
    setData((prev) => {
      let fuels = prev.fuels.filter((f) => f.id !== id);
      fuels = processFuelRecords(fuels);
      return { ...prev, fuels };
    });

    fuelRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

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
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  const deleteMaintenance = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      maintenances: prev.maintenances.filter((m) => m.id !== id),
    }));

    maintenanceRepository.softDelete(id).catch(console.error);
    syncMetaRepository.incrementRevision().catch(console.error);
    scheduleAutoPushSync();
  }, [scheduleAutoPushSync]);

  // 7. 设置项更新 - 独立存储在 IndexedDB settings store 并同步到本地缓存
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setData((prev) => {
      const nextSettings: AppSettings = { ...prev.settings, ...newSettings };
      settingsRepository.saveSettings(nextSettings).catch(console.error);
      saveLedgerData({ ...prev, settings: nextSettings });
      return { ...prev, settings: nextSettings };
    });
    syncMetaRepository.incrementRevision().catch(console.error);
  }, []);

  // 8. 导入完整数据 - 全量批量写入 IndexedDB
  const importFullData = useCallback((imported: LedgerFullData) => {
    setData(imported);
    saveAllToIndexedDB(imported).catch(console.error);
    saveLedgerData(imported);
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
      expenses: [],
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

  // 10. 全局数据与缓存刷新（含本地 IndexedDB 重载与 Cloudflare D1 双向同步）
  const refreshData = useCallback(async () => {
    // 手动刷新时清除等待中的自动同步定时器
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setPendingAutoSyncSeconds(null);

    setIsSyncing(true);
    setSyncError(null);
    try {
      // 1. 重新从 IndexedDB 异步读取最新底层数据
      const idbData = await loadAllFromIndexedDB();
      if (idbData) {
        setData(idbData);
      }

      // 2. 若配置了 Cloudflare D1，则执行云端同步
      if (idbData?.settings?.d1Config?.workerUrl) {
        await syncToCloudflareWorker(
          idbData.settings.d1Config.workerUrl,
          idbData.settings.d1Config.apiToken,
          idbData
        );
        const nowStr = new Date().toLocaleString('zh-CN');
        const updatedSettings: AppSettings = {
          ...idbData.settings,
          d1Config: {
            ...idbData.settings.d1Config,
            lastSyncTime: nowStr,
            syncStatus: 'success',
            errorMessage: undefined,
          },
        };
        setData((prev) => ({ ...prev, settings: updatedSettings }));
        settingsRepository.saveSettings(updatedSettings).catch(console.error);
        return { success: true, isCloud: true, time: nowStr };
      }

      return { success: true, isCloud: false, time: new Date().toLocaleTimeString('zh-CN') };
    } catch (err: any) {
      const errMsg = err.message || '刷新或同步失败';
      setSyncError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 11. Cloudflare D1 一键主动推送同步（手动触发）
  const syncWithCloudflare = useCallback(async () => {
    // 清除等待中的自动同步定时器
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setPendingAutoSyncSeconds(null);

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
    saveExpense,
    deleteExpense,
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
    refreshData,
    syncWithCloudflare,
    isSyncing,
    pendingAutoSyncSeconds,
    syncError,
  };
}
