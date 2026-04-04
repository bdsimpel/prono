export interface Team {
  id: number
  name: string
  short_name: string | null
  matrix_index: number
  standing_rank: number | null
  points_half: number | null
  goals_for: number | null
  goals_against: number | null
}

export interface Profile {
  id: string
  first_name: string
  last_name: string
  display_name: string
  is_admin: boolean
  paid: boolean
  created_at: string
}

export interface Match {
  id: number
  home_team_id: number
  away_team_id: number
  speeldag: number | null
  match_datetime: string | null
  is_cup_final: boolean
  sofascore_event_id: number | null
  home_team?: Team
  away_team?: Team
}

export interface Result {
  id: number
  match_id: number
  home_score: number
  away_score: number
  entered_at: string
}

export interface Prediction {
  id: number
  user_id: string
  match_id: number
  home_score: number
  away_score: number
  created_at: string
}

export interface ExtraQuestion {
  id: number
  question_key: string
  question_label: string
  points: number
}

export interface ExtraQuestionAnswer {
  id: number
  question_id: number
  correct_answer: string
}

export interface ExtraPrediction {
  id: number
  user_id: string
  question_id: number
  answer: string
}

export interface PlayerScore {
  id: number
  user_id: string
  total_score: number
  match_score: number
  extra_score: number
  exact_matches: number
  correct_goal_diffs: number
  correct_results: number
  previous_rank: number | null
  rank_change: number
  updated_at: string
}

export interface StandingRow {
  rank: number
  rank_change: number
  user_id: string
  display_name: string
  total_score: number
  exact_matches: number
  correct_goal_diffs: number
  correct_results: number
  match_score: number
  extra_score: number
}

export interface MatchWithDetails extends Match {
  home_team: Team
  away_team: Team
  result?: Result | null
}

export interface FootballPlayer {
  id: number
  name: string
  team: string
  position: string
  goals: number
  assists: number
  clean_sheets: number | null
}

export type PaymentStatus = 'unpaid' | 'pending' | 'paid'
export type PaymentMethod = 'wero' | 'transfer' | 'cash'

export interface Player {
  id: string
  display_name: string
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  paid_at: string | null
}

export interface PredictionWithPoints extends Prediction {
  points: number
  category: 'exact' | 'goal_diff' | 'result' | 'wrong' | 'pending'
  display_name?: string
}

export interface Edition {
  id: number
  year: number
  label: string
  max_points: number | null
  player_count: number
  is_current: boolean
}

export interface EditionScore {
  id: number
  edition_id: number
  player_name: string
  rank: number
  total_score: number
  z_score: number | null
  percentile: number | null
  points_pct: number | null
}

export interface AlltimeScore {
  id: number
  player_name: string
  years_played: number
  avg_z_score: number | null
  avg_percentile: number | null
  avg_points_pct: number | null
  combined_score: number | null
  best_rank: number | null
  best_rank_year: number | null
}

export interface Subgroup {
  id: number
  name: string
}

export interface PlayerSubgroup {
  player_id: string
  subgroup_id: number
}
