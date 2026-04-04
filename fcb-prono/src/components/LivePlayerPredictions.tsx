'use client'

import { useMemo, useState } from 'react'
import { useLiveScores } from '@/lib/live-scores'
import { calculateMatchPoints } from '@/lib/scoring'
import TeamLogo from '@/components/TeamLogo'

type Category = 'exact' | 'goal_diff' | 'result' | 'wrong' | 'pending'

interface PredictionData {
  id: number
  match_id: number
  home_score: number
  away_score: number
  home_team_name: string
  away_team_name: string
  match_datetime: string | null
  api_football_fixture_id: number | null
}

interface Props {
  predictions: PredictionData[]
  resultMap: Record<number, { home_score: number; away_score: number }>
  shouldHide: boolean
  section: 'current' | 'upcoming' | 'played'
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

export default function LivePlayerPredictions({
  predictions,
  resultMap,
  shouldHide,
  section,
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

  return (
    <div className="space-y-2">
      {predictions.map((pred) => {
        const result = resultMap[pred.match_id]
        const live = liveScores[pred.match_id]
        const hasLiveScore = live && live.homeScore !== null && live.awayScore !== null && live.statusType !== 'notstarted' && !result

        let points = 0
        let category: Category = 'pending'
        let isLive = false

        if (result) {
          const calc = calculateMatchPoints(pred.home_score, pred.away_score, result.home_score, result.away_score)
          points = calc.points
          category = calc.category
        } else if (hasLiveScore) {
          const calc = calculateMatchPoints(pred.home_score, pred.away_score, live.homeScore!, live.awayScore!)
          points = calc.points
          category = calc.category
          isLive = live.statusType === 'inprogress'
        }

        const displayResult = result || (hasLiveScore ? { home_score: live.homeScore!, away_score: live.awayScore! } : undefined)
        const hasPoints = !!result || hasLiveScore

        return (
          <div key={pred.id} className="glass-card-subtle p-3 md:p-4">
            {/* Mobile layout */}
            <div className="md:hidden">
              <div className="flex items-center">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <TeamLogo name={pred.home_team_name} />
                  <span className="text-sm text-gray-200 truncate">{pred.home_team_name}</span>
                </div>
                {displayResult ? (
                  <span className={`heading-display text-xl shrink-0 px-2 ${isLive ? 'text-red-400' : 'text-white'}`}>
                    {displayResult.home_score}
                    <span className="text-gray-600 mx-0.5">-</span>
                    {displayResult.away_score}
                  </span>
                ) : (
                  <span className="text-sm text-gray-600 shrink-0 px-2">vs</span>
                )}
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className="text-sm text-gray-200 truncate">{pred.away_team_name}</span>
                  <TeamLogo name={pred.away_team_name} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
                <span className="text-xs text-gray-500">
                  Prono{' '}
                  <span className="text-gray-300 font-bold ml-1">
                    {shouldHide ? (
                      <span className="blur-sm select-none">? - ?</span>
                    ) : (
                      <>{pred.home_score} - {pred.away_score}</>
                    )}
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  {getCategoryBadge(category, isLive)}
                  <span className={`heading-display text-lg w-8 text-right ${getCategoryPointColor(category, isLive)}`}>
                    {hasPoints ? `+${points}` : '—'}
                  </span>
                </div>
              </div>
            </div>
            {/* Desktop layout */}
            <div className="hidden md:flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 font-medium flex items-center gap-1 truncate">
                  <TeamLogo name={pred.home_team_name} />
                  <span className="truncate">{pred.home_team_name}</span>
                  <span className="text-gray-600 shrink-0">-</span>
                  <span className="truncate">{pred.away_team_name}</span>
                  <TeamLogo name={pred.away_team_name} />
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
                  {result && (
                    <span>
                      <span className="text-gray-500">Uitslag: </span>
                      <span className="text-gray-300 font-bold">
                        {result.home_score}-{result.away_score}
                      </span>
                    </span>
                  )}
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
              <div className="flex items-center gap-2 shrink-0">
                {getCategoryBadge(category, isLive)}
                <span className={`heading-display text-lg w-8 text-right ${getCategoryPointColor(category, isLive)}`}>
                  {hasPoints ? `+${points}` : '—'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
