# FCB Prono — Supabase Database Guide

Use this guide when writing queries or working with the database.

## Client Setup

- **Server components / API routes:** `createServiceClient()` from `@/lib/supabase/server` — bypasses RLS, use for data fetching
- **Client components:** `createClient()` from `@/lib/supabase/client` — respects RLS
- Use `Promise.all` for parallel fetches in server components

## Database Schema

### `teams` — 6 playoff teams
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | TEXT UNIQUE | Full name (e.g., "Club Brugge") |
| short_name | TEXT | 3-letter code (e.g., "CLB") |
| matrix_index | INT UNIQUE | Internal ordering |
| standing_rank | INT | League standing |
| points_half | NUMERIC | Points from regular season (halved) |
| goals_for | INT | |
| goals_against | INT | |

### `profiles` — linked to auth.users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | References auth.users |
| first_name | TEXT | |
| last_name | TEXT | |
| display_name | TEXT | Generated: first_name + ' ' + last_name |
| is_admin | BOOLEAN | Default false |
| paid | BOOLEAN | Default true |

### `players` — registered prono players
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | References auth.users |
| display_name | TEXT | |
| payment_status | TEXT | 'unpaid' / 'pending' / 'paid' |
| payment_method | TEXT | 'wero' / 'transfer' / 'cash' / null |
| paid_at | TIMESTAMPTZ | |
| favorite_team | TEXT | Player's favorite team (nullable, added via migration) |

### `matches` — 30 league + 1 cup final
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| home_team_id | INT FK → teams | |
| away_team_id | INT FK → teams | |
| speeldag | INT | 1-10 (null for cup final) |
| match_datetime | TIMESTAMPTZ | |
| is_cup_final | BOOLEAN | |
| sofascore_event_id | INT | For live score integration |

### `results` — admin-entered match results
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| match_id | INT FK → matches | UNIQUE |
| home_score | INT | |
| away_score | INT | |
| entered_at | TIMESTAMPTZ | |

### `predictions` — player match predictions
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| user_id | UUID FK → auth.users | |
| match_id | INT FK → matches | |
| home_score | INT | |
| away_score | INT | |
| created_at | TIMESTAMPTZ | |
| UNIQUE(user_id, match_id) | | |

### `extra_questions` — 8 bonus questions
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| question_key | TEXT UNIQUE | e.g., "kampioen", "topscorer_poi" |
| question_label | TEXT | Dutch label |
| points | INT | 10 or 20 |

### `extra_question_answers` — correct answers (admin)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| question_id | INT FK → extra_questions | |
| correct_answer | TEXT | Can have multiple per question |

### `extra_predictions` — player bonus answers
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| user_id | UUID FK → auth.users | |
| question_id | INT FK → extra_questions | |
| answer | TEXT | |

### `player_scores` — cached leaderboard scores
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| user_id | UUID FK → auth.users | UNIQUE |
| total_score | INT | match_score + extra_score |
| match_score | INT | Points from match predictions |
| extra_score | INT | Points from bonus questions |
| exact_matches | INT | Count of exact score predictions |
| correct_goal_diffs | INT | Count of correct goal difference |
| correct_results | INT | Count of correct result only |
| updated_at | TIMESTAMPTZ | |

### `settings` — app configuration
| Key | Value |
|-----|-------|
| predictions_locked | 'true' / 'false' |
| deadline | ISO 8601 timestamp |

### `editions` — historical competition editions
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| year | INT | |
| label | TEXT | |
| max_points | INT | |
| player_count | INT | |
| is_current | BOOLEAN | |

### `edition_scores` — historical scores per edition
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| edition_id | INT FK → editions | |
| player_name | TEXT | |
| rank | INT | |
| total_score | INT | |

### `alltime_scores` — all-time rankings
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| player_name | TEXT | |
| years_played | INT | |
| avg_z_score | FLOAT | |
| best_rank | INT | |
| best_rank_year | INT | |

