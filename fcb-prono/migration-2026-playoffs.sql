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
  (1, 3, 1, '2026-04-04T18:45:00Z', false),  -- Union vs STVV
  (2, 4, 1, '2026-04-06T11:30:00Z', false),  -- Club Brugge vs Anderlecht
  (5, 6, 1, '2026-04-06T16:30:00Z', false),  -- Gent vs Mechelen
  -- Speeldag 2
  (3, 2, 2, '2026-04-11T18:45:00Z', false),  -- STVV vs Club Brugge
  (6, 1, 2, '2026-04-12T11:30:00Z', false),  -- Mechelen vs Union
  (4, 5, 2, '2026-04-12T16:30:00Z', false),  -- Anderlecht vs Gent
  -- Speeldag 3
  (6, 4, 3, '2026-04-18T18:45:00Z', false),  -- Mechelen vs Anderlecht
  (5, 3, 3, '2026-04-19T11:30:00Z', false),  -- Gent vs STVV
  (1, 2, 3, '2026-04-19T16:30:00Z', false),  -- Union vs Club Brugge
  -- Speeldag 4
  (1, 5, 4, '2026-04-22T18:30:00Z', false),  -- Union vs Gent
  (2, 6, 4, '2026-04-22T18:30:00Z', false),  -- Club Brugge vs Mechelen
  (3, 4, 4, '2026-04-23T18:30:00Z', false),  -- STVV vs Anderlecht
  -- Speeldag 5
  (5, 2, 5, '2026-04-26T11:30:00Z', false),  -- Gent vs Club Brugge
  (6, 3, 5, '2026-04-26T14:00:00Z', false),  -- Mechelen vs STVV
  (4, 1, 5, '2026-04-26T16:30:00Z', false),  -- Anderlecht vs Union
  -- Speeldag 6
  (3, 1, 6, '2026-05-02T18:45:00Z', false),  -- STVV vs Union
  (6, 5, 6, '2026-05-03T11:30:00Z', false),  -- Mechelen vs Gent
  (4, 2, 6, '2026-05-03T16:30:00Z', false),  -- Anderlecht vs Club Brugge
  -- Speeldag 7
  (2, 3, 7, '2026-05-09T18:45:00Z', false),  -- Club Brugge vs STVV
  (5, 4, 7, '2026-05-10T11:30:00Z', false),  -- Gent vs Anderlecht
  (1, 6, 7, '2026-05-10T16:30:00Z', false),  -- Union vs Mechelen
  -- Speeldag 8
  (3, 5, 8, '2026-05-16T18:45:00Z', false),  -- STVV vs Gent
  (4, 6, 8, '2026-05-17T11:30:00Z', false),  -- Anderlecht vs Mechelen
  (2, 1, 8, '2026-05-17T16:30:00Z', false),  -- Club Brugge vs Union
  -- Speeldag 9
  (6, 2, 9, '2026-05-21T18:30:00Z', false),  -- Mechelen vs Club Brugge
  (5, 1, 9, '2026-05-21T18:30:00Z', false),  -- Gent vs Union
  (4, 3, 9, '2026-05-21T18:30:00Z', false),  -- Anderlecht vs STVV
  -- Speeldag 10
  (2, 5, 10, '2026-05-24T16:30:00Z', false),  -- Club Brugge vs Gent
  (1, 4, 10, '2026-05-24T16:30:00Z', false),  -- Union vs Anderlecht
  (3, 6, 10, '2026-05-24T16:30:00Z', false);  -- STVV vs Mechelen

-- Cup final (Anderlecht vs Union)
INSERT INTO matches (home_team_id, away_team_id, speeldag, match_datetime, is_cup_final) VALUES
  (4, 1, NULL, '2026-05-14T15:00:00Z', true);
