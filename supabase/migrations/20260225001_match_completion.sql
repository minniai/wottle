-- Add round start timestamp for server-authoritative clock computation.
ALTER TABLE public.rounds
  ADD COLUMN started_at timestamptz;

-- Backfill existing rows with created_at as approximation.
UPDATE public.rounds
  SET started_at = created_at
  WHERE started_at IS NULL;

COMMENT ON COLUMN public.rounds.started_at IS
  'Server timestamp when this round entered the collecting state. '
  'Used to compute per-player elapsed time for clock enforcement. '
  'Set by roundEngine when creating a new round.';
