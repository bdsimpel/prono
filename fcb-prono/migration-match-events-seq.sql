-- Add seq column for unique event ordering
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS seq INTEGER DEFAULT 0;

-- Populate seq for existing events based on minute ordering
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY match_id, event_type
    ORDER BY COALESCE(minute, 999)
  ) AS new_seq
  FROM match_events
  WHERE event_type IN ('goal', 'assist')
)
UPDATE match_events SET seq = numbered.new_seq
FROM numbered WHERE match_events.id = numbered.id;

-- Clean sheets get seq=0
UPDATE match_events SET seq = 0 WHERE event_type = 'clean_sheet';

-- Drop old unique constraint and add new one with seq
ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_match_id_event_type_player_name_minute_key;
ALTER TABLE match_events ADD CONSTRAINT match_events_match_id_event_type_player_name_seq_key
  UNIQUE (match_id, event_type, player_name, seq);
