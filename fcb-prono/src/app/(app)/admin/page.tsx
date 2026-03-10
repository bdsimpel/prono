'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PlayerCombobox from '@/components/PlayerCombobox'
import type { Team, FootballPlayer } from '@/lib/types'

const PLAYER_QUESTIONS: Record<string, { filterGk: boolean; sortBy: 'goals' | 'assists' | 'clean_sheets'; statLabel: string }> = {
  topscorer_poi: { filterGk: false, sortBy: 'goals', statLabel: 'goals' },
  assistenkoning_poi: { filterGk: false, sortBy: 'assists', statLabel: 'assists' },
  meeste_clean_sheets_poi: { filterGk: true, sortBy: 'clean_sheets', statLabel: 'CS' },
}

const TEAM_QUESTIONS = ['bekerwinnaar', 'beste_ploeg_poi', 'meeste_goals_poi', 'minste_goals_tegen_poi', 'kampioen']
const SINGLE_ANSWER_QUESTIONS = ['kampioen', 'bekerwinnaar']
const BEKER_TEAMS = ['Anderlecht', 'Union']

interface MatchRow {
  id: number
  speeldag: number | null
  is_cup_final: boolean
  match_datetime: string | null
  home_team: Team
  away_team: Team
  results: { id: number; home_score: number; away_score: number }[]
}

