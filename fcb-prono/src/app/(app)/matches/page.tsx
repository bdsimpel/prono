import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { getTeamLogo } from "@/lib/teamLogos";

export const dynamic = "force-dynamic";

function TeamLogo({ name, size = 20 }: { name: string; size?: number }) {
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

function formatMatchDate(datetime: string) {
  const d = new Date(datetime);
  const day = d.toLocaleDateString("nl-BE", { weekday: "short" });
  const date = d.toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { day, date, time };
}


export default async function MatchesPage() {
  const supabase = await createClient();

  const [{ data: matches }, { data: allResults }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)`,
      )
      .order("speeldag", { ascending: true })
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
      <div className="flex items-center justify-center gap-6 md:gap-10 mb-8 px-2">
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

      {/* Upcoming matches */}
      {upcoming && upcoming.length > 0 && (
        <div className="mb-10">
          <h2 className="heading-display text-xl text-gray-400 mb-3">
            KOMENDE WEDSTRIJDEN
          </h2>
          <div className="space-y-2">
            {upcoming.map((match) => {
              const { day, date, time } = match.match_datetime
                ? formatMatchDate(match.match_datetime)
                : { day: "", date: "", time: "" };

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="glass-card-subtle p-3 md:p-4 hover:bg-white/[0.03] transition-colors block"
                >
                  {/* Mobile stacked layout */}
                  <div className="md:hidden flex items-center gap-3">
                    <div className="text-[10px] text-gray-500 w-[48px] text-right shrink-0 leading-tight">
                      <div className="capitalize">{day} {date}</div>
                      <div>{time}</div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <TeamLogo name={match.home_team.name} />
                        <span className="text-sm text-gray-200 truncate">{match.home_team.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TeamLogo name={match.away_team.name} />
                        <span className="text-sm text-gray-200 truncate">{match.away_team.name}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-600 shrink-0 text-right">
                      {match.is_cup_final ? "Beker" : `SD ${match.speeldag}`} &rsaquo;
                    </div>
                  </div>

                  {/* Desktop horizontal layout */}
                  <div className="hidden md:flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <div className="text-xs text-gray-400 capitalize">{day} {date}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{time}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm">
                        <TeamLogo name={match.home_team.name} />
                        <span className="truncate">{match.home_team.name}</span>
                        <span className="text-gray-600 text-xs shrink-0">-</span>
                        <span className="truncate">{match.away_team.name}</span>
                        <TeamLogo name={match.away_team.name} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">
                      {match.is_cup_final ? "Beker" : `SD ${match.speeldag}`}
                    </span>
                    <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Played matches */}
      {played && played.length > 0 && (
        <div>
          <h2 className="heading-display text-xl text-gray-400 mb-3">
            GESPEELD
          </h2>
          <div className="space-y-2">
            {played.map((match) => {
              const result = resultMap[match.id];
              const { day, date } = match.match_datetime
                ? formatMatchDate(match.match_datetime)
                : { day: "", date: "" };

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  scroll={true}
                  className="glass-card-subtle p-3 md:p-4 hover:bg-white/[0.03] transition-colors block"
                >
                  {/* Mobile stacked layout */}
                  <div className="md:hidden flex items-center gap-3">
                    <div className="text-[10px] text-gray-500 w-[48px] text-right shrink-0 capitalize">
                      {day} {date}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <TeamLogo name={match.home_team.name} />
                        <span className="text-sm text-gray-200 truncate flex-1">{match.home_team.name}</span>
                        <span className="text-white font-bold text-sm tabular-nums shrink-0">{result.home_score}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TeamLogo name={match.away_team.name} />
                        <span className="text-sm text-gray-200 truncate flex-1">{match.away_team.name}</span>
                        <span className="text-white font-bold text-sm tabular-nums shrink-0">{result.away_score}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-600 shrink-0 text-right">
                      {match.is_cup_final ? "Beker" : `SD ${match.speeldag}`} &rsaquo;
                    </div>
                  </div>

                  {/* Desktop horizontal layout */}
                  <div className="hidden md:flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <div className="text-xs text-gray-500 capitalize">{day} {date}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm">
                        <TeamLogo name={match.home_team.name} />
                        <span className="truncate">{match.home_team.name}</span>
                        <span className="bg-white/[0.06] px-2 py-0.5 rounded text-white font-bold text-xs shrink-0">
                          {result.home_score}-{result.away_score}
                        </span>
                        <span className="truncate">{match.away_team.name}</span>
                        <TeamLogo name={match.away_team.name} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">
                      {match.is_cup_final ? "Beker" : `SD ${match.speeldag}`}
                    </span>
                    <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
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
