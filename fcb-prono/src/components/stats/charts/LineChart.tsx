"use client";

import { useMemo, useState } from "react";

export interface LineSeries {
  label: string;
  color: string;
  data: { x: number; y: number; label?: string }[];
  dashed?: boolean;
}

interface LineChartProps {
  series: LineSeries[];
  xLabels: string[];
  yLabel?: string;
  height?: number;
  invertY?: boolean;
  yDomain?: [number, number];
}

const PADDING = { top: 20, right: 16, bottom: 44, left: 44 };

export default function LineChart({
  series,
  xLabels,
  yLabel,
  height = 280,
  invertY = false,
  yDomain,
}: LineChartProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: number;
    color: string;
  } | null>(null);

  const BASE_WIDTH = 320;
  const MIN_PX_PER_POINT = 40;
  const pointsNeeded = (xLabels.length > 1 ? xLabels.length - 1 : 1) * MIN_PX_PER_POINT + PADDING.left + PADDING.right;
  const width = Math.max(BASE_WIDTH, pointsNeeded);
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  // Compute Y range
  const { yMin, yMax, yTicks } = useMemo(() => {
    if (yDomain) {
      const [dMin, dMax] = yDomain;
      const range = dMax - dMin || 1;
      const step = range <= 5 ? 1 : range <= 20 ? 5 : range <= 50 ? 10 : Math.ceil(range / 5 / 10) * 10;
      const ticks: number[] = [];
      for (let v = dMin; v <= dMax; v += step) ticks.push(v);
      return { yMin: dMin, yMax: dMax, yTicks: ticks };
    }

    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      for (const d of s.data) {
        if (d.y < min) min = d.y;
        if (d.y > max) max = d.y;
      }
    }
    if (min === Infinity) { min = 0; max = 10; }

    if (invertY) {
      min = Math.max(1, Math.floor(min));
      max = Math.ceil(max * 1.1);
    } else {
      min = Math.min(0, min);
      max = Math.max(max * 1.1, 1);
    }

    const range = max - min || 1;
    const step = range <= 5 ? 1 : range <= 20 ? 5 : range <= 50 ? 10 : Math.ceil(range / 5 / 10) * 10;
    const tickMin = invertY ? Math.max(1, Math.floor(min / step) * step) : Math.floor(min / step) * step;
    const tickMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = tickMin; v <= tickMax; v += step) ticks.push(v);
    return { yMin: tickMin, yMax: tickMax, yTicks: ticks };
  }, [series, invertY, yDomain]);

  const xCount = xLabels.length;
  const xStep = xCount > 1 ? chartW / (xCount - 1) : chartW / 2;
  const yRange = yMax - yMin || 1;

  const toX = (i: number) => PADDING.left + i * xStep;
  const toY = (v: number) => {
    if (invertY) {
      // Inverted: low values (rank 1) at top, high values at bottom
      return PADDING.top + ((v - yMin) / yRange) * chartH;
    }
    return PADDING.top + chartH - ((v - yMin) / yRange) * chartH;
  };

  const needsScroll = width > BASE_WIDTH;

  return (
    <div className="overflow-x-auto md:max-w-lg">
      <div style={{ minWidth: width }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={toY(tick)}
            y2={toY(tick)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={PADDING.left - 8}
            y={toY(tick) + 4}
            textAnchor="end"
            fill="#6b7280"
            fontSize={10}
          >
            {tick === 0 && invertY ? 1 : tick}
          </text>
        ))}

        {/* Y-axis label */}
        {yLabel && (
          <text
            x={14}
            y={PADDING.top + chartH / 2}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={9}
            transform={`rotate(-90, 12, ${PADDING.top + chartH / 2})`}
          >
            {yLabel}
          </text>
        )}

        {/* X-axis labels */}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={toX(i)}
            y={height - 8}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={10}
          >
            {label}
          </text>
        ))}

        {/* Data lines — break into segments at gaps (non-consecutive x) */}
        {series.map((s) => {
          if (s.data.length < 2) return null;
          const sorted = [...s.data].sort((a, b) => a.x - b.x);
          const segments: { x: number; y: number }[][] = [];
          let current: { x: number; y: number }[] = [sorted[0]];
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].x - sorted[i - 1].x > 1) {
              segments.push(current);
              current = [];
            }
            current.push(sorted[i]);
          }
          segments.push(current);

          return segments.map((seg, segIdx) => {
            if (seg.length < 2) return null;
            const points = seg.map((d) => `${toX(d.x)},${toY(d.y)}`).join(" ");
            return (
              <polyline
                key={`${s.label}-${segIdx}`}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                points={points}
              />
            );
          });
        })}

        {/* Data points */}
        {series.map((s) =>
          s.data.map((d) => (
            <circle
              key={`${s.label}-${d.x}`}
              cx={toX(d.x)}
              cy={toY(d.y)}
              r={4}
              fill={s.color}
              stroke="#0a0e14"
              strokeWidth={2}
              className="cursor-pointer"
              onMouseEnter={() =>
                setTooltip({
                  x: toX(d.x),
                  y: toY(d.y),
                  label: s.label,
                  value: d.y,
                  color: s.color,
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          ))
        )}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={tooltip.x - 40}
              y={tooltip.y - 32}
              width={80}
              height={24}
              rx={4}
              fill="#141920"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
            <text
              x={tooltip.x}
              y={tooltip.y - 16}
              textAnchor="middle"
              fill="white"
              fontSize={9}
              fontWeight={600}
            >
              {Math.round(tooltip.value * 10) / 10}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div
              className="w-3 rounded-full"
              style={{
                backgroundColor: s.dashed ? "transparent" : s.color,
                borderBottom: s.dashed ? `2px dashed ${s.color}` : undefined,
                height: s.dashed ? 2 : 3,
              }}
            />
            <span className="text-xs text-gray-400">{s.label}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
