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
drop function if exists public.settle_gone_players();

create or replace function public.settle_gone_players()
returns table (player_id uuid, counterpart_id uuid)
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
    returning p.id as gone_id, null::uuid as other_id
  ),
  invites as (
    update public.match_invitations i
       set status = 'left', responded_at = now()
      from gone g
     where i.status = 'pending' and (i.sender_id = g.id or i.recipient_id = g.id)
    returning g.id as gone_id, case when i.sender_id = g.id then i.recipient_id else i.sender_id end as other_id
  )
  select distinct x.gone_id, x.other_id from (select * from searches union all select * from invites) x;
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

-- ─── Head to head (US10, FR-038a) ──────────────────────────────────────
-- The viewer's record against each opponent in one language, over completed
-- matches that were played: never a void table, never an abandoned match.

create or replace function public.head_to_head(p_viewer uuid, p_language text)
returns table (opponent_id uuid, wins integer, losses integer, draws integer)
language sql
stable
security definer
set search_path = ''
as $$
  select case when m.player_a_id = p_viewer then m.player_b_id else m.player_a_id end,
         count(*) filter (where m.winner_id = p_viewer)::integer,
         count(*) filter (where m.winner_id is not null and m.winner_id <> p_viewer)::integer,
         count(*) filter (where m.winner_id is null)::integer
    from public.matches m
   where m.state = 'completed'
     and m.language = p_language
     and (m.ended_reason is null or m.ended_reason not in ('void', 'abandoned'))
     and (m.player_a_id = p_viewer or m.player_b_id = p_viewer)
   group by 1;
$$;

revoke all on function public.head_to_head(uuid, text) from public, anon, authenticated;
grant execute on function public.head_to_head(uuid, text) to service_role;

-- ─── Challenges (US3) ──────────────────────────────────────────────────
-- A challenge lasts 60s. One outgoing challenge per player. Every gate and
-- every limit is decided here, from stored rows, under both players' locks.

-- 'present', 'away' (every fresh tab hidden 2:00) or 'gone' (no fresh tab).
create or replace function public.presence_of(p_player uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when not exists (select 1 from public.presence_tabs t
                             where t.player_id = p_player and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at)) then 'gone'
           when exists (select 1 from public.presence_tabs t
                         where t.player_id = p_player and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at)
                           and (t.visible or t.hidden_since > now() - interval '2 minutes')) then 'present'
           else 'away' end;
$$;

create or replace function public.player_in_live_match(p_player uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.matches m
                  where m.state in ('pending', 'in_progress')
                    and (m.player_a_id = p_player or m.player_b_id = p_player));
$$;

