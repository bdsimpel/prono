"use client";

import FlameIcon from "./FlameIcon";
import InfoPopover from "./InfoPopover";
import type { Streak } from "@/lib/streaks";

const FLAME_PATH = "M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z";

interface StreakDetailProps {
  label: string;
  streak: Streak;
  isLive?: boolean;
  baseStreak?: Streak;
}

export default function StreakDetail({ label, streak, isLive, baseStreak }: StreakDetailProps) {
  const exact = streak.matches.filter((m) => m.category === "exact").length;
  const goalDiff = streak.matches.filter((m) => m.category === "goal_diff").length;
  const result = streak.matches.filter((m) => m.category === "result").length;

  const baseExact = baseStreak ? baseStreak.matches.filter((m) => m.category === "exact").length : exact;
  const baseGoalDiff = baseStreak ? baseStreak.matches.filter((m) => m.category === "goal_diff").length : goalDiff;
  const baseResult = baseStreak ? baseStreak.matches.filter((m) => m.category === "result").length : result;

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em]">
          {label}
        </div>
        {streak.length > 0 && (
          <InfoPopover>
            <p className="text-[10px] text-gray-500 mb-2">
              Opeenvolgend punten gescoord
            </p>
            {/* Flame legend */}
            <div className="space-y-1 mb-2.5">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#C9A84C" className="shrink-0">
                  <path fillRule="evenodd" d={FLAME_PATH} clipRule="evenodd" />
                </svg>
                <span className="text-[11px] text-gray-300">Reeks &ge; 5</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#005a94" className="shrink-0">
                  <path fillRule="evenodd" d={FLAME_PATH} clipRule="evenodd" />
                </svg>
                <span className="text-[11px] text-gray-300">Reeks &lt; 5</span>
              </div>
            </div>
            {/* Category breakdown */}
            <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full bg-cb-gold/20 text-cb-gold text-[10px] font-bold flex items-center justify-center shrink-0 ${isLive && exact !== baseExact ? 'ring-1 ring-red-500/60' : ''}`}>
                  {exact}
                </span>
                <span className="text-[11px] text-gray-300">Exact</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full bg-cb-blue/20 text-cb-blue text-[10px] font-bold flex items-center justify-center shrink-0 ${isLive && goalDiff !== baseGoalDiff ? 'ring-1 ring-red-500/60' : ''}`}>
                  {goalDiff}
                </span>
                <span className="text-[11px] text-gray-300">Goal verschil</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 ${isLive && result !== baseResult ? 'ring-1 ring-red-500/60' : ''}`}>
                  {result}
                </span>
                <span className="text-[11px] text-gray-300">Juist resultaat</span>
              </div>
            </div>
          </InfoPopover>
        )}
      </div>
      <div className="flex items-center gap-1">
        {streak.length > 0 ? (
          <>
            <FlameIcon matches={streak.matches} />
            <span className={`heading-display text-2xl ${isLive ? 'text-red-400' : 'text-white'}`}>
              {streak.length}
            </span>
          </>
        ) : (
          <span className={`heading-display text-2xl ${isLive ? 'text-red-400' : 'text-gray-600'}`}>0</span>
        )}
      </div>
    </div>
  );
}
