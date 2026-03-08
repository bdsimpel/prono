'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Match, Team, Prediction } from '@/lib/types'

interface MatchWithTeams extends Match {
  home_team: Team
  away_team: Team
}

export default function PredictionsPage() {
  const supabase = createClient()
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [predictions, setPredictions] = useState<Record<number, { home: string; away: string }>>({})
  const [locked, setLocked] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [matchesRes, predsRes, settingsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .order('speeldag', { ascending: true })
        .order('match_datetime', { ascending: true }),
      supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('settings')
        .select('*'),
    ])

    setMatches(matchesRes.data || [])

    const predMap: Record<number, { home: string; away: string }> = {}
    for (const p of predsRes.data || []) {
      predMap[p.match_id] = { home: String(p.home_score), away: String(p.away_score) }
    }
    setPredictions(predMap)

    const settings = settingsRes.data || []
    const lockedSetting = settings.find(s => s.key === 'predictions_locked')
    const deadlineSetting = settings.find(s => s.key === 'deadline')
    setLocked(lockedSetting?.value === 'true')
    setDeadline(deadlineSetting?.value || '')
    setLoaded(true)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const savePrediction = async (matchId: number, home: string, away: string) => {
    if (locked || !userId) return
    if (home === '' || away === '') return

    const homeScore = parseInt(home)
    const awayScore = parseInt(away)
    if (isNaN(homeScore) || isNaN(awayScore)) return

    setSaving(prev => ({ ...prev, [matchId]: true }))

    await supabase
      .from('predictions')
      .upsert(
        { user_id: userId, match_id: matchId, home_score: homeScore, away_score: awayScore },
        { onConflict: 'user_id,match_id' }
      )

    setSaving(prev => ({ ...prev, [matchId]: false }))
  }

  const handleScoreChange = (matchId: number, side: 'home' | 'away', value: string) => {
    if (locked) return
    const current = predictions[matchId] || { home: '', away: '' }
    const updated = { ...current, [side]: value }
    setPredictions(prev => ({ ...prev, [matchId]: updated }))
  }

  const handleBlur = (matchId: number) => {
    const pred = predictions[matchId]
    if (pred) {
      savePrediction(matchId, pred.home, pred.away)
    }
  }

  // Group matches by speeldag
  const grouped = matches.reduce<Record<string, MatchWithTeams[]>>((acc, m) => {
    const key = m.is_cup_final ? 'Bekerfinale' : `Speeldag ${m.speeldag}`
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const filledCount = Object.values(predictions).filter(
    p => p.home !== '' && p.away !== ''
  ).length
  const totalCount = matches.length

  if (!loaded) {
    return <div className="text-center py-12 text-gray-400">Laden...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">JOUW PRONOSTIEK</h1>
        <span className="text-sm text-gray-400">{filledCount}/{totalCount} ingevuld</span>
      </div>

      {deadline && (
        <div className={`mb-6 px-4 py-2 rounded-lg text-sm ${locked ? 'bg-red-900/30 text-red-300' : 'bg-cb-blue/20 text-cb-gold'}`}>
          {locked ? (
            <>🔒 Pronostieken zijn vergrendeld</>
          ) : (
            <>⏰ Deadline: {new Date(deadline).toLocaleString('nl-BE', { dateStyle: 'long', timeStyle: 'short' })}</>
          )}
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(grouped).map(([label, groupMatches]) => (
          <div key={label}>
            <h2 className="text-sm font-semibold text-cb-gold uppercase tracking-wide mb-3">
              {label}
            </h2>
            <div className="space-y-2">
              {groupMatches.map((match) => {
                const pred = predictions[match.id] || { home: '', away: '' }
                const isSaving = saving[match.id]
                return (
                  <div
                    key={match.id}
                    className="bg-card rounded-lg border border-border p-3 flex items-center gap-2"
                  >
                    <span className="flex-1 text-right text-sm font-medium truncate">
                      {match.home_team.name}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={pred.home}
                      onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                      onBlur={() => handleBlur(match.id)}
                      disabled={locked}
                      className="w-10 h-10 text-center bg-cb-dark border border-border rounded-lg text-white font-bold disabled:opacity-50 focus:outline-none focus:border-cb-blue"
                    />
                    <span className="text-gray-500 text-xs">-</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={pred.away}
                      onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                      onBlur={() => handleBlur(match.id)}
                      disabled={locked}
                      className="w-10 h-10 text-center bg-cb-dark border border-border rounded-lg text-white font-bold disabled:opacity-50 focus:outline-none focus:border-cb-blue"
                    />
                    <span className="flex-1 text-left text-sm font-medium truncate">
                      {match.away_team.name}
                    </span>
                    {isSaving && (
                      <span className="text-xs text-cb-gold">...</span>
                    )}
                    {!isSaving && pred.home !== '' && pred.away !== '' && (
                      <span className="text-xs text-green-400">✓</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href="/predictions/extra"
          className="inline-flex items-center gap-2 px-4 py-2 bg-cb-blue text-white rounded-lg hover:bg-cb-blue/90 transition-colors text-sm font-medium"
        >
          Extra vragen invullen →
        </Link>
      </div>
    </div>
  )
}
