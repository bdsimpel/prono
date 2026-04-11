'use client'

import { useState, useEffect, useCallback } from 'react'

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000

interface Round {
  key: string
  firstDatetime: number
}

function findCurrentRound<T extends Round>(rounds: T[]): T | null {
  const now = Date.now()
  let current: T | null = rounds[0] ?? null
  for (const round of rounds) {
    if (now >= round.firstDatetime - TWO_DAYS) {
      current = round
    }
  }
  return current
}

export function useCurrentRound<T extends Round>(rounds: T[]) {
  const [currentRoundKey, setCurrentRoundKey] = useState<string | null>(
    () => findCurrentRound(rounds)?.key ?? null,
  )

  const recalculate = useCallback(() => {
    const round = findCurrentRound(rounds)
    setCurrentRoundKey(round?.key ?? null)
  }, [rounds])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recalculate()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [recalculate])

  const currentRound = rounds.find((r) => r.key === currentRoundKey) ?? null

  return { currentRound, currentRoundKey }
}
