-- 6 playoff teams
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  matrix_index INT NOT NULL UNIQUE,
  standing_rank INT,
  points_half NUMERIC,
  goals_for INT,
  goals_against INT
);

-- User profiles (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  is_admin BOOLEAN DEFAULT false,
  paid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 30 league matches + 1 cup final
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  home_team_id INT REFERENCES teams(id),
  away_team_id INT REFERENCES teams(id),
  speeldag INT,
  match_datetime TIMESTAMPTZ,
  is_cup_final BOOLEAN DEFAULT false
);

-- Actual results (admin enters)
CREATE TABLE results (
  id SERIAL PRIMARY KEY,
  match_id INT REFERENCES matches(id) UNIQUE,
  home_score INT NOT NULL,
  away_score INT NOT NULL,
  entered_at TIMESTAMPTZ DEFAULT now()
);

-- User match predictions
CREATE TABLE predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id INT REFERENCES matches(id),
  home_score INT NOT NULL,
  away_score INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, match_id)
);

-- 8 extra questions
CREATE TABLE extra_questions (
  id SERIAL PRIMARY KEY,
  question_key TEXT NOT NULL UNIQUE,
  question_label TEXT NOT NULL,
  points INT NOT NULL DEFAULT 10
);

-- Correct answers for extra questions (admin, can be multiple per question)
CREATE TABLE extra_question_answers (
  id SERIAL PRIMARY KEY,
  question_id INT REFERENCES extra_questions(id),
  correct_answer TEXT NOT NULL,
  UNIQUE(question_id, correct_answer)
);

-- User extra question predictions
CREATE TABLE extra_predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id INT REFERENCES extra_questions(id),
  answer TEXT NOT NULL,
  UNIQUE(user_id, question_id)
);

