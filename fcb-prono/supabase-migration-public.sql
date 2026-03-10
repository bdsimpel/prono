-- Migration: Public Submission Flow (No Login)
-- Run this in the Supabase SQL Editor

-- 1. Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS players_display_name_lower ON players (lower(display_name));

-- Enable RLS on players
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Public read access on players
DROP POLICY IF EXISTS "Anyone can read players" ON players;
CREATE POLICY "Anyone can read players" ON players
  FOR SELECT TO anon, authenticated USING (true);

-- 2. Migrate existing data from profiles to players
INSERT INTO players (id, display_name, submitted_at)
SELECT id, display_name, created_at
FROM profiles
WHERE first_name != '' AND NOT is_admin
ON CONFLICT DO NOTHING;

-- 3. Drop existing FK constraints on predictions, extra_predictions, player_scores
-- predictions: drop FK on user_id -> auth.users
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_user_id_fkey;
-- extra_predictions: drop FK on user_id -> auth.users
ALTER TABLE extra_predictions DROP CONSTRAINT IF EXISTS extra_predictions_user_id_fkey;
-- player_scores: drop FK on user_id -> auth.users
ALTER TABLE player_scores DROP CONSTRAINT IF EXISTS player_scores_user_id_fkey;

-- 4. Add new FK constraints pointing to players(id)
DO $$ BEGIN
  ALTER TABLE predictions
    ADD CONSTRAINT predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES players(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE extra_predictions
    ADD CONSTRAINT extra_predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES players(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE player_scores
    ADD CONSTRAINT player_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES players(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Update RLS policies for public read access

-- predictions: allow anon SELECT
DROP POLICY IF EXISTS "Users can view own predictions" ON predictions;
DROP POLICY IF EXISTS "Anyone can read predictions" ON predictions;
CREATE POLICY "Anyone can read predictions" ON predictions
  FOR SELECT TO anon, authenticated USING (true);

-- Remove user INSERT/UPDATE policies on predictions (submissions go through service role)
DROP POLICY IF EXISTS "Users can insert own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can update own predictions" ON predictions;

-- extra_predictions: allow anon SELECT
DROP POLICY IF EXISTS "Users can view own extra predictions" ON extra_predictions;
DROP POLICY IF EXISTS "Anyone can read extra predictions" ON extra_predictions;
CREATE POLICY "Anyone can read extra predictions" ON extra_predictions
  FOR SELECT TO anon, authenticated USING (true);

-- Remove user INSERT/UPDATE policies on extra_predictions
DROP POLICY IF EXISTS "Users can insert own extra predictions" ON extra_predictions;
DROP POLICY IF EXISTS "Users can update own extra predictions" ON extra_predictions;

-- player_scores: allow anon SELECT
DROP POLICY IF EXISTS "Users can view all scores" ON player_scores;
DROP POLICY IF EXISTS "Anyone can read player scores" ON player_scores;
CREATE POLICY "Anyone can read player scores" ON player_scores
  FOR SELECT TO anon, authenticated USING (true);

-- matches: allow anon SELECT
DROP POLICY IF EXISTS "Users can view matches" ON matches;
DROP POLICY IF EXISTS "Anyone can read matches" ON matches;
CREATE POLICY "Anyone can read matches" ON matches
  FOR SELECT TO anon, authenticated USING (true);

-- teams: allow anon SELECT
DROP POLICY IF EXISTS "Users can view teams" ON teams;
DROP POLICY IF EXISTS "Anyone can read teams" ON teams;
CREATE POLICY "Anyone can read teams" ON teams
  FOR SELECT TO anon, authenticated USING (true);

-- results: allow anon SELECT
DROP POLICY IF EXISTS "Users can view results" ON results;
DROP POLICY IF EXISTS "Anyone can read results" ON results;
CREATE POLICY "Anyone can read results" ON results
  FOR SELECT TO anon, authenticated USING (true);

-- extra_questions: allow anon SELECT
DROP POLICY IF EXISTS "Users can view extra questions" ON extra_questions;
DROP POLICY IF EXISTS "Anyone can read extra questions" ON extra_questions;
CREATE POLICY "Anyone can read extra questions" ON extra_questions
  FOR SELECT TO anon, authenticated USING (true);

-- extra_question_answers: allow anon SELECT
DROP POLICY IF EXISTS "Users can view extra question answers" ON extra_question_answers;
DROP POLICY IF EXISTS "Anyone can read extra question answers" ON extra_question_answers;
CREATE POLICY "Anyone can read extra question answers" ON extra_question_answers
  FOR SELECT TO anon, authenticated USING (true);

-- settings: allow anon SELECT
DROP POLICY IF EXISTS "Users can view settings" ON settings;
DROP POLICY IF EXISTS "Anyone can read settings" ON settings;
CREATE POLICY "Anyone can read settings" ON settings
  FOR SELECT TO anon, authenticated USING (true);

-- 6. Drop the handle_new_user trigger (if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 7. Create football_players table for player combobox
CREATE TABLE IF NOT EXISTS football_players (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT NOT NULL,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  clean_sheets INTEGER,  -- NULL voor niet-keepers
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: iedereen mag lezen
ALTER TABLE football_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read football_players" ON football_players;
CREATE POLICY "Anyone can read football_players" ON football_players
  FOR SELECT TO anon, authenticated USING (true);
