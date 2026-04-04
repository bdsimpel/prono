'use client'

import { useMemo, useState } from 'react'
import { useLiveScores } from '@/lib/live-scores'
import { calculateMatchPoints } from '@/lib/scoring'
import YearSelector from '@/components/YearSelector'
import type { Edition, EditionScore, AlltimeScore, Subgroup, PlayerSubgroup } from '@/lib/types'

interface CurrentStanding {
  rank: number
  user_id: string
  display_name: string
  total_score: number
  exact_matches: number
  correct_goal_diffs: number
  correct_results: number
  match_score: number
  extra_score: number
}

interface MatchForLive {
  id: number
  sofascore_event_id: number | null
  match_datetime: string | null
}

interface PredictionForLive {
  user_id: string
  match_id: number
  home_score: number
  away_score: number
}

interface Props {
  editions: Edition[]
  editionScores: EditionScore[]
  alltimeScores: AlltimeScore[]
  currentStandings: CurrentStanding[]
  matches: MatchForLive[]
  predictions: PredictionForLive[]
  resultMatchIds: number[]
  subgroups: Subgroup[]
  playerSubgroups: PlayerSubgroup[]
}

export default function LiveLeaderboard({
  editions,
  editionScores,
  alltimeScores,
  currentStandings,
  matches,
  predictions,
  resultMatchIds,
  subgroups,
  playerSubgroups,
}: Props) {
  // Build eventIdMap for matches that are active (started, no DB result, has sofascore ID)
  const [mountTime] = useState(() => Date.now())
  const isMock = process.env.NEXT_PUBLIC_LIVE_MOCK === 'true'
  const eventIdMap = useMemo(() => {
    const map: Record<number, number> = {}
    const resultSet = new Set(resultMatchIds)
    for (const m of matches) {
      if (
        m.sofascore_event_id &&
        !resultSet.has(m.id) &&
        (isMock || (m.match_datetime && new Date(m.match_datetime).getTime() <= mountTime))
      ) {
        map[m.id] = m.sofascore_event_id
      }
    }
    return map
  }, [matches, resultMatchIds, isMock])

  const liveScores = useLiveScores(eventIdMap)

  // Calculate provisional standings
  const augmentedStandings = useMemo(() => {
    const liveMatchIds = Object.keys(liveScores).map(Number)
    if (liveMatchIds.length === 0) return currentStandings

    // Only consider matches with actual score data
    const scoredMatches = liveMatchIds.filter(mid => {
      const ls = liveScores[mid]
      return ls && ls.homeScore !== null && ls.awayScore !== null && ls.statusType !== 'notstarted'
    })

    if (scoredMatches.length === 0) return currentStandings

    // Group predictions by user
    const predsByUser = new Map<string, PredictionForLive[]>()
    for (const p of predictions) {
      if (!scoredMatches.includes(p.match_id)) continue
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
      predsByUser.get(p.user_id)!.push(p)
    }

    // Calculate provisional points per player
    const augmented = currentStandings.map(standing => {
      const userPreds = predsByUser.get(standing.user_id) || []
      let provisionalPoints = 0
      let provisionalExact = 0
      let provisionalGoalDiff = 0
      let provisionalResult = 0

      for (const pred of userPreds) {
        const ls = liveScores[pred.match_id]
        if (!ls || ls.homeScore === null || ls.awayScore === null) continue

        const { points, category } = calculateMatchPoints(
          pred.home_score,
          pred.away_score,
          ls.homeScore,
          ls.awayScore
        )

        provisionalPoints += points
        if (category === 'exact') provisionalExact++
        else if (category === 'goal_diff') provisionalGoalDiff++
        else if (category === 'result') provisionalResult++
      }

      return {
        ...standing,
        total_score: standing.total_score + provisionalPoints,
        match_score: standing.match_score + provisionalPoints,
        exact_matches: standing.exact_matches + provisionalExact,
        correct_goal_diffs: standing.correct_goal_diffs + provisionalGoalDiff,
        correct_results: standing.correct_results + provisionalResult,
        _hasLivePoints: provisionalPoints > 0,
        _provisionalPoints: provisionalPoints,
      }
    })

    // Re-sort and re-rank
    augmented.sort(
      (a, b) => b.total_score - a.total_score || a.display_name.localeCompare(b.display_name)
    )

    let currentRank = 0
    let previousScore = -1
    return augmented.map((row, index) => {
      if (row.total_score !== previousScore) {
        currentRank = index + 1
      }
      previousScore = row.total_score
      return { ...row, rank: currentRank }
    })
  }, [currentStandings, liveScores, predictions])

  const hasLiveData = Object.keys(liveScores).length > 0
  const hasInProgressMatch = Object.values(liveScores).some(s => s.statusType === 'inprogress')

  const liveUserIds = useMemo(() => {
    if (!hasInProgressMatch) return new Set<string>()
    return new Set(
      (augmentedStandings as (typeof augmentedStandings[number] & { _hasLivePoints?: boolean })[])
        .filter(s => s._hasLivePoints)
        .map(s => s.user_id)
    )
  }, [augmentedStandings, hasLiveData])

  return (
    <YearSelector
      editions={editions}
      editionScores={editionScores}
      alltimeScores={alltimeScores}
      currentStandings={augmentedStandings}
      showLiveIndicator={hasLiveData}
      liveUserIds={liveUserIds}
      subgroups={subgroups}
      playerSubgroups={playerSubgroups}
    />
  )
}
