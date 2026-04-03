"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import TeamLogo from "@/components/TeamLogo";
import type {
  Team,
  Match,
  Result,
  ExtraQuestion,
  ExtraPrediction,
  ExtraQuestionAnswer,
  PlayerScore,
  FootballPlayer,
} from "@/lib/types";

interface PlayerRow {
  id: string;
  display_name: string;
  favorite_team: string | null;
  [key: string]: unknown;
}

interface MatchEvent {
  id: number;
  match_id: number;
  event_type: string;
  player_name: string;
  football_player_id: number | null;
  team_id: number;
  minute: number;
}

interface ExtraVragenTabProps {
  players: PlayerRow[];
  playerScores: PlayerScore[];
  extraQuestions: ExtraQuestion[];
  extraPredictions: ExtraPrediction[];
  extraAnswers: ExtraQuestionAnswer[];
  teams: Team[];
  results: Result[];
  matches: (Match & { home_team: Team; away_team: Team })[];
  matchEvents: MatchEvent[];
  footballPlayers: FootballPlayer[];
}

// Which questions are about teams vs players
const TEAM_QUESTIONS = new Set([
  "bekerwinnaar",
  "beste_ploeg_poi",
  "meeste_goals_poi",
  "minste_goals_tegen_poi",
  "kampioen",
]);

const STAT_LABELS: Record<string, string> = {
  bekerwinnaar: "",
  beste_ploeg_poi: "Punten",
  meeste_goals_poi: "Goals",
  minste_goals_tegen_poi: "Tegen",
  kampioen: "Totaal",
  topscorer_poi: "Goals",
  assistenkoning_poi: "Assists",
  meeste_clean_sheets_poi: "Clean sheets",
};

// Preferred display order for questions
const QUESTION_ORDER = [
  "kampioen",
  "bekerwinnaar",
  "beste_ploeg_poi",
  "topscorer_poi",
  "assistenkoning_poi",
  "meeste_clean_sheets_poi",
  "meeste_goals_poi",
  "minste_goals_tegen_poi",
];

