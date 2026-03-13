import { createClient } from '@/lib/supabase/server'
import { calculateMatchPoints } from '@/lib/scoring'
import { checkExtraAnswer } from '@/lib/scoring'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single()

  if (!player) notFound()

  const [
    { data: playerScore },
    { data: allScores },
    { data: predictions },
    { data: allResults },
    { data: extraPredictions },
    { data: extraAnswers },
  ] = await Promise.all([
    supabase.from('player_scores').select('*').eq('user_id', id).single(),
    supabase.from('player_scores').select('user_id, total_score').order('total_score', { ascending: false }),
    supabase
      .from('predictions')
      .select(`*, matches!inner(*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*))`)
      .eq('user_id', id)
      .order('match_id', { ascending: true }),
    supabase.from('results').select('*'),
    supabase.from('extra_predictions').select('*, extra_questions!inner(*)').eq('user_id', id).order('question_id', { ascending: true }),
    supabase.from('extra_question_answers').select('*'),
  ])

  // Build results map: match_id -> result
  const resultMap: Record<number, { home_score: number; away_score: number }> = {}
  for (const r of allResults || []) {
    resultMap[r.match_id] = { home_score: r.home_score, away_score: r.away_score }
  }

  let rank = 0
  if (allScores) {
    let currentRank = 0
    let prevScore = -1
    for (let i = 0; i < allScores.length; i++) {
      if (allScores[i].total_score !== prevScore) currentRank = i + 1
      if (allScores[i].user_id === id) { rank = currentRank; break }
      prevScore = allScores[i].total_score
    }
  }

  // Build extra answers map: question_id -> correct_answer[]
  const correctAnswersMap: Record<number, string[]> = {}
  for (const a of extraAnswers || []) {
    if (!correctAnswersMap[a.question_id]) correctAnswersMap[a.question_id] = []
    correctAnswersMap[a.question_id].push(a.correct_answer)
  }

  const categoryColors = {
    exact: 'bg-green-400/10',
    goal_diff: 'bg-green-400/5',
    result: 'bg-yellow-400/5',
    wrong: 'bg-red-400/5',
    pending: '',
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{player.display_name}</h1>
        <div className="flex items-center gap-4 mt-1">
          {rank > 0 && (
            <span className="text-sm text-gray-400">Rank: #{rank}</span>
          )}
          {playerScore && (
            <span className="text-sm text-cb-gold font-bold">
              {playerScore.total_score} punten
            </span>
          )}
        </div>
      </div>

      {/* Payment banner */}
      {player.payment_status !== 'paid' && (
        <Link
          href={`/betalen/${player.id}`}
          className="block mb-6 px-4 py-3 bg-yellow-900/20 border border-yellow-800 rounded-lg text-sm text-yellow-300 hover:bg-yellow-900/30 transition-colors"
        >
          {player.payment_status === 'pending'
            ? 'Betaling in afwachting — klik hier om opnieuw te betalen'
            : 'Je hebt nog niet betaald — klik hier om te betalen'}
        </Link>
      )}

      {/* Score breakdown */}
      {playerScore && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-card rounded-lg border border-border p-3 text-center">
            <div className="text-lg font-bold text-white">{playerScore.match_score}</div>
            <div className="text-xs text-gray-400">Match</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 text-center">
            <div className="text-lg font-bold text-white">{playerScore.extra_score}</div>
            <div className="text-xs text-gray-400">Extra</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 text-center">
            <div className="text-lg font-bold text-white">{playerScore.exact_matches}</div>
            <div className="text-xs text-gray-400">Exact</div>
          </div>
        </div>
      )}

      {/* Match predictions */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Wedstrijden
      </h2>
      <div className="bg-card rounded-xl border border-border overflow-hidden mb-8">
        <div className="divide-y divide-border/50">
          {(predictions || []).map((pred) => {
            const match = pred.matches as {
              speeldag: number | null
              is_cup_final: boolean
              home_team: { name: string; short_name: string }
              away_team: { name: string; short_name: string }
            }
            const result = resultMap[pred.match_id]
            let points = 0
            let category: 'exact' | 'goal_diff' | 'result' | 'wrong' | 'pending' = 'pending'

            if (result) {
              const calc = calculateMatchPoints(
                pred.home_score,
                pred.away_score,
                result.home_score,
                result.away_score
              )
              points = calc.points
              category = calc.category
            }

            return (
              <div
                key={pred.id}
                className={`flex items-center px-4 py-2.5 text-sm ${categoryColors[category]}`}
              >
                <span className="w-24 truncate text-gray-400 text-xs">
                  {match.is_cup_final
                    ? 'Beker'
                    : `SD${match.speeldag}`}
                  {' '}
                  {match.home_team.short_name}-{match.away_team.short_name}
                </span>
                <span className="w-16 text-center text-gray-300">
                  {pred.home_score} - {pred.away_score}
                </span>
                <span className="w-16 text-center text-gray-500">
                  {result ? `${result.home_score} - ${result.away_score}` : '—'}
                </span>
                <span className={`w-10 text-right font-bold ${
                  category === 'exact' || category === 'goal_diff'
                    ? 'text-green-400'
                    : category === 'result'
                    ? 'text-yellow-400'
                    : category === 'wrong'
                    ? 'text-red-400'
                    : 'text-gray-500'
                }`}>
                  {result ? points : '—'}
                </span>
              </div>
            )
          })}
          {(!predictions || predictions.length === 0) && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              Geen voorspellingen
            </div>
          )}
        </div>
      </div>

      {/* Extra questions */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Extra vragen
      </h2>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {(extraPredictions || []).map((ep) => {
            const question = ep.extra_questions as { question_label: string; points: number }
            const correctAnswers = correctAnswersMap[ep.question_id] || []
            const isCorrect = correctAnswers.length > 0 && checkExtraAnswer(ep.answer, correctAnswers)
            const hasAnswer = correctAnswers.length > 0

            return (
              <div key={ep.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-400 flex-1 truncate">{question.question_label}</span>
                <span className="text-gray-300 mx-3">{ep.answer}</span>
                {hasAnswer ? (
                  <span className={`font-bold w-10 text-right ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                    {isCorrect ? question.points : 0}
                  </span>
                ) : (
                  <span className="text-gray-500 w-10 text-right">—</span>
                )}
              </div>
            )
          })}
          {(!extraPredictions || extraPredictions.length === 0) && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              Geen extra voorspellingen
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
