'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import TeamLogo from '@/components/TeamLogo'
import LiveMatchBadge from '@/components/LiveMatchBadge'
import { useLiveScores } from '@/lib/live-scores'
import type { LiveScore } from '@/lib/live-scores'

export interface LiveMatchData {
  id: number
  home_team: { name: string }
  away_team: { name: string }
  match_datetime: string | null
  speeldag: number | null
  is_cup_final: boolean
  sofascore_event_id: number | null
  formatted?: { day: string; date: string; time: string }
}

interface Props {
  matches: LiveMatchData[]
  resultMap: Record<number, { home_score: number; away_score: number }>
  variant: 'current' | 'upcoming' | 'played'
}

function formatMatchDate(datetime: string) {
  const d = new Date(datetime)
  const day = d.toLocaleDateString('nl-BE', { weekday: 'short', timeZone: 'Europe/Brussels' })
  const date = d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' })
  const time = d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })
  return { day, date, time }
}

export default function LiveMatchList({ matches, resultMap, variant }: Props) {
  const [mountTime] = useState(() => Date.now())
  const isMock = process.env.NEXT_PUBLIC_LIVE_MOCK === 'true'
  const eventIdMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const m of matches) {
      if (
        m.sofascore_event_id &&
        !resultMap[m.id] &&
        (isMock || (m.match_datetime && new Date(m.match_datetime).getTime() <= mountTime))
      ) {
        map[m.id] = m.sofascore_event_id
      }
    }
    return map
  }, [matches, resultMap, isMock])

  const liveScores = useLiveScores(eventIdMap)

  return (
    <div className="space-y-2">
      {matches.map((match) => {
        const result = resultMap[match.id]
        const live = liveScores[match.id] as LiveScore | undefined

        if (variant === 'played') {
          return <PlayedCard key={match.id} match={match} result={result} live={live} />
        }
        if (variant === 'upcoming') {
          return <UpcomingCard key={match.id} match={match} live={live} />
        }
        return <CurrentCard key={match.id} match={match} result={result} live={live} />
      })}
    </div>
  )
}

