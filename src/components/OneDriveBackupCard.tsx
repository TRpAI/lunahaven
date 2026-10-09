import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  CloudCog,
  CloudUpload,
  Copy,
  ExternalLink,
  FolderSync,
  History,
  Info,
  KeyRound,
  LogOut,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AppSettings, LedgerFullData, OneDriveConfig } from '../types';
import {
  downloadBackupFromOneDrive,
  formatByteSize,
  getOneDriveUserInfo,
  listOneDriveBackups,
  OneDriveBackupFile,
  OneDriveUserProfile,
  uploadBackupToOneDrive,
} from '../utils/oneDriveSync';

interface OneDriveBackupCardProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  fullData: LedgerFullData;
  onImportFullData: (data: LedgerFullData) => void;
}

export const OneDriveBackupCard: React.FC<OneDriveBackupCardProps> = ({
  settings,
  onUpdateSettings,
  fullData,
  onImportFullData,
}) => {
  const config: OneDriveConfig = settings.oneDriveConfig || {
    clientId: '',
    accessToken: '',
    refreshToken: '',
    tokenExpiresAt: 0,
    userAccountEmail: '',
    userName: '',
    backupFolder: 'QiyueLedger',
    autoBackup: false,
    backupIntervalHours: 24,
    lastBackupTime: null,
    lastBackupRevision: 0,
    backupStatus: 'idle',
    maxRetentionCount: 20,
  };

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);
  const [restoringFile, setRestoringFile] = useState<OneDriveBackupFile | null>(null);

  // Form State for configuration
  const [tokenInput, setTokenInput] = useState(config.accessToken || '');
  const [folderInput, setFolderInput] = useState(config.backupFolder || 'QiyueLedger');
  const [intervalHours, setIntervalHours] = useState(config.backupIntervalHours || 24);
  const [retentionCount, setRetentionCount] = useState(config.maxRetentionCount || 20);

  // Status & notifications
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [userProfile, setUserProfile] = useState<OneDriveUserProfile | null>(null);
  const [historyFiles, setHistoryFiles] = useState<OneDriveBackupFile[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isConnected = Boolean(config.accessToken && config.accessToken.trim());

  // 校验并加载用户信息
  useEffect(() => {
    if (config.accessToken && config.accessToken.trim()) {
      getOneDriveUserInfo(config.accessToken)
        .then((profile) => {
          setUserProfile(profile);
          if (profile.mail !== config.userAccountEmail || profile.displayName !== config.userName) {
            onUpdateSettings({
              oneDriveConfig: {
                ...config,
                userAccountEmail: profile.mail,
                userName: profile.displayName,
              },
            });
          }
        })
        .catch(() => {
          // Token 可能已过期
        });
    }
  }, [config.accessToken]);

  // 定时自动增量备份触发器 (基于上次备份时间与设定的时间间隔)
  useEffect(() => {
    if (!config.autoBackup || !config.accessToken || isBackingUp) return;

    const checkAndTriggerBackup = async () => {
      const now = Date.now();
      const lastTime = config.lastBackupTime ? new Date(config.lastBackupTime).getTime() : 0;
      const intervalMs = (config.backupIntervalHours || 24) * 60 * 60 * 1000;

      if (now - lastTime >= intervalMs) {
        try {
          setIsBackingUp(true);
          const result = await uploadBackupToOneDrive(
            config.accessToken!,
            config.backupFolder || 'QiyueLedger',
            fullData,
            config.maxRetentionCount || 20
          );
          onUpdateSettings({
            oneDriveConfig: {
              ...config,
              lastBackupTime: result.backupTime,
              lastBackupRevision: fullData.syncMeta?.revision || 1,
              backupStatus: 'success',
              errorMessage: undefined,
            },
          });
        } catch (err: any) {
          console.warn('Scheduled OneDrive backup failed:', err);
          onUpdateSettings({
            oneDriveConfig: {
              ...config,
              backupStatus: 'error',
              errorMessage: err.message,
            },
          });
        } finally {
          setIsBackingUp(false);
        }
      }
    };

    const timer = setTimeout(checkAndTriggerBackup, 3000);
    return () => clearTimeout(timer);
  }, [config.autoBackup, config.accessToken, config.backupIntervalHours, config.lastBackupTime]);

  // 手动执行立即备份
  const handleManualBackup = async () => {
    if (!config.accessToken) {
      setIsConfigOpen(true);
      setStatusMsg({ type: 'info', text: '请先填入并保存微软 OneDrive Access Token 访问令牌' });
      return;
    }

    setIsBackingUp(true);
    setStatusMsg(null);

    try {
      const result = await uploadBackupToOneDrive(
        config.accessToken,
        config.backupFolder || 'QiyueLedger',
        fullData,
        config.maxRetentionCount || 20
      );
      setStatusMsg({
        type: 'success',
        text: `已成功创建 OneDrive 增量备份快照 (${result.fileName}, ${formatByteSize(result.size)})`,
      });
      onUpdateSettings({
        oneDriveConfig: {
          ...config,
          lastBackupTime: result.backupTime,
          lastBackupRevision: fullData.syncMeta?.revision || 1,
          backupStatus: 'success',
          errorMessage: undefined,
        },
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `备份失败: ${err.message}`,
      });
      onUpdateSettings({
        oneDriveConfig: {
          ...config,
          backupStatus: 'error',
          errorMessage: err.message,
        },
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // 打开历史快照列表
  const handleOpenHistoryModal = async () => {
    if (!config.accessToken) {
      setIsConfigOpen(true);
      return;
    }
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const list = await listOneDriveBackups(config.accessToken, config.backupFolder || 'QiyueLedger');
      setHistoryFiles(list);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `获取历史快照失败: ${err.message}` });
    } finally {
      setLoadingHistory(false);
    }
  };

  // 从指定历史快照恢复 (触发二次确认弹窗)
  const handleRestoreFile = (file: OneDriveBackupFile) => {
    if (!config.accessToken) return;
    setRestoringFile(file);
  };

  const executeRestoreFile = async (file: OneDriveBackupFile) => {
    if (!config.accessToken) return;
    setRestoringFile(null);
    setIsRestoring(true);
    try {
      const restored = await downloadBackupFromOneDrive(config.accessToken, file.id);
      onImportFullData(restored);
      setIsHistoryModalOpen(false);
      setStatusMsg({
        type: 'success',
        text: `成功从 OneDrive 快照 (${file.name}) 完整恢复账本数据！`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `恢复失败: ${err.message}` });
    } finally {
      setIsRestoring(false);
    }
  };

  // 保存连接配置
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setStatusMsg({ type: 'error', text: '请输入 Access Token' });
      return;
    }

    try {
      const profile = await getOneDriveUserInfo(tokenInput.trim());
      setUserProfile(profile);
      onUpdateSettings({
        oneDriveConfig: {
          ...config,
          accessToken: tokenInput.trim(),
          backupFolder: folderInput.trim() || 'QiyueLedger',
          backupIntervalHours: intervalHours,
          maxRetentionCount: retentionCount,
          userAccountEmail: profile.mail,
          userName: profile.displayName,
          backupStatus: 'idle',
          errorMessage: undefined,
        },
      });
      setIsConfigOpen(false);
      setStatusMsg({ type: 'success', text: `OneDrive 账户已成功连接 (${profile.displayName || profile.mail})！` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `验证失败: ${err.message}，请确保 Token 包含 Files.ReadWrite 权限` });
    }
  };

  // 执行断开连接
  const executeDisconnect = () => {
    setIsDisconnectConfirmOpen(false);
    onUpdateSettings({
      oneDriveConfig: {
        ...config,
        accessToken: '',
        refreshToken: '',
        userAccountEmail: '',
        userName: '',
        autoBackup: false,
        lastBackupTime: null,
        backupStatus: 'idle',
      },
    });
    setUserProfile(null);
    setTokenInput('');
    setStatusMsg({ type: 'info', text: '已断开 OneDrive 账户连接' });
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4 relative overflow-hidden animate-in fade-in duration-200">
      {/* 顶部标题与状态 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0 mt-0.5">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>定时增量备份到 OneDrive</span>
              </h3>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{userProfile?.displayName || config.userName || '已连接'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  未配置授权
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              基于 Microsoft Graph 协议 · 自动定时创建增量快照 · 独立保留灾备版本
            </p>
          </div>
        </div>

        {/* 快捷配置按钮 */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <CloudCog className="w-3.5 h-3.5 text-zinc-500" />
            <span>{isConnected ? '连接与参数' : '配置 OneDrive'}</span>
          </button>
        </div>
      </div>

      {/* 状态与配额提示 */}
      {isConnected && userProfile?.quota && (
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="text-[11px]">云端存储目录:</span>
            <code className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-zinc-800 dark:text-zinc-200 text-[11px]">
              /{config.backupFolder || 'QiyueLedger'}
            </code>
          </div>
          <div className="text-[11px] text-zinc-400">
            空间使用: {formatByteSize(userProfile.quota.used)} / {formatByteSize(userProfile.quota.total)}
          </div>
        </div>
      )}

      {/* 操作按钮区 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
        <button
          type="button"
          onClick={handleManualBackup}
          disabled={isBackingUp}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <CloudUpload className={`w-4 h-4 ${isBackingUp ? 'animate-bounce' : ''}`} />
          <span>{isBackingUp ? '正在上传快照...' : '立即备份到 OneDrive'}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenHistoryModal}
          disabled={!isConnected}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium transition-colors cursor-pointer disabled:opacity-40"
        >
          <History className="w-4 h-4 text-zinc-500" />
          <span>查看历史版本与恢复</span>
        </button>

        {/* 自动增量备份切换 */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/60 dark:bg-zinc-800/40">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">定时自动增量</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isConnected) {
                setIsConfigOpen(true);
                return;
              }
              onUpdateSettings({
                oneDriveConfig: {
                  ...config,
                  autoBackup: !config.autoBackup,
                },
              });
            }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
              config.autoBackup ? 'bg-sky-500' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                config.autoBackup ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 备份执行信息与时间记录 */}
      {config.lastBackupTime && (
        <div className="pt-2 text-[11px] text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-t border-zinc-100 dark:border-zinc-800">
          <span>上次成功备份: {config.lastBackupTime} (Revision #{config.lastBackupRevision || 1})</span>
          <span className="text-sky-500 dark:text-sky-400 font-medium">
            {config.autoBackup ? `已开启自动备份 (每 ${config.backupIntervalHours} 小时)` : '已关闭定时备份'}
          </span>
        </div>
      )}

      {statusMsg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : statusMsg.type === 'error'
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button type="button" onClick={() => setStatusMsg(null)} className="p-0.5 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 展开配置面板 */}
      {isConfigOpen && (
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-4 animate-in slide-in-from-top-2 duration-200 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-700/80 pb-2">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <CloudCog className="w-4 h-4 text-sky-500" />
              <span>OneDrive 微软云备份参数配置</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-3.5 max-w-xl">
            <div>
              <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                Microsoft Graph Access Token (访问令牌)
              </label>
              <input
                type="password"
                placeholder="填入含 Files.ReadWrite 权限的微软 Access Token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                支持通过 Microsoft Entra ID 应用登记获取，或使用 Graph Explorer 生成的 Personal Token。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                  OneDrive 备份目录
                </label>
                <input
                  type="text"
                  placeholder="QiyueLedger"
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                  定时备份频率
                </label>
                <select
                  value={intervalHours}
                  onChange={(e) => setIntervalHours(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-hidden"
                >
                  <option value={6}>每 6 小时</option>
                  <option value={12}>每 12 小时</option>
                  <option value={24}>每天一次 (24小时)</option>
                  <option value={168}>每周一次 (7天)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                  历史快照保留数
                </label>
                <select
                  value={retentionCount}
                  onChange={(e) => setRetentionCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-hidden"
                >
                  <option value={10}>保留最近 10 份</option>
                  <option value={20}>保留最近 20 份</option>
                  <option value={30}>保留最近 30 份</option>
                  <option value={50}>保留最近 50 份</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                验证并保存配置
              </button>

              {isConnected && (
                <button
                  type="button"
                  onClick={() => setIsDisconnectConfirmOpen(true)}
                  className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-medium transition-colors cursor-pointer"
                >
                  断开连接
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* 断开连接确认弹窗 */}
      {isDisconnectConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                断开与微软 OneDrive 的连接？
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                断开后将停止自动备份至微软云盘，本地记账数据不受任何影响。
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsDisconnectConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={executeDisconnect}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                确认断开
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 历史版本快照弹窗 */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">OneDrive 历史云端快照</h3>
                  <p className="text-[11px] text-zinc-400">选择任意历史备份快照进行一键恢复</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-zinc-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-sky-500" />
                <span>正在从 OneDrive 加载快照列表...</span>
              </div>
            ) : historyFiles.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                暂未在 OneDrive 目录中找到备份快照，请先点击「立即备份到 OneDrive」
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {historyFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3 text-xs hover:border-sky-500/40 transition-colors"
                  >
                    <div className="truncate">
                      <div className="font-mono font-medium text-zinc-800 dark:text-zinc-200 truncate" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {new Date(file.lastModifiedDateTime).toLocaleString()} · {formatByteSize(file.size)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestoreFile(file)}
                      disabled={isRestoring}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isRestoring ? '恢复中...' : '恢复此版本'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 恢复快照确认弹窗 (无 window.confirm) */}
      {restoringFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                确认恢复云盘快照？
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                确定要从快照「{restoringFile.name}」恢复账本数据吗？当前本地未备份的数据将被覆盖。
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRestoringFile(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => executeRestoreFile(restoringFile)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer transition-colors"
              >
                确认恢复
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
