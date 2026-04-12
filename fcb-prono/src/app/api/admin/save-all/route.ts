import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { recalculateScores } from '@/lib/recalculate'
import { generateMetricEvents } from '@/lib/activity-metrics'

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

  const { results, answers, sofascoreIds, fixtureIds } = await request.json()
  const serviceClient = await createServiceClient()

  // Save match results
  let resultsSaved = 0
  for (const [matchId, score] of Object.entries(results) as [string, { home: string; away: string }][]) {
    const home = parseInt(score.home)
    const away = parseInt(score.away)

    if (isNaN(home) || isNaN(away)) {
      // Empty/cleared score: delete the result if it exists
      await serviceClient
        .from('results')
        .delete()
        .eq('match_id', parseInt(matchId))
      continue
    }

    const { error } = await serviceClient
      .from('results')
      .upsert(
        { match_id: parseInt(matchId), home_score: home, away_score: away, source: 'manual' },
        { onConflict: 'match_id' }
      )
    if (!error) resultsSaved++
  }

  // Save SofaScore event IDs (legacy)
  if (sofascoreIds && typeof sofascoreIds === 'object') {
    for (const [matchId, eventId] of Object.entries(sofascoreIds) as [string, string][]) {
      const id = eventId ? parseInt(eventId) : null
      await serviceClient
        .from('matches')
        .update({ sofascore_event_id: id || null })
        .eq('id', parseInt(matchId))
    }
  }

  // Save API-Football fixture IDs
  if (fixtureIds && typeof fixtureIds === 'object') {
    for (const [matchId, fId] of Object.entries(fixtureIds) as [string, string][]) {
      const id = fId ? parseInt(fId) : null
      await serviceClient
        .from('matches')
        .update({ api_football_fixture_id: id || null })
        .eq('id', parseInt(matchId))
    }
  }

  // Save extra question answers
  for (const [qId, answerList] of Object.entries(answers) as [string, string[]][]) {
    const questionId = parseInt(qId)

    // Delete existing answers for this question
    await serviceClient
      .from('extra_question_answers')
      .delete()
      .eq('question_id', questionId)

    // Insert new answers
    const rows = (answerList || [])
      .filter(a => a.trim())
      .map(a => ({ question_id: questionId, correct_answer: a.trim() }))

    if (rows.length > 0) {
      await serviceClient
        .from('extra_question_answers')
        .insert(rows)
    }
  }

  // Insert result activity events only for newly saved matches (skip duplicates)
  const savedMatchIds = Object.entries(results)
    .filter(([, score]) => {
      const s = score as { home: string; away: string }
      return !isNaN(parseInt(s.home)) && !isNaN(parseInt(s.away))
    })
    .map(([matchId]) => parseInt(matchId))

  if (savedMatchIds.length > 0) {
    const [{ data: matchRows }, { data: teamRows }, { data: existingEvents }] = await Promise.all([
      serviceClient.from('matches').select('id, speeldag, home_team_id, away_team_id, is_cup_final').in('id', savedMatchIds),
      serviceClient.from('teams').select('id, name'),
      serviceClient.from('activity_events').select('metadata').eq('type', 'result'),
    ])

    // Find which matches already have activity events
    const existingMatchIds = new Set(
      (existingEvents || [])
        .map(e => (e.metadata as { match_id?: number })?.match_id)
        .filter(Boolean)
    )

    const teamMap: Record<number, string> = {}
    for (const t of teamRows || []) teamMap[t.id] = t.name

    const resultEvents = (matchRows || [])
      .filter(m => !existingMatchIds.has(m.id))
      .map(m => {
        const s = results[String(m.id)] as { home: string; away: string }
        return {
          type: 'result' as const,
          message: `${teamMap[m.home_team_id]} ${s.home} - ${s.away} ${teamMap[m.away_team_id]}`,
          metadata: { match_id: m.id, speeldag: m.speeldag },
        }
      })

    if (resultEvents.length > 0) {
      await serviceClient.from('activity_events').insert(resultEvents)
    }
  }

  // Recalculate all scores
  const { playersUpdated, pointDeltas } = await recalculateScores(serviceClient)

  // Generate and insert metric events (rare exact predictions, speeldag top scorer)
  if (savedMatchIds.length > 0) {
    const metricEvents = await generateMetricEvents({
      savedMatchIds,
      serviceClient,
      pointDeltas,
    })
    if (metricEvents.length > 0) {
      await serviceClient.from('activity_events').insert(metricEvents)
    }
  }

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true, resultsSaved, playersUpdated })
}
