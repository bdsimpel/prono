import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  const { answers } = await request.json()
  const serviceClient = await createServiceClient()

  for (const [qId, answer] of Object.entries(answers) as [string, string][]) {
    if (!answer.trim()) continue
    await serviceClient
      .from('extra_question_answers')
      .upsert(
        { question_id: parseInt(qId), correct_answer: answer.trim() },
        { onConflict: 'question_id,correct_answer' }
      )
  }

  return NextResponse.json({ success: true })
}
