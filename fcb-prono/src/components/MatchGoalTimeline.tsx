export interface GoalEvent {
  playerName: string
  assistName: string | null
  minute: number
  extraMinute: number | null
  detail: string // 'Normal Goal' | 'Penalty' | 'Own Goal'
  teamId: number
  seq: number
  teamName?: string // API-Football team name, used for live event team matching
}

interface Props {
  homeGoals: GoalEvent[]
  awayGoals: GoalEvent[]
}

function formatMinute(minute: number, extra: number | null): string {
  if (extra) return `${minute}+${extra}'`
  return `${minute}'`
}

function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  // Detect surname prefixes (Dutch/Belgian: van, de, van der, etc.)
  const prefixes = new Set(['van', 'de', 'den', 'der', 'het', 'ten', 'ter', 'le', 'la', 'el', 'al', 'di', 'du', 'von'])
  // Find where the surname starts (first prefix or last word)
  let surnameStart = parts.length - 1
  for (let i = 1; i < parts.length - 1; i++) {
    if (prefixes.has(parts[i].toLowerCase())) {
      surnameStart = i
      break
    }
  }
  const initials = parts.slice(0, surnameStart).map(p => p[0] + '.').join(' ')
  const surname = parts.slice(surnameStart).join(' ')
  return initials ? `${initials} ${surname}` : surname
}

function getSuffix(detail: string): string {
  if (detail === 'Penalty') return ' (pen.)'
  if (detail === 'Own Goal') return ' (e.d.)'
  return ''
}

function BallIcon() {
  return (
    <svg className="w-3 h-3 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.93 17.12L16.13 15.76L17.59 11.39L19 10.92L20 11.67C20 11.7 20 11.75 20 11.81C20 11.88 20.03 11.94 20.03 12C20.03 13.97 19.37 15.71 18.06 17.21L16.93 17.12M9.75 15L8.38 10.97L12 8.43L15.62 10.97L14.25 15H9.75M12 20.03C11.12 20.03 10.29 19.89 9.5 19.61L8.81 18.1L9.47 17H14.58L15.19 18.1L14.5 19.61C13.71 19.89 12.88 20.03 12 20.03M5.94 17.21C5.41 16.59 4.95 15.76 4.56 14.75C4.17 13.73 3.97 12.81 3.97 12C3.97 11.94 4 11.88 4 11.81C4 11.75 4 11.7 4 11.67L5 10.92L6.41 11.39L7.87 15.76L7.07 17.12L5.94 17.21M11 5.29V6.69L7 9.46L5.66 9.04L5.24 7.68C5.68 7 6.33 6.32 7.19 5.66S8.87 4.57 9.65 4.35L11 5.29M14.35 4.35C15.13 4.57 15.95 5 16.81 5.66C17.67 6.32 18.32 7 18.76 7.68L18.34 9.04L17 9.47L13 6.7V5.29L14.35 4.35M4.93 4.93C3 6.89 2 9.25 2 12S3 17.11 4.93 19.07 9.25 22 12 22 17.11 21 19.07 19.07 22 14.75 22 12 21 6.89 19.07 4.93 14.75 2 12 2 6.89 3 4.93 4.93Z" />
    </svg>
  )
}

function GoalRow({ goal, side }: { goal: GoalEvent; side: 'home' | 'away' }) {
  const suffix = getSuffix(goal.detail)
  const minuteStr = formatMinute(goal.minute, goal.extraMinute)

  const nameAndMinute = (
    <>
      <span className="text-xs text-white">{abbreviateName(goal.playerName)}</span>
      <span className="text-[10px] text-gray-500 ml-1">{minuteStr}</span>
    </>
  )

  // Show assist or penalty/own goal tag below the player name
  const subtitle = goal.assistName
    ? <div className="text-[10px] text-gray-600 leading-tight">({abbreviateName(goal.assistName)})</div>
    : suffix
      ? <div className="text-[10px] text-gray-600 leading-tight">{suffix.trim()}</div>
      : null

  if (side === 'home') {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <div className="text-right min-w-0">
          <div className="truncate">{nameAndMinute}</div>
          {subtitle}
        </div>
        <BallIcon />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <BallIcon />
      <div className="min-w-0">
        <div className="truncate">{nameAndMinute}</div>
        {subtitle}
      </div>
    </div>
  )
}

export default function MatchGoalTimeline({ homeGoals, awayGoals }: Props) {
  if (homeGoals.length === 0 && awayGoals.length === 0) return null

  // Merge and sort all goals by minute for a unified timeline
  const allGoals = [
    ...homeGoals.map(g => ({ ...g, side: 'home' as const })),
    ...awayGoals.map(g => ({ ...g, side: 'away' as const })),
  ].sort((a, b) => a.minute - b.minute || (a.extraMinute ?? 0) - (b.extraMinute ?? 0))

  return (
    <div className="mt-3 mb-1">
      <div className="relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />

        <div className="space-y-1">
          {allGoals.map((goal, i) => (
            <div key={`${goal.side}-${goal.seq}-${i}`} className="flex">
              {goal.side === 'home' ? (
                <>
                  <div className="w-1/2 pr-3 py-0.5">
                    <GoalRow goal={goal} side="home" />
                  </div>
                  <div className="w-1/2" />
                </>
              ) : (
                <>
                  <div className="w-1/2" />
                  <div className="w-1/2 pl-3 py-0.5">
                    <GoalRow goal={goal} side="away" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
