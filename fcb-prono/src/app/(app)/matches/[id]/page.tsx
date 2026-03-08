import { createClient } from '@/lib/supabase/server'
import { calculateMatchPoints } from '@/lib/scoring'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: match } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*),
      results(*)
    `)
    .eq('id', id)
    .single()

  if (!match) notFound()

  const result = match.results?.[0]

  // Get all predictions for this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, profiles!inner(display_name)')
    .eq('match_id', id)

  type Category = 'exact' | 'goal_diff' | 'result' | 'wrong' | 'pending'

  // Calculate points for each prediction
  const predWithPoints: { id: number; home_score: number; away_score: number; display_name: string; points: number; category: Category }[] = (predictions || []).map((pred) => {
    const profile = pred.profiles as { display_name: string }
    if (!result) {
      return {
        id: pred.id,
        home_score: pred.home_score,
        away_score: pred.away_score,
        display_name: profile.display_name,
        points: 0,
        category: 'pending' as Category,
      }
    }

    const { points, category } = calculateMatchPoints(
      pred.home_score,
      pred.away_score,
      result.home_score,
      result.away_score
    )

    return {
      id: pred.id,
      home_score: pred.home_score,
      away_score: pred.away_score,
      display_name: profile.display_name,
      points,
      category: category as Category,
    }
  })

  // Sort by points desc
  predWithPoints.sort((a, b) => b.points - a.points)

  const categoryColors = {
    exact: 'text-green-400',
    goal_diff: 'text-green-400',
    result: 'text-yellow-400',
    wrong: 'text-red-400',
    pending: 'text-gray-400',
  }

  const categoryBg = {
    exact: 'bg-green-400/10',
    goal_diff: 'bg-green-400/5',
    result: 'bg-yellow-400/5',
    wrong: '',
    pending: '',
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-center gap-4 mb-2">
          <span className="text-lg font-bold">{match.home_team.name}</span>
          {result ? (
            <span className="text-2xl font-bold text-cb-gold">
              {result.home_score} - {result.away_score}
            </span>
          ) : (
            <span className="text-xl text-gray-500">vs</span>
          )}
          <span className="text-lg font-bold">{match.away_team.name}</span>
        </div>
        <p className="text-center text-xs text-gray-500">
          {match.is_cup_final
            ? 'Bekerfinale'
            : `Speeldag ${match.speeldag}`}
          {match.match_datetime &&
            ` — ${new Date(match.match_datetime).toLocaleDateString('nl-BE', { dateStyle: 'long' })}`}
        </p>
      </div>

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Alle voorspellingen
      </h2>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {predWithPoints.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              Nog geen voorspellingen
            </div>
          ) : (
            predWithPoints.map((pred) => (
              <div
                key={pred.id}
                className={`flex items-center justify-between px-4 py-3 ${categoryBg[pred.category]}`}
              >
                <span className="text-sm font-medium flex-1">{pred.display_name}</span>
                <span className="text-sm text-gray-300 w-16 text-center">
                  {pred.home_score} - {pred.away_score}
                </span>
                <span className={`text-sm font-bold w-12 text-right ${categoryColors[pred.category]}`}>
                  {result ? pred.points : '—'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
