import React, { useState } from 'react';

export interface BarChartItem {
  label: string;
  value1: number;
  value2?: number;
  label1?: string;
  label2?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  color1?: string;
  color2?: string;
  legend1?: string;
  legend2?: string;
  valueFormatter?: (val: number) => string;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  color1 = '#18181b',
  color2 = '#a1a1aa',
  legend1 = '项目 1',
  legend2 = '项目 2',
  valueFormatter = (v) => `${v}`,
  height = 200,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-zinc-400 dark:text-zinc-500">
        暂无走势数据
      </div>
    );
  }

  const allVals = data.flatMap((d) => [d.value1, d.value2 || 0]);
  const maxVal = Math.max(...allVals, 10);
  const hasTwo = data.some((d) => d.value2 !== undefined);

  return (
    <div className="w-full">
      {/* 图例 */}
      <div className="flex items-center justify-end gap-4 mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color1 }} />
          {legend1}
        </span>
        {hasTwo && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color2 }} />
            {legend2}
          </span>
        )}
      </div>

      {/* 柱状容器 */}
      <div className="flex items-end justify-between gap-2 pt-6 pb-2 border-b border-zinc-100 dark:border-zinc-800" style={{ height }}>
        {data.map((item, idx) => {
          const h1 = (item.value1 / maxVal) * (height - 40);
          const h2 = item.value2 !== undefined ? (item.value2 / maxVal) * (height - 40) : 0;
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* 悬停 Tooltip */}
              {isHovered && (
                <div className="absolute -top-10 z-20 px-2.5 py-1.5 bg-zinc-900 text-white rounded-xl text-[10px] shadow-lg whitespace-nowrap pointer-events-none border border-zinc-700/50">
                  <div>{item.label}</div>
                  <div>
                    {legend1}: {valueFormatter(item.value1)}
                  </div>
                  {hasTwo && item.value2 !== undefined && (
                    <div>
                      {legend2}: {valueFormatter(item.value2)}
                    </div>
                  )}
                </div>
              )}

              {/* 柱子区域 */}
              <div className="flex items-end justify-center gap-1 w-full max-w-[36px]">
                {/* 柱 1 */}
                <div
                  className="w-full rounded-t-sm transition-all duration-300"
                  style={{
                    height: Math.max(4, h1),
                    backgroundColor: color1,
                    opacity: isHovered ? 1 : 0.85,
                  }}
                />

                {/* 柱 2 */}
                {hasTwo && (
                  <div
                    className="w-full rounded-t-sm transition-all duration-300"
                    style={{
                      height: Math.max(4, h2),
                      backgroundColor: color2,
                      opacity: isHovered ? 1 : 0.85,
                    }}
                  />
                )}
              </div>

              {/* 底部 X 轴标签 */}
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2 truncate w-full text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
