import { SupabaseClient } from '@supabase/supabase-js'
import { calculateMatchPoints } from './scoring'
import { fetchAll } from './supabase/fetch-all'

interface MetricEvent {
  type: 'rare_exact' | 'speeldag_top' | 'standings_top3' | 'standings_leader' | 'no_zero' | 'streak'
  message: string
  metadata: Record<string, unknown>
  created_at?: string
}

interface Prediction {
  user_id: string
  match_id: number
  home_score: number
  away_score: number
}

interface ExtraPrediction {
  user_id: string
  question_id: number
  answer: string
}

interface ResultRow {
  match_id: number
  home_score: number
  away_score: number
  entered_at: string
}

// One-shot events are never overwritten once inserted.
const ONE_SHOT_TYPES: ReadonlySet<MetricEvent['type']> = new Set(['rare_exact', 'no_zero'])

// Mutable events represent current state and are overwritten with fresh content.
const MUTABLE_TYPES: ReadonlySet<MetricEvent['type']> = new Set([
  'speeldag_top',
  'standings_top3',
  'standings_leader',
  'streak',
])

const STREAK_MAX_NAMES = 5

function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(', ') + ' en ' + names[names.length - 1]
}

function buildStreakMessage(
  streakPlayers: { user_id: string; streak: number }[],
  nameMap: Record<string, string>,
): string {
  const shown = streakPlayers.slice(0, STREAK_MAX_NAMES)
  const extra = streakPlayers.length - shown.length
  const lines = shown.map((s) => `${nameMap[s.user_id] || 'Speler'} (${s.streak})`)
  const base = `Op een reeks! ${joinNames(lines)}`
  if (extra <= 0) return `${base} — meerdere matches op rij gescoord!`
  const suffix = extra === 1 ? ' en 1 andere' : ` en ${extra} anderen`
  return `${base}${suffix} — meerdere matches op rij gescoord!`
}

/**
 * Insert metric events into activity_events. Dedup is enforced at DB level via
 * the dedup_key generated column. One-shot events (rare_exact, no_zero) are
 * skipped on conflict; mutable events (speeldag_top, top3, leader, streak) are
 * overwritten with fresh content. Events may carry their own created_at (based
 * on the underlying result's entered_at) so historical regenerations don't
 * bubble old speeldagen to the top of the feed.
 *
 * If no `streak` event is present in the batch, any existing streak row is
 * deleted — this keeps the feed in sync when the last streak breaks.
 * `generateMetricEvents` always considers streaks globally, so the absence of
 * a streak event in its output means "nobody is on a streak right now".
 */
export async function insertMetricEvents(
  serviceClient: SupabaseClient,
  events: MetricEvent[],
): Promise<void> {
  const hasStreak = events.some((e) => e.type === 'streak')
  if (!hasStreak) {
    await serviceClient.from('activity_events').delete().eq('dedup_key', 'streak')
  }

  if (events.length === 0) return

  const base = Date.now()
  const withTimestamps = events.map((e, idx) => ({
    ...e,
    created_at: e.created_at ?? new Date(base + idx).toISOString(),
  }))

  const oneShot = withTimestamps.filter((e) => ONE_SHOT_TYPES.has(e.type))
  const mutable = withTimestamps.filter((e) => MUTABLE_TYPES.has(e.type))

  if (oneShot.length > 0) {
    await serviceClient
      .from('activity_events')
      .upsert(oneShot, { onConflict: 'dedup_key', ignoreDuplicates: true })
  }

  if (mutable.length > 0) {
    await serviceClient
      .from('activity_events')
      .upsert(mutable, { onConflict: 'dedup_key', ignoreDuplicates: false })
  }
}

