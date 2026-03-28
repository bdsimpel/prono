'use client'

import type { LiveScore } from '@/lib/live-scores'
import { formatLiveStatus } from '@/lib/live-scores'

export default function LiveMatchBadge({ score }: { score: LiveScore }) {
  const { label, isLive } = formatLiveStatus(score)

  if (!label) return null

  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
        <span className="text-[10px] text-red-400 font-bold tabular-nums">{label}</span>
      </span>
    )
  }

  // Finished but no DB result yet
  return (
    <span className="text-[10px] text-gray-400 font-bold uppercase">{label}</span>
  )
}
