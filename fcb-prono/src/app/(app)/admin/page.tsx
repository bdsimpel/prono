'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Team } from '@/lib/types'

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
  const [extraQuestions, setExtraQuestions] = useState<{ id: number; question_label: string }[]>([])
  const [extraAnswers, setExtraAnswers] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [savingExtra, setSavingExtra] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

    const [matchesRes, resultsRes, questionsRes, answersRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .order('speeldag', { ascending: true })
        .order('match_datetime', { ascending: true }),
      supabase.from('results').select('*'),
      supabase.from('extra_questions').select('id, question_label').order('id'),
      supabase.from('extra_question_answers').select('*'),
    ])

    setMatches((matchesRes.data || []) as unknown as MatchRow[])

    const resultMap: Record<number, { home: string; away: string }> = {}
    for (const r of resultsRes.data || []) {
      resultMap[r.match_id] = { home: String(r.home_score), away: String(r.away_score) }
    }
    setResults(resultMap)

    setExtraQuestions(questionsRes.data || [])
    const ansMap: Record<number, string> = {}
    for (const a of answersRes.data || []) {
      ansMap[a.question_id] = a.correct_answer
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

  const updateScores = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/save-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage(`${data.resultsSaved} uitslagen opgeslagen, ${data.playersUpdated} spelers herberekend!`)
        await loadData()
      } else {
        showMessage(data.error || 'Onbekende fout', true)
      }
    } catch (err) {
      showMessage(`${err}`, true)
    }
    setSaving(false)
  }

  const saveExtraAnswers = async () => {
    setSavingExtra(true)
    try {
      const res = await fetch('/api/admin/save-extra-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: extraAnswers }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage(`Extra antwoorden opgeslagen, ${data.playersUpdated} spelers herberekend!`)
        await loadData()
      } else {
        showMessage(data.error || 'Onbekende fout', true)
      }
    } catch (err) {
      showMessage(`${err}`, true)
    }
    setSavingExtra(false)
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
        onClick={updateScores}
        disabled={saving}
        className="px-6 py-2.5 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 disabled:opacity-50 mb-6"
      >
        {saving ? 'Opslaan & herberekenen...' : 'Update scores'}
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
        {extraQuestions.map((q) => (
          <div key={q.id} className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
            <span className="text-sm text-gray-400 flex-1">{q.question_label}</span>
            <input
              type="text"
              value={extraAnswers[q.id] || ''}
              onChange={(e) => setExtraAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Juist antwoord..."
              className="w-48 px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
            />
          </div>
        ))}
      </div>
      <button
        onClick={saveExtraAnswers}
        disabled={savingExtra}
        className="px-6 py-2.5 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 disabled:opacity-50"
      >
        {savingExtra ? 'Opslaan & herberekenen...' : 'Extra antwoorden opslaan'}
      </button>
    </div>
  )
}
