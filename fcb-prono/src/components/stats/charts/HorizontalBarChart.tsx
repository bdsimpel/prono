"use client";

import { useState } from "react";

export interface BarChartItem {
  label: string;
  value: number;
  icon?: React.ReactNode;
  details?: string[];
}

interface HorizontalBarChartProps {
  items: BarChartItem[];
  total?: number;
  defaultVisible?: number;
  barColor?: string;
  inactiveBarColor?: string;
  showPercentage?: boolean;
  formatValue?: (value: number) => string;
  expandLabel?: string;
}

export default function HorizontalBarChart({
  items,
  total,
  defaultVisible = 6,
  barColor = "var(--color-cb-blue)",
  inactiveBarColor = "#4b5563",
  showPercentage = true,
  formatValue,
  expandLabel = "items",
}: HorizontalBarChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const hasMore = items.length > defaultVisible;
  const visible = expanded ? items : items.slice(0, defaultVisible);
  const maxValue = items[0]?.value ?? 1;
  const computedTotal = total ?? items.reduce((sum, i) => sum + i.value, 0);
  const hasDetails = items.some((i) => i.details && i.details.length > 0);

  return (
    <div>
      <div className="space-y-4">
        {visible.map((item, i) => {
          const pct =
            computedTotal > 0
              ? Math.round((item.value / computedTotal) * 100)
              : 0;
          const widthPct = (item.value / maxValue) * 100;
          const isOpen = openDetail === item.label;
          const canExpand = hasDetails && item.details && item.details.length > 0;

          return (
            <div key={item.label}>
              <div
                className={`flex items-center justify-between mb-1.5 ${
                  canExpand ? "cursor-pointer" : ""
                }`}
                onClick={() => {
                  if (canExpand) {
                    setOpenDetail(isOpen ? null : item.label);
                  }
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.icon}
                  <span className="text-sm font-medium text-gray-200 truncate">
                    {item.label}
                  </span>
                  {canExpand && (
                    <svg
                      className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-white">
                    {formatValue ? formatValue(item.value) : item.value}
                  </span>
                  {showPercentage && (
                    <span className="text-xs text-gray-500 w-10 text-right">
                      {pct}%
                    </span>
                  )}
                </div>
              </div>
              <div
                className={`h-3 bg-white/[0.06] rounded-full overflow-hidden ${canExpand ? "cursor-pointer" : ""}`}
                onClick={() => {
                  if (canExpand) {
                    setOpenDetail(isOpen ? null : item.label);
                  }
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    opacity: 1,
                    backgroundColor: item.icon ? barColor : inactiveBarColor,
                  }}
                />
              </div>

              {/* Expandable detail list */}
              {isOpen && item.details && (
                <div className="mt-2 ml-1 flex flex-wrap gap-x-3 gap-y-1">
                  {item.details.map((name) => (
                    <span key={name} className="text-xs text-gray-400">
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
          {expanded ? "Toon minder" : `Toon alle ${items.length} ${expandLabel}`}
        </button>
      )}
    </div>
  );
}
