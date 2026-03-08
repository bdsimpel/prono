'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ExtraQuestion, Team } from '@/lib/types'

const TEAM_QUESTIONS = ['bekerwinnaar', 'beste_ploeg_poi', 'meeste_goals_poi', 'minste_goals_tegen_poi', 'kampioen']

export default function ExtraPredictionsPage() {
  const supabase = createClient()
  const [questions, setQuestions] = useState<ExtraQuestion[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [locked, setLocked] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [questionsRes, teamsRes, predsRes, settingsRes] = await Promise.all([
      supabase.from('extra_questions').select('*').order('id'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('extra_predictions').select('*').eq('user_id', user.id),
      supabase.from('settings').select('*').eq('key', 'predictions_locked').single(),
    ])

    setQuestions(questionsRes.data || [])
    setTeams(teamsRes.data || [])

    const answerMap: Record<number, string> = {}
    for (const p of predsRes.data || []) {
      answerMap[p.question_id] = p.answer
    }
    setAnswers(answerMap)
    setLocked(settingsRes.data?.value === 'true')
    setLoaded(true)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    if (locked || !userId) return
    setSaving(true)

    for (const q of questions) {
      const answer = answers[q.id]
      if (answer && answer.trim()) {
        await supabase
          .from('extra_predictions')
          .upsert(
            { user_id: userId, question_id: q.id, answer: answer.trim() },
            { onConflict: 'user_id,question_id' }
          )
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!loaded) {
    return <div className="text-center py-12 text-gray-400">Laden...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">EXTRA VRAGEN</h1>

      {locked && (
        <div className="mb-6 px-4 py-2 rounded-lg text-sm bg-red-900/30 text-red-300">
          🔒 Pronostieken zijn vergrendeld
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q) => {
          const isTeamQuestion = TEAM_QUESTIONS.includes(q.question_key)
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
                  value={answers[q.id] || ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  disabled={locked}
                  className="w-full px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue disabled:opacity-50"
                >
                  <option value="">Kies een ploeg...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={answers[q.id] || ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  disabled={locked}
                  placeholder="Typ je antwoord..."
                  className="w-full px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue disabled:opacity-50"
                />
              )}
            </div>
          )
        })}
      </div>

      {!locked && (
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Opslaan...' : 'Bewaar'}
          </button>
          {saved && <span className="text-sm text-green-400">Opgeslagen!</span>}
        </div>
      )}
    </div>
  )
}
