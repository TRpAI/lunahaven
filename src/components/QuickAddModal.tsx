import React from 'react';
import {
  Banknote,
  Clock,
  Fuel,
  Gift,
  Plus,
  ShoppingBag,
  Wrench,
  X,
} from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (type: 'salary' | 'overtime' | 'expense' | 'fuel' | 'maintenance') => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, onSelectAction }) => {
  if (!isOpen) return null;

  const actions = [
    {
      type: 'salary' as const,
      title: '记录工资薪酬',
      subtitle: '基本工资、五险一金、个税、实发到手',
      icon: Banknote,
      tag: '薪酬',
    },
    {
      type: 'overtime' as const,
      title: '记录加班工时',
      subtitle: '延时/周末/节假日、加班费与调休换算',
      icon: Clock,
      tag: '工时',
    },
    {
      type: 'expense' as const,
      title: '记录日常/医疗/人情/教育开销',
      subtitle: '餐饮日用、门诊就医、随礼人情、培优旅游',
      icon: ShoppingBag,
      tag: '开销',
    },
    {
      type: 'fuel' as const,
      title: '记录汽车加油/充电',
      subtitle: '表显里程、补能量、自动算百公里油耗',
      icon: Fuel,
      tag: '能耗',
    },
    {
      type: 'maintenance' as const,
      title: '记录维修保养',
      subtitle: '机油滤芯、大保、车险续保与下次提醒',
      icon: Wrench,
      tag: '维保',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 relative">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-zinc-500" />
              <span>快捷记一笔</span>
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">选择您要录入的生活或财务模块</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 mt-3.5">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.type}
                onClick={() => {
                  onSelectAction(act.type);
                  onClose();
                }}
                className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-left transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{act.title}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {act.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{act.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
