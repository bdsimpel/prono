-- Match events table for tracking goals, assists, clean sheets per match
CREATE TABLE IF NOT EXISTS match_events (
  id SERIAL PRIMARY KEY,
  match_id INT REFERENCES matches(id) NOT NULL,
  event_type TEXT NOT NULL,  -- 'goal', 'assist', 'clean_sheet'
  player_name TEXT NOT NULL,
  football_player_id INT REFERENCES football_players(id),
  team_id INT REFERENCES teams(id) NOT NULL,
  minute INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, event_type, player_name, minute)
);

-- Allow public read access
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_events_read" ON match_events FOR SELECT USING (true);
