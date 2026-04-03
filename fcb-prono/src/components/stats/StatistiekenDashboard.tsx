"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import StatsSummaryCards from "./StatsSummaryCards";
import OverzichtTab from "./tabs/OverzichtTab";
import ExtraVragenTab from "./tabs/ExtraVragenTab";
import WedstrijdenTab from "./tabs/WedstrijdenTab";
import SpelersTab from "./tabs/SpelersTab";
import type {
  Team,
  Match,
  Result,
  Prediction,
  ExtraQuestion,
  ExtraPrediction,
  ExtraQuestionAnswer,
  PlayerScore,
  FootballPlayer,
  Edition,
  EditionScore,
} from "@/lib/types";

interface PlayerRow {
  id: string;
  display_name: string;
  favorite_team: string | null;
  [key: string]: unknown;
}

interface StatistiekenDashboardProps {
  players: PlayerRow[];
  playerScores: PlayerScore[];
  matches: (Match & { home_team: Team; away_team: Team })[];
  results: Result[];
  predictions: Prediction[];
  extraQuestions: ExtraQuestion[];
  extraPredictions: ExtraPrediction[];
  extraAnswers: ExtraQuestionAnswer[];
  teams: Team[];
  matchEvents: { id: number; match_id: number; event_type: string; player_name: string; football_player_id: number | null; team_id: number; minute: number }[];
  footballPlayers: FootballPlayer[];
  editions: Edition[];
  editionScores: EditionScore[];
}

const TABS = [
  { key: "overzicht", label: "Overzicht" },
  { key: "extra", label: "Extra vragen" },
  { key: "wedstrijden", label: "Wedstrijden" },
  { key: "spelers", label: "Spelers" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function StatistiekenDashboard({
  players,
  playerScores,
  matches,
  results,
  predictions,
  extraQuestions,
  extraPredictions,
  extraAnswers,
  teams,
  matchEvents,
  footballPlayers,
  editions,
  editionScores,
}: StatistiekenDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overzicht");
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

  // Filter predictions to only include known players
  const validPredictions = useMemo(() => {
    const ids = new Set(players.map((p) => p.id));
    return predictions.filter((p) => ids.has(p.user_id));
  }, [predictions, players]);
  const validExtraPredictions = useMemo(() => {
    const ids = new Set(players.map((p) => p.id));
    return extraPredictions.filter((p) => ids.has(p.user_id));
  },
    [extraPredictions, players]
  );

  const totalExactScores = useMemo(
    () => playerScores.reduce((sum, s) => sum + (s.exact_matches ?? 0), 0),
    [playerScores]
  );

  const favoriteTeam = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of players) {
      if (p.favorite_team) {
        counts[p.favorite_team] = (counts[p.favorite_team] || 0) + 1;
      }
    }
    let maxTeam: string | null = null;
    let maxCount = 0;
    for (const [team, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxTeam = team;
      }
    }
    return maxTeam;
  }, [players]);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-6 md:py-16">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="heading-display text-[8rem] md:text-[14rem] lg:text-[18rem] text-white/[0.02] leading-none tracking-wider">
            STATISTIEKEN
          </span>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 text-center">
          <span className="heading-display text-xs md:text-sm text-gray-500 tracking-[0.3em]">
            Play-Offs I
          </span>
          <h1 className="heading-display text-5xl md:text-8xl lg:text-9xl leading-none mt-2 md:mt-4">
            <span className="block text-white">STATISTIEKEN</span>
          </h1>
          <p className="mt-3 md:mt-6 text-gray-400 max-w-md md:max-w-2xl mx-auto text-xs md:text-base leading-relaxed">
            Overzicht van alle prono-data, voorspellingen en resultaten.
          </p>

          <StatsSummaryCards
            playerCount={players.length}
            totalExactScores={totalExactScores}
            favoriteTeam={favoriteTeam}
          />
        </div>
      </section>

      {/* Tab Navigation + Content */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-16">
        {/* Tab Bar — dropdown on mobile, inline buttons on desktop */}
        <div className="mb-6">
          {/* Mobile dropdown */}
          <div className="md:hidden relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cb-blue text-white text-sm font-medium transition-colors justify-between w-auto"
            >
              {TABS.find((t) => t.key === activeTab)?.label}
              <svg
                className={`w-4 h-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 py-1 rounded-lg border border-white/[0.08] bg-[#141920] shadow-xl min-w-full">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "text-white bg-white/[0.06]"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop inline buttons */}
          <div className="hidden md:flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-base font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-cb-blue text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "overzicht" && (
            <OverzichtTab
              players={players}
              teams={teams}
              matches={matches}
              results={results}
              predictions={validPredictions}
              playerScores={playerScores}
            />
          )}
          {activeTab === "wedstrijden" && (
            <WedstrijdenTab
              players={players}
              matches={matches}
              results={results}
              predictions={validPredictions}
            />
          )}
          {activeTab === "spelers" && (
            <SpelersTab
              players={players}
              playerScores={playerScores}
              matches={matches}
              results={results}
              predictions={validPredictions}
              editions={editions}
              editionScores={editionScores}
            />
          )}
          {activeTab === "extra" && (
            <ExtraVragenTab
              players={players}
              playerScores={playerScores}
              extraQuestions={extraQuestions}
              extraPredictions={validExtraPredictions}
              extraAnswers={extraAnswers}
              teams={teams}
              results={results}
              matches={matches}
              matchEvents={matchEvents}
              footballPlayers={footballPlayers}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function TabPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="heading-display text-2xl md:text-3xl text-white mb-2">
        {title}
      </div>
      <p className="text-gray-500 text-sm">{description}</p>
      <p className="text-gray-600 text-xs mt-4">Binnenkort beschikbaar</p>
    </div>
  );
}
