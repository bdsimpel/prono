import { calculateMatchPoints } from './scoring'
import type { Match, Result, Prediction } from './types'

export type MatchCategory = 'exact' | 'goal_diff' | 'result' | 'wrong'

export interface MatchResult {
  matchId: number
  speeldag: number | null
  category: MatchCategory
}

export interface Streak {
  length: number
  matches: MatchResult[]
}

export interface PlayerStreakData {
  userId: string
  displayName: string
  currentStreak: Streak
  longestStreak: Streak
  recentForm: MatchResult[]
}

function countCat(matches: MatchResult[], cat: MatchCategory): number {
  return matches.filter((m) => m.category === cat).length
}

/** Compare two streaks by quality: most exact, then goal_diff, then result, then length */
function isBetterStreak(a: MatchResult[], b: MatchResult[]): boolean {
  const exactDiff = countCat(a, 'exact') - countCat(b, 'exact')
  if (exactDiff !== 0) return exactDiff > 0
  const gdDiff = countCat(a, 'goal_diff') - countCat(b, 'goal_diff')
  if (gdDiff !== 0) return gdDiff > 0
  const resDiff = countCat(a, 'result') - countCat(b, 'result')
  if (resDiff !== 0) return resDiff > 0
  return a.length > b.length
}

function buildMatchOrder(
  matches: Pick<Match, 'id' | 'speeldag' | 'match_datetime'>[],
  resultMap: Map<number, Result>,
): Pick<Match, 'id' | 'speeldag' | 'match_datetime'>[] {
  return matches
    .filter((m) => resultMap.has(m.id))
    .sort((a, b) => {
      const sa = a.speeldag ?? 999
      const sb = b.speeldag ?? 999
      if (sa !== sb) return sa - sb
      const da = a.match_datetime ? new Date(a.match_datetime).getTime() : 0
      const db = b.match_datetime ? new Date(b.match_datetime).getTime() : 0
      return da - db
    })
}

function computeStreaksForPlayer(
  userId: string,
  orderedMatches: Pick<Match, 'id' | 'speeldag' | 'match_datetime'>[],
  predMap: Map<string, Prediction>,
  resultMap: Map<number, Result>,
): Omit<PlayerStreakData, 'displayName'> {
  const allResults: MatchResult[] = []

  for (const match of orderedMatches) {
    const pred = predMap.get(`${userId}-${match.id}`)
    if (!pred) continue

    const result = resultMap.get(match.id)!
    const { category } = calculateMatchPoints(
      pred.home_score,
      pred.away_score,
      result.home_score,
      result.away_score,
    )

    allResults.push({
      matchId: match.id,
      speeldag: match.speeldag,
      category,
    })
  }

  let currentRun: MatchResult[] = []
  let longestRun: MatchResult[] = []

  for (const mr of allResults) {
    if (mr.category !== 'wrong') {
      currentRun.push(mr)
    } else {
      if (currentRun.length > longestRun.length || (currentRun.length === longestRun.length && isBetterStreak(currentRun, longestRun))) {
        longestRun = currentRun
      }
      currentRun = []
    }
  }
  // The remaining currentRun is the active streak
  if (currentRun.length > longestRun.length || (currentRun.length === longestRun.length && isBetterStreak(currentRun, longestRun))) {
    longestRun = currentRun
  }

  return {
    userId,
    currentStreak: { length: currentRun.length, matches: currentRun },
    longestStreak: { length: longestRun.length, matches: longestRun },
    recentForm: allResults.slice(-5),
  }
}

export function computeAllStreaks(
  predictions: Prediction[],
  results: Result[],
  matches: Pick<Match, 'id' | 'speeldag' | 'match_datetime'>[],
  players: { id: string; display_name: string }[],
): PlayerStreakData[] {
  const resultMap = new Map<number, Result>()
  for (const r of results) resultMap.set(r.match_id, r)

  const predMap = new Map<string, Prediction>()
  for (const p of predictions) predMap.set(`${p.user_id}-${p.match_id}`, p)

  const orderedMatches = buildMatchOrder(matches, resultMap)

  return players.map((player) => {
    const data = computeStreaksForPlayer(
      player.id,
      orderedMatches,
      predMap,
      resultMap,
    )
    return { ...data, displayName: player.display_name }
  })
}

export function computePlayerStreak(
  userId: string,
  displayName: string,
  predictions: Prediction[],
  results: Result[],
  matches: Pick<Match, 'id' | 'speeldag' | 'match_datetime'>[],
): PlayerStreakData {
  const resultMap = new Map<number, Result>()
  for (const r of results) resultMap.set(r.match_id, r)

  const predMap = new Map<string, Prediction>()
  for (const p of predictions) {
    if (p.user_id === userId) predMap.set(`${p.user_id}-${p.match_id}`, p)
  }

  const orderedMatches = buildMatchOrder(matches, resultMap)
  const data = computeStreaksForPlayer(userId, orderedMatches, predMap, resultMap)
  return { ...data, displayName }
}

export function getStreakFlameColor(matches: MatchResult[]): string {
  if (matches.length === 0) return '#6b7280' // gray-500
  if (matches.length >= 5) return '#C9A84C'  // gold
  return '#005a94'                           // blue
}
