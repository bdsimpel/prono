import Link from 'next/link'
import FlameIcon from './FlameIcon'
import StreakCounts from './StreakCounts'
import type { Streak } from '@/lib/streaks'

interface PlayerStreakCardProps {
  rank: number
  userId: string
  displayName: string
  streak: Streak
}

export default function PlayerStreakCard({
  rank,
  userId,
  displayName,
  streak,
}: PlayerStreakCardProps) {
  const hasStreak = streak.length > 0

  return (
    <div className="flex items-center gap-2 md:gap-3 py-2.5 px-2 md:px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
      <span className="heading-display text-lg text-gray-500 w-8 text-right shrink-0">
        {rank}
      </span>
      <Link
        href={`/player/${userId}`}
        className="text-sm text-gray-200 hover:text-white transition-colors truncate min-w-0 flex-1"
      >
        {displayName}
      </Link>
      {hasStreak ? (
        <div className="flex items-center gap-2 shrink-0">
          <StreakCounts matches={streak.matches} />
          <div className="flex items-center gap-0.5">
            <FlameIcon matches={streak.matches} />
            <span className="heading-display text-lg text-white">
              {streak.length}
            </span>
          </div>
        </div>
      ) : (
        <span className="text-sm text-gray-600 shrink-0">—</span>
      )}
    </div>
  )
}
