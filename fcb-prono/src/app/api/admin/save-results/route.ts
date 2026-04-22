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

  // Batch into bulk delete + bulk upsert. Per-match timestamp is shared
  // between results.entered_at and the matching activity_events.created_at so
  // rare_exact (entered_at + 1ms) lands consistently above the match in the
  // feed — without this, DB defaults would diverge by ~60ms across the two
  // tables and flip the ordering.
  const enteredAtByMatch = new Map<number, string>()
  const batchBase = Date.now()
  const toDelete: number[] = []
  const toUpsert: { match_id: number; home_score: number; away_score: number; entered_at: string }[] = []
  let batchIdx = 0
  for (const [matchId, score] of Object.entries(results) as [string, { home: string; away: string }][]) {
    const home = parseInt(score.home)
    const away = parseInt(score.away)
    if (isNaN(home) || isNaN(away)) {
      toDelete.push(parseInt(matchId))
    } else {
      const enteredAt = new Date(batchBase + batchIdx).toISOString()
      enteredAtByMatch.set(parseInt(matchId), enteredAt)
      toUpsert.push({ match_id: parseInt(matchId), home_score: home, away_score: away, entered_at: enteredAt })
      batchIdx++
    }
  }
  await Promise.all([
    toDelete.length > 0 ? serviceClient.from('results').delete().in('match_id', toDelete) : null,
    toUpsert.length > 0 ? serviceClient.from('results').upsert(toUpsert, { onConflict: 'match_id' }) : null,
  ])
  const saved = toUpsert.length

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
