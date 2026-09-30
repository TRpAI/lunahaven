import React, { useState } from 'react';

export interface LineChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  info?: string;
}

interface LineChartProps {
  data: LineChartPoint[];
  title?: string;
  valueFormatter?: (val: number) => string;
  color?: string;
  secondaryColor?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  valueFormatter = (v) => `${v}`,
  color = '#18181b',
  secondaryColor = '#a1a1aa',
  primaryLabel,
  secondaryLabel,
  height = 200,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-zinc-400 dark:text-zinc-500">
        暂无走势数据
      </div>
    );
  }

  // 计算最大值与最小值
  const allValues = data.flatMap((d) => [d.value, d.secondaryValue !== undefined ? d.secondaryValue : d.value]);
  const maxValue = Math.max(...allValues, 100);
  const minValue = Math.min(...allValues, 0);
  const range = maxValue - minValue || 1;

  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const svgWidth = 500;
  const svgHeight = height;

  const usableWidth = svgWidth - paddingLeft - paddingRight;
  const usableHeight = svgHeight - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + usableWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * usableWidth;
  };

  const getY = (val: number) => {
    return paddingTop + usableHeight - ((val - minValue) / range) * usableHeight;
  };

  // 生成主折线路径
  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`);
  const pathD = `M ${points.join(' L ')}`;

  // 主折线渐变区域
  const areaD = `${pathD} L ${getX(data.length - 1)},${paddingTop + usableHeight} L ${getX(0)},${paddingTop + usableHeight} Z`;

  // 次折线路径
  const hasSecondary = data.some((d) => d.secondaryValue !== undefined);
  let secondaryPathD = '';
  if (hasSecondary) {
    const secPoints = data.map((d, i) => `${getX(i)},${getY(d.secondaryValue || 0)}`);
    secondaryPathD = `M ${secPoints.join(' L ')}`;
  }

  return (
    <div className="w-full select-none">
      {(title || primaryLabel) && (
        <div className="flex items-center justify-between mb-2">
          {title && <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{title}</span>}
          <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            {primaryLabel && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {primaryLabel}
              </span>
            )}
            {hasSecondary && secondaryLabel && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
                {secondaryLabel}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id={`chartGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 背景横向参考虚线 */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = paddingTop + usableHeight * ratio;
            const refVal = maxValue - ratio * range;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-zinc-200 dark:text-zinc-800"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] fill-zinc-400 dark:fill-zinc-500 font-mono"
                >
                  {valueFormatter(Math.round(refVal))}
                </text>
              </g>
            );
          })}

          {/* 填充渐变面积 */}
          <path d={areaD} fill={`url(#chartGrad-${color.replace('#', '')})`} />

          {/* 次线条 (如果有) */}
          {hasSecondary && (
            <path
              d={secondaryPathD}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
            />
          )}

          {/* 主线条 */}
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* 数据圆点 & 悬浮交互探针 */}
          {data.map((d, i) => {
            const x = getX(i);
            const y = getY(d.value);
            const isHovered = hoverIndex === i;

            return (
              <g key={i} className="cursor-pointer" onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                {/* 悬停垂直辅助线 */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + usableHeight}
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    opacity="0.6"
                  />
                )}

                {/* X 轴标签 */}
                <text
                  x={x}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  className={`text-[10px] transition-colors ${
                    isHovered ? 'fill-zinc-900 dark:fill-zinc-100 font-semibold' : 'fill-zinc-400 dark:fill-zinc-500'
                  }`}
                >
                  {d.label}
                </text>

                {/* 主圆点 */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3.5}
                  fill={isHovered ? '#ffffff' : color}
                  stroke={color}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  className="transition-all duration-150"
                />

                {/* 次圆点 */}
                {hasSecondary && d.secondaryValue !== undefined && (
                  <circle
                    cx={x}
                    cy={getY(d.secondaryValue)}
                    r={isHovered ? 4.5 : 3}
                    fill="#ffffff"
                    stroke={secondaryColor}
                    strokeWidth="1.5"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* 悬浮气泡 Tooltip */}
        {hoverIndex !== null && data[hoverIndex] && (
          <div
            className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-xl bg-zinc-900/90 dark:bg-zinc-800 text-white text-[11px] shadow-lg backdrop-blur-xs border border-zinc-700/50"
            style={{
              left: `${(getX(hoverIndex) / svgWidth) * 100}%`,
              top: `${(getY(data[hoverIndex].value) / svgHeight) * 100 - 10}%`,
            }}
          >
            <div className="font-semibold text-zinc-200">{data[hoverIndex].label}</div>
            <div className="font-mono text-zinc-100">
              {primaryLabel || '主数值'}: {valueFormatter(data[hoverIndex].value)}
            </div>
            {hasSecondary && data[hoverIndex].secondaryValue !== undefined && (
              <div className="font-mono text-zinc-300">
                {secondaryLabel || '次数值'}: {valueFormatter(data[hoverIndex].secondaryValue!)}
              </div>
            )}
            {data[hoverIndex].info && <div className="text-[10px] text-zinc-400">{data[hoverIndex].info}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
