import React from 'react';

interface CalendarHeatmapProps {
  datesWithHours: Record<string, number>; // "2026-09-22": 3.5
  daysCount?: number;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ datesWithHours, daysCount = 70 }) => {
  // 生成最近 daysCount 天的日期数组
  const days: { dateStr: string; hours: number; dayOfWeek: number }[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const hours = datesWithHours[dateStr] || 0;
    days.push({
      dateStr,
      hours,
      dayOfWeek: d.getDay(),
    });
  }

  const getColor = (hours: number) => {
    if (hours === 0) return 'bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200/40 dark:border-zinc-700/30';
    if (hours <= 2) return 'bg-zinc-300 dark:bg-zinc-700';
    if (hours <= 4) return 'bg-zinc-500 dark:bg-zinc-500';
    if (hours <= 6) return 'bg-zinc-700 dark:bg-zinc-300';
    return 'bg-zinc-900 dark:bg-zinc-100';
  };

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex flex-col gap-1.5 min-w-[320px]">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">近 {daysCount} 天加班强度日历</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400">少</span>
            <span className="w-2.5 h-2.5 rounded-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50" />
            <span className="w-2.5 h-2.5 rounded-xs bg-zinc-300 dark:bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-xs bg-zinc-500 dark:bg-zinc-500" />
            <span className="w-2.5 h-2.5 rounded-xs bg-zinc-700 dark:bg-zinc-300" />
            <span className="w-2.5 h-2.5 rounded-xs bg-zinc-900 dark:bg-zinc-100" />
            <span className="text-[10px] text-zinc-400">多</span>
          </div>
        </div>

        <div className="grid grid-flow-col grid-rows-7 gap-1 auto-cols-max pt-1">
          {days.map((day, idx) => (
            <div
              key={idx}
              title={`${day.dateStr}: 加班 ${day.hours} 小时`}
              className={`w-3.5 h-3.5 rounded-xs ${getColor(day.hours)} transition-transform hover:scale-125 cursor-pointer`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
