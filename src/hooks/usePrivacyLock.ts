import { useCallback, useEffect, useRef, useState } from 'react';
import { AppSettings } from '../types';
import { hashPassword, verifyPasswordHash } from '../utils/crypto';
import { verifyTOTPCode } from '../utils/totp';

const DEMO_PIN_HASH = 'cWl5dWVfbWFzdGVyXzEyMzQ1Nl9hdXRoX3Yy';
export const QIYUE_AUTH_STATUS_KEY = 'qiyue_auth_unlocked_v2';
export const QIYUE_LAST_ACTIVE_KEY = 'qiyue_last_active_time_v2';

export function usePrivacyLock(
  settings: AppSettings,
  onUpdateSettings: (settings: Partial<AppSettings>) => void
) {
  // 生产环境安全策略：有效自定义密码必须存在且不能是遗留的演示弱哈希
  const hasPassword = Boolean(settings.pinHash && settings.pinHash !== DEMO_PIN_HASH);
  const is2FAEnabled = Boolean(settings.isTwoFactorEnabled && settings.twoFactorSecret);

  // 初始化解锁状态：
  // 1. 若尚未创建密码，强制未解锁（引导首次新建主密码）
  // 2. 若已创建密码且处于已授权状态：计算上次活跃时间是否在有效设置时长内。如果在有效期内，刷新页面不锁屏！
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    // 检查 localStorage 初始状态
    try {
      const authStatus = localStorage.getItem(QIYUE_AUTH_STATUS_KEY);
      if (authStatus !== 'true') {
        return false;
      }

      const lastActiveStr = localStorage.getItem(QIYUE_LAST_ACTIVE_KEY);
      if (!lastActiveStr) {
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(Date.now()));
        return true;
      }

      const lastActive = parseInt(lastActiveStr, 10);
      if (isNaN(lastActive)) {
        return false;
      }

      const autoLockMinutes = typeof settings.autoLockMinutes === 'number' ? settings.autoLockMinutes : 15;
      // 0 代表从不自动锁定
      if (autoLockMinutes === 0) {
        return true;
      }

      const elapsedMinutes = (Date.now() - lastActive) / 60000;
      if (elapsedMinutes < autoLockMinutes) {
        // 在无操作有效期内：刷新页面不锁屏！更新活跃时间
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(Date.now()));
        return true;
      } else {
        // 已超过设定无操作时长：锁定屏幕
        localStorage.removeItem(QIYUE_AUTH_STATUS_KEY);
        return false;
      }
    } catch {
      return false;
    }
  });

  const [lastActiveTime, setLastActiveTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(QIYUE_LAST_ACTIVE_KEY);
      return saved ? parseInt(saved, 10) || Date.now() : Date.now();
    } catch {
      return Date.now();
    }
  });

  const lastWriteTimeRef = useRef<number>(Date.now());

  // 记录用户交互与活跃行为（防抖写入 localStorage，避免过于频繁磁盘 I/O）
  const recordActivity = useCallback(() => {
    const now = Date.now();
    setLastActiveTime(now);

    if (now - lastWriteTimeRef.current > 1500) {
      lastWriteTimeRef.current = now;
      try {
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
      } catch {
        // ignore storage quota error
      }
    }
  }, []);

  // 检查是否超过设定的无操作时间并执行自动锁定
  const checkInactivityLock = useCallback(() => {
    if (!isUnlocked || !hasPassword) return;

    const autoLockMinutes = typeof settings.autoLockMinutes === 'number' ? settings.autoLockMinutes : 15;
    if (autoLockMinutes === 0) return; // 0 = 从不自动锁定

    try {
      const savedLastActiveStr = localStorage.getItem(QIYUE_LAST_ACTIVE_KEY);
      const effectiveLastActive = savedLastActiveStr
        ? parseInt(savedLastActiveStr, 10) || lastActiveTime
        : lastActiveTime;
      const elapsedMinutes = (Date.now() - effectiveLastActive) / 60000;

      if (elapsedMinutes >= autoLockMinutes) {
        setIsUnlocked(false);
        localStorage.removeItem(QIYUE_AUTH_STATUS_KEY);
      }
    } catch {
      // ignore
    }
  }, [isUnlocked, hasPassword, settings.autoLockMinutes, lastActiveTime]);

  // 全局用户事件监听与无操作定时检查
  useEffect(() => {
    if (!isUnlocked || !hasPassword) return;

    // 1. 每 5 秒轮询检查一次空闲超时
    const timer = setInterval(() => {
      checkInactivityLock();
    }, 5000);

    // 2. 页面可见性改变时检查（例如切换回标签页、锁屏后重新亮屏）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivityLock();
      } else {
        // 页面离开时即时记录离开时间点
        try {
          localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(Date.now()));
        } catch {}
      }
    };

    // 3. 监听全局用户交互操作（点击、按键、触控、滚动）
    const handleUserInteraction = () => {
      recordActivity();
    };

    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUnlocked, hasPassword, checkInactivityLock, recordActivity]);

  // 当用户数据初次从 IndexedDB 异步加载就绪后，若已通过认证且未超时，维持解锁
  useEffect(() => {
    if (hasPassword && !isUnlocked) {
      try {
        const authStatus = localStorage.getItem(QIYUE_AUTH_STATUS_KEY);
        if (authStatus === 'true') {
          const lastActiveStr = localStorage.getItem(QIYUE_LAST_ACTIVE_KEY);
          const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
          const autoLockMinutes = typeof settings.autoLockMinutes === 'number' ? settings.autoLockMinutes : 15;
          const elapsedMinutes = (Date.now() - lastActive) / 60000;

          if (autoLockMinutes === 0 || elapsedMinutes < autoLockMinutes) {
            setIsUnlocked(true);
            setLastActiveTime(Date.now());
          }
        }
      } catch {}
    }
  }, [hasPassword, settings.autoLockMinutes, isUnlocked]);

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

    // 若原密码是旧 Base64 或弱哈希，验证通过后自动无缝升级为高强度 PBKDF2
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
    try {
      localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
      localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
    } catch {}
    setLastActiveTime(now);
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
        try {
          localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
          localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
        } catch {}
        setLastActiveTime(now);
        return true;
      }
    }

    // 2. 尝试验证备用恢复码
    const backupCodes = settings.twoFactorBackupCodes || [];
    const matchedIndex = backupCodes.findIndex(
      (b) => b.toUpperCase().replace(/\s+/g, '') === cleanInput.replace(/\s+/g, '')
    );

    if (matchedIndex !== -1) {
      // 消耗用过的备用恢复码
      const updatedBackupCodes = [...backupCodes];
      updatedBackupCodes.splice(matchedIndex, 1);
      onUpdateSettings({
        twoFactorBackupCodes: updatedBackupCodes,
      });

      const now = Date.now();
      setIsUnlocked(true);
      try {
        localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
      } catch {}
      setLastActiveTime(now);
      return true;
    }

    return false;
  };

  // 首次设置或修改主密码 (生成高随机盐 + 100,000次 PBKDF2-SHA256)
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
    try {
      localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
      localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
    } catch {}
    setLastActiveTime(now);
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

  // 立即手动锁屏 / 登出
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
    verifyPassword,
    verify2FACode,
    setMasterPassword,
    enable2FA,
    disable2FA,
    lockNow,
    recordActivity,
  };
}
