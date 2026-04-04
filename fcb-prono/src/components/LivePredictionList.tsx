'use client'

import { useMemo, useState } from 'react'
import { useLiveScores } from '@/lib/live-scores'
import { calculateMatchPoints } from '@/lib/scoring'
import LiveMatchBadge from '@/components/LiveMatchBadge'

type Category = 'exact' | 'goal_diff' | 'result' | 'wrong' | 'pending'

interface PredictionData {
  id: number
  home_score: number
  away_score: number
  display_name: string
  user_id: string
  rank: number
}

interface Props {
  predictions: PredictionData[]
  matchId: number
  fixtureId: number | null
  matchDatetime: string | null
  hasResult: boolean
  shouldHide: boolean
}

function getCategoryBadge(category: string, isLive: boolean) {
  const livePrefix = isLive ? (
    <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse inline-block mr-1" />
  ) : null

  switch (category) {
    case 'exact':
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-gold/40 text-cb-gold inline-flex items-center">
          {livePrefix}Exact
        </span>
      )
    case 'goal_diff':
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-blue/30 text-cb-blue inline-flex items-center">
          {livePrefix}Goal verschil
        </span>
      )
    case 'result':
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-blue/25 text-cb-blue/80 inline-flex items-center">
          {livePrefix}Juist resultaat
        </span>
      )
    case 'wrong':
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-white/10 text-gray-500 inline-flex items-center">
          {livePrefix}Fout
        </span>
      )
    default:
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-white/10 text-gray-600">
          Afwachting
        </span>
      )
  }
}

function getCategoryPointColor(category: string, isLive: boolean) {
  if (isLive) return 'text-red-400'
  switch (category) {
    case 'exact': return 'text-cb-gold'
    case 'goal_diff': return 'text-cb-blue'
    case 'result': return 'text-cb-blue/80'
    case 'wrong': return 'text-gray-500'
    default: return 'text-gray-600'
  }
}

export default function LivePredictionList({
  predictions,
  matchId,
  fixtureId,
  matchDatetime,
  hasResult,
  shouldHide,
}: Props) {
  const [mountTime] = useState(() => Date.now())
  const isMock = process.env.NEXT_PUBLIC_LIVE_MOCK === 'true'

  const eventIdMap = useMemo(() => {
    if (!fixtureId || hasResult) return {}
    if (!isMock && matchDatetime && new Date(matchDatetime).getTime() > mountTime) return {}
    return { [matchId]: fixtureId }
  }, [matchId, fixtureId, hasResult, matchDatetime, mountTime, isMock])

  const liveScores = useLiveScores(eventIdMap)
  const live = liveScores[matchId]
  const hasLiveScore = live && live.homeScore !== null && live.awayScore !== null && live.statusType !== 'notstarted'
  const isLive = hasLiveScore && live.statusType === 'inprogress'

  const augmented = useMemo(() => {
    if (!hasLiveScore) {
      return predictions.map(p => ({
        ...p,
        points: 0,
        category: 'pending' as Category,
        isLive: false,
      }))
    }

    const withPoints = predictions.map(p => {
      const { points, category } = calculateMatchPoints(
        p.home_score, p.away_score,
        live.homeScore!, live.awayScore!
      )
      return { ...p, points, category: category as Category, isLive }
    })

    withPoints.sort((a, b) => b.points - a.points || a.rank - b.rank)
    return withPoints
  }, [predictions, hasLiveScore, live])

  // Stats
  const predictionCount = augmented.length
  const exactCount = augmented.filter(p => p.category === 'exact').length
  const correctCount = augmented.filter(p => p.category === 'result' || p.category === 'goal_diff').length

  return (
    <>
      {/* Stats row */}
      <div className="flex items-center gap-6 md:gap-10 mb-8 px-2">
        <div className="text-center">
          <div className="heading-display text-3xl text-cb-blue font-bold">
            {predictionCount}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
            Voorspellingen
          </div>
        </div>
        {hasLiveScore && (
          <>
            <div className="stat-divider" />
            <div className="text-center">
              <div className={`heading-display text-3xl font-bold ${isLive ? 'text-red-400' : 'text-white'}`}>
                {exactCount}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
                Exact
              </div>
            </div>
            <div className="stat-divider" />
            <div className="text-center">
              <div className={`heading-display text-3xl font-bold ${isLive ? 'text-red-400' : 'text-white'}`}>
                {correctCount}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
                Correct
              </div>
            </div>
          </>
        )}
      </div>

      {/* Predictions */}
      <h2 className="heading-display text-xl text-gray-400 mb-3">
        VOORSPELLINGEN
      </h2>

      <div className="space-y-2">
        {augmented.length === 0 ? (
          <div className="glass-card-subtle p-12 text-center text-gray-600 text-sm">
            Nog geen voorspellingen voor deze wedstrijd.
          </div>
        ) : (
          augmented.map((pred) => (
            <div key={pred.id} className="glass-card-subtle p-3 md:p-4">
              <div className="flex items-center justify-between gap-2 md:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 font-medium truncate">
                    {pred.display_name}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>
                      <span className="text-gray-500">Prono: </span>
                      <span className="text-gray-300 font-bold">
                        {shouldHide ? (
                          <span className="blur-sm select-none">?-?</span>
                        ) : (
                          <>{pred.home_score}-{pred.away_score}</>
                        )}
                      </span>
                    </span>
                    {hasLiveScore && (
                      <span>
                        <span className="text-gray-500">{isLive ? 'Live: ' : 'Uitslag: '}</span>
                        <span className={`font-bold ${isLive ? 'text-red-400' : 'text-gray-300'}`}>
                          {live.homeScore}-{live.awayScore}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  {getCategoryBadge(pred.category, pred.isLive)}
                  <span
                    className={`heading-display text-lg w-10 text-right ${getCategoryPointColor(pred.category, pred.isLive)}`}
                  >
                    {hasLiveScore ? `+${pred.points}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
