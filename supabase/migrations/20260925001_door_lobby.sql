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

-- ─── Presence (US6) ────────────────────────────────────────────────────
-- A tab is fresh while it has not missed three beats of its cadence (plus 5s)
-- and any leaving mark is under 8s old. The constants are lib/presence/constants.ts.

create or replace function public.tab_is_fresh(p_beat_at timestamptz, p_cadence_ms integer, p_leaving_at timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_beat_at > now() - make_interval(secs => (3 * p_cadence_ms + 5000) / 1000.0)
     and (p_leaving_at is null or p_leaving_at > now() - interval '8 seconds');
$$;

-- `now()` is stable, not immutable; the planner must re-evaluate it per call.
alter function public.tab_is_fresh(timestamptz, integer, timestamptz) stable;

-- The latest moment any of the player's tabs is still fresh: the summary row's expiry.
create or replace function public.presence_expiry(p_player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(
    max(case when t.leaving_at is null
             then t.beat_at + make_interval(secs => (3 * t.cadence_ms + 5000) / 1000.0)
             else least(t.beat_at + make_interval(secs => (3 * t.cadence_ms + 5000) / 1000.0), t.leaving_at + interval '8 seconds') end),
    now())
    from public.presence_tabs t
   where t.player_id = p_player;
$$;

create or replace function public.beat_tab(
  p_player uuid,
  p_tab uuid,
  p_visible boolean,
  p_input_ago_ms integer,
  p_page text
)
returns table (transition boolean, language text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lang text;
  v_cadence integer := case when p_visible then 10000 else 30000 end;
  v_input timestamptz := case when p_input_ago_ms is null then null
                              else now() - make_interval(secs => least(greatest(p_input_ago_ms, 0), 86400000) / 1000.0) end;
  v_prev_visible boolean;
  v_had_fresh boolean;
begin
  select coalesce(p.lobby_language, 'is') into v_lang from public.players p where p.id = p_player;
  if not found then
    raise exception 'beat_tab: unknown player %', p_player;
  end if;

  select exists (
    select 1 from public.presence_tabs t
     where t.player_id = p_player and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at)
  ) into v_had_fresh;
  select t.visible into v_prev_visible from public.presence_tabs t where t.tab_id = p_tab and t.player_id = p_player;

  insert into public.presence_tabs as t (tab_id, player_id, language, page, visible, hidden_since, last_input_at, cadence_ms, beat_at, leaving_at)
  values (p_tab, p_player, v_lang, p_page, p_visible, case when p_visible then null else now() end, v_input, v_cadence, now(), null)
  on conflict (tab_id) do update
     set language = excluded.language,
         page = excluded.page,
         visible = excluded.visible,
         hidden_since = case when excluded.visible then null else coalesce(t.hidden_since, now()) end,
         last_input_at = greatest(t.last_input_at, excluded.last_input_at),
         cadence_ms = excluded.cadence_ms,
         beat_at = now(),
         leaving_at = null
   where t.player_id = p_player;

  insert into public.lobby_presence (player_id, connection_id, mode, invite_token, expires_at, updated_at, language)
  values (p_player, p_tab, 'auto', null, public.presence_expiry(p_player), now(), v_lang)
  on conflict (player_id) do update
     set connection_id = excluded.connection_id,
         mode = 'auto',
         expires_at = excluded.expires_at,
         updated_at = now(),
         language = excluded.language;

  -- Seating (spec 069) reads attention from the player's best fresh tab.
  update public.players p
     set attention_visible = a.any_visible,
         attention_input_at = a.input_at,
         attention_at = now()
    from (
      select coalesce(bool_or(t.visible), false) as any_visible,
             max(t.last_input_at) filter (where t.visible) as input_at
        from public.presence_tabs t
       where t.player_id = p_player and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at)
    ) a
   where p.id = p_player;

  transition := not v_had_fresh or (v_prev_visible is not null and v_prev_visible is distinct from p_visible);
  language := v_lang;
  return next;
end;
$$;

create or replace function public.leave_tab(p_player uuid, p_tab uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.presence_tabs t set leaving_at = now() where t.tab_id = p_tab and t.player_id = p_player;
  update public.lobby_presence lp set expires_at = public.presence_expiry(p_player), updated_at = now()
   where lp.player_id = p_player;
end;
$$;

-- Each player with a fresh tab in this lobby, and their state (spec §7.1).
-- `in_match` comes from matches, never from players.status.
create or replace function public.player_presence(p_language text)
returns table (player_id uuid, state text, moves_played integer, queued boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with fresh as (
    select t.player_id,
           bool_or(t.visible or t.hidden_since > now() - interval '2 minutes') as present
      from public.presence_tabs t
     where t.language = p_language
       and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at)
     group by t.player_id
  )
  select f.player_id,
         case when live.moves is not null then 'in_match'
              when not f.present then 'away'
              when p.status = 'matchmaking' then 'searching'
              else 'here' end,
         live.moves,
         p.status = 'matchmaking'
    from fresh f
    join public.players p on p.id = f.player_id
    left join lateral (
      select case when m.player_a_id = f.player_id then m.player_a_moves else m.player_b_moves end::integer as moves
        from public.matches m
       where m.state in ('pending', 'in_progress')
         and (m.player_a_id = f.player_id or m.player_b_id = f.player_id)
       limit 1
    ) live on true;
$$;

-- The lobby's numbers (S10): here (present, not in a match), searching,
-- players at a table or in a match, and matches in progress in this language.
create or replace function public.lobby_counts(p_language text)
returns table (here integer, searching integer, players_in_match integer, matches_on integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where pp.state in ('here', 'searching'))::integer,
         count(*) filter (where pp.state = 'searching')::integer,
         count(*) filter (where pp.state = 'in_match')::integer,
         (select count(*) from public.matches m where m.state = 'in_progress' and m.language = p_language)::integer
    from public.player_presence(p_language) pp;
$$;

-- A player with tabs but none fresh is gone: their search stops and their
-- pending challenges, sent and received, end as `left` (§7.1, §7.4).
create or replace function public.settle_gone_players()
returns table (player_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with gone as (
    select p.id
      from public.players p
     where (p.status = 'matchmaking'
            or exists (select 1 from public.match_invitations i
                        where i.status = 'pending' and (i.sender_id = p.id or i.recipient_id = p.id)))
       and exists (select 1 from public.presence_tabs t where t.player_id = p.id)
       and not exists (select 1 from public.presence_tabs t
                        where t.player_id = p.id and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at))
  ),
  searches as (
    update public.players p
       set status = 'available', queue_language = null, queued_at = null, search_paused = false
      from gone g
     where p.id = g.id and p.status = 'matchmaking'
    returning p.id
  ),
  invites as (
    update public.match_invitations i
       set status = 'left', responded_at = now()
      from gone g
     where i.status = 'pending' and (i.sender_id = g.id or i.recipient_id = g.id)
    returning g.id
  )
  select distinct x.id from (select id from searches union all select id from invites) x;
end;
$$;

revoke all on function public.beat_tab(uuid, uuid, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.beat_tab(uuid, uuid, boolean, integer, text) to service_role;
revoke all on function public.leave_tab(uuid, uuid) from public, anon, authenticated;
grant execute on function public.leave_tab(uuid, uuid) to service_role;
revoke all on function public.player_presence(text) from public, anon, authenticated;
grant execute on function public.player_presence(text) to service_role;
revoke all on function public.lobby_counts(text) from public, anon, authenticated;
grant execute on function public.lobby_counts(text) to service_role;
revoke all on function public.settle_gone_players() from public, anon, authenticated;
grant execute on function public.settle_gone_players() to service_role;

-- Seating (spec 069) asks whether a player is attentive: a visible tab with
-- input in the last 30s. Tabs on any signed-in page now say so directly (US6.6);
-- the attention columns remain for the table's own reports between beats.
create or replace function public.player_is_attentive(p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.presence_tabs t
            where t.player_id = p_player
              and t.visible
              and t.last_input_at > now() - interval '30 seconds'
              and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at))
      or coalesce(
           (select p.attention_visible
                   and p.attention_at > now() - interval '10 seconds'
                   and p.attention_input_at > now() - interval '30 seconds'
              from public.players p where p.id = p_player),
           false);
$$;
