import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCode,
  FileSpreadsheet,
  Fingerprint,
  FolderDown,
  Gift,
  GraduationCap,
  HeartPulse,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  Palmtree,
  Receipt,
  RefreshCw,
  RotateCcw,
  ScanFace,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { AppSettings, LedgerFullData } from '../../types';
import { generateCloudflareD1SqlDump } from '../../utils/d1Sync';
import { forceClearCacheAndReload } from '../../utils/cacheManager';
import {
  exportExpensesToCsv,
  exportFuelsToCsv,
  exportGiftsToCsv,
  exportMaintenancesToCsv,
  exportOvertimesToCsv,
  exportSalariesToCsv,
  parseVersionedJson,
  triggerFileDownload,
} from '../../utils/exportImport';
import { TwoFactorSetupModal } from '../TwoFactorSetupModal';
import { OneDriveBackupCard } from '../OneDriveBackupCard';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  fullData: LedgerFullData;
  onImportFullData: (data: LedgerFullData) => void;
  onResetDemo: () => void;
  onClearAll: () => void;
  onSetPin: (pin: string) => void;
  onEnable2FA?: (secret: string, backupCodes: string[]) => void;
  onDisable2FA?: () => void;
  isBiometricActive?: boolean;
  isBiometricSupported?: boolean;
  isBiometricPlatformAvailable?: boolean;
  biometricDeviceName?: string;
  onEnableBiometrics?: () => Promise<{ success: boolean; deviceName?: string; error?: string }>;
  onDisableBiometrics?: () => void;
  onLockScreen?: () => void;
  theme: 'system' | 'light' | 'dark';
  onSetTheme: (theme: 'system' | 'light' | 'dark') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  fullData,
  onImportFullData,
  onResetDemo,
  onClearAll,
  onSetPin,
  onEnable2FA,
  onDisable2FA,
  isBiometricActive = false,
  isBiometricSupported = true,
  isBiometricPlatformAvailable = true,
  biometricDeviceName,
  onEnableBiometrics,
  onDisableBiometrics,
  onLockScreen,
  theme,
  onSetTheme,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricMsg, setBiometricMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isCopiedBackups, setIsCopiedBackups] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    desc: string;
    onConfirm: () => void;
    isDanger?: boolean;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const is2FAActive = Boolean(settings.isTwoFactorEnabled && settings.twoFactorSecret);
  const backupCodesCount = settings.twoFactorBackupCodes?.length || 0;

  const handleEnableBiometricsClick = async () => {
    if (!onEnableBiometrics) return;
    setBiometricLoading(true);
    setBiometricMsg(null);
    try {
      const res = await onEnableBiometrics();
      if (res.success) {
        setBiometricMsg({
          type: 'success',
          text: `🎉 生物识别已成功绑定 (${res.deviceName || '当前设备'})！下次可直接通过指纹/面容解锁。`,
        });
        showToast('success', '生物识别身份凭据已成功绑定');
      } else {
        setBiometricMsg({ type: 'error', text: res.error || '绑定失败' });
        showToast('error', res.error || '绑定失败');
      }
    } catch (err: any) {
      setBiometricMsg({ type: 'error', text: err.message || '绑定出错' });
      showToast('error', err.message || '绑定出错');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleDisableBiometricsClick = () => {
    setConfirmModal({
      title: '解绑生物识别',
      desc: '确定要解绑并关闭当前设备的生物识别解锁功能吗？解绑后仍可通过主密码解锁。',
      isDanger: true,
      onConfirm: () => {
        if (onDisableBiometrics) onDisableBiometrics();
        setBiometricMsg({ type: 'success', text: '已解绑并关闭生物识别' });
        showToast('info', '已成功解绑并关闭生物识别功能');
      },
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setPasswordMsg({ type: 'error', text: '请输入新密码' });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordMsg({ type: 'error', text: '密码长度至少需 4 位字符' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }

    onSetPin(newPassword);
    setPasswordMsg({ type: 'success', text: '访问主密码已成功更新！' });
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleEnable2FASuccess = (secret: string, backupCodes: string[]) => {
    if (onEnable2FA) {
      onEnable2FA(secret, backupCodes);
    } else {
      onUpdateSettings({
        isTwoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorBackupCodes: backupCodes,
      });
    }
  };

  const handleDisable2FAClick = () => {
    if (window.confirm('确定要关闭二步验证 (2FA) 吗？关闭后将仅依靠主密码保护站点。')) {
      if (onDisable2FA) {
        onDisable2FA();
      } else {
        onUpdateSettings({
          isTwoFactorEnabled: false,
          twoFactorSecret: '',
          twoFactorBackupCodes: [],
        });
      }
    }
  };

  const handleCopyBackupCodes = () => {
    const text = (settings.twoFactorBackupCodes || []).join('\n');
    navigator.clipboard.writeText(text);
    setIsCopiedBackups(true);
    setTimeout(() => setIsCopiedBackups(false), 2000);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(fullData, null, 2);
    triggerFileDownload(
      jsonStr,
      `qiyue_ledger_backup_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8'
    );
    showToast('info', 'JSON 格式完整账本数据已生成导出');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = parseVersionedJson(text);
        onImportFullData(parsed);
        showToast('success', '成功恢复并导入全部账本数据！');
      } catch (err: any) {
        showToast('error', `导入失败: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportD1Sql = () => {
    const sqlContent = generateCloudflareD1SqlDump(fullData);
    triggerFileDownload(
      sqlContent,
      `cloudflare_d1_dump_${new Date().toISOString().slice(0, 10)}.sql`,
      'application/sql;charset=utf-8'
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl mx-auto relative">
      {/* 实时非阻塞通知 Toast */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toastMsg.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-zinc-900 text-white border-zinc-700'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : toastMsg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* 安全操作二次确认弹窗 (无 window.confirm) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.isDanger
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                    : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {confirmModal.isDanger ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  {confirmModal.desc}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const cb = confirmModal.onConfirm;
                  setConfirmModal(null);
                  cb();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors ${
                  confirmModal.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900'
                }`}
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      <TwoFactorSetupModal
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
        onEnableSuccess={handleEnable2FASuccess}
      />

      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
          <Shield className="w-5 h-5 text-zinc-500" />
          <span>系统设置与安全中心</span>
        </h1>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
          单用户访问鉴权 · 二步验证 (2FA) · 数据冷备份与防窥管理
        </p>
      </div>

      {/* 1. 单用户访问权限与主密码 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-zinc-500" />
              <span>单用户主访问密码</span>
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              整站处于私有单用户保护模式，用于登录验证与数据加密
            </p>
          </div>
          {onLockScreen && (
            <button
              onClick={onLockScreen}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title="立即锁屏"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">立即锁屏</span>
            </button>
          )}
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
                设置新主密码
              </label>
              <input
                type="password"
                placeholder="输入 4 位及以上新密码..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
                确认新主密码
              </label>
              <input
                type="password"
                placeholder="再次输入确认..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {passwordMsg ? (
              <span
                className={`text-xs font-medium ${
                  passwordMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                }`}
              >
                {passwordMsg.text}
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold transition-colors cursor-pointer"
            >
              更新主密码
            </button>
          </div>
        </form>

        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">无操作自动锁定时间</span>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                在设定的无操作时间内刷新或重载页面保持解锁，超时后自动锁定保护隐私
              </p>
            </div>
            <select
              value={settings.autoLockMinutes}
              onChange={(e) => onUpdateSettings({ autoLockMinutes: parseInt(e.target.value) })}
              className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs focus:outline-hidden shrink-0"
            >
              <option value={1}>1 分钟 (高安全)</option>
              <option value={5}>5 分钟</option>
              <option value={15}>15 分钟 (默认推荐)</option>
              <option value={30}>30 分钟</option>
              <option value={60}>1 小时</option>
              <option value={240}>4 小时</option>
              <option value={0}>从不自动锁定 (仅手动点击锁屏)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. 二步验证 (2FA / TOTP) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-zinc-500" />
                <span>二步验证 (2FA / TOTP)</span>
              </h3>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  is2FAActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                }`}
              >
                {is2FAActive ? '已启用' : '未开启'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              基于 RFC 6238 标准动态口令。支持 Google Authenticator、苹果系统密码验证器、1Password 等。
            </p>
          </div>

          <div className="w-full sm:w-auto shrink-0 flex justify-start sm:justify-end pt-1 sm:pt-0">
            {!is2FAActive ? (
              <button
                onClick={() => setIs2FAModalOpen(true)}
                className="w-full sm:w-auto text-center px-4 py-2 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                绑定并开启 2FA
              </button>
            ) : (
              <button
                onClick={handleDisable2FAClick}
                className="w-full sm:w-auto text-center px-3.5 py-2 sm:py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium transition-colors cursor-pointer"
              >
                关闭 2FA
              </button>
            )}
          </div>
        </div>

        {is2FAActive && (
          <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>已激活身份验证器保护 · 剩余备用恢复码: <b>{backupCodesCount}</b> 个</span>
              </div>
              <button
                onClick={() => setShowBackupCodes(!showBackupCodes)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline font-medium"
              >
                {showBackupCodes ? '收起恢复码' : '查看剩余恢复码'}
              </button>
            </div>

            {showBackupCodes && (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    应急备用恢复码（每个仅限使用一次）：
                  </span>
                  <button
                    onClick={handleCopyBackupCodes}
                    className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 hover:underline"
                  >
                    {isCopiedBackups ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopiedBackups ? '已复制' : '复制全部'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs text-center text-zinc-800 dark:text-zinc-200">
                  {settings.twoFactorBackupCodes?.map((code, idx) => (
                    <div key={idx} className="py-1 px-2 rounded bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 select-all">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. 生物识别身份验证 (WebAuthn / Touch ID / Face ID / Windows Hello) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1.5 flex-wrap">
                <Fingerprint className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>生物识别身份验证</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center ml-1 ${
                    isBiometricActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                      : !isBiometricSupported
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {isBiometricActive ? '已绑定启用' : !isBiometricSupported ? '浏览器不支持' : '未开启'}
                </span>
              </h3>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              基于 W3C WebAuthn 硬件密钥标准。支持 Apple Touch ID / Face ID、Windows Hello、Android 指纹锁屏免密一触即开。
            </p>
          </div>

          <div className="w-full sm:w-auto shrink-0 flex justify-start sm:justify-end pt-1 sm:pt-0">
            {!isBiometricActive ? (
              <button
                onClick={handleEnableBiometricsClick}
                disabled={biometricLoading || !isBiometricSupported}
                className="w-full sm:w-auto text-center px-4 py-2 sm:py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {biometricLoading ? '正在唤醒硬件...' : '绑定并开启生物识别'}
              </button>
            ) : (
              <button
                onClick={handleDisableBiometricsClick}
                className="w-full sm:w-auto text-center px-3.5 py-2 sm:py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium transition-colors cursor-pointer"
              >
                解绑生物凭据
              </button>
            )}
          </div>
        </div>

        {biometricMsg && (
          <div
            className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
              biometricMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
            }`}
          >
            {biometricMsg.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            )}
            <span>{biometricMsg.text}</span>
          </div>
        )}

        {isBiometricActive && (
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <ScanFace className="w-4 h-4 text-indigo-500" />
              <span>当前已绑定设备：<b className="text-zinc-900 dark:text-zinc-100">{settings.biometricDeviceName || '本设备平台认证器'}</b></span>
            </div>
            <p className="text-[11px] text-zinc-400">
              提示：生物识别凭据严格保存在当前设备的硬件安全芯片（Secure Enclave / TPM）中，若更换设备需在新设备上重新绑定。
            </p>
          </div>
        )}
      </div>

      {/* 3. 防窥与外观偏好 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Eye className="w-4 h-4 text-zinc-500" />
          <span>防窥与显示偏好</span>
        </h3>

        <div className="flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">一键防窥模式 (隐藏敏感金额)</div>
            <p className="text-zinc-400 mt-0.5">将薪资、人情随礼及花费数字替换为掩码保护隐私</p>
          </div>
          <button
            onClick={() => onUpdateSettings({ privacyMaskNumbers: !settings.privacyMaskNumbers })}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs border transition-colors ${
              settings.privacyMaskNumbers
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {settings.privacyMaskNumbers ? '已开启防窥' : '已关闭'}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">外观界面模式</div>
            <p className="text-zinc-400 mt-0.5">极简浅色或深色暗黑模式</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSetTheme('light')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>浅色</span>
            </button>
            <button
              onClick={() => onSetTheme('dark')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-zinc-100 text-zinc-900 border-transparent'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>暗黑</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. 数据备份与冷备份导出 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-zinc-500" />
            <span>数据冷备份与导出</span>
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            随时将数据完整导出为 JSON 或 CSV 电子表格，完全掌握个人数据资产
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <button
            onClick={handleExportJson}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            <span>完整 JSON 备份导出</span>
          </button>

          <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-zinc-500" />
            <span>从 JSON 备份恢复数据</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
        </div>

        {/* CSV 分模块专业报表快速导出 */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>分模块 CSV 专业报表导出</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                按业务模块生成标准 UTF-8 BOM CSV 电子表格，完美兼容 Excel / Numbers
              </p>
            </div>

            <button
              onClick={() => {
                const dateStr = new Date().toISOString().slice(0, 10);
                if (fullData.salaries.length > 0) {
                  triggerFileDownload(exportSalariesToCsv(fullData.salaries), `薪资五险一金明细_${dateStr}.csv`, 'text/csv;charset=utf-8');
                }
                if (fullData.overtimes.length > 0) {
                  triggerFileDownload(exportOvertimesToCsv(fullData.overtimes), `加班工时调休记录_${dateStr}.csv`, 'text/csv;charset=utf-8');
                }
                if ((fullData.expenses || []).length > 0) {
                  triggerFileDownload(exportExpensesToCsv(fullData.expenses || []), `日常与综合开销汇总_${dateStr}.csv`, 'text/csv;charset=utf-8');
                }
                if (fullData.gifts.length > 0) {
                  triggerFileDownload(exportGiftsToCsv(fullData.gifts), `人情往来礼金明细_${dateStr}.csv`, 'text/csv;charset=utf-8');
                }
                if (fullData.fuels.length > 0) {
                  triggerFileDownload(exportFuelsToCsv(fullData.fuels), `汽车加油充电记录_${dateStr}.csv`, 'text/csv;charset=utf-8');
                }
                if (fullData.maintenances.length > 0) {
                  triggerFileDownload(exportMaintenancesToCsv(fullData.maintenances), `汽车维修保养档案_${dateStr}.csv`, 'text/csv;charset=utf-8');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
              title="一键连续导出全部业务模块 CSV 报表"
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span>批量全部导出</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. 薪资与工时 */}
            <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-blue-500" />
                  薪资与工时
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {fullData.salaries.length + fullData.overtimes.length} 笔
                </span>
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    const csv = exportSalariesToCsv(fullData.salaries);
                    triggerFileDownload(csv, `薪资五险一金明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-blue-400 dark:hover:border-blue-500 text-zinc-700 dark:text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Banknote className="w-3 h-3 text-blue-500 shrink-0" />
                    薪资五险一金
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                    {fullData.salaries.length} 条
                  </span>
                </button>
                <button
                  onClick={() => {
                    const csv = exportOvertimesToCsv(fullData.overtimes);
                    triggerFileDownload(csv, `加班工时调休明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-blue-400 dark:hover:border-blue-500 text-zinc-700 dark:text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                    加班工时调休
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                    {fullData.overtimes.length} 条
                  </span>
                </button>
              </div>
            </div>

            {/* 2. 汽车出行档案 */}
            <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-emerald-500" />
                  汽车出行与维保
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {fullData.fuels.length + fullData.maintenances.length} 笔
                </span>
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    const csv = exportFuelsToCsv(fullData.fuels);
                    triggerFileDownload(csv, `汽车加油充电明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-emerald-400 dark:hover:border-emerald-500 text-zinc-700 dark:text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Car className="w-3 h-3 text-emerald-500 shrink-0" />
                    加油充电补能
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                    {fullData.fuels.length} 条
                  </span>
                </button>
                <button
                  onClick={() => {
                    const csv = exportMaintenancesToCsv(fullData.maintenances);
                    triggerFileDownload(csv, `汽车维修保养明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-emerald-400 dark:hover:border-emerald-500 text-zinc-700 dark:text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Wrench className="w-3 h-3 text-teal-500 shrink-0" />
                    车辆维修保养
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                    {fullData.maintenances.length} 条
                  </span>
                </button>
              </div>
            </div>

            {/* 3. 数据库与开发者 */}
            <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-500" />
                  数据库脚本
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">SQL Dump</span>
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={handleExportD1Sql}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-amber-400 dark:hover:border-amber-500 text-zinc-700 dark:text-zinc-300 text-xs transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <FileCode className="w-3 h-3 text-amber-500 shrink-0" />
                    Cloudflare D1 SQL
                  </span>
                  <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                    .sql
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 综合开销各子分类报表导出 */}
          <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-rose-500" />
                综合开销与五大支出分类明细报表
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                共 {(fullData.expenses || []).length} 笔支出
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <button
                onClick={() => {
                  const csv = exportExpensesToCsv(fullData.expenses || []);
                  triggerFileDownload(csv, `全部综合开销汇总_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                }}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-800 dark:text-zinc-200 text-xs transition-colors cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-emerald-500 mb-1" />
                <span className="font-medium text-[11px]">全部综合开销</span>
                <span className="text-[10px] text-zinc-400 font-mono">{(fullData.expenses || []).length} 条</span>
              </button>

              <button
                onClick={() => {
                  const csv = exportExpensesToCsv(fullData.expenses || [], 'living');
                  triggerFileDownload(csv, `日常生活开销明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                }}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-blue-400 text-zinc-800 dark:text-zinc-200 text-xs transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-blue-500 mb-1" />
                <span className="font-medium text-[11px]">日常生活开销</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {(fullData.expenses || []).filter((e) => e.type === 'living').length} 条
                </span>
              </button>

              <button
                onClick={() => {
                  const csv = exportExpensesToCsv(fullData.expenses || [], 'medical');
                  triggerFileDownload(csv, `医疗健康支出明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                }}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-rose-400 text-zinc-800 dark:text-zinc-200 text-xs transition-colors cursor-pointer"
              >
                <HeartPulse className="w-4 h-4 text-rose-500 mb-1" />
                <span className="font-medium text-[11px]">医疗健康支出</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {(fullData.expenses || []).filter((e) => e.type === 'medical').length} 条
                </span>
              </button>

              <button
                onClick={() => {
                  const csv = exportExpensesToCsv(fullData.expenses || [], 'gift');
                  triggerFileDownload(csv, `人情往来随礼账本_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                }}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-pink-400 text-zinc-800 dark:text-zinc-200 text-xs transition-colors cursor-pointer"
              >
                <Gift className="w-4 h-4 text-pink-500 mb-1" />
                <span className="font-medium text-[11px]">人情往来随礼</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {(fullData.expenses || []).filter((e) => e.type === 'gift').length} 条
                </span>
              </button>

              <button
                onClick={() => {
                  const csv = exportExpensesToCsv(fullData.expenses || [], 'education');
                  triggerFileDownload(csv, `教育专项支出明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                }}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-purple-400 text-zinc-800 dark:text-zinc-200 text-xs transition-colors cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-purple-500 mb-1" />
                <span className="font-medium text-[11px]">教育专项支出</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {(fullData.expenses || []).filter((e) => e.type === 'education').length} 条
                </span>
              </button>

              <button
                onClick={() => {
                  const csv = exportExpensesToCsv(fullData.expenses || [], 'travel');
                  triggerFileDownload(csv, `旅游度假支出明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
                }}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-amber-400 text-zinc-800 dark:text-zinc-200 text-xs transition-colors cursor-pointer"
              >
                <Palmtree className="w-4 h-4 text-amber-500 mb-1" />
                <span className="font-medium text-[11px]">旅游度假专款</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {(fullData.expenses || []).filter((e) => e.type === 'travel').length} 条
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. 定时增量备份到 OneDrive */}
      <OneDriveBackupCard
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        fullData={fullData}
        onImportFullData={onImportFullData}
      />

      {/* 6. 生产版本与 Service Worker 缓存管理 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-xs">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
            <span>版本更新与缓存重载</span>
          </div>
          <p className="text-zinc-400 mt-0.5">
            清除浏览器 Service Worker 预缓存与本地静态缓存，强制拉取生产最新构建代码
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => {
              setConfirmModal({
                title: '强制更新与缓存重载',
                desc: '将清理浏览器所有离线 Service Worker 静态缓存并强制拉取生产最新构建代码，确定执行吗？（本地记账数据完整保留）',
                onConfirm: () => {
                  forceClearCacheAndReload();
                },
              });
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-medium transition-colors cursor-pointer w-full sm:w-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>强制清理缓存并更新</span>
          </button>
        </div>
      </div>

      {/* 7. 危险区：数据重置 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-xs">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">数据管理</div>
          <p className="text-zinc-400 mt-0.5">重置为标准样例数据或一键清空全部记录</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => {
              setConfirmModal({
                title: '重置为初始演示数据',
                desc: '确定要重置为初始演示数据吗？当前所有自定义账目将被示例数据覆盖替换。',
                isDanger: true,
                onConfirm: () => {
                  onResetDemo();
                  showToast('info', '已重置为初始演示数据');
                },
              });
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer w-full sm:w-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重置样例</span>
          </button>
          <button
            onClick={() => {
              setConfirmModal({
                title: '警告：彻底清空全部账本数据',
                desc: '此操作将不可逆地彻底清空本地数据库中存储的所有工资、加班、人情、车辆及生活开支记录。请务必确保已提前导出备份！',
                isDanger: true,
                onConfirm: () => {
                  onClearAll();
                  showToast('error', '全部账本数据已清空');
                },
              });
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer w-full sm:w-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空数据</span>
          </button>
        </div>
      </div>
    </div>
  );
};
