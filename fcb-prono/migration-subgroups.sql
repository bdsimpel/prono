-- Subgroups: allow tagging players into groups (TechWolf, VLM, Chiro, DBL, etc.)

CREATE TABLE subgroups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE player_subgroups (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  subgroup_id INT NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  UNIQUE(player_id, subgroup_id)
);

-- RLS: public read, admin write via service role
ALTER TABLE subgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_subgroups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subgroups" ON subgroups
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can read player_subgroups" ON player_subgroups
  FOR SELECT TO anon, authenticated USING (true);

-- Seed initial groups
INSERT INTO subgroups (name) VALUES
  ('TechWolf'),
  ('VLM'),
  ('Chiro'),
  ('DBL');
