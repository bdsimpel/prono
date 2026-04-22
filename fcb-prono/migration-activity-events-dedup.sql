-- activity_events dedup: auto-generated stable key per event type + UNIQUE constraint.
-- Prevents duplicates from concurrent inserts (multiple live-score polls) and re-runs
-- (admin recalculate-stats regenerating metric events).

-- 1. Clean up any pre-existing duplicates (keep oldest row per dedup group).
DELETE FROM activity_events a USING activity_events b
WHERE a.id > b.id
  AND a.type = b.type
  AND (
    (a.type IN ('result', 'rare_exact')
      AND a.metadata->>'match_id' = b.metadata->>'match_id'
      AND a.metadata->>'match_id' IS NOT NULL)
    OR (a.type IN ('speeldag_top', 'standings_top3', 'standings_leader')
      AND a.metadata->>'speeldag' = b.metadata->>'speeldag'
      AND a.metadata->>'speeldag' IS NOT NULL)
    OR a.type IN ('streak', 'no_zero')
  );

-- 2. Add generated dedup_key column. NULL for event types that allow duplicates
--    (signup, points, payment, lock, extra_answer).
ALTER TABLE activity_events ADD COLUMN dedup_key TEXT GENERATED ALWAYS AS (
  CASE type
    WHEN 'result'           THEN 'result:' || (metadata->>'match_id')
    WHEN 'rare_exact'       THEN 'rare_exact:' || (metadata->>'match_id')
    WHEN 'speeldag_top'     THEN 'speeldag_top:' || (metadata->>'speeldag')
    WHEN 'standings_top3'   THEN 'standings_top3:' || (metadata->>'speeldag')
    WHEN 'standings_leader' THEN 'standings_leader:' || (metadata->>'speeldag')
    WHEN 'streak'           THEN 'streak'
    WHEN 'no_zero'          THEN 'no_zero'
    ELSE NULL
  END
) STORED;

-- 3. Enforce uniqueness. UNIQUE allows multiple NULLs, so duplicate-allowed types
--    (signup, points, payment, lock, extra_answer) stay unconstrained.
ALTER TABLE activity_events
  ADD CONSTRAINT activity_events_dedup_unique UNIQUE (dedup_key);
