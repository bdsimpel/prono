import { createServiceClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import StatistiekenDashboard from "@/components/stats/StatistiekenDashboard";
import type { Prediction, ExtraPrediction } from "@/lib/types";

export const revalidate = 0;

interface MatchEvent {
  id: number;
  match_id: number;
  event_type: string;
  player_name: string;
  football_player_id: number | null;
  team_id: number;
  minute: number;
}

export default async function StatistiekenPage() {
  const supabase = await createServiceClient();

  const [
    { data: players },
    { data: playerScores },
    { data: matches },
    { data: results },
    predictions,
    { data: extraQuestions },
    extraPredictions,
    { data: extraAnswers },
    { data: teams },
    matchEvents,
    { data: footballPlayers },
    { data: editions },
    { data: editionScores },
  ] = await Promise.all([
    supabase.from("players").select("*"),
    supabase.from("player_scores").select("*"),
    supabase
      .from("matches")
      .select(
        "*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)"
      )
      .order("speeldag"),
    supabase.from("results").select("*"),
    fetchAll<Prediction>(supabase, "predictions"),
    supabase.from("extra_questions").select("*").order("id"),
    fetchAll<ExtraPrediction>(supabase, "extra_predictions"),
    supabase.from("extra_question_answers").select("*"),
    supabase.from("teams").select("*"),
    fetchAll<MatchEvent>(supabase, "match_events"),
    supabase.from("football_players").select("*"),
    supabase.from("editions").select("*").order("year", { ascending: true }),
    supabase.from("edition_scores").select("*"),
  ]);

  return (
    <StatistiekenDashboard
      players={players ?? []}
      playerScores={playerScores ?? []}
      matches={matches ?? []}
      results={results ?? []}
      predictions={predictions}
      extraQuestions={extraQuestions ?? []}
      extraPredictions={extraPredictions}
      extraAnswers={extraAnswers ?? []}
      teams={teams ?? []}
      matchEvents={matchEvents}
      footballPlayers={footballPlayers ?? []}
      editions={editions ?? []}
      editionScores={editionScores ?? []}
    />
  );
}
