-- Migration: Add frozen tile tracking and duplicate word detection
-- Feature: 003-word-engine-scoring

-- Add cumulative frozen tile map to matches table.
-- Keys are "x,y" coordinate strings. Values have owner: player_a | player_b | both.
ALTER TABLE public.matches
ADD COLUMN frozen_tiles jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.matches.frozen_tiles IS
  'Cumulative frozen tile map. Keys are "x,y" coordinate strings. Values: { owner: "player_a" | "player_b" | "both" }.';

-- Add duplicate tracking to word_score_entries.
-- True when this word was previously scored by the same player in an earlier round.
ALTER TABLE public.word_score_entries
ADD COLUMN is_duplicate boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.word_score_entries.is_duplicate IS
  'True when this word was previously scored by the same player in an earlier round of the same match. Total points will be 0.';