export async function generateMetricEvents({
  savedMatchIds,
  serviceClient,
  pointDeltas,
}: {
  savedMatchIds: number[]
  serviceClient: SupabaseClient
  // Kept for signature compatibility but unused — all scoring is computed from
  // predictions + results so results are correct regardless of whether a recalc
  // produced deltas.
  pointDeltas: { user_id: string; delta: number }[]
}): Promise<MetricEvent[]> {
  void pointDeltas
  if (savedMatchIds.length === 0) return []

  // Bulk fetch once up front. predictions × extra_predictions each exceed the
  // 1000-row Supabase limit with ~150 players across 30+ matches/8 questions,
  // so we MUST use fetchAll. Previously a plain .in() here silently truncated
  // and produced wrong top-3 / topscorer rankings.
  const [
    { data: allMatches },
    { data: teams },
    { data: players },
    allResults,
    allPredictions,
    allExtraPredictions,
    { data: extraQuestions },
    { data: extraAnswers },
  ] = await Promise.all([
    serviceClient.from('matches').select('id, speeldag, home_team_id, away_team_id'),
    serviceClient.from('teams').select('id, name'),
    serviceClient.from('players').select('id, display_name'),
    fetchAll<ResultRow>(serviceClient, 'results', 'match_id, home_score, away_score, entered_at'),
    fetchAll<Prediction>(serviceClient, 'predictions', 'user_id, match_id, home_score, away_score'),
    fetchAll<ExtraPrediction>(serviceClient, 'extra_predictions', 'user_id, question_id, answer'),
    serviceClient.from('extra_questions').select('id, points'),
    serviceClient.from('extra_question_answers').select('question_id, correct_answer'),
  ])

  const teamMap: Record<number, string> = {}
  for (const t of teams || []) teamMap[t.id] = t.name

  const nameMap: Record<string, string> = {}
  for (const p of players || []) nameMap[p.id] = p.display_name

  const resultMap: Record<number, ResultRow> = {}
  for (const r of allResults) resultMap[r.match_id] = r

  const matchesById: Record<number, { id: number; speeldag: number | null; home_team_id: number; away_team_id: number }> = {}
  for (const m of allMatches || []) matchesById[m.id] = m

  const events: MetricEvent[] = []

  const uniqueSpeeldagen = [
    ...new Set(
      savedMatchIds
        .map((id) => matchesById[id]?.speeldag)
        .filter((s): s is number => typeof s === 'number'),
    ),
  ].sort((a, b) => a - b)

  for (const speeldag of uniqueSpeeldagen) {
    const speeldagSavedMatches = savedMatchIds
      .map((id) => matchesById[id])
      .filter((m): m is NonNullable<typeof m> => m != null && m.speeldag === speeldag)

    events.push(
      ...(await buildRareExactEvents(
        serviceClient,
        speeldagSavedMatches,
        resultMap,
        allPredictions,
        teamMap,
        nameMap,
      )),
    )
    events.push(
      ...buildSpeeldagCompleteEvents(
        speeldag,
        allMatches || [],
        resultMap,
        allPredictions,
        allExtraPredictions,
        extraQuestions || [],
        extraAnswers || [],
        nameMap,
        await fetchAlltimeScores(serviceClient),
        await fetchPlayersWithHist(serviceClient),
      ),
    )
  }

  events.push(...buildNoZeroEventFromScores(await fetchPlayerScores(serviceClient)))
  events.push(...buildStreakEvents(allMatches || [], resultMap, allPredictions, nameMap))

  return events
}

async function fetchAlltimeScores(client: SupabaseClient) {
  const { data } = await client.from('alltime_scores').select('player_name, avg_z_score, years_played')
  return data || []
}

async function fetchPlayersWithHist(client: SupabaseClient) {
  const { data } = await client.from('players').select('id, display_name, matched_historical_name')
  return data || []
}

async function fetchPlayerScores(client: SupabaseClient) {
  const { data } = await client.from('player_scores').select('user_id, total_score')
  return data || []
}

// ───────────────────────────────────────────────────────────────────────────
// rare_exact: per match, emit a "nobody/only X had this exact" event. Kept as a
// historical one-shot. created_at is anchored to the match's entered_at so
// regenerations don't bubble it to the top of the feed.
// ───────────────────────────────────────────────────────────────────────────

