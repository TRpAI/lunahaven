import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface PrivacyLockModalProps {
  hasPassword: boolean;
  onVerifyPassword: (password: string) => Promise<{ success: boolean; requires2FA: boolean }>;
  onVerify2FACode: (codeOrBackup: string) => Promise<boolean>;
  onSetPassword: (password: string) => Promise<boolean> | boolean;
  onResetToDefault?: () => Promise<boolean> | boolean;
}

export const PrivacyLockModal: React.FC<PrivacyLockModalProps> = ({
  hasPassword,
  onVerifyPassword,
  onVerify2FACode,
  onSetPassword,
  onResetToDefault,
}) => {
  const [step, setStep] = useState<'password' | 'twoFactor'>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorInput, setTwoFactorInput] = useState('');
  const [isBackupCodeMode, setIsBackupCodeMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
        setErrorMsg('密码错误，请确认或重试。若忘记密码可使用下方一键重置。');
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
      setErrorMsg('请输入要设置的密码');
      return;
    }
    if (password.length < 4) {
      setErrorMsg('密码长度不能少于 4 位');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致');
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

  const handleQuickFillDefault = async () => {
    setPassword('123456');
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await onVerifyPassword('123456');
      if (!res.success) {
        // 如果 123456 与当前存储不匹配，直接触发一键重置为 123456
        if (onResetToDefault) {
          await onResetToDefault();
        } else {
          setErrorMsg('密码已被修改，非默认密码 123456');
        }
      } else if (res.requires2FA) {
        setStep('twoFactor');
      }
    } catch {
      if (onResetToDefault) {
        await onResetToDefault();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    if (window.confirm('是否将访问密码重置为默认密码 123456？\n重置后将自动解锁并直接进入系统，您的记账、薪资与车辆数据完全保留不受任何影响。')) {
      if (onResetToDefault) {
        setIsLoading(true);
        setErrorMsg('');
        try {
          await onResetToDefault();
        } catch (err: any) {
          setErrorMsg(`重置失败: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 transition-all duration-300">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-7 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Lock Icon */}
        <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
          {step === 'twoFactor' ? (
            <Smartphone className="w-5 h-5 text-zinc-800 dark:text-zinc-200" />
          ) : (
            <Lock className="w-5 h-5" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {!hasPassword
            ? '设置主密码'
            : step === 'twoFactor'
            ? '二步验证 (2FA)'
            : '单用户私有访问'}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-5">
          {!hasPassword
            ? '首次使用，请设置本站唯一的访问密码'
            : step === 'twoFactor'
            ? (isBackupCodeMode ? '请输入 8 位应急备用恢复码' : '请输入身份验证器中的 6 位动态口令')
            : '本系统处于私有单用户保护模式，请输入密码解锁'}
        </p>

        {/* Step 1: Master Password */}
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
                autoFocus
                placeholder="输入访问密码..."
                className="w-full px-4 py-3 pr-10 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-mono text-center tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 text-left space-y-1.5">
                <p className="font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </p>
                {onResetToDefault && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="w-full text-center py-1.5 mt-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-800 text-rose-700 dark:text-rose-200 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    立即重置为默认密码 (123456) 并解锁
                  </button>
                )}
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

            <div className="pt-2 flex flex-col items-center gap-1.5 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1">
                <span>默认演示密码: <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300">123456</code></span>
                <button
                  type="button"
                  onClick={handleQuickFillDefault}
                  className="text-zinc-600 dark:text-zinc-300 hover:underline font-medium ml-1 cursor-pointer"
                >
                  (填入并解锁)
                </button>
              </div>

              {onResetToDefault && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-[11px] transition-colors cursor-pointer mt-1 hover:underline"
                >
                  忘记密码？一键重置为默认密码 123456
                </button>
              )}
            </div>
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
              <p className="text-xs text-rose-500 font-medium">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoading ? '正在验证...' : '确认并完成解锁'}</span>
            </button>

            <div className="flex items-center justify-between text-[11px] pt-1 text-zinc-400">
              <button
                type="button"
                onClick={() => {
                  setStep('password');
                  setErrorMsg('');
                  setTwoFactorInput('');
                }}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>返回密码</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBackupCodeMode(!isBackupCodeMode);
                  setErrorMsg('');
                  setTwoFactorInput('');
                }}
                className="hover:text-zinc-700 dark:hover:text-zinc-200 underline font-medium cursor-pointer"
              >
                {isBackupCodeMode ? '切换为动态口令' : '使用备用恢复码'}
              </button>
            </div>

            {onResetToDefault && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-[11px] transition-colors cursor-pointer hover:underline"
                >
                  无法获取 2FA 验证码？一键重置密码与 2FA
                </button>
              </div>
            )}
          </form>
        )}

        {/* First time initialization */}
        {!hasPassword && (
          <form onSubmit={handleInitPassword} className="space-y-3.5 text-left">
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                创建主密码
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                autoFocus
                placeholder="设置 4 位及以上密码..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                确认主密码
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="再次输入确认..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-500 font-medium">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>确认保存并登录</span>
            </button>
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <Shield className="w-3.5 h-3.5" />
          <span>PBKDF2-SHA256 高强加密保护 · 本地私有</span>
        </div>
      </div>
    </div>
  );
};
