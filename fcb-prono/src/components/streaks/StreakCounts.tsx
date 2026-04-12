import type { MatchResult } from '@/lib/streaks'

interface StreakCountsProps {
  matches: MatchResult[]
  baseMatches?: MatchResult[]
}

export default function StreakCounts({ matches, baseMatches }: StreakCountsProps) {
  const exact = matches.filter((m) => m.category === 'exact').length
  const goalDiff = matches.filter((m) => m.category === 'goal_diff').length
  const result = matches.filter((m) => m.category === 'result').length

  const baseExact = baseMatches ? baseMatches.filter((m) => m.category === 'exact').length : exact
  const baseGoalDiff = baseMatches ? baseMatches.filter((m) => m.category === 'goal_diff').length : goalDiff
  const baseResult = baseMatches ? baseMatches.filter((m) => m.category === 'result').length : result

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-6 h-6 rounded-full bg-cb-gold/20 text-cb-gold text-[11px] font-bold flex items-center justify-center shrink-0 ${exact !== baseExact ? 'ring-1 ring-red-500/60' : ''}`}>
        {exact}
      </span>
      <span className={`w-6 h-6 rounded-full bg-cb-blue/20 text-cb-blue text-[11px] font-bold flex items-center justify-center shrink-0 ${goalDiff !== baseGoalDiff ? 'ring-1 ring-red-500/60' : ''}`}>
        {goalDiff}
      </span>
      <span className={`w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[11px] font-bold flex items-center justify-center shrink-0 ${result !== baseResult ? 'ring-1 ring-red-500/60' : ''}`}>
        {result}
      </span>
    </div>
  )
}
