# FCB Prono — UI Design Specialist

When designing or building UI components, follow these project-specific patterns. Use the `/fcb-ui` skill for color/styling details.

## Design Philosophy

1. **Dark-first** — all content on dark backgrounds (#0a0e14), no light mode
2. **Restraint** — mostly whites and grays, strategic gold (#C9A84C) and blue (#005a94) accents
3. **No green** — avoid #22c55e; use gold and blue as the two accent colors
4. **No emoji** — use single-color inline SVG icons instead
5. **Title Case** for section titles, sentence case for labels/descriptions
6. **Medal hierarchy** — gold/silver/bronze glows only for top 3 positions
7. **Responsive-first** — mobile bottom nav, desktop sticky header, charts side-by-side on desktop

## Page Layout Pattern

Every page follows this structure (see leaderboard `fcb-prono/src/app/(app)/page.tsx`):

```
<div className="min-h-screen bg-cb-dark">
  <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-16">
    {/* Hero section — uses heading-display for big uppercase titles */}
    {/* Content sections — use text-xl font-semibold text-white for section titles */}
  </div>
</div>
```

## Desktop Layout

- Put related charts/sections side by side: `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`
- Keeps the page compact and avoids overly wide charts
- Tables and complex visualizations (like heatmap + detail panel) use the same grid

## Component Patterns

### Section with Chart
```tsx
<div>
  <h3 className="text-xl font-semibold text-white mb-1">Title</h3>
  <p className="text-xs text-gray-500 mb-4">Question this answers?</p>
  <div className="glass-card-subtle p-4 md:p-5">
    {/* Content */}
  </div>
</div>
```

### Cards
- Use `.glass-card-subtle` for chart/data containers (NOT `.glass-card`)
- Internal padding: `p-4 md:p-5`
- Hover: border color shifts to `rgba(201, 168, 76, 0.3)`

### Tab Navigation
- Desktop: inline buttons with `text-base font-medium`
- Mobile: dropdown with chevron (same style as YearSelector)
- Active tab: `bg-cb-blue text-white`
- Inactive: `text-gray-400 hover:text-white hover:bg-white/[0.05]`
- NO `.heading-display` on tabs — use `font-medium`

### Dropdowns (group-by selectors, filters)
- Compact button: `bg-cb-blue text-white text-sm font-medium rounded-lg`
- Panel: `bg-[#141920] border border-white/[0.08] rounded-lg shadow-xl`
- Place below the section title, above the chart

### Expandable Lists
- Chevron icon (▼) next to label — rotates 180° when open
- Click row to toggle
- Names shown as `text-xs text-gray-400` in a wrapped flex layout
- On mobile: limit to 6 visible items with "Toon alle X" / "Toon minder" button

### Tables
- Use `glass-card-subtle` container with `overflow-hidden`
- Header: `text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]`
- Rows: `border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors`
- Desktop: full table, mobile: compact rows or stacked layout

### Stats Display
- Large numbers in white or cb-blue
- Small uppercase labels in gray-500
- Use `.stat-divider` between metrics
- Pattern: number on top, label below

### Stacked Percentage Bar (Home/Draw/Away)
- Single rounded bar with 3 color segments
- Gold for home, gray for draw, blue for away
- Labels with inline SVG icons (house, equals, bus) in matching colors
- Labels above the bar, bar below

## Mobile Patterns

- On mobile, scroll to detail panels when they appear (use `scrollIntoView`)
- Show max 6 items in lists with expand/collapse toggle
- Stack all grid columns vertically
- Dropdowns for tab selection instead of inline buttons

## Navigation Structure

**Desktop** (`fcb-prono/src/components/Navigation.tsx`):
- Sticky header at top
- Logo left, nav links right
- Active link has distinct styling

**Mobile**:
- Fixed bottom nav bar
- Icon + label format
- 4-5 items maximum

## Reference Pages

Study these for patterns:
- **Leaderboard:** `fcb-prono/src/app/(app)/page.tsx` — hero section, stats row, ranking list
- **Matches:** `fcb-prono/src/app/(app)/matches/page.tsx` — grouped cards, match display
- **Player detail:** `fcb-prono/src/app/(app)/player/[id]/page.tsx` — detailed stats view
- **Stats overview:** `fcb-prono/src/components/stats/tabs/OverzichtTab.tsx` — charts, heatmap, tables, dropdowns
