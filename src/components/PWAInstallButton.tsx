import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as standalone app, do not show
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop Install Prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors cursor-pointer"
        title="安装应用到主屏幕"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">安装应用</span>
        <span className="sm:hidden">安装</span>
      </button>
    );
  }

  // iOS Safari Flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          title="在 iPhone / iPad 上安装"
        >
          <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
          <span className="hidden sm:inline">添加到主屏幕</span>
          <span className="sm:hidden">安装</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4 border border-zinc-200/50 dark:border-zinc-700/50">
                <Smartphone className="w-6 h-6" />
              </div>
              
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                安装至 iPhone / iPad 主屏幕
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                栖月账本支持离线独立运行，添加到桌面后可拥有如同原生 App 的极简沉浸体验：
              </p>

              <div className="mt-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="flex items-start gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold shrink-0">1</span>
                  <span>点击 Safari 浏览器底部的 <strong>分享按钮 (Share)</strong> 图标</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold shrink-0">2</span>
                  <span>在弹出的选项中向下滑动，找到并点击 <strong>添加到主屏幕</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold shrink-0">3</span>
                  <span>右上角点击 <strong>添加</strong> 即可从桌面即点即用</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
