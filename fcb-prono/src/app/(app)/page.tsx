import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function KlassementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: scores } = await supabase
    .from('player_scores')
    .select(`
      *,
      profiles!inner(display_name, paid)
    `)
    .order('total_score', { ascending: false })

  // Build standings with rank
  let currentRank = 0
  let previousScore = -1
  const standings = (scores || []).map((row, index) => {
    if (row.total_score !== previousScore) {
      currentRank = index + 1
    }
    previousScore = row.total_score
    return {
      ...row,
      rank: currentRank,
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">KLASSEMENT</h1>

      {standings.length === 0 ? (
        <div className="bg-card rounded-xl p-8 border border-border text-center text-gray-400">
          Nog geen scores berekend. Wacht tot de admin de scores herberekent.
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
                  const profile = row.profiles as { display_name: string; paid: boolean }
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
                          {profile.display_name}
                          {!profile.paid && <span className="text-cb-gold ml-1">*</span>}
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
              const profile = row.profiles as { display_name: string; paid: boolean }
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
                      {profile.display_name}
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
