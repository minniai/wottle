-- Migration: scoring_cleanup
-- Convert any existing "both" frozen tile owners to "player_a" (first-owner-wins)
-- and set is_duplicate default to false on word_score_entries.

-- T072: Convert "both" owner values in frozen_tiles JSONB
UPDATE matches
SET frozen_tiles = (
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN value->>'owner' = 'both' THEN jsonb_build_object('owner', 'player_a')
      ELSE value
    END
  )
  FROM jsonb_each(frozen_tiles)
)
WHERE frozen_tiles IS NOT NULL
  AND frozen_tiles::text LIKE '%"both"%';

-- T073: Set is_duplicate default to false (column kept for backward compat)
ALTER TABLE word_score_entries
  ALTER COLUMN is_duplicate SET DEFAULT false;
