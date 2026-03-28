import { createServiceClient } from "@/lib/supabase/server";
import LiveMatchList from "@/components/LiveMatchList";

export const revalidate = false;

function formatMatchDate(datetime: string) {
  const d = new Date(datetime);
  const day = d.toLocaleDateString("nl-BE", { weekday: "short", timeZone: "Europe/Brussels" });
  const date = d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", timeZone: "Europe/Brussels" });
  const time = d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
  return { day, date, time };
}

function withFormatted<T extends { match_datetime: string | null }>(matches: T[]) {
  return matches.map(m => ({
    ...m,
    formatted: m.match_datetime ? formatMatchDate(m.match_datetime) : undefined,
  }));
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

  const played: typeof matches = [];
  const upcoming: typeof matches = [];

  for (const m of matches || []) {
    if (resultMap[m.id]) {
      played!.push(m);
    } else {
      upcoming!.push(m);
    }
  }

  const totalMatches = matches?.length ?? 0;
  const playedCount = played?.length ?? 0;

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

  // Find the "current" round:
  // A round becomes current 2 days before its first match.
  // It stays current until 2 days before the NEXT round's first match.
  const now = Date.now();
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  let currentRound: MatchRound | null = rounds[0] ?? null;
  for (let i = 0; i < rounds.length; i++) {
    const activatesAt = rounds[i].firstDatetime - TWO_DAYS;
    if (now >= activatesAt) {
      currentRound = rounds[i];
    }
  }

  // Separate current round matches from the rest
  const currentRoundMatchIds = new Set(currentRound?.matches.map(m => m.id) ?? []);
  const upcomingFiltered = upcoming?.filter(m => !currentRoundMatchIds.has(m.id)) ?? [];
  const playedFiltered = played?.filter(m => !currentRoundMatchIds.has(m.id)) ?? [];

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

      {/* Current round */}
      {currentRound && (
        <div className="mb-10">
          <h2 className="heading-display text-xl text-white mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-cb-blue rounded-full" />
            {currentRound.label}
          </h2>
          <LiveMatchList matches={withFormatted(currentRound.matches)} resultMap={resultMap} variant="current" />
        </div>
      )}

      {/* Upcoming matches */}
      {upcomingFiltered.length > 0 && (
        <div className="mb-10">
          <h2 className="heading-display text-xl text-gray-400 mb-3">
            KOMENDE WEDSTRIJDEN
          </h2>
          <LiveMatchList matches={withFormatted(upcomingFiltered)} resultMap={resultMap} variant="upcoming" />
        </div>
      )}

      {/* Played matches */}
      {playedFiltered.length > 0 && (
        <div>
          <h2 className="heading-display text-xl text-gray-400 mb-3">
            GESPEELD
          </h2>
          <LiveMatchList matches={withFormatted(playedFiltered)} resultMap={resultMap} variant="played" />
        </div>
      )}

      {(!matches || matches.length === 0) && (
        <div className="glass-card-subtle p-12 text-center text-gray-500">
          Nog geen wedstrijden beschikbaar.
        </div>
      )}
    </div>
  );
}
