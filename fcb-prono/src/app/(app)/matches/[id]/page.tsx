import { createServiceClient } from "@/lib/supabase/server";
import { calculateMatchPoints } from "@/lib/scoring";
import { notFound } from "next/navigation";
import Link from "next/link";
import ForceScrollTop from "@/components/ForceScrollTop";
import LiveMatchHeader from "@/components/LiveMatchHeader";
import LivePredictionList from "@/components/LivePredictionList";
import MatchPredictionList from "@/components/MatchPredictionList";
import type { GoalEvent } from "@/components/MatchGoalTimeline";

export const revalidate = false;

function getCategoryBadge(category: string) {
  switch (category) {
    case "exact":
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-gold/40 text-cb-gold">
          Exact
        </span>
      );
    case "goal_diff":
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-blue/30 text-cb-blue">
          Goal verschil
        </span>
      );
    case "result":
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-blue/25 text-cb-blue/80">
          Juist resultaat
        </span>
      );
    case "wrong":
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-white/10 text-gray-500">
          Fout
        </span>
      );
    default:
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-white/10 text-gray-600">
          Afwachting
        </span>
      );
  }
}

function getCategoryPointColor(category: string) {
  switch (category) {
    case "exact":
      return "text-cb-gold";
    case "goal_diff":
      return "text-cb-blue";
    case "result":
      return "text-cb-blue/80";
    case "wrong":
      return "text-gray-500";
    default:
      return "text-gray-600";
  }
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const [{ data: match }, { data: resultRow }, { data: predictions }, { data: allScores }, { data: deadlineSetting }, { data: matchEvents }] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          `*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)`,
        )
        .eq("id", id)
        .single(),
      supabase.from("results").select("*").eq("match_id", id).maybeSingle(),
      supabase
        .from("predictions")
        .select("*, players!inner(id, display_name)")
        .eq("match_id", id),
      supabase
        .from("player_scores")
        .select("user_id, total_score")
        .order("total_score", { ascending: false }),
      supabase
        .from("settings")
        .select("value")
        .eq("key", "deadline")
        .maybeSingle(),
      supabase
        .from("match_events")
        .select("event_type, player_name, team_id, minute, extra_minute, seq, detail")
        .eq("match_id", id)
        .in("event_type", ["goal", "assist"])
        .order("seq", { ascending: true }),
    ]);

  const deadline = deadlineSetting?.value ?? null;
  const shouldHide = !!deadline && new Date(deadline) > new Date();

  if (!match) notFound();

  const result = resultRow;

  // Pair goals with assists by seq
  const dbGoalEvents: GoalEvent[] = [];
  if (matchEvents) {
    const goals = matchEvents.filter(e => e.event_type === 'goal');
    const assists = matchEvents.filter(e => e.event_type === 'assist');
    for (const goal of goals) {
      const assist = assists.find(a => a.seq === goal.seq);
      dbGoalEvents.push({
        playerName: goal.player_name,
        assistName: assist?.player_name ?? null,
        minute: goal.minute ?? 0,
        extraMinute: goal.extra_minute ?? null,
        detail: goal.detail || 'Normal Goal',
        teamId: goal.team_id,
        seq: goal.seq,
      });
    }
  }

  // Build rank map from leaderboard
  const rankMap: Record<string, number> = {};
  if (allScores) {
    let currentRank = 0;
    let prevScore = -1;
    for (let i = 0; i < allScores.length; i++) {
      if (allScores[i].total_score !== prevScore) currentRank = i + 1;
      rankMap[allScores[i].user_id] = currentRank;
      prevScore = allScores[i].total_score;
    }
  }

  type Category = "exact" | "goal_diff" | "result" | "wrong" | "pending";

  const predWithPoints: {
    id: number;
    home_score: number;
    away_score: number;
    display_name: string;
    user_id: string;
    points: number;
    category: Category;
    rank: number;
  }[] = (predictions || []).map((pred) => {
    const profile = pred.players as { id: string; display_name: string };
    if (!result) {
      return {
        id: pred.id,
        home_score: pred.home_score,
        away_score: pred.away_score,
        display_name: profile.display_name,
        user_id: profile.id,
        points: 0,
        category: "pending" as Category,
        rank: rankMap[profile.id] ?? Infinity,
      };
    }

    const { points, category } = calculateMatchPoints(
      pred.home_score,
      pred.away_score,
      result.home_score,
      result.away_score,
    );

    return {
      id: pred.id,
      home_score: pred.home_score,
      away_score: pred.away_score,
      display_name: profile.display_name,
      user_id: profile.id,
      points,
      category: category as Category,
      rank: rankMap[profile.id] ?? Infinity,
    };
  });

  if (result) {
    predWithPoints.sort((a, b) => b.points - a.points || a.rank - b.rank || a.display_name.localeCompare(b.display_name));
  } else {
    predWithPoints.sort((a, b) => a.rank - b.rank || a.display_name.localeCompare(b.display_name));
  }

  const predictionCount = predWithPoints.length;
  const exactCount = predWithPoints.filter(
    (p) => p.category === "exact",
  ).length;
  const correctCount = predWithPoints.filter(
    (p) => p.category === "exact" || p.category === "result" || p.category === "goal_diff",
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <ForceScrollTop />
      {/* Back + close */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/matches"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Alle wedstrijden
        </Link>
        <Link
          href="/matches"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Link>
      </div>

      {/* Match header */}
      <LiveMatchHeader
        matchId={match.id}
        homeTeamName={match.home_team.name}
        awayTeamName={match.away_team.name}
        homeTeamId={match.home_team_id}
        awayTeamId={match.away_team_id}
        matchDatetime={match.match_datetime}
        fixtureId={match.api_football_fixture_id}
        result={result ? { home_score: result.home_score, away_score: result.away_score } : null}
        speeldag={match.speeldag}
        isCupFinal={match.is_cup_final}
        dbGoalEvents={dbGoalEvents}
        formattedTime={match.match_datetime ? new Date(match.match_datetime).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }) : undefined}
        formattedDate={match.match_datetime ? new Date(match.match_datetime).toLocaleDateString("nl-BE", { dateStyle: "long", timeZone: "Europe/Brussels" }) : undefined}
      />

      {result ? (
        <>
          {/* Stats row */}
          <div className="flex items-center gap-6 md:gap-10 mb-8 px-2">
            <div className="text-center">
              <div className="heading-display text-3xl text-cb-blue font-bold">
                {predictionCount}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
                Voorspellingen
              </div>
            </div>
            <div className="stat-divider" />
            <div className="text-center">
              <div className="heading-display text-3xl text-white font-bold">
                {exactCount}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
                Exact
              </div>
            </div>
            <div className="stat-divider" />
            <div className="text-center">
              <div className="heading-display text-3xl text-white font-bold">
                {correctCount}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
                Correct
              </div>
            </div>
          </div>

          {/* Predictions */}
          <h2 className="heading-display text-xl text-gray-400 mb-3">
            VOORSPELLINGEN
          </h2>

          <MatchPredictionList
            predictions={predWithPoints}
            resultHome={result.home_score}
            resultAway={result.away_score}
            shouldHide={shouldHide}
          />
        </>
      ) : (
        <LivePredictionList
          predictions={predWithPoints.map(p => ({
            id: p.id,
            home_score: p.home_score,
            away_score: p.away_score,
            display_name: p.display_name,
            user_id: p.user_id,
            rank: p.rank,
          }))}
          matchId={match.id}
          fixtureId={match.api_football_fixture_id}
          matchDatetime={match.match_datetime}
          hasResult={false}
          shouldHide={shouldHide}
        />
      )}
    </div>
  );
}
