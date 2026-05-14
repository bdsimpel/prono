import type { SupabaseClient } from '@supabase/supabase-js'

const QUESTION_LABEL: Record<string, string> = {
  topscorer_poi: 'Topscorer',
  assistenkoning_poi: 'Assistenkoning',
  meeste_clean_sheets_poi: 'Meeste clean sheets',
  beste_ploeg_poi: 'Beste ploeg',
  meeste_goals_poi: 'Meeste goals',
  minste_goals_tegen_poi: 'Minste goals tegen',
  kampioen: 'Kampioen',
  bekerwinnaar: 'Bekerwinnaar',
}

interface SetAnswerOpts {
  /** Optional base timestamp; the event is placed at base + 1000ms. Defaults to now. */
  baseTimestamp?: string
  /** Optional match_id for the metadata payload. */
  matchId?: number
}

/**
 * Set the correct answer(s) for an extra question and emit an `extra_answer`
 * activity event, but only when the answer set is NEW or CHANGED. Re-running
 * with the same answers is a no-op on both `extra_question_answers` and
 * `activity_events` — so Recalculate Stats can be pressed repeatedly without
 * spamming the feed.
 */
export async function setExtraAnswerWithActivity(
  serviceClient: SupabaseClient,
  questionKey: string,
  answers: string[],
  opts: SetAnswerOpts = {},
): Promise<void> {
  if (answers.length === 0) return

  const { data: q } = await serviceClient
    .from('extra_questions')
    .select('id')
    .eq('question_key', questionKey)
    .single()
  if (!q) return
  const qId = q.id

  const { data: existingRows } = await serviceClient
    .from('extra_question_answers')
    .select('correct_answer')
    .eq('question_id', qId)
  const existingSet = new Set((existingRows || []).map(r => r.correct_answer as string))
  const newSet = new Set(answers)
  const sameAnswers =
    existingSet.size === newSet.size && [...newSet].every(a => existingSet.has(a))

  // extra_answer has dedup_key = NULL by design, so filter by metadata.
  const { data: existingEvents } = await serviceClient
    .from('activity_events')
    .select('id')
    .eq('type', 'extra_answer')
    .contains('metadata', { question_key: questionKey })
    .limit(1)
  const eventAlreadyEmitted = !!(existingEvents && existingEvents.length > 0)

  // Case A: answers unchanged AND event already exists → fully idempotent.
  if (sameAnswers && eventAlreadyEmitted) return

  // Case B: answers changed → replace rows.
  if (!sameAnswers) {
    await serviceClient.from('extra_question_answers').delete().eq('question_id', qId)
    const rows = answers.map(a => ({ question_id: qId, correct_answer: a }))
    await serviceClient
      .from('extra_question_answers')
      .upsert(rows, { onConflict: 'question_id,correct_answer', ignoreDuplicates: true })
  }
  // Case C: answers unchanged but no event yet → only emit.

  const label = QUESTION_LABEL[questionKey] ?? questionKey
  const baseMs = opts.baseTimestamp ? Date.parse(opts.baseTimestamp) : Date.now()
  const eventTs = new Date(baseMs + 1000).toISOString()
  const sortedAnswers = [...newSet].sort()
  await serviceClient.from('activity_events').insert({
    type: 'extra_answer',
    message: `${label} bekend: ${sortedAnswers.join(', ')}`,
    metadata: {
      question_key: questionKey,
      correct_answer: sortedAnswers.join(', '),
      ...(opts.matchId != null ? { match_id: opts.matchId } : {}),
    },
    created_at: eventTs,
  })
}
