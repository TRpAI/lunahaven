import { useCallback, useEffect, useRef, useState } from 'react';
import { AppSettings, LedgerFullData, OneDriveConfig } from '../types';
import { uploadBackupToOneDrive } from '../utils/oneDriveSync';

export function useOneDriveAutoBackup(
  settings: AppSettings,
  fullData: LedgerFullData,
  onUpdateSettings: (settings: Partial<AppSettings>) => void
) {
  const [isAutoBackingUp, setIsAutoBackingUp] = useState(false);
  const isBackingUpRef = useRef(false);

  const fullDataRef = useRef<LedgerFullData>(fullData);
  fullDataRef.current = fullData;

  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  const performBackup = useCallback(async (isManual: boolean = false) => {
    const curSettings = settingsRef.current;
    const config: OneDriveConfig | undefined = curSettings.oneDriveConfig;

    if (!config?.accessToken || (!config.autoBackup && !isManual)) {
      return false;
    }

    if (isBackingUpRef.current) {
      return false;
    }

    isBackingUpRef.current = true;
    setIsAutoBackingUp(true);

    try {
      const curData = fullDataRef.current;
      const res = await uploadBackupToOneDrive(
        config.accessToken,
        config.backupFolder || 'QiyueLedger',
        curData,
        config.maxRetentionCount || 20
      );

      const updatedConfig: OneDriveConfig = {
        ...config,
        lastBackupTime: res.backupTime,
        lastBackupRevision: curData.syncMeta?.revision || 1,
        backupStatus: 'success',
        errorMessage: undefined,
      };

      onUpdateSettings({
        oneDriveConfig: updatedConfig,
      });

      return true;
    } catch (err: any) {
      console.warn('OneDrive background backup failed:', err);
      const updatedConfig: OneDriveConfig = {
        ...config,
        backupStatus: 'error',
        errorMessage: err.message || '备份失败',
      };
      onUpdateSettings({
        oneDriveConfig: updatedConfig,
      });
      return false;
    } finally {
      isBackingUpRef.current = false;
      setIsAutoBackingUp(false);
    }
  }, [onUpdateSettings]);

  // 全局定时器：无论用户在哪个标签页，每 60 秒定期检查是否满足自动增量备份周期
  useEffect(() => {
    const checkSchedule = () => {
      const config = settingsRef.current.oneDriveConfig;
      if (!config?.autoBackup || !config?.accessToken) return;

      const now = Date.now();
      const lastTime = config.lastBackupTime ? new Date(config.lastBackupTime).getTime() : 0;
      const intervalMs = (config.backupIntervalHours || 24) * 60 * 60 * 1000;

      // 距离上次备份已超过设定时间
      if (now - lastTime >= intervalMs) {
        performBackup(false);
      }
    };

    // 页面加载 5 秒后首次检查
    const initTimer = setTimeout(checkSchedule, 5000);
    // 之后每分钟检查一次
    const intervalTimer = setInterval(checkSchedule, 60000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(intervalTimer);
    };
  }, [performBackup]);

  return {
    isAutoBackingUp,
    triggerManualBackup: () => performBackup(true),
  };
}
