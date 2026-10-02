import React from 'react';
import { Moon, Sparkles } from 'lucide-react';

interface FooterProps {
  onSelectTab?: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="w-full border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xs transition-colors pt-6 pb-24 lg:pb-6 px-4 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
        {/* 左侧：栖月账本 品牌区 */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs shrink-0">
            <Moon className="w-4 h-4 text-amber-300 dark:text-zinc-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">
                栖月账本
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                v2.6 Pro
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              单用户本地沙盒 · 薪资工时 · 汽车能耗 · 综合开销
            </p>
          </div>
        </div>

        {/* 中间/右侧：四大专属核心技术生态与平台图标 */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
          {/* 1. 栖月账本 图标徽章 */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/70 text-zinc-700 dark:text-zinc-300 transition-all hover:border-zinc-400 dark:hover:border-zinc-500"
            title="栖月账本: 本地优先极速单用户沙盒"
          >
            <div className="w-5 h-5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-amber-300 dark:text-amber-500" />
            </div>
            <span className="font-medium text-xs">栖月账本</span>
          </div>

          {/* 2. Cloudflare 图标徽章 (支持点击快捷前往 D1 视图) */}
          <button
            onClick={() => onSelectTab && onSelectTab('cloudflare')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/70 text-zinc-700 dark:text-zinc-300 hover:border-amber-400 dark:hover:border-amber-600/80 transition-all cursor-pointer group"
            title="点击进入 Cloudflare D1 边缘数据库与 Workers 同步管理"
          >
            <svg
              className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18.2 10.44a5.55 5.55 0 0 0-10.43-1.74A4.02 4.02 0 0 0 4 12.53a4 4 0 0 0 4 4h10.3a3.69 3.69 0 0 0 3.7-3.7 3.65 3.65 0 0 0-3.8-2.39z"
                fill="#F38020"
              />
              <path
                d="M18.3 16.53H8a4 4 0 0 1-4-4 4.02 4.02 0 0 1 3.77-3.83 5.55 5.55 0 0 1 10.43 1.74 3.65 3.65 0 0 1 3.8 2.39 3.69 3.69 0 0 1-3.7 3.7z"
                fill="#FAAE40"
                opacity="0.85"
              />
            </svg>
            <span className="font-medium text-xs group-hover:text-amber-600 dark:group-hover:text-amber-400">
              Cloudflare
            </span>
          </button>

          {/* 3. Microsoft OneDrive 图标徽章 (支持点击快捷前往 设置/OneDrive) */}
          <button
            onClick={() => onSelectTab && onSelectTab('settings')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/70 text-zinc-700 dark:text-zinc-300 hover:border-sky-400 dark:hover:border-sky-600/80 transition-all cursor-pointer group"
            title="点击前往设置：查看 Microsoft OneDrive 增量自动备份"
          >
            <svg
              className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.14 8.52a4.42 4.42 0 0 1 7.91-1.39 5.86 5.86 0 0 1 4.45 5.67 5.9 5.9 0 0 1-5.9 5.9H6.9a5.4 5.4 0 0 1-5.4-5.4 5.37 5.37 0 0 1 4.14-5.24 4.38 4.38 0 0 1 4.5 0.46z"
                fill="#0078D4"
              />
              <path
                d="M13.5 13a4.5 4.5 0 0 0-4.4-3.5 4.4 4.4 0 0 0-3.7 2 5.4 5.4 0 0 0-3.9 5.2 5.4 5.4 0 0 0 5.4 5.4h9.6a5.9 5.9 0 0 0 5.9-5.9 5.86 5.86 0 0 0-4.45-5.67 4.42 4.42 0 0 0-4.45 2.47z"
                fill="#004E8C"
                opacity="0.35"
              />
            </svg>
            <span className="font-medium text-xs group-hover:text-sky-600 dark:group-hover:text-sky-400">
              OneDrive
            </span>
          </button>

          {/* 4. GitHub 图标徽章 */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/70 text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-zinc-400 transition-all cursor-pointer group"
            title="GitHub 源码托管与开源生态"
          >
            <svg
              className="w-4 h-4 shrink-0 fill-zinc-900 dark:fill-zinc-100 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span className="font-medium text-xs group-hover:text-zinc-900 dark:group-hover:text-white">
              GitHub
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
};
