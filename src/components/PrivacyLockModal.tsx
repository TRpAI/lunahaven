import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  ScanFace,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface PrivacyLockModalProps {
  hasPassword: boolean;
  onVerifyPassword: (password: string) => Promise<{ success: boolean; requires2FA: boolean }>;
  onVerify2FACode: (codeOrBackup: string) => Promise<boolean>;
  onSetPassword: (password: string) => Promise<boolean> | boolean;
  isBiometricActive?: boolean;
  onUnlockWithBiometrics?: () => Promise<{ success: boolean; error?: string }>;
  biometricDeviceName?: string;
}

export const PrivacyLockModal: React.FC<PrivacyLockModalProps> = ({
  hasPassword,
  onVerifyPassword,
  onVerify2FACode,
  onSetPassword,
  isBiometricActive = false,
  onUnlockWithBiometrics,
  biometricDeviceName,
}) => {
  const [step, setStep] = useState<'password' | 'twoFactor'>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorInput, setTwoFactorInput] = useState('');
  const [isBackupCodeMode, setIsBackupCodeMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState(30 - (Math.floor(Date.now() / 1000) % 30));

  // 30s TOTP 周期倒计时
  useEffect(() => {
    if (step !== 'twoFactor') return;
    const interval = setInterval(() => {
      const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
      setTotpSecondsRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // 如果启用了生物识别，初次加载时尝试自动触发一次生物识别
  useEffect(() => {
    if (hasPassword && isBiometricActive && onUnlockWithBiometrics && step === 'password') {
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [hasPassword, isBiometricActive, onUnlockWithBiometrics, step]);

  const handleBiometricAuth = async () => {
    if (!onUnlockWithBiometrics || isBiometricLoading) return;
    setIsBiometricLoading(true);
    setErrorMsg('');
    try {
      const res = await onUnlockWithBiometrics();
      if (!res.success && res.error) {
        if (!res.error.includes('取消') && !res.error.includes('canceled')) {
          setErrorMsg(`生物识别: ${res.error}`);
        }
      }
    } catch (err: any) {
      setErrorMsg(`生物识别异常: ${err.message || err}`);
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('请输入访问密码');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await onVerifyPassword(password.trim());
      if (!res.success) {
        setErrorMsg('密码错误，请重新确认后输入');
        setPassword('');
      } else {
        setErrorMsg('');
        if (res.requires2FA) {
          setStep('twoFactor');
        }
      }
    } catch {
      setErrorMsg('密码验证出错，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = twoFactorInput.trim();
    if (!code) {
      setErrorMsg(isBackupCodeMode ? '请输入备用应急恢复码' : '请输入 6 位动态口令');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const ok = await onVerify2FACode(code);
      if (!ok) {
        setErrorMsg(isBackupCodeMode ? '备用恢复码无效或已使用' : '验证码错误或已过期，请重试');
        setTwoFactorInput('');
      }
    } catch {
      setErrorMsg('验证发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('请输入要设置的新密码');
      return;
    }
    if (password.length < 4) {
      setErrorMsg('密码长度不能少于 4 位字符');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致，请核对');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      await onSetPassword(password.trim());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] transition-all duration-300">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-7 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Lock Icon */}
        <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
          {step === 'twoFactor' ? (
            <Smartphone className="w-5 h-5 text-zinc-800 dark:text-zinc-200" />
          ) : !hasPassword ? (
            <KeyRound className="w-5 h-5 text-zinc-800 dark:text-zinc-200" />
          ) : isBiometricActive ? (
            <Fingerprint className="w-5 h-5 text-indigo-500 animate-pulse" />
          ) : (
            <Lock className="w-5 h-5" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {!hasPassword
            ? '创建私有访问主密码'
            : step === 'twoFactor'
            ? '二步验证 (2FA)'
            : '单用户私有访问'}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-5">
          {!hasPassword
            ? '首次使用，请为您的私有账本创建唯一主密码'
            : step === 'twoFactor'
            ? (isBackupCodeMode ? '请输入 8 位应急备用恢复码' : '请输入身份验证器中的 6 位动态口令')
            : isBiometricActive
            ? '支持使用 Touch ID / Face ID / 指纹或密码快速解锁'
            : '本系统处于私有单用户保护模式，请输入密码解锁'}
        </p>

        {/* 生物识别一键快速解锁按钮 (若已开启) */}
        {hasPassword && step === 'password' && isBiometricActive && onUnlockWithBiometrics && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleBiometricAuth}
              disabled={isBiometricLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Fingerprint className={`w-4 h-4 ${isBiometricLoading ? 'animate-spin' : ''}`} />
              <span>{isBiometricLoading ? '正在唤醒生物识别...' : '使用指纹 / 面容 / 生物识别解锁'}</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-400">或使用主密码解锁</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Master Password Login */}
        {hasPassword && step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                autoFocus={!isBiometricActive}
                placeholder="输入访问密码..."
                className="w-full px-4 py-3 pr-10 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-mono text-center tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 text-left">
                <p className="font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? '正在验证...' : '验证密码进入'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Step 2: Two-Factor Authentication TOTP or Backup Code */}
        {hasPassword && step === 'twoFactor' && (
          <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                maxLength={isBackupCodeMode ? 10 : 6}
                value={twoFactorInput}
                onChange={(e) => {
                  setTwoFactorInput(e.target.value.toUpperCase());
                  setErrorMsg('');
                }}
                autoFocus
                placeholder={isBackupCodeMode ? '如: 7K9A-4E2F' : '6 位动态口令'}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-mono text-center tracking-widest"
              />
            </div>

            {!isBackupCodeMode && (
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>口令每 30 秒更新，剩余 <b>{totpSecondsRemaining}s</b></span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 text-left">
                <p className="font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isLoading ? '正在校验...' : '校验并解锁系统'}</span>
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('password');
                  setTwoFactorInput('');
                  setErrorMsg('');
                }}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回密码</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBackupCodeMode(!isBackupCodeMode);
                  setTwoFactorInput('');
                  setErrorMsg('');
                }}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                {isBackupCodeMode ? '使用 6 位 TOTP 动态码' : '使用 8 位应急恢复码'}
              </button>
            </div>
          </form>
        )}

        {/* Initial Master Password Setup */}
        {!hasPassword && (
          <form onSubmit={handleInitPassword} className="space-y-3.5">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                autoFocus
                placeholder="设置主密码 (4位及以上)..."
                className="w-full px-4 py-2.5 pr-10 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono text-center tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="再次输入以确认主密码..."
                className="w-full px-4 py-2.5 pr-10 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono text-center tracking-wider"
              />
            </div>

            {errorMsg && (
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 text-left">
                <p className="font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? '正在保存...' : '完成设置并开启私有保护'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-1.5 text-[10px] text-zinc-400">
          <Shield className="w-3 h-3 text-emerald-500" />
          <span>PBKDF2-SHA256 · WebAuthn 生物识别 · 本地安全加密</span>
        </div>
      </div>
    </div>
  );
};
