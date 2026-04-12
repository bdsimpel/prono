-- Add new metric event types to activity_events
ALTER TABLE activity_events DROP CONSTRAINT activity_events_type_check;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_type_check
  CHECK (type IN ('signup', 'result', 'payment', 'points', 'lock', 'extra_answer', 'rare_exact', 'speeldag_top', 'standings_top3', 'standings_leader', 'no_zero', 'streak'));