### `football_players` — real football players (for extra questions)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | TEXT | |
| team | TEXT | |
| position | TEXT | |
| goals | INT | |
| assists | INT | |
| clean_sheets | INT | |

## CRITICAL: Supabase 1000-Row Limit

**Supabase returns a maximum of 1000 rows per request by default.** The `.limit()` method does NOT override this server-side cap. For tables that may exceed 1000 rows, you MUST use the `fetchAll()` helper:

```typescript
import { fetchAll } from "@/lib/supabase/fetch-all";

// Tables that need fetchAll (>1000 rows possible):
// - predictions (players × 31 matches)
// - extra_predictions (players × 8 questions) 
// - match_events (goals/assists/clean sheets across all matches)

// fetchAll returns T[] directly (not { data }), so destructure accordingly:
const [
  { data: players },
  predictions,              // ← array directly, not { data }
  extraPredictions,         // ← array directly
] = await Promise.all([
  supabase.from("players").select("*"),
  fetchAll(supabase, "predictions"),
  fetchAll(supabase, "extra_predictions"),
]);

// With specific types:
fetchAll<{ user_id: string; match_id: number; home_score: number; away_score: number }>(
  supabase, "predictions", "user_id, match_id, home_score, away_score"
)
```

**Reference:** `fcb-prono/src/lib/supabase/fetch-all.ts`

## Common Query Patterns

```typescript
// Server component — fetch all stats data for dashboard
import { fetchAll } from "@/lib/supabase/fetch-all";
const supabase = await createServiceClient();
const [
  { data: players },
  { data: playerScores },
  { data: matches },
  { data: results },
  predictions,
  { data: extraQuestions },
  extraPredictions,
  { data: extraAnswers },
  { data: teams },
  matchEvents,
] = await Promise.all([
  supabase.from("players").select("*"),
  supabase.from("player_scores").select("*"),
  supabase.from("matches").select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)").order("speeldag"),
  supabase.from("results").select("*"),
  fetchAll(supabase, "predictions"),
  supabase.from("extra_questions").select("*").order("id"),
  fetchAll(supabase, "extra_predictions"),
  supabase.from("extra_question_answers").select("*"),
  supabase.from("teams").select("*"),
  fetchAll(supabase, "match_events"),
]);
```

## Scoring Logic (from `@/lib/scoring.ts`)

```typescript
calculateMatchPoints(predHome, predAway, actualHome, actualAway)
// Returns: { points: number, category: 'exact' | 'goal_diff' | 'result' | 'wrong' }

// Exact score: 5 (result) + 2 (goal diff) + 3 + total goals = 10+ points
// Correct goal diff: 5 + 2 = 7 points
// Correct result only: 5 points
// Wrong: 0 points
// Extra questions: 10-20 points each
```

## Common Computation Patterns

```typescript
// Build result lookup
const resultMap = new Map<number, Result>();
for (const r of results) resultMap.set(r.match_id, r);

// Compute points for all predictions
const scoredPredictions = predictions
  .map(pred => {
    const result = resultMap.get(pred.match_id);
    if (!result) return null;
    return { ...pred, ...calculateMatchPoints(pred.home_score, pred.away_score, result.home_score, result.away_score) };
  })
  .filter(Boolean);

// Group by favorite team
const groups: Record<string, string[]> = {};
for (const p of players) {
  const team = p.favorite_team || "Neutraal";
  if (!groups[team]) groups[team] = [];
  groups[team].push(p.display_name);
}
```

## Team Name Mapping

Team names in DB vs display names — some differ:
- DB `teams.name`: "Club Brugge", "Union", "STVV", "Anderlecht", "Gent", "Mechelen"
- Logo lookup in `teamLogos.ts` has aliases: "Gent" → gent.png, "Mechelen" → mechelen.png
- `players.favorite_team` can be any team from `FAVORITE_TEAMS` list (27 teams, not just PO1)

## RLS Notes

- All tables have `SELECT` for `authenticated` role
- `predictions` and `extra_predictions` have insert/update only when `predictions_locked = 'false'`
- Server components using `createServiceClient()` bypass RLS entirely
