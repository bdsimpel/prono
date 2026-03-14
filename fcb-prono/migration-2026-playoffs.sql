-- Migration: Update playoff teams and matches for 2026
-- Run this on the live Supabase database

-- 1. Add stats columns to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS standing_rank INT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS points_half NUMERIC;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS goals_for INT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS goals_against INT;

-- 2. Delete existing data (order matters for foreign keys)
DELETE FROM predictions;
DELETE FROM extra_predictions;
DELETE FROM player_scores;
DELETE FROM results;
DELETE FROM matches;
DELETE FROM teams;

-- 3. Reset the teams id sequence so IDs start from 1
ALTER SEQUENCE teams_id_seq RESTART WITH 1;

-- 4. Insert new teams (IDs will be 1-6)
INSERT INTO teams (name, short_name, matrix_index, standing_rank, points_half, goals_for, goals_against) VALUES
  ('Union', 'UNI', 1, 1, 30, 45, 16),
  ('Club Brugge', 'CLB', 2, 2, 28.5, 53, 34),
  ('STVV', 'STV', 3, 3, 28.5, 46, 31),
  ('Anderlecht', 'AND', 4, 4, 22, 41, 35),
  ('Gent', 'GNT', 5, 5, 21, 46, 42),
  ('Mechelen', 'MEC', 6, 6, 21, 37, 33);

-- 5. Reset the matches id sequence
ALTER SEQUENCE matches_id_seq RESTART WITH 1;

-- 6. Insert new matches (30 league + 1 cup final)
-- Team IDs: Union=1, Club Brugge=2, STVV=3, Anderlecht=4, Gent=5, Mechelen=6
INSERT INTO matches (home_team_id, away_team_id, speeldag, match_datetime, is_cup_final) VALUES
  -- Speeldag 1
  (1, 6, 1, '2026-03-28T20:45:00Z', false),
  (2, 4, 1, '2026-03-29T13:30:00Z', false),
  (3, 5, 1, '2026-03-29T18:30:00Z', false),
  -- Speeldag 2
  (5, 1, 2, '2026-04-04T20:45:00Z', false),
  (6, 2, 2, '2026-04-05T13:30:00Z', false),
  (4, 3, 2, '2026-04-05T18:30:00Z', false),
  -- Speeldag 3
  (1, 4, 3, '2026-04-11T20:45:00Z', false),
  (6, 5, 3, '2026-04-12T13:30:00Z', false),
  (2, 3, 3, '2026-04-12T18:30:00Z', false),
  -- Speeldag 4
  (4, 6, 4, '2026-04-19T13:30:00Z', false),
  (3, 1, 4, '2026-04-19T16:00:00Z', false),
  (5, 2, 4, '2026-04-19T18:30:00Z', false),
  -- Speeldag 5
  (6, 3, 5, '2026-04-22T20:30:00Z', false),
  (4, 5, 5, '2026-04-22T20:30:00Z', false),
  (2, 1, 5, '2026-04-23T20:30:00Z', false),
  -- Speeldag 6
  (6, 1, 6, '2026-04-26T13:30:00Z', false),
  (4, 2, 6, '2026-04-26T16:00:00Z', false),
  (5, 3, 6, '2026-04-26T18:30:00Z', false),
  -- Speeldag 7
  (1, 5, 7, '2026-05-02T13:30:00Z', false),
  (2, 6, 7, '2026-05-02T16:00:00Z', false),
  (3, 4, 7, '2026-05-03T20:45:00Z', false),
  -- Speeldag 8
  (4, 1, 8, '2026-05-09T20:45:00Z', false),
  (5, 6, 8, '2026-05-10T13:30:00Z', false),
  (3, 2, 8, '2026-05-10T18:30:00Z', false),
  -- Speeldag 9
  (6, 4, 9, '2026-05-16T20:45:00Z', false),
  (1, 3, 9, '2026-05-17T13:30:00Z', false),
  (2, 5, 9, '2026-05-17T18:30:00Z', false),
  -- Speeldag 10
  (3, 6, 10, '2026-05-24T18:30:00Z', false),
  (5, 4, 10, '2026-05-24T18:30:00Z', false),
  (1, 2, 10, '2026-05-24T18:30:00Z', false);

-- Cup final (Anderlecht vs Union)
INSERT INTO matches (home_team_id, away_team_id, speeldag, match_datetime, is_cup_final) VALUES
  (4, 1, NULL, '2026-05-14T15:00:00Z', true);
