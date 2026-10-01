import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCode,
  FileSpreadsheet,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppSettings, LedgerFullData } from '../../types';
import { generateCloudflareD1SqlDump } from '../../utils/d1Sync';
import {
  exportFuelsToCsv,
  exportGiftsToCsv,
  exportMaintenancesToCsv,
  exportOvertimesToCsv,
  exportSalariesToCsv,
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
  onLockScreen,
  theme,
  onSetTheme,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isCopiedBackups, setIsCopiedBackups] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const is2FAActive = Boolean(settings.isTwoFactorEnabled && settings.twoFactorSecret);
  const backupCodesCount = settings.twoFactorBackupCodes?.length || 0;

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
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.salaries && !parsed.overtimes && !parsed.gifts && !parsed.fuels) {
          throw new Error('备份文件格式不符合预期');
        }
        onImportFullData(parsed);
        alert('成功恢复并导入全部账本数据！');
      } catch (err: any) {
        alert(`导入失败: ${err.message}`);
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
    <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl mx-auto">
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

        {/* CSV 快速导出 */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            分模块 CSV 报表导出
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => {
                const csv = exportSalariesToCsv(fullData.salaries);
                triggerFileDownload(csv, '薪资五险一金明细.csv', 'text/csv;charset=utf-8');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              工资五险 CSV
            </button>
            <button
              onClick={() => {
                const csv = exportOvertimesToCsv(fullData.overtimes);
                triggerFileDownload(csv, '加班调休记录.csv', 'text/csv;charset=utf-8');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              加班工时 CSV
            </button>
            <button
              onClick={() => {
                const csv = exportGiftsToCsv(fullData.gifts);
                triggerFileDownload(csv, '人情随礼礼金账本.csv', 'text/csv;charset=utf-8');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              人情往来 CSV
            </button>
            <button
              onClick={() => {
                const csv = exportFuelsToCsv(fullData.fuels);
                triggerFileDownload(csv, '汽车加油充电记录.csv', 'text/csv;charset=utf-8');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              加油补能 CSV
            </button>
            <button
              onClick={() => {
                const csv = exportMaintenancesToCsv(fullData.maintenances);
                triggerFileDownload(csv, '汽车维修保养记录.csv', 'text/csv;charset=utf-8');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              车辆维保 CSV
            </button>
            <button
              onClick={handleExportD1Sql}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              Cloudflare D1 SQL 脚本
            </button>
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

      {/* 6. 危险区：数据重置 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-xs">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">数据管理</div>
          <p className="text-zinc-400 mt-0.5">重置为标准样例数据或一键清空全部记录</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => {
              if (window.confirm('确定要重置为初始演示数据吗？当前数据将被覆盖。')) {
                onResetDemo();
              }
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer w-full sm:w-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重置样例</span>
          </button>
          <button
            onClick={() => {
              if (window.confirm('警告：确定要清空全部账本数据吗？请确保已提前导出备份。')) {
                onClearAll();
              }
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
