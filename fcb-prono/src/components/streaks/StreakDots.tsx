import type { MatchResult } from '@/lib/streaks'

const categoryColors: Record<string, string> = {
  exact: 'bg-cb-gold',
  goal_diff: 'bg-cb-blue',
  result: 'bg-cb-blue/60',
  wrong: 'bg-gray-600',
}

interface StreakDotsProps {
  matches: MatchResult[]
  max?: number
}

export default function StreakDots({ matches, max = 10 }: StreakDotsProps) {
  if (matches.length === 0) return null

  const truncated = matches.length > max
  const visible = truncated ? matches.slice(-max) : matches

  return (
    <div className="flex items-center gap-1">
      {truncated && (
        <span className="text-[10px] text-gray-500 font-medium mr-0.5">
          {matches.length}
        </span>
      )}
      {visible.map((m, i) => (
        <span
          key={`${m.matchId}-${i}`}
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${categoryColors[m.category] ?? 'bg-gray-600'}`}
          title={
            m.category === 'exact'
              ? 'Exact'
              : m.category === 'goal_diff'
                ? 'Goal verschil'
                : m.category === 'result'
                  ? 'Juist resultaat'
                  : 'Fout'
          }
        />
      ))}
    </div>
  )
}