async function buildRareExactEvents(
  serviceClient: SupabaseClient,
  speeldagSavedMatches: { id: number; home_team_id: number; away_team_id: number; speeldag: number | null }[],
  resultMap: Record<number, ResultRow>,
  allPredictions: Prediction[],
  teamMap: Record<number, string>,
  nameMap: Record<string, string>,
): Promise<MetricEvent[]> {
  if (speeldagSavedMatches.length === 0) return []

  const matchIds = speeldagSavedMatches.map((m) => m.id)

  const { data: existingRareExact } = await serviceClient
    .from('activity_events')
    .select('metadata')
    .eq('type', 'rare_exact')
    .in('metadata->>match_id', matchIds.map(String))

  const alreadyEmitted = new Set(
    (existingRareExact || [])
      .map((e) => (e.metadata as { match_id?: number })?.match_id)
      .filter((id): id is number => typeof id === 'number'),
  )

  const matchesToProcess = speeldagSavedMatches.filter(
    (m) => resultMap[m.id] && !alreadyEmitted.has(m.id),
  )
  if (matchesToProcess.length === 0) return []

  const out: MetricEvent[] = []
  for (const match of matchesToProcess) {
    const result = resultMap[match.id]
    const predictions = allPredictions.filter((p) => p.match_id === match.id)

    const exactPlayerIds: string[] = []
    for (const pred of predictions) {
      const calc = calculateMatchPoints(
        pred.home_score,
        pred.away_score,
        result.home_score,
        result.away_score,
      )
      if (calc.category === 'exact') exactPlayerIds.push(pred.user_id)
    }

    const home = teamMap[match.home_team_id] || '?'
    const away = teamMap[match.away_team_id] || '?'
    const timestamp = result.entered_at

    if (exactPlayerIds.length === 0) {
      out.push({
        type: 'rare_exact',
        message: `Niemand had ${home} - ${away} exact voorspeld!`,
        metadata: { match_id: match.id, speeldag: match.speeldag, player_ids: [] },
        created_at: timestamp,
      })
    } else if (exactPlayerIds.length <= 5) {
      const names = exactPlayerIds.map((id) => nameMap[id] || 'Speler')
      const verb = exactPlayerIds.length === 1 ? 'had' : 'hadden'
      out.push({
        type: 'rare_exact',
        message: `Alleen ${joinNames(names)} ${verb} ${home} - ${away} exact voorspeld!`,
        metadata: { match_id: match.id, speeldag: match.speeldag, player_ids: exactPlayerIds },
        created_at: timestamp,
      })
    }
  }
  return out
}

// ───────────────────────────────────────────────────────────────────────────
// Speeldag complete: emit speeldag_top, standings_top3, standings_leader when
// every match of the given speeldag has a stored result. created_at sits just
// BEFORE the earliest match of the speeldag so the feed (ordered newest first)
// always shows all matches first, then the speeldag summary block below.
// Within the summary block, offsets give a stable visual order:
//   top3 (+3ms) > speeldag_top (+2ms) > leader (+1ms) > streak (+0ms)
// — standings first, streak ("speciallekes") at the bottom.
// ───────────────────────────────────────────────────────────────────────────

const SUMMARY_OFFSETS = {
  streak: 0,
  leader: 1,
  speeldag_top: 2,
  top3: 3,
} as const

// Summaries sit 1 second before the earliest match of their speeldag. Large
// enough to survive clock drift; small enough to stay visually tied to the
// speeldag block.
const SUMMARY_OFFSET_BASE_MS = 1000

function speeldagSummaryBaseMs(speeldagResults: ResultRow[]): number {
  const earliest = speeldagResults
    .map((r) => r.entered_at)
    .sort()[0]
  return Date.parse(earliest) - SUMMARY_OFFSET_BASE_MS
}

