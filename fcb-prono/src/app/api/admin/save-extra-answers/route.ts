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

  const { playersUpdated } = await recalculateScores(serviceClient)

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true, playersUpdated })
}
