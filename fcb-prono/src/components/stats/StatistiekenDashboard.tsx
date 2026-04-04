"use client";

import { useState, useRef, useCallback, useMemo } from "react";
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
  Subgroup,
  PlayerSubgroup,
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
  subgroups: Subgroup[];
  playerSubgroups: PlayerSubgroup[];
}

const TABS = [
  { key: "overzicht", label: "Voorspellingen" },
  { key: "extra", label: "Extra vragen" },
  { key: "wedstrijden", label: "Wedstrijden" },
  { key: "spelers", label: "Deelnemers" },
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
  subgroups,
  playerSubgroups,
}: StatistiekenDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overzicht");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pillBarRef = useRef<HTMLDivElement>(null);

  const scrollToTab = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.offsetWidth;
    scrollRef.current.scrollTo({ left: index * containerWidth, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, offsetWidth } = scrollRef.current;
    const index = Math.round(scrollLeft / offsetWidth);
    if (index >= 0 && index < TABS.length) {
      setActiveTab(TABS[index].key);
      // Auto-scroll pill bar to center the active pill
      if (pillBarRef.current) {
        const pill = pillBarRef.current.children[0]?.children[index] as HTMLElement;
        if (pill) {
          const barWidth = pillBarRef.current.offsetWidth;
          const pillLeft = pill.offsetLeft;
          const pillWidth = pill.offsetWidth;
          pillBarRef.current.scrollTo({
            left: pillLeft - barWidth / 2 + pillWidth / 2,
            behavior: "smooth",
          });
        }
      }
    }
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
      <section className="max-w-7xl mx-auto md:px-6 pb-16">

        {/* Mobile: scrollable pill bar that follows the swipe */}
        <div ref={pillBarRef} className="md:hidden overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-4 px-4">
          <div className="flex gap-2 w-max">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  scrollToTab(i);
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-cb-blue text-white"
                    : "text-gray-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: pill bar */}
        <div className="hidden md:flex gap-1.5 mb-6">
          {TABS.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                scrollToTab(i);
              }}
              className={`py-2.5 px-5 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-cb-blue text-white"
                  : "text-gray-400 border border-white/[0.1] hover:text-white hover:border-white/[0.2]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Mobile: swipeable pages ── */}
        <div className="md:hidden">
          {/* Swipeable container */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain]"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {TABS.map((tab) => (
              <div
                key={tab.key}
                className="w-full shrink-0 px-4"
                style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
              >
                {tab.key === "overzicht" && (
                  <OverzichtTab
                    players={players}
                    teams={teams}
                    matches={matches}
                    results={results}
                    predictions={validPredictions}
                    playerScores={playerScores}
                    subgroups={subgroups}
                    playerSubgroups={playerSubgroups}
                  />
                )}
                {tab.key === "extra" && (
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
                {tab.key === "wedstrijden" && (
                  <WedstrijdenTab
                    players={players}
                    matches={matches}
                    results={results}
                    predictions={validPredictions}
                  />
                )}
                {tab.key === "spelers" && (
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
              </div>
            ))}
          </div>
        </div>

        {/* ── Desktop: conditional content ── */}
        <div className="hidden md:block">
          <div>
            {activeTab === "overzicht" && (
              <OverzichtTab
                players={players}
                teams={teams}
                matches={matches}
                results={results}
                predictions={validPredictions}
                playerScores={playerScores}
                subgroups={subgroups}
                playerSubgroups={playerSubgroups}
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
