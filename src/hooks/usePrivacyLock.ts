import { useCallback, useEffect, useRef, useState } from 'react';
import { AppSettings } from '../types';
import { hashPassword, verifyPasswordHash } from '../utils/crypto';
import { verifyTOTPCode } from '../utils/totp';

const DEMO_PIN_HASH = 'cWl5dWVfbWFzdGVyXzEyMzQ1Nl9hdXRoX3Yy';
export const QIYUE_AUTH_STATUS_KEY = 'qiyue_master_unlocked';
export const QIYUE_LAST_ACTIVE_KEY = 'qiyue_master_last_active';

export function usePrivacyLock(
  settings: AppSettings,
  onUpdateSettings: (settings: Partial<AppSettings>) => void
) {
  // 生产环境安全策略：有效自定义密码必须存在且不能是遗留的演示弱哈希
  const hasPassword = Boolean(settings.pinHash && settings.pinHash !== DEMO_PIN_HASH);
  const is2FAEnabled = Boolean(settings.isTwoFactorEnabled && settings.twoFactorSecret);
  const autoLockMinutes = typeof settings.autoLockMinutes === 'number' ? settings.autoLockMinutes : 15;

  // 辅助函数：判断给定时间戳与当前时间相比是否已超时
  const isExpired = useCallback((lastTimestamp: number, lockMinutes: number): boolean => {
    if (lockMinutes <= 0) return false; // 0 表示从不自动锁定
    if (!lastTimestamp) return true;
    const elapsedMinutes = (Date.now() - lastTimestamp) / 60000;
    return elapsedMinutes >= lockMinutes;
  }, []);

  // 初始化解锁状态：
  // 核心规则：
  // 1. 如果已设置密码，检查本地保存的上次活跃时间是否在有效时间内；
  // 2. 若未超时，保持解锁；若已超时，锁定并要求密码验证；
  // 3. 若尚未设置密码，则开放初始设置。
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      const unlocked = localStorage.getItem(QIYUE_AUTH_STATUS_KEY);
      if (unlocked !== 'true') {
        return false;
      }

      const savedLastActiveStr = localStorage.getItem(QIYUE_LAST_ACTIVE_KEY);
      const savedLastActive = savedLastActiveStr ? parseInt(savedLastActiveStr, 10) : 0;

      // 如果有保存上次活跃时间，且设置了超时时间，检查是否超时
      if (autoLockMinutes > 0 && savedLastActive > 0) {
        const elapsedMinutes = (Date.now() - savedLastActive) / 60000;
        if (elapsedMinutes >= autoLockMinutes) {
          localStorage.removeItem(QIYUE_AUTH_STATUS_KEY);
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  });

  const lastActiveTimeRef = useRef<number>(Date.now());
  const lastWriteTimeRef = useRef<number>(Date.now());

  // 记录用户交互活跃状态（节流写入 localStorage）
  const recordActivity = useCallback(() => {
    // 仅在当前已解锁状态下更新活跃时间
    if (!isUnlocked) return;

    const now = Date.now();
    lastActiveTimeRef.current = now;

    if (now - lastWriteTimeRef.current > 2000) {
      lastWriteTimeRef.current = now;
      try {
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
      } catch {}
    }
  }, [isUnlocked]);

  // 核心校验：执行闲置超时锁屏检测
  const performLockCheck = useCallback((): boolean => {
    if (!isUnlocked || !hasPassword || autoLockMinutes <= 0) {
      return false;
    }

    const savedLastActiveStr = localStorage.getItem(QIYUE_LAST_ACTIVE_KEY);
    const savedLastActive = savedLastActiveStr
      ? parseInt(savedLastActiveStr, 10) || lastActiveTimeRef.current
      : lastActiveTimeRef.current;

    const elapsedMinutes = (Date.now() - savedLastActive) / 60000;

    if (elapsedMinutes >= autoLockMinutes) {
      setIsUnlocked(false);
      try {
        localStorage.removeItem(QIYUE_AUTH_STATUS_KEY);
      } catch {}
      return true; // 已触发锁定
    }

    return false;
  }, [isUnlocked, hasPassword, autoLockMinutes]);

  // 1. 页面在前台持续运行时的定时轮询检测（每 3 秒检查一次）
  useEffect(() => {
    if (!isUnlocked || !hasPassword || autoLockMinutes <= 0) return;

    const timer = setInterval(() => {
      performLockCheck();
    }, 3000);

    return () => clearInterval(timer);
  }, [isUnlocked, hasPassword, autoLockMinutes, performLockCheck]);

  // 2. 页面切后台 / 熄屏 / 切换标签后切回前台时，优先检查是否已超时
  useEffect(() => {
    if (!isUnlocked || !hasPassword || autoLockMinutes <= 0) return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const locked = performLockCheck();
        if (!locked) {
          // 未超时，记录当前唤醒为活跃
          recordActivity();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isUnlocked, hasPassword, autoLockMinutes, performLockCheck, recordActivity]);

  // 3. 用户交互事件监听（点击、按键、触摸）
  useEffect(() => {
    if (!isUnlocked) return;

    const handleUserInteraction = () => {
      // 每次交互前先快速确认是否已超时
      const locked = performLockCheck();
      if (!locked) {
        recordActivity();
      }
    };

    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [isUnlocked, performLockCheck, recordActivity]);

  // 4. 当数据从 IndexedDB 异步载入完成时，同步校准密码与解锁状态
  useEffect(() => {
    if (hasPassword && !isUnlocked) {
      try {
        const unlocked = localStorage.getItem(QIYUE_AUTH_STATUS_KEY);
        if (unlocked === 'true') {
          const savedLastActiveStr = localStorage.getItem(QIYUE_LAST_ACTIVE_KEY);
          const savedLastActive = savedLastActiveStr ? parseInt(savedLastActiveStr, 10) : 0;
          if (autoLockMinutes <= 0 || !isExpired(savedLastActive, autoLockMinutes)) {
            setIsUnlocked(true);
            lastActiveTimeRef.current = Date.now();
          } else {
            localStorage.removeItem(QIYUE_AUTH_STATUS_KEY);
          }
        }
      } catch {}
    }
  }, [hasPassword, isUnlocked, autoLockMinutes, isExpired]);

  // 验证第一步主密码 (PBKDF2-SHA256)
  const verifyPassword = async (
    inputPass: string
  ): Promise<{ success: boolean; requires2FA: boolean }> => {
    if (!inputPass) return { success: false, requires2FA: false };

    const { isValid, needsRehash, newHash, newSalt } = await verifyPasswordHash(
      inputPass,
      settings.pinHash,
      settings.passwordSalt
    );

    if (!isValid) {
      return { success: false, requires2FA: false };
    }

    if (needsRehash && newHash && newSalt) {
      onUpdateSettings({
        pinHash: newHash,
        passwordSalt: newSalt,
      });
    }

    if (is2FAEnabled) {
      return { success: true, requires2FA: true };
    }

    const now = Date.now();
    setIsUnlocked(true);
    lastActiveTimeRef.current = now;
    lastWriteTimeRef.current = now;
    try {
      localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
      localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
    } catch {}
    return { success: true, requires2FA: false };
  };

  // 验证第二步 2FA 动态口令或备用应急恢复码
  const verify2FACode = async (codeOrBackup: string): Promise<boolean> => {
    if (!is2FAEnabled || !settings.twoFactorSecret) return false;
    const cleanInput = codeOrBackup.trim().toUpperCase();

    // 1. 尝试验证 6 位 TOTP
    if (/^\d{6}$/.test(cleanInput)) {
      const isTotpValid = await verifyTOTPCode(cleanInput, settings.twoFactorSecret);
      if (isTotpValid) {
        const now = Date.now();
        setIsUnlocked(true);
        lastActiveTimeRef.current = now;
        lastWriteTimeRef.current = now;
        try {
          localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
          localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
        } catch {}
        return true;
      }
    }

    // 2. 尝试验证备用恢复码
    const backupCodes = settings.twoFactorBackupCodes || [];
    const matchedIndex = backupCodes.findIndex(
      (b) => b.toUpperCase().replace(/\s+/g, '') === cleanInput.replace(/\s+/g, '')
    );

    if (matchedIndex !== -1) {
      const updatedBackupCodes = [...backupCodes];
      updatedBackupCodes.splice(matchedIndex, 1);
      onUpdateSettings({
        twoFactorBackupCodes: updatedBackupCodes,
      });

      const now = Date.now();
      setIsUnlocked(true);
      lastActiveTimeRef.current = now;
      lastWriteTimeRef.current = now;
      try {
        localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
      } catch {}
      return true;
    }

    return false;
  };

  // 首次设置或修改主密码
  const setMasterPassword = async (newPassword: string): Promise<boolean> => {
    if (!newPassword) return false;
    const { hash, salt } = await hashPassword(newPassword);
    onUpdateSettings({
      isPinLockEnabled: true,
      pinHash: hash,
      passwordSalt: salt,
    });
    const now = Date.now();
    setIsUnlocked(true);
    lastActiveTimeRef.current = now;
    lastWriteTimeRef.current = now;
    try {
      localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
      localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
    } catch {}
    return true;
  };

  // 开启双重验证
  const enable2FA = (secret: string, backupCodes: string[]) => {
    onUpdateSettings({
      isTwoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: backupCodes,
    });
  };

  // 关闭双重验证
  const disable2FA = () => {
    onUpdateSettings({
      isTwoFactorEnabled: false,
      twoFactorSecret: '',
      twoFactorBackupCodes: [],
    });
  };

  // 立即手动锁屏 / 登出（用户主动点击 Navbar 或设置中的锁屏按钮时触发）
  const lockNow = () => {
    setIsUnlocked(false);
    try {
      localStorage.removeItem(QIYUE_AUTH_STATUS_KEY);
      localStorage.removeItem(QIYUE_LAST_ACTIVE_KEY);
    } catch {}
  };

  return {
    isUnlocked,
    hasPassword,
    is2FAEnabled,
    autoLockMinutes,
    verifyPassword,
    verify2FACode,
    setMasterPassword,
    enable2FA,
    disable2FA,
    lockNow,
    recordActivity,
  };
}
