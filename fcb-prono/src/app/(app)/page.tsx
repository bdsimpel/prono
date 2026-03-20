import { createServiceClient } from "@/lib/supabase/server";
import InfoModal from "@/components/InfoModal";
import YearSelector from "@/components/YearSelector";
import ErelijstModal from "@/components/ErelijstModal";

export const revalidate = false;

export default async function KlassementPage() {
  const supabase = await createServiceClient();

  const [
    { data: players },
    { data: scores },
    { count: matchCount },
    { count: predictionCount },
    { data: editions },
    { data: editionScores },
    { data: alltimeScores },
  ] = await Promise.all([
    supabase.from("players").select("id, display_name, matched_historical_name"),
    supabase.from("player_scores").select("*"),
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("predictions").select("*", { count: "exact", head: true }),
    supabase.from("editions").select("*").order("year", { ascending: false }),
    supabase.from("edition_scores").select("*"),
    supabase.from("alltime_scores").select("*"),
  ]);

  const scoreMap: Record<
    string,
    typeof scores extends (infer T)[] | null ? T : never
  > = {};
  for (const s of scores || []) {
    scoreMap[s.user_id] = s;
  }

  const allPlayers = (players || []).map((p) => ({
    user_id: p.id,
    display_name: p.display_name,
    total_score: scoreMap[p.id]?.total_score ?? 0,
    match_score: scoreMap[p.id]?.match_score ?? 0,
    extra_score: scoreMap[p.id]?.extra_score ?? 0,
    exact_matches: scoreMap[p.id]?.exact_matches ?? 0,
    correct_goal_diffs: scoreMap[p.id]?.correct_goal_diffs ?? 0,
    correct_results: scoreMap[p.id]?.correct_results ?? 0,
  }));

  allPlayers.sort(
    (a, b) =>
      b.total_score - a.total_score ||
      a.display_name.localeCompare(b.display_name),
  );

  let currentRank = 0;
  let previousScore = -1;
  const standings = allPlayers.map((row, index) => {
    if (row.total_score !== previousScore) {
      currentRank = index + 1;
    }
    previousScore = row.total_score;
    return { ...row, rank: currentRank };
  });

  const playerCount = players?.length ?? 0;

  // Compute augmented all-time scores including current year
  const currentScores = (scores || []).map((s) => s.total_score);
  const hasCurrentScores = currentScores.some((s) => s > 0);
  let augmentedAlltime = alltimeScores ?? [];

  if (hasCurrentScores && currentScores.length > 1) {
    const mean = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
    const stdev = Math.sqrt(
      currentScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (currentScores.length - 1)
    ) || 1;

    // Build map: historical name -> current z-score & rank
    const currentZMap = new Map<string, { zScore: number; rank: number }>();
    for (const standing of standings) {
      const pl = (players || []).find((p) => p.id === standing.user_id);
      const histName = pl?.matched_historical_name || standing.display_name;
      currentZMap.set(histName.toLowerCase(), {
        zScore: (standing.total_score - mean) / stdev,
        rank: standing.rank,
      });
    }

    // Augment existing alltime entries with current year
    const updatedNames = new Set<string>();
    augmentedAlltime = (alltimeScores ?? []).map((at) => {
      const current = currentZMap.get(at.player_name.toLowerCase());
      if (!current) return at;
      updatedNames.add(at.player_name.toLowerCase());
      const newYears = at.years_played + 1;
      const newAvgZ = ((at.avg_z_score ?? 0) * at.years_played + current.zScore) / newYears;
      const newBestRank = current.rank < (at.best_rank ?? Infinity) ? current.rank : at.best_rank;
      const newBestYear = current.rank < (at.best_rank ?? Infinity) ? 2026 : at.best_rank_year;
      return {
        ...at,
        years_played: newYears,
        avg_z_score: newAvgZ,
        best_rank: newBestRank,
        best_rank_year: newBestYear,
      };
    });

    // Add new players who aren't in historical alltime yet
    for (const standing of standings) {
      const pl = (players || []).find((p) => p.id === standing.user_id);
      const histName = pl?.matched_historical_name || standing.display_name;
      if (!updatedNames.has(histName.toLowerCase())) {
        const current = currentZMap.get(histName.toLowerCase());
        if (current) {
          augmentedAlltime.push({
            id: 0,
            player_name: standing.display_name,
            years_played: 1,
            avg_z_score: current.zScore,
            avg_percentile: null,
            avg_points_pct: null,
            combined_score: null,
            best_rank: current.rank,
            best_rank_year: 2026,
          });
        }
      }
    }
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-6 md:py-16">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="heading-display text-[8rem] md:text-[14rem] lg:text-[18rem] text-white/[0.02] leading-none tracking-wider">
            LAATSTE EDITIE
          </span>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 text-center">
          <div className="absolute top-0 right-4 md:right-6">
            <InfoModal />
          </div>
          <span className="heading-display text-xs md:text-sm text-gray-500 tracking-[0.3em]">
            Play-Offs I
          </span>
          <h1 className="heading-display text-5xl md:text-8xl lg:text-9xl leading-none mt-2 md:mt-4">
            <span className="block text-white">PRONO</span>
            <span className="block text-cb-blue">PLAY-OFFS</span>
          </h1>
          <p className="mt-3 md:mt-6 text-gray-400 max-w-md md:max-w-2xl mx-auto text-xs md:text-base leading-relaxed">
            De allerlaatste editie van de play-offs prono, de prono van
            Klein-Brabant. Voorspel de uitslagen, strijd tegen vrienden en
            familie, en bewijs dat jij de echte voetbal kenner bent.
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 md:gap-12 mt-5 md:mt-8">
            <div className="text-center">
              <div className="heading-display text-2xl md:text-4xl text-white font-bold">
                {playerCount}
              </div>
              <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-[0.15em] mt-0.5">
                Spelers
              </div>
            </div>
            <div className="stat-divider" />
            <div className="text-center">
              <div className="heading-display text-2xl md:text-4xl text-white font-bold">
                {matchCount ?? 0}
              </div>
              <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-[0.15em] mt-0.5">
                Wedstrijden
              </div>
            </div>
            <div className="stat-divider" />
            <div className="text-center">
              <div className="heading-display text-2xl md:text-4xl text-white font-bold">
                {predictionCount ?? 0}
              </div>
              <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-[0.15em] mt-0.5">
                Prono&apos;s
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rankings Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="heading-display text-3xl md:text-4xl text-white">
              RANKINGS
            </h2>
          </div>
          <ErelijstModal
            editions={(editions ?? []).filter((e) => !e.is_current).sort((a, b) => b.year - a.year)}
            editionScores={editionScores ?? []}
          />
        </div>

        <YearSelector
          editions={editions ?? []}
          editionScores={editionScores ?? []}
          alltimeScores={augmentedAlltime}
          currentStandings={standings}
          playerLinks={(players ?? []).map((p) => ({
            id: p.id,
            display_name: p.display_name,
            matched_historical_name: p.matched_historical_name ?? null,
          }))}
        />
      </section>
    </div>
  );
}
