'use client'

import { useMemo } from 'react'
import LiveMatchList from '@/components/LiveMatchList'
import type { LiveMatchData } from '@/components/LiveMatchList'
import { useCurrentRound } from '@/hooks/useCurrentRound'

export interface MatchRound {
  label: string
  key: string
  matches: LiveMatchData[]
  firstDatetime: number
}

interface Props {
  rounds: MatchRound[]
  resultMap: Record<number, { home_score: number; away_score: number }>
}

export default function MatchesContent({ rounds, resultMap }: Props) {
  const { currentRound } = useCurrentRound(rounds)

  const currentRoundMatchIds = useMemo(
    () => new Set(currentRound?.matches.map((m) => m.id) ?? []),
    [currentRound],
  )

  const upcomingFiltered = useMemo(
    () =>
      rounds
        .flatMap((r) => r.matches)
        .filter((m) => !currentRoundMatchIds.has(m.id) && !resultMap[m.id]),
    [rounds, currentRoundMatchIds, resultMap],
  )

  const playedFiltered = useMemo(
    () =>
      rounds
        .flatMap((r) => r.matches)
        .filter((m) => !currentRoundMatchIds.has(m.id) && resultMap[m.id])
        .sort((a, b) => {
          const ta = a.match_datetime ? new Date(a.match_datetime).getTime() : 0;
          const tb = b.match_datetime ? new Date(b.match_datetime).getTime() : 0;
          return tb - ta;
        }),
    [rounds, currentRoundMatchIds, resultMap],
  )

  return (
    <>
      {/* Current round */}
      {currentRound && (
        <div className="mb-10">
          <h2 className="heading-display text-xl text-white mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-cb-blue rounded-full" />
            {currentRound.label}
          </h2>
          <LiveMatchList matches={currentRound.matches} resultMap={resultMap} variant="current" />
        </div>
      )}

      {/* Upcoming matches */}
      {upcomingFiltered.length > 0 && (
        <div className="mb-10">
          <h2 className="heading-display text-xl text-gray-400 mb-3">
            KOMENDE WEDSTRIJDEN
          </h2>
          <LiveMatchList matches={upcomingFiltered} resultMap={resultMap} variant="upcoming" />
        </div>
      )}

      {/* Played matches */}
      {playedFiltered.length > 0 && (
        <div>
          <h2 className="heading-display text-xl text-gray-400 mb-3">
            GESPEELD
          </h2>
          <LiveMatchList matches={playedFiltered} resultMap={resultMap} variant="played" />
        </div>
      )}
    </>
  )
}
