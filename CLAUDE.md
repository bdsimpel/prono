# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FCB Prono is a Belgian football (Club Brugge) playoff prediction competition app. Players predict scores for 31 league matches + 1 cup final, answer 8 bonus questions, and compete on a leaderboard. Built for ~50-100 casual players, mostly Dutch-speaking.

## Tech Stack

- **Framework**: Next.js 16 (app router) with TypeScript 5, React 19
- **Database**: Supabase (PostgreSQL, hosted in Ireland) with Row-Level Security
- **Auth**: Supabase Auth — anonymous signup for players, password login for admins
- **Styling**: Tailwind CSS 4 with Club Brugge theme (blue #005a94, gold #C9A84C, dark bg #0a0e14)
- **Fonts**: Inter (body), Bebas Neue (headings)
- **Package manager**: npm

## Commands

```bash
npm run dev       # Dev server on port 3000
npm run build     # Production build
npm start         # Production server
npm run lint      # ESLint
```

No test framework is configured.

## Architecture

All application code lives in `fcb-prono/src/`.

### Routing (app router)

- `app/(app)/` — Protected routes: leaderboard (`page.tsx`), `matches/`, `meedoen/` (signup), `admin/`, `player/[id]/`, `betalen/[id]/`
- `app/api/` — API routes: `submit/`, `admin/save-results/`, `admin/toggle-lock/`, `admin/payment/`, `recalculate/`
- `app/login/` — Admin login page

### Key modules (`lib/`)

- `scoring.ts` — Match scoring: exact = 3 + total goals + 2 + 5; goal diff = 7; result only = 5; wrong = 0. Extra questions = 10-20 pts each.
- `recalculate.ts` — Recomputes all player_scores from predictions + results
- `payment.ts` — EPC QR code generation (SEPA/BCD format), IBAN config
- `supabase/server.ts` and `client.ts` — Server/browser Supabase clients
- `supabase/middleware.ts` — Session refresh middleware

### Database tables

`teams`, `matches`, `results`, `predictions`, `extra_questions`, `extra_predictions`, `profiles`, `player_scores`, `settings` — schema in `supabase-schema.sql` and migration files at project root.

### Auth model

- Players sign up anonymously (no password) via the multi-step "Meedoen" form
- Admins authenticate via password at `/login`
- Admin-only actions protected by service role key on API routes

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Language

UI text is in Dutch. Code (variables, comments) is in English.
