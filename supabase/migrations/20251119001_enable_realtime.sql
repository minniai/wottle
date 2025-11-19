-- Enable Realtime replication for presence and match coordination
-- This migration enables Supabase Realtime for tables that need real-time updates

-- Enable replica identity for lobby_presence
-- This allows Realtime to track changes and broadcast them to subscribers
alter table public.lobby_presence replica identity full;

-- Add lobby_presence to the realtime publication
-- This makes the table available to Realtime channels
alter publication supabase_realtime add table public.lobby_presence;

-- Enable replica identity for matches
-- Needed for real-time match state updates
alter table public.matches replica identity full;
alter publication supabase_realtime add table public.matches;

-- Enable replica identity for rounds
-- Needed for real-time round state updates during gameplay
alter table public.rounds replica identity full;
alter publication supabase_realtime add table public.rounds;

-- Enable replica identity for move_submissions
-- Allows real-time tracking of player moves
alter table public.move_submissions replica identity full;
alter publication supabase_realtime add table public.move_submissions;

-- Enable replica identity for match_invitations
-- Enables real-time invite notifications
alter table public.match_invitations replica identity full;
alter publication supabase_realtime add table public.match_invitations;

-- Note: We're using REPLICA IDENTITY FULL instead of DEFAULT because
-- these tables may have updates to non-primary-key columns that need
-- to be broadcast to subscribers (e.g., status changes, timer updates).

