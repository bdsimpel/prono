"use client";

import React, { useState, useMemo } from "react";
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

interface RankingRow {
  key: string;
  label: string;
  icon: React.ReactNode | null;
  stat: number;
  statLabel: string;
  gamesPlayed?: number;
  predCount: number;
  predPct: number;
  predNames: string[];
  isCorrect: boolean;
  team?: string;
}

export default function ExtraVragenTab({
  players,
  extraQuestions,
  extraPredictions,
  extraAnswers,
  teams,
  results,
  matches,
  matchEvents,
  footballPlayers,
}: ExtraVragenTabProps) {
  const sortedQuestions = useMemo(() => {
    return [...extraQuestions].sort((a, b) => {
      const ai = QUESTION_ORDER.indexOf(a.question_key);
      const bi = QUESTION_ORDER.indexOf(b.question_key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [extraQuestions]);

  // Shared lookups
  const fpMap = useMemo(() => {
    const map = new Map<number, FootballPlayer>();
    for (const fp of footballPlayers) map.set(fp.id, fp);
    return map;
  }, [footballPlayers]);

  const teamMap = useMemo(() => {
    const map = new Map<number, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  const matchById = useMemo(() => {
    const map = new Map<number, (typeof matches)[number]>();
    for (const m of matches) map.set(m.id, m);
    return map;
  }, [matches]);

  const fpTeamByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const fp of footballPlayers) {
      map.set(fp.name.toLowerCase().trim(), fp.team);
    }
    return map;
  }, [footballPlayers]);

  // Player lookup
  const playerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) map.set(p.id, p.display_name);
    return map;
  }, [players]);

  // Team stats (shared across team questions)
  const teamStats = useMemo(() => {
    const stats: Record<number, { points: number; goalsFor: number; goalsAgainst: number; played: number }> = {};
    for (const t of teams) {
      stats[t.id] = { points: 0, goalsFor: 0, goalsAgainst: 0, played: 0 };
    }
    for (const r of results) {
      const match = matchById.get(r.match_id);
      if (!match || match.is_cup_final) continue;
      const hid = match.home_team_id;
      const aid = match.away_team_id;
      if (stats[hid]) {
        stats[hid].played++;
        stats[hid].goalsFor += r.home_score;
        stats[hid].goalsAgainst += r.away_score;
        if (r.home_score > r.away_score) stats[hid].points += 3;
        else if (r.home_score === r.away_score) stats[hid].points += 1;
      }
      if (stats[aid]) {
        stats[aid].played++;
        stats[aid].goalsFor += r.away_score;
        stats[aid].goalsAgainst += r.home_score;
        if (r.away_score > r.home_score) stats[aid].points += 3;
        else if (r.home_score === r.away_score) stats[aid].points += 1;
      }
    }
    return stats;
  }, [results, matchById, teams]);

  // Player stats from match_events (shared across player questions)
  const playerStats = useMemo(() => {
    const stats: Record<string, { name: string; team: string; goals: number; assists: number; cleanSheets: number }> = {};
    for (const ev of matchEvents) {
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

  // Pre-compute predictions grouped by question
  const predictionsByQuestion = useMemo(() => {
    const map = new Map<number, Record<string, string[]>>();
    for (const ep of extraPredictions) {
      if (!map.has(ep.question_id)) map.set(ep.question_id, {});
      const groups = map.get(ep.question_id)!;
      if (!groups[ep.answer]) groups[ep.answer] = [];
      const name = playerMap.get(ep.user_id);
      if (name) groups[name === ep.answer ? ep.answer : ep.answer] = groups[ep.answer];
      if (name) {
        if (!groups[ep.answer]) groups[ep.answer] = [];
        groups[ep.answer].push(name);
      }
    }
    // Sort names
    for (const [, groups] of map) {
      for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => a.localeCompare(b));
      }
    }
    return map;
  }, [extraPredictions, playerMap]);

  // Correct answers per question
  const correctAnswersByQuestion = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const a of extraAnswers) {
      if (!map.has(a.question_id)) map.set(a.question_id, []);
      map.get(a.question_id)!.push(a.correct_answer.toLowerCase().trim());
    }
    return map;
  }, [extraAnswers]);

  // Build ranking rows for a specific question
  function buildRankingRows(question: ExtraQuestion): { rows: RankingRow[]; others: { answer: string; count: number; names: string[]; team: string }[]; isTeamQ: boolean; totalPreds: number } {
    const qKey = question.question_key;
    const isTeamQ = TEAM_QUESTIONS.has(qKey);
    const preds = predictionsByQuestion.get(question.id) ?? {};
    const totalPreds = Object.values(preds).reduce((sum, names) => sum + names.length, 0);
    const correctAns = correctAnswersByQuestion.get(question.id) ?? [];

    let rows: RankingRow[];

    if (isTeamQ) {
      const cupFinal = matches.find((m) => m.is_cup_final);
      const cupTeamIds = cupFinal ? new Set([cupFinal.home_team_id, cupFinal.away_team_id]) : null;
      const teamsToShow = qKey === "bekerwinnaar" && cupTeamIds
        ? teams.filter((t) => cupTeamIds.has(t.id))
        : teams;

      rows = teamsToShow.map((t) => {
        const s = teamStats[t.id] ?? { points: 0, goalsFor: 0, goalsAgainst: 0 };
        const teamPreds = preds[t.name] ?? [];
        let stat = 0;
        let statLabel = "";
        if (qKey === "beste_ploeg_poi") { stat = s.points; statLabel = `${s.points} ptn`; }
        else if (qKey === "meeste_goals_poi") { stat = s.goalsFor; statLabel = `${s.goalsFor} goals`; }
        else if (qKey === "minste_goals_tegen_poi") { stat = s.goalsAgainst; statLabel = `${s.goalsAgainst} tegen`; }
        else if (qKey === "kampioen") { const tp = (t.points_half ?? 0) + s.points; stat = tp; statLabel = `${tp} ptn`; }
        else if (qKey === "bekerwinnaar") { stat = teamPreds.length; statLabel = ""; }

        const pct = totalPreds > 0 ? Math.round((teamPreds.length / totalPreds) * 100) : 0;
        return {
          key: t.name, label: t.name, icon: <TeamLogo name={t.name} size={18} />,
          stat, statLabel, gamesPlayed: qKey !== "bekerwinnaar" ? s.played : undefined,
          predCount: teamPreds.length, predPct: pct, predNames: teamPreds,
          isCorrect: correctAns.includes(t.name.toLowerCase().trim()),
        };
      }).sort((a, b) => {
        if (qKey === "minste_goals_tegen_poi") return a.stat - b.stat || b.predCount - a.predCount || a.label.localeCompare(b.label);
        return b.stat - a.stat || b.predCount - a.predCount || a.label.localeCompare(b.label);
      });
    } else {
      const eventType = qKey === "topscorer_poi" ? "goals" : qKey === "assistenkoning_poi" ? "assists" : "cleanSheets";
      rows = playerStats
        .filter((p) => p[eventType] > 0)
        .map((p) => {
          const statVal = p[eventType];
          const playerPreds = preds[p.name] ?? [];
          const pct = totalPreds > 0 ? Math.round((playerPreds.length / totalPreds) * 100) : 0;
          return {
            key: p.name, label: p.name, icon: null, team: p.team,
            stat: statVal, statLabel: `${statVal}`, predCount: playerPreds.length, predPct: pct,
            predNames: playerPreds, isCorrect: correctAns.includes(p.name.toLowerCase().trim()),
          };
        })
        .sort((a, b) => b.stat - a.stat || a.label.localeCompare(b.label));
    }

    // Others
    const rankedKeys = new Set(rows.map((r) => r.key));
    const others: { answer: string; count: number; names: string[]; team: string }[] = [];
    for (const [answer, names] of Object.entries(preds)) {
      if (!rankedKeys.has(answer)) {
        const team = fpTeamByName.get(answer.toLowerCase().trim()) ?? "";
        others.push({ answer, count: names.length, names, team });
      }
    }
    others.sort((a, b) => b.count - a.count);

    return { rows, others, isTeamQ, totalPreds };
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-1">Extra Vragen</h3>
      <p className="text-xs text-gray-500 mb-4">
        8 bonusvragen — tot 90 punten te verdienen
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {sortedQuestions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            data={buildRankingRows(question)}
            fpTeamByName={fpTeamByName}
          />
        ))}
      </div>
    </div>
  );
}

