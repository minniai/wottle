-- 017-elo-rating-player-stats: Elo rating columns + match_ratings table

-- Backfill existing NULL elo_rating values to 1200
UPDATE public.players SET elo_rating = 1200 WHERE elo_rating IS NULL;

-- Make elo_rating NOT NULL with default 1200
ALTER TABLE public.players
  ALTER COLUMN elo_rating SET DEFAULT 1200,
  ALTER COLUMN elo_rating SET NOT NULL;

-- Add player stats columns
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS games_played integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draws integer NOT NULL DEFAULT 0;

-- Add CHECK constraints
ALTER TABLE public.players
  ADD CONSTRAINT chk_elo_rating_floor CHECK (elo_rating >= 100),
  ADD CONSTRAINT chk_games_played_non_negative CHECK (games_played >= 0),
  ADD CONSTRAINT chk_wins_non_negative CHECK (wins >= 0),
  ADD CONSTRAINT chk_losses_non_negative CHECK (losses >= 0),
  ADD CONSTRAINT chk_draws_non_negative CHECK (draws >= 0),
  ADD CONSTRAINT chk_games_played_consistency CHECK (games_played = wins + losses + draws);

-- Create match_ratings table for per-match rating snapshots
CREATE TABLE IF NOT EXISTS public.match_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  rating_before integer NOT NULL CHECK (rating_before >= 100),
  rating_after integer NOT NULL CHECK (rating_after >= 100),
  rating_delta integer NOT NULL,
  k_factor integer NOT NULL CHECK (k_factor IN (16, 32)),
  match_result text NOT NULL CHECK (match_result IN ('win', 'loss', 'draw')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_match_ratings_match_player UNIQUE (match_id, player_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_match_ratings_player_created
  ON public.match_ratings (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_ratings_match
  ON public.match_ratings (match_id);

-- RLS policies: ratings are public to read, service-role only to write
ALTER TABLE public.match_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_ratings_select_all"
  ON public.match_ratings FOR SELECT
  USING (true);

CREATE POLICY "match_ratings_insert_service"
  ON public.match_ratings FOR INSERT
  WITH CHECK (false);

CREATE POLICY "match_ratings_update_service"
  ON public.match_ratings FOR UPDATE
  USING (false);

CREATE POLICY "match_ratings_delete_service"
  ON public.match_ratings FOR DELETE
  USING (false);
