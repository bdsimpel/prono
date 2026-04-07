'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Category = 'exact' | 'goal_diff' | 'result' | 'wrong' | 'pending'

interface PredictionRow {
  id: number
  home_score: number
  away_score: number
  display_name: string
  user_id: string
  points: number
  category: Category
}

function getCategoryBadge(category: string) {
  switch (category) {
    case 'exact':
      return <span className="text-xs px-2.5 py-1 rounded border border-cb-gold/40 text-cb-gold">Exact</span>
    case 'goal_diff':
      return <span className="text-xs px-2.5 py-1 rounded border border-cb-blue/30 text-cb-blue">Goal verschil</span>
    case 'result':
      return <span className="text-xs px-2.5 py-1 rounded border border-cb-blue/25 text-cb-blue/80">Juist resultaat</span>
    case 'wrong':
      return <span className="text-xs px-2.5 py-1 rounded border border-white/10 text-gray-500">Fout</span>
    default:
      return <span className="text-xs px-2.5 py-1 rounded border border-white/10 text-gray-600">Afwachting</span>
  }
}

function getCategoryPointColor(category: string) {
  switch (category) {
    case 'exact': return 'text-cb-gold'
    case 'goal_diff': return 'text-cb-blue'
    case 'result': return 'text-cb-blue/80'
    case 'wrong': return 'text-gray-500'
    default: return 'text-gray-600'
  }
}

interface Props {
  predictions: PredictionRow[]
  resultHome: number
  resultAway: number
  shouldHide: boolean
}

export default function MatchPredictionList({ predictions, resultHome, resultAway, shouldHide }: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return predictions
    const q = search.toLowerCase()
    return predictions.filter(p => p.display_name.toLowerCase().includes(q))
  }, [predictions, search])

  return (
    <>
      {predictions.length > 10 && (
        <div className="mb-3 max-w-xs">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek deelnemer..."
              className="w-full px-4 py-2 pr-8 bg-cb-dark border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue transition-colors placeholder:text-gray-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="glass-card-subtle p-12 text-center text-gray-600 text-sm">
            {search ? 'Geen resultaten gevonden.' : 'Nog geen voorspellingen voor deze wedstrijd.'}
          </div>
        ) : (
          filtered.map((pred) => (
            <Link key={pred.id} href={`/player/${pred.user_id}`} className="block">
              <div className="glass-card-subtle p-3 md:p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between gap-2 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 font-medium truncate">
                      {pred.display_name}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>
                        <span className="text-gray-500">Prono: </span>
                        <span className="text-gray-300 font-bold">
                          {shouldHide ? (
                            <span className="blur-sm select-none">?-?</span>
                          ) : (
                            <>{pred.home_score}-{pred.away_score}</>
                          )}
                        </span>
                      </span>
                      <span>
                        <span className="text-gray-500">Uitslag: </span>
                        <span className="text-gray-300 font-bold">
                          {resultHome}-{resultAway}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                    {getCategoryBadge(pred.category)}
                    <span className={`heading-display text-lg w-10 text-right ${getCategoryPointColor(pred.category)}`}>
                      +{pred.points}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
