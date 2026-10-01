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

  // 初始化解锁状态：
  // 核心规则：彻底去除「刷新页面自动锁密码」行为！
  // 只要用户在当前浏览器验证过密码并保持登录状态，刷新页面 100% 保持解锁，绝不弹窗锁屏！
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      const unlocked = localStorage.getItem(QIYUE_AUTH_STATUS_KEY);
      if (unlocked === 'true') {
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(Date.now()));
        return true;
      }
      // 兼容历史版本 key
      const legacyAuth =
        localStorage.getItem('qiyue_auth_unlocked_v2') ||
        localStorage.getItem('qiyue_auth_unlocked_v1') ||
        sessionStorage.getItem('qiyue_session_unlocked');
      if (legacyAuth === 'true') {
        localStorage.setItem(QIYUE_AUTH_STATUS_KEY, 'true');
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(Date.now()));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  const [lastActiveTime, setLastActiveTime] = useState<number>(Date.now());
  const lastWriteTimeRef = useRef<number>(Date.now());

  // 记录用户交互活跃状态
  const recordActivity = useCallback(() => {
    const now = Date.now();
    setLastActiveTime(now);

    if (now - lastWriteTimeRef.current > 2000) {
      lastWriteTimeRef.current = now;
      try {
        localStorage.setItem(QIYUE_LAST_ACTIVE_KEY, String(now));
      } catch {}
    }
  }, []);

  // 仅在「页面持续打开且完全无任何用户操作」达到用户在设置中设定的时长时，才执行闲置锁屏
  // （刷新页面本身属于用户操作，刷新时重置时间，永不锁屏）
  const checkContinuousIdleLock = useCallback(() => {
    if (!isUnlocked || !hasPassword) return;

    const autoLockMinutes = typeof settings.autoLockMinutes === 'number' ? settings.autoLockMinutes : 0;
    // 0 或未开启代表从不自动锁定
    if (autoLockMinutes <= 0) return;

    try {
      const savedLastActiveStr = localStorage.getItem(QIYUE_LAST_ACTIVE_KEY);
      const effectiveLastActive = savedLastActiveStr
        ? parseInt(savedLastActiveStr, 10) || lastActiveTime
        : lastActiveTime;
      const elapsedMinutes = (Date.now() - effectiveLastActive) / 60000;

      // 仅当用户在打开的页面上真正闲置超时才锁定
      if (elapsedMinutes >= autoLockMinutes) {
        setIsUnlocked(false);
        localStorage.removeItem(QIYUE_AUTH_STATUS_KEY);
      }
    } catch {}
  }, [isUnlocked, hasPassword, settings.autoLockMinutes, lastActiveTime]);

  // 全局持续闲置监听（仅处理持续停留在当前页面不动的场景）
  useEffect(() => {
    if (!isUnlocked || !hasPassword) return;

    const autoLockMinutes = typeof settings.autoLockMinutes === 'number' ? settings.autoLockMinutes : 0;
    if (autoLockMinutes <= 0) return;

    const timer = setInterval(() => {
      checkContinuousIdleLock();
    }, 10000);

    const handleUserInteraction = () => {
      recordActivity();
    };

    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });

    return () => {
      clearInterval(timer);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [isUnlocked, hasPassword, checkContinuousIdleLock, recordActivity, settings.autoLockMinutes]);

  // 当用户数据初次从 IndexedDB 异步加载就绪后，若已通过认证，维持解锁
  useEffect(() => {
    if (hasPassword && !isUnlocked) {
      try {
        const unlocked = localStorage.getItem(QIYUE_AUTH_STATUS_KEY);
        if (unlocked === 'true') {
          setIsUnlocked(true);
          setLastActiveTime(Date.now());
        }
      } catch {}
    }
  }, [hasPassword, isUnlocked]);

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
    verifyPassword,
    verify2FACode,
    setMasterPassword,
    enable2FA,
    disable2FA,
    lockNow,
    recordActivity,
  };
}
