import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { recalculateScores } from '@/lib/recalculate'
import { generateMetricEvents, insertMetricEvents } from '@/lib/activity-metrics'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { results } = await request.json()
  const serviceClient = await createServiceClient()

  // Split into new vs existing so entered_at on existing rows is preserved
  // (overwriting it would re-shuffle the feed on every admin save).
  const toDelete: number[] = []
  const batchInput: { match_id: number; home_score: number; away_score: number }[] = []
  for (const [matchId, score] of Object.entries(results) as [string, { home: string; away: string }][]) {
    const home = parseInt(score.home)
    const away = parseInt(score.away)
    if (isNaN(home) || isNaN(away)) {
      toDelete.push(parseInt(matchId))
    } else {
      batchInput.push({ match_id: parseInt(matchId), home_score: home, away_score: away })
    }
  }

  const inputIds = batchInput.map((r) => r.match_id)
  const { data: existingRows } = inputIds.length > 0
    ? await serviceClient.from('results').select('match_id').in('match_id', inputIds)
    : { data: [] as { match_id: number }[] }
  const existingIds = new Set((existingRows || []).map((r) => r.match_id))

  const batchBase = Date.now()
  let batchIdx = 0
  const toInsert: { match_id: number; home_score: number; away_score: number; entered_at: string }[] = []
  const toUpdate: { match_id: number; home_score: number; away_score: number }[] = []
  for (const row of batchInput) {
    if (existingIds.has(row.match_id)) {
      toUpdate.push(row)
    } else {
      const enteredAt = new Date(batchBase + batchIdx).toISOString()
      toInsert.push({ ...row, entered_at: enteredAt })
      batchIdx++
    }
  }

  await Promise.all([
    toDelete.length > 0 ? serviceClient.from('results').delete().in('match_id', toDelete) : null,
    toInsert.length > 0 ? serviceClient.from('results').insert(toInsert) : null,
    ...toUpdate.map((r) =>
      serviceClient.from('results').update({ home_score: r.home_score, away_score: r.away_score }).eq('match_id', r.match_id)
    ),
  ])
  const saved = batchInput.length

  // Insert result activity events for saved matches
  const savedMatchIds = Object.entries(results)
    .filter(([, score]) => {
      const s = score as { home: string; away: string }
      return !isNaN(parseInt(s.home)) && !isNaN(parseInt(s.away))
    })
    .map(([matchId]) => parseInt(matchId))

  if (savedMatchIds.length > 0) {
    const [{ data: matches }, { data: teams }] = await Promise.all([
      serviceClient.from('matches').select('id, speeldag, home_team_id, away_team_id, is_cup_final').in('id', savedMatchIds),
      serviceClient.from('teams').select('id, name'),
    ])

    const teamMap: Record<number, string> = {}
    for (const t of teams || []) teamMap[t.id] = t.name

    // Fetch final entered_at per match (either the preserved old value or the
    // new one we just inserted) so the activity event timestamp matches the
    // stored result timestamp exactly — keeps rare_exact (entered_at + 1ms)
    // ordering stable in the feed.
    const { data: finalRows } = await serviceClient
      .from('results')
      .select('match_id, entered_at')
      .in('match_id', savedMatchIds)
    const enteredAtByMatch = new Map<number, string>()
    for (const r of finalRows || []) enteredAtByMatch.set(r.match_id, r.entered_at)

    const resultEvents = (matches || []).map(m => {
      const s = results[String(m.id)] as { home: string; away: string }
      return {
        type: 'result' as const,
        message: `${teamMap[m.home_team_id]} ${s.home} - ${s.away} ${teamMap[m.away_team_id]}`,
        metadata: { match_id: m.id, speeldag: m.speeldag },
        created_at: enteredAtByMatch.get(m.id),
      }
    })

    if (resultEvents.length > 0) {
      await serviceClient
        .from('activity_events')
        .upsert(resultEvents, { onConflict: 'dedup_key', ignoreDuplicates: true })
    }
  }

  // Recalculate scores immediately
  const { playersUpdated, pointDeltas } = await recalculateScores(serviceClient)

  // Insert points activity events
  if (pointDeltas.length > 0) {
    const { data: playerNames } = await serviceClient
      .from('players')
      .select('id, display_name')
      .in('id', pointDeltas.map(d => d.user_id))

    const nameMap: Record<string, string> = {}
    for (const p of playerNames || []) nameMap[p.id] = p.display_name

    const pointEvents = pointDeltas.map(d => ({
      type: 'points' as const,
      message: `${nameMap[d.user_id] || 'Speler'} scoorde ${d.delta} ${d.delta === 1 ? 'punt' : 'punten'}`,
      metadata: { player_id: d.user_id, points: d.delta },
    }))

    await serviceClient.from('activity_events').insert(pointEvents)
  }

  // Generate and insert metric events (rare exact predictions, speeldag top scorer)
  if (savedMatchIds.length > 0) {
    const metricEvents = await generateMetricEvents({
      savedMatchIds,
      serviceClient,
      pointDeltas,
    })
    await insertMetricEvents(serviceClient, metricEvents)
  }

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true, resultsSaved: saved, playersUpdated })
}
