'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

export interface LiveScore {
  homeScore: number | null
  awayScore: number | null
  statusType: 'notstarted' | 'inprogress' | 'finished' | string
  statusCode: number
  statusDescription: string
  currentPeriodStartTimestamp: number | null
  startTimestamp: number | null
  timeInitial: number // 0 for 1st half, 2700 (45min) for 2nd half
  timeMax: number
  timeExtra: number
  // Period scores for 90-min calculation (cup final)
  homePeriod1: number | null
  homePeriod2: number | null
  awayPeriod1: number | null
  awayPeriod2: number | null
  // Winner determination
  winnerCode: number | null // 1 = home wins, 2 = away wins
  homeTeamName: string | null
  awayTeamName: string | null
}

const POLL_INTERVAL = 30_000

export function useLiveScores(eventIdMap: Record<number, number>): Record<number, LiveScore> {
  const [scores, setScores] = useState<Record<number, LiveScore>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMock = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_LIVE_MOCK === 'true'

  // Stable key for the eventIdMap to avoid re-running effect on every render
  const mapKey = useMemo(() => JSON.stringify(eventIdMap), [eventIdMap])

  const fetchScores = useCallback(async () => {
    const parsed: Record<number, number> = JSON.parse(mapKey)
    const eventIds = Object.values(parsed)
    if (eventIds.length === 0) return

    try {
      const res = await fetch('/api/live-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: eventIds, ...(isMock ? { mock: true } : {}) }),
      })
      if (!res.ok) return
      const data = await res.json()
      const liveScores: Record<number, LiveScore> = data.scores || {}

      // Map back from sofascore_event_id to match_id
      const mapped: Record<number, LiveScore> = {}
      for (const [matchId, eventId] of Object.entries(parsed)) {
        if (liveScores[eventId]) {
          mapped[Number(matchId)] = liveScores[eventId]
        }
      }
      setScores(mapped)
    } catch {
      // Graceful fail - keep showing last known state
    }
  }, [mapKey, isMock])

  useEffect(() => {
    const parsed: Record<number, number> = JSON.parse(mapKey)
    if (Object.keys(parsed).length === 0) return

    // Initial fetch deferred to avoid setState-in-effect lint warning
    const initialTimeout = setTimeout(fetchScores, 0)
    intervalRef.current = setInterval(fetchScores, POLL_INTERVAL)

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        setTimeout(fetchScores, 0)
        intervalRef.current = setInterval(fetchScores, POLL_INTERVAL)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [mapKey, fetchScores])

  return scores
}

export function calcMatchMinute(score: LiveScore): number {
  if (!score.currentPeriodStartTimestamp) return 0
  const now = Math.floor(Date.now() / 1000)
  const elapsed = now - score.currentPeriodStartTimestamp + score.timeInitial
  return Math.max(1, Math.floor(elapsed / 60) + 1)
}

export function formatLiveStatus(score: LiveScore): { label: string; isLive: boolean } {
  if (score.statusType === 'notstarted') {
    return { label: '', isLive: false }
  }

  if (score.statusType === 'finished') {
    return { label: 'Einde', isLive: false }
  }

  // Halftime
  if (score.statusCode === 31) {
    return { label: 'Rust', isLive: true }
  }

  // Waiting for extra time
  if (score.statusCode === 32) {
    return { label: 'Wacht verl.', isLive: true }
  }

  // Extra time halftime
  if (score.statusCode === 33) {
    return { label: 'Rust verl.', isLive: true }
  }

  // Penalties
  if (score.statusCode === 50) {
    return { label: 'Strafschoppen', isLive: true }
  }

  // Match just started but no period timestamp yet
  if (!score.currentPeriodStartTimestamp) {
    return { label: "1'", isLive: true }
  }

  const minute = calcMatchMinute(score)

  // 1st half: anything above 45 → 45+x'
  if (score.statusCode === 6 && minute > 45) {
    const extra = minute - 45
    return { label: `45+${extra}'`, isLive: true }
  }

  // 2nd half: anything above 90 → 90+x'
  if (score.statusCode === 7 && minute > 90) {
    const extra = minute - 90
    return { label: `90+${extra}'`, isLive: true }
  }

  // Extra time 1st half: anything above 105 → 105+x'
  if (score.statusCode === 41 && minute > 105) {
    const extra = minute - 105
    return { label: `105+${extra}'`, isLive: true }
  }

  // Extra time 2nd half: anything above 120 → 120+x'
  if (score.statusCode === 42 && minute > 120) {
    const extra = minute - 120
    return { label: `120+${extra}'`, isLive: true }
  }

  return { label: `${minute}'`, isLive: true }
}
