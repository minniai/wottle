-- Spec 070: the door, the lobby, challenges and presence.
--
-- Presence becomes per tab (presence_tabs). A player's state is derived from
-- their fresh tabs, their search and their match at read time; lobby_presence
-- stays as the per-player summary that the orphan sweep, match creation and
-- sign-out already read. Each player has one lobby language, the last lobby
-- they entered. A challenge lasts 60s, can be withdrawn, and ends as `left`
-- when either player is gone; a decline starts a 60s cooldown for the pair.
-- A match heartbeat says whether it came from the match or from a page, so an
-- opponent on a page reads `stepped out`, not `reconnecting`.
--
-- Lock order, as in specs 067 and 069: players (ascending id) before the match
-- or the invitation, in every function here.

-- ─── Tables and columns ────────────────────────────────────────────────

create table if not exists public.presence_tabs (
  tab_id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  language text not null default 'is',
  page text not null default 'other',
  visible boolean not null default true,
  hidden_since timestamptz,
  last_input_at timestamptz,
  cadence_ms integer not null default 10000,
  beat_at timestamptz not null default now(),
  leaving_at timestamptz,
  constraint presence_tabs_language_check check (language in ('is', 'en')),
  constraint presence_tabs_page_check check (page in ('lobby', 'profile', 'rules', 'match', 'other')),
  constraint presence_tabs_cadence_ms_check check (cadence_ms in (10000, 30000))
);

comment on table public.presence_tabs is
  'Spec 070: one row per open tab of a signed-in player. Fresh while beat_at is within 3 × cadence + 5s and no leaving mark is older than 8s.';

create index if not exists presence_tabs_player_idx on public.presence_tabs (player_id);
create index if not exists presence_tabs_language_beat_idx on public.presence_tabs (language, beat_at desc);

alter table public.presence_tabs enable row level security;
revoke all on table public.presence_tabs from anon, authenticated;

alter table public.players
  add column if not exists lobby_language text,
  add column if not exists unseen_result_match_id uuid references public.matches(id) on delete set null;

alter table public.players drop constraint if exists players_lobby_language_check;
alter table public.players
  add constraint players_lobby_language_check check (lobby_language is null or lobby_language in ('is', 'en'));

comment on column public.players.lobby_language is
  'Spec 070: the last lobby the player entered while signed in. Reading a page in the other locale never changes it.';
comment on column public.players.unseen_result_match_id is
  'Spec 070: a match that ended while the player was away from it; the line slot shows it until the result is opened.';

alter table public.match_invitations
  add column if not exists expires_at timestamptz,
  add column if not exists auto_declined boolean not null default false;

update public.match_invitations
   set expires_at = created_at + interval '30 seconds'
 where expires_at is null;

alter table public.match_invitations alter column expires_at set default now() + interval '60 seconds';
alter table public.match_invitations alter column expires_at set not null;

alter table public.match_invitations drop constraint if exists match_invitations_status_check;
alter table public.match_invitations
  add constraint match_invitations_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired', 'withdrawn', 'superseded', 'left'));

comment on column public.match_invitations.auto_declined is
  'Spec 070: a challenge silenced by the three-declines rule; the sender reads declined, the recipient never sees it.';

create index if not exists match_invitations_sender_created_idx on public.match_invitations (sender_id, created_at desc);
create index if not exists match_invitations_pair_idx on public.match_invitations (sender_id, recipient_id, status, responded_at desc);
create index if not exists match_invitations_recipient_pending_idx on public.match_invitations (recipient_id) where status = 'pending';

alter table public.match_heartbeats
  add column if not exists source text not null default 'match',
  add column if not exists cadence_ms integer not null default 2000;

alter table public.match_heartbeats drop constraint if exists match_heartbeats_source_check;
alter table public.match_heartbeats
  add constraint match_heartbeats_source_check check (source in ('match', 'page'));

create index if not exists matches_head_to_head_a_idx on public.matches (player_a_id, language) where state = 'completed';
create index if not exists matches_head_to_head_b_idx on public.matches (player_b_id, language) where state = 'completed';
