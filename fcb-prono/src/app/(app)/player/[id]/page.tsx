import { createClient } from "@/lib/supabase/server";
import { calculateMatchPoints } from "@/lib/scoring";
import { checkExtraAnswer } from "@/lib/scoring";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getTeamLogo } from "@/lib/teamLogos";

export const dynamic = "force-dynamic";

function TeamLogo({ name, size = 16 }: { name: string; size?: number }) {
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
    if (!correctAnswersMap[a.question_id]) correctAnswersMap[a.question_id] = [];
    correctAnswersMap[a.question_id].push(a.correct_answer);
  }

  const gamesPlayed = (predictions || []).filter(
    (p) => resultMap[p.match_id],
  ).length;

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
            </div>
          </div>
        </div>
      </div>

      {/* Payment banner */}
      {player.payment_status !== "paid" && (
        <Link
          href={`/betalen/${player.id}`}
          className="block mb-6 px-5 py-4 glass-card-subtle border-yellow-900/50 text-sm text-yellow-300 hover:border-yellow-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            {player.payment_status === "pending"
              ? "Betaling in afwachting — klik hier om opnieuw te betalen"
              : "Je hebt nog niet betaald — klik hier om te betalen"}
          </div>
        </Link>
      )}

      {/* Stats row */}
      {playerScore && (
        <div className="flex items-center justify-start gap-4 md:gap-10 mb-8 md:mb-10 px-1 md:px-2">
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
      <div className="mb-4">
        <h2 className="heading-display text-xl text-gray-400">
          VOORSPELLINGEN
        </h2>
      </div>
      <div className="space-y-2 mb-10">
        {(predictions || []).map((pred) => {
          const match = pred.matches as {
            speeldag: number | null;
            is_cup_final: boolean;
            home_team: { name: string; short_name: string };
            away_team: { name: string; short_name: string };
          };
          const result = resultMap[pred.match_id];
          let points = 0;
          let category: "exact" | "goal_diff" | "result" | "wrong" | "pending" =
            "pending";

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
            <div key={pred.id} className="glass-card-subtle p-3 md:p-4">
              {/* Mobile stacked layout */}
              <div className="md:hidden">
                <div className="flex">
                  {/* Teams + uitslag */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center mb-1">
                      <span className="flex-1" />
                      {result && (
                        <span className="text-[8px] text-gray-600 uppercase tracking-wider w-10 text-center shrink-0">Uitslag</span>
                      )}
                    </div>
                    {/* Home */}
                    <div className="flex items-center text-sm">
                      <TeamLogo name={match.home_team.name} />
                      <span className="text-gray-200 truncate flex-1 ml-1.5">{match.home_team.name}</span>
                      {result && (
                        <span className="text-white font-bold text-sm w-10 text-center shrink-0">{result.home_score}</span>
                      )}
                    </div>
                    {/* Away */}
                    <div className="flex items-center text-sm mt-1">
                      <TeamLogo name={match.away_team.name} />
                      <span className="text-gray-200 truncate flex-1 ml-1.5">{match.away_team.name}</span>
                      {result && (
                        <span className="text-white font-bold text-sm w-10 text-center shrink-0">{result.away_score}</span>
                      )}
                    </div>
                  </div>
                  {/* Prono column with left border */}
                  <div className={`shrink-0 ml-2 pl-2 flex flex-col items-center ${result ? "border-l border-white/[0.06]" : ""}`}>
                    <span className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Prono</span>
                    <span className="text-gray-500 text-sm">{pred.home_score}</span>
                    <span className="text-gray-500 text-sm mt-1">{pred.away_score}</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                  {getCategoryBadge(category)}
                  <span className={`heading-display text-lg w-8 text-right ${getCategoryPointColor(category)}`}>
                    {result ? `+${points}` : "—"}
                  </span>
                </div>
              </div>

              {/* Desktop horizontal layout */}
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
                  <span className={`heading-display text-lg w-8 text-right ${getCategoryPointColor(category)}`}>
                    {result ? `+${points}` : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {(!predictions || predictions.length === 0) && (
          <div className="glass-card-subtle p-12 text-center text-gray-600 text-sm">
            Geen voorspellingen
          </div>
        )}
      </div>

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
                    {hasAnswer ? (isCorrect ? `+${question.points}` : "0") : "—"}
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
