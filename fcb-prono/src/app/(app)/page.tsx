import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function KlassementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, paid')
    .neq('first_name', '')

  // Get all scores
  const { data: scores } = await supabase
    .from('player_scores')
    .select('*')

  // Build scores map
  const scoreMap: Record<string, typeof scores extends (infer T)[] | null ? T : never> = {}
  for (const s of scores || []) {
    scoreMap[s.user_id] = s
  }

  // Merge profiles with scores (show everyone, even 0)
  const allPlayers = (profiles || []).map((p) => ({
    user_id: p.id,
    display_name: p.display_name,
    paid: p.paid,
    total_score: scoreMap[p.id]?.total_score ?? 0,
    match_score: scoreMap[p.id]?.match_score ?? 0,
    extra_score: scoreMap[p.id]?.extra_score ?? 0,
    exact_matches: scoreMap[p.id]?.exact_matches ?? 0,
    correct_goal_diffs: scoreMap[p.id]?.correct_goal_diffs ?? 0,
    correct_results: scoreMap[p.id]?.correct_results ?? 0,
  }))

  // Sort by score desc, then name
  allPlayers.sort((a, b) => b.total_score - a.total_score || a.display_name.localeCompare(b.display_name))

  // Assign ranks
  let currentRank = 0
  let previousScore = -1
  const standings = allPlayers.map((row, index) => {
    if (row.total_score !== previousScore) {
      currentRank = index + 1
    }
    previousScore = row.total_score
    return { ...row, rank: currentRank }
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">KLASSEMENT</h1>

      {standings.length === 0 ? (
        <div className="bg-card rounded-xl p-8 border border-border text-center text-gray-400">
          Nog geen spelers geregistreerd.
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Naam</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">E</th>
                  <th className="px-4 py-3 text-right">GD</th>
                  <th className="px-4 py-3 text-right">JR</th>
                  <th className="px-4 py-3 text-right">Match</th>
                  <th className="px-4 py-3 text-right">Extra</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const isCurrentUser = row.user_id === user?.id
                  return (
                    <tr
                      key={row.user_id}
                      className={`border-b border-border/50 hover:bg-card-hover transition-colors ${
                        isCurrentUser ? 'bg-cb-blue/10 border-l-2 border-l-cb-blue' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-400">
                        {row.rank}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/player/${row.user_id}`}
                          className="text-sm font-medium hover:text-cb-gold transition-colors"
                        >
                          {row.display_name}
                          {!row.paid && <span className="text-cb-gold ml-1">*</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-cb-gold">
                        {row.total_score}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-400">
                        {row.exact_matches}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-400">
                        {row.correct_goal_diffs}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-400">
                        {row.correct_results}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-400">
                        {row.match_score}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-400">
                        {row.extra_score}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden divide-y divide-border/50">
            {standings.map((row) => {
              const isCurrentUser = row.user_id === user?.id
              return (
                <Link
                  key={row.user_id}
                  href={`/player/${row.user_id}`}
                  className={`flex items-center justify-between px-4 py-3 ${
                    isCurrentUser ? 'bg-cb-blue/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-6">
                      {row.rank}
                    </span>
                    <span className="text-sm font-medium">
                      {row.display_name}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-cb-gold">
                    {row.total_score}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        E = Exact | GD = Juist doelpuntenverschil | JR = Juist resultaat
      </div>
    </div>
  )
}
