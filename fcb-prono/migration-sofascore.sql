-- Add sofascore_event_id to matches table for live score integration
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sofascore_event_id BIGINT;
