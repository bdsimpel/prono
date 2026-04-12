'use client'

import { useMemo, useState } from 'react'
import { useLiveScores } from '@/lib/live-scores'
import { calculateMatchPoints } from '@/lib/scoring'
import { computePlayerStreak, type PlayerStreakData, type MatchResult } from '@/lib/streaks'
import StreakDots from '@/components/streaks/StreakDots'
import StreakDetail from '@/components/streaks/StreakDetail'
import InfoPopover from '@/components/streaks/InfoPopover'
import type { PlayerScore } from '@/lib/types'

interface PredictionForLive {
  match_id: number
  home_score: number
  away_score: number
  api_football_fixture_id: number | null
  match_datetime: string | null
  speeldag: number | null
}

interface Props {
  userId: string
  displayName: string
  playerScore: PlayerScore | null
  gamesPlayed: number
  streakData: PlayerStreakData
  predictions: PredictionForLive[]
  resultMap: Record<number, { home_score: number; away_score: number }>
}

export default function PlayerStatsLive({
  userId,
  displayName,
  playerScore,
  gamesPlayed: baseGamesPlayed,
  streakData: baseStreakData,
  predictions,
  resultMap,
}: Props) {
  const [mountTime] = useState(() => Date.now())
  const isMock = process.env.NEXT_PUBLIC_LIVE_MOCK === 'true'

  const eventIdMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const p of predictions) {
      if (
        p.api_football_fixture_id &&
        !resultMap[p.match_id] &&
        (isMock || (p.match_datetime && new Date(p.match_datetime).getTime() <= mountTime))
      ) {
        map[p.match_id] = p.api_football_fixture_id
      }
    }
    return map
  }, [predictions, resultMap, isMock, mountTime])

  const liveScores = useLiveScores(eventIdMap)

  // Determine which matches have live scores
  const liveMatchIds = useMemo(() => {
    const ids = new Set<number>()
    for (const [matchIdStr, live] of Object.entries(liveScores)) {
      if (live.homeScore !== null && live.awayScore !== null && live.statusType !== 'notstarted') {
        ids.add(Number(matchIdStr))
      }
    }
    return ids
  }, [liveScores])

  const hasLive = liveMatchIds.size > 0

  // Augmented stats + streaks
  const { stats, streakData, gamesPlayed } = useMemo(() => {
    if (!hasLive || !playerScore) {
      return {
        stats: playerScore,
        streakData: baseStreakData,
        gamesPlayed: baseGamesPlayed,
      }
    }

    // Build augmented result map
    const augResultMap: Record<number, { home_score: number; away_score: number }> = { ...resultMap }
    for (const matchId of liveMatchIds) {
      const live = liveScores[matchId]
      augResultMap[matchId] = { home_score: live.homeScore!, away_score: live.awayScore! }
    }

    // Recompute stats
    let totalMatchScore = 0
    let exactMatches = 0
    let correctGoalDiffs = 0
    let correctResults = 0
    let played = 0

    for (const pred of predictions) {
      const result = augResultMap[pred.match_id]
      if (!result) continue
      played++
      const { points, category } = calculateMatchPoints(
        pred.home_score, pred.away_score,
        result.home_score, result.away_score,
      )
      totalMatchScore += points
      if (category === 'exact') exactMatches++
      else if (category === 'goal_diff') correctGoalDiffs++
      else if (category === 'result') correctResults++
    }

    const augStats: PlayerScore = {
      ...playerScore,
      total_score: totalMatchScore + playerScore.extra_score,
      match_score: totalMatchScore,
      exact_matches: exactMatches,
      correct_goal_diffs: correctGoalDiffs,
      correct_results: correctResults,
    }

    // Recompute streaks with augmented results
    const augResults = Object.entries(augResultMap).map(([matchId, r]) => ({
      id: 0, match_id: Number(matchId), home_score: r.home_score, away_score: r.away_score, entered_at: '',
    }))
    const predsForStreak = predictions.map((p) => ({
      id: 0, user_id: userId, match_id: p.match_id,
      home_score: p.home_score, away_score: p.away_score, created_at: '',
    }))
    const matchesForStreak = predictions.map((p) => ({
      id: p.match_id, speeldag: p.speeldag, match_datetime: p.match_datetime,
    }))

    const augStreakData = computePlayerStreak(
      userId, displayName, predsForStreak, augResults, matchesForStreak,
    )

    return { stats: augStats, streakData: augStreakData, gamesPlayed: played }
  }, [hasLive, playerScore, baseStreakData, baseGamesPlayed, resultMap, liveMatchIds, liveScores, predictions, userId, displayName])

  const isLive = hasLive

  // Check if specific values changed due to live
  const scoreChanged = isLive && stats && playerScore && stats.total_score !== playerScore.total_score
  const exactChanged = isLive && stats && playerScore && stats.exact_matches !== playerScore.exact_matches
  const correctChanged = isLive && stats && playerScore && (
    (stats.exact_matches + stats.correct_goal_diffs + stats.correct_results) !==
    (playerScore.exact_matches + playerScore.correct_goal_diffs + playerScore.correct_results)
  )
  const gamesChanged = isLive && gamesPlayed !== baseGamesPlayed
  const streakChanged = isLive && streakData.currentStreak.length !== baseStreakData.currentStreak.length

  // Build form dots with live indicator
  const formWithLive: (MatchResult & { isLive?: boolean })[] = useMemo(() => {
    return streakData.recentForm.map((m) => ({
      ...m,
      isLive: liveMatchIds.has(m.matchId),
    }))
  }, [streakData.recentForm, liveMatchIds])

  return (
    <>
      {/* Stats row */}
      {stats && (
        <div className="flex items-center justify-center md:justify-start gap-4 md:gap-10 mb-8 md:mb-10 px-1 md:px-2">
          <div className="text-center">
            <div className={`heading-display text-2xl md:text-3xl font-bold ${scoreChanged ? 'text-red-400' : 'text-cb-blue'}`}>
              {stats.total_score}
            </div>
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Score
            </div>
          </div>
          <div className="stat-divider" />
          <div className="text-center">
            <div className={`heading-display text-2xl md:text-3xl font-bold ${gamesChanged ? 'text-red-400' : 'text-white'}`}>
              {gamesPlayed}
            </div>
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Gespeeld
            </div>
          </div>
          <div className="stat-divider" />
          <div className="text-center">
            <div className={`heading-display text-2xl md:text-3xl font-bold ${exactChanged ? 'text-red-400' : 'text-white'}`}>
              {stats.exact_matches}
            </div>
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Exact
            </div>
          </div>
          <div className="stat-divider" />
          <div className="text-center">
            <div className={`heading-display text-2xl md:text-3xl font-bold ${correctChanged ? 'text-red-400' : 'text-white'}`}>
              {stats.exact_matches + stats.correct_goal_diffs + stats.correct_results}
            </div>
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Correct
            </div>
          </div>
        </div>
      )}

      {/* Form & Streaks */}
      {gamesPlayed > 0 && (
        <div className="glass-card-subtle p-4 md:p-5 mb-8">
          {/* Header with info */}
          <div className="flex items-center gap-1 mb-1.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em]">
              Huidige vorm
            </div>
            <InfoPopover>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cb-gold shrink-0" />
                  <span className="text-[11px] text-gray-300">Exact</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cb-blue shrink-0" />
                  <span className="text-[11px] text-gray-300">Goal verschil</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cb-blue/60 shrink-0" />
                  <span className="text-[11px] text-gray-300">Juist resultaat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shrink-0" />
                  <span className="text-[11px] text-gray-300">Fout</span>
                </div>
              </div>
            </InfoPopover>
          </div>
          {/* Recent form with live dots */}
          <div className="mb-4">
            <FormDots matches={formWithLive} max={5} />
          </div>
          {/* Streak stats */}
          <div className="flex items-start gap-6 md:gap-10">
            <StreakDetail
              label="Huidige reeks"
              streak={streakData.currentStreak}
              isLive={streakChanged}
              baseStreak={baseStreakData.currentStreak}
            />
            <div className="stat-divider" />
            <StreakDetail
              label="Langste reeks"
              streak={streakData.longestStreak}
              isLive={isLive && streakData.longestStreak.length !== baseStreakData.longestStreak.length}
              baseStreak={baseStreakData.longestStreak}
            />
          </div>
        </div>
      )}
    </>
  )
}

// Extended StreakDots that supports live indicator on individual dots
function FormDots({ matches, max = 5 }: { matches: (MatchResult & { isLive?: boolean })[]; max?: number }) {
  if (matches.length === 0) return null

  const categoryColors: Record<string, string> = {
    exact: 'bg-cb-gold',
    goal_diff: 'bg-cb-blue',
    result: 'bg-cb-blue/60',
    wrong: 'bg-gray-600',
  }

  const visible = matches.length > max ? matches.slice(-max) : matches

  return (
    <div className="flex items-center gap-1">
      {visible.map((m, i) => (
        <span
          key={`${m.matchId}-${i}`}
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${categoryColors[m.category] ?? 'bg-gray-600'} ${
            m.isLive ? 'ring-2 ring-red-500 live-pulse' : ''
          }`}
          title={
            m.category === 'exact' ? 'Exact' :
            m.category === 'goal_diff' ? 'Goal verschil' :
            m.category === 'result' ? 'Juist resultaat' : 'Fout'
          }
        />
      ))}
    </div>
  )
}
