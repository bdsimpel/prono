'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PlayerCombobox from '@/components/PlayerCombobox'
import TeamLogo from '@/components/TeamLogo'
import type { Team, FootballPlayer, PaymentStatus, PaymentMethod, Subgroup, PlayerSubgroup } from '@/lib/types'

const PLAYER_QUESTIONS: Record<string, { filterGk: boolean; sortBy: 'goals' | 'assists' | 'clean_sheets'; statLabel: string }> = {
  topscorer_poi: { filterGk: false, sortBy: 'goals', statLabel: 'goals' },
  assistenkoning_poi: { filterGk: false, sortBy: 'assists', statLabel: 'assists' },
  meeste_clean_sheets_poi: { filterGk: true, sortBy: 'clean_sheets', statLabel: 'CS' },
}

const TEAM_QUESTIONS = ['bekerwinnaar', 'beste_ploeg_poi', 'meeste_goals_poi', 'minste_goals_tegen_poi', 'kampioen']
const SINGLE_ANSWER_QUESTIONS = ['kampioen', 'bekerwinnaar']
const BEKER_TEAMS = ['Anderlecht', 'Union']

const ADMIN_TABS = [
  { key: 'voorspellingen', label: 'Voorspellingen' },
  { key: 'betalingen', label: 'Betalingen' },
  { key: 'groepen', label: 'Groepen' },
] as const
type AdminTab = (typeof ADMIN_TABS)[number]['key']