-- Cached scores (recalculated when admin enters results)
CREATE TABLE player_scores (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_score INT DEFAULT 0,
  match_score INT DEFAULT 0,
  extra_score INT DEFAULT 0,
  exact_matches INT DEFAULT 0,
  correct_goal_diffs INT DEFAULT 0,
  correct_results INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- App settings (deadline, etc.)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed settings
INSERT INTO settings VALUES ('predictions_locked', 'false');
INSERT INTO settings VALUES ('deadline', '2026-04-01T18:00:00Z');

-- Seed teams
INSERT INTO teams (name, short_name, matrix_index, standing_rank, points_half, goals_for, goals_against) VALUES
  ('Union', 'UNI', 1, 1, 33, 50, 17),
  ('Club Brugge', 'CLB', 2, 2, 31.5, 59, 36),
  ('STVV', 'STV', 3, 3, 28.5, 47, 35),
  ('Gent', 'GNT', 5, 4, 22.5, 49, 43),
  ('Mechelen', 'MEC', 6, 5, 22.5, 39, 37),
  ('Anderlecht', 'AND', 4, 6, 22, 43, 39);

-- Seed extra questions
INSERT INTO extra_questions (question_key, question_label, points) VALUES
  ('bekerwinnaar', 'Bekerwinnaar', 10),
  ('beste_ploeg_poi', 'Beste ploeg van POI', 10),
  ('topscorer_poi', 'Topscorer POI', 10),
  ('assistenkoning_poi', 'Assistenkoning POI', 10),
  ('meeste_clean_sheets_poi', 'Meeste Clean Sheets POI', 10),
  ('meeste_goals_poi', 'Meeste gemaakte goals POI', 10),
  ('minste_goals_tegen_poi', 'Minste goals tegen POI', 10),
  ('kampioen', 'Kampioen', 20);

-- Seed matches (30 league matches, round-robin home & away)
-- Team IDs: Union=1, Club Brugge=2, STVV=3, Anderlecht=4, Gent=5, Mechelen=6
INSERT INTO matches (home_team_id, away_team_id, speeldag, match_datetime, is_cup_final) VALUES
  -- Speeldag 1
  (1, 6, 1, '2026-03-28T20:45:00Z', false),  -- Union vs Mechelen
  (2, 4, 1, '2026-03-29T13:30:00Z', false),  -- Club Brugge vs Anderlecht
  (3, 5, 1, '2026-03-29T18:30:00Z', false),  -- STVV vs Gent
  -- Speeldag 2
  (5, 1, 2, '2026-04-04T20:45:00Z', false),  -- Gent vs Union
  (6, 2, 2, '2026-04-05T13:30:00Z', false),  -- Mechelen vs Club Brugge
  (4, 3, 2, '2026-04-05T18:30:00Z', false),  -- Anderlecht vs STVV
  -- Speeldag 3
  (1, 4, 3, '2026-04-11T20:45:00Z', false),  -- Union vs Anderlecht
  (6, 5, 3, '2026-04-12T13:30:00Z', false),  -- Mechelen vs Gent
  (2, 3, 3, '2026-04-12T18:30:00Z', false),  -- Club Brugge vs STVV
  -- Speeldag 4
  (4, 6, 4, '2026-04-19T13:30:00Z', false),  -- Anderlecht vs Mechelen
  (3, 1, 4, '2026-04-19T16:00:00Z', false),  -- STVV vs Union
  (5, 2, 4, '2026-04-19T18:30:00Z', false),  -- Gent vs Club Brugge
  -- Speeldag 5
  (6, 3, 5, '2026-04-22T20:30:00Z', false),  -- Mechelen vs STVV
  (4, 5, 5, '2026-04-22T20:30:00Z', false),  -- Anderlecht vs Gent
  (2, 1, 5, '2026-04-23T20:30:00Z', false),  -- Club Brugge vs Union
  -- Speeldag 6 (return leg)
  (6, 1, 6, '2026-04-26T13:30:00Z', false),  -- Mechelen vs Union
  (4, 2, 6, '2026-04-26T16:00:00Z', false),  -- Anderlecht vs Club Brugge
  (5, 3, 6, '2026-04-26T18:30:00Z', false),  -- Gent vs STVV
  -- Speeldag 7
  (1, 5, 7, '2026-05-02T13:30:00Z', false),  -- Union vs Gent
  (2, 6, 7, '2026-05-02T16:00:00Z', false),  -- Club Brugge vs Mechelen
  (3, 4, 7, '2026-05-03T20:45:00Z', false),  -- STVV vs Anderlecht
  -- Speeldag 8
  (4, 1, 8, '2026-05-09T20:45:00Z', false),  -- Anderlecht vs Union
  (5, 6, 8, '2026-05-10T13:30:00Z', false),  -- Gent vs Mechelen
  (3, 2, 8, '2026-05-10T18:30:00Z', false),  -- STVV vs Club Brugge
  -- Speeldag 9
  (6, 4, 9, '2026-05-16T20:45:00Z', false),  -- Mechelen vs Anderlecht
  (1, 3, 9, '2026-05-17T13:30:00Z', false),  -- Union vs STVV
  (2, 5, 9, '2026-05-17T18:30:00Z', false),  -- Club Brugge vs Gent
  -- Speeldag 10
  (3, 6, 10, '2026-05-24T18:30:00Z', false),  -- STVV vs Mechelen
  (5, 4, 10, '2026-05-24T18:30:00Z', false),  -- Gent vs Anderlecht
  (1, 2, 10, '2026-05-24T18:30:00Z', false);  -- Union vs Club Brugge

-- Cup final (Anderlecht vs Union)
INSERT INTO matches (home_team_id, away_team_id, speeldag, match_datetime, is_cup_final) VALUES
  (4, 1, NULL, '2026-05-14T15:00:00Z', true);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (new.id, '', '');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read teams" ON teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read matches" ON matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read results" ON results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read predictions" ON predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read extra_questions" ON extra_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read extra_question_answers" ON extra_question_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read extra_predictions" ON extra_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read player_scores" ON player_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read settings" ON settings FOR SELECT TO authenticated USING (true);

-- Profiles: users can update own
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Predictions: users can insert/update own, only when not locked
CREATE POLICY "Users can insert own predictions" ON predictions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT value FROM settings WHERE key = 'predictions_locked') = 'false'
  );
CREATE POLICY "Users can update own predictions" ON predictions
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND (SELECT value FROM settings WHERE key = 'predictions_locked') = 'false'
  );

CREATE POLICY "Users can insert own extra predictions" ON extra_predictions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT value FROM settings WHERE key = 'predictions_locked') = 'false'
  );
CREATE POLICY "Users can update own extra predictions" ON extra_predictions
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND (SELECT value FROM settings WHERE key = 'predictions_locked') = 'false'
  );

-- Admin write policies
CREATE POLICY "Admins can manage results" ON results
  FOR ALL TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage extra_question_answers" ON extra_question_answers
  FOR ALL TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage settings" ON settings
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage player_scores" ON player_scores
  FOR ALL TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));
