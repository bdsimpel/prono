'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TeamLogo from '@/components/TeamLogo'
import TeamCombobox from '@/components/TeamCombobox'
import PlayerCombobox from '@/components/PlayerCombobox'
import type { ExtraQuestion, FootballPlayer, Match, Team } from '@/lib/types'

interface MatchWithTeams extends Match {
  home_team: Team
  away_team: Team
}

const PLAYED_MATCH_ID = 1

const TEAM_QUESTIONS = ['bekerwinnaar', 'beste_ploeg_poi', 'meeste_goals_poi', 'minste_goals_tegen_poi', 'kampioen']
const BEKER_TEAMS = ['Anderlecht', 'Union']

const PLAYER_QUESTIONS: Record<string, { filterGk: boolean; sortBy: 'goals' | 'assists' | 'clean_sheets'; statLabel: string }> = {
  topscorer_poi: { filterGk: false, sortBy: 'goals', statLabel: 'goals' },
  assistenkoning_poi: { filterGk: false, sortBy: 'assists', statLabel: 'assists' },
  meeste_clean_sheets_poi: { filterGk: true, sortBy: 'clean_sheets', statLabel: 'CS' },
}

export default function SamyPage() {
  const supabase = createClient()
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [questions, setQuestions] = useState<ExtraQuestion[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [footballPlayers, setFootballPlayers] = useState<FootballPlayer[]>([])
  const [playedPrediction, setPlayedPrediction] = useState<{ home: number; away: number } | null>(null)

  const [predictions, setPredictions] = useState<Record<number, { home: string; away: string }>>({})
  const [extraAnswers, setExtraAnswers] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Load data
  useEffect(() => {
    async function load() {
      const [matchRes, questionRes, teamRes, playerRes, predRes] = await Promise.all([
        supabase.from('matches').select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)').order('speeldag'),
        supabase.from('extra_questions').select('*').order('id'),
        supabase.from('teams').select('*'),
        supabase.from('football_players').select('*'),
        supabase.from('predictions').select('home_score, away_score').eq('user_id', 'cbc48793-04be-4b2c-9c74-23054654c602').eq('match_id', PLAYED_MATCH_ID).single(),
      ])
      setMatches((matchRes.data ?? []) as MatchWithTeams[])
      setQuestions(questionRes.data ?? [])
      setTeams(teamRes.data ?? [])
      setFootballPlayers(playerRes.data ?? [])
      if (predRes.data) setPlayedPrediction({ home: predRes.data.home_score, away: predRes.data.away_score })
    }
    load()
  }, [])

  // Group matches by speeldag
  const grouped = useMemo(() => {
    const groups: Record<string, MatchWithTeams[]> = {}
    for (const m of matches) {
      const key = m.is_cup_final ? 'Bekerfinale' : `Speeldag ${m.speeldag}`
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    }
    return groups
  }, [matches])

  // Player options for extra questions
  const playerOptionsBySort = useMemo(() => {
    const byGoals = [...footballPlayers].sort((a, b) => b.goals - a.goals)
    const byAssists = [...footballPlayers].sort((a, b) => b.assists - a.assists)
    const byCS = [...footballPlayers]
      .filter(p => p.position === 'Goalkeeper')
      .sort((a, b) => (b.clean_sheets ?? 0) - (a.clean_sheets ?? 0))
    return {
      goals: byGoals.map(p => ({ name: p.name, team: p.team, stat: p.goals })),
      assists: byAssists.map(p => ({ name: p.name, team: p.team, stat: p.assists })),
      clean_sheets: byCS.map(p => ({ name: p.name, team: p.team, stat: p.clean_sheets ?? 0 })),
    }
  }, [footballPlayers])

  // Input order for auto-advance
  const inputOrder = useMemo(() => {
    const order: string[] = []
    const sorted = Object.entries(grouped).sort(([a], [b]) =>
      a === 'Bekerfinale' ? 1 : b === 'Bekerfinale' ? -1 : 0
    )
    for (const [, groupMatches] of sorted) {
      for (const m of groupMatches) {
        if (m.id === PLAYED_MATCH_ID) continue
        order.push(`${m.id}-home`, `${m.id}-away`)
      }
    }
    return order
  }, [grouped])

  const handleScoreInput = useCallback((matchId: number, field: 'home' | 'away', value: string) => {
    if (value !== '' && !/^\d$/.test(value)) return
    setPredictions(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value },
    }))
    if (value !== '') {
      const currentKey = `${matchId}-${field}`
      const idx = inputOrder.indexOf(currentKey)
      if (idx >= 0 && idx < inputOrder.length - 1) {
        const nextKey = inputOrder[idx + 1]
        setTimeout(() => inputRefs.current[nextKey]?.focus(), 0)
      }
    }
  }, [inputOrder])

  // Validation
  const editableMatches = matches.filter(m => m.id !== PLAYED_MATCH_ID)
  const filledPredictions = editableMatches.filter(m => {
    const p = predictions[m.id]
    return p && p.home !== '' && p.away !== ''
  }).length
  const allPredictionsFilled = filledPredictions === editableMatches.length
  const allExtraFilled = questions.every(q => (extraAnswers[q.id] || '').trim() !== '')
  const allFilled = allPredictionsFilled && allExtraFilled

  async function handleSubmit() {
    if (!allFilled) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/samy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions, extraAnswers }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Er ging iets mis')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Er ging iets mis')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-8 px-6">
        <div className="glass-card-subtle p-8 text-center">
          <svg className="w-16 h-16 text-cb-blue mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="heading-display text-3xl mb-3">OPGESLAGEN!</h1>
          <p className="text-gray-400 mb-6">Je voorspellingen zijn bijgewerkt, Samy. Veel succes!</p>
          <a href="/" className="btn-primary py-3 px-6 inline-block">Bekijk het klassement</a>
        </div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-16 px-6 text-center">
        <div className="w-8 h-8 border-2 border-cb-blue border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="heading-display text-3xl md:text-4xl text-white">SAMY&apos;S VOORSPELLINGEN</h1>
          <p className="text-sm text-gray-500 mt-1">Vul je voorspellingen in voor alle wedstrijden</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="heading-display text-2xl text-cb-blue font-bold">{filledPredictions}</span>
          <span className="text-sm text-gray-500">/{editableMatches.length}</span>
        </div>
      </div>

      <div className="mb-6 glass-card-subtle px-4 py-3 text-xs text-gray-500 flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Vul een cijfer in en het springt automatisch naar het volgende veld.
      </div>

      {/* Match predictions */}
      <div className="space-y-10">
        {Object.entries(grouped)
          .sort(([a], [b]) => (a === 'Bekerfinale' ? 1 : b === 'Bekerfinale' ? -1 : 0))
          .map(([label, groupMatches]) => (
            <div key={label}>
              <h2 className="heading-display text-sm text-gray-500 mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-cb-blue rounded-full" />
                {label}
              </h2>
              <div className="space-y-2">
                {groupMatches.map((match) => {
                  const isPlayed = match.id === PLAYED_MATCH_ID
                  const pred = isPlayed
                    ? { home: String(playedPrediction?.home ?? ''), away: String(playedPrediction?.away ?? '') }
                    : predictions[match.id] || { home: '', away: '' }
                  const isFilled = pred.home !== '' && pred.away !== ''
                  return (
                    <div
                      key={match.id}
                      className={`glass-card-subtle p-3 flex items-center gap-1.5 md:gap-2 ${isFilled ? 'border-cb-blue/20' : ''} ${isPlayed ? 'opacity-50' : ''}`}
                    >
                      <span className="flex-1 text-right text-xs md:text-sm truncate flex items-center justify-end gap-1 md:gap-1.5 text-gray-300 min-w-0">
                        <span className="truncate">{match.home_team.name}</span>
                        <span className="shrink-0"><TeamLogo name={match.home_team.name} /></span>
                      </span>
                      <input
                        ref={(el) => { if (!isPlayed) inputRefs.current[`${match.id}-home`] = el }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pred.home}
                        onChange={(e) => !isPlayed && handleScoreInput(match.id, 'home', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        readOnly={isPlayed}
                        className={`w-9 h-9 md:w-10 md:h-10 text-center bg-cb-dark border rounded-lg text-white font-bold text-sm focus:outline-none transition-colors shrink-0 ${
                          isPlayed ? 'border-white/[0.06] cursor-not-allowed' : pred.home !== '' ? 'border-cb-blue/40 focus:border-cb-blue' : 'border-white/[0.06] focus:border-cb-blue'
                        }`}
                      />
                      <span className="text-gray-600 text-xs shrink-0">-</span>
                      <input
                        ref={(el) => { if (!isPlayed) inputRefs.current[`${match.id}-away`] = el }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pred.away}
                        onChange={(e) => !isPlayed && handleScoreInput(match.id, 'away', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        readOnly={isPlayed}
                        className={`w-9 h-9 md:w-10 md:h-10 text-center bg-cb-dark border rounded-lg text-white font-bold text-sm focus:outline-none transition-colors shrink-0 ${
                          isPlayed ? 'border-white/[0.06] cursor-not-allowed' : pred.away !== '' ? 'border-cb-blue/40 focus:border-cb-blue' : 'border-white/[0.06] focus:border-cb-blue'
                        }`}
                      />
                      <span className="flex-1 text-left text-xs md:text-sm truncate flex items-center gap-1 md:gap-1.5 text-gray-300 min-w-0">
                        <span className="shrink-0"><TeamLogo name={match.away_team.name} /></span>
                        <span className="truncate">{match.away_team.name}</span>
                      </span>
                      {isPlayed && <span className="text-[10px] text-gray-600 shrink-0">gespeeld</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>

      {/* Extra questions */}
      <h2 className="heading-display text-2xl md:text-3xl text-white mt-12 mb-6">EXTRA VRAGEN</h2>
      <div className="space-y-4">
        {questions.map((q) => {
          const isTeamQuestion = TEAM_QUESTIONS.includes(q.question_key)
          const playerConfig = PLAYER_QUESTIONS[q.question_key]
          const isBeker = q.question_key === 'bekerwinnaar'
          const baseTeams = isBeker ? teams.filter(t => BEKER_TEAMS.includes(t.name)) : teams
          const teamOptions = (() => {
            const sorted = [...baseTeams]
            if (q.question_key === 'meeste_goals_poi') sorted.sort((a, b) => (b.goals_for ?? 0) - (a.goals_for ?? 0))
            else if (q.question_key === 'minste_goals_tegen_poi') sorted.sort((a, b) => (a.goals_against ?? 0) - (b.goals_against ?? 0))
            else if (q.question_key === 'kampioen') sorted.sort((a, b) => (a.standing_rank ?? 99) - (b.standing_rank ?? 99))
            else if (q.question_key === 'beste_ploeg_poi') sorted.sort((a, b) => (b.points_half ?? 0) - (a.points_half ?? 0))
            return sorted
          })()
          const getTeamStatLabel = (t: Team) => {
            if (isBeker) return ''
            if (q.question_key === 'meeste_goals_poi') return `${t.goals_for ?? 0} goals`
            if (q.question_key === 'minste_goals_tegen_poi') return `${t.goals_against ?? 0} goals`
            if (q.question_key === 'kampioen') return `#${t.standing_rank} · ${t.points_half ?? 0} ptn`
            if (q.question_key === 'beste_ploeg_poi') return `${t.points_half ?? 0} ptn`
            return ''
          }
          const comboboxOptions = teamOptions.map(t => ({ name: t.name, statLabel: getTeamStatLabel(t) }))
          return (
            <div key={q.id} className="glass-card-subtle p-4 md:p-5">
              <label className="block text-sm font-medium mb-3 text-gray-200">
                {q.question_label}
                {q.points === 20 && <span className="ml-2 text-xs text-cb-blue font-bold px-1.5 py-0.5 bg-cb-blue/10 rounded">20 pts</span>}
                {q.points === 10 && <span className="ml-2 text-xs text-gray-500">10 pts</span>}
              </label>
              {isTeamQuestion ? (
                <TeamCombobox
                  options={comboboxOptions}
                  value={extraAnswers[q.id] || ''}
                  onChange={(val) => setExtraAnswers(prev => ({ ...prev, [q.id]: val }))}
                  placeholder="Kies een ploeg..."
                />
              ) : playerConfig ? (
                <PlayerCombobox
                  options={playerOptionsBySort[playerConfig.sortBy]}
                  value={extraAnswers[q.id] || ''}
                  onChange={(val) => setExtraAnswers(prev => ({ ...prev, [q.id]: val }))}
                  placeholder="Zoek een speler..."
                  statLabel={playerConfig.statLabel}
                />
              ) : (
                <input
                  type="text"
                  value={extraAnswers[q.id] || ''}
                  onChange={(e) => setExtraAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Typ je antwoord..."
                  className="w-full px-4 py-3 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors"
                />
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

      <div className="mt-10">
        <button
          onClick={handleSubmit}
          disabled={!allFilled || submitting}
          className="w-full btn-primary py-3.5 heading-display tracking-wider text-base disabled:opacity-40"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Versturen...
            </span>
          ) : (
            'OPSLAAN'
          )}
        </button>
        {!allFilled && (
          <p className="text-center text-xs text-gray-600 mt-3">
            Vul alle {editableMatches.length} wedstrijden en {questions.length} extra vragen in
          </p>
        )}
      </div>
    </div>
  )
}
