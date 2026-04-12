import { createClient } from '@supabase/supabase-js'
import { calculateMatchPoints } from '../src/lib/scoring'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(', ') + ' en ' + names[names.length - 1]
}

interface BackfillEvent {
  type: 'rare_exact' | 'speeldag_top' | 'standings_top3' | 'standings_leader' | 'no_zero' | 'streak'
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

async function main() {
  const events: BackfillEvent[] = []

  // Load all data
  const [{ data: results }, { data: matches }, { data: teams }, { data: players }] =
    await Promise.all([
      supabase.from('results').select('match_id, home_score, away_score, entered_at'),
      supabase.from('matches').select('id, speeldag, home_team_id, away_team_id'),
      supabase.from('teams').select('id, name'),
      supabase.from('players').select('id, display_name, matched_historical_name'),
    ])

  // Load all predictions (may be > 1000 rows)
  let allPredictions: { user_id: string; match_id: number; home_score: number; away_score: number }[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data } = await supabase
      .from('predictions')
      .select('user_id, match_id, home_score, away_score')
      .range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    allPredictions = allPredictions.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  const teamMap: Record<number, string> = {}
  for (const t of teams || []) teamMap[t.id] = t.name

  const nameMap: Record<string, string> = {}
  for (const p of players || []) nameMap[p.id] = p.display_name

  const matchMap: Record<number, (typeof matches extends (infer T)[] | null ? T : never)> = {}
  for (const m of matches || []) matchMap[m.id] = m

  const resultMap: Record<number, { home_score: number; away_score: number; entered_at: string }> = {}
  for (const r of results || []) resultMap[r.match_id] = r

  // Group predictions by match_id
  const predsByMatch = new Map<number, typeof allPredictions>()
  for (const p of allPredictions) {
    if (!predsByMatch.has(p.match_id)) predsByMatch.set(p.match_id, [])
    predsByMatch.get(p.match_id)!.push(p)
  }

  // --- Rare exact predictions (per match) ---
  for (const r of results || []) {
    const match = matchMap[r.match_id]
    if (!match) continue

    const preds = predsByMatch.get(r.match_id) || []
    const exactPlayerIds: string[] = []

    for (const pred of preds) {
      const calc = calculateMatchPoints(
        pred.home_score,
        pred.away_score,
        r.home_score,
        r.away_score,
      )
      if (calc.category === 'exact') {
        exactPlayerIds.push(pred.user_id)
      }
    }

    const home = teamMap[match.home_team_id] || '?'
    const away = teamMap[match.away_team_id] || '?'
    const ts = new Date(new Date(r.entered_at).getTime() + 1000).toISOString()

    if (exactPlayerIds.length === 0) {
      events.push({
        type: 'rare_exact',
        message: `Niemand had ${home} - ${away} exact voorspeld!`,
        metadata: {
          match_id: r.match_id,
          speeldag: match.speeldag,
          player_ids: [],
        },
        created_at: ts,
      })
    } else if (exactPlayerIds.length <= 5) {
      const names = exactPlayerIds.map((id) => nameMap[id] || 'Speler')
      const verb = exactPlayerIds.length === 1 ? 'had' : 'hadden'

      events.push({
        type: 'rare_exact',
        message: `Alleen ${joinNames(names)} ${verb} ${home} - ${away} exact voorspeld!`,
        metadata: {
          match_id: r.match_id,
          speeldag: match.speeldag,
          player_ids: exactPlayerIds,
        },
        created_at: ts,
      })
    }
  }
  console.log(`Rare exact events: ${events.filter(e => e.type === 'rare_exact').length}`)

  // --- Speeldag top scorers (only for completed speeldagen) ---
  // Group ALL matches by speeldag (not just those with results)
  const allSpeeldagMatches = new Map<number, number[]>()
  for (const m of matches || []) {
    if (!allSpeeldagMatches.has(m.speeldag)) allSpeeldagMatches.set(m.speeldag, [])
    allSpeeldagMatches.get(m.speeldag)!.push(m.id)
  }

  // Only process speeldagen where ALL matches have results
  const speeldagMatches = new Map<number, number[]>()
  for (const [speeldag, matchIds] of allSpeeldagMatches) {
    const allHaveResults = matchIds.every((id) => resultMap[id])
    if (allHaveResults) {
      speeldagMatches.set(speeldag, matchIds)
    }
  }

  for (const [speeldag, matchIds] of speeldagMatches) {
    // Compute each player's points on this speeldag
    const playerPoints: Record<string, number> = {}

    for (const matchId of matchIds) {
      const result = resultMap[matchId]
      if (!result) continue
      const preds = predsByMatch.get(matchId) || []

      for (const pred of preds) {
        const calc = calculateMatchPoints(
          pred.home_score,
          pred.away_score,
          result.home_score,
          result.away_score,
        )
        if (!playerPoints[pred.user_id]) playerPoints[pred.user_id] = 0
        playerPoints[pred.user_id] += calc.points
      }
    }

    const entries = Object.entries(playerPoints)
    if (entries.length === 0) continue

    const maxPoints = Math.max(...entries.map(([, pts]) => pts))
    if (maxPoints <= 0) continue

    const topPlayers = entries.filter(([, pts]) => pts === maxPoints)
    const names = topPlayers.map(([id]) => nameMap[id] || 'Speler')
    const label = topPlayers.length === 1 ? 'Topscorer' : 'Topscorers'

    // Timestamp: offset after the latest result entered_at for this speeldag
    const latestEnteredAt = Math.max(
      ...matchIds.map((id) => new Date(resultMap[id].entered_at).getTime()),
    )
    const ts = new Date(latestEnteredAt + 4000).toISOString()

    events.push({
      type: 'speeldag_top',
      message: `${label} speeldag ${speeldag}: ${joinNames(names)} met ${maxPoints} ${maxPoints === 1 ? 'punt' : 'punten'}!`,
      metadata: {
        speeldag,
        player_ids: topPlayers.map(([id]) => id),
        points: maxPoints,
      },
      created_at: ts,
    })
  }
  console.log(`Speeldag top events: ${events.filter(e => e.type === 'speeldag_top').length}`)

  // --- Standings: top 3 and all-time leader after each completed speeldag ---
  const sortedSpeeldagen = [...speeldagMatches.keys()].sort((a, b) => a - b)

  // Load extra question data for cumulative score computation
  const { data: extraQuestions } = await supabase.from('extra_questions').select('id, points')
  const { data: extraAnswers } = await supabase.from('extra_question_answers').select('question_id, correct_answer')

  let allExtraPredictions: { user_id: string; question_id: number; answer: string }[] = []
  let epFrom = 0
  while (true) {
    const { data } = await supabase
      .from('extra_predictions')
      .select('user_id, question_id, answer')
      .range(epFrom, epFrom + PAGE - 1)
    if (!data || data.length === 0) break
    allExtraPredictions = allExtraPredictions.concat(data)
    if (data.length < PAGE) break
    epFrom += PAGE
  }

  const questionPointsMap: Record<number, number> = {}
  for (const q of extraQuestions || []) questionPointsMap[q.id] = q.points

  const correctAnswersMap: Record<number, string[]> = {}
  for (const a of extraAnswers || []) {
    if (!correctAnswersMap[a.question_id]) correctAnswersMap[a.question_id] = []
    correctAnswersMap[a.question_id].push(a.correct_answer)
  }

  const extraScoreByPlayer: Record<string, number> = {}
  for (const ep of allExtraPredictions) {
    const correct = correctAnswersMap[ep.question_id] || []
    if (correct.length > 0) {
      const normalized = ep.answer.replace(/\s/g, '').toLowerCase()
      const isCorrect = correct.some(a => a.replace(/\s/g, '').toLowerCase() === normalized)
      if (isCorrect) {
        if (!extraScoreByPlayer[ep.user_id]) extraScoreByPlayer[ep.user_id] = 0
        extraScoreByPlayer[ep.user_id] += questionPointsMap[ep.question_id] || 10
      }
    }
  }

  // Load all-time scores for leader computation
  const { data: alltimeScores } = await supabase
    .from('alltime_scores')
    .select('player_name, avg_z_score, years_played')

  // Accumulate match scores per speeldag
  const cumulativeMatchScore: Record<string, number> = {}

  for (const speeldag of sortedSpeeldagen) {
    const matchIds = speeldagMatches.get(speeldag)!

    for (const matchId of matchIds) {
      const result = resultMap[matchId]
      if (!result) continue
      const preds = predsByMatch.get(matchId) || []
      for (const pred of preds) {
        const calc = calculateMatchPoints(
          pred.home_score, pred.away_score,
          result.home_score, result.away_score,
        )
        if (!cumulativeMatchScore[pred.user_id]) cumulativeMatchScore[pred.user_id] = 0
        cumulativeMatchScore[pred.user_id] += calc.points
      }
    }

    // Compute total scores (match + extra)
    const standings: { user_id: string; total: number }[] = []
    const allPlayerIds = new Set([
      ...Object.keys(cumulativeMatchScore),
      ...Object.keys(extraScoreByPlayer),
    ])
    for (const uid of allPlayerIds) {
      standings.push({
        user_id: uid,
        total: (cumulativeMatchScore[uid] || 0) + (extraScoreByPlayer[uid] || 0),
      })
    }
    standings.sort((a, b) => b.total - a.total)

    const latestEnteredAt = Math.max(
      ...matchIds.map((id) => new Date(resultMap[id].entered_at).getTime()),
    )

    // Top 3 event (with proper tie handling)
    if (standings.length >= 3) {
      const ranked: { user_id: string; total: number; rank: number }[] = []
      let rank = 0
      let prevScore = -1
      for (let i = 0; i < standings.length; i++) {
        if (standings[i].total !== prevScore) {
          rank = i + 1
        }
        prevScore = standings[i].total
        if (rank > 3) break
        ranked.push({ ...standings[i], rank })
      }

      // Group by rank
      const byRank = new Map<number, typeof ranked>()
      for (const r of ranked) {
        if (!byRank.has(r.rank)) byRank.set(r.rank, [])
        byRank.get(r.rank)!.push(r)
      }

      const parts: string[] = []
      for (const [r, group] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
        const names = group.map(g => nameMap[g.user_id] || 'Speler')
        parts.push(`${r}. ${joinNames(names)} (${group[0].total})`)
      }

      events.push({
        type: 'standings_top3',
        message: `Top 3 na speeldag ${speeldag}: ${parts.join(', ')}`,
        metadata: {
          speeldag,
          top3: ranked.map(r => ({ player_id: r.user_id, total_score: r.total, rank: r.rank })),
        },
        created_at: new Date(latestEnteredAt + 3000).toISOString(),
      })
    }

    // All-time leader event (all editions, augmented with current year)
    if (alltimeScores && alltimeScores.length > 0 && standings.length > 1) {
      const currentTotals = standings.map(s => s.total)
      const mean = currentTotals.reduce((a, b) => a + b, 0) / currentTotals.length
      const stdev = Math.sqrt(
        currentTotals.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (currentTotals.length - 1),
      ) || 1

      // Build map: alltime player_name -> current z-score (if playing this year)
      const currentZMap = new Map<string, number>()
      for (const s of standings) {
        const player = (players || []).find(p => p.id === s.user_id)
        if (!player) continue
        const histName = ((player as { matched_historical_name?: string }).matched_historical_name || player.display_name).toLowerCase()
        currentZMap.set(histName, (s.total - mean) / stdev)
      }

      // All alltime entries: augment if playing this year, keep as-is if not
      // Then apply years-played correction: 1 year ×1/3, 2 years ×2/3, 3+ unchanged
      const augmented = alltimeScores.map(at => {
        const currentZ = currentZMap.get(at.player_name.toLowerCase())
        let years = at.years_played
        let avgZ = at.avg_z_score ?? -999
        if (currentZ != null) {
          years = at.years_played + 1
          avgZ = ((at.avg_z_score ?? 0) * at.years_played + currentZ) / years
        }
        const factor = years >= 3 ? 1 : years / 3
        return { name: at.player_name, avgZ: avgZ * factor }
      })

      augmented.sort((a, b) => b.avgZ - a.avgZ)

      if (augmented.length > 0) {
        const bestZ = augmented[0].avgZ
        const leaders = augmented.filter(a => Math.abs(a.avgZ - bestZ) < 0.0001)
        const leaderNames = leaders.map(l => l.name)
        const verb = leaders.length === 1 ? 'leidt' : 'leiden'

        events.push({
          type: 'standings_leader',
          message: `${joinNames(leaderNames)} ${verb} het all-time klassement!`,
          metadata: {
            speeldag,
            player_names: leaderNames,
          },
          created_at: new Date(latestEnteredAt + 2000).toISOString(),
        })
      }
    }
  }
  console.log(`Standings top 3 events: ${events.filter(e => e.type === 'standings_top3').length}`)
  console.log(`Standings leader events: ${events.filter(e => e.type === 'standings_leader').length}`)

  // --- No zero check: find the first match after which all players had >0 cumulative points ---
  // Process all completed matches chronologically, tracking cumulative scores
  const allMatchesSorted = (matches || [])
    .filter(m => resultMap[m.id])
    .sort((a, b) => {
      const tA = resultMap[a.id]?.entered_at ?? ''
      const tB = resultMap[b.id]?.entered_at ?? ''
      return tA.localeCompare(tB)
    })

  const allPlayerIdSet = new Set((players || []).map(p => p.id))
  const cumulativeScoreForZero: Record<string, number> = {}
  let noZeroFired = false

  for (const m of allMatchesSorted) {
    const r = resultMap[m.id]
    if (!r) continue
    const preds = predsByMatch.get(m.id) || []
    for (const pred of preds) {
      const calc = calculateMatchPoints(pred.home_score, pred.away_score, r.home_score, r.away_score)
      cumulativeScoreForZero[pred.user_id] = (cumulativeScoreForZero[pred.user_id] || 0) + calc.points
    }

    if (!noZeroFired) {
      const playersWithZero = [...allPlayerIdSet].filter(id => !cumulativeScoreForZero[id] || cumulativeScoreForZero[id] === 0)
      if (playersWithZero.length === 0) {
        noZeroFired = true
        events.push({
          type: 'no_zero',
          message: 'Iedereen heeft gescoord! Niemand staat nog op 0 punten.',
          metadata: { match_id: m.id, speeldag: m.speeldag },
          created_at: new Date(new Date(r.entered_at).getTime() + 1500).toISOString(),
        })
      }
    }
  }
  console.log(`No zero events: ${events.filter(e => e.type === 'no_zero').length}`)

  // --- Streak check: after each match, check for streaks of 5+ ---
  // Process matches chronologically, compute current streak per player
  const completedMatchIds: number[] = []

  for (const m of allMatchesSorted) {
    completedMatchIds.push(m.id)
    if (completedMatchIds.length < 5) continue

    const r = resultMap[m.id]
    if (!r) continue

    // Compute current streak for each player (from latest match backwards)
    const streakPlayers: { user_id: string; streak: number }[] = []
    for (const playerId of allPlayerIdSet) {
      let streak = 0
      for (let i = completedMatchIds.length - 1; i >= 0; i--) {
        const matchPreds = predsByMatch.get(completedMatchIds[i]) || []
        const pred = matchPreds.find(p => p.user_id === playerId)
        if (!pred) break
        const res = resultMap[completedMatchIds[i]]
        if (!res) break
        const calc = calculateMatchPoints(pred.home_score, pred.away_score, res.home_score, res.away_score)
        if (calc.points > 0) streak++
        else break
      }
      if (streak >= 5) streakPlayers.push({ user_id: playerId, streak })
    }

    if (streakPlayers.length > 0 && streakPlayers.length <= 5) {
      streakPlayers.sort((a, b) => b.streak - a.streak)
      const streakLines = streakPlayers.map(
        s => `${nameMap[s.user_id] || 'Speler'} (${s.streak})`,
      )

      events.push({
        type: 'streak',
        message: `Op een reeks! ${joinNames(streakLines)} ${streakPlayers.length === 1 ? 'match' : 'matches'} op rij gescoord!`,
        metadata: {
          match_id: m.id,
          speeldag: m.speeldag,
          streaks: streakPlayers.map(s => ({ player_id: s.user_id, streak: s.streak })),
        },
        created_at: new Date(new Date(r.entered_at).getTime() + 1500).toISOString(),
      })
    }
  }
  console.log(`Streak events: ${events.filter(e => e.type === 'streak').length}`)

  console.log(`\nTotal metric events to insert: ${events.length}`)

  if (events.length === 0) {
    console.log('No events to insert')
    return
  }

  // Delete existing metric events
  await supabase
    .from('activity_events')
    .delete()
    .in('type', ['rare_exact', 'speeldag_top', 'standings_top3', 'standings_leader', 'no_zero', 'streak'])
  console.log('Deleted existing metric events')

  // Insert in batches
  for (let i = 0; i < events.length; i += 50) {
    const batch = events.slice(i, i + 50)
    const { error } = await supabase.from('activity_events').insert(batch)
    if (error) {
      console.error(`Error inserting batch at ${i}:`, error)
      process.exit(1)
    }
  }

  console.log(`Inserted ${events.length} metric events`)
}

main().catch(console.error)
