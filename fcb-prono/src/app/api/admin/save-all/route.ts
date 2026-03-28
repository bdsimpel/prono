import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { recalculateScores } from '@/lib/recalculate'

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

  const { results, answers, sofascoreIds } = await request.json()
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

  // Save SofaScore event IDs
  if (sofascoreIds && typeof sofascoreIds === 'object') {
    for (const [matchId, eventId] of Object.entries(sofascoreIds) as [string, string][]) {
      const id = eventId ? parseInt(eventId) : null
      await serviceClient
        .from('matches')
        .update({ sofascore_event_id: id || null })
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

  // Insert result activity events for saved matches
  const savedMatchIds = Object.entries(results)
    .filter(([, score]) => {
      const s = score as { home: string; away: string }
      return !isNaN(parseInt(s.home)) && !isNaN(parseInt(s.away))
    })
    .map(([matchId]) => parseInt(matchId))

  if (savedMatchIds.length > 0) {
    const [{ data: matchRows }, { data: teamRows }] = await Promise.all([
      serviceClient.from('matches').select('id, speeldag, home_team_id, away_team_id, is_cup_final').in('id', savedMatchIds),
      serviceClient.from('teams').select('id, name'),
    ])
    const teamMap: Record<number, string> = {}
    for (const t of teamRows || []) teamMap[t.id] = t.name

    const resultEvents = (matchRows || []).map(m => {
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

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true, resultsSaved, playersUpdated })
}
