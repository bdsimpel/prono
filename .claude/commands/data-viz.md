# FCB Prono — Data Visualization Guide

When creating charts and data visualizations, follow these conventions.

## General Approach

- **Hand-crafted SVG** — no external chart libraries (Recharts, Chart.js, etc.)
- Keep it simple and performant — data volumes are tiny (~60 players, 31 matches)
- All visualizations use the Club Brugge dark theme
- Charts render inside `.glass-card-subtle` containers (NOT `.glass-card`)
- Put related charts side by side on desktop: `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`

## Color Rules

- **All bars in a chart use the same color** — `cb-blue` (`#005a94`) by default
- Do NOT vary bar color per item (no team-specific colors per bar)
- Same opacity for all bars — no fading
- For items without an icon (e.g., "Neutraal"): use gray `#4b5563`
- **Never use green** (`#22c55e`) — use `cb-gold` or `cb-blue` instead

## Semantic Colors

| Context | Color | Token |
|---------|-------|-------|
| Home / Primary | `#C9A84C` | `cb-gold` |
| Away / Secondary | `#005a94` | `cb-blue` |
| Draw / Neutral | `#6b7280` | gray-500 |
| Selected state | gold ring | `ring-2 ring-cb-gold` |

## Reusable Components

### HorizontalBarChart (`components/stats/charts/HorizontalBarChart.tsx`)

Reusable horizontal bar chart with:
- `items: BarChartItem[]` — `{ label, value, icon?, details? }`
- `defaultVisible` — show N items, rest behind "Toon alle" toggle (default: 6)
- `expandLabel` — label for the expand button (e.g., "ploegen")
- `showPercentage` — show % column
- `formatValue` — custom formatter (e.g., `.toFixed(1)`)
- `details` — array of strings shown when clicking a row (with chevron toggle)

Use this for any ranked list visualization. All bars use `cb-blue`.

## Chart Types

### Horizontal Bar Chart
```
Track:  h-3 bg-white/[0.06] rounded-full
Fill:   h-3 rounded-full bg-cb-blue, transition-all duration-500
Label:  text-sm font-medium text-gray-200 (left), text-sm font-bold text-white (right)
```

### Score Heatmap (6×6 grid)
- Cells use `cb-blue` with opacity proportional to count: `rgba(0, 90, 148, intensity)`
- Empty cells: very low opacity (0.05)
- Clickable cells: `cursor-pointer hover:ring-1 hover:ring-white/30`
- Selected cell: `ring-2 ring-cb-gold`
- X-axis label ABOVE the grid, Y-axis label on the left (rotated)
- Legend at bottom: "Minder [gradient boxes] Meer"
- Click a cell → show detail panel with matches grouped by game

### Stacked Percentage Bar (e.g., Home/Draw/Away)
```tsx
<div className="h-4 rounded-full overflow-hidden flex">
  <div style={{ width: `${pct1}%`, backgroundColor: "var(--color-cb-gold)" }} />
  <div style={{ width: `${pct2}%`, backgroundColor: "#6b7280" }} />
  <div style={{ width: `${pct3}%`, backgroundColor: "var(--color-cb-blue)" }} />
</div>
```
- Labels above with inline SVG icons in matching colors
- Icons: house (gold, home), equals lines (gray, draw), bus (blue, away)

### SVG Line Chart
```tsx
<svg viewBox="0 0 width height" className="w-full">
  <line stroke="rgba(255,255,255,0.06)" />  {/* Grid lines */}
  <polyline fill="none" stroke={seriesColor} strokeWidth="2" points="..." />
  <circle r="4" fill={seriesColor} />
  <text fill="#9ca3af" fontSize="12">Label</text>
</svg>
```

### Tables
- Container: `glass-card-subtle overflow-hidden`
- Desktop: `<table>` with header row, hover states
- Mobile: flex-based rows or compact layout
- Header: `text-[11px] text-gray-500 uppercase tracking-wider`
- Column abbreviations in Dutch (e.g., "Gem. DV" = Gemiddeld Doelpunten Voor)

## Interaction Patterns

- **Expandable bar items:** Click to show detail names (chevron rotates)
- **Clickable heatmap cells:** Show detail panel with match list
- **Mobile scroll:** `scrollIntoView({ behavior: "smooth", block: "start" })` when showing detail panels
- **Mobile limits:** Show max 6 items, "Toon alle X" / "Toon minder" toggle
- **Desktop limits:** Scroll within container, max-height matched to adjacent panel via `ResizeObserver`

## Styling Rules

- Background: charts sit on `--color-cb-card` (#111827) via `.glass-card-subtle`
- Grid lines: `rgba(255, 255, 255, 0.06)` — very subtle
- Axis text: `text-gray-500` / `#6b7280`
- Data labels: `text-white` for values, `text-gray-400` for descriptions
- All transitions: `transition-all duration-500` for bar fills, `duration-200` for hover

## Responsive Behavior

- Put charts side by side on desktop, stacked on mobile
- SVG charts use `viewBox` + `className="w-full"` for responsive scaling
- Bar charts work well on all sizes — prefer them for mobile
- Detail panels: scroll on desktop (max-height from ResizeObserver), paginate on mobile

## Icons in Charts

- Use single-color inline SVGs — NEVER emoji
- Match icon color to semantic meaning (gold=home, blue=away, gray=neutral)
- Size: `w-4 h-4` for labels

## Reference Implementation

See `fcb-prono/src/components/stats/tabs/OverzichtTab.tsx` for working examples of:
- HorizontalBarChart usage with expandable details
- Score heatmap with clickable cells and detail panel
- Stacked percentage bar (home/draw/away)
- Team popularity table
- Grouped average points with dropdown selector
