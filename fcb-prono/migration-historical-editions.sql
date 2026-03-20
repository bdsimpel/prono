-- Historical editions tables for FCB Prono leaderboard history

-- Table: editions
CREATE TABLE IF NOT EXISTS editions (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  max_points INT,
  player_count INT DEFAULT 0,
  is_current BOOLEAN DEFAULT false
);

-- Table: edition_scores
CREATE TABLE IF NOT EXISTS edition_scores (
  id SERIAL PRIMARY KEY,
  edition_id INT REFERENCES editions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  rank INT NOT NULL,
  total_score NUMERIC NOT NULL,
  z_score NUMERIC,
  percentile NUMERIC,
  points_pct NUMERIC,
  UNIQUE(edition_id, player_name)
);

-- Table: alltime_scores
CREATE TABLE IF NOT EXISTS alltime_scores (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL UNIQUE,
  years_played INT NOT NULL,
  avg_z_score NUMERIC,
  avg_percentile NUMERIC,
  avg_points_pct NUMERIC,
  combined_score NUMERIC,
  best_rank INT,
  best_rank_year INT
);

-- Add matched_historical_name to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS matched_historical_name TEXT;

-- RLS: public read on all new tables
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edition_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE alltime_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editions_read" ON editions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "edition_scores_read" ON edition_scores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "alltime_scores_read" ON alltime_scores FOR SELECT TO anon, authenticated USING (true);
