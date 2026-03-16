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

  const { results, answers } = await request.json()
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
        { match_id: parseInt(matchId), home_score: home, away_score: away },
        { onConflict: 'match_id' }
      )
    if (!error) resultsSaved++
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

  // Recalculate all scores
  const { playersUpdated } = await recalculateScores(serviceClient)

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true, resultsSaved, playersUpdated })
}