export default function ExtraVragenTab({
  players,
  playerScores,
  extraQuestions,
  extraPredictions,
  extraAnswers,
  teams,
  results,
  matches,
  matchEvents,
  footballPlayers,
}: ExtraVragenTabProps) {
  // Sort questions in preferred display order
  const sortedQuestions = useMemo(() => {
    return [...extraQuestions].sort((a, b) => {
      const ai = QUESTION_ORDER.indexOf(a.question_key);
      const bi = QUESTION_ORDER.indexOf(b.question_key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [extraQuestions]);

  const [selectedQuestionId, setSelectedQuestionId] = useState<number>(
    sortedQuestions[0]?.id ?? 0
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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

  // Reset expanded rows when question changes
  useEffect(() => {
    setExpandedRows(new Set());
  }, [selectedQuestionId]);

  const selectedQuestion = extraQuestions.find((q) => q.id === selectedQuestionId);

  // Football player lookup
  const fpMap = useMemo(() => {
    const map = new Map<number, FootballPlayer>();
    for (const fp of footballPlayers) map.set(fp.id, fp);
    return map;
  }, [footballPlayers]);

  // Team lookup
  const teamMap = useMemo(() => {
    const map = new Map<number, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  // Correct answers for selected question
  const correctAnswers = useMemo(() => {
    return extraAnswers
      .filter((a) => a.question_id === selectedQuestionId)
      .map((a) => a.correct_answer.toLowerCase().trim());
  }, [extraAnswers, selectedQuestionId]);

  // Prediction counts for selected question: answer → { count, playerNames[] }
  const predictionsByAnswer = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const ep of extraPredictions) {
      if (ep.question_id !== selectedQuestionId) continue;
      const answer = ep.answer;
      if (!groups[answer]) groups[answer] = [];
      const player = players.find((p) => p.id === ep.user_id);
      if (player) groups[answer].push(player.display_name);
    }
    // Sort names
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.localeCompare(b));
    }
    return groups;
  }, [extraPredictions, selectedQuestionId, players]);

  const totalPredictions = useMemo(() => {
    return extraPredictions.filter((ep) => ep.question_id === selectedQuestionId).length;
  }, [extraPredictions, selectedQuestionId]);

  // Match lookup
  const matchById = useMemo(() => {
    const map = new Map<number, (typeof matches)[number]>();
    for (const m of matches) map.set(m.id, m);
    return map;
  }, [matches]);

  // ── Team stats (for team questions) ──
  const teamStats = useMemo(() => {
    const stats: Record<number, { points: number; goalsFor: number; goalsAgainst: number; played: number }> = {};
    for (const t of teams) {
      stats[t.id] = { points: 0, goalsFor: 0, goalsAgainst: 0, played: 0 };
    }
    for (const r of results) {
      const match = matchById.get(r.match_id);
      if (!match) continue;
      const hid = match.home_team_id;
      const aid = match.away_team_id;
      if (stats[hid]) {
        stats[hid].goalsFor += r.home_score;
        stats[hid].goalsAgainst += r.away_score;
        stats[hid].played += 1;
        if (r.home_score > r.away_score) stats[hid].points += 3;
        else if (r.home_score === r.away_score) stats[hid].points += 1;
      }
      if (stats[aid]) {
        stats[aid].goalsFor += r.away_score;
        stats[aid].goalsAgainst += r.home_score;
        stats[aid].played += 1;
        if (r.away_score > r.home_score) stats[aid].points += 3;
        else if (r.home_score === r.away_score) stats[aid].points += 1;
      }
    }
    return stats;
  }, [results, matchById, teams]);

  // ── Player stats from match_events ──
  const playerStats = useMemo(() => {
    const stats: Record<string, { name: string; team: string; goals: number; assists: number; cleanSheets: number }> = {};
    for (const ev of matchEvents) {
      // Use football_player_id to get the display name from football_players
      const fp = ev.football_player_id ? fpMap.get(ev.football_player_id) : null;
      const name = fp?.name ?? ev.player_name;
      const team = teamMap.get(ev.team_id)?.name ?? fp?.team ?? "";
      const key = fp ? `fp_${ev.football_player_id}` : `name_${ev.player_name}`;

      if (!stats[key]) {
        stats[key] = { name, team, goals: 0, assists: 0, cleanSheets: 0 };
      }
      if (ev.event_type === "goal") stats[key].goals += 1;
      else if (ev.event_type === "assist") stats[key].assists += 1;
      else if (ev.event_type === "clean_sheet") stats[key].cleanSheets += 1;
    }
    return Object.values(stats);
  }, [matchEvents, fpMap, teamMap]);

  // ── Build ranking rows based on selected question ──
  const rankingRows = useMemo(() => {
    if (!selectedQuestion) return [];
    const qKey = selectedQuestion.question_key;
    const isTeamQ = TEAM_QUESTIONS.has(qKey);

    if (isTeamQ) {
      // For bekerwinnaar, only show cup final teams
      const cupFinal = matches.find((m) => m.is_cup_final);
      const cupTeamIds = cupFinal
        ? new Set([cupFinal.home_team_id, cupFinal.away_team_id])
        : null;
      const teamsToShow = qKey === "bekerwinnaar" && cupTeamIds
        ? teams.filter((t) => cupTeamIds.has(t.id))
        : teams;

      return teamsToShow
        .map((t) => {
          const s = teamStats[t.id] ?? { points: 0, goalsFor: 0, goalsAgainst: 0 };
          const preds = predictionsByAnswer[t.name] ?? [];
          let stat = 0;
          let statLabel = "";
          if (qKey === "beste_ploeg_poi") {
            stat = s.points;
            statLabel = `${s.points} ptn`;
          } else if (qKey === "meeste_goals_poi") {
            stat = s.goalsFor;
            statLabel = `${s.goalsFor} goals`;
          } else if (qKey === "minste_goals_tegen_poi") {
            stat = s.goalsAgainst;
            statLabel = `${s.goalsAgainst} tegen`;
          } else if (qKey === "kampioen") {
            const totalPts = (t.points_half ?? 0) + s.points;
            stat = totalPts;
            statLabel = `${totalPts} ptn`;
          } else if (qKey === "bekerwinnaar") {
            stat = preds.length;
            statLabel = "";
          }

          const pct = totalPredictions > 0 ? Math.round((preds.length / totalPredictions) * 100) : 0;
          const isCorrect = correctAnswers.includes(t.name.toLowerCase().trim());

          return {
            key: t.name,
            label: t.name,
            icon: <TeamLogo name={t.name} size={20} />,
            stat,
            statLabel,
            predCount: preds.length,
            predPct: pct,
            predNames: preds,
            isCorrect,
          };
        })
        .sort((a, b) => {
          if (qKey === "minste_goals_tegen_poi") return a.stat - b.stat || b.predCount - a.predCount || a.label.localeCompare(b.label);
          return b.stat - a.stat || b.predCount - a.predCount || a.label.localeCompare(b.label);
        });
    }

    // Player question
    const eventType = qKey === "topscorer_poi" ? "goals" : qKey === "assistenkoning_poi" ? "assists" : "cleanSheets";
    return playerStats
      .filter((p) => p[eventType] > 0)
      .map((p) => {
        const statVal = p[eventType];
        const statLabel = `${statVal}`;
        const preds = predictionsByAnswer[p.name] ?? [];
        const pct = totalPredictions > 0 ? Math.round((preds.length / totalPredictions) * 100) : 0;
        const isCorrect = correctAnswers.includes(p.name.toLowerCase().trim());

        return {
          key: p.name,
          label: p.name,
          icon: null,
          team: p.team,
          stat: statVal,
          statLabel,
          predCount: preds.length,
          predPct: pct,
          predNames: preds,
          isCorrect,
        };
      })
      .sort((a, b) => b.stat - a.stat || a.label.localeCompare(b.label));
  }, [selectedQuestion, teams, teamStats, playerStats, predictionsByAnswer, totalPredictions, correctAnswers]);

  // Football player name → team lookup
  const fpTeamByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const fp of footballPlayers) {
      map.set(fp.name.toLowerCase().trim(), fp.team);
    }
    return map;
  }, [footballPlayers]);

  // Find predictions that don't match any ranking row
  const otherPredictions = useMemo(() => {
    const rankedKeys = new Set(rankingRows.map((r) => r.key));
    const others: { answer: string; count: number; names: string[]; team: string }[] = [];
    for (const [answer, names] of Object.entries(predictionsByAnswer)) {
      if (!rankedKeys.has(answer)) {
        const team = fpTeamByName.get(answer.toLowerCase().trim()) ?? "";
        others.push({ answer, count: names.length, names, team });
      }
    }
    return others.sort((a, b) => b.count - a.count);
  }, [rankingRows, predictionsByAnswer, fpTeamByName]);

  const isTeamQuestion = selectedQuestion ? TEAM_QUESTIONS.has(selectedQuestion.question_key) : false;

  return (
    <div>
      {/* Question selector */}
      <h3 className="text-xl font-semibold text-white mb-1">
        Extra Vragen
      </h3>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cb-blue text-white"
          >
            {selectedQuestion?.question_label ?? "Selecteer vraag"}
            <span className="text-xs opacity-70 ml-1">
              ({selectedQuestion?.points ?? 0} ptn)
            </span>
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
              {sortedQuestions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => {
                    setSelectedQuestionId(q.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm whitespace-nowrap transition-colors flex items-center justify-between gap-4 ${
                    selectedQuestionId === q.id
                      ? "text-white bg-white/[0.06]"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <span>{q.question_label}</span>
                  <span className="text-xs text-gray-500">{q.points} ptn</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ranking table */}
      <div className="glass-card-subtle overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full">
          <thead>
            <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left font-normal px-5 py-3 w-12">#</th>
              <th className="text-left font-normal py-3">
                {isTeamQuestion ? "Ploeg" : "Speler"}
              </th>
              {!isTeamQuestion && (
                <th className="text-left font-normal py-3 w-28">Ploeg</th>
              )}
              <th className="text-right font-normal px-3 py-3 w-20">
                {STAT_LABELS[selectedQuestion?.question_key ?? ""] ?? "Stat"}
              </th>
              <th className="text-right font-normal px-3 py-3 w-28 pr-5">Voorspeld</th>
            </tr>
          </thead>
          <tbody>
            {rankingRows.map((row, i) => {
              const isOpen = expandedRows.has(row.key);
              return (
                <RankingTableRow
                  key={row.key}
                  rank={i + 1}
                  row={row}
                  isTeamQuestion={isTeamQuestion}
                  isOpen={isOpen}
                  onToggle={() => {
                    const next = new Set(expandedRows);
                    if (isOpen) next.delete(row.key);
                    else next.add(row.key);
                    setExpandedRows(next);
                  }}
                />
              );
            })}
            {otherPredictions.length > 0 && (
              <>
                <tr className="border-t border-white/[0.06]">
                  <td colSpan={isTeamQuestion ? 4 : 5} className="px-5 py-2 text-[11px] text-gray-500 uppercase tracking-wider">
                    Andere voorspellingen
                  </td>
                </tr>
                {otherPredictions.map((op) => {
                  const isOpen = expandedRows.has(`other_${op.answer}`);
                  return (
                    <React.Fragment key={`other_${op.answer}`}>
                      <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-gray-600">—</td>
                        <td className="py-3 text-sm text-gray-400">
                          {op.answer}
                        </td>
                        {!isTeamQuestion && (
                          <td className="py-3 text-sm text-gray-500">{op.team}</td>
                        )}
                        <td className="text-right px-3 py-3 text-sm text-gray-500">—</td>
                        <td
                          className="text-right px-3 py-3 pr-5 text-sm text-gray-400 cursor-pointer whitespace-nowrap"
                          onClick={() => {
                            const next = new Set(expandedRows);
                            const key = `other_${op.answer}`;
                            if (isOpen) next.delete(key);
                            else next.add(key);
                            setExpandedRows(next);
                          }}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {op.count > 0 && (
                              <svg
                                className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                            {op.count} ({totalPredictions > 0 ? Math.round((op.count / totalPredictions) * 100) : 0}%)
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td />
                          <td colSpan={isTeamQuestion ? 3 : 4} className="pb-3 pt-0">
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {op.names.map((n) => (
                                <span key={n} className="text-xs text-gray-400">{n}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </tbody>
        </table>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-white/[0.04]">
          <div className="flex items-center px-4 py-2 text-[11px] text-gray-500 uppercase tracking-wider">
            <span className="w-7 text-right shrink-0">#</span>
            <span className="flex-1 ml-2">{isTeamQuestion ? "Ploeg" : "Speler"}</span>
            <span className="text-right shrink-0 ml-2">
              {STAT_LABELS[selectedQuestion?.question_key ?? ""] ?? "Stat"}
            </span>
            <span className="text-right shrink-0 ml-2">Voorsp.</span>
          </div>
          {rankingRows.map((row, i) => {
            const isOpen = expandedRows.has(row.key);
            return (
              <div key={row.key}>
                <div
                  className={`flex items-center px-4 py-3 ${row.isCorrect ? "border-l-2 border-cb-gold" : ""}`}
                  onClick={() => {
                    if (row.predCount > 0) {
                      const next = new Set(expandedRows);
                      if (isOpen) next.delete(row.key);
                      else next.add(row.key);
                      setExpandedRows(next);
                    }
                  }}
                >
                  <span className="heading-display text-base w-7 text-right shrink-0 text-gray-500">
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-2 flex-1 ml-2 min-w-0">
                    {row.icon}
                    <div className="min-w-0">
                      <span className={`text-sm font-medium truncate block ${row.isCorrect ? "text-cb-gold" : "text-gray-200"}`}>
                        {row.label}
                      </span>
                      {"team" in row && row.team && (
                        <span className="text-xs text-gray-500">{row.team as string}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-right text-sm text-white shrink-0 whitespace-nowrap ml-2">
                    {row.statLabel}
                  </span>
                  <div className="text-right shrink-0 flex items-center justify-end gap-1 ml-2 min-w-[2.5rem]">
                    {row.predCount > 0 && (
                      <svg
                        className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                    <span className="text-sm text-gray-400">
                      {row.predCount > 0 ? `${row.predCount}` : "—"}
                    </span>
                  </div>
                </div>
                {isOpen && row.predNames.length > 0 && (
                  <div className="px-4 pb-2 ml-9 flex flex-wrap gap-x-3 gap-y-1">
                    {row.predNames.map((n) => (
                      <span key={n} className="text-xs text-gray-400">{n}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {otherPredictions.length > 0 && (
            <>
              <div className="px-4 py-2 text-[11px] text-gray-500 uppercase tracking-wider border-t border-white/[0.06]">
                Andere voorspellingen
              </div>
              {otherPredictions.map((op) => {
                const isOpen = expandedRows.has(`other_${op.answer}`);
                return (
                  <div key={`other_${op.answer}`}>
                    <div
                      className="flex items-center px-4 py-3 cursor-pointer"
                      onClick={() => {
                        const next = new Set(expandedRows);
                        const key = `other_${op.answer}`;
                        if (isOpen) next.delete(key);
                        else next.add(key);
                        setExpandedRows(next);
                      }}
                    >
                      <span className="w-7 text-right shrink-0 text-gray-600">—</span>
                      <div className="flex-1 ml-2 min-w-0">
                        <span className="text-sm text-gray-400 truncate block">{op.answer}</span>
                        {!isTeamQuestion && op.team && (
                          <span className="text-xs text-gray-500">{op.team}</span>
                        )}
                      </div>
                      <span className="w-12 text-right text-sm text-gray-600">—</span>
                      <div className="w-16 text-right shrink-0 flex items-center justify-end gap-1">
                        <svg
                          className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className="text-sm text-gray-400">{op.count}</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-2 ml-9 flex flex-wrap gap-x-3 gap-y-1">
                        {op.names.map((n) => (
                          <span key={n} className="text-xs text-gray-400">{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {rankingRows.length === 0 && otherPredictions.length === 0 && (
          <div className="p-12 text-center text-gray-500 text-sm">
            Nog geen data beschikbaar.
          </div>
        )}
      </div>
    </div>
  );
}

function RankingTableRow({
  rank,
  row,
  isTeamQuestion,
  isOpen,
  onToggle,
}: {
  rank: number;
  row: {
    key: string;
    label: string;
    icon: React.ReactNode | null;
    stat: number;
    statLabel: string;
    predCount: number;
    predPct: number;
    predNames: string[];
    isCorrect: boolean;
    team?: string;
  };
  isTeamQuestion: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
          row.isCorrect ? "border-l-2 border-l-cb-gold" : ""
        }`}
      >
        <td className="px-5 py-3">
          <span className="heading-display text-lg text-gray-500">{rank}</span>
        </td>
        <td className="py-3">
          <div className="flex items-center gap-2.5">
            {row.icon}
            <span className={`text-sm font-medium ${row.isCorrect ? "text-cb-gold" : "text-gray-200"}`}>
              {row.label}
            </span>
          </div>
        </td>
        {!isTeamQuestion && (
          <td className="py-3 text-sm text-gray-500">{row.team ?? ""}</td>
        )}
        <td className="text-right px-3 py-3 text-sm font-bold text-white whitespace-nowrap">
          {row.statLabel}
        </td>
        <td
          className="text-right px-3 py-3 pr-5 text-sm text-gray-400 cursor-pointer whitespace-nowrap"
          onClick={onToggle}
        >
          <div className="flex items-center justify-end gap-1">
            {row.predCount > 0 && (
              <svg
                className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
            {row.predCount > 0
              ? `${row.predCount} (${row.predPct}%)`
              : "—"}
          </div>
        </td>
      </tr>
      {isOpen && row.predNames.length > 0 && (
        <tr>
          <td />
          <td colSpan={isTeamQuestion ? 3 : 4} className="pb-2 pt-0">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {row.predNames.map((n) => (
                <span key={n} className="text-xs text-gray-400">{n}</span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
