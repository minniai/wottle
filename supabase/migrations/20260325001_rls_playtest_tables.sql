-- Migration: Enable RLS on playtest tables (security fix)
-- Closes the gap left by 20251115001_playtest.sql which created 9 tables
-- without enabling Row Level Security.
--
-- Policy design:
--   - All writes are server-side (service_role bypasses RLS by default in Supabase)
--   - Players can read their own data; match participants can read match data
--   - Anon / unauthenticated users get nothing
--   - match_logs and scoreboard_snapshots: participants can read
--   - word_score_entries: participants can read (needed for score display)

-- players ------------------------------------------------------------------
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read player profiles (needed for lobby, opponent display)
CREATE POLICY "players_select_authenticated"
  ON public.players FOR SELECT
  USING (auth.role() = 'authenticated');

-- Players can only update their own profile
CREATE POLICY "players_update_own"
  ON public.players FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert/delete handled by service_role only (no policy needed; service_role bypasses RLS)


-- lobby_presence -----------------------------------------------------------
ALTER TABLE public.lobby_presence ENABLE ROW LEVEL SECURITY;

-- Authenticated players can see the lobby (needed for matchmaking)
CREATE POLICY "lobby_presence_select_authenticated"
  ON public.lobby_presence FOR SELECT
  USING (auth.role() = 'authenticated');

-- Players can only upsert/delete their own presence row
CREATE POLICY "lobby_presence_insert_own"
  ON public.lobby_presence FOR INSERT
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "lobby_presence_update_own"
  ON public.lobby_presence FOR UPDATE
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "lobby_presence_delete_own"
  ON public.lobby_presence FOR DELETE
  USING (player_id = auth.uid());


-- matches ------------------------------------------------------------------
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Match participants can read their match
CREATE POLICY "matches_select_participants"
  ON public.matches FOR SELECT
  USING (
    player_a_id = auth.uid() OR player_b_id = auth.uid()
  );

-- Writes handled by service_role only


-- rounds -------------------------------------------------------------------
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

-- Participants of the parent match can read rounds
CREATE POLICY "rounds_select_participants"
  ON public.rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.player_a_id = auth.uid() OR m.player_b_id = auth.uid())
    )
  );

-- Writes handled by service_role only


-- move_submissions ---------------------------------------------------------
ALTER TABLE public.move_submissions ENABLE ROW LEVEL SECURITY;

-- Players can read submissions in rounds they participate in
CREATE POLICY "move_submissions_select_participants"
  ON public.move_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.matches m ON m.id = r.match_id
      WHERE r.id = round_id
        AND (m.player_a_id = auth.uid() OR m.player_b_id = auth.uid())
    )
  );

-- Players can insert their own submission
CREATE POLICY "move_submissions_insert_own"
  ON public.move_submissions FOR INSERT
  WITH CHECK (player_id = auth.uid());

-- Updates/deletes handled by service_role only


-- match_invitations --------------------------------------------------------
ALTER TABLE public.match_invitations ENABLE ROW LEVEL SECURITY;

-- Sender and recipient can read their invitation
CREATE POLICY "match_invitations_select_participants"
  ON public.match_invitations FOR SELECT
  USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

-- Authenticated players can send invitations
CREATE POLICY "match_invitations_insert_own"
  ON public.match_invitations FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Recipient can update (accept/decline)
CREATE POLICY "match_invitations_update_recipient"
  ON public.match_invitations FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Deletes handled by service_role only


-- word_score_entries -------------------------------------------------------
ALTER TABLE public.word_score_entries ENABLE ROW LEVEL SECURITY;

-- Match participants can read score entries
CREATE POLICY "word_score_entries_select_participants"
  ON public.word_score_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.player_a_id = auth.uid() OR m.player_b_id = auth.uid())
    )
  );

-- Writes handled by service_role only


-- scoreboard_snapshots -----------------------------------------------------
ALTER TABLE public.scoreboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Match participants can read snapshots
CREATE POLICY "scoreboard_snapshots_select_participants"
  ON public.scoreboard_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.player_a_id = auth.uid() OR m.player_b_id = auth.uid())
    )
  );

-- Writes handled by service_role only


-- match_logs ---------------------------------------------------------------
ALTER TABLE public.match_logs ENABLE ROW LEVEL SECURITY;

-- Match participants can read logs for their match
CREATE POLICY "match_logs_select_participants"
  ON public.match_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.player_a_id = auth.uid() OR m.player_b_id = auth.uid())
    )
  );

-- Writes handled by service_role only
