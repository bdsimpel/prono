'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { GoalEvent } from '@/components/MatchGoalTimeline'

const POLL_INTERVAL = 30_000

export function useLiveEvents(
  fixtureId: number | null,
): GoalEvent[] {
  const [events, setEvents] = useState<GoalEvent[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMock = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_LIVE_MOCK === 'true'

  const stableKey = useMemo(() => fixtureId, [fixtureId])

  const fetchEvents = useCallback(async () => {
    if (stableKey == null) return

    try {
      const res = await fetch('/api/live-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [stableKey],
          includeEvents: true,
          ...(isMock ? { mock: true } : {}),
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      const fixtureEvents: GoalEvent[] = data.events?.[stableKey] || []
      setEvents(fixtureEvents)
    } catch {
      // Keep last known state
    }
  }, [stableKey, isMock])

  useEffect(() => {
    if (stableKey == null) return

    const initialTimeout = setTimeout(fetchEvents, 0)
    intervalRef.current = setInterval(fetchEvents, POLL_INTERVAL)

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        setTimeout(fetchEvents, 0)
        intervalRef.current = setInterval(fetchEvents, POLL_INTERVAL)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [stableKey, fetchEvents])

  return stableKey == null ? [] : events
}
