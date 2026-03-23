import { SupabaseClient } from '@supabase/supabase-js'
import { calculateMatchPoints, checkExtraAnswer } from './scoring'

export async function recalculateScores(serviceClient: SupabaseClient) {
  const [
    { data: allPlayers },
    { data: allResults },
    { data: allPredictions },
    { data: allExtraPredictions },
    { data: allExtraAnswers },
    { data: allExtraQuestions },
    { data: oldScores },
  ] = await Promise.all([
    serviceClient.from('players').select('id'),
    serviceClient.from('results').select('*'),
    serviceClient.from('predictions').select('*'),
    serviceClient.from('extra_predictions').select('*'),
    serviceClient.from('extra_question_answers').select('*'),
    serviceClient.from('extra_questions').select('*'),
    serviceClient.from('player_scores').select('user_id, total_score, previous_rank'),
  ])

  // Compute old ranks from current scores
  const oldRankMap: Record<string, number> = {}
  const sortedOld = [...(oldScores || [])].sort((a, b) => b.total_score - a.total_score)
  let oldRank = 0
  let oldPrevScore = -1
  sortedOld.forEach((row, index) => {
    if (row.total_score !== oldPrevScore) {
      oldRank = index + 1
    }
    oldPrevScore = row.total_score
    oldRankMap[row.user_id] = oldRank
  })

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

  // Pre-group predictions by user_id for O(n) lookup
  const predictionsByUser = new Map<string, typeof allPredictions>()
  for (const pred of allPredictions || []) {
    if (!predictionsByUser.has(pred.user_id)) predictionsByUser.set(pred.user_id, [])
    predictionsByUser.get(pred.user_id)!.push(pred)
  }

  const extraPredsByUser = new Map<string, typeof allExtraPredictions>()
  for (const ep of allExtraPredictions || []) {
    if (!extraPredsByUser.has(ep.user_id)) extraPredsByUser.set(ep.user_id, [])
    extraPredsByUser.get(ep.user_id)!.push(ep)
  }

  // Compute new scores for all players
  const newScores: {
    user_id: string
    total_score: number
    match_score: number
    extra_score: number
    exact_matches: number
    correct_goal_diffs: number
    correct_results: number
  }[] = []

  for (const player of allPlayers || []) {
    const userId = player.id
    let matchScore = 0
    let extraScore = 0
    let exactMatches = 0
    let correctGoalDiffs = 0
    let correctResults = 0

    for (const pred of predictionsByUser.get(userId) || []) {
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

    for (const ep of extraPredsByUser.get(userId) || []) {
      const correctAnswers = correctAnswersMap[ep.question_id] || []
      if (correctAnswers.length > 0 && checkExtraAnswer(ep.answer, correctAnswers)) {
        extraScore += questionPointsMap[ep.question_id] || 10
      }
    }

    newScores.push({
      user_id: userId,
      total_score: matchScore + extraScore,
      match_score: matchScore,
      extra_score: extraScore,
      exact_matches: exactMatches,
      correct_goal_diffs: correctGoalDiffs,
      correct_results: correctResults,
    })
  }

  // Compute new ranks
  const newRankMap: Record<string, number> = {}
  const sortedNew = [...newScores].sort((a, b) => b.total_score - a.total_score)
  let newRank = 0
  let newPrevScore = -1
  sortedNew.forEach((row, index) => {
    if (row.total_score !== newPrevScore) {
      newRank = index + 1
    }
    newPrevScore = row.total_score
    newRankMap[row.user_id] = newRank
  })

  // Detect if any player's score actually changed
  const oldScoreMap: Record<string, number> = {}
  const oldPreviousRankMap: Record<string, number | null> = {}
  for (const row of oldScores || []) {
    oldScoreMap[row.user_id] = row.total_score
    oldPreviousRankMap[row.user_id] = row.previous_rank ?? null
  }
  const hasChanges = newScores.some(s => oldScoreMap[s.user_id] !== s.total_score)

  // Upsert with rank_change and previous_rank
  let playersUpdated = 0
  for (const score of newScores) {
    const newPlayerRank = newRankMap[score.user_id]

    // Only advance the baseline when scores actually changed
    const previousRank = hasChanges
      ? (oldRankMap[score.user_id] ?? newPlayerRank)
      : (oldPreviousRankMap[score.user_id] ?? null)

    const rankChange = previousRank != null ? previousRank - newPlayerRank : 0

    const { error } = await serviceClient
      .from('player_scores')
      .upsert(
        {
          ...score,
          previous_rank: previousRank,
          rank_change: rankChange,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (!error) playersUpdated++
  }

  // Compute point deltas for activity events
  const pointDeltas: { user_id: string; delta: number }[] = []
  if (hasChanges) {
    for (const score of newScores) {
      const oldTotal = oldScoreMap[score.user_id] ?? 0
      const delta = score.total_score - oldTotal
      if (delta > 0) {
        pointDeltas.push({ user_id: score.user_id, delta })
      }
    }
  }

  return { playersUpdated, resultsCount: Object.keys(resultMap).length, pointDeltas }
}