-- Three declines from this recipient within 10 minutes, the last within the session's 4 hours.
create or replace function public.challenger_silenced(p_sender uuid, p_recipient uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  with declines as (
    select i.responded_at from public.match_invitations i
     where i.sender_id = p_sender and i.recipient_id = p_recipient
       and i.status = 'declined' and not i.auto_declined and i.responded_at is not null
     order by i.responded_at desc
     limit 3
  )
  select count(*) = 3
         and max(responded_at) > now() - interval '4 hours'
         and max(responded_at) - min(responded_at) <= interval '10 minutes'
    from declines;
$$;

create or replace function public.send_challenge(p_sender uuid, p_recipient uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lang text;
  v_rlang text;
  v_until timestamptz;
  v_reverse uuid;
  v_result jsonb;
  v_silenced boolean;
  v_withdrawn uuid[];
  v_invite uuid;
begin
  if p_sender = p_recipient then
    return jsonb_build_object('status', 'self');
  end if;
  perform 1 from public.players where id in (p_sender, p_recipient) order by id for update;

  select coalesce(lobby_language, 'is') into v_lang from public.players where id = p_sender;
  if not found then
    return jsonb_build_object('status', 'gone');
  end if;
  if public.player_in_live_match(p_sender) then
    return jsonb_build_object('status', 'busy_sender');
  end if;
  v_until := public.table_leave_cooldown_until(p_sender);
  if v_until is not null and v_until > now() then
    return jsonb_build_object('status', 'cooldown', 'until', v_until);
  end if;
  if (select count(*) from public.match_invitations
       where sender_id = p_sender and created_at > now() - interval '1 minute') >= 6 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select coalesce(lobby_language, 'is') into v_rlang from public.players where id = p_recipient;
  if not found or public.presence_of(p_recipient) = 'gone' then
    return jsonb_build_object('status', 'gone');
  end if;
  if v_rlang <> v_lang then
    return jsonb_build_object('status', 'other_lobby');
  end if;
  if public.player_in_live_match(p_recipient) then
    return jsonb_build_object('status', 'in_match');
  end if;
  if public.presence_of(p_recipient) = 'away' then
    return jsonb_build_object('status', 'away');
  end if;

  select max(responded_at) + interval '60 seconds' into v_until
    from public.match_invitations
   where sender_id = p_sender and recipient_id = p_recipient and status = 'declined' and not auto_declined;
  if v_until is not null and v_until > now() then
    return jsonb_build_object('status', 'declined_recently', 'until', v_until);
  end if;

  -- They had already challenged the sender: the send is the answer (§7.4, crossed).
  select id into v_reverse from public.match_invitations
   where sender_id = p_recipient and recipient_id = p_sender and status = 'pending' and expires_at > now()
   order by created_at desc limit 1;
  if v_reverse is not null then
    v_result := public.accept_invite(v_reverse, p_sender, 60, 'crossed_challenge');
    if v_result->>'status' = 'created' then
      return jsonb_build_object('status', 'crossed', 'match_id', v_result->>'match_id');
    end if;
  end if;

  -- One outgoing challenge, and a challenge ends a search (§7.5 invariants 1 and 3).
  with withdrawn as (
    update public.match_invitations
       set status = 'withdrawn', responded_at = now()
     where sender_id = p_sender and status = 'pending'
    returning recipient_id
  )
  select coalesce(array_agg(recipient_id), '{}') into v_withdrawn from withdrawn;
  update public.players
     set status = 'available', queue_language = null, queued_at = null, search_paused = false
   where id = p_sender and status = 'matchmaking';

  v_silenced := public.challenger_silenced(p_sender, p_recipient);
  insert into public.match_invitations (sender_id, recipient_id, status, language, expires_at, auto_declined, responded_at)
  values (p_sender, p_recipient, case when v_silenced then 'declined' else 'pending' end, v_lang,
          now() + interval '60 seconds', v_silenced, case when v_silenced then now() end)
  returning id into v_invite;

  return jsonb_build_object('status', 'sent', 'invite_id', v_invite, 'withdrawn_from', to_jsonb(v_withdrawn), 'silenced', v_silenced);
end;
$$;

create or replace function public.withdraw_challenge(p_sender uuid, p_invite uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
begin
  update public.match_invitations
     set status = 'withdrawn', responded_at = now()
   where id = p_invite and sender_id = p_sender and status = 'pending'
  returning recipient_id into v_recipient;
  if v_recipient is null then
    return jsonb_build_object('status', 'not_pending');
  end if;
  return jsonb_build_object('status', 'withdrawn', 'recipient_id', v_recipient);
end;
$$;

create or replace function public.expire_challenges()
returns table (invite_id uuid, sender_id uuid, recipient_id uuid)
language sql
security definer
set search_path = ''
as $$
  update public.match_invitations i
     set status = 'expired', responded_at = now()
   where i.status = 'pending' and i.expires_at < now()
  returning i.id, i.sender_id, i.recipient_id;
$$;

-- create_match_between, as spec 069 left it, plus clearing an unseen result.
create or replace function public.create_match_between(
  p_a uuid,
  p_b uuid,
  p_language text,
  p_origin text,
  p_ref uuid,
  p_pressed_by uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found integer;
  v_busy uuid;
  v_rematch_of uuid;
  v_match uuid;
  v_seat_a boolean;
  v_seat_b boolean;
begin
  if p_a is null or p_b is null or p_a = p_b then
    return jsonb_build_object('status', 'invalid', 'reason', 'players');
  end if;
  if p_language is null or p_language not in ('is', 'en') then
    return jsonb_build_object('status', 'invalid', 'reason', 'language');
  end if;
  if p_origin is null or p_origin not in ('queue', 'challenge', 'crossed_challenge', 'rematch', 'crossed_rematch', 'link') then
    return jsonb_build_object('status', 'invalid', 'reason', 'origin');
  end if;

  perform 1 from public.players where id in (p_a, p_b) order by id for update;
  select count(*) into v_found from public.players where id in (p_a, p_b);
  if v_found <> 2 then
    return jsonb_build_object('status', 'invalid', 'reason', 'unknown_player');
  end if;

  -- The one invariant: nobody holds two live matches.
  select p.id into v_busy
    from (values (p_a), (p_b)) as p(id)
   where exists (
     select 1 from public.matches m
      where m.state in ('pending', 'in_progress')
        and (m.player_a_id = p.id or m.player_b_id = p.id))
   order by p.id
   limit 1;
  if v_busy is not null then
    return jsonb_build_object('status', 'busy', 'player_id', v_busy);
  end if;

  if p_origin in ('rematch', 'crossed_rematch') then
    select match_id into v_rematch_of from public.rematch_requests where id = p_ref;
  end if;

  -- Seated by their own press, or by a visible tab in use (spec 069 §7.3).
  v_seat_a := p_a = any(coalesce(p_pressed_by, '{}')) or public.player_is_attentive(p_a);
  v_seat_b := p_b = any(coalesce(p_pressed_by, '{}')) or public.player_is_attentive(p_b);

  insert into public.matches (
    board_seed, player_a_id, player_b_id, language, state, origin, origin_ref, rematch_of,
    table_deadline_at, player_a_seated_at, player_b_seated_at)
  values (
    gen_random_uuid(), p_a, p_b, p_language, 'pending', p_origin, p_ref, v_rematch_of,
    now() + interval '20 seconds',
    case when v_seat_a then now() end,
    case when v_seat_b then now() end)
  returning id into v_match;

  -- queued_at is kept: a void requeues a seated searcher at their old place.
  update public.players
     set status = 'in_match', queue_language = null, search_paused = false, updated_at = now()
   where id in (p_a, p_b);
  update public.lobby_presence
     set mode = 'auto', invite_token = null, updated_at = now()
   where player_id in (p_a, p_b);
  -- Spec 070: a new match makes an old unseen result moot.
  update public.players set unseen_result_match_id = null where id in (p_a, p_b);

  update public.match_invitations
     set status = 'withdrawn', responded_at = now()
   where status = 'pending' and sender_id in (p_a, p_b) and id is distinct from p_ref;
  update public.match_invitations
     set status = 'superseded', responded_at = now()
   where status = 'pending' and recipient_id in (p_a, p_b) and id is distinct from p_ref;
  update public.rematch_requests
     set status = 'withdrawn', responded_at = now()
   where status = 'pending' and requester_id in (p_a, p_b) and id is distinct from p_ref;
  update public.rematch_requests
     set status = 'superseded', responded_at = now()
   where status = 'pending' and responder_id in (p_a, p_b) and id is distinct from p_ref;

  return jsonb_build_object(
    'status', 'created',
    'match_id', v_match,
    'seats', jsonb_build_object('a', v_seat_a, 'b', v_seat_b));
end;
$$;


-- accept_invite, as spec 069 left it, with its own expiry and the gone check.
create or replace function public.accept_invite(
  p_invite uuid,
  p_actor uuid,
  p_ttl_seconds integer,
  p_origin text default 'challenge'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_result jsonb;
  v_pressed uuid[];
begin
  select sender_id, recipient_id into v_invite from public.match_invitations where id = p_invite;
  if not found then
    return jsonb_build_object('status', 'not_pending');
  end if;
  if v_invite.recipient_id <> p_actor then
    return jsonb_build_object('status', 'not_recipient');
  end if;

  perform 1 from public.players where id in (v_invite.sender_id, v_invite.recipient_id) order by id for update;
  select * into v_invite from public.match_invitations where id = p_invite for update;
  if v_invite.status <> 'pending' then
    return jsonb_build_object('status', 'not_pending');
  end if;
  -- Spec 070: a challenge lasts until its own expires_at (60s).
  if v_invite.expires_at < now() then
    update public.match_invitations set status = 'expired', responded_at = now() where id = p_invite;
    return jsonb_build_object('status', 'expired');
  end if;
  -- A sender who has gone cannot be played (§7.5 invariant 5): the challenge ends as left.
  if public.presence_of(v_invite.sender_id) = 'gone' then
    update public.match_invitations set status = 'left', responded_at = now() where id = p_invite;
    return jsonb_build_object('status', 'gone');
  end if;

  v_pressed := case when p_origin = 'crossed_challenge'
                    then array[v_invite.sender_id, v_invite.recipient_id]
                    else array[p_actor] end;
  v_result := public.create_match_between(
    v_invite.sender_id, v_invite.recipient_id, coalesce(v_invite.language, 'is'), p_origin, p_invite, v_pressed);

  if v_result->>'status' = 'created' then
    update public.match_invitations
       set status = 'accepted', responded_at = now(), match_id = (v_result->>'match_id')::uuid
     where id = p_invite;
  elsif v_result->>'status' = 'busy' and (v_result->>'player_id')::uuid = v_invite.sender_id then
    update public.match_invitations set status = 'superseded', responded_at = now() where id = p_invite;
  end if;
  return v_result;
end;
$$;


revoke all on function public.presence_of(uuid) from public, anon, authenticated;
grant execute on function public.presence_of(uuid) to service_role;
revoke all on function public.send_challenge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.send_challenge(uuid, uuid) to service_role;
revoke all on function public.withdraw_challenge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.withdraw_challenge(uuid, uuid) to service_role;
revoke all on function public.expire_challenges() from public, anon, authenticated;
grant execute on function public.expire_challenges() to service_role;
revoke all on function public.player_in_live_match(uuid) from public, anon, authenticated;
revoke all on function public.challenger_silenced(uuid, uuid) from public, anon, authenticated;
