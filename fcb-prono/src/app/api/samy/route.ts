import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { recalculateScores } from '@/lib/recalculate'

const SAMY_USER_ID = 'cbc48793-04be-4b2c-9c74-23054654c602'
const PLAYED_MATCH_ID = 1

export async function POST(request: Request) {
  try {
    const { predictions, extraAnswers } = await request.json()
    const serviceClient = await createServiceClient()

    // Delete existing predictions (except match 1) and extra predictions
    await serviceClient
      .from('predictions')
      .delete()
      .eq('user_id', SAMY_USER_ID)
      .neq('match_id', PLAYED_MATCH_ID)

    await serviceClient
      .from('extra_predictions')
      .delete()
      .eq('user_id', SAMY_USER_ID)

    // Insert new predictions
    const predRows = Object.entries(predictions as Record<string, { home: string; away: string }>)
      .filter(([matchId]) => Number(matchId) !== PLAYED_MATCH_ID)
      .map(([matchId, score]) => ({
        user_id: SAMY_USER_ID,
        match_id: Number(matchId),
        home_score: parseInt(score.home),
        away_score: parseInt(score.away),
      }))

    if (predRows.length > 0) {
      const { error: predError } = await serviceClient.from('predictions').upsert(predRows, { onConflict: 'user_id,match_id' })
      if (predError) return NextResponse.json({ error: predError.message }, { status: 500 })
    }

    // Insert new extra predictions
    const extraRows = Object.entries(extraAnswers as Record<string, string>)
      .filter(([, answer]) => answer.trim())
      .map(([questionId, answer]) => ({
        user_id: SAMY_USER_ID,
        question_id: Number(questionId),
        answer: answer.trim(),
      }))

    if (extraRows.length > 0) {
      const { error: extraError } = await serviceClient.from('extra_predictions').upsert(extraRows, { onConflict: 'user_id,question_id' })
      if (extraError) return NextResponse.json({ error: extraError.message }, { status: 500 })
    }

    // Recalculate scores
    await recalculateScores(serviceClient)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[samy] Error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
