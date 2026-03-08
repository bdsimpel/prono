import { SupabaseClient } from '@supabase/supabase-js'
import { calculateMatchPoints, checkExtraAnswer } from './scoring'

export async function recalculateScores(serviceClient: SupabaseClient) {
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

  const resultMap: Record<number, { home_score: number; away_score: number }> = {}
  for (const r of allResults || []) {
    resultMap[r.match_id] = { home_score: r.home_score, away_score: r.away_score }
  }

  const correctAnswersMap: Record<number, string[]> = {}
  for (const a of allExtraAnswers || []) {
    if (!correctAnswersMap[a.question_id]) correctAnswersMap[a.question_id] = []
    correctAnswersMap[a.question_id].push(a.correct_answer)
  }

  const questionPointsMap: Record<number, number> = {}
  for (const q of allExtraQuestions || []) {
    questionPointsMap[q.id] = q.points
  }

  let playersUpdated = 0

  for (const profile of allProfiles || []) {
    const userId = profile.id
    let matchScore = 0
    let extraScore = 0
    let exactMatches = 0
    let correctGoalDiffs = 0
    let correctResults = 0

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

    const userExtraPreds = (allExtraPredictions || []).filter(p => p.user_id === userId)
    for (const ep of userExtraPreds) {
      const correctAnswers = correctAnswersMap[ep.question_id] || []
      if (correctAnswers.length > 0 && checkExtraAnswer(ep.answer, correctAnswers)) {
        extraScore += questionPointsMap[ep.question_id] || 10
      }
    }

    const { error } = await serviceClient
      .from('player_scores')
      .upsert(
        {
          user_id: userId,
          total_score: matchScore + extraScore,
          match_score: matchScore,
          extra_score: extraScore,
          exact_matches: exactMatches,
          correct_goal_diffs: correctGoalDiffs,
          correct_results: correctResults,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (!error) playersUpdated++
  }

  return { playersUpdated, resultsCount: Object.keys(resultMap).length }
}
