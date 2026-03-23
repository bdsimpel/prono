-- Activity events table for the activity feed on the leaderboard page
CREATE TABLE activity_events (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('signup', 'result', 'payment', 'points', 'lock', 'extra_answer')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read activity_events" ON activity_events FOR SELECT USING (true);
