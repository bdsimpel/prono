import { createServiceClient } from "@/lib/supabase/server";
import MatchesContent from "@/components/MatchesContent";

export const revalidate = false;

function formatMatchDate(datetime: string) {
  const d = new Date(datetime);
  const day = d.toLocaleDateString("nl-BE", { weekday: "short", timeZone: "Europe/Brussels" });
  const date = d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", timeZone: "Europe/Brussels" });
  const time = d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
  return { day, date, time };
}

export default async function MatchesPage() {
  const supabase = await createServiceClient();

  const [{ data: matches }, { data: allResults }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)`,
      )
      .order("match_datetime", { ascending: true }),
    supabase.from("results").select("*"),
  ]);

  const resultMap: Record<
    number,
    { home_score: number; away_score: number }
  > = {};
  for (const r of allResults || []) {
    resultMap[r.match_id] = {
      home_score: r.home_score,
      away_score: r.away_score,
    };
  }

  const totalMatches = matches?.length ?? 0;
  const playedCount = (matches || []).filter((m) => resultMap[m.id]).length;

  // Group matches by "round" (speeldag or cup final)
  type MatchRound = { label: string; key: string; matches: NonNullable<typeof matches>; firstDatetime: number };
  const roundsMap = new Map<string, MatchRound>();
  for (const m of matches || []) {
    const key = m.is_cup_final ? 'beker' : `sd-${m.speeldag}`;
    const label = m.is_cup_final ? 'Bekerfinale' : `Speeldag ${m.speeldag}`;
    if (!roundsMap.has(key)) {
      roundsMap.set(key, { label, key, matches: [], firstDatetime: m.match_datetime ? new Date(m.match_datetime).getTime() : Infinity });
    }
    roundsMap.get(key)!.matches.push(m);
    if (m.match_datetime) {
      const t = new Date(m.match_datetime).getTime();
      if (t < roundsMap.get(key)!.firstDatetime) roundsMap.get(key)!.firstDatetime = t;
    }
  }
  const rounds = Array.from(roundsMap.values()).sort((a, b) => a.firstDatetime - b.firstDatetime);

  // Pre-format dates server-side and shape for client component
  const formattedRounds = rounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) => ({
      id: m.id,
      home_team: { name: m.home_team.name },
      away_team: { name: m.away_team.name },
      match_datetime: m.match_datetime,
      speeldag: m.speeldag,
      is_cup_final: m.is_cup_final,
      api_football_fixture_id: m.api_football_fixture_id,
      formatted: m.match_datetime ? formatMatchDate(m.match_datetime) : undefined,
    })),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-6">
        <h1 className="heading-display text-3xl md:text-4xl text-white">
          WEDSTRIJDEN
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Bekijk alle wedstrijden en ontdek hoe iedereen heeft voorspeld.
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-center md:justify-start gap-6 md:gap-10 mb-8 px-2">
        <div className="text-center">
          <div className="heading-display text-3xl text-cb-blue font-bold">
            {totalMatches}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
            Totaal
          </div>
        </div>
        <div className="stat-divider" />
        <div className="text-center">
          <div className="heading-display text-3xl text-white font-bold">
            {playedCount}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
            Gespeeld
          </div>
        </div>
        <div className="stat-divider" />
        <div className="text-center">
          <div className="heading-display text-3xl text-white font-bold">
            {totalMatches - playedCount}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-1">
            Resterend
          </div>
        </div>
      </div>

      <MatchesContent rounds={formattedRounds} resultMap={resultMap} />

      {(!matches || matches.length === 0) && (
        <div className="glass-card-subtle p-12 text-center text-gray-500">
          Nog geen wedstrijden beschikbaar.
        </div>
      )}
    </div>
  );
}
