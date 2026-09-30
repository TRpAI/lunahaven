import React from 'react';
import {
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
  onManualSync: () => void;
  isSyncing: boolean;
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
  isSyncing,
  theme,
  onToggleTheme,
  activeTab,
  onSelectTab,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-3 sm:px-4 lg:px-6 py-2.5 transition-colors">
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
          {/* Cloudflare D1 Sync Indicator */}
          {settings.d1Config.workerUrl ? (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 transition-colors"
              title={settings.d1Config.lastSyncTime ? `上次同步: ${settings.d1Config.lastSyncTime}` : '点击同步到 Cloudflare D1'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">
                {isSyncing ? '同步中...' : 'D1同步'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onSelectTab('cloudflare')}
              className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              title="配置 Cloudflare D1 数据库"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden md:inline">本地存储</span>
            </button>
          )}

          {/* Privacy Eye Toggle */}
          <button
            onClick={() => onUpdateSettings({ privacyMaskNumbers: !settings.privacyMaskNumbers })}
            className={`p-2 rounded-xl text-xs transition-colors ${
              settings.privacyMaskNumbers
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
            title={settings.privacyMaskNumbers ? '已开启防窥(数字已隐藏)' : '点击隐藏所有敏感金额'}
          >
            {settings.privacyMaskNumbers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* Lock Screen button */}
          <button
            onClick={onLockScreen}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
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
    </header>
  );
};
