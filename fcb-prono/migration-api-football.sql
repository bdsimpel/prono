-- Add api_football_fixture_id to matches table for API-Football live score integration
ALTER TABLE matches ADD COLUMN IF NOT EXISTS api_football_fixture_id BIGINT;
