import { useEffect, useState } from 'react';
import { AppSettings } from '../types';
import { hashPassword, verifyPasswordHash } from '../utils/crypto';
import { verifyTOTPCode } from '../utils/totp';

const DEMO_PIN_HASH = 'cWl5dWVfbWFzdGVyXzEyMzQ1Nl9hdXRoX3Yy';

export function usePrivacyLock(
  settings: AppSettings,
  onUpdateSettings: (settings: Partial<AppSettings>) => void
) {
  // 生产环境安全策略：有效自定义密码必须存在且不能是遗留的演示弱哈希
  const hasPassword = Boolean(settings.pinHash && settings.pinHash !== DEMO_PIN_HASH);
  const is2FAEnabled = Boolean(settings.isTwoFactorEnabled && settings.twoFactorSecret);

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    // 首次登入无密码时，强制未解锁状态，阻断访问并引导新建主密码
    if (!hasPassword) {
      return false;
    }
    const sessionAuth = sessionStorage.getItem('qiyue_session_unlocked');
    return sessionAuth === 'true';
  });

  const [lastActiveTime, setLastActiveTime] = useState<number>(Date.now());

  const recordActivity = () => {
    setLastActiveTime(Date.now());
  };

  useEffect(() => {
    // 若未创建密码，不可解锁
    if (!hasPassword) {
      setIsUnlocked(false);
      sessionStorage.removeItem('qiyue_session_unlocked');
      return;
    }

    // 定时检查空闲自动锁定
    const interval = setInterval(() => {
      if (isUnlocked && settings.autoLockMinutes > 0) {
        const elapsed = (Date.now() - lastActiveTime) / 1000 / 60;
        if (elapsed >= settings.autoLockMinutes) {
          setIsUnlocked(false);
          sessionStorage.removeItem('qiyue_session_unlocked');
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isUnlocked, hasPassword, settings.autoLockMinutes, lastActiveTime]);

  // 验证第一步主密码 (PBKDF2-SHA256，支持旧版本透明升级与默认兜底)
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

    // 若原密码是旧 Base64 或明文，验证通过后自动无缝升级为高强度 PBKDF2
    if (needsRehash && newHash && newSalt) {
      onUpdateSettings({
        pinHash: newHash,
        passwordSalt: newSalt,
      });
    }

    if (is2FAEnabled) {
      return { success: true, requires2FA: true };
    }

    setIsUnlocked(true);
    sessionStorage.setItem('qiyue_session_unlocked', 'true');
    setLastActiveTime(Date.now());
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
        setIsUnlocked(true);
        sessionStorage.setItem('qiyue_session_unlocked', 'true');
        setLastActiveTime(Date.now());
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

      setIsUnlocked(true);
      sessionStorage.setItem('qiyue_session_unlocked', 'true');
      setLastActiveTime(Date.now());
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
    setIsUnlocked(true);
    sessionStorage.setItem('qiyue_session_unlocked', 'true');
    setLastActiveTime(Date.now());
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

  // 立即锁屏 / 登出
  const lockNow = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('qiyue_session_unlocked');
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
