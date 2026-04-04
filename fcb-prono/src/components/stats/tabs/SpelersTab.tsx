"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import LineChart from "../charts/LineChart";
import type { LineSeries } from "../charts/LineChart";
import { calculateMatchPoints } from "@/lib/scoring";
import type {
  Team,
  Match,
  Result,
  Prediction,
  PlayerScore,
  Edition,
  EditionScore,
} from "@/lib/types";

interface PlayerRow {
  id: string;
  display_name: string;
  favorite_team: string | null;
  matched_historical_name?: string;
  [key: string]: unknown;
}

interface SpelersTabProps {
  players: PlayerRow[];
  playerScores: PlayerScore[];
  matches: (Match & { home_team: Team; away_team: Team })[];
  results: Result[];
  predictions: Prediction[];
  editions: Edition[];
  editionScores: EditionScore[];
}

const PLAYER_COLORS = [
  "#005a94",  // CB blue
  "#C9A84C",  // CB gold
  "#14b8a6",  // teal
  "#f59e0b",  // amber
  "#64748b",  // slate
  "#0d9488",  // dark teal
];

const VIEW_OPTIONS = [
  { key: "speeldag", label: "Per speeldag" },
  { key: "wedstrijd", label: "Per wedstrijd" },
  { key: "historisch", label: "Historisch" },
] as const;

const METRIC_OPTIONS = [
  { key: "punten", label: "Punten" },
  { key: "ranking", label: "Ranking" },
  { key: "zscore", label: "Z-score" },
] as const;

type ViewKey = (typeof VIEW_OPTIONS)[number]["key"];
type MetricKey = (typeof METRIC_OPTIONS)[number]["key"];

