'use client'

import { useMemo, useState } from 'react'
import TeamLogo from '@/components/TeamLogo'
import LiveMatchBadge from '@/components/LiveMatchBadge'
import { useLiveScores } from '@/lib/live-scores'

interface Props {
  matchId: number
  homeTeamName: string
  awayTeamName: string
  matchDatetime: string | null
  sofascoreEventId: number | null
  result: { home_score: number; away_score: number } | null
  speeldag: number | null
  isCupFinal: boolean
  formattedTime?: string
  formattedDate?: string
}

export default function LiveMatchHeader({
  matchId,
  homeTeamName,
  awayTeamName,
  matchDatetime,
  sofascoreEventId,
  result,
  speeldag,
  isCupFinal,
  formattedTime,
  formattedDate,
}: Props) {
  const [mountTime] = useState(() => Date.now())
  const isMock = process.env.NEXT_PUBLIC_LIVE_MOCK === 'true'
  const eventIdMap = useMemo(() => {
    if (!sofascoreEventId || result) return {}
    if (!isMock && matchDatetime && new Date(matchDatetime).getTime() > mountTime) return {}
    return { [matchId]: sofascoreEventId }
  }, [matchId, sofascoreEventId, result, matchDatetime, mountTime, isMock])

  const liveScores = useLiveScores(eventIdMap)
  const live = liveScores[matchId]
  const hasLiveScore = live && live.homeScore !== null && live.awayScore !== null && !result
  const isLive = hasLiveScore && live.statusType === 'inprogress'
  const liveScoreColor = isLive ? 'text-red-400' : 'text-white'

  return (
    <div className="glass-card-subtle p-5 md:p-6 mb-6">
      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-center gap-4">
          <div className="flex-1 flex flex-col items-center text-center min-w-0">
            <TeamLogo name={homeTeamName} size={48} />
            <span className="heading-display text-sm text-white mt-2 truncate max-w-full">
              {homeTeamName}
            </span>
          </div>
          <div className="flex flex-col items-center shrink-0">
            {result ? (
              <>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">einde</span>
                <span className="heading-display text-3xl text-white mt-0.5">
                  {result.home_score} - {result.away_score}
                </span>
              </>
            ) : hasLiveScore ? (
              <>
                <LiveMatchBadge score={live} />
                <span className="heading-display text-3xl ${liveScoreColor} mt-0.5">
                  {live.homeScore} - {live.awayScore}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  {formattedTime || ''}
                </span>
                <span className="heading-display text-2xl text-gray-600 mt-0.5">VS</span>
              </>
            )}
          </div>
          <div className="flex-1 flex flex-col items-center text-center min-w-0">
            <TeamLogo name={awayTeamName} size={48} />
            <span className="heading-display text-sm text-white mt-2 truncate max-w-full">
              {awayTeamName}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <div className="flex items-center justify-center gap-8">
          <div className="flex items-center gap-3 flex-1 justify-end">
            <TeamLogo name={homeTeamName} size={32} />
            <span className="heading-display text-3xl text-white text-right">{homeTeamName}</span>
          </div>
          {result ? (
            <span className="heading-display text-3xl text-cb-blue shrink-0">
              {result.home_score} - {result.away_score}
            </span>
          ) : hasLiveScore ? (
            <div className="flex flex-col items-center shrink-0">
              <LiveMatchBadge score={live} />
              <span className="heading-display text-3xl ${liveScoreColor}">
                {live.homeScore} - {live.awayScore}
              </span>
            </div>
          ) : (
            <span className="text-xl text-gray-600 heading-display shrink-0">VS</span>
          )}
          <div className="flex items-center gap-3 flex-1">
            <span className="heading-display text-3xl text-white">{awayTeamName}</span>
            <TeamLogo name={awayTeamName} size={32} />
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-500 mt-4">
        {isCupFinal ? 'Bekerfinale' : `Speeldag ${speeldag}`}
        {formattedDate && ` — ${formattedDate}`}
      </p>
    </div>
  )
}
