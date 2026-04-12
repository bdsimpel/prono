import TeamLogo from "@/components/TeamLogo";
import { calculateMatchPoints, checkExtraAnswer } from "@/lib/scoring";
import { computePlayerStreak } from "@/lib/streaks";
import PlayerStatsLive from "@/components/PlayerStatsLive";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerPredictionsContent from "@/components/PlayerPredictionsContent";

export const revalidate = false;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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

function PredictionCard({
  pred,
  match,
  result,
  points,
  category,
  shouldHide,
}: {
  pred: { id: number; home_score: number; away_score: number };
  match: {
    home_team: { name: string; short_name: string };
    away_team: { name: string; short_name: string };
  };
  result: { home_score: number; away_score: number } | undefined;
  points: number;
  category: string;
  shouldHide: boolean;
}) {
  return (
    <div className="glass-card-subtle p-3 md:p-4">
      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <TeamLogo name={match.home_team.name} />
            <span className="text-sm text-gray-200 truncate">
              {match.home_team.name}
            </span>
          </div>
          {result ? (
            <span className="heading-display text-xl text-white shrink-0 px-2">
              {result.home_score}
              <span className="text-gray-600 mx-0.5">-</span>
              {result.away_score}
            </span>
          ) : (
            <span className="text-sm text-gray-600 shrink-0 px-2">vs</span>
          )}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-sm text-gray-200 truncate">
              {match.away_team.name}
            </span>
            <TeamLogo name={match.away_team.name} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
          <span className="text-xs text-gray-500">
            Prono{" "}
            <span className="text-gray-300 font-bold ml-1">
              {shouldHide ? (
                <span className="blur-sm select-none">? - ?</span>
              ) : (
                <>{pred.home_score} - {pred.away_score}</>
              )}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            {getCategoryBadge(category)}
            <span
              className={`heading-display text-lg w-8 text-right ${getCategoryPointColor(category)}`}
            >
              {result ? `+${points}` : "—"}
            </span>
          </div>
        </div>
      </div>
      {/* Desktop layout */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 font-medium flex items-center gap-1 truncate">
            <TeamLogo name={match.home_team.name} />
            <span className="truncate">{match.home_team.name}</span>
            <span className="text-gray-600 shrink-0">-</span>
            <span className="truncate">{match.away_team.name}</span>
            <TeamLogo name={match.away_team.name} />
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
        <div className="flex items-center gap-2 shrink-0">
          {getCategoryBadge(category)}
          <span
            className={`heading-display text-lg w-8 text-right ${getCategoryPointColor(category)}`}
          >
            {result ? `+${points}` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .single();

  if (!player) notFound();

  const [
    { data: playerScore },
    { data: allScores },
    { data: predictions },
    { data: allResults },
    { data: extraPredictions },
    { data: extraAnswers },
    { data: editions },
    { data: editionScores },
    { data: deadlineSetting },
  ] = await Promise.all([
    supabase.from("player_scores").select("*").eq("user_id", id).single(),
    supabase
      .from("player_scores")
      .select("user_id, total_score")
      .order("total_score", { ascending: false }),
    supabase
      .from("predictions")
      .select(
        `*, matches!inner(*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*))`,
      )
      .eq("user_id", id)
      .order("match_id", { ascending: true }),
    supabase.from("results").select("*"),
    supabase
      .from("extra_predictions")
      .select("*, extra_questions!inner(*)")
      .eq("user_id", id)
      .order("question_id", { ascending: true }),
    supabase.from("extra_question_answers").select("*"),
    supabase.from("editions").select("*").order("year", { ascending: true }),
    supabase
      .from("edition_scores")
      .select("*")
      .or(
        `player_name.eq.${player.matched_historical_name || player.display_name},player_name.ilike.${player.display_name}`,
      ),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "deadline")
      .maybeSingle(),
  ]);

  const deadline = deadlineSetting?.value ?? null;
  const shouldHide = !!deadline && new Date(deadline) > new Date();

  const resultMap: Record<number, { home_score: number; away_score: number }> =
    {};
  for (const r of allResults || []) {
    resultMap[r.match_id] = {
      home_score: r.home_score,
      away_score: r.away_score,
    };
  }

  let rank = 0;
  if (allScores) {
    let currentRank = 0;
    let prevScore = -1;
    for (let i = 0; i < allScores.length; i++) {
      if (allScores[i].total_score !== prevScore) currentRank = i + 1;
      if (allScores[i].user_id === id) {
        rank = currentRank;
        break;
      }
      prevScore = allScores[i].total_score;
    }
  }

  const correctAnswersMap: Record<number, string[]> = {};
  for (const a of extraAnswers || []) {
    if (!correctAnswersMap[a.question_id])
      correctAnswersMap[a.question_id] = [];
    correctAnswersMap[a.question_id].push(a.correct_answer);
  }

  // Historical data lookup
  const historicalName = player.matched_historical_name || player.display_name;
  const playerEditionScores = (editionScores || []).filter(
    (es) =>
      es.player_name === historicalName ||
      es.player_name.toLowerCase() === player.display_name.toLowerCase(),
  );
  const playerMedals = playerEditionScores
    .filter((es) => es.rank <= 3)
    .map((es) => {
      const edition = (editions || []).find((e) => e.id === es.edition_id);
      return { year: edition?.year ?? 0, label: edition?.label ?? "", rank: es.rank };
    })
    .sort((a, b) => b.year - a.year);
  const playerHistory = playerEditionScores
    .map((es) => {
      const edition = (editions || []).find((e) => e.id === es.edition_id);
      return {
        year: edition?.year ?? 0,
        rank: es.rank,
        total_score: es.total_score,
        player_count: edition?.player_count ?? 0,
      };
    })
    .sort((a, b) => b.year - a.year);

  // Compute best rank from historical editions only (before current year)
  const bestRank = playerHistory.length > 0
    ? Math.min(...playerHistory.map((h) => h.rank))
    : null;

  // Add current year to history for display
  const currentEdition = (editions || []).find((e) => e.is_current);
  if (playerScore && playerScore.total_score > 0 && rank > 0 && currentEdition) {
    playerHistory.unshift({
      year: currentEdition.year,
      rank,
      total_score: playerScore.total_score,
      player_count: currentEdition.player_count ?? (allScores?.length ?? 0),
    });
  }

  const gamesPlayed = (predictions || []).filter(
    (p) => resultMap[p.match_id],
  ).length;

  // Compute streak data
  const matchesForStreaks = (predictions || []).map((p) => {
    const m = p.matches as { speeldag: number | null; match_datetime: string | null; is_cup_final: boolean };
    return { id: p.match_id, speeldag: m.speeldag, match_datetime: m.match_datetime };
  });
  const predsForStreaks = (predictions || []).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    match_id: p.match_id,
    home_score: p.home_score,
    away_score: p.away_score,
    created_at: p.created_at,
  }));
  const streakData = computePlayerStreak(
    id,
    player.display_name,
    predsForStreaks,
    allResults || [],
    matchesForStreaks,
  );

  // Group predictions by round (same logic as matches page)
  type PredRound = {
    label: string;
    key: string;
    predictions: { id: number; match_id: number; home_score: number; away_score: number; home_team_name: string; away_team_name: string; match_datetime: string | null; api_football_fixture_id: number | null }[];
    firstDatetime: number;
  };
  const roundsMap = new Map<string, PredRound>();
  for (const pred of predictions || []) {
    const match = pred.matches as {
      speeldag: number | null;
      is_cup_final: boolean;
      match_datetime: string | null;
      api_football_fixture_id: number | null;
      home_team: { name: string; short_name: string };
      away_team: { name: string; short_name: string };
    };
    const key = match.is_cup_final ? "beker" : `sd-${match.speeldag}`;
    const label = match.is_cup_final
      ? "Bekerfinale"
      : `Speeldag ${match.speeldag}`;
    if (!roundsMap.has(key)) {
      roundsMap.set(key, {
        label,
        key,
        predictions: [],
        firstDatetime: match.match_datetime
          ? new Date(match.match_datetime).getTime()
          : Infinity,
      });
    }
    roundsMap.get(key)!.predictions.push({
      id: pred.id,
      match_id: pred.match_id,
      home_score: pred.home_score,
      away_score: pred.away_score,
      home_team_name: match.home_team.name,
      away_team_name: match.away_team.name,
      match_datetime: match.match_datetime,
      api_football_fixture_id: match.api_football_fixture_id,
    });
    if (match.match_datetime) {
      const t = new Date(match.match_datetime).getTime();
      if (t < roundsMap.get(key)!.firstDatetime)
        roundsMap.get(key)!.firstDatetime = t;
    }
  }
  const predRounds = Array.from(roundsMap.values()).sort(
    (a, b) => a.firstDatetime - b.firstDatetime,
  );

  const memberSince = player.created_at
    ? new Date(player.created_at).toLocaleDateString("nl-BE", {
        month: "short",
        year: "numeric",
        timeZone: "Europe/Brussels",
      })
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Back + close */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
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
          Klassement
        </Link>
        <Link
          href="/"
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

      {/* Player header */}
      <div className="glass-card-subtle p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
            <span className="heading-display text-lg text-cb-blue">
              {getInitials(player.display_name)}
            </span>
          </div>
          <div>
            <h1 className="heading-display text-2xl md:text-3xl text-white">
              {player.display_name}
            </h1>
            {player.tagline && (
              <p className="text-sm text-gray-400 italic mt-1">
                &ldquo;{player.tagline}&rdquo;
              </p>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
              {player.payment_status === "paid" && (
                <svg
                  className="w-4 h-4 text-cb-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <span>#{rank}</span>
              {playerHistory.length > 0 && (
                <span>
                  {playerHistory.length} edities
                  {bestRank !== null && <> &middot; Beste: #{bestRank}</>}
                </span>
              )}
              {memberSince && <span>Lid sinds {memberSince}</span>}
              {player.favorite_team && (
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3 h-3 text-cb-blue"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                  <TeamLogo name={player.favorite_team} size={14} />
                  <span className="text-gray-400">{player.favorite_team}</span>
                </span>
              )}
            </div>
            {playerMedals.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {playerMedals.map((m) => (
                  <span
                    key={m.year}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                      m.rank === 1
                        ? "bg-cb-gold/10 text-cb-gold border border-cb-gold/20"
                        : m.rank === 2
                          ? "bg-cb-silver/10 text-cb-silver border border-cb-silver/20"
                          : "bg-cb-bronze/10 text-cb-bronze border border-cb-bronze/20"
                    }`}
                  >
                    {m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : "🥉"}
                    {m.year}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment status */}
      {player.payment_status === "unpaid" && (
        <Link
          href={`/betalen/${player.id}`}
          className="block mb-6 px-5 py-4 glass-card-subtle border-yellow-900/50 hover:border-yellow-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">💸</span>
            <div>
              <p className="text-sm text-yellow-300 font-medium">
                Oei, nog niet betaald!
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Voor de prijs van een halve pintje ben je mee. Tik hier en maak
                het in orde dan kunnen wij de prijzenpot vullen!
              </p>
            </div>
          </div>
        </Link>
      )}
      {player.payment_status === "pending" && (
        <Link
          href={`/betalen/${player.id}`}
          className="block mb-6 px-5 py-4 glass-card-subtle border-cb-blue/20 hover:border-cb-blue transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">🔍</span>
            <div>
              <p className="text-sm text-cb-blue font-medium">
                Betaling wordt gecheckt!
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                De admin is je centen aan het zoeken. Even geduld, we bevestigen
                het zo snel mogelijk!
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Live stats + streaks */}
      <PlayerStatsLive
        userId={id}
        displayName={player.display_name}
        playerScore={playerScore}
        gamesPlayed={gamesPlayed}
        streakData={streakData}
        predictions={(predictions || []).map((p) => {
          const m = p.matches as { speeldag: number | null; match_datetime: string | null; api_football_fixture_id: number | null };
          return {
            match_id: p.match_id,
            home_score: p.home_score,
            away_score: p.away_score,
            api_football_fixture_id: m.api_football_fixture_id,
            match_datetime: m.match_datetime,
            speeldag: m.speeldag,
          };
        })}
        resultMap={resultMap}
      />

      {/* Match predictions */}
      <PlayerPredictionsContent
        rounds={predRounds}
        resultMap={resultMap}
        shouldHide={shouldHide}
        hasPredictions={!!predictions && predictions.length > 0}
      />

      {/* Extra questions */}
      <div className="mb-4">
        <h2 className="heading-display text-xl text-gray-400">EXTRA VRAGEN</h2>
      </div>
      <div className="space-y-2">
        {(extraPredictions || []).map((ep) => {
          const question = ep.extra_questions as {
            question_label: string;
            points: number;
          };
          const correctAnswersList = correctAnswersMap[ep.question_id] || [];
          const isCorrect =
            correctAnswersList.length > 0 &&
            checkExtraAnswer(ep.answer, correctAnswersList);
          const hasAnswer = correctAnswersList.length > 0;

          return (
            <div key={ep.id} className="glass-card-subtle p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-400">
                    {question.question_label}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                    <span>
                      Antwoord:{" "}
                      <span className="text-gray-300 font-bold">
                        {shouldHide ? (
                          <span className="blur-sm select-none">?</span>
                        ) : (
                          ep.answer
                        )}
                      </span>
                    </span>
                    {hasAnswer && (
                      <>
                        <span className="text-gray-600">&rarr;</span>
                        <span>
                          Uitslag:{" "}
                          <span className="text-gray-300 font-bold">
                            {correctAnswersList.join(", ")}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasAnswer && (
                    <span
                      className={`text-xs px-2.5 py-1 rounded border ${isCorrect ? "border-cb-blue/40 text-cb-blue" : "border-white/10 text-gray-500"}`}
                    >
                      {isCorrect ? "Correct" : "Fout"}
                    </span>
                  )}
                  <span
                    className={`heading-display text-lg w-8 text-right ${hasAnswer ? (isCorrect ? "text-cb-blue" : "text-gray-500") : "text-gray-600"}`}
                  >
                    {hasAnswer
                      ? isCorrect
                        ? `+${question.points}`
                        : "0"
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {(!extraPredictions || extraPredictions.length === 0) && (
          <div className="glass-card-subtle p-12 text-center text-gray-600 text-sm">
            Geen extra voorspellingen
          </div>
        )}
      </div>

      {/* Historical editions */}
      {playerHistory.length > 0 && (
        <div className="mt-10">
          <h2 className="heading-display text-xl text-gray-400 mb-4">
            GESCHIEDENIS
          </h2>
          <div className="glass-card-subtle overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="text-left font-normal px-4 py-2.5">Jaar</th>
                  <th className="text-right font-normal px-4 py-2.5">
                    Positie
                  </th>
                  <th className="text-right font-normal px-4 py-2.5">Score</th>
                </tr>
              </thead>
              <tbody>
                {playerHistory.map((h) => (
                  <tr
                    key={h.year}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-sm text-gray-300">
                      {h.year}
                    </td>
                    <td className="text-right px-4 py-2.5 text-sm">
                      <span className={getHistoryRankColor(h.rank)}>#{h.rank}</span>
                      <span className="text-gray-600 ml-1">
                        / {h.player_count}
                      </span>
                    </td>
                    <td className="text-right px-4 py-2.5 text-sm font-bold text-white">
                      {h.total_score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getHistoryRankColor(rank: number): string {
  if (rank === 1) return "text-cb-gold";
  if (rank === 2) return "text-cb-silver";
  if (rank === 3) return "text-cb-bronze";
  return "text-gray-400";
}
