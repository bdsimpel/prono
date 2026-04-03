# FCB Prono — UI Styling Guide

When building or modifying UI for this project, follow these conventions exactly.

## Color Palette (defined in `fcb-prono/src/app/globals.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-cb-blue` | `#005a94` | Primary brand, buttons, accents, away team color |
| `--color-cb-dark` | `#0a0e14` | Main background |
| `--color-cb-navy` | `#0d1b2a` | Secondary dark |
| `--color-cb-gold` | `#C9A84C` | Highlights, borders, labels, home team color |
| `--color-cb-silver` | `#C0C0C0` | 2nd place |
| `--color-cb-bronze` | `#CD7F32` | 3rd place |
| `--color-cb-card` | `#111827` | Card backgrounds |
| `--color-cb-card-hover` | `#1a2332` | Card hover state |
| `--color-foreground` | `#f5f5f5` | Primary text |
| `--color-border` | `rgba(201, 168, 76, 0.15)` | Gold-tinted borders |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.06)` | Subtle borders |

## Color Rules

- **DO NOT use green** (`#22c55e`) for UI elements — use `cb-gold` or `cb-blue` instead
- Use `cb-gold` for home/primary and `cb-blue` for away/secondary in comparisons
- Gray (`#6b7280`) for neutral/draw states
- Keep all bar charts in `cb-blue` — do NOT use different colors per item (no team-specific bar colors)
- All bars in a chart should have the same opacity (no fading for non-first items)

## Typography

- **Body font:** Inter (`var(--font-sans)`) — use for all body text
- **Display font:** Bebas Neue (`var(--font-display)`) — ONLY use via `.heading-display` for hero/page titles
- **Section titles:** Use `text-xl font-semibold text-white` — NOT `.heading-display` (which forces uppercase)
- **Title casing:** Title Case for section headers (e.g., "Favoriete Ploeg", "Gemiddelde Punten")
- **Label casing:** Sentence case for dropdown labels and descriptions (e.g., "Favoriete ploeg", "PO1 ploeg")
- Text is always light on dark backgrounds. Primary: `text-white`. Secondary: `text-gray-400` / `text-gray-500`

## CSS Classes (from globals.css)

Use these existing classes — do NOT create alternatives:

- `.glass-card` — primary card container (dark bg, gold border, 0.75rem radius)
- `.glass-card-subtle` — secondary card (more transparent, white border) — **use this for chart/table containers**
- `.heading-display` — Bebas Neue, uppercase, 0.02em tracking — ONLY for hero titles
- `.section-label` — Bebas Neue, uppercase, 0.2em tracking, 0.75rem, gold color
- `.match-card` — match display card with hover transition
- `.btn-primary` — CB blue button with hover glow
- `.btn-secondary` — transparent button with white border
- `.stat-divider` — 1px vertical line between stats (2.5rem height)
- `.table-row` — subtle bottom border with hover highlight
- `.glow-gold` / `.glow-silver` / `.glow-bronze` — medal glow effects for top 3
- `.watermark-text` — large background text (opacity 0.02)
- `.live-pulse` — 1.5s animation for live indicators
- `.nav-active` — active nav state background
- `.feature-card` — transparent card with gold border

## Layout Conventions

- Container: `max-w-7xl mx-auto px-4 md:px-6`
- Section spacing: `py-6 md:py-16`
- Mobile-first responsive: use `md:` breakpoint for desktop
- Cards use `p-4 md:p-5` internal padding
- **Desktop grids:** Put related charts side by side with `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`
- **Mobile:** Everything stacks vertically — no side-by-side on small screens

## Section Structure Pattern

```tsx
<div>
  <h3 className="text-xl font-semibold text-white mb-1">
    Section Title
  </h3>
  <p className="text-xs text-gray-500 mb-4">
    Descriptive question this section answers?
  </p>
  <div className="glass-card-subtle p-4 md:p-5">
    {/* Chart/table content */}
  </div>
</div>
```

## Dropdown Pattern

```tsx
<div className="relative" ref={dropdownRef}>
  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cb-blue text-white">
    {label}
    <ChevronSVG />
  </button>
  {open && (
    <div className="absolute top-full left-0 mt-1 z-20 min-w-full py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
      {/* Options */}
    </div>
  )}
</div>
```

## Expandable Lists

- Use chevron icon (▼) that rotates 180° when expanded
- Hover: `hover:bg-white/[0.03]`
- Expanded content: wrapped names in `flex flex-wrap gap-x-3 gap-y-1`
- On mobile: show max 6 items with "Toon alle X items" / "Toon minder" toggle

## Icons

- Use single-color inline SVGs — NO emoji
- Match icon color to the context (e.g., gold for home, blue for away, gray for draw)

## Borders

- Primary cards: `border border-[rgba(201,168,76,0.15)]` or use `.glass-card`
- Subtle dividers: `border-[rgba(255,255,255,0.06)]` or `divide-y divide-white/[0.04]`
- Hover: upgrade to `rgba(201, 168, 76, 0.3)` on primary cards
- Selected state: `ring-2 ring-cb-gold`

## Transitions

- All interactive elements: `transition-all duration-200 ease` or `transition-colors duration-150`
- Hover effects should be subtle — background opacity changes, border color shifts
- Bar chart fills: `transition-all duration-500`

## Do's and Don'ts

- DO use Tailwind utility classes with the custom theme tokens
- DO follow the dark-first aesthetic — no light backgrounds
- DO keep color usage restrained — mostly white/gray text with strategic gold/blue accents
- DO put charts side by side on desktop, stacked on mobile
- DON'T add emojis — use inline SVG icons instead
- DON'T use light mode colors or white backgrounds
- DON'T create new CSS classes when existing ones work
- DON'T use green for UI elements
- DON'T use `.heading-display` for section titles (only for hero text)
- DON'T use different colors per bar in charts — keep all bars the same `cb-blue`
- Reference file: `fcb-prono/src/app/globals.css`
