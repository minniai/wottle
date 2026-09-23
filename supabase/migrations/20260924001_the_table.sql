-- Spec 069: the table. Nobody is rated for a match they did not sit down at.
--
-- Every match begins pending, at a table. The server holds the board until
-- both players are seated; the seat that completes the table writes the board
-- and sets started_at 4.5s ahead, under the match row lock. A table that does
-- not fill within 20s, or that a player leaves before go, is void: completed
-- with ended_reason 'void', no winner, no rating. The queue pairs in queued_at
-- order among players heard from within 10s and not paused.
--
-- Lock order, as in spec 067: players (ascending id) before the match, in every
-- function here. seat_player updates the match row twice in one transaction,
-- and the second update re-checks the player foreign keys (a share lock on both
-- players), so taking the match first would deadlock against void_table.

-- ─── Columns ────────────────────────────────────────────────────────────

alter table public.matches
  add column if not exists player_a_seated_at timestamptz,
  add column if not exists player_b_seated_at timestamptz,
  add column if not exists table_deadline_at timestamptz,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references public.players(id) on delete set null;

comment on column public.matches.table_deadline_at is
  'Spec 069: the time to sit down (created_at + 20s). Past it, a table without both seats is void.';

alter table public.players
  add column if not exists queued_at timestamptz,
  add column if not exists search_paused boolean not null default false,
  add column if not exists attention_visible boolean,
  add column if not exists attention_input_at timestamptz,
  add column if not exists attention_at timestamptz,
  add column if not exists table_missed_at timestamptz;

comment on column public.players.queued_at is
  'Spec 069: when the current search began. Polls never rewrite it; a requeue after a void keeps it.';
comment on column public.players.attention_at is
  'Spec 069: when the player''s tab last reported its visibility (attention_visible) and last input (attention_input_at).';

alter table public.matches drop constraint if exists matches_ended_reason_check;
alter table public.matches
  add constraint matches_ended_reason_check
  check (
    ended_reason is null
    or ended_reason in ('moves_complete', 'incomplete', 'both_incomplete', 'disconnect', 'forfeit', 'abandoned', 'error', 'void')
  );

alter table public.matches drop constraint if exists matches_void_reason_check;
alter table public.matches
  add constraint matches_void_reason_check
  check (
    (ended_reason = 'void' and void_reason in ('not_seated', 'left'))
    or (ended_reason is distinct from 'void' and void_reason is null)
  );

-- Every match that started was sat at. Rows from before the table count as seated
-- when they started, so later writes to a live match still pass the check.
update public.matches
   set player_a_seated_at = coalesce(player_a_seated_at, started_at, created_at),
       player_b_seated_at = coalesce(player_b_seated_at, started_at, created_at)
 where state <> 'pending';

update public.matches
   set table_deadline_at = created_at + interval '20 seconds'
 where state = 'pending' and table_deadline_at is null;

alter table public.matches drop constraint if exists matches_started_only_seated;
alter table public.matches
  add constraint matches_started_only_seated
  check (state <> 'in_progress' or (player_a_seated_at is not null and player_b_seated_at is not null and started_at is not null));

create index if not exists matches_due_tables_idx on public.matches (table_deadline_at) where state = 'pending';
create index if not exists players_queue_order_idx on public.players (queue_language, queued_at) where status = 'matchmaking';

-- ─── The start retires ──────────────────────────────────────────────────

drop function if exists public.start_match_if_ready(uuid, uuid, jsonb, integer, integer, integer);

-- ─── create_match_between: the table ────────────────────────────────────

-- A player counts as present at creation when their tab reported, within 10s,
-- that it is visible and had input within 30s (spec 069 FR-002, research R5).
create or replace function public.player_is_attentive(p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.attention_visible
            and p.attention_at > now() - interval '10 seconds'
            and p.attention_input_at > now() - interval '30 seconds'
       from public.players p where p.id = p_player),
    false);
$$;

revoke all on function public.player_is_attentive(uuid) from public, anon, authenticated;
grant execute on function public.player_is_attentive(uuid) to service_role;

