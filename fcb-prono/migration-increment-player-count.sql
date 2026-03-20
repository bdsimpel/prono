-- Atomic increment for edition player_count to avoid race conditions
CREATE OR REPLACE FUNCTION increment_player_count(p_edition_id integer)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE editions
  SET player_count = COALESCE(player_count, 0) + 1
  WHERE id = p_edition_id;
$$;
