export function calculateMatchPoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): { points: number; category: 'exact' | 'goal_diff' | 'result' | 'wrong' } {
  const predResult = Math.sign(predHome - predAway)
  const actualResult = Math.sign(actualHome - actualAway)

  if (predResult !== actualResult) {
    return { points: 0, category: 'wrong' }
  }

  let points = 5 // correct result
  if (predHome - predAway === actualHome - actualAway) {
    points += 2 // correct goal difference
    if (predHome === actualHome && predAway === actualAway) {
      points += 3 + actualHome + actualAway // exact match bonus
      return { points, category: 'exact' }
    }
    return { points, category: 'goal_diff' }
  }

  return { points, category: 'result' }
}

export function checkExtraAnswer(
  playerAnswer: string,
  correctAnswers: string[]
): boolean {
  const normalized = playerAnswer.replace(/\s/g, '').toLowerCase()
  return correctAnswers.some(
    (a) => a.replace(/\s/g, '').toLowerCase() === normalized
  )
}