// ── Per-question card ──

function QuestionCard({
  question,
  data,
  fpTeamByName,
}: {
  question: ExtraQuestion;
  data: { rows: RankingRow[]; others: { answer: string; count: number; names: string[]; team: string }[]; isTeamQ: boolean; totalPreds: number };
  fpTeamByName: Map<string, string>;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const { rows, others, isTeamQ, totalPreds } = data;
  const statLabel = STAT_LABELS[question.question_key] ?? "";
  const showGamesPlayed = rows.some(r => r.gamesPlayed != null);

  // Compute ranks with ties (same stat = same rank)
  const ranks = useMemo(() => {
    const result: number[] = [];
    let rank = 1;
    for (let i = 0; i < rows.length; i++) {
      if (i > 0 && rows[i].stat !== rows[i - 1].stat) {
        rank = i + 1;
      }
      result.push(rank);
    }
    return result;
  }, [rows]);
  const DEFAULT_VISIBLE = 6;
  const totalItems = rows.length + others.length;
  const hasMore = !isTeamQ && totalItems > DEFAULT_VISIBLE;
  // Slice across rows + others combined
  const visibleRows = hasMore && !showAll ? rows.slice(0, DEFAULT_VISIBLE) : rows;
  const remainingSlots = hasMore && !showAll ? Math.max(0, DEFAULT_VISIBLE - rows.length) : others.length;
  const visibleOthers = hasMore && !showAll ? others.slice(0, remainingSlots) : others;

  function toggleRow(key: string) {
    const next = new Set(expandedRows);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedRows(next);
  }

  return (
    <div className="glass-card-subtle overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{question.question_label}</span>
          <span className="text-xs text-cb-gold font-medium">{question.points} ptn</span>
        </div>
      </div>

      {/* Column headers */}
      {(statLabel || showGamesPlayed) && (
        <div className="flex items-center px-4 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider">
          <span className="w-5 shrink-0" />
          <div className="flex-1 ml-2" />
          {showGamesPlayed && <span className="w-6 text-center shrink-0">#G</span>}
          {statLabel && <span className="shrink-0 w-[4.5rem] text-right">{statLabel}</span>}
          <span className="min-w-[2.5rem] ml-2" />
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-white/[0.04]">
        {visibleRows.map((row, i) => {
          const isOpen = expandedRows.has(row.key);
          return (
            <div key={row.key}>
              <div
                className={`flex items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors ${
                  row.isCorrect ? "border-l-2 border-cb-gold" : ""
                } ${row.predCount > 0 ? "cursor-pointer" : ""}`}
                onClick={() => row.predCount > 0 && toggleRow(row.key)}
              >
                <span className="text-xs text-gray-500 w-5 text-right shrink-0">{ranks[i]}</span>
                <div className="flex items-center gap-2 flex-1 ml-2 min-w-0">
                  {row.icon}
                  <div className="min-w-0 flex flex-col md:flex-row md:items-center md:gap-2">
                    <span className={`text-sm font-medium truncate ${row.isCorrect ? "text-cb-gold" : "text-gray-200"}`}>
                      {row.label}
                    </span>
                    {!isTeamQ && row.team && (
                      <span className="text-xs text-gray-500 truncate">{row.team}</span>
                    )}
                  </div>
                </div>
                {showGamesPlayed && (
                  <span className="text-xs text-gray-500 w-6 text-center shrink-0">
                    {row.gamesPlayed ?? ""}
                  </span>
                )}
                {statLabel && (
                  <span className="text-sm font-bold text-white shrink-0 whitespace-nowrap w-[4.5rem] text-right">
                    {row.statLabel}
                  </span>
                )}
                <div className="flex items-center gap-1 shrink-0 ml-2 min-w-[2.5rem] justify-end">
                  {row.predCount > 0 && (
                    <svg
                      className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                  <span className="text-xs text-gray-400">
                    {row.predCount > 0 ? `${row.predCount}` : "—"}
                  </span>
                </div>
              </div>
              {isOpen && row.predNames.length > 0 && (
                <div className="px-4 pb-2 ml-7 flex flex-wrap gap-x-3 gap-y-1">
                  {row.predNames.map((n) => (
                    <span key={n} className="text-xs text-gray-400">{n}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Other predictions */}
        {visibleOthers.length > 0 && (
          <>
            <div className="px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider">
              Andere
            </div>
            {visibleOthers.map((op) => {
              const isOpen = expandedRows.has(`other_${op.answer}`);
              return (
                <div key={`other_${op.answer}`}>
                  <div
                    className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleRow(`other_${op.answer}`)}
                  >
                    <span className="text-xs text-gray-600 w-5 text-right shrink-0">—</span>
                    <div className="flex-1 ml-2 min-w-0 flex flex-col md:flex-row md:items-center md:gap-2">
                      <span className="text-sm text-gray-400 truncate">{op.answer}</span>
                      {!isTeamQ && op.team && (
                        <span className="text-xs text-gray-500 truncate">{op.team}</span>
                      )}
                    </div>
                    {statLabel && (
                      <span className="text-sm text-gray-600 shrink-0 ml-2">—</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0 ml-2 min-w-[2.5rem] justify-end">
                      <svg
                        className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-xs text-gray-400">{op.count}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-2 ml-7 flex flex-wrap gap-x-3 gap-y-1">
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

        {/* Show more/less toggle */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full px-4 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5 border-t border-white/[0.04]"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showAll ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {showAll ? "Toon minder" : `Toon alle ${totalItems}`}
          </button>
        )}
      </div>

      {rows.length === 0 && others.length === 0 && (
        <div className="p-8 text-center text-gray-500 text-xs">
          Nog geen data
        </div>
      )}
    </div>
  );
}