export default function SpelersTab({
  players,
  playerScores,
  matches,
  results,
  predictions,
  editions,
  editionScores,
}: SpelersTabProps) {
  // DEV: generate mock results if none exist so charts have data to display
  const effectiveResults = useMemo(() => {
    if (results.length > 0) return results;
    if (process.env.NODE_ENV !== "development") return [];
    return matches.slice(0, 9).map((m, i) => ({
      id: 9000 + i,
      match_id: m.id,
      home_score: Math.floor(Math.random() * 4),
      away_score: Math.floor(Math.random() * 3),
      entered_at: new Date().toISOString(),
    }));
  }, [results, matches]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showAverage, setShowAverage] = useState(false);
  const [cumulative, setCumulative] = useState(false);
  const [metric, setMetric] = useState<MetricKey>("punten");
  const [view, setView] = useState<ViewKey>("speeldag");
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [metricDropdownOpen, setMetricDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const metricDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target as Node)) {
        setViewDropdownOpen(false);
      }
      if (metricDropdownRef.current && !metricDropdownRef.current.contains(e.target as Node)) {
        setMetricDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sorted players for search
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [players]
  );

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sortedPlayers;
    return sortedPlayers.filter((p) => p.display_name.toLowerCase().includes(q));
  }, [sortedPlayers, searchQuery]);

  // Result lookup
  const resultMap = useMemo(() => {
    const map = new Map<number, Result>();
    for (const r of effectiveResults) map.set(r.match_id, r);
    return map;
  }, [effectiveResults]);

  // Match lookup
  const matchMap = useMemo(() => {
    const map = new Map<number, (typeof matches)[number]>();
    for (const m of matches) map.set(m.id, m);
    return map;
  }, [matches]);

  // Compute per-player per-match points
  const playerMatchPoints = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    for (const pred of predictions) {
      const result = resultMap.get(pred.match_id);
      if (!result) continue;
      const { points } = calculateMatchPoints(
        pred.home_score, pred.away_score,
        result.home_score, result.away_score
      );
      if (!map.has(pred.user_id)) map.set(pred.user_id, new Map());
      map.get(pred.user_id)!.set(pred.match_id, points);
    }
    return map;
  }, [predictions, resultMap]);

  // Matches with results, sorted by datetime
  const playedMatches = useMemo(
    () => matches
      .filter((m) => resultMap.has(m.id))
      .sort((a, b) => {
        const da = a.match_datetime ? new Date(a.match_datetime).getTime() : 0;
        const db = b.match_datetime ? new Date(b.match_datetime).getTime() : 0;
        return da - db;
      }),
    [matches, resultMap]
  );

  // Speeldagen with results
  const speeldagen = useMemo(() => {
    const sdMap = new Map<string, { label: string; sortKey: number; matchIds: number[] }>();
    for (const m of playedMatches) {
      const key = m.is_cup_final ? "beker" : `sd-${m.speeldag}`;
      const label = m.is_cup_final ? "Beker" : `SD${m.speeldag}`;
      const sortKey = m.is_cup_final ? 99 : (m.speeldag ?? 0);
      if (!sdMap.has(key)) sdMap.set(key, { label, sortKey, matchIds: [] });
      sdMap.get(key)!.matchIds.push(m.id);
    }
    return [...sdMap.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [playedMatches]);

  // Time points: either speeldagen or individual matches
  const timePoints = useMemo(() => {
    if (view === "speeldag") {
      return speeldagen.map((sd) => ({ matchIds: sd.matchIds }));
    }
    return playedMatches.map((m) => ({ matchIds: [m.id] }));
  }, [view, speeldagen, playedMatches]);

  // Compute cumulative totals for ALL players at each time point (needed for ranking)
  const allPlayerCumulatives = useMemo(() => {
    const result = new Map<string, number[]>();
    for (const p of players) {
      const pPoints = playerMatchPoints.get(p.id);
      let total = 0;
      const values: number[] = [];
      for (const tp of timePoints) {
        const pts = tp.matchIds.reduce((sum, mid) => sum + (pPoints?.get(mid) ?? 0), 0);
        total += pts;
        values.push(total);
      }
      result.set(p.id, values);
    }
    return result;
  }, [players, playerMatchPoints, timePoints]);

  // Compute ranks at each time point
  const ranksAtTimePoint = useMemo(() => {
    return timePoints.map((_, tIdx) => {
      const scores = players
        .map((p) => ({ id: p.id, total: allPlayerCumulatives.get(p.id)?.[tIdx] ?? 0 }))
        .sort((a, b) => b.total - a.total);
      const ranks = new Map<string, number>();
      let rank = 0;
      let prevScore = -1;
      scores.forEach((s, i) => {
        if (s.total !== prevScore) rank = i + 1;
        prevScore = s.total;
        ranks.set(s.id, rank);
      });
      return ranks;
    });
  }, [players, allPlayerCumulatives, timePoints]);

  // Build chart series
  const chartSeries: LineSeries[] = useMemo(() => {
    const allSeries: LineSeries[] = [];

    for (let si = 0; si < selectedIds.length; si++) {
      const pid = selectedIds[si];
      const pPoints = playerMatchPoints.get(pid);
      const player = players.find((p) => p.id === pid);
      if (!pPoints || !player) continue;

      if (metric === "ranking") {
        // Rank mode: show rank at each time point
        const data = timePoints.map((_, i) => ({
          x: i,
          y: ranksAtTimePoint[i]?.get(pid) ?? players.length,
        }));
        allSeries.push({
          label: player.display_name,
          color: PLAYER_COLORS[si % PLAYER_COLORS.length],
          data,
        });
      } else {
        // Points mode
        let runningTotal = 0;
        const data = timePoints.map((tp, i) => {
          const pts = tp.matchIds.reduce((sum, mid) => sum + (pPoints.get(mid) ?? 0), 0);
          runningTotal += pts;
          return { x: i, y: cumulative ? runningTotal : pts };
        });
        allSeries.push({
          label: player.display_name,
          color: PLAYER_COLORS[si % PLAYER_COLORS.length],
          data,
        });
      }
    }

    // Average line (only in points mode)
    if (showAverage && metric !== "ranking" && timePoints.length > 0) {
      const playerCount = players.length;
      let runningTotal = 0;
      const data = timePoints.map((tp, i) => {
        let totalPoints = 0;
        for (const [, pPoints] of playerMatchPoints) {
          for (const mid of tp.matchIds) {
            totalPoints += pPoints.get(mid) ?? 0;
          }
        }
        const avg = playerCount > 0 ? totalPoints / playerCount : 0;
        runningTotal += avg;
        return { x: i, y: cumulative ? runningTotal : Math.round(avg * 10) / 10 };
      });

      allSeries.push({
        label: "Gemiddelde",
        color: "#6b7280",
        data,
        dashed: true,
      });
    }

    return allSeries;
  }, [selectedIds, view, cumulative, showAverage, metric, playerMatchPoints, timePoints, ranksAtTimePoint, players]);

  // Historical data
  const sortedEditions = useMemo(
    () => [...editions].sort((a, b) => a.year - b.year),
    [editions]
  );

  const historicalSeries: LineSeries[] = useMemo(() => {
    if (view !== "historisch") return [];
    const allSeries: LineSeries[] = [];

    for (let si = 0; si < selectedIds.length; si++) {
      const pid = selectedIds[si];
      const player = players.find((p) => p.id === pid);
      if (!player) continue;

      // Match player name to historical editions
      const histName = player.matched_historical_name || player.display_name;

      const data: { x: number; y: number }[] = [];
      for (let ei = 0; ei < sortedEditions.length; ei++) {
        const edition = sortedEditions[ei];
        const score = editionScores.find(
          (es) => es.edition_id === edition.id &&
            es.player_name.toLowerCase() === histName.toLowerCase()
        );
        if (score) {
          let y: number;
          if (metric === "ranking") {
            y = edition.player_count > 0
              ? Math.round((score.rank / edition.player_count) * 100)
              : score.rank;
          } else if (metric === "zscore") {
            y = score.z_score != null
              ? Math.round(score.z_score * 100) / 100
              : 0;
          } else {
            y = score.total_score;
          }
          data.push({ x: ei, y });
        }
      }

      if (data.length > 0) {
        allSeries.push({
          label: player.display_name,
          color: PLAYER_COLORS[si % PLAYER_COLORS.length],
          data,
        });
      }
    }

    return allSeries;
  }, [view, selectedIds, players, sortedEditions, editionScores, metric]);

  const xLabels = view === "speeldag"
    ? speeldagen.map((sd) => sd.label)
    : view === "historisch"
      ? sortedEditions.map((e) => String(e.year))
      : playedMatches.map((_, i) => `G${i + 1}`);

  const activeSeries = view === "historisch" ? historicalSeries : chartSeries;

  // Head-to-head data (when exactly 2 players selected)
  const headToHead = useMemo(() => {
    if (selectedIds.length !== 2) return null;
    const [idA, idB] = selectedIds;
    const scoreA = playerScores.find((s) => s.user_id === idA);
    const scoreB = playerScores.find((s) => s.user_id === idB);
    const playerA = players.find((p) => p.id === idA);
    const playerB = players.find((p) => p.id === idB);
    if (!playerA || !playerB) return null;

    const pointsA = playerMatchPoints.get(idA);
    const pointsB = playerMatchPoints.get(idB);
    const matchesPlayed = playedMatches.length;

    const avgA = matchesPlayed > 0 ? ((pointsA ? [...pointsA.values()].reduce((a, b) => a + b, 0) : 0) / matchesPlayed) : 0;
    const avgB = matchesPlayed > 0 ? ((pointsB ? [...pointsB.values()].reduce((a, b) => a + b, 0) : 0) / matchesPlayed) : 0;

    // Per-speeldag comparison
    const sdComparison = speeldagen.map((sd) => {
      const ptsA = sd.matchIds.reduce((sum, mid) => sum + (pointsA?.get(mid) ?? 0), 0);
      const ptsB = sd.matchIds.reduce((sum, mid) => sum + (pointsB?.get(mid) ?? 0), 0);
      return { label: sd.label, a: ptsA, b: ptsB };
    });

    // Historical stats
    const histNameA = playerA.matched_historical_name || playerA.display_name;
    const histNameB = playerB.matched_historical_name || playerB.display_name;
    const histA = editionScores.filter((es) => es.player_name.toLowerCase() === histNameA.toLowerCase());
    const histB = editionScores.filter((es) => es.player_name.toLowerCase() === histNameB.toLowerCase());
    const editionsA = histA.length;
    const editionsB = histB.length;
    const bestRankA = histA.length > 0 ? Math.min(...histA.map((h) => h.rank)) : null;
    const bestRankB = histB.length > 0 ? Math.min(...histB.map((h) => h.rank)) : null;
    // All-time Z-score with correction (same as leaderboard: <3 years → ×years/3)
    function computeCorrectedZScore(hist: typeof histA) {
      const withZ = hist.filter((h) => h.z_score != null);
      if (withZ.length === 0) return null;
      const avgZ = withZ.reduce((sum, h) => sum + (h.z_score ?? 0), 0) / withZ.length;
      const factor = withZ.length >= 3 ? 1 : withZ.length / 3;
      return Math.round(avgZ * factor * 100) / 100;
    }
    const zScoreA = computeCorrectedZScore(histA);
    const zScoreB = computeCorrectedZScore(histB);

    const rows: { label: string; a: number | string; b: number | string }[] = [
      { label: "Totaal", a: scoreA?.total_score ?? 0, b: scoreB?.total_score ?? 0 },
      { label: "Wedstrijden", a: scoreA?.match_score ?? 0, b: scoreB?.match_score ?? 0 },
      { label: "Extra vragen", a: scoreA?.extra_score ?? 0, b: scoreB?.extra_score ?? 0 },
      { label: "Exacte scores", a: scoreA?.exact_matches ?? 0, b: scoreB?.exact_matches ?? 0 },
      { label: "Doelverschil", a: scoreA?.correct_goal_diffs ?? 0, b: scoreB?.correct_goal_diffs ?? 0 },
      { label: "Juist resultaat", a: scoreA?.correct_results ?? 0, b: scoreB?.correct_results ?? 0 },
      { label: "Gem. per wedstrijd", a: Math.round(avgA * 10) / 10, b: Math.round(avgB * 10) / 10 },
    ];

    // Add historical rows if any data exists
    if (editionsA > 0 || editionsB > 0) {
      rows.push({ label: "Edities", a: editionsA, b: editionsB });
      rows.push({ label: "Beste ranking", a: bestRankA != null ? `#${bestRankA}` : "—", b: bestRankB != null ? `#${bestRankB}` : "—" });
      rows.push({ label: "Gem. Z-score", a: zScoreA ?? "—", b: zScoreB ?? "—" });
    }

    return {
      playerA: playerA.display_name,
      playerB: playerB.display_name,
      rows,
      sdComparison,
    };
  }, [selectedIds, playerScores, players, playerMatchPoints, playedMatches, speeldagen, editionScores]);

  // Profiel data (when exactly 1 player selected)
  const profiel = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const pid = selectedIds[0];
    const score = playerScores.find((s) => s.user_id === pid);
    const player = players.find((p) => p.id === pid);
    if (!player) return null;
    const s = score ?? { total_score: 0, match_score: 0, extra_score: 0, exact_matches: 0, correct_goal_diffs: 0, correct_results: 0 };

    const pPoints = playerMatchPoints.get(pid);
    const matchesPlayed = playedMatches.length;
    const totalMatchPts = pPoints ? [...pPoints.values()].reduce((a, b) => a + b, 0) : 0;
    const avgPerMatch = matchesPlayed > 0 ? totalMatchPts / matchesPlayed : 0;

    // Rank
    const sorted = [...playerScores].sort((a, b) => b.total_score - a.total_score);
    let rank = 1;
    for (const ps of sorted) {
      if (ps.user_id === pid) break;
      if (ps.total_score > s.total_score) rank++;
    }

    // Category breakdown
    const totalCategorized = s.exact_matches + s.correct_goal_diffs + s.correct_results;
    const wrongCount = matchesPlayed > 0 ? matchesPlayed - totalCategorized : 0;

    // Average comparison
    const avgTotal = playerScores.length > 0
      ? playerScores.reduce((sum, s) => sum + s.total_score, 0) / playerScores.length
      : 0;

    // Best/worst speeldag
    let bestSd = { label: "—", pts: -1 };
    let worstSd = { label: "—", pts: Infinity };
    for (const sd of speeldagen) {
      const pts = sd.matchIds.reduce((sum, mid) => sum + (pPoints?.get(mid) ?? 0), 0);
      if (pts > bestSd.pts) bestSd = { label: sd.label, pts };
      if (pts < worstSd.pts) worstSd = { label: sd.label, pts };
    }

    return {
      name: player.display_name,
      rank,
      totalPlayers: players.length,
      totalScore: s.total_score,
      matchScore: s.match_score,
      extraScore: s.extra_score,
      avgPerMatch: Math.round(avgPerMatch * 10) / 10,
      avgTotal: Math.round(avgTotal * 10) / 10,
      exact: s.exact_matches,
      goalDiff: s.correct_goal_diffs,
      correctResult: s.correct_results,
      wrong: wrongCount,
      bestSd,
      worstSd,
    };
  }, [selectedIds, playerScores, players, playerMatchPoints, playedMatches, speeldagen]);

  // Toggle player selection
  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-1">Deelnemers</h3>
      <p className="text-xs text-gray-500 mb-4">
        Selecteer spelers om hun prestaties te vergelijken.
      </p>

      {/* Player selector */}
      <div className="mb-4">
        {/* Selected chips */}
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedIds.map((id, i) => {
            const player = players.find((p) => p.id === id);
            if (!player) return null;
            return (
              <button
                key={id}
                onClick={() => togglePlayer(id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white transition-colors hover:opacity-80"
                style={{ backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
              >
                <span
                  className="w-2 h-2 rounded-full bg-white/30"
                />
                {player.display_name}
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative" ref={searchRef}>
          <input
            type="text"
            placeholder="Zoek speler..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            className="w-full md:w-64 px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cb-blue transition-colors"
          />
          {searchOpen && searchQuery.trim() && filteredPlayers.length === 0 && (
            <div className="absolute top-full left-0 mt-1 z-20 w-full md:w-64 py-3 px-3 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
              <p className="text-sm text-gray-500">Geen resultaten</p>
            </div>
          )}
          {searchOpen && filteredPlayers.length > 0 && (
            <div className="absolute top-full left-0 mt-1 z-20 w-full md:w-64 max-h-48 overflow-y-auto py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
              {filteredPlayers.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                const colorIdx = selectedIds.indexOf(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      togglePlayer(p.id);
                      setSearchQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                      isSelected
                        ? "text-white bg-white/[0.06]"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <span>{p.display_name}</span>
                    {isSelected && (
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: PLAYER_COLORS[colorIdx % PLAYER_COLORS.length] }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dropdowns */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* View dropdown (always shown) */}
        <div className="relative" ref={viewDropdownRef}>
          <button
            onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cb-blue text-white"
          >
            {VIEW_OPTIONS.find((v) => v.key === view)?.label}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${viewDropdownOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {viewDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 min-w-full py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setView(opt.key);
                    setViewDropdownOpen(false);
                    if (opt.key !== "historisch" && metric === "zscore") {
                      setMetric("punten");
                    }
                  }}
                  className={`w-full text-left px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                    view === opt.key
                      ? "text-white bg-white/[0.06]"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Metric dropdown — only for chart views */}
        {(
        <div className="relative" ref={metricDropdownRef}>
          <button
            onClick={() => setMetricDropdownOpen(!metricDropdownOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cb-blue text-white"
          >
            {METRIC_OPTIONS.find((m) => m.key === metric)?.label}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${metricDropdownOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {metricDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 min-w-full py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
              {METRIC_OPTIONS.filter((opt) => opt.key !== "zscore" || view === "historisch").map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setMetric(opt.key);
                    setMetricDropdownOpen(false);
                    if (opt.key === "ranking") setCumulative(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                    metric === opt.key
                      ? "text-white bg-white/[0.06]"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Toggles — only for Punten mode, not historisch */}
      {metric === "punten" && view !== "historisch" && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setCumulative(!cumulative)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              cumulative
                ? "bg-white/[0.08] text-white border border-white/[0.15]"
                : "text-gray-400 hover:text-white border border-white/[0.08] hover:border-white/[0.15]"
            }`}
          >
            Cumulatief
          </button>
          <button
            onClick={() => setShowAverage(!showAverage)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showAverage
                ? "bg-white/[0.08] text-white border border-white/[0.15]"
                : "text-gray-400 hover:text-white border border-white/[0.08] hover:border-white/[0.15]"
            }`}
          >
            Gemiddelde
          </button>
        </div>
      )}

      {/* Content */}
      <div>
      {(
        <div className="glass-card-subtle p-4 md:p-5">
          {selectedIds.length === 0 && !showAverage ? (
            <div className="flex items-center justify-center py-12 text-center">
              <p className="text-sm text-gray-500">
                Selecteer deelnemers hierboven om te vergelijken.
              </p>
            </div>
          ) : xLabels.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-center">
              <p className="text-sm text-gray-500">
                {view === "historisch" ? "Geen historische data beschikbaar." : "Nog geen resultaten gespeeld."}
              </p>
            </div>
          ) : activeSeries.length > 0 ? (
            <LineChart
              series={activeSeries}
              xLabels={xLabels}
              yLabel={
                metric === "ranking"
                  ? view === "historisch" ? "Positie %" : "Positie"
                  : metric === "zscore" ? "Z-score"
                  : cumulative ? "Totaal" : "Punten"
              }
              height={220}
              invertY={metric === "ranking"}
              yDomain={view === "historisch" && metric === "ranking" ? [0, 100] : undefined}
            />
          ) : null}
        </div>
      )}

      {/* Head-to-head — shown when exactly 2 players selected */}
      {headToHead && (
        <CollapsibleSection title="Head-to-head" defaultOpen>
          <div className="glass-card-subtle overflow-hidden">
            <>
              {/* Comparison table */}
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="text-left font-normal px-3 md:px-5 py-3">Stat</th>
                    <th className="text-center font-normal px-1 md:px-3 py-3 w-16 md:w-28">
                      <div className="flex items-center gap-1 justify-center">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PLAYER_COLORS[0] }} />
                        <span className="truncate">{headToHead.playerA.split(" ")[0]}</span>
                      </div>
                    </th>
                    <th className="text-center font-normal px-1 md:px-3 py-3 pr-3 md:pr-5 w-16 md:w-28">
                      <div className="flex items-center gap-1 justify-center">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PLAYER_COLORS[1] }} />
                        <span className="truncate">{headToHead.playerB.split(" ")[0]}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {headToHead.rows.map((row) => {
                    const numA = typeof row.a === "number" ? row.a : null;
                    const numB = typeof row.b === "number" ? row.b : null;
                    const aWins = numA != null && numB != null && numA > numB;
                    const bWins = numA != null && numB != null && numB > numA;
                    return (
                      <tr key={row.label} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 md:px-5 py-3 text-sm text-gray-400">{row.label}</td>
                        <td className={`text-center px-1 md:px-3 py-3 text-sm font-bold w-16 md:w-28 ${aWins ? "text-cb-gold" : "text-white"}`}>
                          {row.a}
                        </td>
                        <td className={`text-center px-1 md:px-3 py-3 pr-3 md:pr-5 text-sm font-bold w-16 md:w-28 ${bWins ? "text-cb-gold" : "text-white"}`}>
                          {row.b}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Per-speeldag comparison bars */}
              {headToHead.sdComparison.length > 0 && (
                <div className="p-4 md:p-5 border-t border-white/[0.06]">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Per speeldag</p>
                  <div className="space-y-2">
                    {headToHead.sdComparison.map((sd) => {
                      const total = sd.a + sd.b || 1;
                      const pctA = (sd.a / total) * 100;
                      return (
                        <div key={sd.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">{sd.label}</span>
                            <span className="text-xs text-gray-400">{sd.a} - {sd.b}</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden flex">
                            <div className="h-full transition-all duration-500" style={{ width: `${pctA}%`, backgroundColor: PLAYER_COLORS[0] }} />
                            <div className="h-full transition-all duration-500" style={{ width: `${100 - pctA}%`, backgroundColor: PLAYER_COLORS[1] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          </div>
        </CollapsibleSection>
      )}

      {/* Profiel — shown when exactly 1 player selected */}
      {profiel && (
        <CollapsibleSection title={`Profiel — ${profiel.name}`} defaultOpen>
          <div className="glass-card-subtle p-4 md:p-5">
            <div className="space-y-6">
              {/* Stats row */}
              <div className="flex items-center justify-center gap-4 md:gap-8">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-cb-blue">{profiel.totalScore}</div>
                  <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">Score</div>
                </div>
                <div className="stat-divider" />
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">#{profiel.rank}</div>
                  <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">Positie</div>
                </div>
                <div className="stat-divider" />
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{profiel.avgPerMatch}</div>
                  <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">Gem/wed</div>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card-subtle p-3 text-center">
                  <div className="text-lg font-bold text-white">{profiel.matchScore}</div>
                  <div className="text-xs text-gray-500">Wedstrijden</div>
                </div>
                <div className="glass-card-subtle p-3 text-center">
                  <div className="text-lg font-bold text-white">{profiel.extraScore}</div>
                  <div className="text-xs text-gray-500">Extra vragen</div>
                </div>
              </div>

              {/* Category breakdown */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Nauwkeurigheid</p>
                <div className="space-y-2.5">
                  {[
                    { label: "Exact", value: profiel.exact, color: "#C9A84C" },
                    { label: "Doelverschil", value: profiel.goalDiff, color: "#005a94" },
                    { label: "Juist resultaat", value: profiel.correctResult, color: "#14b8a6" },
                    { label: "Fout", value: profiel.wrong, color: "#6b7280" },
                  ].map((cat) => {
                    const total = profiel.exact + profiel.goalDiff + profiel.correctResult + profiel.wrong;
                    const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
                    const maxVal = Math.max(profiel.exact, profiel.goalDiff, profiel.correctResult, profiel.wrong, 1);
                    return (
                      <div key={cat.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-300">{cat.label}</span>
                          <span className="text-sm text-white font-bold">{cat.value} <span className="text-xs text-gray-500 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(cat.value / maxVal) * 100}%`, backgroundColor: cat.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Best/worst + comparison to average */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card-subtle p-3">
                  <div className="text-xs text-gray-500 mb-1">Beste speeldag</div>
                  <div className="text-sm font-bold text-white">{profiel.bestSd.label}</div>
                  <div className="text-xs text-gray-400">{profiel.bestSd.pts} punten</div>
                </div>
                <div className="glass-card-subtle p-3">
                  <div className="text-xs text-gray-500 mb-1">Slechtste speeldag</div>
                  <div className="text-sm font-bold text-white">{profiel.worstSd.label}</div>
                  <div className="text-xs text-gray-400">{profiel.worstSd.pts} punten</div>
                </div>
              </div>

              {/* vs average */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-gray-500">Gemiddelde score:</span>
                <span className="text-white font-bold">{profiel.avgTotal}</span>
                <span className={profiel.totalScore > profiel.avgTotal ? "text-cb-gold" : profiel.totalScore < profiel.avgTotal ? "text-gray-500" : "text-gray-400"}>
                  ({profiel.totalScore > profiel.avgTotal ? "+" : ""}{Math.round((profiel.totalScore - profiel.avgTotal) * 10) / 10})
                </span>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-sm font-semibold text-white">{title}</span>
      </button>
      {open && children}
    </div>
  );
}
