import { createServiceClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import StatistiekenDashboard from "@/components/stats/StatistiekenDashboard";
import type { Prediction, ExtraPrediction, Subgroup, PlayerSubgroup } from "@/lib/types";

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
    { data: subgroups },
    playerSubgroups,
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
    supabase.from("subgroups").select("*").order("name"),
    fetchAll<PlayerSubgroup>(supabase, "player_subgroups", "player_id, subgroup_id"),
  ]);

  // Augment editionScores with current year data from playerScores
  const currentEdition = (editions ?? []).find(e => e.is_current);
  const allEditionScores = [...(editionScores ?? [])];

  if (currentEdition && (playerScores ?? []).length > 0) {
    const scores = (playerScores ?? []).map(s => s.total_score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const stdev = scores.length > 1
      ? Math.sqrt(scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (scores.length - 1)) || 1
      : 1;

    // Sort by total_score desc to compute ranks
    const sorted = [...(playerScores ?? [])].sort((a, b) => b.total_score - a.total_score);

    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const player = (players ?? []).find(p => p.id === s.user_id);
      if (!player) continue;
      const rank = i + 1;
      const zScore = (s.total_score - mean) / stdev;
      const percentile = Math.round((1 - rank / sorted.length) * 100);
      const pointsPct = currentEdition.max_points
        ? Math.round((s.total_score / currentEdition.max_points) * 10000) / 100
        : null;

      allEditionScores.push({
        id: 0,
        edition_id: currentEdition.id,
        player_name: player.matched_historical_name || player.display_name,
        rank,
        total_score: s.total_score,
        z_score: Math.round(zScore * 100) / 100,
        percentile,
        points_pct: pointsPct,
      });
    }
  }

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
      editionScores={allEditionScores}
      subgroups={(subgroups ?? []) as Subgroup[]}
      playerSubgroups={playerSubgroups as PlayerSubgroup[]}
    />
  );
}
