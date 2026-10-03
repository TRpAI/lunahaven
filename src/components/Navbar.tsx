import React, { useState } from 'react';
import {
  Check,
  Cloud,
  Eye,
  EyeOff,
  Lock,
  Moon,
  Plus,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { AppSettings } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onLockScreen: () => void;
  onOpenQuickAdd: () => void;
  onManualSync: () => Promise<boolean> | void;
  onRefreshData?: () => Promise<{ success: boolean; isCloud?: boolean; time?: string; error?: string } | boolean>;
  isSyncing: boolean;
  pendingAutoSyncSeconds?: number | null;
  theme: 'system' | 'light' | 'dark';
  onToggleTheme: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  onUpdateSettings,
  onLockScreen,
  onOpenQuickAdd,
  onManualSync,
  onRefreshData,
  isSyncing,
  pendingAutoSyncSeconds,
  theme,
  onToggleTheme,
  activeTab,
  onSelectTab,
}) => {
  const [localSpinning, setLocalSpinning] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const hasCloud = Boolean(settings.d1Config?.workerUrl);
  const isLoading = isSyncing || localSpinning;

  // 检测是否处于 iOS PWA 独立安装桌面环境或全屏 Standalone 模式 (规避状态栏与网页顶部重叠)
  const isStandalone = typeof window !== 'undefined' && (
    Boolean((window.navigator as any).standalone) ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches)
  );

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => {
      setToastMsg((curr) => (curr?.text === text ? null : curr));
    }, 2500);
  };

  const handleRefreshClick = async () => {
    if (isLoading) return;
    setLocalSpinning(true);

    try {
      if (onRefreshData) {
        const res = await onRefreshData();
        if (typeof res === 'object') {
          if (res.success) {
            showToast(res.isCloud ? '已同步 Cloudflare D1' : '已刷新本地数据缓存');
          } else {
            showToast(res.error || '刷新出错', true);
          }
        } else {
          showToast('已刷新数据');
        }
      } else {
        await onManualSync();
        showToast(hasCloud ? '已同步 Cloudflare D1' : '已刷新本地缓存');
      }
    } catch (err: any) {
      showToast(err.message || '刷新失败', true);
    } finally {
      setTimeout(() => setLocalSpinning(false), 300);
    }
  };

  return (
    <header
      className="sticky top-0 z-30 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-3 sm:px-4 lg:px-6 transition-colors relative ios-header-safe-top"
      style={{
        paddingTop: isStandalone
          ? 'max(calc(0.625rem + env(safe-area-inset-top, 0px)), 3.25rem)'
          : 'max(0.625rem, calc(0.625rem + env(safe-area-inset-top, 0px)))',
        paddingBottom: '0.625rem',
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand (移动端窄屏仅显示精美图标，宽屏显示完整品牌名) */}
        <div
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          title="栖月账本"
        >
          <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs shadow-xs transition-transform group-hover:scale-105 shrink-0">
            栖
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
              栖月账本
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
              D1
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 刷新缓存 / Cloudflare D1 同步按钮 (防窥左侧) */}
          <button
            onClick={handleRefreshClick}
            disabled={isLoading}
            className={`flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
              hasCloud
                ? pendingAutoSyncSeconds !== null && pendingAutoSyncSeconds !== undefined
                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600'
                : 'border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/70 dark:bg-zinc-900/70 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-400'
            }`}
            title={
              hasCloud
                ? pendingAutoSyncSeconds !== null && pendingAutoSyncSeconds !== undefined
                  ? `检测到最新变更，将在 ${pendingAutoSyncSeconds} 秒后自动同步至 D1 (点击可立即同步)`
                  : settings.d1Config.lastSyncTime
                  ? `上次同步: ${settings.d1Config.lastSyncTime} (点击手动双向同步与刷新)`
                  : '点击执行 Cloudflare D1 同步与缓存刷新'
                : '本地离线存储模式 (点击立即重新读取并刷新缓存)'
            }
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">
              {isLoading
                ? '刷新中...'
                : pendingAutoSyncSeconds !== null && pendingAutoSyncSeconds !== undefined
                ? `自动同步(${pendingAutoSyncSeconds}s)`
                : hasCloud
                ? 'D1同步'
                : '刷新缓存'}
            </span>
            {pendingAutoSyncSeconds !== null && pendingAutoSyncSeconds !== undefined && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block md:hidden" />
            )}
          </button>

          {/* Privacy Eye Toggle (防窥按钮) */}
          <button
            onClick={() => onUpdateSettings({ privacyMaskNumbers: !settings.privacyMaskNumbers })}
            className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
              settings.privacyMaskNumbers
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
            title={settings.privacyMaskNumbers ? '已开启防窥 (数字已隐藏)' : '点击开启防窥 (隐藏所有金额)'}
          >
            {settings.privacyMaskNumbers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* Lock Screen button */}
          <button
            onClick={onLockScreen}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            title="锁定屏幕"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* Theme switcher */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            title="切换浅色 / 暗黑模式"
          >
            {theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            )}
          </button>

          {/* PWA Install Button (移动端窄屏以图标形式展现) */}
          <PWAInstallButton />

          {/* Quick Add Button (移动端窄屏以加号图标展现，桌面宽屏显示完整「记一笔」) */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer ml-0.5 shrink-0"
            title="快捷记一笔"
          >
            <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">记一笔</span>
          </button>
        </div>
      </div>

      {/* 实时操作轻量 Toast 提示 */}
      {toastMsg && (
        <div className="absolute left-1/2 -bottom-9 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-1 duration-200">
          <div
            className={`px-3 py-1 rounded-full text-xs shadow-lg border flex items-center gap-1.5 font-medium ${
              toastMsg.isError
                ? 'bg-rose-900 text-rose-100 border-rose-700'
                : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-800 dark:border-zinc-200'
            }`}
          >
            {!toastMsg.isError && <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}
    </header>
  );
};
