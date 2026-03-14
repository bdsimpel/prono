---
name: mobile-check
description: Audit the app for mobile-friendliness issues and fix them
user_invocable: true
---

# Mobile-Friendliness Audit

You are auditing this Next.js app for mobile-friendliness. Run two checks: **changed files** and **full audit**.

## Step 1: Check changed files

Run `git diff --name-only` to find modified files. For each `.tsx` file in the diff, read it and check for mobile issues.

## Step 2: Full audit

Read all page and component files under `fcb-prono/src/app/` and `fcb-prono/src/components/`. Check every file for the issues listed below.

## What to check

For every page and component file, check for these mobile issues:

### Layout & overflow
- Elements using `flex` with `gap` that may overflow on small screens (< 375px) — ensure `min-w-0`, `truncate`, or `shrink-0` are used appropriately
- Text or team names that can overlap — use `truncate` on variable-length text, use `short_name` on mobile with `md:hidden` / `hidden md:inline` pattern
- Padding that is too wide on mobile — use `px-4 md:px-6` pattern instead of just `px-6`
- Cards/containers with `p-4` or more — consider `p-3 md:p-4` for mobile
- Gaps between flex items — use `gap-2 md:gap-4` or similar responsive gaps

### Typography
- Font sizes that are too large on mobile — headings should use responsive sizes like `text-2xl md:text-3xl`
- Stat numbers should use `text-2xl md:text-3xl` not just `text-3xl`
- Labels should use `text-[9px] md:text-[10px]` pattern for tiny labels

### Tables & lists
- Tables that don't have a mobile alternative — should use `hidden md:table` with a separate mobile view using `md:hidden`
- Mobile list views that are missing key data columns shown in the desktop table

### Badges & tags
- Badge text that is too long for mobile (e.g., "Doelpuntenverschil") — shorten or hide on mobile with `hidden md:inline-flex`
- Category badges — consider hiding on mobile if the color-coded points already convey the info

### Navigation
- Mobile bottom nav active colors should be uniform (`text-white`) not mixed colors
- Chevron arrows (`>`) in list items — hide on mobile with `hidden md:block`

### Input & forms
- Check that root layout exports `viewport` with `maximumScale: 1` to prevent zoom on input focus
- Input fields with small font size (< 16px) can trigger iOS zoom — ensure inputs use at least `text-base` on mobile or viewport prevents zoom

### Scroll behavior
- Verify `ScrollToTop` component exists and is rendered in the app layout to reset scroll position on navigation

### Responsive team names
- Team names should show `short_name` on mobile and full `name` on desktop using the pattern:
  ```
  <span className="truncate md:hidden">{team.short_name || team.name}</span>
  <span className="truncate hidden md:inline">{team.name}</span>
  ```

## Output format

List each issue found with:
1. File path and line number
2. What the problem is
3. The fix (apply it directly)

If no issues are found, confirm the app passes the mobile audit.
