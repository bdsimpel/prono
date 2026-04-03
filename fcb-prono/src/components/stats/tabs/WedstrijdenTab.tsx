"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import TeamLogo from "@/components/TeamLogo";
import type { Team, Match, Result, Prediction } from "@/lib/types";

interface PlayerRow {
  id: string;
  display_name: string;
  [key: string]: unknown;
}

interface WedstrijdenTabProps {
  players: PlayerRow[];
  matches: (Match & { home_team: Team; away_team: Team })[];
  results: Result[];
  predictions: Prediction[];
}

interface Speeldag {
  key: string;
  label: string;
  speeldag: number | null;
  isCupFinal: boolean;
  firstDatetime: number;
}

export default function WedstrijdenTab({
  players,
  matches,
  results,
  predictions,
}: WedstrijdenTabProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Build speeldag list
  const speeldagen = useMemo(() => {
    const map = new Map<string, Speeldag>();
    for (const m of matches) {
      const key = m.is_cup_final ? "beker" : `sd-${m.speeldag}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: m.is_cup_final ? "Bekerfinale" : `Speeldag ${m.speeldag}`,
          speeldag: m.speeldag,
          isCupFinal: m.is_cup_final,
          firstDatetime: m.match_datetime ? new Date(m.match_datetime).getTime() : Infinity,
        });
      } else {
        const existing = map.get(key)!;
        const dt = m.match_datetime ? new Date(m.match_datetime).getTime() : Infinity;
        if (dt < existing.firstDatetime) existing.firstDatetime = dt;
      }
    }
    return [...map.values()].sort((a, b) => a.firstDatetime - b.firstDatetime);
  }, [matches]);

  // Determine current speeldag (2 days before first match)
  const currentSpeeldagKey = useMemo(() => {
    const now = Date.now();
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    let current = speeldagen[0]?.key ?? "";
    for (const sd of speeldagen) {
      if (now >= sd.firstDatetime - TWO_DAYS) {
        current = sd.key;
      }
    }
    return current;
  }, [speeldagen]);

  const [selectedKey, setSelectedKey] = useState<string>(currentSpeeldagKey);

  const selectedSpeeldag = speeldagen.find((s) => s.key === selectedKey);

  // Matches for selected speeldag
  const speeldagMatches = useMemo(() => {
    return matches
      .filter((m) => {
        if (selectedSpeeldag?.isCupFinal) return m.is_cup_final;
        return m.speeldag === selectedSpeeldag?.speeldag && !m.is_cup_final;
      })
      .sort((a, b) => {
        const da = a.match_datetime ? new Date(a.match_datetime).getTime() : 0;
        const db = b.match_datetime ? new Date(b.match_datetime).getTime() : 0;
        return da - db;
      });
  }, [matches, selectedSpeeldag]);

  // Result lookup
  const resultMap = useMemo(() => {
    const map = new Map<number, Result>();
    for (const r of results) map.set(r.match_id, r);
    return map;
  }, [results]);

  // Player lookup
  const playerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) map.set(p.id, p.display_name);
    return map;
  }, [players]);

  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-1">Wedstrijden</h3>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cb-blue text-white"
          >
            {selectedSpeeldag?.label ?? "Selecteer speeldag"}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 min-w-full py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
              {speeldagen.map((sd) => (
                <button
                  key={sd.key}
                  onClick={() => {
                    setSelectedKey(sd.key);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                    selectedKey === sd.key
                      ? "text-white bg-white/[0.06]"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {sd.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Match cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {speeldagMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            result={resultMap.get(match.id)}
            predictions={predictions.filter((p) => p.match_id === match.id)}
            playerMap={playerMap}
          />
        ))}
        {speeldagMatches.length === 0 && (
          <div className="glass-card-subtle p-12 text-center text-gray-500 text-sm">
            Geen wedstrijden voor deze speeldag.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Match Card ──

function MatchCard({
  match,
  result,
  predictions,
  playerMap,
  odds,
}: {
  match: Match & { home_team: Team; away_team: Team };
  result?: Result;
  predictions: Prediction[];
  playerMap: Map<string, string>;
  odds?: { home: number; draw: number; away: number };
}) {
  const [selectedScore, setSelectedScore] = useState<string | null>(null);
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [mobileShowAll, setMobileShowAll] = useState(false);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [heatmapHeight, setHeatmapHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!heatmapRef.current) return;
    const observer = new ResizeObserver(() => {
      if (heatmapRef.current) setHeatmapHeight(heatmapRef.current.offsetHeight);
    });
    observer.observe(heatmapRef.current);
    return () => observer.disconnect();
  }, []);

  // Home/Draw/Away counts
  const { homeCount, drawCount, awayCount, total } = useMemo(() => {
    let h = 0, d = 0, a = 0;
    for (const p of predictions) {
      if (p.home_score > p.away_score) h++;
      else if (p.home_score === p.away_score) d++;
      else a++;
    }
    return { homeCount: h, drawCount: d, awayCount: a, total: predictions.length };
  }, [predictions]);

  const homePct = total > 0 ? Math.round((homeCount / total) * 100) : 0;
  const drawPct = total > 0 ? Math.round((drawCount / total) * 100) : 0;
  const awayPct = total > 0 ? Math.round((awayCount / total) * 100) : 0;

  // Score grid
  const { grid, maxCell } = useMemo(() => {
    const g: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
    for (const p of predictions) {
      const h = Math.min(p.home_score, 5);
      const a = Math.min(p.away_score, 5);
      g[h][a] += 1;
    }
    return { grid: g, maxCell: Math.max(...g.flat(), 1) };
  }, [predictions]);

  // Selected score detail
  const selectedPredictions = useMemo(() => {
    if (!selectedScore) return [];
    const [h, a] = selectedScore.split("-").map(Number);
    return predictions
      .filter((p) => {
        const ph = Math.min(p.home_score, 5);
        const pa = Math.min(p.away_score, 5);
        return ph === h && pa === a;
      })
      .map((p) => ({
        name: playerMap.get(p.user_id) ?? "Onbekend",
        score: `${p.home_score}-${p.away_score}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedScore, predictions, playerMap]);

  return (
    <div className="glass-card-subtle overflow-hidden">
      {/* Match header */}
      <div className="p-4 md:p-5 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <TeamLogo name={match.home_team.name} size={28} />
            <span className="text-sm md:text-base font-medium text-white truncate">
              {match.home_team.name}
            </span>
          </div>
          <div className="px-3 md:px-4 shrink-0 text-center">
            {result ? (
              <span className="text-lg md:text-xl font-bold text-white">
                {result.home_score} - {result.away_score}
              </span>
            ) : (
              <span className="text-xs text-gray-500">vs</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span className="text-sm md:text-base font-medium text-white truncate text-right">
              {match.away_team.name}
            </span>
            <TeamLogo name={match.away_team.name} size={28} />
          </div>
        </div>
      </div>

      {/* Prediction distribution */}
      <div className="p-4 md:p-5 border-b border-white/[0.04]">
        {/* Labels */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-cb-gold" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 9.3V4h-3v2.6L12 3 2 12h3v8h5v-6h4v6h5v-8h3l-3-2.7z" />
            </svg>
            <span className="text-xs text-cb-gold font-medium">Thuis</span>
            <span className="text-sm font-bold text-white ml-1">{homePct}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" d="M5 9h14M5 15h14" />
            </svg>
            <span className="text-xs text-gray-500 font-medium">Gelijk</span>
            <span className="text-sm font-bold text-white ml-1">{drawPct}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-cb-blue" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11H6V6h12v5z" />
            </svg>
            <span className="text-xs text-cb-blue font-medium">Uit</span>
            <span className="text-sm font-bold text-white ml-1">{awayPct}%</span>
          </div>
        </div>

        {/* Player prediction bar */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-12 shrink-0">Spelers</span>
            <div className="h-3 rounded-full overflow-hidden flex flex-1">
              {total > 0 ? (
                <>
                  <div className="h-full transition-all duration-500" style={{ width: `${homePct}%`, backgroundColor: "var(--color-cb-gold)" }} />
                  <div className="h-full transition-all duration-500" style={{ width: `${drawPct}%`, backgroundColor: "#6b7280" }} />
                  <div className="h-full transition-all duration-500" style={{ width: `${awayPct}%`, backgroundColor: "var(--color-cb-blue)" }} />
                </>
              ) : (
                <div className="h-full w-full bg-white/[0.06]" />
              )}
            </div>
          </div>

          {/* Odds bar (optional) */}
          {odds && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-12 shrink-0">Odds</span>
              <div className="h-3 rounded-full overflow-hidden flex flex-1">
                <div className="h-full transition-all duration-500" style={{ width: `${Math.round(odds.home)}%`, backgroundColor: "var(--color-cb-gold)", opacity: 0.6 }} />
                <div className="h-full transition-all duration-500" style={{ width: `${Math.round(odds.draw)}%`, backgroundColor: "#6b7280", opacity: 0.6 }} />
                <div className="h-full transition-all duration-500" style={{ width: `${Math.round(odds.away)}%`, backgroundColor: "var(--color-cb-blue)", opacity: 0.6 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Score matrix + detail */}
      <div className="p-4 md:p-5">
        <div className="space-y-4">
          {/* Heatmap */}
          <div ref={heatmapRef}>
            <div className="flex">
              {/* Y-axis label */}
              <div className="flex flex-col items-center justify-center mr-1">
                <span className="text-[10px] text-gray-500 [writing-mode:vertical-lr] rotate-180 tracking-wider">
                  ← {match.home_team.short_name ?? match.home_team.name} →
                </span>
              </div>
              <div className="flex-1">
                {/* X-axis label */}
                <div className="text-center text-[10px] text-gray-500 mb-1 ml-7 tracking-wider">
                  ← {match.away_team.short_name ?? match.away_team.name} →
                </div>
                {/* X-axis headers */}
                <div className="grid grid-cols-6 gap-1 mb-1 ml-7">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="text-center text-xs text-gray-500">{n === 5 ? "5+" : n}</div>
                  ))}
                </div>
                {/* Grid */}
                {grid.map((row, homeGoals) => (
                  <div key={homeGoals} className="flex items-center gap-1 mb-1">
                    <div className="w-6 text-right text-xs text-gray-500 shrink-0">{homeGoals === 5 ? "5+" : homeGoals}</div>
                    <div className="grid grid-cols-6 gap-1 flex-1">
                      {row.map((count, awayGoals) => {
                        const intensity = count > 0 ? 0.15 + (count / maxCell) * 0.85 : 0.05;
                        const scoreKey = `${homeGoals}-${awayGoals}`;
                        const isSelected = selectedScore === scoreKey;
                        return (
                          <div
                            key={awayGoals}
                            onClick={() => {
                              if (count > 0) {
                                const newScore = isSelected ? null : scoreKey;
                                setSelectedScore(newScore);
                                setExpandedNames(new Set());
                                setMobileShowAll(false);
                                if (newScore && window.innerWidth < 768) {
                                  setTimeout(() => {
                                    if (!detailRef.current) return;
                                    const rect = detailRef.current.getBoundingClientRect();
                                    if (rect.top > window.innerHeight * 0.8) {
                                      detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                    }
                                  }, 50);
                                }
                              }
                            }}
                            className={`aspect-square rounded flex items-center justify-center text-[11px] font-medium transition-all ${
                              count > 0 ? "cursor-pointer hover:ring-1 hover:ring-white/30" : ""
                            } ${isSelected ? "ring-2 ring-cb-gold" : ""}`}
                            style={{
                              backgroundColor: `rgba(0, 90, 148, ${intensity})`,
                              color: count > 0
                                ? intensity > 0.5 ? "white" : "rgba(255,255,255,0.7)"
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
                <div className="flex items-center justify-center gap-2 mt-2 ml-7">
                  <span className="text-[10px] text-gray-500">Minder</span>
                  {[0.15, 0.35, 0.55, 0.75, 0.95].map((opacity, i) => (
                    <div key={i} className="w-3 h-3 rounded" style={{ backgroundColor: `rgba(0, 90, 148, ${opacity})` }} />
                  ))}
                  <span className="text-[10px] text-gray-500">Meer</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div ref={detailRef}>
            {selectedScore ? (
              <div>
                <div className="flex items-center justify-between mb-2">
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
                <p className="text-sm text-white font-bold mb-2">
                  {selectedPredictions.length} speler{selectedPredictions.length !== 1 ? "s" : ""}
                </p>
                {/* Desktop: scrollable */}
                <div className="hidden md:block space-y-0.5">
                  {selectedPredictions.map((p) => (
                    <div key={p.name} className="text-sm text-gray-300 py-1 flex items-center justify-between">
                      <span>{p.name}</span>
                      {p.score !== selectedScore && (
                        <span className="text-xs text-gray-500">{p.score}</span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Mobile: show 6 + toggle */}
                <div className="md:hidden space-y-0.5">
                  {(mobileShowAll ? selectedPredictions : selectedPredictions.slice(0, 6)).map((p) => (
                    <div key={p.name} className="text-sm text-gray-300 py-1 flex items-center justify-between">
                      <span>{p.name}</span>
                      {p.score !== selectedScore && (
                        <span className="text-xs text-gray-500">{p.score}</span>
                      )}
                    </div>
                  ))}
                  {selectedPredictions.length > 6 && (
                    <button
                      onClick={() => setMobileShowAll(!mobileShowAll)}
                      className="mt-2 text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5"
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${mobileShowAll ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      {mobileShowAll ? "Toon minder" : `Toon alle ${selectedPredictions.length} spelers`}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[100px] text-center">
                <p className="text-xs text-gray-500">
                  Klik op een score om te zien wie deze voorspelde.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
