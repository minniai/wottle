-- match_heartbeats: per-player liveness tracker for the disconnect safety
-- net (issue #164). Upserted on every /api/match/[matchId]/state poll
-- (~2s cadence). `loadMatchState` surfaces `disconnectedPlayerId` when the
-- opponent's `last_seen_at` falls behind HEARTBEAT_STALE_MS in code.
--
-- Why Postgres instead of an in-memory Map (see issue #161/#163 post-mortem):
-- per-process state on Vercel's multi-instance serverless runtime gave each
-- instance only a partial view of peer activity and caused false-positive
-- disconnect modals during normal play. A shared row is authoritative for
-- every request that lands in the state endpoint, regardless of which
-- instance served it.

CREATE TABLE IF NOT EXISTS public.match_heartbeats (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

ALTER TABLE public.match_heartbeats ENABLE ROW LEVEL SECURITY;

-- Participants may read heartbeats for their own matches. Writes go through
-- service_role only (the /state API route upserts the caller's heartbeat
-- after session verification).
CREATE POLICY "match_heartbeats_select_participants"
  ON public.match_heartbeats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.player_a_id = auth.uid() OR m.player_b_id = auth.uid())
    )
  );

COMMENT ON TABLE public.match_heartbeats IS
  'Per-player liveness heartbeat. Upserted on every /api/match/[matchId]/state '
  'poll; loadMatchState flags a player as disconnected when last_seen_at '
  'is older than HEARTBEAT_STALE_MS. Safety net for the case where '
  'pagehide/sendBeacon and Realtime presence both fail to fire (issue #164).';
