import { createClient } from "@/lib/supabase/server";
import { calculateMatchPoints } from "@/lib/scoring";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getTeamLogo } from "@/lib/teamLogos";

export const dynamic = "force-dynamic";

function TeamLogo({ name, size = 32 }: { name: string; size?: number }) {
  const logo = getTeamLogo(name);
  if (!logo) return null;
  return (
    <Image
      src={logo}
      alt={name}
      width={size}
      height={size}
      className="inline-block"
    />
  );
}

function getCategoryBadge(category: string) {
  switch (category) {
    case "exact":
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-blue/40 text-cb-blue">
          Exact
        </span>
      );
    case "goal_diff":
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-blue/25 text-cb-blue/80">
          Doelpuntenverschil
        </span>
      );
    case "result":
      return (
        <span className="text-xs px-2.5 py-1 rounded border border-cb-gold/30 text-cb-gold">
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
      return "text-cb-blue";
    case "goal_diff":
      return "text-cb-blue/80";
    case "result":
      return "text-cb-gold";
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
  const supabase = await createClient();

  const [{ data: match }, { data: resultRow }, { data: predictions }] =
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
        .select("*, players!inner(display_name)")
        .eq("match_id", id),
    ]);

  if (!match) notFound();

  const result = resultRow;

  type Category = "exact" | "goal_diff" | "result" | "wrong" | "pending";

  const predWithPoints: {
    id: number;
    home_score: number;
    away_score: number;
    display_name: string;
    points: number;
    category: Category;
  }[] = (predictions || []).map((pred) => {
    const profile = pred.players as { display_name: string };
    if (!result) {
      return {
        id: pred.id,
        home_score: pred.home_score,
        away_score: pred.away_score,
        display_name: profile.display_name,
        points: 0,
        category: "pending" as Category,
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
      points,
      category: category as Category,
    };
  });

  predWithPoints.sort((a, b) => b.points - a.points);

  const predictionCount = predWithPoints.length;
  const exactCount = predWithPoints.filter(
    (p) => p.category === "exact",
  ).length;
  const correctCount = predWithPoints.filter(
    (p) => p.category === "result" || p.category === "goal_diff",
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
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
      <div className="glass-card-subtle p-6 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
          <div className="flex items-center gap-3">
            <TeamLogo name={match.home_team.name} size={40} />
            <span className="heading-display text-2xl md:text-3xl text-white">
              {match.home_team.name}
            </span>
          </div>
          {result ? (
            <span className="heading-display text-3xl text-cb-blue">
              {result.home_score} - {result.away_score}
            </span>
          ) : (
            <span className="text-xl text-gray-600 heading-display">VS</span>
          )}
          <div className="flex items-center gap-3">
            <span className="heading-display text-2xl md:text-3xl text-white">
              {match.away_team.name}
            </span>
            <TeamLogo name={match.away_team.name} size={40} />
          </div>
        </div>
        <p className="text-center text-xs text-gray-500 mt-3">
          {match.is_cup_final
            ? "Bekerfinale"
            : `Speeldag ${match.speeldag}`}
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
            <div key={pred.id} className="glass-card-subtle p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 font-medium">
                    {pred.display_name}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                    <span>
                      Prono:{" "}
                      <span className="text-gray-300 font-bold">
                        {pred.home_score}-{pred.away_score}
                      </span>
                    </span>
                    {result && (
                      <>
                        <span className="text-gray-600">&rarr;</span>
                        <span>
                          Uitslag:{" "}
                          <span className="text-gray-300 font-bold">
                            {result.home_score}-{result.away_score}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {getCategoryBadge(pred.category)}
                  <span
                    className={`heading-display text-lg w-8 text-right ${getCategoryPointColor(pred.category)}`}
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
