export interface Team {
  id: number
  name: string
  short_name: string | null
  matrix_index: number
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

export interface PredictionWithPoints extends Prediction {
  points: number
  category: 'exact' | 'goal_diff' | 'result' | 'wrong' | 'pending'
  display_name?: string
}
