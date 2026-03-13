'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PlayerCombobox from '@/components/PlayerCombobox'
import PaymentSection from '@/components/PaymentSection'
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

  // Form state (restored from localStorage)
  const [firstName, setFirstName] = useState(() => loadSavedForm()?.firstName ?? '')
  const [lastName, setLastName] = useState(() => loadSavedForm()?.lastName ?? '')
  const [predictions, setPredictions] = useState<Record<number, { home: string; away: string }>>(() => loadSavedForm()?.predictions ?? {})
  const [extraAnswers, setExtraAnswers] = useState<Record<number, string>>(() => loadSavedForm()?.extraAnswers ?? {})

  // Persist form state to localStorage
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

    // Auto-lock based on deadline setting
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

  // Group matches by speeldag
  const grouped = matches.reduce<Record<string, MatchWithTeams[]>>((acc, m) => {
    const key = m.is_cup_final ? 'Bekerfinale' : `Speeldag ${m.speeldag}`
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  if (locked === null) {
    return <div className="text-center py-12 text-gray-400">Laden...</div>
  }

  if (locked) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="bg-card rounded-xl p-8 border border-border">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Inschrijvingen gesloten</h1>
          <p className="text-gray-400">
            De pronostieken zijn vergrendeld. Je kan niet meer meedoen.
          </p>
          <Link href="/" className="inline-block mt-6 text-cb-gold hover:underline text-sm">
            Bekijk het klassement
          </Link>
        </div>
      </div>
    )
  }

  // Step 1: Regels
  if (step === 'regels') {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">MEEDOEN</h1>
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-cb-gold">Spelregels</h2>

          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <h3 className="font-medium text-white mb-1">Wedstrijdvoorspellingen</h3>
              <p>Voorspel de exacte score van 31 wedstrijden (30 competitie + 1 bekerfinale).</p>
              <ul className="mt-2 space-y-1 text-gray-400">
                <li><span className="text-green-400 font-bold">Exacte score</span> = 10 punten + totaal aantal goals</li>
                <li><span className="text-green-400">Juist doelpuntenverschil</span> = 7 punten</li>
                <li><span className="text-yellow-400">Juist resultaat</span> (winst/gelijk/verlies) = 5 punten</li>
                <li><span className="text-red-400">Fout</span> = 0 punten</li>
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                Voorbeeld: je voorspelt 2-1 en het wordt 2-1 → 5 + 2 + 3 + 3 = 13 punten
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-1">Extra vragen</h3>
              <p>Beantwoord 8 extra vragen over het seizoen.</p>
              <ul className="mt-2 space-y-1 text-gray-400">
                <li>Standaardvragen: <span className="text-gray-300">10 punten</span></li>
                <li>Bonusvragen: <span className="text-cb-gold font-bold">20 punten</span></li>
              </ul>
            </div>
          </div>

          {deadline && (
            <div className="px-4 py-2 rounded-lg text-sm bg-cb-blue/20 text-cb-gold">
              Deadline: {new Date(deadline).toLocaleString('nl-BE', { dateStyle: 'long', timeStyle: 'short' })}
            </div>
          )}

          <button
            onClick={() => setStep('naam')}
            className="w-full py-3 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 transition-colors"
          >
            Ik doe mee!
          </button>
        </div>
      </div>
    )
  }

  // Step 2: Naam
  if (step === 'naam') {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">JOUW NAAM</h1>
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-gray-400 mb-4">
            Kies een naam die zichtbaar is in het klassement. Dit kan je achteraf niet meer wijzigen.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Voornaam"
              maxLength={25}
              className="flex-1 px-4 py-3 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Achternaam"
              maxLength={25}
              className="flex-1 px-4 py-3 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
            />
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setError(''); setStep('regels') }}
              className="px-6 py-3 bg-cb-dark text-gray-300 font-medium rounded-lg border border-border hover:bg-cb-dark/80 transition-colors"
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
              className="flex-1 py-3 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 transition-colors"
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
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">VOORSPELLINGEN</h1>
          <span className="text-sm text-gray-400">{filledPredictions}/{matches.length} ingevuld</span>
        </div>

        <div className="mb-6 px-4 py-2 rounded-lg text-xs bg-cb-dark border border-border text-gray-400">
          Vul een cijfer in en het springt automatisch naar het volgende veld.
        </div>

        <div className="space-y-8">
          {Object.entries(grouped).map(([label, groupMatches]) => (
            <div key={label}>
              <h2 className="text-sm font-semibold text-cb-gold uppercase tracking-wide mb-3">
                {label}
              </h2>
              <div className="space-y-2">
                {groupMatches.map((match) => {
                  const pred = predictions[match.id] || { home: '', away: '' }
                  return (
                    <div
                      key={match.id}
                      className="bg-card rounded-lg border border-border p-3 flex items-center gap-2"
                    >
                      <span className="flex-1 text-right text-sm font-medium truncate">
                        {match.home_team.name}
                      </span>
                      <input
                        ref={el => { inputRefs.current[`${match.id}-home`] = el }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pred.home}
                        onChange={(e) => handleScoreInput(match.id, 'home', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-10 h-10 text-center bg-cb-dark border border-border rounded-lg text-white font-bold focus:outline-none focus:border-cb-blue"
                      />
                      <span className="text-gray-500 text-xs">-</span>
                      <input
                        ref={el => { inputRefs.current[`${match.id}-away`] = el }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pred.away}
                        onChange={(e) => handleScoreInput(match.id, 'away', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-10 h-10 text-center bg-cb-dark border border-border rounded-lg text-white font-bold focus:outline-none focus:border-cb-blue"
                      />
                      <span className="flex-1 text-left text-sm font-medium truncate">
                        {match.away_team.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => setStep('naam')}
            className="px-6 py-3 bg-cb-dark text-gray-300 font-medium rounded-lg border border-border hover:bg-cb-dark/80 transition-colors"
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
            className="flex-1 py-3 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 transition-colors disabled:opacity-50"
          >
            Volgende
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
    )
  }

  // Step 4: Extra vragen
  if (step === 'extra') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">EXTRA VRAGEN</h1>

        <div className="space-y-4">
          {questions.map((q) => {
            const isTeamQuestion = TEAM_QUESTIONS.includes(q.question_key)
            const playerConfig = PLAYER_QUESTIONS[q.question_key]
            const teamOptions = q.question_key === 'bekerwinnaar'
              ? teams.filter(t => BEKER_TEAMS.includes(t.name))
              : teams
            return (
              <div key={q.id} className="bg-card rounded-lg border border-border p-4">
                <label className="block text-sm font-medium mb-2">
                  {q.question_label}
                  {q.points === 20 && (
                    <span className="ml-2 text-xs text-cb-gold font-bold">20 pts</span>
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
                    className="w-full px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
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
                    className="w-full px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
                  />
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => { setError(''); setStep('voorspellingen') }}
            className="px-6 py-3 bg-cb-dark text-gray-300 font-medium rounded-lg border border-border hover:bg-cb-dark/80 transition-colors"
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
            className="flex-1 py-3 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Versturen...' : 'Verstuur'}
          </button>
        </div>
      </div>
    )
  }

  // Step 5: Bevestiging
  if (step === 'bevestiging') {
    return (
      <div className="max-w-lg mx-auto py-12 space-y-6">
        <div className="bg-card rounded-xl p-8 border border-border text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold mb-2">Ingeschreven!</h1>
          <p className="text-gray-400 mb-6">
            Bedankt <span className="text-white font-medium">{firstName} {lastName}</span>! Je voorspellingen zijn opgeslagen.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="px-6 py-3 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 transition-colors"
            >
              Bekijk het klassement
            </Link>
            {playerId && (
              <Link
                href={`/player/${playerId}`}
                className="px-6 py-3 bg-cb-dark text-gray-300 font-medium rounded-lg border border-border hover:bg-cb-dark/80 transition-colors"
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
