"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Edition, EditionScore, AlltimeScore } from "@/lib/types";

interface CurrentStanding {
  rank: number;
  user_id: string;
  display_name: string;
  total_score: number;
  exact_matches: number;
  correct_goal_diffs: number;
  correct_results: number;
  match_score: number;
  extra_score: number;
}

interface YearSelectorProps {
  editions: Edition[];
  editionScores: EditionScore[];
  alltimeScores: AlltimeScore[];
  currentStandings: CurrentStanding[];
}

function getRankColor(rank: number): string {
  if (rank === 1) return "text-cb-gold";
  if (rank === 2) return "text-cb-silver";
  if (rank === 3) return "text-cb-bronze";
  return "text-gray-500";
}

type ViewType = "current" | "alltime" | number;

export default function YearSelector({
  editions,
  editionScores,
  alltimeScores,
  currentStandings,
}: YearSelectorProps) {
  const currentEdition = editions.find((e) => e.is_current);
  const [selectedView, setSelectedView] = useState<ViewType>("current");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [minYearsFilter, setMinYearsFilter] = useState(1);
  const [yearsDropdownOpen, setYearsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const yearsDropdownRef = useRef<HTMLDivElement>(null);

  const historicalEditions = editions
    .filter((e) => !e.is_current)
    .sort((a, b) => b.year - a.year);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (yearsDropdownRef.current && !yearsDropdownRef.current.contains(e.target as Node)) {
        setYearsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Get edition scores for a specific year
  const getYearScores = (year: number) => {
    const edition = editions.find((e) => e.year === year);
    if (!edition) return [];
    return editionScores
      .filter((es) => es.edition_id === edition.id)
      .sort((a, b) => a.rank - b.rank);
  };

  const sortedAlltime = useMemo(
    () => [...alltimeScores].sort((a, b) => (b.avg_z_score ?? -999) - (a.avg_z_score ?? -999)),
    [alltimeScores],
  );

  const availableYearCounts = useMemo(
    () => [...new Set(alltimeScores.map((s) => s.years_played))].sort((a, b) => a - b),
    [alltimeScores],
  );

  const filteredAlltime = useMemo(
    () => sortedAlltime.filter((s) => s.years_played >= minYearsFilter),
    [sortedAlltime, minYearsFilter],
  );

  const selectedHistoricalYear = typeof selectedView === "number" ? selectedView : null;

  return (
    <>
      {/* Year selector */}
      <div className="flex items-center gap-2 mb-6">
        {/* 2026 button */}
        <button
          onClick={() => setSelectedView("current")}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            selectedView === "current"
              ? "bg-cb-blue text-white"
              : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
          }`}
        >
          {currentEdition ? currentEdition.year : "2026"}
        </button>

        {/* All-Time button */}
        <button
          onClick={() => setSelectedView("alltime")}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            selectedView === "alltime"
              ? "bg-cb-blue text-white"
              : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
          }`}
        >
          All-Time
        </button>

        {/* Historical dropdown */}
        {historicalEditions.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                selectedHistoricalYear !== null
                  ? "bg-cb-blue text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
              }`}
            >
              {selectedHistoricalYear !== null ? selectedHistoricalYear : "Archief"}
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
              <div className="absolute top-full left-0 mt-1 z-20 min-w-[120px] py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
                {historicalEditions.map((e) => (
                  <button
                    key={e.year}
                    onClick={() => {
                      setSelectedView(e.year);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      selectedView === e.year
                        ? "text-white bg-white/[0.06]"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {e.year}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Min years filter dropdown (all-time only) */}
      {selectedView === "alltime" && availableYearCounts.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative" ref={yearsDropdownRef}>
            <button
              onClick={() => setYearsDropdownOpen(!yearsDropdownOpen)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                minYearsFilter > 1
                  ? "bg-cb-blue text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
              }`}
            >
              {minYearsFilter <= 1 ? "Alle spelers" : `≥ ${minYearsFilter} jaar`}
              <svg
                className={`w-3.5 h-3.5 transition-transform ${yearsDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {yearsDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 min-w-[160px] py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl">
                <button
                  onClick={() => { setMinYearsFilter(1); setYearsDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    minYearsFilter <= 1
                      ? "text-white bg-white/[0.06]"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  Alle spelers
                </button>
                {availableYearCounts.filter(c => c > 1).map((count) => (
                  <button
                    key={count}
                    onClick={() => { setMinYearsFilter(count); setYearsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      minYearsFilter === count
                        ? "text-white bg-white/[0.06]"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    ≥ {count} jaar
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current year table */}
      {selectedView === "current" && (
        <div className="glass-card-subtle overflow-hidden">
          {currentStandings.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Nog geen spelers geregistreerd.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="text-left font-normal px-5 py-3 w-12">#</th>
                    <th className="text-left font-normal py-3">Naam</th>
                    <th className="text-right font-normal px-2 py-3 w-16">Score</th>
                    <th className="text-right font-normal px-2 py-3 w-12">E</th>
                    <th className="text-right font-normal px-2 py-3 w-12">GV</th>
                    <th className="text-right font-normal px-2 py-3 w-12">JR</th>
                    <th className="text-right font-normal px-2 py-3 w-16">Match</th>
                    <th className="text-right font-normal px-2 py-3 w-16 pr-5">Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStandings.map((row) => (
                    <tr
                      key={row.user_id}
                      className="group border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <a href={`/player/${row.user_id}`} className="block">
                          <span className={`heading-display text-lg ${getRankColor(row.rank)}`}>
                            {row.rank}
                          </span>
                        </a>
                      </td>
                      <td className="py-3">
                        <a
                          href={`/player/${row.user_id}`}
                          className="block text-sm font-medium text-gray-200 group-hover:text-white transition-colors"
                        >
                          {row.display_name}
                        </a>
                      </td>
                      <td className="text-right px-2 py-3 text-sm font-bold text-white">
                        <a href={`/player/${row.user_id}`} className="block">
                          {row.total_score}
                        </a>
                      </td>
                      <td className="text-right px-2 py-3 text-sm text-gray-500">
                        <a href={`/player/${row.user_id}`} className="block">
                          {row.exact_matches}
                        </a>
                      </td>
                      <td className="text-right px-2 py-3 text-sm text-gray-500">
                        <a href={`/player/${row.user_id}`} className="block">
                          {row.correct_goal_diffs}
                        </a>
                      </td>
                      <td className="text-right px-2 py-3 text-sm text-gray-500">
                        <a href={`/player/${row.user_id}`} className="block">
                          {row.correct_results}
                        </a>
                      </td>
                      <td className="text-right px-2 py-3 text-sm text-gray-500">
                        <a href={`/player/${row.user_id}`} className="block">
                          {row.match_score}
                        </a>
                      </td>
                      <td className="text-right px-2 py-3 pr-5 text-sm text-gray-500">
                        <a href={`/player/${row.user_id}`} className="block">
                          {row.extra_score}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile list */}
              <div className="md:hidden divide-y divide-white/[0.04]">
                <div className="flex items-center px-4 py-2 gap-3 text-[11px] text-gray-500 uppercase tracking-wider">
                  <span className="w-7 text-right shrink-0">#</span>
                  <span className="flex-1">Naam</span>
                  <span className="shrink-0">Score</span>
                  <span className="w-4 shrink-0" />
                </div>
                {currentStandings.map((row) => (
                  <a
                    key={row.user_id}
                    href={`/player/${row.user_id}`}
                    className="flex items-center px-4 py-3 gap-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <span
                      className={`heading-display text-base w-7 text-right shrink-0 ${getRankColor(row.rank)}`}
                    >
                      {row.rank}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-200 truncate">
                      {row.display_name}
                    </span>
                    <span className="text-sm font-bold text-white shrink-0">
                      {row.total_score}
                    </span>
                    <svg
                      className="w-4 h-4 text-gray-600 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                ))}
              </div>

              {/* Legend (desktop only) */}
              <div className="hidden md:block px-5 py-3 text-xs text-gray-600 border-t border-white/[0.04]">
                E = Exact &middot; GV = Goal verschil &middot; JR = Juist resultaat
              </div>
            </>
          )}
        </div>
      )}

      {/* Historical year table */}
      {typeof selectedView === "number" && (
        <div className="glass-card-subtle overflow-hidden">
          {(() => {
            const scores = getYearScores(selectedView);
            const edition = editions.find((e) => e.year === selectedView);
            if (scores.length === 0)
              return (
                <div className="p-12 text-center text-gray-500">
                  Geen data beschikbaar voor dit jaar.
                </div>
              );
            return (
              <>
                {/* Desktop table */}
                <table className="hidden md:table w-full">
                  <thead>
                    <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="text-left font-normal px-5 py-3 w-12">#</th>
                      <th className="text-left font-normal py-3">Naam</th>
                      <th className="text-right font-normal px-2 py-3 w-20 pr-5">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((s) => {
                      return (
                        <tr
                          key={`${s.edition_id}-${s.player_name}`}
                          className={`group border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                            s.rank <= 3 ? "bg-white/[0.01]" : ""
                          }`}
                        >
                          <td className="px-5 py-3">
                            <span className={`heading-display text-lg ${getRankColor(s.rank)}`}>
                              {s.rank}
                            </span>
                          </td>
                          <td className="py-3 text-sm font-medium text-gray-200">
                            {s.player_name}
                          </td>
                          <td className="text-right px-2 py-3 pr-5 text-sm font-bold text-white">
                            {s.total_score}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile list */}
                <div className="md:hidden divide-y divide-white/[0.04]">
                  <div className="flex items-center px-4 py-2 gap-3 text-[11px] text-gray-500 uppercase tracking-wider">
                    <span className="w-7 text-right shrink-0">#</span>
                    <span className="flex-1">Naam</span>
                    <span className="shrink-0">Score</span>
                  </div>
                  {scores.map((s) => (
                    <div
                      key={`${s.edition_id}-${s.player_name}`}
                      className="flex items-center px-4 py-3 gap-3"
                    >
                      <span
                        className={`heading-display text-base w-7 text-right shrink-0 ${getRankColor(s.rank)}`}
                      >
                        {s.rank}
                      </span>
                      <span className="flex-1 text-sm font-medium text-gray-200 truncate">
                        {s.player_name}
                      </span>
                      <span className="text-sm font-bold text-white shrink-0">
                        {s.total_score}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer with edition info */}
                {edition && (
                  <div className="px-5 py-3 text-xs text-gray-600 border-t border-white/[0.04]">
                    {edition.label} &middot; {edition.player_count} deelnemers
                    {edition.max_points ? ` \u00B7 Max ${edition.max_points} punten` : ""}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* All-Time table */}
      {selectedView === "alltime" && (
        <div className="glass-card-subtle overflow-hidden">
          {filteredAlltime.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Geen all-time data beschikbaar.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="text-left font-normal px-5 py-3 w-12">#</th>
                    <th className="text-left font-normal py-3">Naam</th>
                    <th className="text-right font-normal px-2 py-3 w-16">Jaren</th>
                    <th className="text-right font-normal px-2 py-3 w-24 pr-5">
                      Gem. Z-Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlltime.map((s, i) => {
                    return (
                      <tr
                        key={s.player_name}
                        className={`group border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                          i < 3 ? "bg-white/[0.01]" : ""
                        }`}
                      >
                        <td className="px-5 py-3">
                          <span className={`heading-display text-lg ${getRankColor(i + 1)}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-3 text-sm font-medium text-gray-200">
                          {s.player_name}
                        </td>
                        <td className="text-right px-2 py-3 text-sm text-gray-500">
                          {s.years_played}
                        </td>
                        <td className="text-right px-2 py-3 pr-5 text-sm font-bold text-white">
                          {s.avg_z_score !== null ? s.avg_z_score.toFixed(2) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile list */}
              <div className="md:hidden divide-y divide-white/[0.04]">
                <div className="flex items-center px-4 py-2 gap-3 text-[11px] text-gray-500 uppercase tracking-wider">
                  <span className="w-7 text-right shrink-0">#</span>
                  <span className="flex-1">Naam</span>
                  <span className="w-10 text-right shrink-0">Jaren</span>
                  <span className="shrink-0">Z-Score</span>
                </div>
                {filteredAlltime.map((s, i) => (
                  <div
                    key={s.player_name}
                    className="flex items-center px-4 py-3 gap-3"
                  >
                    <span
                      className={`heading-display text-base w-7 text-right shrink-0 ${getRankColor(i + 1)}`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-200 truncate">
                      {s.player_name}
                    </span>
                    <span className="w-10 text-right text-sm text-gray-500 shrink-0">
                      {s.years_played}
                    </span>
                    <span className="text-sm font-bold text-white shrink-0">
                      {s.avg_z_score !== null ? s.avg_z_score.toFixed(2) : "-"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 text-xs text-gray-600 border-t border-white/[0.04]">
                Gemiddelde Z-Score gecorrigeerd voor aantal deelnames (&lt;3 jaar: score &times; jaren/3)
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
