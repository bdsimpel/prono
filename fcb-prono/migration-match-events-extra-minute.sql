-- Add extra_minute column for stoppage time (e.g., 45+2)
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS extra_minute INT;
