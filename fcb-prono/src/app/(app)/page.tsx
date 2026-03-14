import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

function getRankColor(rank: number): string {
  if (rank === 1) return "text-cb-gold";
  if (rank === 2) return "text-cb-silver";
  if (rank === 3) return "text-cb-bronze";
  return "text-gray-500";
}

export default async function KlassementPage() {
  const supabase = await createClient();

  const [
    { data: players },
    { data: scores },
    { count: matchCount },
    { count: predictionCount },
  ] = await Promise.all([
    supabase.from("players").select("id, display_name"),
    supabase.from("player_scores").select("*"),
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("predictions").select("*", { count: "exact", head: true }),
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
          <span className="heading-display text-xs md:text-sm text-gray-500 tracking-[0.3em]">
            Seizoen 2025-2026
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
          <span className="text-sm text-gray-500">Play-Offs 2026</span>
        </div>

        {standings.length === 0 ? (
          <div className="glass-card p-12 text-center text-gray-500">
            Nog geen spelers geregistreerd.
          </div>
        ) : (
          <div className="glass-card-subtle overflow-hidden">
            {/* Desktop table */}
            <table className="hidden md:table w-full">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="text-left font-normal px-5 py-3 w-12">#</th>
                  <th className="text-left font-normal py-3">Naam</th>
                  <th className="text-right font-normal px-2 py-3 w-16">
                    Score
                  </th>
                  <th className="text-right font-normal px-2 py-3 w-12">E</th>
                  <th className="text-right font-normal px-2 py-3 w-12">GV</th>
                  <th className="text-right font-normal px-2 py-3 w-12">JR</th>
                  <th className="text-right font-normal px-2 py-3 w-16">
                    Match
                  </th>
                  <th className="text-right font-normal px-2 py-3 w-16 pr-5">
                    Extra
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.user_id} className="table-row group">
                    <td className="px-5 py-3">
                      <Link href={`/player/${row.user_id}`} className="block">
                        <span
                          className={`heading-display text-lg ${getRankColor(row.rank)}`}
                        >
                          {row.rank}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/player/${row.user_id}`}
                        className="block text-sm font-medium text-gray-200 group-hover:text-white transition-colors"
                      >
                        {row.display_name}
                      </Link>
                    </td>
                    <td className="text-right px-2 py-3 text-sm font-bold text-cb-blue">
                      <Link href={`/player/${row.user_id}`} className="block">
                        {row.total_score}
                      </Link>
                    </td>
                    <td className="text-right px-2 py-3 text-sm text-gray-500">
                      <Link href={`/player/${row.user_id}`} className="block">
                        {row.exact_matches}
                      </Link>
                    </td>
                    <td className="text-right px-2 py-3 text-sm text-gray-500">
                      <Link href={`/player/${row.user_id}`} className="block">
                        {row.correct_goal_diffs}
                      </Link>
                    </td>
                    <td className="text-right px-2 py-3 text-sm text-gray-500">
                      <Link href={`/player/${row.user_id}`} className="block">
                        {row.correct_results}
                      </Link>
                    </td>
                    <td className="text-right px-2 py-3 text-sm text-gray-500">
                      <Link href={`/player/${row.user_id}`} className="block">
                        {row.match_score}
                      </Link>
                    </td>
                    <td className="text-right px-2 py-3 pr-5 text-sm text-gray-500">
                      <Link href={`/player/${row.user_id}`} className="block">
                        {row.extra_score}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="md:hidden">
              <div className="flex items-center text-[10px] text-gray-600 uppercase tracking-wider px-3 py-2 border-b border-white/[0.06]">
                <span className="w-7">#</span>
                <span className="flex-1">Naam</span>
                <span className="w-8 text-right">E</span>
                <span className="w-8 text-right">GV</span>
                <span className="w-8 text-right">JR</span>
                <span className="w-12 text-right">Score</span>
              </div>
              {standings.map((row) => (
                <Link
                  key={row.user_id}
                  href={`/player/${row.user_id}`}
                  className="table-row flex items-center px-3 py-2.5"
                >
                  <span
                    className={`heading-display text-base w-7 ${getRankColor(row.rank)}`}
                  >
                    {row.rank}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-200 truncate pr-2">
                    {row.display_name}
                  </span>
                  <span className="w-8 text-right text-xs text-gray-500">
                    {row.exact_matches}
                  </span>
                  <span className="w-8 text-right text-xs text-gray-500">
                    {row.correct_goal_diffs}
                  </span>
                  <span className="w-8 text-right text-xs text-gray-500">
                    {row.correct_results}
                  </span>
                  <span className="w-12 text-right text-sm font-bold text-cb-blue">
                    {row.total_score}
                  </span>
                </Link>
              ))}
            </div>

            {/* Legend */}
            <div className="px-5 py-3 text-xs text-gray-600 border-t border-white/[0.04]">
              E = Exact &middot; GV = Goal verschil &middot; JR =
              Juist resultaat
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
