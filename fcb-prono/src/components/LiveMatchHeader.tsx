'use client'

import { useCallback, useMemo, useState } from 'react'
import TeamLogo from '@/components/TeamLogo'
import LiveMatchBadge from '@/components/LiveMatchBadge'
import { useLiveScores } from '@/lib/live-scores'
import { useLiveEvents } from '@/lib/live-events'
import MatchGoalTimeline from '@/components/MatchGoalTimeline'
import type { GoalEvent } from '@/components/MatchGoalTimeline'

interface Props {
  matchId: number
  homeTeamName: string
  awayTeamName: string
  homeTeamId: number
  awayTeamId: number
  matchDatetime: string | null
  fixtureId: number | null
  result: { home_score: number; away_score: number } | null
  speeldag: number | null
  isCupFinal: boolean
  dbGoalEvents?: GoalEvent[]
  formattedTime?: string
  formattedDate?: string
}

export default function LiveMatchHeader({
  matchId,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  matchDatetime,
  fixtureId,
  result,
  speeldag,
  isCupFinal,
  dbGoalEvents,
  formattedTime,
  formattedDate,
}: Props) {
  const [mountTime] = useState(() => Date.now())
  const isMock = process.env.NEXT_PUBLIC_LIVE_MOCK === 'true'
  const eventIdMap = useMemo(() => {
    if (!fixtureId || result) return {}
    if (!isMock && matchDatetime && new Date(matchDatetime).getTime() > mountTime) return {}
    return { [matchId]: fixtureId }
  }, [matchId, fixtureId, result, matchDatetime, mountTime, isMock])

  const liveScores = useLiveScores(eventIdMap)
  const live = liveScores[matchId]
  const hasLiveScore = live && live.homeScore !== null && live.awayScore !== null && !result
  const isLive = hasLiveScore && live.statusType === 'inprogress'
  const liveScoreColor = isLive ? 'text-red-400' : 'text-white'

  // Fetch live events when match is in progress
  const shouldFetchLiveEvents = !result && fixtureId != null && (isMock || (matchDatetime && new Date(matchDatetime).getTime() <= mountTime))
  const liveEvents = useLiveEvents(
    shouldFetchLiveEvents ? fixtureId : null,
  )

  // Choose goal events: DB events for finished, live events for in-progress
  const goalEvents = result ? (dbGoalEvents ?? []) : liveEvents

  // For live events:
  // - League matches: use positional teamId (0=home, 1=away) — API order matches DB order
  // - Cup final: use team name matching since API order may differ from DB
  const API_TO_DB: Record<string, string> = {
    'union st. gilloise': 'Union',
    'club brugge kv': 'Club Brugge',
    'st. truiden': 'STVV',
    'gent': 'Gent',
    'kv mechelen': 'Mechelen',
    'anderlecht': 'Anderlecht',
  }
  const matchTeamName = useCallback((apiName: string | undefined, dbName: string) => {
    if (!apiName) return false
    const mapped = API_TO_DB[apiName.toLowerCase()]
    if (mapped) return mapped === dbName
    const api = apiName.toLowerCase()
    const db = dbName.toLowerCase()
    return api.includes(db) || db.includes(api)
  }, [])

  const homeGoals = goalEvents.filter(e => {
    if (result) return e.teamId === homeTeamId
    // Cup final: use name matching; league: use positional order
    if (isCupFinal && e.teamName) return matchTeamName(e.teamName, homeTeamName)
    return e.teamId === 0
  })
  const awayGoals = goalEvents.filter(e => {
    if (result) return e.teamId === awayTeamId
    if (isCupFinal && e.teamName) return matchTeamName(e.teamName, awayTeamName)
    return e.teamId === 1
  })

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
                <span className={`heading-display text-3xl ${liveScoreColor} mt-0.5`}>
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
              <span className={`heading-display text-3xl ${liveScoreColor}`}>
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

      <MatchGoalTimeline homeGoals={homeGoals} awayGoals={awayGoals} />

      <p className="text-center text-xs text-gray-500 mt-4">
        {isCupFinal ? 'Bekerfinale' : `Speeldag ${speeldag}`}
        {formattedDate && ` — ${formattedDate}`}
      </p>
    </div>
  )
}
