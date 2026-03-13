'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import PlayerCombobox from '@/components/PlayerCombobox'
import PaymentSection from '@/components/PaymentSection'
import { getTeamLogo } from '@/lib/teamLogos'
import type { Match, Team, ExtraQuestion, FootballPlayer } from '@/lib/types'

interface MatchWithTeams extends Match {
  home_team: Team
  away_team: Team
}

const TEAM_QUESTIONS = ['bekerwinnaar', 'beste_ploeg_poi', 'meeste_goals_poi', 'minste_goals_tegen_poi', 'kampioen']
const BEKER_TEAMS = ['Anderlecht', 'Union']

const PLAYER_QUESTIONS: Record<string, { filterGk: boolean; sortBy: 'goals' | 'assists' | 'clean_sheets'; statLabel: string }> = {
  topscorer_poi: { filterGk: false, sortBy: 'goals', statLabel: 'goals' },
  assistenkoning_poi: { filterGk: false, sortBy: 'assists', statLabel: 'assists' },
  meeste_clean_sheets_poi: { filterGk: true, sortBy: 'clean_sheets', statLabel: 'CS' },
}

type Step = 'regels' | 'naam' | 'voorspellingen' | 'extra' | 'bevestiging'

const STORAGE_KEY = 'meedoen-form'

function TeamLogo({ name, size = 18 }: { name: string; size?: number }) {
  const logo = getTeamLogo(name)
  if (!logo) return null
  return <Image src={logo} alt={name} width={size} height={size} className="inline-block" />
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'naam', label: 'Naam' },
  { key: 'voorspellingen', label: 'Prono' },
  { key: 'extra', label: 'Extra' },
  { key: 'bevestiging', label: 'Betaling' },
]

