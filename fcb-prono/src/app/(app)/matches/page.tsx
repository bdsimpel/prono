import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MatchesPage() {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*),
      results(*)
    `)
    .order('speeldag', { ascending: true })
    .order('match_datetime', { ascending: true })

  // Group by speeldag
  const grouped: Record<string, typeof matches> = {}
  for (const m of matches || []) {
    const key = m.is_cup_final ? 'Bekerfinale' : `Speeldag ${m.speeldag}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">WEDSTRIJDEN</h1>

      <div className="space-y-8">
        {Object.entries(grouped).map(([label, groupMatches]) => {
          const firstMatch = groupMatches![0]
          const dateStr = firstMatch?.match_datetime
            ? new Date(firstMatch.match_datetime).toLocaleDateString('nl-BE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : ''

          return (
            <div key={label}>
              <h2 className="text-sm font-semibold text-cb-gold uppercase tracking-wide mb-1">
                {label}
              </h2>
              {dateStr && (
                <p className="text-xs text-gray-500 mb-3">{dateStr}</p>
              )}
              <div className="space-y-2">
                {groupMatches!.map((match) => {
                  const result = match.results?.[0]
                  const hasResult = !!result

                  return (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="bg-card rounded-lg border border-border p-3 flex items-center gap-3 hover:bg-card-hover transition-colors"
                    >
                      <span className="flex-1 text-right text-sm font-medium truncate">
                        {match.home_team.name}
                      </span>
                      {hasResult ? (
                        <span className="text-sm font-bold text-white min-w-[50px] text-center">
                          {result.home_score} - {result.away_score}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500 min-w-[50px] text-center">
                          - - -
                        </span>
                      )}
                      <span className="flex-1 text-left text-sm font-medium truncate">
                        {match.away_team.name}
                      </span>
                      <span className="text-xs">
                        {hasResult ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-gray-500">⏳</span>
                        )}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
