'use client'

import { useMemo } from 'react'
import LivePlayerPredictions from '@/components/LivePlayerPredictions'
import { useCurrentRound } from '@/hooks/useCurrentRound'

interface PredictionItem {
  id: number
  match_id: number
  home_score: number
  away_score: number
  home_team_name: string
  away_team_name: string
  match_datetime: string | null
  api_football_fixture_id: number | null
}

export interface PredRound {
  label: string
  key: string
  predictions: PredictionItem[]
  firstDatetime: number
}

interface Props {
  rounds: PredRound[]
  resultMap: Record<number, { home_score: number; away_score: number }>
  shouldHide: boolean
  hasPredictions: boolean
}

export default function PlayerPredictionsContent({ rounds, resultMap, shouldHide, hasPredictions }: Props) {
  const { currentRound } = useCurrentRound(rounds)

  const currentPredictions = currentRound?.predictions ?? []

  const playedPredictions = useMemo(
    () =>
      rounds
        .filter(
          (r) =>
            r.key !== currentRound?.key &&
            r.predictions.every((p) => resultMap[p.match_id]),
        )
        .flatMap((r) => r.predictions)
        .sort((a, b) => {
          const ta = a.match_datetime ? new Date(a.match_datetime).getTime() : 0;
          const tb = b.match_datetime ? new Date(b.match_datetime).getTime() : 0;
          return tb - ta;
        }),
    [rounds, currentRound, resultMap],
  )

  const upcomingPredictions = useMemo(
    () =>
      rounds
        .filter(
          (r) =>
            r.key !== currentRound?.key &&
            r.predictions.some((p) => !resultMap[p.match_id]),
        )
        .flatMap((r) => r.predictions),
    [rounds, currentRound, resultMap],
  )

  return (
    <>
      {/* Current round */}
      {currentRound && currentPredictions.length > 0 && (
        <div className="mb-8">
          <h3 className="heading-display text-lg text-white mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-cb-blue rounded-full" />
            {currentRound.label}
          </h3>
          <LivePlayerPredictions
            predictions={currentPredictions}
            resultMap={resultMap}
            shouldHide={shouldHide}
            section="current"
          />
        </div>
      )}

      {/* Played predictions */}
      {playedPredictions.length > 0 && (
        <div className="mb-8">
          <h3 className="heading-display text-lg text-gray-400 mb-3">
            GESPEELD
          </h3>
          <LivePlayerPredictions
            predictions={playedPredictions}
            resultMap={resultMap}
            shouldHide={shouldHide}
            section="played"
          />
        </div>
      )}

      {/* Upcoming predictions */}
      {upcomingPredictions.length > 0 && (
        <div className="mb-10">
          <h3 className="heading-display text-lg text-gray-400 mb-3">
            KOMENDE WEDSTRIJDEN
          </h3>
          <LivePlayerPredictions
            predictions={upcomingPredictions}
            resultMap={resultMap}
            shouldHide={shouldHide}
            section="upcoming"
          />
        </div>
      )}

      {!hasPredictions && (
        <div className="glass-card-subtle p-12 text-center text-gray-600 text-sm mb-10">
          Geen voorspellingen
        </div>
      )}
    </>
  )
}