function StepBar({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex(s => s.key === current)
  return (
    <div className="w-full max-w-sm mx-auto mb-8">
      <div className="flex items-start">
        {STEPS.map((s, i) => {
          const isDone = i < currentIndex
          const isActive = i === currentIndex
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center relative">
              {/* Connecting line */}
              {i > 0 && (
                <div
                  className={`absolute top-3.5 right-1/2 w-full h-px ${
                    i <= currentIndex ? 'bg-cb-blue/40' : 'bg-white/[0.06]'
                  }`}
                />
              )}
              {/* Circle */}
              <div
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? 'bg-cb-blue text-white'
                    : isDone
                    ? 'bg-cb-blue/20 text-cb-blue'
                    : 'bg-white/[0.04] text-gray-600'
                }`}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {/* Label */}
              <span
                className={`text-[10px] heading-display tracking-wider mt-1.5 ${
                  isActive ? 'text-white' : isDone ? 'text-gray-500' : 'text-gray-600'
                }`}
              >
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function loadSavedForm(): { step?: Step; firstName?: string; lastName?: string; predictions?: Record<number, { home: string; away: string }>; extraAnswers?: Record<number, string> } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function MeedoenPage() {
  const supabase = createClient()
  const [step, setStep] = useState<Step>(() => {
    const saved = loadSavedForm()
    return saved?.step && saved.step !== 'bevestiging' ? saved.step : 'regels'
  })
  const [locked, setLocked] = useState<boolean | null>(null)
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [questions, setQuestions] = useState<ExtraQuestion[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [footballPlayers, setFootballPlayers] = useState<FootballPlayer[]>([])
  const [existingNames, setExistingNames] = useState<string[]>([])

  const [firstName, setFirstName] = useState(() => loadSavedForm()?.firstName ?? '')
  const [lastName, setLastName] = useState(() => loadSavedForm()?.lastName ?? '')
  const [predictions, setPredictions] = useState<Record<number, { home: string; away: string }>>(() => loadSavedForm()?.predictions ?? {})
  const [extraAnswers, setExtraAnswers] = useState<Record<number, string>>(() => loadSavedForm()?.extraAnswers ?? {})

  useEffect(() => {
    if (step === 'bevestiging') {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, firstName, lastName, predictions, extraAnswers }))
    } catch { /* storage full or unavailable */ }
  }, [step, firstName, lastName, predictions, extraAnswers])

  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const loadData = useCallback(async () => {
    const [matchesRes, questionsRes, teamsRes, deadlineRes, playersRes, existingRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .order('speeldag', { ascending: true })
        .order('match_datetime', { ascending: true }),
      supabase.from('extra_questions').select('*').order('id'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('settings').select('value').eq('key', 'deadline').single(),
      supabase.from('football_players').select('*'),
      supabase.from('players').select('display_name'),
    ])

    setMatches(matchesRes.data || [])
    setQuestions(questionsRes.data || [])
    setTeams(teamsRes.data || [])
    setFootballPlayers(playersRes.data || [])
    setExistingNames((existingRes.data || []).map(p => p.display_name.toLowerCase()))

    const dl = deadlineRes.data?.value
    if (dl) {
      setDeadline(dl)
      setLocked(Date.now() >= new Date(dl).getTime())
    } else {
      setLocked(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const playerOptionsBySort = useMemo(() => {
    const makeSorted = (
      sortBy: 'goals' | 'assists' | 'clean_sheets',
      filterGk: boolean,
    ) => {
      const filtered = filterGk
        ? footballPlayers.filter(p => p.position === 'GK')
        : footballPlayers
      return [...filtered]
        .sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0))
        .map(p => ({ name: p.name, team: p.team, stat: p[sortBy] ?? 0 }))
    }
    return {
      goals: makeSorted('goals', false),
      assists: makeSorted('assists', false),
      clean_sheets: makeSorted('clean_sheets', true),
    }
  }, [footballPlayers])

  const handleScoreInput = (matchId: number, side: 'home' | 'away', value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const current = predictions[matchId] || { home: '', away: '' }
    const updated = { ...current, [side]: digit }
    setPredictions(prev => ({ ...prev, [matchId]: updated }))

    if (digit !== '') {
      if (side === 'home') {
        const nextKey = `${matchId}-away`
        inputRefs.current[nextKey]?.focus()
        inputRefs.current[nextKey]?.select()
      } else {
        const matchIndex = matches.findIndex(m => m.id === matchId)
        if (matchIndex < matches.length - 1) {
          const nextMatch = matches[matchIndex + 1]
          const nextKey = `${nextMatch.id}-home`
          setTimeout(() => {
            inputRefs.current[nextKey]?.focus()
            inputRefs.current[nextKey]?.select()
          }, 50)
        }
      }
    }
  }

  const filledPredictions = Object.values(predictions).filter(p => p.home !== '' && p.away !== '').length
  const filledExtra = Object.values(extraAnswers).filter(a => a.trim() !== '').length
  const allPredictionsFilled = filledPredictions === matches.length
  const allExtraFilled = filledExtra === questions.length

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)

    const predArray = matches.map(m => ({
      matchId: m.id,
      home: Number(predictions[m.id]?.home ?? ''),
      away: Number(predictions[m.id]?.away ?? ''),
    }))

    const extraArray = questions.map(q => ({
      questionId: q.id,
      answer: extraAnswers[q.id] || '',
    }))

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: `${firstName.trim()} ${lastName.trim()}`,
          predictions: predArray,
          extraAnswers: extraArray,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Er ging iets mis')
        setSubmitting(false)
        return
      }

      setPlayerId(data.playerId)
      setStep('bevestiging')
    } catch {
      setError('Er ging iets mis')
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = matches.reduce<Record<string, MatchWithTeams[]>>((acc, m) => {
    const key = m.is_cup_final ? 'Bekerfinale' : `Speeldag ${m.speeldag}`
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  if (locked === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-cb-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (locked) {
    return (
      <div className="max-w-lg mx-auto text-center py-24 px-6">
        <div className="glass-card-subtle p-10">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <h1 className="heading-display text-3xl mb-3">Inschrijvingen gesloten</h1>
          <p className="text-gray-500 text-sm">
            De pronostieken zijn vergrendeld. Je kan niet meer meedoen.
          </p>
          <Link href="/" className="inline-block mt-8 btn-primary">
            Bekijk het klassement
          </Link>
        </div>
      </div>
    )
  }

  // Step 1: Regels / DOE MEE landing
  if (step === 'regels') {
    return (
      <div className="max-w-lg mx-auto px-6 py-8 md:py-12">
        <div className="text-center mb-10">
          <h1 className="heading-display text-5xl md:text-6xl text-white leading-none">
            DOE <span className="text-cb-blue">MEE</span>
          </h1>
          <p className="mt-4 text-gray-400 text-sm md:text-base">
            Voorspel de play-off uitslagen, strijd tegen vrienden en familie,
            en bewijs dat jij de echte voetbal kenner bent.
          </p>
        </div>

        {/* How it works */}
        <div className="space-y-3 mb-8">
          <div className="glass-card-subtle p-4 flex items-start gap-4">
            <span className="heading-display text-lg text-cb-blue mt-0.5">1</span>
            <div>
              <div className="text-sm text-white font-medium">Voorspel alle wedstrijden</div>
              <div className="text-xs text-gray-500 mt-0.5">Vul de exacte score in voor elke match</div>
            </div>
          </div>
          <div className="glass-card-subtle p-4 flex items-start gap-4">
            <span className="heading-display text-lg text-cb-blue mt-0.5">2</span>
            <div>
              <div className="text-sm text-white font-medium">Beantwoord de bonusvragen</div>
              <div className="text-xs text-gray-500 mt-0.5">Topscorer, kampioen, bekerwinnaar...</div>
            </div>
          </div>
          <div className="glass-card-subtle p-4 flex items-start gap-4">
            <span className="heading-display text-lg text-cb-blue mt-0.5">3</span>
            <div>
              <div className="text-sm text-white font-medium">Volg het klassement</div>
              <div className="text-xs text-gray-500 mt-0.5">Bekijk na elke speeldag wie er bovenaan staat</div>
            </div>
          </div>
        </div>

        {/* Scoring - collapsed */}
        <div className="glass-card-subtle p-4 mb-8">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Puntentelling</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-400">
            <span>Exacte score</span>
            <span className="text-right text-gray-300">10 + goals</span>
            <span>Juist doelpuntenverschil</span>
            <span className="text-right text-gray-300">7 punten</span>
            <span>Juist resultaat</span>
            <span className="text-right text-gray-300">5 punten</span>
            <span>Fout</span>
            <span className="text-right text-gray-300">0 punten</span>
          </div>
        </div>

        {deadline && (
          <div className="mb-6 px-4 py-3 rounded-lg text-xs text-gray-400 border border-white/[0.06] text-center">
            Deadline: {new Date(deadline).toLocaleString('nl-BE', { dateStyle: 'long', timeStyle: 'short' })}
          </div>
        )}

        <button
          onClick={() => setStep('naam')}
          className="w-full btn-primary py-3.5 heading-display tracking-wider text-base"
        >
          SCHRIJF JE IN &rarr;
        </button>
        <p className="text-center text-xs text-gray-600 mt-3">
          Duurt maar 2 minuten
        </p>
      </div>
    )
  }

  // Step 2: Naam
  if (step === 'naam') {
    return (
      <div className="max-w-lg mx-auto px-6 py-8">
        <StepBar current="naam" />
        <h1 className="heading-display text-3xl md:text-4xl text-white mb-8">JOUW NAAM</h1>

        <div className="glass-card-subtle p-6 md:p-8">
          <p className="text-sm text-gray-400 mb-6">
            Kies een naam die zichtbaar is in het klassement. Dit kan je achteraf niet meer wijzigen.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Voornaam</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Je voornaam"
                maxLength={25}
                className="w-full px-4 py-3 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Achternaam</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Je achternaam"
                maxLength={25}
                className="w-full px-4 py-3 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => { setError(''); setStep('regels') }}
              className="btn-secondary py-3 px-6"
            >
              Terug
            </button>
            <button
              onClick={() => {
                if (!firstName.trim()) {
                  setError('Voornaam is verplicht')
                  return
                }
                if (!lastName.trim()) {
                  setError('Achternaam is verplicht')
                  return
                }
                const fullName = `${firstName.trim()} ${lastName.trim()}`
                if (existingNames.includes(fullName.toLowerCase())) {
                  setError('Deze naam is al in gebruik')
                  return
                }
                setError('')
                setStep('voorspellingen')
              }}
              className="flex-1 btn-primary py-3"
            >
              Volgende
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Voorspellingen
  if (step === 'voorspellingen') {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <StepBar current="voorspellingen" />
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="heading-display text-3xl md:text-4xl text-white">VOORSPELLINGEN</h1>
          </div>
          <div className="flex items-center gap-1">
            <span className="heading-display text-2xl text-cb-blue font-bold">{filledPredictions}</span>
            <span className="text-sm text-gray-500">/{matches.length}</span>
          </div>
        </div>

        <div className="mb-6 glass-card-subtle px-4 py-3 text-xs text-gray-500 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Vul een cijfer in en het springt automatisch naar het volgende veld.
        </div>

        <div className="space-y-10">
          {Object.entries(grouped).map(([label, groupMatches]) => (
            <div key={label}>
              <h2 className="heading-display text-sm text-gray-500 mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-cb-blue rounded-full" />
                {label}
              </h2>
              <div className="space-y-2">
                {groupMatches.map((match) => {
                  const pred = predictions[match.id] || { home: '', away: '' }
                  const isFilled = pred.home !== '' && pred.away !== ''
                  return (
                    <div
                      key={match.id}
                      className={`glass-card-subtle p-3 md:p-4 flex items-center gap-2 md:gap-3 ${isFilled ? 'border-cb-blue/20' : ''}`}
                    >
                      <span className="flex-1 text-right text-xs md:text-sm font-medium truncate flex items-center justify-end gap-1.5 text-gray-300">
                        {match.home_team.name}
                        <TeamLogo name={match.home_team.name} />
                      </span>
                      <input
                        ref={el => { inputRefs.current[`${match.id}-home`] = el }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pred.home}
                        onChange={(e) => handleScoreInput(match.id, 'home', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-10 h-10 text-center bg-cb-dark border border-white/[0.06] rounded-lg text-white font-bold focus:outline-none focus:border-cb-blue transition-colors"
                      />
                      <span className="text-gray-600 text-xs">-</span>
                      <input
                        ref={el => { inputRefs.current[`${match.id}-away`] = el }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pred.away}
                        onChange={(e) => handleScoreInput(match.id, 'away', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-10 h-10 text-center bg-cb-dark border border-white/[0.06] rounded-lg text-white font-bold focus:outline-none focus:border-cb-blue transition-colors"
                      />
                      <span className="flex-1 text-left text-xs md:text-sm font-medium truncate flex items-center gap-1.5 text-gray-300">
                        <TeamLogo name={match.away_team.name} />
                        {match.away_team.name}
                      </span>
                      <svg className={`w-4 h-4 shrink-0 transition-colors ${isFilled ? 'text-cb-blue' : 'text-transparent'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

        <div className="flex gap-3 mt-10">
          <button
            onClick={() => setStep('naam')}
            className="btn-secondary py-3 px-6"
          >
            Terug
          </button>
          <button
            onClick={() => {
              if (!allPredictionsFilled) {
                setError('Vul alle wedstrijden in')
                return
              }
              setError('')
              setStep('extra')
            }}
            disabled={!allPredictionsFilled}
            className="flex-1 btn-primary py-3 disabled:opacity-40"
          >
            Volgende
          </button>
        </div>
      </div>
    )
  }

  // Step 4: Extra vragen
  if (step === 'extra') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <StepBar current="extra" />
        <h1 className="heading-display text-3xl md:text-4xl text-white mb-8">EXTRA VRAGEN</h1>

        <div className="space-y-4">
          {questions.map((q) => {
            const isTeamQuestion = TEAM_QUESTIONS.includes(q.question_key)
            const playerConfig = PLAYER_QUESTIONS[q.question_key]
            const teamOptions = q.question_key === 'bekerwinnaar'
              ? teams.filter(t => BEKER_TEAMS.includes(t.name))
              : teams
            return (
              <div key={q.id} className="glass-card-subtle p-4 md:p-5">
                <label className="block text-sm font-medium mb-3 text-gray-200">
                  {q.question_label}
                  {q.points === 20 && (
                    <span className="ml-2 text-xs text-cb-blue font-bold px-1.5 py-0.5 bg-cb-blue/10 rounded">20 pts</span>
                  )}
                  {q.points === 10 && (
                    <span className="ml-2 text-xs text-gray-500">10 pts</span>
                  )}
                </label>
                {isTeamQuestion ? (
                  <select
                    value={extraAnswers[q.id] || ''}
                    onChange={(e) =>
                      setExtraAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors [&>option]:bg-cb-dark [&>option]:text-white"
                  >
                    <option value="">Kies een ploeg...</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : playerConfig ? (
                  <PlayerCombobox
                    options={playerOptionsBySort[playerConfig.sortBy]}
                    value={extraAnswers[q.id] || ''}
                    onChange={(val) =>
                      setExtraAnswers((prev) => ({ ...prev, [q.id]: val }))
                    }
                    placeholder="Zoek een speler..."
                    statLabel={playerConfig.statLabel}
                  />
                ) : (
                  <input
                    type="text"
                    value={extraAnswers[q.id] || ''}
                    onChange={(e) =>
                      setExtraAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="Typ je antwoord..."
                    className="w-full px-4 py-3 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors"
                  />
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

        <div className="flex gap-3 mt-10">
          <button
            onClick={() => { setError(''); setStep('voorspellingen') }}
            className="btn-secondary py-3 px-6"
          >
            Terug
          </button>
          <button
            onClick={() => {
              if (!allExtraFilled) {
                setError('Beantwoord alle vragen')
                return
              }
              setError('')
              handleSubmit()
            }}
            disabled={!allExtraFilled || submitting}
            className="flex-1 btn-primary py-3 disabled:opacity-40"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Versturen...
              </span>
            ) : 'Verstuur'}
          </button>
        </div>
      </div>
    )
  }

  // Step 5: Bevestiging
  if (step === 'bevestiging') {
    return (
      <div className="max-w-lg mx-auto py-8 px-6 space-y-8">
        <StepBar current="bevestiging" />
        <div className="glass-card-subtle p-8 md:p-10 text-center">
          <svg className="w-16 h-16 text-cb-blue mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
          <h1 className="heading-display text-3xl mb-3">INGESCHREVEN!</h1>
          <p className="text-gray-400 mb-8">
            Bedankt <span className="text-white font-medium">{firstName} {lastName}</span>! Je voorspellingen zijn opgeslagen.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="btn-primary py-3 text-center"
            >
              Bekijk het klassement
            </Link>
            {playerId && (
              <Link
                href={`/player/${playerId}`}
                className="btn-secondary py-3 text-center"
              >
                Bekijk je voorspellingen
              </Link>
            )}
          </div>
        </div>

        {playerId && (
          <PaymentSection
            playerId={playerId}
            playerName={`${firstName.trim()} ${lastName.trim()}`}
          />
        )}
      </div>
    )
  }

  return null
}
