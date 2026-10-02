import React, { useState } from 'react';
import {
  Banknote,
  BarChart3,
  Car,
  Cloud,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  ShoppingBag,
  X,
} from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onSelectTab }) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainTabs = [
    { id: 'dashboard', label: '汽车看板', icon: LayoutDashboard },
    { id: 'salary', label: '薪资工时', icon: Banknote },
    { id: 'expenses', label: '日常开销', icon: ShoppingBag },
    { id: 'vehicle', label: '汽车明细', icon: Car },
  ];

  const moreTabs = [
    { id: 'analytics', label: '可视化图表分析', icon: BarChart3, desc: '收入走势 / 综合开支 / 车辆能耗' },
    { id: 'cloudflare', label: 'Cloudflare D1 同步', icon: Cloud, desc: 'D1 架构 / SQL 备份与 Workers' },
    { id: 'settings', label: '系统设置与隐私备份', icon: Settings, desc: '单用户密码 / 冷备份导出 / 恢复' },
  ];

  const isMoreActive = moreTabs.some((t) => t.id === activeTab);

  return (
    <>
      {/* 弹出抽屉菜单 (更多功能) */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex flex-col justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="w-full bg-white dark:bg-zinc-900 rounded-t-3xl p-5 border-t border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">更多模块</span>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {moreTabs.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      setShowMoreMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold'
                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{item.label}</div>
                      <div className="text-[10px] text-zinc-400 truncate">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 底部固定导航栏 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800/80 px-2 py-1.5 safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                  isActive
                    ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}

          {/* 更多触发器 */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
              isMoreActive
                ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">更多</span>
          </button>
        </div>
      </nav>
    </>
  );
};