drop function if exists public.create_match_between(uuid, uuid, text, text, uuid);

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

revoke all on function public.create_match_between(uuid, uuid, text, text, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_match_between(uuid, uuid, text, text, uuid, uuid[]) to service_role;

-- The accepter's press seats them; crossed presses seat both.
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
  if v_invite.created_at + make_interval(secs => p_ttl_seconds) < now() then
    update public.match_invitations set status = 'expired', responded_at = now() where id = p_invite;
    return jsonb_build_object('status', 'expired');
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

create or replace function public.accept_rematch(
  p_request uuid,
  p_actor uuid,
  p_origin text default 'rematch',
  p_ttl_seconds integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
  v_match record;
  v_result jsonb;
  v_pressed uuid[];
begin
  select requester_id, responder_id into v_request from public.rematch_requests where id = p_request;
  if not found then
    return jsonb_build_object('status', 'not_pending');
  end if;
  if v_request.responder_id <> p_actor then
    return jsonb_build_object('status', 'not_recipient');
  end if;

  perform 1 from public.players where id in (v_request.requester_id, v_request.responder_id) order by id for update;
  select * into v_request from public.rematch_requests where id = p_request for update;
  if v_request.status <> 'pending' then
    return jsonb_build_object('status', 'not_pending');
  end if;
  if p_origin <> 'crossed_rematch' and v_request.created_at + make_interval(secs => p_ttl_seconds) < now() then
    update public.rematch_requests set status = 'expired', responded_at = now() where id = p_request;
    return jsonb_build_object('status', 'expired');
  end if;
  select state, language, ended_reason into v_match from public.matches where id = v_request.match_id;
  if v_match.state is distinct from 'completed' or v_match.ended_reason = 'void' then
    return jsonb_build_object('status', 'not_completed');
  end if;

  v_pressed := case when p_origin = 'crossed_rematch'
                    then array[v_request.requester_id, v_request.responder_id]
                    else array[p_actor] end;
  v_result := public.create_match_between(
    v_request.requester_id, v_request.responder_id, v_match.language, p_origin, p_request, v_pressed);

  if v_result->>'status' = 'created' then
    update public.rematch_requests
       set status = 'accepted', responded_at = now(), new_match_id = (v_result->>'match_id')::uuid
     where id = p_request;
  end if;
  return v_result;
end;
$$;

-- Two players still searching in one language, both heard from within 10s and
-- neither paused, become a match (spec 069 FR-020, FR-021).
create or replace function public.pair_from_queue(
  p_self uuid,
  p_opponent uuid,
  p_language text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_self is null or p_opponent is null or p_self = p_opponent then
    return jsonb_build_object('status', 'invalid', 'reason', 'players');
  end if;
  perform 1 from public.players where id in (p_self, p_opponent) order by id for update;
  if (select count(*) from public.players
       where id in (p_self, p_opponent)
         and status = 'matchmaking'
         and queue_language = p_language
         and not search_paused
         and last_seen_at > now() - interval '10 seconds') <> 2 then
    return jsonb_build_object('status', 'not_searching');
  end if;
  return public.create_match_between(p_self, p_opponent, p_language, 'queue', null, '{}');
end;
$$;

-- ─── Seating and the start ──────────────────────────────────────────────

-- The completion step, with the match row already locked by the caller: the
-- board, the start 4.5s ahead, the deadline. Not granted to anyone.
create or replace function public.table_start_locked(
  p_match uuid,
  p_board jsonb,
  p_lead_ms integer,
  p_clock_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := clock_timestamp() + make_interval(secs => p_lead_ms / 1000.0);
begin
  update public.matches
     set board = p_board,
         state = 'in_progress',
         started_at = v_start,
         deadline_at = v_start + make_interval(secs => p_clock_ms / 1000.0),
         updated_at = now()
   where id = p_match;
  return jsonb_build_object(
    'status', 'started',
    'startedAt', v_start,
    'deadlineAt', v_start + make_interval(secs => p_clock_ms / 1000.0),
    'serverNow', clock_timestamp());
end;
$$;

revoke all on function public.table_start_locked(uuid, jsonb, integer, integer) from public, anon, authenticated;

create or replace function public.table_started(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('status', 'started', 'startedAt', started_at, 'deadlineAt', deadline_at, 'serverNow', clock_timestamp())
    from public.matches where id = p_match;
$$;

revoke all on function public.table_started(uuid) from public, anon, authenticated;

create or replace function public.seat_player(
  p_match uuid,
  p_player uuid,
  p_board jsonb,
  p_lead_ms integer,
  p_clock_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  -- Players before the match, as everywhere (spec 067): the second update of the
  -- row in this transaction re-checks its player keys, which takes a share lock
  -- on both players; holding the match first would deadlock against a leave.
  select player_a_id, player_b_id into m from public.matches where id = p_match;
  if not found or p_player not in (m.player_a_id, m.player_b_id) then
    return jsonb_build_object('status', 'not_found');
  end if;
  perform 1 from public.players where id in (m.player_a_id, m.player_b_id) order by id for update;
  select * into m from public.matches where id = p_match for update;
  if m.state = 'completed' then
    return jsonb_build_object('status', case when m.ended_reason = 'void' then 'void' else 'ended' end);
  end if;
  if m.state = 'in_progress' then
    return public.table_started(p_match);
  end if;
  if m.table_deadline_at is not null and clock_timestamp() >= m.table_deadline_at then
    return jsonb_build_object('status', 'late');
  end if;

  if p_player = m.player_a_id and m.player_a_seated_at is null then
    update public.matches set player_a_seated_at = now(), updated_at = now() where id = p_match;
    m.player_a_seated_at := now();
  elsif p_player = m.player_b_id and m.player_b_seated_at is null then
    update public.matches set player_b_seated_at = now(), updated_at = now() where id = p_match;
    m.player_b_seated_at := now();
  end if;

  if m.player_a_seated_at is not null and m.player_b_seated_at is not null then
    return public.table_start_locked(p_match, p_board, p_lead_ms, p_clock_ms);
  end if;
  return jsonb_build_object('status', 'seated');
end;
$$;

revoke all on function public.seat_player(uuid, uuid, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.seat_player(uuid, uuid, jsonb, integer, integer) to service_role;

-- A table that was full at creation (both pressed, or both present) starts here.
create or replace function public.start_table_if_seated(
  p_match uuid,
  p_board jsonb,
  p_lead_ms integer,
  p_clock_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  select player_a_id, player_b_id into m from public.matches where id = p_match;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  perform 1 from public.players where id in (m.player_a_id, m.player_b_id) order by id for update;
  select * into m from public.matches where id = p_match for update;
  if m.state = 'in_progress' then
    return public.table_started(p_match);
  end if;
  if m.state <> 'pending' then
    return jsonb_build_object('status', case when m.ended_reason = 'void' then 'void' else 'ended' end);
  end if;
  if m.player_a_seated_at is null or m.player_b_seated_at is null then
    return jsonb_build_object('status', 'waiting');
  end if;
  return public.table_start_locked(p_match, p_board, p_lead_ms, p_clock_ms);
end;
$$;

revoke all on function public.start_table_if_seated(uuid, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.start_table_if_seated(uuid, jsonb, integer, integer) to service_role;

-- ─── The void ───────────────────────────────────────────────────────────

-- Where each player goes when a table voids (spec 069 FR-017, contract).
create or replace function public.table_release_player(
  p_player uuid,
  p_seated boolean,
  p_missed boolean,
  p_leaver boolean,
  p_origin text,
  p_language text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_missed then
    update public.players
       set status = 'available', queued_at = null, queue_language = null, search_paused = false,
           table_missed_at = now(), updated_at = now()
     where id = p_player;
  elsif p_leaver then
    update public.players
       set status = 'available', queued_at = null, queue_language = null, search_paused = false, updated_at = now()
     where id = p_player;
  elsif p_origin = 'queue' and p_seated then
    update public.players
       set status = 'matchmaking', queue_language = p_language, search_paused = false,
           queued_at = coalesce(queued_at, now()), last_seen_at = now(), updated_at = now()
     where id = p_player;
  else
    update public.players set status = 'available', updated_at = now() where id = p_player;
  end if;
end;
$$;

revoke all on function public.table_release_player(uuid, boolean, boolean, boolean, text, text) from public, anon, authenticated;

create or replace function public.void_table(
  p_match uuid,
  p_reason text,
  p_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_by uuid;
  v_a_seated boolean;
  v_b_seated boolean;
begin
  if p_reason is null or p_reason not in ('not_seated', 'left') then
    return jsonb_build_object('status', 'invalid');
  end if;
  select player_a_id, player_b_id into m from public.matches where id = p_match;
  if not found then
    return jsonb_build_object('status', 'not_pending');
  end if;
  perform 1 from public.players where id in (m.player_a_id, m.player_b_id) order by id for update;
  select * into m from public.matches where id = p_match for update;

  -- Pending, or started but before go (a leave during the count).
  if not (m.state = 'pending' or (m.state = 'in_progress' and p_reason = 'left' and clock_timestamp() < m.started_at)) then
    return jsonb_build_object('status', 'not_pending');
  end if;
  v_a_seated := m.player_a_seated_at is not null;
  v_b_seated := m.player_b_seated_at is not null;

  if p_reason = 'not_seated' then
    if m.state <> 'pending' or clock_timestamp() < m.table_deadline_at or (v_a_seated and v_b_seated) then
      return jsonb_build_object('status', 'not_due');
    end if;
    v_by := case when v_a_seated and not v_b_seated then m.player_b_id
                 when v_b_seated and not v_a_seated then m.player_a_id end;
  else
    if p_by is null or p_by not in (m.player_a_id, m.player_b_id) then
      return jsonb_build_object('status', 'not_pending');
    end if;
    v_by := p_by;
  end if;

  update public.matches
     set state = 'completed', ended_reason = 'void', void_reason = p_reason, voided_by = v_by,
         winner_id = null, completed_at = now(), updated_at = now()
   where id = p_match;

  perform public.table_release_player(
    m.player_a_id, v_a_seated, p_reason = 'not_seated' and not v_a_seated, p_reason = 'left' and v_by = m.player_a_id, m.origin, m.language);
  perform public.table_release_player(
    m.player_b_id, v_b_seated, p_reason = 'not_seated' and not v_b_seated, p_reason = 'left' and v_by = m.player_b_id, m.origin, m.language);

  return jsonb_build_object('status', 'void', 'reason', p_reason, 'voidedBy', v_by);
end;
$$;

revoke all on function public.void_table(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.void_table(uuid, text, uuid) to service_role;

create or replace function public.find_due_tables()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
    from public.matches m
   where m.state = 'pending'
     and m.table_deadline_at is not null
     and m.table_deadline_at <= now();
$$;

comment on function public.find_due_tables() is
  'Spec 069: pending tables whose time to sit down has run out. Consumed by /api/cron/sweep-stale-matches.';
revoke all on function public.find_due_tables() from public, anon, authenticated;
grant execute on function public.find_due_tables() to service_role;

-- ─── The table-leave cooldown (S12) ─────────────────────────────────────

-- Two `left` voids within 10 minutes: no searching or sending challenges for
-- 5 minutes after the second. Null when there is no cooldown.
create or replace function public.table_leave_cooldown_until(p_player uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  with lefts as (
    select completed_at, row_number() over (order by completed_at desc) as n
      from public.matches
     where ended_reason = 'void' and void_reason = 'left' and voided_by = p_player
       and completed_at > now() - interval '15 minutes'
  ),
  pair as (
    select (select completed_at from lefts where n = 1) as latest,
           (select completed_at from lefts where n = 2) as previous
  )
  select case
           when previous is not null
            and latest - previous <= interval '10 minutes'
            and latest + interval '5 minutes' > now()
           then latest + interval '5 minutes'
         end
    from pair;
$$;

revoke all on function public.table_leave_cooldown_until(uuid) from public, anon, authenticated;
grant execute on function public.table_leave_cooldown_until(uuid) to service_role;
