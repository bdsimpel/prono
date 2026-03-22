import { createServiceClient } from "@/lib/supabase/server";
import { calculateMatchPoints } from "@/lib/scoring";
import { notFound } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import ForceScrollTop from "@/components/ForceScrollTop";

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

  const [{ data: match }, { data: resultRow }, { data: predictions }, { data: allScores }, { data: deadlineSetting }] =
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
    ]);

  const deadline = deadlineSetting?.value ?? null;
  const shouldHide = !!deadline && new Date(deadline) > new Date();

  if (!match) notFound();

  const result = resultRow;

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
    predWithPoints.sort((a, b) => b.points - a.points || a.rank - b.rank);
  } else {
    predWithPoints.sort((a, b) => a.rank - b.rank);
  }

  const predictionCount = predWithPoints.length;
  const exactCount = predWithPoints.filter(
    (p) => p.category === "exact",
  ).length;
  const correctCount = predWithPoints.filter(
    (p) => p.category === "result" || p.category === "goal_diff",
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
      <div className="glass-card-subtle p-5 md:p-6 mb-6">
        {/* Mobile — Sporza style: logos centered, names below */}
        <div className="md:hidden">
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 flex flex-col items-center text-center min-w-0">
              <TeamLogo name={match.home_team.name} size={48} />
              <span className="heading-display text-sm text-white mt-2 truncate max-w-full">
                {match.home_team.name}
              </span>
            </div>
            <div className="flex flex-col items-center shrink-0">
              {result ? (
                <>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">einde</span>
                  <span className="heading-display text-3xl text-white mt-0.5">
                    {result.home_score} - {result.away_score}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {match.match_datetime
                      ? new Date(match.match_datetime).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </span>
                  <span className="heading-display text-2xl text-gray-600 mt-0.5">VS</span>
                </>
              )}
            </div>
            <div className="flex-1 flex flex-col items-center text-center min-w-0">
              <TeamLogo name={match.away_team.name} size={48} />
              <span className="heading-display text-sm text-white mt-2 truncate max-w-full">
                {match.away_team.name}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop — horizontal: logo + name | score | name + logo */}
        <div className="hidden md:block">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-3 flex-1 justify-end">
              <TeamLogo name={match.home_team.name} size={32} />
              <span className="heading-display text-3xl text-white text-right">{match.home_team.name}</span>
            </div>
            {result ? (
              <span className="heading-display text-3xl text-cb-blue shrink-0">
                {result.home_score} - {result.away_score}
              </span>
            ) : (
              <span className="text-xl text-gray-600 heading-display shrink-0">VS</span>
            )}
            <div className="flex items-center gap-3 flex-1">
              <span className="heading-display text-3xl text-white">{match.away_team.name}</span>
              <TeamLogo name={match.away_team.name} size={32} />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          {match.is_cup_final ? "Bekerfinale" : `Speeldag ${match.speeldag}`}
          {match.match_datetime &&
            ` — ${new Date(match.match_datetime).toLocaleDateString("nl-BE", { dateStyle: "long" })}`}
        </p>
      </div>

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
        {result && (
          <>
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
          </>
        )}
      </div>

      {/* Predictions */}
      <h2 className="heading-display text-xl text-gray-400 mb-3">
        VOORSPELLINGEN
      </h2>

      <div className="space-y-2">
        {predWithPoints.length === 0 ? (
          <div className="glass-card-subtle p-12 text-center text-gray-600 text-sm">
            Nog geen voorspellingen voor deze wedstrijd.
          </div>
        ) : (
          predWithPoints.map((pred) => (
            <div key={pred.id} className="glass-card-subtle p-3 md:p-4">
              <div className="flex items-center justify-between gap-2 md:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 font-medium truncate">
                    {pred.display_name}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>
                      <span className="text-gray-500">Prono: </span>
                      <span className="text-gray-300 font-bold">
                        {shouldHide ? (
                          <span className="blur-sm select-none">?-?</span>
                        ) : (
                          <>{pred.home_score}-{pred.away_score}</>
                        )}
                      </span>
                    </span>
                    {result && (
                      <span>
                        <span className="text-gray-500">Uitslag: </span>
                        <span className="text-gray-300 font-bold">
                          {result.home_score}-{result.away_score}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  {getCategoryBadge(pred.category)}
                  <span
                    className={`heading-display text-lg w-10 text-right ${getCategoryPointColor(pred.category)}`}
                  >
                    {result ? `+${pred.points}` : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
