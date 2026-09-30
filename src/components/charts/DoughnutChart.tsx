import React, { useState } from 'react';

export interface DoughnutSegment {
  label: string;
  value: number;
  color: string;
  subText?: string;
}

interface DoughnutChartProps {
  segments: DoughnutSegment[];
  centerTitle?: string;
  centerSubtitle?: string;
  valueFormatter?: (val: number) => string;
  size?: number;
}

export const DoughnutChart: React.FC<DoughnutChartProps> = ({
  segments,
  centerTitle,
  centerSubtitle,
  valueFormatter = (v) => `${v}`,
  size = 180,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0 || segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-zinc-400 dark:text-zinc-500">
        暂无分类数据
      </div>
    );
  }

  const radius = 65;
  const strokeWidth = 22;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
      {/* 环形图 */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full transform -rotate-90">
          {/* 背景底圈 */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-zinc-100 dark:text-zinc-800/80"
            strokeWidth={strokeWidth}
          />

          {segments.map((seg, idx) => {
            if (seg.value <= 0) return null;
            const percent = seg.value / total;
            const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
            const strokeDashoffset = -circumference * accumulatedPercent;
            accumulatedPercent += percent;

            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* 中心文字 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
          {hoveredIdx !== null && segments[hoveredIdx] ? (
            <>
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-[90px]">
                {segments[hoveredIdx].label}
              </span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {Math.round((segments[hoveredIdx].value / total) * 100)}%
              </span>
              <span className="text-[10px] text-zinc-400 truncate max-w-[90px] font-mono">
                {valueFormatter(segments[hoveredIdx].value)}
              </span>
            </>
          ) : (
            <>
              {centerSubtitle && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{centerSubtitle}</span>
              )}
              {centerTitle && (
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono truncate max-w-[100px]">
                  {centerTitle}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* 图例列表 */}
      <div className="flex flex-col gap-2 w-full max-w-[220px]">
        {segments.map((seg, idx) => {
          const percent = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center justify-between text-xs p-1.5 rounded-xl cursor-pointer transition-colors ${
                isHovered ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2 text-right shrink-0">
                <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold text-[11px]">
                  {valueFormatter(seg.value)}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono w-7 text-right">{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
