import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calculateMatchPoints, checkExtraAnswer } from '@/lib/scoring'

export async function POST() {
  // Verify admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service role for writes
  const serviceClient = await createServiceClient()

  // Fetch all data
  const [
    { data: allProfiles },
    { data: allResults },
    { data: allPredictions },
    { data: allExtraPredictions },
    { data: allExtraAnswers },
    { data: allExtraQuestions },
  ] = await Promise.all([
    serviceClient.from('profiles').select('id'),
    serviceClient.from('results').select('*'),
    serviceClient.from('predictions').select('*'),
    serviceClient.from('extra_predictions').select('*'),
    serviceClient.from('extra_question_answers').select('*'),
    serviceClient.from('extra_questions').select('*'),
  ])

  // Build result map: match_id -> { home_score, away_score }
  const resultMap: Record<number, { home_score: number; away_score: number }> = {}
  for (const r of allResults || []) {
    resultMap[r.match_id] = { home_score: r.home_score, away_score: r.away_score }
  }

  // Build correct answers map: question_id -> correct_answer[]
  const correctAnswersMap: Record<number, string[]> = {}
  for (const a of allExtraAnswers || []) {
    if (!correctAnswersMap[a.question_id]) correctAnswersMap[a.question_id] = []
    correctAnswersMap[a.question_id].push(a.correct_answer)
  }

  // Build question points map: question_id -> points
  const questionPointsMap: Record<number, number> = {}
  for (const q of allExtraQuestions || []) {
    questionPointsMap[q.id] = q.points
  }

  // Calculate scores for each user
  const scores: {
    user_id: string
    total_score: number
    match_score: number
    extra_score: number
    exact_matches: number
    correct_goal_diffs: number
    correct_results: number
  }[] = []

  for (const profile of allProfiles || []) {
    const userId = profile.id
    let matchScore = 0
    let extraScore = 0
    let exactMatches = 0
    let correctGoalDiffs = 0
    let correctResults = 0

    // Match predictions
    const userPredictions = (allPredictions || []).filter(p => p.user_id === userId)
    for (const pred of userPredictions) {
      const result = resultMap[pred.match_id]
      if (!result) continue

      const calc = calculateMatchPoints(
        pred.home_score,
        pred.away_score,
        result.home_score,
        result.away_score
      )

      matchScore += calc.points
      if (calc.category === 'exact') exactMatches++
      else if (calc.category === 'goal_diff') correctGoalDiffs++
      else if (calc.category === 'result') correctResults++
    }

    // Extra predictions
    const userExtraPreds = (allExtraPredictions || []).filter(p => p.user_id === userId)
    for (const ep of userExtraPreds) {
      const correctAnswers = correctAnswersMap[ep.question_id] || []
      if (correctAnswers.length > 0 && checkExtraAnswer(ep.answer, correctAnswers)) {
        extraScore += questionPointsMap[ep.question_id] || 10
      }
    }

    scores.push({
      user_id: userId,
      total_score: matchScore + extraScore,
      match_score: matchScore,
      extra_score: extraScore,
      exact_matches: exactMatches,
      correct_goal_diffs: correctGoalDiffs,
      correct_results: correctResults,
    })
  }

  // Upsert all scores
  for (const score of scores) {
    await serviceClient
      .from('player_scores')
      .upsert(
        { ...score, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
  }

  return NextResponse.json({
    success: true,
    players_updated: scores.length,
  })
}