function buildSpeeldagCompleteEvents(
  speeldag: number,
  allMatches: { id: number; speeldag: number | null }[],
  resultMap: Record<number, ResultRow>,
  allPredictions: Prediction[],
  allExtraPredictions: ExtraPrediction[],
  extraQuestions: { id: number; points: number }[],
  extraAnswers: { question_id: number; correct_answer: string }[],
  nameMap: Record<string, string>,
  alltimeScores: { player_name: string; avg_z_score: number | null; years_played: number }[],
  playersWithHist: { id: string; display_name: string; matched_historical_name: string | null }[],
): MetricEvent[] {
  const speeldagMatchIds = allMatches.filter((m) => m.speeldag === speeldag).map((m) => m.id)
  if (speeldagMatchIds.length === 0) return []

  // Gate: every match of the speeldag must have a result
  const speeldagResults = speeldagMatchIds.map((id) => resultMap[id]).filter((r) => r != null) as ResultRow[]
  if (speeldagResults.length < speeldagMatchIds.length) return []

  const baseMs = speeldagSummaryBaseMs(speeldagResults)
  const leaderTs = new Date(baseMs + SUMMARY_OFFSETS.leader).toISOString()
  const speeldagTopTs = new Date(baseMs + SUMMARY_OFFSETS.speeldag_top).toISOString()
  const top3Ts = new Date(baseMs + SUMMARY_OFFSETS.top3).toISOString()

  const upToIds = allMatches
    .filter((m) => m.speeldag != null && m.speeldag <= speeldag)
    .map((m) => m.id)
  const upToIdSet = new Set(upToIds)

  const events: MetricEvent[] = []

  // Speeldag points
  const speeldagMatchIdSet = new Set(speeldagMatchIds)
  const speeldagPoints: Record<string, number> = {}
  for (const pred of allPredictions) {
    if (!speeldagMatchIdSet.has(pred.match_id)) continue
    const r = resultMap[pred.match_id]
    if (!r) continue
    const { points } = calculateMatchPoints(
      pred.home_score,
      pred.away_score,
      r.home_score,
      r.away_score,
    )
    speeldagPoints[pred.user_id] = (speeldagPoints[pred.user_id] || 0) + points
  }

  let speeldagTopEvent: MetricEvent | null = null
  const pointValues = Object.values(speeldagPoints)
  if (pointValues.length > 0) {
    const maxPts = Math.max(...pointValues)
    if (maxPts > 0) {
      const topPlayers = Object.entries(speeldagPoints).filter(([, p]) => p === maxPts)
      const names = topPlayers.map(([id]) => nameMap[id] || 'Speler')
      const label = topPlayers.length === 1 ? 'Topscorer' : 'Topscorers'
      speeldagTopEvent = {
        type: 'speeldag_top',
        message: `${label} speeldag ${speeldag}: ${joinNames(names)} met ${maxPts} ${maxPts === 1 ? 'punt' : 'punten'}!`,
        metadata: {
          speeldag,
          player_ids: topPlayers.map(([id]) => id),
          points: maxPts,
        },
        created_at: speeldagTopTs,
      }
    }
  }

  // Scores up to and including this speeldag
  const playerScoresUpTo: Record<string, number> = {}
  for (const pred of allPredictions) {
    if (!upToIdSet.has(pred.match_id)) continue
    const r = resultMap[pred.match_id]
    if (!r) continue
    const { points } = calculateMatchPoints(
      pred.home_score,
      pred.away_score,
      r.home_score,
      r.away_score,
    )
    playerScoresUpTo[pred.user_id] = (playerScoresUpTo[pred.user_id] || 0) + points
  }

  const qPointsMap: Record<number, number> = {}
  for (const q of extraQuestions) qPointsMap[q.id] = q.points

  const correctMap: Record<number, string[]> = {}
  for (const a of extraAnswers) {
    if (!correctMap[a.question_id]) correctMap[a.question_id] = []
    correctMap[a.question_id].push(a.correct_answer)
  }

  for (const ep of allExtraPredictions) {
    const correct = correctMap[ep.question_id] || []
    if (correct.length === 0) continue
    const norm = ep.answer.replace(/\s/g, '').toLowerCase()
    if (correct.some((a) => a.replace(/\s/g, '').toLowerCase() === norm)) {
      playerScoresUpTo[ep.user_id] =
        (playerScoresUpTo[ep.user_id] || 0) + (qPointsMap[ep.question_id] || 10)
    }
  }

  const standings = Object.entries(playerScoresUpTo)
    .map(([user_id, total]) => ({ user_id, total }))
    .sort((a, b) => b.total - a.total)

  // Top 3 with tie handling
  let top3Event: MetricEvent | null = null
  if (standings.length >= 3) {
    const ranked: { user_id: string; total: number; rank: number }[] = []
    let rank = 0
    let prevScore = -1
    for (let i = 0; i < standings.length; i++) {
      if (standings[i].total !== prevScore) rank = i + 1
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
        top3: ranked.map((r) => ({ player_id: r.user_id, total_score: r.total, rank: r.rank })),
      },
      created_at: top3Ts,
    }
  }

  // All-time leader
  let leaderEvent: MetricEvent | null = null
  if (alltimeScores.length > 0 && standings.length > 1) {
    const currentTotals = standings.map((s) => s.total)
    const mean = currentTotals.reduce((a, b) => a + b, 0) / currentTotals.length
    const stdev =
      Math.sqrt(
        currentTotals.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (currentTotals.length - 1),
      ) || 1

    const currentZMap = new Map<string, number>()
    for (const p of playersWithHist) {
      const score = standings.find((s) => s.user_id === p.id)
      if (!score) continue
      const histName = (p.matched_historical_name || p.display_name).toLowerCase()
      currentZMap.set(histName, (score.total - mean) / stdev)
    }

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
        metadata: { speeldag, player_names: leaderNames },
        created_at: leaderTs,
      }
    }
  }

  // Reverse display order: leader → top3 → speeldag_top (so speeldag_top is
  // inserted last and appears first within this speeldag's created_at bucket).
  if (leaderEvent) events.push(leaderEvent)
  if (top3Event) events.push(top3Event)
  if (speeldagTopEvent) events.push(speeldagTopEvent)

  return events
}

