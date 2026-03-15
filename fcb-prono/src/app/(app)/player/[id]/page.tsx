import TeamLogo from "@/components/TeamLogo";
import { calculateMatchPoints, checkExtraAnswer } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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
}: {
  pred: { id: number; home_score: number; away_score: number };
  match: {
    home_team: { name: string; short_name: string };
    away_team: { name: string; short_name: string };
  };
  result: { home_score: number; away_score: number } | undefined;
  points: number;
  category: string;
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
              {pred.home_score} - {pred.away_score}
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
                {pred.home_score}-{pred.away_score}
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
  const supabase = await createClient();

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
  ]);

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

  const gamesPlayed = (predictions || []).filter(
    (p) => resultMap[p.match_id],
  ).length;

  // Group predictions by round (same logic as matches page)
  type PredWithMatch = NonNullable<typeof predictions>[number];
  type PredRound = {
    label: string;
    key: string;
    predictions: PredWithMatch[];
    firstDatetime: number;
  };
  const roundsMap = new Map<string, PredRound>();
  for (const pred of predictions || []) {
    const match = pred.matches as {
      speeldag: number | null;
      is_cup_final: boolean;
      match_datetime: string | null;
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
    roundsMap.get(key)!.predictions.push(pred);
    if (match.match_datetime) {
      const t = new Date(match.match_datetime).getTime();
      if (t < roundsMap.get(key)!.firstDatetime)
        roundsMap.get(key)!.firstDatetime = t;
    }
  }
  const rounds = Array.from(roundsMap.values()).sort(
    (a, b) => a.firstDatetime - b.firstDatetime,
  );

  // Find current round (activates 2 days before first match)
  const now = Date.now();
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  let currentRound: PredRound | null = rounds[0] ?? null;
  for (let i = 0; i < rounds.length; i++) {
    const activatesAt = rounds[i].firstDatetime - TWO_DAYS;
    if (now >= activatesAt) {
      currentRound = rounds[i];
    }
  }

  const currentRoundKeys = new Set(currentRound ? [currentRound.key] : []);
  const currentPredictions = currentRound?.predictions ?? [];
  const upcomingPredictions = rounds
    .filter(
      (r) =>
        !currentRoundKeys.has(r.key) &&
        r.predictions.some((p) => !resultMap[p.match_id]),
    )
    .flatMap((r) => r.predictions);
  const playedPredictions = rounds
    .filter(
      (r) =>
        !currentRoundKeys.has(r.key) &&
        r.predictions.every((p) => resultMap[p.match_id]),
    )
    .flatMap((r) => r.predictions);

  const memberSince = player.created_at
    ? new Date(player.created_at).toLocaleDateString("nl-BE", {
        month: "short",
        year: "numeric",
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
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
              <span>#{rank}</span>
              {memberSince && <span>Lid sinds {memberSince}</span>}
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
        <div className="mb-6 px-5 py-4 glass-card-subtle border-cb-blue/20">
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
        </div>
      )}

      {/* Stats row */}
      {playerScore && (
        <div className="flex items-center justify-center md:justify-start gap-4 md:gap-10 mb-8 md:mb-10 px-1 md:px-2">
          <div className="text-center">
            <div className="heading-display text-2xl md:text-3xl text-cb-blue font-bold">
              {playerScore.total_score}
            </div>
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Score
            </div>
          </div>
          <div className="stat-divider" />
          <div className="text-center">
            <div className="heading-display text-2xl md:text-3xl text-white font-bold">
              {gamesPlayed}
            </div>
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Gespeeld
            </div>
          </div>
          <div className="stat-divider" />
          <div className="text-center">
            <div className="heading-display text-2xl md:text-3xl text-white font-bold">
              {playerScore.exact_matches}
            </div>
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Exact
            </div>
          </div>
          <div className="stat-divider" />
          <div className="text-center">
            <div className="heading-display text-2xl md:text-3xl text-white font-bold">
              {playerScore.correct_results}
            </div>
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Correct
            </div>
          </div>
        </div>
      )}

      {/* Match predictions */}
      {/* Current round */}
      {currentRound && currentPredictions.length > 0 && (
        <div className="mb-8">
          <h3 className="heading-display text-lg text-white mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-cb-blue rounded-full" />
            {currentRound.label}
          </h3>
          <div className="space-y-2">
            {currentPredictions.map((pred) => {
              const match = pred.matches as {
                speeldag: number | null;
                is_cup_final: boolean;
                match_datetime: string | null;
                home_team: { name: string; short_name: string };
                away_team: { name: string; short_name: string };
              };
              const result = resultMap[pred.match_id];
              let points = 0;
              let category:
                | "exact"
                | "goal_diff"
                | "result"
                | "wrong"
                | "pending" = "pending";
              if (result) {
                const calc = calculateMatchPoints(
                  pred.home_score,
                  pred.away_score,
                  result.home_score,
                  result.away_score,
                );
                points = calc.points;
                category = calc.category;
              }
              return (
                <PredictionCard
                  key={pred.id}
                  pred={pred}
                  match={match}
                  result={result}
                  points={points}
                  category={category}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming predictions */}
      {upcomingPredictions.length > 0 && (
        <div className="mb-8">
          <h3 className="heading-display text-lg text-gray-400 mb-3">
            KOMENDE WEDSTRIJDEN
          </h3>
          <div className="space-y-2">
            {upcomingPredictions.map((pred) => {
              const match = pred.matches as {
                speeldag: number | null;
                is_cup_final: boolean;
                match_datetime: string | null;
                home_team: { name: string; short_name: string };
                away_team: { name: string; short_name: string };
              };
              return (
                <PredictionCard
                  key={pred.id}
                  pred={pred}
                  match={match}
                  result={undefined}
                  points={0}
                  category="pending"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Played predictions */}
      {playedPredictions.length > 0 && (
        <div className="mb-10">
          <h3 className="heading-display text-lg text-gray-400 mb-3">
            GESPEELD
          </h3>
          <div className="space-y-2">
            {playedPredictions.map((pred) => {
              const match = pred.matches as {
                speeldag: number | null;
                is_cup_final: boolean;
                match_datetime: string | null;
                home_team: { name: string; short_name: string };
                away_team: { name: string; short_name: string };
              };
              const result = resultMap[pred.match_id];
              let points = 0;
              let category:
                | "exact"
                | "goal_diff"
                | "result"
                | "wrong"
                | "pending" = "pending";
              if (result) {
                const calc = calculateMatchPoints(
                  pred.home_score,
                  pred.away_score,
                  result.home_score,
                  result.away_score,
                );
                points = calc.points;
                category = calc.category;
              }
              return (
                <PredictionCard
                  key={pred.id}
                  pred={pred}
                  match={match}
                  result={result}
                  points={points}
                  category={category}
                />
              );
            })}
          </div>
        </div>
      )}

      {(!predictions || predictions.length === 0) && (
        <div className="glass-card-subtle p-12 text-center text-gray-600 text-sm mb-10">
          Geen voorspellingen
        </div>
      )}

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
                        {ep.answer}
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
    </div>
  );
}
