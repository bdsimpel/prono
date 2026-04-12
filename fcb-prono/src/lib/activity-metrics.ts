import { SupabaseClient } from '@supabase/supabase-js'
import { calculateMatchPoints } from './scoring'

interface MetricEvent {
  type: 'rare_exact' | 'speeldag_top' | 'standings_top3' | 'standings_leader'
  message: string
  metadata: Record<string, unknown>
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(', ') + ' en ' + names[names.length - 1]
}

export async function generateMetricEvents({
  savedMatchIds,
  serviceClient,
  pointDeltas,
}: {
  savedMatchIds: number[]
  serviceClient: SupabaseClient
  pointDeltas: { user_id: string; delta: number }[]
}): Promise<MetricEvent[]> {
  if (savedMatchIds.length === 0) return []

  const [{ data: matches }, { data: teams }, { data: results }, { data: players }] =
    await Promise.all([
      serviceClient
        .from('matches')
        .select('id, speeldag, home_team_id, away_team_id')
        .in('id', savedMatchIds),
      serviceClient.from('teams').select('id, name'),
      serviceClient
        .from('results')
        .select('match_id, home_score, away_score')
        .in('match_id', savedMatchIds),
      serviceClient.from('players').select('id, display_name'),
    ])

  const teamMap: Record<number, string> = {}
  for (const t of teams || []) teamMap[t.id] = t.name

  const nameMap: Record<string, string> = {}
  for (const p of players || []) nameMap[p.id] = p.display_name

  const resultMap: Record<number, { home_score: number; away_score: number }> = {}
  for (const r of results || []) resultMap[r.match_id] = r

  const events: MetricEvent[] = []

  // Determine speeldag from matches
  const speeldag = (matches || [])[0]?.speeldag

  // --- Rare exact predictions (per match) ---
  for (const match of matches || []) {
    const result = resultMap[match.id]
    if (!result) continue

    const { data: predictions } = await serviceClient
      .from('predictions')
      .select('user_id, home_score, away_score')
      .eq('match_id', match.id)

    const exactPlayerIds: string[] = []
    for (const pred of predictions || []) {
      const calc = calculateMatchPoints(
        pred.home_score,
        pred.away_score,
        result.home_score,
        result.away_score,
      )
      if (calc.category === 'exact') {
        exactPlayerIds.push(pred.user_id)
      }
    }

    const home = teamMap[match.home_team_id] || '?'
    const away = teamMap[match.away_team_id] || '?'

    if (exactPlayerIds.length === 0) {
      events.push({
        type: 'rare_exact',
        message: `Niemand had ${home} - ${away} exact voorspeld!`,
        metadata: {
          match_id: match.id,
          speeldag: match.speeldag,
          player_ids: [],
        },
      })
    } else if (exactPlayerIds.length <= 5) {
      const names = exactPlayerIds.map((id) => nameMap[id] || 'Speler')
      const verb = exactPlayerIds.length === 1 ? 'had' : 'hadden'

      events.push({
        type: 'rare_exact',
        message: `Alleen ${joinNames(names)} ${verb} ${home} - ${away} exact voorspeld!`,
        metadata: {
          match_id: match.id,
          speeldag: match.speeldag,
          player_ids: exactPlayerIds,
        },
      })
    }
  }

  // --- Speeldag top scorer (only when all matches in the speeldag have results) ---
  if (pointDeltas.length > 0 && speeldag != null) {
    // Check if all matches in this speeldag have results
    const { count: totalInSpeeldag } = await serviceClient
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('speeldag', speeldag)

    const { count: resultsInSpeeldag } = await serviceClient
      .from('results')
      .select('match_id, matches!inner(speeldag)', { count: 'exact', head: true })
      .eq('matches.speeldag', speeldag)

    if (totalInSpeeldag != null && resultsInSpeeldag != null && resultsInSpeeldag >= totalInSpeeldag) {
      // Collect end-of-speeldag events, then push in display order
      let speeldagTopEvent: MetricEvent | null = null
      let top3Event: MetricEvent | null = null
      let leaderEvent: MetricEvent | null = null

      // Speeldag top scorer
      const maxDelta = Math.max(...pointDeltas.map((d) => d.delta))
      if (maxDelta > 0) {
        const topPlayers = pointDeltas.filter((d) => d.delta === maxDelta)
        const names = topPlayers.map((d) => nameMap[d.user_id] || 'Speler')
        const label = topPlayers.length === 1 ? 'Topscorer' : 'Topscorers'

        speeldagTopEvent = {
          type: 'speeldag_top',
          message: `${label} speeldag ${speeldag}: ${joinNames(names)} met ${maxDelta} ${maxDelta === 1 ? 'punt' : 'punten'}!`,
          metadata: {
            speeldag,
            player_ids: topPlayers.map((d) => d.user_id),
            points: maxDelta,
          },
        }
      }

      // Compute scores using only matches up to and including this speeldag
      const { data: matchesUpTo } = await serviceClient
        .from('matches')
        .select('id')
        .lte('speeldag', speeldag)

      const matchIdsUpTo = (matchesUpTo || []).map((m) => m.id)

      const [{ data: resultsUpTo }, { data: predsUpTo }] = await Promise.all([
        serviceClient
          .from('results')
          .select('match_id, home_score, away_score')
          .in('match_id', matchIdsUpTo),
        serviceClient
          .from('predictions')
          .select('user_id, match_id, home_score, away_score')
          .in('match_id', matchIdsUpTo),
      ])

      const resultUpToMap: Record<number, { home_score: number; away_score: number }> = {}
      for (const r of resultsUpTo || []) resultUpToMap[r.match_id] = r

      // Compute per-player total scores up to this speeldag
      const playerScoresUpTo: Record<string, number> = {}
      for (const pred of predsUpTo || []) {
        const res = resultUpToMap[pred.match_id]
        if (!res) continue
        const calc = calculateMatchPoints(
          pred.home_score,
          pred.away_score,
          res.home_score,
          res.away_score,
        )
        playerScoresUpTo[pred.user_id] = (playerScoresUpTo[pred.user_id] || 0) + calc.points
      }

      // Also add extra question scores
      const [{ data: extraQuestions }, { data: extraAnswers }, { data: extraPreds }] =
        await Promise.all([
          serviceClient.from('extra_questions').select('id, points'),
          serviceClient.from('extra_question_answers').select('question_id, correct_answer'),
          serviceClient.from('extra_predictions').select('user_id, question_id, answer'),
        ])

      const qPointsMap: Record<number, number> = {}
      for (const q of extraQuestions || []) qPointsMap[q.id] = q.points

      const correctMap: Record<number, string[]> = {}
      for (const a of extraAnswers || []) {
        if (!correctMap[a.question_id]) correctMap[a.question_id] = []
        correctMap[a.question_id].push(a.correct_answer)
      }

      for (const ep of extraPreds || []) {
        const correct = correctMap[ep.question_id] || []
        if (correct.length > 0) {
          const norm = ep.answer.replace(/\s/g, '').toLowerCase()
          if (correct.some((a) => a.replace(/\s/g, '').toLowerCase() === norm)) {
            playerScoresUpTo[ep.user_id] =
              (playerScoresUpTo[ep.user_id] || 0) + (qPointsMap[ep.question_id] || 10)
          }
        }
      }

      const standings = Object.entries(playerScoresUpTo)
        .map(([user_id, total]) => ({ user_id, total }))
        .sort((a, b) => b.total - a.total)

      // Current season top 3 (with proper tie handling)
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

        const byRank = new Map<number, typeof ranked>()
        for (const r of ranked) {
          if (!byRank.has(r.rank)) byRank.set(r.rank, [])
          byRank.get(r.rank)!.push(r)
        }

        const parts: string[] = []
        for (const [r, group] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
          const names = group.map((g) => nameMap[g.user_id] || 'Speler')
          parts.push(`${r}. ${joinNames(names)} (${group[0].total})`)
        }

        top3Event = {
          type: 'standings_top3',
          message: `Top 3 na speeldag ${speeldag}: ${parts.join(', ')}`,
          metadata: {
            speeldag,
            top3: ranked.map((r) => ({
              player_id: r.user_id,
              total_score: r.total,
              rank: r.rank,
            })),
          },
        }
      }

      // All-time leaderboard leader (all editions, augmented with current year)
      const { data: alltimeScores } = await serviceClient
        .from('alltime_scores')
        .select('player_name, avg_z_score, years_played')

      if (alltimeScores && alltimeScores.length > 0 && standings.length > 1) {
        const currentTotals = standings.map((s) => s.total)
        const mean = currentTotals.reduce((a, b) => a + b, 0) / currentTotals.length
        const stdev =
          Math.sqrt(
            currentTotals.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (currentTotals.length - 1),
          ) || 1

        const { data: playersWithHist } = await serviceClient
          .from('players')
          .select('id, display_name, matched_historical_name')

        const currentZMap = new Map<string, number>()
        for (const p of playersWithHist || []) {
          const score = standings.find((s) => s.user_id === p.id)
          if (!score) continue
          const histName = (p.matched_historical_name || p.display_name).toLowerCase()
          currentZMap.set(histName, (score.total - mean) / stdev)
        }

        // All alltime entries: augment if playing this year, keep as-is if not
        // Then apply years-played correction: 1 year ×1/3, 2 years ×2/3, 3+ unchanged
        const augmented = alltimeScores.map((at) => {
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
          const leaders = augmented.filter((a) => Math.abs(a.avgZ - bestZ) < 0.0001)
          const leaderNames = leaders.map((l) => l.name)
          const verb = leaders.length === 1 ? 'leidt' : 'leiden'

          leaderEvent = {
            type: 'standings_leader',
            message: `${joinNames(leaderNames)} ${verb} het all-time klassement!`,
            metadata: {
              speeldag,
              player_names: leaderNames,
            },
          }
        }
      }

      // Push in feed order (newest first): speeldag top, top 3, all-time leader
      // So insert in reverse: leader first, top 3, then speeldag top last
      if (leaderEvent) events.push(leaderEvent)
      if (top3Event) events.push(top3Event)
      if (speeldagTopEvent) events.push(speeldagTopEvent)
    }
  }

  // --- Idempotency: delete old metric events for this speeldag ---
  if (events.length > 0 && speeldag != null) {
    await serviceClient
      .from('activity_events')
      .delete()
      .in('type', ['rare_exact', 'speeldag_top', 'standings_top3', 'standings_leader'])
      .eq('metadata->>speeldag', String(speeldag))
  }

  return events
}
