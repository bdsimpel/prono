"use client";

import { useMemo, useState } from "react";
import { computeAllStreaks, type Streak, type PlayerStreakData } from "@/lib/streaks";
import PlayerStreakCard from "@/components/streaks/PlayerStreakCard";
import InfoPopover from "@/components/streaks/InfoPopover";
import type { Match, Result, Prediction, Team } from "@/lib/types";

const DEFAULT_CAP = 20;
const FLAME_PATH = "M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z";

function StatsLegend() {
  return (
    <InfoPopover>
      <p className="text-[10px] text-gray-500 mb-1.5">Opeenvolgend punten gescoord</p>
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
      <div className="pt-2 border-t border-white/[0.06] space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-cb-gold/20 text-cb-gold text-[9px] font-bold flex items-center justify-center shrink-0">N</span>
          <span className="text-[11px] text-gray-300">Exact</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-cb-blue/20 text-cb-blue text-[9px] font-bold flex items-center justify-center shrink-0">N</span>
          <span className="text-[11px] text-gray-300">Goal verschil</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0">N</span>
          <span className="text-[11px] text-gray-300">Juist resultaat</span>
        </div>
      </div>
    </InfoPopover>
  );
}

function countCategory(streak: Streak, cat: string) {
  return streak.matches.filter((m) => m.category === cat).length;
}

function sortByStreak(
  data: PlayerStreakData[],
  getStreak: (s: PlayerStreakData) => Streak,
) {
  return [...data].sort((a, b) => {
    const sa = getStreak(a);
    const sb = getStreak(b);
    if (sb.length !== sa.length) return sb.length - sa.length;
    const exactDiff = countCategory(sb, "exact") - countCategory(sa, "exact");
    if (exactDiff !== 0) return exactDiff;
    const gdDiff = countCategory(sb, "goal_diff") - countCategory(sa, "goal_diff");
    if (gdDiff !== 0) return gdDiff;
    const resDiff = countCategory(sb, "result") - countCategory(sa, "result");
    if (resDiff !== 0) return resDiff;
    return a.displayName.localeCompare(b.displayName, "nl");
  });
}

interface PlayerRow {
  id: string;
  display_name: string;
  [key: string]: unknown;
}

interface ReeksenTabProps {
  players: PlayerRow[];
  matches: (Match & { home_team: Team; away_team: Team })[];
  results: Result[];
  predictions: Prediction[];
}

export default function ReeksenTab({
  players,
  matches,
  results,
  predictions,
}: ReeksenTabProps) {
  const [search, setSearch] = useState("");

  const streakData = useMemo(
    () => computeAllStreaks(predictions, results, matches, players),
    [predictions, results, matches, players],
  );

  const query = search.toLowerCase().trim();

  const activeStreaks = useMemo(() => {
    const sorted = sortByStreak(streakData, (s) => s.currentStreak);
    if (!query) return sorted;
    return sorted.filter((s) => s.displayName.toLowerCase().includes(query));
  }, [streakData, query]);

  const longestStreaks = useMemo(() => {
    const sorted = sortByStreak(streakData, (s) => s.longestStreak);
    if (!query) return sorted;
    return sorted.filter((s) => s.displayName.toLowerCase().includes(query));
  }, [streakData, query]);

  // Show top DEFAULT_CAP, but include all ties at the cutoff streak length
  const capList = (list: typeof streakData, getStreak: (s: typeof streakData[number]) => Streak) => {
    if (list.length === 0) return list;
    // Filter out zero-streaks
    const nonZero = list.filter((s) => getStreak(s).length > 0);
    if (nonZero.length <= DEFAULT_CAP) return nonZero;
    const cutoffLength = getStreak(nonZero[DEFAULT_CAP - 1]).length;
    let end = DEFAULT_CAP;
    while (end < nonZero.length && getStreak(nonZero[end]).length === cutoffLength) end++;
    return nonZero.slice(0, end);
  };

  const visibleActive = query
    ? activeStreaks
    : capList(activeStreaks, (s) => s.currentStreak);
  const visibleLongest = query
    ? longestStreaks
    : capList(longestStreaks, (s) => s.longestStreak);
  return (
    <div className="space-y-8">
      {/* Search */}
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
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Leaderboards side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Active streaks */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 bg-cb-gold rounded-full" />
            <h3 className="heading-display text-lg text-white flex-1">
              ACTIEVE REEKSEN
            </h3>
            <StatsLegend />
          </div>
          <div className="glass-card-subtle p-2 md:p-4">
            {visibleActive.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {visibleActive.map((s, i) => (
                  <PlayerStreakCard
                    key={s.userId}
                    rank={i + 1}
                    userId={s.userId}
                    displayName={s.displayName}
                    streak={s.currentStreak}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-600 text-sm py-8">
                {query ? "Geen resultaten" : "Geen actieve reeksen"}
              </p>
            )}
          </div>
        </div>

        {/* Longest streaks ever */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 bg-cb-blue rounded-full" />
            <h3 className="heading-display text-lg text-white flex-1">
              LANGSTE REEKSEN OOIT
            </h3>
            <StatsLegend />
          </div>
          <div className="glass-card-subtle p-2 md:p-4">
            {visibleLongest.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {visibleLongest.map((s, i) => (
                  <PlayerStreakCard
                    key={s.userId}
                    rank={i + 1}
                    userId={s.userId}
                    displayName={s.displayName}
                    streak={s.longestStreak}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-600 text-sm py-8">
                {query ? "Geen resultaten" : "Nog geen reeksen"}
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