export default function AdminPage() {
  const router = useRouter()
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [results, setResults] = useState<Record<number, { home: string; away: string }>>({})
  const [extraQuestions, setExtraQuestions] = useState<{ id: number; question_key: string; question_label: string }[]>([])
  const [footballPlayers, setFootballPlayers] = useState<FootballPlayer[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [extraAnswers, setExtraAnswers] = useState<Record<number, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) { router.push('/'); return }
    setIsAdmin(true)

    const [matchesRes, resultsRes, questionsRes, answersRes, playersRes, teamsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .order('speeldag', { ascending: true })
        .order('match_datetime', { ascending: true }),
      supabase.from('results').select('*'),
      supabase.from('extra_questions').select('id, question_key, question_label').order('id'),
      supabase.from('extra_question_answers').select('*'),
      supabase.from('football_players').select('*'),
      supabase.from('teams').select('*').order('name'),
    ])

    setMatches((matchesRes.data || []) as unknown as MatchRow[])

    const resultMap: Record<number, { home: string; away: string }> = {}
    for (const r of resultsRes.data || []) {
      resultMap[r.match_id] = { home: String(r.home_score), away: String(r.away_score) }
    }
    setResults(resultMap)

    setExtraQuestions(questionsRes.data || [])
    setFootballPlayers(playersRes.data || [])
    setTeams(teamsRes.data || [])

    const ansMap: Record<number, string[]> = {}
    for (const a of answersRes.data || []) {
      if (!ansMap[a.question_id]) ansMap[a.question_id] = []
      ansMap[a.question_id].push(a.correct_answer)
    }
    setExtraAnswers(ansMap)
    setLoaded(true)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [])

  const showMessage = (msg: string, isError = false) => {
    setMessage(isError ? `Fout: ${msg}` : msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleScoreInput = (matchId: number, side: 'home' | 'away', value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const current = results[matchId] || { home: '', away: '' }
    setResults(prev => ({ ...prev, [matchId]: { ...current, [side]: digit } }))

    if (digit !== '' && side === 'home') {
      const nextKey = `admin-${matchId}-away`
      if (inputRefs.current[nextKey]) {
        inputRefs.current[nextKey]?.focus()
        inputRefs.current[nextKey]?.select()
      }
    }
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, answers: extraAnswers }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage(`${data.resultsSaved} uitslagen + extra antwoorden opgeslagen, ${data.playersUpdated} spelers herberekend!`)
        await loadData()
      } else {
        showMessage(data.error || 'Onbekende fout', true)
      }
    } catch (err) {
      showMessage(`${err}`, true)
    }
    setSaving(false)
  }

  const addAnswer = (qId: number, value: string) => {
    if (!value.trim()) return
    setExtraAnswers(prev => {
      const current = prev[qId] || []
      if (current.includes(value)) return prev
      return { ...prev, [qId]: [...current, value] }
    })
  }

  const removeAnswer = (qId: number, value: string) => {
    setExtraAnswers(prev => {
      const current = prev[qId] || []
      return { ...prev, [qId]: current.filter(v => v !== value) }
    })
  }

  if (!loaded) return <div className="text-center py-12 text-gray-400">Laden...</div>
  if (!isAdmin) return null

  const grouped: Record<string, MatchRow[]> = {}
  for (const m of matches) {
    const key = m.is_cup_final ? 'Bekerfinale' : `Speeldag ${m.speeldag}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ADMIN</h1>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
          message.startsWith('Fout:') ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'
        }`}>
          {message}
        </div>
      )}

      <button
        onClick={saveAll}
        disabled={saving}
        className="px-6 py-2.5 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 disabled:opacity-50 mb-6"
      >
        {saving ? 'Opslaan & herberekenen...' : 'Alles opslaan & herberekenen'}
      </button>

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Uitslagen invoeren
      </h2>
      <div className="space-y-6 mb-8">
        {Object.entries(grouped).map(([label, groupMatches]) => (
          <div key={label}>
            <h3 className="text-xs font-medium text-cb-gold mb-2">{label}</h3>
            <div className="space-y-2">
              {groupMatches.map((match) => {
                const r = results[match.id] || { home: '', away: '' }
                return (
                  <div key={match.id} className="bg-card rounded-lg border border-border p-3 flex items-center gap-2">
                    <span className="flex-1 text-right text-sm truncate">{match.home_team.name}</span>
                    <input
                      ref={el => { inputRefs.current[`admin-${match.id}-home`] = el }}
                      type="text"
                      inputMode="numeric"
                      value={r.home}
                      onChange={(e) => handleScoreInput(match.id, 'home', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-10 h-10 text-center bg-cb-dark border border-border rounded-lg text-white font-bold focus:outline-none focus:border-cb-blue"
                    />
                    <span className="text-gray-500 text-xs">-</span>
                    <input
                      ref={el => { inputRefs.current[`admin-${match.id}-away`] = el }}
                      type="text"
                      inputMode="numeric"
                      value={r.away}
                      onChange={(e) => handleScoreInput(match.id, 'away', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-10 h-10 text-center bg-cb-dark border border-border rounded-lg text-white font-bold focus:outline-none focus:border-cb-blue"
                    />
                    <span className="flex-1 text-left text-sm truncate">{match.away_team.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Juiste antwoorden extra vragen
      </h2>
      <div className="space-y-3 mb-4">
        {extraQuestions.map((q) => {
          const playerConfig = PLAYER_QUESTIONS[q.question_key]
          const isTeamQuestion = TEAM_QUESTIONS.includes(q.question_key)
          const isSingle = SINGLE_ANSWER_QUESTIONS.includes(q.question_key)
          const answers = extraAnswers[q.id] || []
          const teamOptions = q.question_key === 'bekerwinnaar'
            ? teams.filter(t => BEKER_TEAMS.includes(t.name))
            : teams

          return (
            <div key={q.id} className="bg-card rounded-lg border border-border p-3 space-y-2">
              <span className="text-sm text-gray-400">{q.question_label}</span>

              {/* Show selected answers as chips (multi-answer questions) */}
              {!isSingle && answers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {answers.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-cb-blue/20 text-white text-xs rounded-md">
                      {a}
                      <button
                        type="button"
                        onClick={() => removeAnswer(q.id, a)}
                        className="text-gray-400 hover:text-white"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Input for adding answers */}
              {playerConfig ? (
                isSingle ? (
                  <div className="w-64">
                    <PlayerCombobox
                      options={playerOptionsBySort[playerConfig.sortBy]}
                      value={answers[0] || ''}
                      onChange={(val) => setExtraAnswers(prev => ({ ...prev, [q.id]: val ? [val] : [] }))}
                      placeholder="Zoek een speler..."
                      statLabel={playerConfig.statLabel}
                    />
                  </div>
                ) : (
                  <div className="w-64">
                    <PlayerCombobox
                      options={playerOptionsBySort[playerConfig.sortBy].filter(o => !answers.includes(o.name))}
                      value=""
                      onChange={(val) => addAnswer(q.id, val)}
                      placeholder="Speler toevoegen..."
                      statLabel={playerConfig.statLabel}
                    />
                  </div>
                )
              ) : isTeamQuestion ? (
                isSingle ? (
                  <select
                    value={answers[0] || ''}
                    onChange={(e) => setExtraAnswers(prev => ({ ...prev, [q.id]: e.target.value ? [e.target.value] : [] }))}
                    className="w-48 px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
                  >
                    <option value="">Kies een ploeg...</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teamOptions.map((t) => (
                      <label key={t.id} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={answers.includes(t.name)}
                          onChange={(e) => {
                            if (e.target.checked) addAnswer(q.id, t.name)
                            else removeAnswer(q.id, t.name)
                          }}
                          className="accent-cb-blue"
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                )
              ) : (
                <input
                  type="text"
                  value={answers[0] || ''}
                  onChange={(e) => setExtraAnswers(prev => ({ ...prev, [q.id]: e.target.value ? [e.target.value] : [] }))}
                  placeholder="Juist antwoord..."
                  className="w-48 px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