function CurrentCard({ match, result, live }: { match: Props['matches'][0]; result?: { home_score: number; away_score: number }; live?: LiveScore }) {
  const { day, date, time } = match.formatted
    ? match.formatted
    : match.match_datetime
      ? formatMatchDate(match.match_datetime)
      : { day: '', date: '', time: '' }

  const isLive = live && live.statusType === 'inprogress'
  const isFinished = live && live.statusType === 'finished' && !result
  const hasLiveScore = live && live.homeScore !== null && live.awayScore !== null && !result
  const scoreColor = isLive ? 'text-red-400' : 'text-white'
  const scoreBgColor = isLive ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.06] text-white'

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`glass-card-subtle p-3 md:p-4 hover:bg-white/[0.03] transition-colors block ${isLive ? 'border-cb-blue/30' : 'border-cb-blue/15'}`}
    >
      {/* Mobile */}
      <div className="md:hidden flex items-center gap-3">
        <div className="text-[10px] text-gray-500 w-[48px] text-right shrink-0 leading-tight">
          <div className="capitalize">{day} {date}</div>
          <div>{time}</div>
          {hasLiveScore && (
            <div className="mt-0.5">
              <LiveMatchBadge score={live!} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <TeamLogo name={match.home_team.name} />
            <span className="text-sm text-gray-200 truncate flex-1">{match.home_team.name}</span>
            {result && <span className="text-white font-bold text-sm tabular-nums shrink-0">{result.home_score}</span>}
            {hasLiveScore && <span className={`${scoreColor} font-bold text-sm tabular-nums shrink-0`}>{live!.homeScore}</span>}
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo name={match.away_team.name} />
            <span className="text-sm text-gray-200 truncate flex-1">{match.away_team.name}</span>
            {result && <span className="text-white font-bold text-sm tabular-nums shrink-0">{result.away_score}</span>}
            {hasLiveScore && <span className={`${scoreColor} font-bold text-sm tabular-nums shrink-0`}>{live!.awayScore}</span>}
          </div>
        </div>
        <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-4">
        <div className="text-center min-w-[60px]">
          <div className="text-xs text-gray-400 capitalize">{day} {date}</div>
          <div className="text-xs text-gray-500 mt-0.5">{time}</div>
          {hasLiveScore && (
            <div className="mt-0.5">
              <LiveMatchBadge score={live!} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <TeamLogo name={match.home_team.name} />
            <span className="truncate">{match.home_team.name}</span>
            {result ? (
              <span className="bg-white/[0.06] px-2 py-0.5 rounded text-white font-bold text-xs shrink-0">
                {result.home_score}-{result.away_score}
              </span>
            ) : hasLiveScore ? (
              <span className={`${scoreBgColor} px-2 py-0.5 rounded font-bold text-xs shrink-0`}>
                {live!.homeScore}-{live!.awayScore}
              </span>
            ) : (
              <span className="text-gray-600 text-xs shrink-0">-</span>
            )}
            <span className="truncate">{match.away_team.name}</span>
            <TeamLogo name={match.away_team.name} />
          </div>
        </div>
        <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

function UpcomingCard({ match, live }: { match: Props['matches'][0]; live?: LiveScore }) {
  const { day, date, time } = match.formatted
    ? match.formatted
    : match.match_datetime
      ? formatMatchDate(match.match_datetime)
      : { day: '', date: '', time: '' }

  const hasLiveScore = live && live.homeScore !== null && live.awayScore !== null
  const isLive = live && live.statusType === 'inprogress'
  const scoreColor = isLive ? 'text-red-400' : 'text-white'
  const scoreBgColor = isLive ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.06] text-white'

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`glass-card-subtle p-3 md:p-4 hover:bg-white/[0.03] transition-colors block ${isLive ? 'border-cb-blue/30' : ''}`}
    >
      {/* Mobile */}
      <div className="md:hidden flex items-center gap-3">
        <div className="text-[10px] text-gray-500 w-[48px] text-right shrink-0 leading-tight">
          <div className="capitalize">{day} {date}</div>
          <div>{time}</div>
          {hasLiveScore && (
            <div className="mt-0.5">
              <LiveMatchBadge score={live!} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <TeamLogo name={match.home_team.name} />
            <span className="text-sm text-gray-200 truncate flex-1">{match.home_team.name}</span>
            {hasLiveScore && <span className={`${scoreColor} font-bold text-sm tabular-nums shrink-0`}>{live!.homeScore}</span>}
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo name={match.away_team.name} />
            <span className="text-sm text-gray-200 truncate flex-1">{match.away_team.name}</span>
            {hasLiveScore && <span className={`${scoreColor} font-bold text-sm tabular-nums shrink-0`}>{live!.awayScore}</span>}
          </div>
        </div>
        <div className="text-[10px] text-gray-600 shrink-0 text-right">
          {match.is_cup_final ? 'Beker' : `SD ${match.speeldag}`} &rsaquo;
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center gap-4">
        <div className="text-center min-w-[60px]">
          <div className="text-xs text-gray-400 capitalize">{day} {date}</div>
          <div className="text-xs text-gray-500 mt-0.5">{time}</div>
          {hasLiveScore && (
            <div className="mt-0.5">
              <LiveMatchBadge score={live!} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <TeamLogo name={match.home_team.name} />
            <span className="truncate">{match.home_team.name}</span>
            {hasLiveScore ? (
              <span className={`${scoreBgColor} px-2 py-0.5 rounded font-bold text-xs shrink-0`}>
                {live!.homeScore}-{live!.awayScore}
              </span>
            ) : (
              <span className="text-gray-600 text-xs shrink-0">-</span>
            )}
            <span className="truncate">{match.away_team.name}</span>
            <TeamLogo name={match.away_team.name} />
          </div>
        </div>
        <span className="text-xs text-gray-600 shrink-0">
          {match.is_cup_final ? 'Beker' : `SD ${match.speeldag}`}
        </span>
        <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

function PlayedCard({ match, result, live }: { match: Props['matches'][0]; result: { home_score: number; away_score: number }; live?: LiveScore }) {
  const { day, date } = match.match_datetime
    ? formatMatchDate(match.match_datetime)
    : { day: '', date: '' }

  return (
    <Link
      href={`/matches/${match.id}`}
      scroll={true}
      className="glass-card-subtle p-3 md:p-4 hover:bg-white/[0.03] transition-colors block"
    >
      {/* Mobile */}
      <div className="md:hidden flex items-center gap-3">
        <div className="text-[10px] text-gray-500 w-[48px] text-right shrink-0 capitalize">
          {day} {date}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <TeamLogo name={match.home_team.name} />
            <span className="text-sm text-gray-200 truncate flex-1">{match.home_team.name}</span>
            <span className="text-white font-bold text-sm tabular-nums shrink-0">{result.home_score}</span>
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo name={match.away_team.name} />
            <span className="text-sm text-gray-200 truncate flex-1">{match.away_team.name}</span>
            <span className="text-white font-bold text-sm tabular-nums shrink-0">{result.away_score}</span>
          </div>
        </div>
        <div className="text-[10px] text-gray-600 shrink-0 text-right">
          {match.is_cup_final ? 'Beker' : `SD ${match.speeldag}`} &rsaquo;
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center gap-4">
        <div className="text-center min-w-[60px]">
          <div className="text-xs text-gray-500 capitalize">{day} {date}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <TeamLogo name={match.home_team.name} />
            <span className="truncate">{match.home_team.name}</span>
            <span className="bg-white/[0.06] px-2 py-0.5 rounded text-white font-bold text-xs shrink-0">
              {result.home_score}-{result.away_score}
            </span>
            <span className="truncate">{match.away_team.name}</span>
            <TeamLogo name={match.away_team.name} />
          </div>
        </div>
        <span className="text-xs text-gray-600 shrink-0">
          {match.is_cup_final ? 'Beker' : `SD ${match.speeldag}`}
        </span>
        <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
