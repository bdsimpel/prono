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

  const { answers } = await request.json() as { answers: Record<string, string[]> }
  const serviceClient = await createServiceClient()

  for (const [qId, answerList] of Object.entries(answers)) {
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

  return NextResponse.json({ success: true, playersUpdated })
}