interface PlayerPayment {
  id: string
  display_name: string
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  paid_at: string | null
}

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
  const [activeTab, setActiveTab] = useState<AdminTab>('voorspellingen')
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [results, setResults] = useState<Record<number, { home: string; away: string }>>({})
  const [sofascoreIds, setSofascoreIds] = useState<Record<number, string>>({})
  const [fixtureIds, setFixtureIds] = useState<Record<number, string>>({})
  const [extraQuestions, setExtraQuestions] = useState<{ id: number; question_key: string; question_label: string }[]>([])
  const [footballPlayers, setFootballPlayers] = useState<FootballPlayer[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [extraAnswers, setExtraAnswers] = useState<Record<number, string[]>>({})
  const [players, setPlayers] = useState<PlayerPayment[]>([])
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Subgroup state
  const [subgroups, setSubgroups] = useState<Subgroup[]>([])
  const [playerSubgroups, setPlayerSubgroups] = useState<PlayerSubgroup[]>([])
  const [newSubgroupName, setNewSubgroupName] = useState('')
  const [subgroupSearch, setSubgroupSearch] = useState('')

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

    const [matchesRes, resultsRes, questionsRes, answersRes, playersRes, teamsRes, allPlayersRes, subgroupsRes, playerSubgroupsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .order('match_datetime', { ascending: true }),
      supabase.from('results').select('*'),
      supabase.from('extra_questions').select('id, question_key, question_label').order('id'),
      supabase.from('extra_question_answers').select('*'),
      supabase.from('football_players').select('*'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('players').select('id, display_name, payment_status, payment_method, paid_at').order('display_name'),
      supabase.from('subgroups').select('*').order('name'),
      supabase.from('player_subgroups').select('player_id, subgroup_id'),
    ])

    setMatches((matchesRes.data || []) as unknown as MatchRow[])

    const resultMap: Record<number, { home: string; away: string }> = {}
    for (const r of resultsRes.data || []) {
      resultMap[r.match_id] = { home: String(r.home_score), away: String(r.away_score) }
    }
    setResults(resultMap)

    const sfIds: Record<number, string> = {}
    const fIds: Record<number, string> = {}
    for (const m of matchesRes.data || []) {
      if (m.sofascore_event_id) sfIds[m.id] = String(m.sofascore_event_id)
      if (m.api_football_fixture_id) fIds[m.id] = String(m.api_football_fixture_id)
    }
    setSofascoreIds(sfIds)
    setFixtureIds(fIds)

    setExtraQuestions(questionsRes.data || [])
    setFootballPlayers(playersRes.data || [])
    setTeams(teamsRes.data || [])

    const ansMap: Record<number, string[]> = {}
    for (const a of answersRes.data || []) {
      if (!ansMap[a.question_id]) ansMap[a.question_id] = []
      ansMap[a.question_id].push(a.correct_answer)
    }
    setExtraAnswers(ansMap)
    setPlayers((allPlayersRes.data || []) as PlayerPayment[])
    setSubgroups((subgroupsRes.data || []) as Subgroup[])
    setPlayerSubgroups((playerSubgroupsRes.data || []) as PlayerSubgroup[])
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
        body: JSON.stringify({ results, answers: extraAnswers, sofascoreIds, fixtureIds }),
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

  const togglePayment = async (playerId: string, currentStatus: PaymentStatus, markUnpaid = false) => {
    const newStatus = markUnpaid ? 'unpaid' : 'paid'
    try {
      const res = await fetch('/api/admin/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, status: newStatus, skipActivity: markUnpaid }),
      })
      if (res.ok) {
        setPlayers(prev => prev.map(p =>
          p.id === playerId
            ? { ...p, payment_status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null }
            : p
        ))
      } else {
        showMessage('Kon betaalstatus niet wijzigen', true)
      }
    } catch {
      showMessage('Kon betaalstatus niet wijzigen', true)
    }
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

  // Subgroup actions
  const createSubgroup = async () => {
    if (!newSubgroupName.trim()) return
    try {
      const res = await fetch('/api/admin/subgroups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubgroupName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubgroups(prev => [...prev, data.subgroup].sort((a, b) => a.name.localeCompare(b.name)))
        setNewSubgroupName('')
        showMessage(`Groep "${data.subgroup.name}" aangemaakt`)
      } else {
        showMessage(data.error || 'Kon groep niet aanmaken', true)
      }
    } catch {
      showMessage('Kon groep niet aanmaken', true)
    }
  }

  const deleteSubgroup = async (id: number, name: string) => {
    if (!confirm(`Groep "${name}" verwijderen?`)) return
    try {
      const res = await fetch('/api/admin/subgroups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subgroupId: id }),
      })
      if (res.ok) {
        setSubgroups(prev => prev.filter(g => g.id !== id))
        setPlayerSubgroups(prev => prev.filter(ps => ps.subgroup_id !== id))
        showMessage(`Groep "${name}" verwijderd`)
      } else {
        showMessage('Kon groep niet verwijderen', true)
      }
    } catch {
      showMessage('Kon groep niet verwijderen', true)
    }
  }

  const toggleMember = async (playerId: string, subgroupId: number) => {
    const isMember = playerSubgroups.some(ps => ps.player_id === playerId && ps.subgroup_id === subgroupId)
    const method = isMember ? 'DELETE' : 'POST'
    try {
      const res = await fetch('/api/admin/subgroups/members', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, subgroupId }),
      })
      if (res.ok) {
        if (isMember) {
          setPlayerSubgroups(prev => prev.filter(ps => !(ps.player_id === playerId && ps.subgroup_id === subgroupId)))
        } else {
          setPlayerSubgroups(prev => [...prev, { player_id: playerId, subgroup_id: subgroupId }])
        }
      } else {
        showMessage('Kon lid niet bijwerken', true)
      }
    } catch {
      showMessage('Kon lid niet bijwerken', true)
    }
  }

  if (!loaded) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-cb-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!isAdmin) return null

  const grouped: Record<string, MatchRow[]> = {}
  for (const m of matches) {
    const key = m.is_cup_final ? 'Bekerfinale' : `Speeldag ${m.speeldag}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }

  const paidCount = players.filter(p => p.payment_status === 'paid').length
  const totalCount = players.length
  const filteredPaymentPlayers = paymentFilter === 'all'
    ? players
    : players.filter(p => p.payment_status === paymentFilter)

  const filteredSubgroupPlayers = subgroupSearch
    ? players.filter(p => p.display_name.toLowerCase().includes(subgroupSearch.toLowerCase()))
    : players

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-6">
        <h1 className="heading-display text-3xl md:text-4xl text-white">ADMIN</h1>
        <p className="text-gray-500 text-sm mt-1">Beheer uitslagen, antwoorden, betalingen en groepen.</p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${
          message.startsWith('Fout:') ? 'bg-red-900/20 text-red-400 border border-red-900/30' : 'bg-green-900/20 text-green-400 border border-green-900/30'
        }`}>
          {message}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-2.5 px-5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-cb-blue text-white'
                : 'text-gray-400 border border-white/[0.1] hover:text-white hover:border-white/[0.2]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Voorspellingen Tab ── */}
      {activeTab === 'voorspellingen' && (
        <>
          <button
            onClick={saveAll}
            disabled={saving}
            className="btn-primary py-3 px-8 mb-8 w-full md:w-auto disabled:opacity-40"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Opslaan & herberekenen...
              </span>
            ) : 'Alles opslaan & herberekenen'}
          </button>
          <button
            onClick={async () => {
              setSyncing(true)
              try {
                const res = await fetch('/api/admin/recalculate-stats', { method: 'POST' })
                if (res.ok) showMessage('Playoff stats herberekend!')
                else showMessage('Kon stats niet herberekenen', true)
              } catch { showMessage('Kon stats niet herberekenen', true) }
              setSyncing(false)
            }}
            disabled={syncing}
            className="btn-secondary py-3 px-8 mb-8 w-full md:w-auto ml-0 md:ml-3 disabled:opacity-40"
          >
            {syncing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Syncing...
              </span>
            ) : 'Herbereken playoff stats'}
          </button>

          {/* Match results */}
          <h2 className="heading-display text-xl text-gray-400 mb-3">UITSLAGEN INVOEREN</h2>
          <div className="space-y-8 mb-12">
            {Object.entries(grouped).sort(([a], [b]) => a === 'Bekerfinale' ? 1 : b === 'Bekerfinale' ? -1 : 0).map(([label, groupMatches]) => (
              <div key={label}>
                <h3 className="heading-display text-sm text-gray-500 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-cb-blue rounded-full" />
                  {label}
                </h3>
                <div className="space-y-2">
                  {groupMatches.map((match) => {
                    const r = results[match.id] || { home: '', away: '' }
                    return (
                      <div key={match.id} className="glass-card-subtle p-3">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <span className="flex-1 text-right text-xs md:text-sm truncate flex items-center justify-end gap-1 md:gap-1.5 text-gray-300 min-w-0">
                            <span className="truncate">{match.home_team.name}</span>
                            <span className="shrink-0"><TeamLogo name={match.home_team.name} /></span>
                          </span>
                          <input
                            ref={el => { inputRefs.current[`admin-${match.id}-home`] = el }}
                            type="text"
                            inputMode="numeric"
                            value={r.home}
                            onChange={(e) => handleScoreInput(match.id, 'home', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-9 h-9 md:w-10 md:h-10 text-center bg-cb-dark border border-white/[0.06] rounded-lg text-white font-bold text-sm focus:outline-none focus:border-cb-blue transition-colors shrink-0"
                          />
                          <span className="text-gray-600 text-xs shrink-0">-</span>
                          <input
                            ref={el => { inputRefs.current[`admin-${match.id}-away`] = el }}
                            type="text"
                            inputMode="numeric"
                            value={r.away}
                            onChange={(e) => handleScoreInput(match.id, 'away', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-9 h-9 md:w-10 md:h-10 text-center bg-cb-dark border border-white/[0.06] rounded-lg text-white font-bold text-sm focus:outline-none focus:border-cb-blue transition-colors shrink-0"
                          />
                          <span className="flex-1 text-left text-xs md:text-sm truncate flex items-center gap-1 md:gap-1.5 text-gray-300 min-w-0">
                            <span className="shrink-0"><TeamLogo name={match.away_team.name} /></span>
                            <span className="truncate">{match.away_team.name}</span>
                          </span>
                          {/* Desktop: Fixture ID inline */}
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Fixture ID"
                            value={fixtureIds[match.id] || ''}
                            onChange={(e) => setFixtureIds(prev => ({ ...prev, [match.id]: e.target.value.replace(/\D/g, '') }))}
                            className="hidden md:block w-28 h-9 text-center bg-cb-dark border border-white/[0.06] rounded-lg text-gray-500 text-[10px] focus:outline-none focus:border-cb-blue transition-colors shrink-0 placeholder:text-gray-700"
                          />
                        </div>
                        {/* Mobile: Fixture ID below, right-aligned */}
                        <div className="md:hidden mt-1.5 flex justify-end">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Fixture ID"
                            value={fixtureIds[match.id] || ''}
                            onChange={(e) => setFixtureIds(prev => ({ ...prev, [match.id]: e.target.value.replace(/\D/g, '') }))}
                            className="w-24 h-6 text-center bg-cb-dark border border-white/[0.06] rounded text-gray-600 text-[9px] focus:outline-none focus:border-cb-blue transition-colors placeholder:text-gray-700"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Extra answers */}
          <h2 className="heading-display text-xl text-gray-400 mb-3">EXTRA VRAGEN</h2>
          <div className="space-y-3 mb-12">
            {extraQuestions.map((q) => {
              const playerConfig = PLAYER_QUESTIONS[q.question_key]
              const isTeamQuestion = TEAM_QUESTIONS.includes(q.question_key)
              const isSingle = SINGLE_ANSWER_QUESTIONS.includes(q.question_key)
              const answers = extraAnswers[q.id] || []
              const teamOptions = q.question_key === 'bekerwinnaar'
                ? teams.filter(t => BEKER_TEAMS.includes(t.name))
                : teams

              return (
                <div key={q.id} className="glass-card-subtle p-4 space-y-3">
                  <span className="text-sm text-gray-300">{q.question_label}</span>

                  {!isSingle && answers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {answers.map(a => (
                        <span key={a} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cb-blue/15 text-white text-xs rounded-lg border border-cb-blue/20">
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

                  {playerConfig ? (
                    isSingle ? (
                      <div className="w-full md:w-72">
                        <PlayerCombobox
                          options={playerOptionsBySort[playerConfig.sortBy]}
                          value={answers[0] || ''}
                          onChange={(val) => setExtraAnswers(prev => ({ ...prev, [q.id]: val ? [val] : [] }))}
                          placeholder="Zoek een speler..."
                          statLabel={playerConfig.statLabel}
                        />
                      </div>
                    ) : (
                      <div className="w-full md:w-72">
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
                        className="w-full md:w-56 px-4 py-2.5 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors"
                      >
                        <option value="">Kies een ploeg...</option>
                        {teamOptions.map((t) => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {teamOptions.map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
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
                      className="w-56 px-4 py-2.5 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Betalingen Tab ── */}
      {activeTab === 'betalingen' && (
        <>
          {/* Stats row */}
          <div className="flex items-center justify-center gap-4 md:gap-10 mb-6 px-2">
            <div className="text-center">
              <div className="heading-display text-2xl md:text-3xl text-cb-blue font-bold">
                {paidCount}/{totalCount}
              </div>
              <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
                Betaald
              </div>
            </div>
            <div className="stat-divider" />
            <div className="text-center">
              <div className="heading-display text-2xl md:text-3xl text-white font-bold">
                &euro;{(paidCount * 2).toFixed(0)}
              </div>
              <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
                Ontvangen
              </div>
            </div>
            <div className="stat-divider" />
            <div className="text-center">
              <div className="heading-display text-2xl md:text-3xl text-white font-bold">
                &euro;{(totalCount * 2).toFixed(0)}
              </div>
              <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
                Totaal
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mb-4">
            {([['all', 'Alle'], ['unpaid', 'Niet betaald'], ['pending', 'In afwachting'], ['paid', 'Betaald']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setPaymentFilter(value)}
                className={`px-4 py-1.5 text-xs rounded-lg border transition-colors ${
                  paymentFilter === value
                    ? 'bg-cb-blue text-white border-cb-blue'
                    : 'bg-transparent text-gray-400 border-white/[0.06] hover:border-gray-600'
                }`}
              >
                {label}
                <span className="ml-1.5 opacity-60">
                  {value === 'all'
                    ? players.length
                    : players.filter(p => p.payment_status === value).length}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2 mb-8">
            {filteredPaymentPlayers.map(player => (
              <div key={player.id} className="glass-card-subtle p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">{player.display_name}</span>
                  {player.payment_method && (
                    <span className="text-xs text-gray-500">
                      {player.payment_method === 'wero' ? 'Payconiq' : player.payment_method === 'transfer' ? 'Overschrijving' : 'Cash'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {player.payment_status !== 'unpaid' && (
                    <button
                      onClick={() => togglePayment(player.id, player.payment_status, true)}
                      className="px-3 py-1.5 text-xs rounded-lg transition-colors font-medium bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] border border-white/[0.06]"
                    >
                      Niet betaald
                    </button>
                  )}
                  {player.payment_status !== 'paid' && (
                    <button
                      onClick={() => togglePayment(player.id, player.payment_status)}
                      className="px-3 py-1.5 text-xs rounded-lg transition-colors font-medium bg-cb-blue/15 text-cb-blue hover:bg-cb-blue/25 border border-cb-blue/20"
                    >
                      Betaald
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredPaymentPlayers.length === 0 && (
              <div className="glass-card-subtle p-12 text-center text-gray-600 text-sm">
                Geen spelers gevonden
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Groepen Tab ── */}
      {activeTab === 'groepen' && (
        <>
          {/* Manage subgroups */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {subgroups.map((g) => {
              const memberCount = playerSubgroups.filter(ps => ps.subgroup_id === g.id).length
              return (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white border border-white/[0.1]"
                >
                  {g.name}
                  <span className="text-xs text-gray-400">{memberCount}</span>
                  <span
                    onClick={() => deleteSubgroup(g.id, g.name)}
                    className="ml-0.5 text-gray-500 hover:text-white cursor-pointer"
                  >
                    &times;
                  </span>
                </span>
              )
            })}
            <div className="inline-flex gap-1.5">
              <input
                type="text"
                value={newSubgroupName}
                onChange={(e) => setNewSubgroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSubgroup()}
                placeholder="Nieuwe groep..."
                className="w-36 px-3 py-1.5 bg-cb-dark border border-white/[0.06] rounded-full text-white text-sm focus:outline-none focus:border-cb-blue transition-colors placeholder:text-gray-600"
              />
              <button
                onClick={createSubgroup}
                disabled={!newSubgroupName.trim()}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-cb-blue text-white disabled:opacity-40 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Player search */}
          <div className="mb-4">
            <input
              type="text"
              value={subgroupSearch}
              onChange={(e) => setSubgroupSearch(e.target.value)}
              placeholder="Zoek speler..."
              className="w-full max-w-xs px-4 py-2.5 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors placeholder:text-gray-600"
            />
          </div>

          {/* Player list with group toggles */}
          <div className="space-y-1.5">
            {filteredSubgroupPlayers.map((p) => {
              const playerGroups = playerSubgroups.filter(ps => ps.player_id === p.id)
              return (
                <div key={p.id} className="glass-card-subtle p-3 flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-200 w-44 md:w-56 truncate shrink-0">
                    {p.display_name}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {subgroups.map((g) => {
                      const isMember = playerGroups.some(ps => ps.subgroup_id === g.id)
                      return (
                        <button
                          key={g.id}
                          onClick={() => toggleMember(p.id, g.id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 border ${
                            isMember
                              ? 'bg-cb-blue text-white border-cb-blue'
                              : 'text-gray-500 border-white/[0.06] hover:border-white/[0.15]'
                          }`}
                        >
                          {g.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