// ───────────────────────────────────────────────────────────────────────────
// no_zero: fires once when every player has scored at least one point.
// ───────────────────────────────────────────────────────────────────────────

function buildNoZeroEventFromScores(
  scores: { user_id: string; total_score: number }[],
): MetricEvent[] {
  if (scores.length === 0) return []
  const zeroCount = scores.filter((s) => s.total_score === 0).length
  if (zeroCount !== 0) return []
  return [
    {
      type: 'no_zero',
      message: 'Iedereen heeft gescoord! Niemand staat nog op 0 punten.',
      metadata: {},
    },
  ]
}

// ───────────────────────────────────────────────────────────────────────────
// streak: current set of players on a scoring streak. One row only (dedup_key
// = 'streak'). created_at is placed in the latest completed speeldag's summary
// block (below all its matches) so the feed keeps matches first.
// ───────────────────────────────────────────────────────────────────────────

function buildStreakEvents(
  allMatches: { id: number; speeldag: number | null }[],
  resultMap: Record<number, ResultRow>,
  allPredictions: Prediction[],
  nameMap: Record<string, string>,
): MetricEvent[] {
  // Ordered by entered_at; we want the streak computed over completed matches
  // in play order, not by seq/id. entered_at is close enough to play order for
  // a Belgian playoff round where matches are entered shortly after they end.
  const completed = allMatches
    .filter((m) => m.speeldag != null && resultMap[m.id])
    .sort((a, b) => resultMap[a.id].entered_at.localeCompare(resultMap[b.id].entered_at))

  if (completed.length < 5) return []

  const playerMatchPoints = new Map<string, Map<number, number>>()
  for (const pred of allPredictions) {
    const res = resultMap[pred.match_id]
    if (!res) continue
    const { points } = calculateMatchPoints(
      pred.home_score,
      pred.away_score,
      res.home_score,
      res.away_score,
    )
    if (!playerMatchPoints.has(pred.user_id)) playerMatchPoints.set(pred.user_id, new Map())
    playerMatchPoints.get(pred.user_id)!.set(pred.match_id, points)
  }

  const streakPlayers: { user_id: string; streak: number }[] = []
  for (const [userId, matchPts] of playerMatchPoints) {
    let streak = 0
    for (let i = completed.length - 1; i >= 0; i--) {
      const pts = matchPts.get(completed[i].id) ?? 0
      if (pts > 0) streak++
      else break
    }
    if (streak >= 5) streakPlayers.push({ user_id: userId, streak })
  }

  if (streakPlayers.length === 0) return []

  streakPlayers.sort(
    (a, b) =>
      b.streak - a.streak || (nameMap[a.user_id] || '').localeCompare(nameMap[b.user_id] || ''),
  )

  const latestMatch = completed[completed.length - 1]
  const latestSpeeldag = latestMatch.speeldag
  const latestSpeeldagResults = completed
    .filter((m) => m.speeldag === latestSpeeldag)
    .map((m) => resultMap[m.id])
  const baseMs = speeldagSummaryBaseMs(latestSpeeldagResults)
  const streakTs = new Date(baseMs + SUMMARY_OFFSETS.streak).toISOString()

  return [
    {
      type: 'streak',
      message: buildStreakMessage(streakPlayers, nameMap),
      metadata: {
        speeldag: latestSpeeldag,
        streaks: streakPlayers.map((s) => ({ player_id: s.user_id, streak: s.streak })),
      },
      created_at: streakTs,
    },
  ]
}

