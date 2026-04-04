"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import TeamLogo from "@/components/TeamLogo";
import HorizontalBarChart from "../charts/HorizontalBarChart";
import type { BarChartItem } from "../charts/HorizontalBarChart";
import { calculateMatchPoints } from "@/lib/scoring";
import type {
  Team,
  Match,
  Result,
  Prediction,
  PlayerScore,
} from "@/lib/types";

interface PlayerRow {
  id: string;
  display_name: string;
  favorite_team: string | null;
  [key: string]: unknown;
}

interface OverzichtTabProps {
  players: PlayerRow[];
  teams: Team[];
  matches: (Match & { home_team: Team; away_team: Team })[];
  results: Result[];
  predictions: Prediction[];
  playerScores: PlayerScore[];
}

const GROUP_BY_OPTIONS = [
  { key: "favoriete_ploeg", label: "Favoriete ploeg" },
  { key: "speeldag", label: "Speeldag" },
  { key: "po1_ploeg", label: "PO1 ploeg" },
  { key: "categorie", label: "Categorie" },
] as const;

type GroupByKey = (typeof GROUP_BY_OPTIONS)[number]["key"];

export default function OverzichtTab({
  players,
  teams,
  matches,
  results,
  predictions,
  playerScores,
}: OverzichtTabProps) {
  const [groupBy, setGroupBy] = useState<GroupByKey>("favoriete_ploeg");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState<string | null>(null);
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const [mobileShowAll, setMobileShowAll] = useState(false);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const [heatmapHeight, setHeatmapHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!heatmapRef.current) return;
    const observer = new ResizeObserver(() => {
      if (heatmapRef.current) {
        setHeatmapHeight(heatmapRef.current.offsetHeight);
      }
    });
    observer.observe(heatmapRef.current);
    return () => observer.disconnect();
  }, []);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Build result lookup: match_id → Result
  const resultMap = useMemo(() => {
    const map = new Map<number, Result>();
    for (const r of results) map.set(r.match_id, r);
    return map;
  }, [results]);

  // Compute points for every prediction that has a result
  const scoredPredictions = useMemo(() => {
    return predictions
      .map((pred) => {
        const result = resultMap.get(pred.match_id);
        if (!result) return null;
        const { points, category } = calculateMatchPoints(
          pred.home_score,
          pred.away_score,
          result.home_score,
          result.away_score
        );
        return { ...pred, points, category };
      })
      .filter(
        (p): p is Prediction & { points: number; category: 'exact' | 'goal_diff' | 'result' | 'wrong' } =>
          p !== null
      );
  }, [predictions, resultMap]);

  // Match lookup: match_id → Match with teams
  const matchMap = useMemo(() => {
    const map = new Map<number, (typeof matches)[number]>();
    for (const m of matches) map.set(m.id, m);
    return map;
  }, [matches]);

  // ── Team popularity stats ──
  const teamPopularity = useMemo(() => {
    // For each team, collect goals for/against and win predictions
    const stats: Record<
      string,
      { goalsFor: number; goalsAgainst: number; wins: number; total: number }
    > = {};

    for (const pred of predictions) {
      const match = matchMap.get(pred.match_id);
      if (!match) continue;

      const homeTeam = match.home_team.name;
      const awayTeam = match.away_team.name;

      // Home team stats
      if (!stats[homeTeam])
        stats[homeTeam] = { goalsFor: 0, goalsAgainst: 0, wins: 0, total: 0 };
      stats[homeTeam].goalsFor += pred.home_score;
      stats[homeTeam].goalsAgainst += pred.away_score;
      if (pred.home_score > pred.away_score) stats[homeTeam].wins += 1;
      stats[homeTeam].total += 1;

      // Away team stats
      if (!stats[awayTeam])
        stats[awayTeam] = { goalsFor: 0, goalsAgainst: 0, wins: 0, total: 0 };
      stats[awayTeam].goalsFor += pred.away_score;
      stats[awayTeam].goalsAgainst += pred.home_score;
      if (pred.away_score > pred.home_score) stats[awayTeam].wins += 1;
      stats[awayTeam].total += 1;
    }

    return Object.entries(stats)
      .map(([team, { goalsFor, goalsAgainst, wins, total }]) => ({
        team,
        avgGF: total > 0 ? goalsFor / total : 0,
        avgGA: total > 0 ? goalsAgainst / total : 0,
        winPct: total > 0 ? (wins / total) * 100 : 0,
      }))
      .sort((a, b) => b.winPct - a.winPct || a.team.localeCompare(b.team));
  }, [predictions, matchMap]);

  // ── Score distribution heatmap + popular scorelines ──
  const scoreDistribution = useMemo(() => {
    const grid: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
    const scoreCounts: Record<string, number> = {};

    for (const pred of predictions) {
      const h = Math.min(pred.home_score, 5);
      const a = Math.min(pred.away_score, 5);
      grid[h][a] += 1;

      const key = `${pred.home_score}-${pred.away_score}`;
      scoreCounts[key] = (scoreCounts[key] || 0) + 1;
    }

    const topScorelines = Object.entries(scoreCounts)
      .map(([score, count]) => ({ score, count }))
      .sort((a, b) => b.count - a.count);

    const maxCell = Math.max(...grid.flat(), 1);

    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    for (const pred of predictions) {
      if (pred.home_score > pred.away_score) homeWins++;
      else if (pred.home_score === pred.away_score) draws++;
      else awayWins++;
    }
    const total = predictions.length;

    return {
      grid,
      topScorelines,
      maxCell,
      total,
      homeWins,
      draws,
      awayWins,
      homePct: total > 0 ? Math.round((homeWins / total) * 100) : 0,
      drawPct: total > 0 ? Math.round((draws / total) * 100) : 0,
      awayPct: total > 0 ? Math.round((awayWins / total) * 100) : 0,
    };
  }, [predictions]);

  // Player lookup: user_id → display_name
  const playerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) map.set(p.id, p.display_name);
    return map;
  }, [players]);

  // Predictions for a selected score: list of { player, match } entries
  const selectedScorePredictions = useMemo(() => {
    if (!selectedScore) return [];
    const [h, a] = selectedScore.split("-").map(Number);
    return predictions
      .filter((p) => {
        const ph = Math.min(p.home_score, 5);
        const pa = Math.min(p.away_score, 5);
        return ph === h && pa === a;
      })
      .map((p) => {
        const match = matchMap.get(p.match_id);
        const playerName = playerMap.get(p.user_id) ?? "Onbekend";
        const matchLabel = match
          ? `${match.home_team.name} - ${match.away_team.name}`
          : `Wedstrijd ${p.match_id}`;
        const actualScore = `${p.home_score}-${p.away_score}`;
        return { playerName, matchLabel, actualScore };
      })
      .sort((a, b) => a.matchLabel.localeCompare(b.matchLabel) || a.playerName.localeCompare(b.playerName));
  }, [selectedScore, predictions, matchMap, playerMap]);

  // Group selected score predictions by match
  const is5PlusCell = selectedScore?.includes("5") ?? false;
  const selectedScoreByMatch = useMemo(() => {
    const groups: Record<string, { name: string; score: string }[]> = {};
    for (const { playerName, matchLabel, actualScore } of selectedScorePredictions) {
      if (!groups[matchLabel]) groups[matchLabel] = [];
      groups[matchLabel].push({ name: playerName, score: actualScore });
    }
    return Object.entries(groups)
      .map(([match, players]) => ({ match, players }))
      .sort((a, b) => b.players.length - a.players.length);
  }, [selectedScorePredictions]);

  // ── Favorite team chart items (existing) ──
  const favoriteTeamItems: BarChartItem[] = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const p of players) {
      const team = p.favorite_team || "Neutraal";
      if (!groups[team]) groups[team] = [];
      groups[team].push(p.display_name);
    }
    return Object.entries(groups)
      .map(([team, names]) => ({
        label: team,
        value: names.length,
        details: names.sort((a, b) => a.localeCompare(b)),
        icon:
          team !== "Neutraal" ? (
            <TeamLogo name={team} size={18} />
          ) : undefined,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [players]);

  // ── Avg points by favorite team ──
  const avgByFavoriteTeam: BarChartItem[] = useMemo(() => {
    const groups: Record<string, { total: number; count: number }> = {};
    for (const p of players) {
      const team = p.favorite_team || "Neutraal";
      const score = playerScores.find((s) => s.user_id === p.id);
      if (!groups[team]) groups[team] = { total: 0, count: 0 };
      groups[team].total += score?.total_score ?? 0;
      groups[team].count += 1;
    }
    return Object.entries(groups)
      .map(([team, { total, count }]) => ({
        label: team,
        value: Math.round((total / count) * 10) / 10,
        icon:
          team !== "Neutraal" ? (
            <TeamLogo name={team} size={18} />
          ) : undefined,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [players, playerScores]);

  // ── Avg points by speeldag ──
  const avgBySpeeldag: BarChartItem[] = useMemo(() => {
    const groups: Record<string, { total: number; count: number; sortKey: number }> = {};
    for (const sp of scoredPredictions) {
      const match = matchMap.get(sp.match_id);
      if (!match) continue;
      const key = match.is_cup_final
        ? "Beker"
        : `Speeldag ${match.speeldag}`;
      const sortKey = match.is_cup_final ? 99 : (match.speeldag ?? 0);
      if (!groups[key]) groups[key] = { total: 0, count: 0, sortKey };
      groups[key].total += sp.points;
      groups[key].count += 1;
    }
    return Object.entries(groups)
      .map(([label, { total, count, sortKey }]) => ({
        label,
        value: Math.round((total / count) * 10) / 10,
        sortKey,
      }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ label, value }) => ({ label, value }));
  }, [scoredPredictions, matchMap]);

  // ── Avg points by PO1 team ──
  const avgByPO1Team: BarChartItem[] = useMemo(() => {
    const groups: Record<string, { total: number; count: number }> = {};
    for (const sp of scoredPredictions) {
      const match = matchMap.get(sp.match_id);
      if (!match) continue;
      const homeTeam = match.home_team.name;
      const awayTeam = match.away_team.name;
      for (const team of [homeTeam, awayTeam]) {
        if (!groups[team]) groups[team] = { total: 0, count: 0 };
        groups[team].total += sp.points;
        groups[team].count += 1;
      }
    }
    return Object.entries(groups)
      .map(([team, { total, count }]) => ({
        label: team,
        value: Math.round((total / count) * 10) / 10,
        icon: <TeamLogo name={team} size={18} />,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [scoredPredictions, matchMap]);

  // ── Prediction category breakdown ──
  const categoryItems: BarChartItem[] = useMemo(() => {
    const counts: Record<string, number> = {
      exact: 0,
      goal_diff: 0,
      result: 0,
      wrong: 0,
    };
    for (const sp of scoredPredictions) {
      counts[sp.category] = (counts[sp.category] || 0) + 1;
    }
    const labels: Record<string, string> = {
      exact: "Exact",
      goal_diff: "Doelverschil",
      result: "Juist resultaat",
      wrong: "Fout",
    };
    return ["exact", "goal_diff", "result", "wrong"].map((key) => ({
      label: labels[key],
      value: counts[key] || 0,
    }));
  }, [scoredPredictions]);

  // ── Select chart items based on groupBy ──
  const groupedItems =
    groupBy === "favoriete_ploeg"
      ? avgByFavoriteTeam
      : groupBy === "speeldag"
        ? avgBySpeeldag
        : groupBy === "po1_ploeg"
          ? avgByPO1Team
          : categoryItems;

  const showPercentage = groupBy === "categorie";
  const formatValue =
    groupBy === "categorie"
      ? undefined
      : (v: number) => v.toFixed(1);

  const groupBySubtitle: Record<GroupByKey, string> = {
    favoriete_ploeg: "Scoren fans van bepaalde ploegen beter?",
    speeldag: "Hoeveel punten verdienen spelers gemiddeld per speeldag?",
    po1_ploeg: "Bij welke ploeg worden de meeste punten gescoord?",
    categorie: "Hoe nauwkeurig zijn de voorspellingen?",
  };

  return (
    <div className="space-y-8">
      {/* Row 1: Favorite team + Average points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {/* Chart 1: Favorite team distribution */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">
          Favoriete Ploeg
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Hoeveel fans per ploeg?
        </p>
        <div className="glass-card-subtle p-4 md:p-5">
          <HorizontalBarChart
            items={favoriteTeamItems}
            total={players.length}
            defaultVisible={6}
            expandLabel="ploegen"
          />
        </div>
      </div>

      {/* Chart 2: Average points grouped */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">
          Gemiddelde Punten
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cb-blue text-white"
            >
              {GROUP_BY_OPTIONS.find((o) => o.key === groupBy)?.label}
              <svg
                className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 min-w-full py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
                {GROUP_BY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setGroupBy(opt.key);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                      groupBy === opt.key
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
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {groupBySubtitle[groupBy]}
        </p>
        <div className="glass-card-subtle p-4 md:p-5">
          {groupedItems.length > 0 ? (
            <HorizontalBarChart
              items={groupedItems}
              showPercentage={showPercentage}
              formatValue={formatValue}
              defaultVisible={6}
            />
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">
              Nog geen resultaten beschikbaar.
            </p>
          )}
        </div>
      </div>
      </div>

      {/* Row 2: Team Popularity + Score Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {/* Chart 3: Team Popularity Table */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">
          Team Populariteit
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Hoe schatten de spelers elke ploeg in op basis van hun voorspellingen?
        </p>
        <div className="glass-card-subtle overflow-hidden">
          {teamPopularity.length > 0 ? (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="text-left font-normal px-5 py-3">Ploeg</th>
                    <th className="text-right font-normal px-3 py-3 w-20">G+</th>
                    <th className="text-right font-normal px-3 py-3 w-20">G−</th>
                    <th className="text-right font-normal px-3 py-3 w-20 pr-5">Winst%</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPopularity.map((row) => (
                    <tr
                      key={row.team}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <TeamLogo name={row.team} size={20} />
                          <span className="text-sm font-medium text-gray-200">
                            {row.team}
                          </span>
                        </div>
                      </td>
                      <td className="text-right px-3 py-3 text-sm text-white">
                        {row.avgGF.toFixed(2)}
                      </td>
                      <td className="text-right px-3 py-3 text-sm text-white">
                        {row.avgGA.toFixed(2)}
                      </td>
                      <td className="text-right px-3 py-3 pr-5 text-sm font-bold text-white">
                        {Math.round(row.winPct)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile list */}
              <div className="md:hidden divide-y divide-white/[0.04]">
                <div className="flex items-center px-4 py-2 text-[11px] text-gray-500 uppercase tracking-wider">
                  <span className="flex-1">Ploeg</span>
                  <span className="w-12 text-right">G+</span>
                  <span className="w-12 text-right">G−</span>
                  <span className="w-14 text-right">Winst%</span>
                </div>
                {teamPopularity.map((row) => (
                  <div
                    key={row.team}
                    className="flex items-center px-4 py-3"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <TeamLogo name={row.team} size={18} />
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {row.team}
                      </span>
                    </div>
                    <span className="w-12 text-right text-sm text-white">
                      {row.avgGF.toFixed(1)}
                    </span>
                    <span className="w-12 text-right text-sm text-white">
                      {row.avgGA.toFixed(1)}
                    </span>
                    <span className="w-14 text-right text-sm font-bold text-white">
                      {Math.round(row.winPct)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">
              Nog geen voorspellingen beschikbaar.
            </p>
          )}
        </div>
      </div>

      {/* Chart 4: Score Distribution */}
      {predictions.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-white mb-1">
            Score Verdeling
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Welke scores worden het vaakst voorspeld?
          </p>

          {/* Home / Draw / Away bar */}
          <div className="glass-card-subtle p-4 md:p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-cb-gold" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9.3V4h-3v2.6L12 3 2 12h3v8h5v-6h4v6h5v-8h3l-3-2.7z" />
                </svg>
                <span className="text-xs text-cb-gold font-medium">Thuis</span>
                <span className="text-sm font-bold text-white ml-1">{scoreDistribution.homePct}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" d="M5 9h14M5 15h14" />
                </svg>
                <span className="text-xs text-gray-500 font-medium">Gelijk</span>
                <span className="text-sm font-bold text-white ml-1">{scoreDistribution.drawPct}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-cb-blue" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11H6V6h12v5z" />
                </svg>
                <span className="text-xs text-cb-blue font-medium">Uit</span>
                <span className="text-sm font-bold text-white ml-1">{scoreDistribution.awayPct}%</span>
              </div>
            </div>
            <div className="h-4 rounded-full overflow-hidden flex">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${scoreDistribution.homePct}%`, backgroundColor: "var(--color-cb-gold)" }}
              />
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${scoreDistribution.drawPct}%`, backgroundColor: "#6b7280" }}
              />
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${scoreDistribution.awayPct}%`, backgroundColor: "var(--color-cb-blue)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:items-start">
            {/* Heatmap */}
            <div ref={heatmapRef} className="glass-card-subtle p-4 md:p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                Alle voorspellingen
              </p>
              <div className="flex">
                {/* Y-axis label */}
                <div className="flex flex-col items-center justify-center mr-1">
                  <span className="text-[10px] text-gray-500 [writing-mode:vertical-lr] rotate-180 tracking-wider">
                    ← Doelpunten thuis →
                  </span>
                </div>
                <div className="flex-1">
                  {/* X-axis label */}
                  <div className="text-center text-[10px] text-gray-500 mb-1 ml-8 tracking-wider">
                    ← Doelpunten uit →
                  </div>
                  {/* X-axis headers */}
                  <div className="grid grid-cols-6 gap-1 mb-1 ml-8">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className="text-center text-xs text-gray-500"
                      >
                        {n === 5 ? "5+" : n}
                      </div>
                    ))}
                  </div>
                  {/* Grid rows */}
                  {scoreDistribution.grid.map((row, homeGoals) => (
                    <div
                      key={homeGoals}
                      className="flex items-center gap-1 mb-1"
                    >
                      <div className="w-7 text-right text-xs text-gray-500 shrink-0">
                        {homeGoals === 5 ? "5+" : homeGoals}
                      </div>
                      <div className="grid grid-cols-6 gap-1 flex-1">
                        {row.map((count, awayGoals) => {
                          const intensity =
                            count > 0
                              ? 0.15 + (count / scoreDistribution.maxCell) * 0.85
                              : 0.05;
                          const scoreKey = `${homeGoals}-${awayGoals}`;
                          const isSelected = selectedScore === scoreKey;
                          return (
                            <div
                              key={awayGoals}
                              onClick={() => {
                                if (count > 0) {
                                  setSelectedScore(isSelected ? null : scoreKey);
                                  setExpandedMatches(new Set());
                                  setMobileShowAll(false);
                                  if (!isSelected && window.innerWidth < 768) {
                                    setTimeout(() => {
                                      if (!detailPanelRef.current) return;
                                      const rect = detailPanelRef.current.getBoundingClientRect();
                                      if (rect.top > window.innerHeight * 0.8) {
                                        detailPanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                      }
                                    }, 50);
                                  }
                                }
                              }}
                              className={`aspect-square rounded flex items-center justify-center text-xs font-medium transition-all ${
                                count > 0 ? "cursor-pointer hover:ring-1 hover:ring-white/30" : ""
                              } ${isSelected ? "ring-2 ring-cb-gold" : ""}`}
                              style={{
                                backgroundColor: `rgba(0, 90, 148, ${intensity})`,
                                color:
                                  count > 0
                                    ? intensity > 0.5
                                      ? "white"
                                      : "rgba(255,255,255,0.7)"
                                    : "transparent",
                              }}
                            >
                              {count > 0 ? count : ""}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-2 mt-3 ml-8">
                    <span className="text-[10px] text-gray-500">Minder</span>
                    {[0.15, 0.35, 0.55, 0.75, 0.95].map((opacity, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded"
                        style={{
                          backgroundColor: `rgba(0, 90, 148, ${opacity})`,
                        }}
                      />
                    ))}
                    <span className="text-[10px] text-gray-500">Meer</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected score detail panel */}
            <div ref={detailPanelRef} className="glass-card-subtle p-4 md:p-5">
              {selectedScore ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      Score {selectedScore.includes("5") ? selectedScore.replace("5", "5+") : selectedScore}
                    </p>
                    <button
                      onClick={() => setSelectedScore(null)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Sluiten
                    </button>
                  </div>
                  <p className="text-sm text-white font-bold mb-3">
                    {selectedScorePredictions.length} voorspelling{selectedScorePredictions.length !== 1 ? "en" : ""}
                  </p>
                  {selectedScoreByMatch.length > 0 ? (
                    <>
                      {/* Desktop: scrollable list */}
                      <div
                        className="hidden md:block space-y-1 overflow-y-auto"
                        style={heatmapHeight ? { maxHeight: heatmapHeight - 100 } : undefined}
                      >
                        {selectedScoreByMatch.map(({ match, players }) => {
                          const isOpen = expandedMatches.has(match);
                          return (
                            <MatchRow
                              key={match}
                              match={match}
                              players={players}
                              isOpen={isOpen}
                              showScores={is5PlusCell}
                              onToggle={() => {
                                const next = new Set(expandedMatches);
                                if (isOpen) next.delete(match);
                                else next.add(match);
                                setExpandedMatches(next);
                              }}
                            />
                          );
                        })}
                      </div>
                      {/* Mobile: show 6 + toggle */}
                      <div className="md:hidden space-y-1">
                        {(mobileShowAll ? selectedScoreByMatch : selectedScoreByMatch.slice(0, 6)).map(({ match, players }) => {
                          const isOpen = expandedMatches.has(match);
                          return (
                            <MatchRow
                              key={match}
                              match={match}
                              players={players}
                              isOpen={isOpen}
                              showScores={is5PlusCell}
                              onToggle={() => {
                                const next = new Set(expandedMatches);
                                if (isOpen) next.delete(match);
                                else next.add(match);
                                setExpandedMatches(next);
                              }}
                            />
                          );
                        })}
                        {selectedScoreByMatch.length > 6 && (
                          <button
                            onClick={() => setMobileShowAll(!mobileShowAll)}
                            className="mt-2 text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5"
                          >
                            <svg
                              className={`w-3.5 h-3.5 transition-transform ${mobileShowAll ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                            {mobileShowAll
                              ? "Toon minder"
                              : `Toon alle ${selectedScoreByMatch.length} wedstrijden`}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Geen voorspellingen.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  <p className="text-sm text-gray-500">
                    Klik op een score in de matrix om te zien wie deze voorspelde.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function MatchRow({
  match,
  players,
  isOpen,
  onToggle,
  showScores,
}: {
  match: string;
  players: { name: string; score: string }[];
  isOpen: boolean;
  onToggle: () => void;
  showScores?: boolean;
}) {
  return (
    <div>
      <div
        onClick={onToggle}
        className="flex items-center justify-between cursor-pointer py-2 px-1 rounded hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <svg
            className={`w-3 h-3 text-gray-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm text-gray-300 truncate">{match}</span>
        </div>
        <span className="text-xs text-gray-500 shrink-0 ml-2">
          {players.length}×
        </span>
      </div>
      {isOpen && (
        <div className="ml-5 flex flex-wrap gap-x-3 gap-y-1 pb-1">
          {players.map((p) => (
            <span key={p.name} className="text-xs text-gray-400">
              {p.name}{showScores ? ` (${p.score})` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
