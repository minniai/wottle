-- Add completed_at to matches for recent-games queries.
-- matches.updated_at changes on every round; completed_at captures the
-- exact instant the match reached state='completed', enabling ordered
-- match history without scanning rounds.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill existing completed matches using updated_at as a proxy.
UPDATE public.matches
  SET completed_at = updated_at
  WHERE state = 'completed' AND completed_at IS NULL;

COMMENT ON COLUMN public.matches.completed_at IS
  'Timestamp when the match reached state=''completed''. '
  'Set by roundEngine at match-end. Used for ordered match history.';
