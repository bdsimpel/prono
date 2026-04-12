-- Add detail column to match_events for tracking penalty/own goal
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS detail TEXT;
