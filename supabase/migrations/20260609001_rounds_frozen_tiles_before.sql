-- Spec 042 follow-up: snapshot the frozen-tile map as it stood at round start.
--
-- The instant-scoring fast path (spec 042 / Linear O-57) merges the first
-- mover's freezes into matches.frozen_tiles while the round is still
-- `collecting`. advanceRound's combined scoring pass previously re-read
-- matches.frozen_tiles and fed those same-round freezes back into
-- processRoundScoring, whose frozen-coordinate guard then rejected the first
-- mover's own swap — deleting their word_score_entries rows (delete-then-
-- insert idempotency) and dropping their swap from the final board.
--
-- rounds.frozen_tiles_before mirrors board_snapshot_before: it records the
-- canonical pre-round freeze state so both scoring paths score against the
-- same baseline regardless of what the fast path persisted mid-round.
ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS frozen_tiles_before JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN rounds.frozen_tiles_before IS
  'Frozen-tile map (matches.frozen_tiles shape) as it stood when this round started collecting. Scoring baseline for both the instant-scoring fast path and the combined pass.';
