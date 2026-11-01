import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface DataPoint {
  time: string;
  value: number;
  secondaryValue?: number;
}

interface InteractiveChartProps {
  title: string;
  data: DataPoint[];
  color?: string;
  secondaryColor?: string;
  unit?: string;
  threshold?: number;
  minThreshold?: number;
  maxThreshold?: number;
  height?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  title,
  data,
  color = '#0ea5e9',
  secondaryColor = '#f59e0b',
  unit = '',
  threshold,
  minThreshold,
  maxThreshold,
  height = 180,
  primaryLabel = 'Current',
  secondaryLabel = 'Inlet',
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length < 2) {
    return (
      <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4 h-[240px] flex items-center justify-center text-slate-500">
        Collecting sensor telemetry...
      </div>
    );
  }

  // Calculate scales
  let allValues = data.flatMap(d => (d.secondaryValue !== undefined ? [d.value, d.secondaryValue] : [d.value]));
  if (threshold !== undefined) allValues.push(threshold);
  if (minThreshold !== undefined) allValues.push(minThreshold);
  if (maxThreshold !== undefined) allValues.push(maxThreshold);

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const paddingMargin = (rawMax - rawMin) * 0.1 || 1;
  const minValue = Number((rawMin - paddingMargin).toFixed(1));
  const maxValue = Number((rawMax + paddingMargin).toFixed(1));
  const valueRange = maxValue - minValue || 1;

  const width = 500; // SVG viewBox coordinate width
  const svgHeight = height;
  const chartPadding = { top: 20, right: 20, bottom: 25, left: 45 };

  const plotWidth = width - chartPadding.left - chartPadding.right;
  const plotHeight = svgHeight - chartPadding.top - chartPadding.bottom;

  const getX = (index: number) => chartPadding.left + (index / (data.length - 1)) * plotWidth;
  const getY = (val: number) => chartPadding.top + plotHeight - ((val - minValue) / valueRange) * plotHeight;

  // Primary path
  const primaryPoints = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.value).toFixed(1)}`);
  const primaryPathD = `M ${primaryPoints.join(' L ')}`;
  const primaryAreaD = `${primaryPathD} L ${chartPadding.left + plotWidth},${chartPadding.top + plotHeight} L ${chartPadding.left},${chartPadding.top + plotHeight} Z`;

  // Secondary path (if available)
  const hasSecondary = data.some(d => d.secondaryValue !== undefined);
  let secondaryPathD = '';
  if (hasSecondary) {
    const secPoints = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.secondaryValue ?? d.value).toFixed(1)}`);
    secondaryPathD = `M ${secPoints.join(' L ')}`;
  }

  const gradId = `chart-grad-${title.replace(/\s+/g, '-').toLowerCase()}`;

  const currentHover = hoverIndex !== null ? data[hoverIndex] : data[data.length - 1];

  return (
    <div className="bg-[#121927] border border-[#1f2b3f] hover:border-[#2a3a55] transition-colors rounded-xl p-4 flex flex-col justify-between shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold font-mono text-slate-100">
              {currentHover.value.toFixed(2)}
              <span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
            </span>
            {hasSecondary && currentHover.secondaryValue !== undefined && (
              <span className="text-xs font-mono text-amber-400/90 ml-1">
                ({secondaryLabel}: {currentHover.secondaryValue.toFixed(2)} {unit})
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{primaryLabel}</span>
          </div>
          {hasSecondary && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </div>
          )}
          {threshold !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 border-b border-dashed border-red-400" />
              <span className="text-red-400">Limit ({threshold})</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="90%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = chartPadding.top + plotHeight * ratio;
            const gridVal = (maxValue - ratio * valueRange).toFixed(1);
            return (
              <g key={i}>
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={chartPadding.left + plotWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={chartPadding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Threshold Lines */}
          {threshold !== undefined && (
            <line
              x1={chartPadding.left}
              y1={getY(threshold)}
              x2={chartPadding.left + plotWidth}
              y2={getY(threshold)}
              stroke="#ef4444"
              strokeWidth="1.25"
              strokeDasharray="4 3"
            />
          )}

          {minThreshold !== undefined && (
            <line
              x1={chartPadding.left}
              y1={getY(minThreshold)}
              x2={chartPadding.left + plotWidth}
              y2={getY(minThreshold)}
              stroke="#eab308"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          )}

          {maxThreshold !== undefined && (
            <line
              x1={chartPadding.left}
              y1={getY(maxThreshold)}
              x2={chartPadding.left + plotWidth}
              y2={getY(maxThreshold)}
              stroke="#eab308"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          )}

          {/* Area fill */}
          <path d={primaryAreaD} fill={`url(#${gradId})`} />

          {/* Secondary Line */}
          {hasSecondary && (
            <path
              d={secondaryPathD}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1.75"
              strokeDasharray="3 2"
              strokeLinecap="round"
            />
          )}

          {/* Primary Line */}
          <path
            d={primaryPathD}
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover Crosshair and Dot */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={chartPadding.top}
                x2={getX(hoverIndex)}
                y2={chartPadding.top + plotHeight}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(data[hoverIndex].value)}
                r="4"
                fill={color}
                stroke="#0a0e17"
                strokeWidth="2"
              />
              {hasSecondary && data[hoverIndex].secondaryValue !== undefined && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(data[hoverIndex].secondaryValue!)}
                  r="3.5"
                  fill={secondaryColor}
                  stroke="#0a0e17"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {/* Invisible hover overlay rects */}
          {data.map((_, idx) => {
            const x = getX(idx) - (plotWidth / (data.length - 1)) / 2;
            const w = plotWidth / (data.length - 1);
            return (
              <rect
                key={idx}
                x={Math.max(chartPadding.left, x)}
                y={chartPadding.top}
                width={w}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(idx)}
                className="cursor-crosshair"
              />
            );
          })}
        </svg>

        {/* Floating tooltip when hovering */}
        {hoverIndex !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-1 pointer-events-none bg-slate-900/90 border border-slate-700 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono shadow-xl"
            style={{
              left: `${(getX(hoverIndex) / width) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="text-slate-400 text-[10px]">{data[hoverIndex].time}</div>
            <div className="font-semibold" style={{ color }}>
              {primaryLabel}: {data[hoverIndex].value.toFixed(2)} {unit}
            </div>
            {hasSecondary && data[hoverIndex].secondaryValue !== undefined && (
              <div className="text-amber-400">
                {secondaryLabel}: {data[hoverIndex].secondaryValue.toFixed(2)} {unit}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

