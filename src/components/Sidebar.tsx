import React from 'react';
import {
  Banknote,
  BarChart3,
  Car,
  Cloud,
  LayoutDashboard,
  Settings,
  Shield,
  ShoppingBag,
} from 'lucide-react';

interface NavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  counts: {
    salaries: number;
    overtimes: number;
    expenses?: number;
    fuels: number;
  };
}

export const Sidebar: React.FC<NavProps> = ({ activeTab, onSelectTab, counts }) => {
  const menuItems = [
    { id: 'dashboard', label: '汽车看板', icon: LayoutDashboard, badge: null },
    { id: 'salary', label: '薪资与加班工时', icon: Banknote, badge: (counts.salaries || 0) + (counts.overtimes || 0) },
    { id: 'expenses', label: '日常开销与综合支出', icon: ShoppingBag, badge: counts.expenses || null },
    { id: 'vehicle', label: '汽车加油与维保', icon: Car, badge: counts.fuels },
    { id: 'analytics', label: '数据图表分析', icon: BarChart3, badge: null },
    { id: 'cloudflare', label: 'Cloudflare D1', icon: Cloud, badge: null },
    { id: 'settings', label: '系统与隐私设置', icon: Settings, badge: null },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-transparent border-r border-zinc-200/80 dark:border-zinc-800/80 min-h-[calc(100vh-53px)] p-4 transition-colors">
      <div className="space-y-1 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && item.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-300 dark:bg-zinc-200 dark:text-zinc-700'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Single-user mode footer badge */}
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          <Shield className="w-3.5 h-3.5 text-zinc-400" />
          <span>单用户私密沙盒</span>
        </div>
      </div>
    </aside>
  );
};
