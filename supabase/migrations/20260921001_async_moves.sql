-- Spec 050 (21 September 2026): ten moves each on one shared 5:00 clock.
--
-- There are no rounds any more. Each player makes ten moves whenever they
-- like; the server stamps every move with a gap-free receipt sequence under
-- the match row's lock (receive_move), a resolver claims the move at
-- resolved_seq + 1 (claim_next_move), scores it in Node, and finishes it
-- with a compare-and-set that advances resolved_seq by one (finish_move).
-- The sequence is the ordering authority; received_at is informational.
--
-- Hard cut, decided 2026-09-21 with no live users: every match row and its
-- dependants are removed and every rating reset, because results under the
-- round rules are not comparable with results under these.

-- 1. Remove every match and reset ratings.
truncate table public.matches cascade;
update public.players
   set elo_rating = 1200, games_played = 0, wins = 0, losses = 0, draws = 0;

-- 2. matches: the live board, the shared clock, the counters.
alter table public.matches
  add column if not exists board jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists deadline_at timestamptz,
  add column if not exists move_seq integer not null default 0,
  add column if not exists resolved_seq integer not null default 0,
  add column if not exists player_a_moves smallint not null default 0,
  add column if not exists player_b_moves smallint not null default 0,
  add column if not exists player_a_score integer not null default 0,
  add column if not exists player_b_score integer not null default 0,
  add column if not exists move_limit smallint not null default 10;

alter table public.matches
  drop column if exists player_a_timer_ms,
  drop column if exists player_b_timer_ms,
  drop column if exists current_round,
  drop column if exists round_limit,
  drop column if exists rated;

alter table public.matches
  add constraint matches_moves_within_limit
  check (player_a_moves between 0 and move_limit and player_b_moves between 0 and move_limit);

alter table public.matches drop constraint if exists matches_ended_reason_check;
alter table public.matches
  add constraint matches_ended_reason_check
  check (
    ended_reason is null
    or ended_reason in (
      'moves_complete',    -- both have ten: score, then exclusive frozen tiles, then draw
      'incomplete',        -- one player short of ten at the deadline: the other wins
      'both_incomplete',   -- both short: draw
      'disconnect',
      'forfeit',
      'abandoned',
      'error'
    )
  );

comment on column public.matches.board is 'The live board (spec 050): set when the match starts, rewritten by every resolved move.';
comment on column public.matches.started_at is 'When the shared clock starts. Set 3s ahead when both players have loaded the room (or 10s after creation) so the 3·2·1 is server-anchored.';
comment on column public.matches.deadline_at is 'started_at + the match clock. A move received after it is refused; one received before it is resolved and counted even if it completes after.';
comment on column public.matches.move_seq is 'Receipt counter: the last global_seq handed out. Gap-free, advanced under the row lock in receive_move.';
comment on column public.matches.resolved_seq is 'Resolution cursor: the last global_seq finished. The move at resolved_seq + 1 is the only one that can be claimed.';

-- 3. match_moves: one row per received move.
create table public.match_moves (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  global_seq integer not null,
  seq smallint check (seq between 1 and 10),
  from_x smallint not null check (from_x between 0 and 9),
  from_y smallint not null check (from_y between 0 and 9),
  to_x smallint not null check (to_x between 0 and 9),
  to_y smallint not null check (to_y between 0 and 9),
  from_letter text not null,
  to_letter text not null,
  received_at timestamptz not null default clock_timestamp(),
  claimed_at timestamptz,
  claim_count smallint not null default 0,
  resolved_at timestamptz,
  status text not null default 'pending' check (status in ('pending','resolving','resolved','rejected')),
  rejection_reason text check (rejection_reason is null or rejection_reason in ('frozen','moved')),
  board_before jsonb,
  board_after jsonb,
  frozen_before jsonb,
  frozen_after jsonb,
  delta integer,
  score_a_after integer,
  score_b_after integer,
  unique (match_id, global_seq)
);

create unique index match_moves_player_seq_idx
  on public.match_moves (match_id, player_id, seq)
  where seq is not null;

-- One move in flight per player (FR-004). The receive function checks this
-- too; the index is the backstop against two instances racing the check.
create unique index match_moves_one_in_flight_idx
  on public.match_moves (match_id, player_id)
  where status in ('pending', 'resolving');

create index match_moves_pending_idx
  on public.match_moves (match_id, global_seq)
  where status in ('pending', 'resolving');

alter table public.match_moves enable row level security;

create policy "match_moves_select_participants"
  on public.match_moves for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid())
    )
  );

comment on table public.match_moves is
  'Spec 050: every received move. global_seq is receipt order and the ordering authority; seq is the player''s Nth resolved move (null when rejected or unresolved). Writes go through receive_move / claim_next_move / finish_move only.';

-- 4. word_score_entries: per move, not per round; repeated words score.
alter table public.word_score_entries
  drop column if exists round_id,
  drop column if exists is_duplicate,
  add column move_id uuid not null references public.match_moves(id) on delete cascade;

create index word_score_entries_move_idx on public.word_score_entries (move_id);

-- 5. The round world.
drop table if exists public.move_submissions;
drop table if exists public.rounds;
drop table if exists public.scoreboard_snapshots;
drop function if exists public.update_frozen_tiles_if_unchanged(uuid, jsonb, jsonb);

-- 6. start_match_if_ready: the clock starts when both players have loaded
--    the room, or p_grace_ms after the match was created, whichever comes
--    first; started_at is p_countdown_ms ahead so both screens count the same
--    3·2·1. Records the caller's presence (a heartbeat row) and sets the board
--    once. Returns the match's clock fields; `started` is true on the call
--    that started it.
create or replace function public.start_match_if_ready(
  p_match_id uuid,
  p_caller_id uuid,
  p_board jsonb,
  p_clock_ms integer,
  p_countdown_ms integer,
  p_grace_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_present integer;
  v_started boolean := false;
  v_start timestamptz;
begin
  select id, state, player_a_id, player_b_id, created_at, board, started_at, deadline_at
    into m
    from public.matches
   where id = p_match_id
     for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  if p_caller_id = m.player_a_id or p_caller_id = m.player_b_id then
    insert into public.match_heartbeats (match_id, player_id, last_seen_at)
    values (p_match_id, p_caller_id, clock_timestamp())
    on conflict (match_id, player_id) do update set last_seen_at = excluded.last_seen_at;
  end if;
  if m.board is null then
    update public.matches set board = p_board where id = p_match_id;
  end if;
  if m.state = 'pending' then
    select count(*) into v_present
      from public.match_heartbeats
     where match_id = p_match_id
       and player_id in (m.player_a_id, m.player_b_id);
    if v_present >= 2 or clock_timestamp() >= m.created_at + make_interval(secs => p_grace_ms / 1000.0) then
      v_start := clock_timestamp() + make_interval(secs => p_countdown_ms / 1000.0);
      update public.matches
         set state = 'in_progress',
             started_at = v_start,
             deadline_at = v_start + make_interval(secs => p_clock_ms / 1000.0),
             updated_at = now()
       where id = p_match_id;
      v_started := true;
    end if;
  end if;
  select state, started_at, deadline_at into m from public.matches where id = p_match_id;
  return jsonb_build_object(
    'found', true,
    'started', v_started,
    'state', m.state,
    'startedAt', m.started_at,
    'deadlineAt', m.deadline_at,
    'serverNow', clock_timestamp()
  );
end;
$$;

revoke all on function public.start_match_if_ready(uuid, uuid, jsonb, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.start_match_if_ready(uuid, uuid, jsonb, integer, integer, integer) to service_role;

-- 7. receive_move: stamp a move under the match row's lock. Every refusal
--    returns without inserting; an accepted move gets the next global_seq.
create or replace function public.receive_move(
  p_match_id uuid,
  p_player_id uuid,
  p_from_x smallint,
  p_from_y smallint,
  p_to_x smallint,
  p_to_y smallint,
  p_from_letter text,
  p_to_letter text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_moves smallint;
  v_seq integer;
  v_id uuid;
  v_received timestamptz;
begin
  select id, state, player_a_id, player_b_id, started_at, deadline_at, move_limit, player_a_moves, player_b_moves
    into m
    from public.matches
   where id = p_match_id
     for update;
  if not found then
    return jsonb_build_object('status', 'rejected', 'reason', 'not_found');
  end if;
  if p_player_id <> m.player_a_id and p_player_id <> m.player_b_id then
    return jsonb_build_object('status', 'rejected', 'reason', 'not_participant');
  end if;
  if m.state <> 'in_progress' then
    return jsonb_build_object('status', 'rejected', 'reason', 'ended');
  end if;
  if m.started_at is null or clock_timestamp() < m.started_at then
    return jsonb_build_object('status', 'rejected', 'reason', 'not_started');
  end if;
  if clock_timestamp() > m.deadline_at then
    return jsonb_build_object('status', 'rejected', 'reason', 'deadline');
  end if;
  v_moves := case when p_player_id = m.player_a_id then m.player_a_moves else m.player_b_moves end;
  if v_moves >= m.move_limit then
    return jsonb_build_object('status', 'rejected', 'reason', 'cap');
  end if;
  perform 1 from public.match_moves
    where match_id = p_match_id and player_id = p_player_id and status in ('pending', 'resolving');
  if found then
    return jsonb_build_object('status', 'rejected', 'reason', 'in_flight');
  end if;

  update public.matches
     set move_seq = move_seq + 1, updated_at = now()
   where id = p_match_id
   returning move_seq into v_seq;
  v_received := clock_timestamp();
  insert into public.match_moves
    (match_id, player_id, global_seq, from_x, from_y, to_x, to_y, from_letter, to_letter, received_at, status)
  values
    (p_match_id, p_player_id, v_seq, p_from_x, p_from_y, p_to_x, p_to_y, p_from_letter, p_to_letter, v_received, 'pending')
  returning id into v_id;
  return jsonb_build_object('status', 'accepted', 'moveId', v_id, 'globalSeq', v_seq, 'receivedAt', v_received);
end;
$$;

revoke all on function public.receive_move(uuid, uuid, smallint, smallint, smallint, smallint, text, text) from public, anon, authenticated;
grant execute on function public.receive_move(uuid, uuid, smallint, smallint, smallint, smallint, text, text) to service_role;

-- 8. claim_next_move: the move at resolved_seq + 1, pending or stale, becomes
--    `resolving` for this caller. Returns null when there is nothing to claim.
--    The UPDATE's WHERE is re-evaluated under the row lock, so two callers
--    cannot both claim: the second sees a fresh claimed_at and gets nothing.
create or replace function public.claim_next_move(p_match_id uuid, p_stale_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_move public.match_moves;
  m record;
begin
  update public.match_moves mv
     set status = 'resolving',
         claimed_at = clock_timestamp(),
         claim_count = mv.claim_count + 1
   where mv.match_id = p_match_id
     and mv.global_seq = (select x.resolved_seq + 1 from public.matches x where x.id = p_match_id and x.state = 'in_progress')
     and (
       mv.status = 'pending'
       or (mv.status = 'resolving' and mv.claimed_at < clock_timestamp() - make_interval(secs => p_stale_ms / 1000.0))
     )
   returning mv.* into v_move;
  if not found then
    return null;
  end if;
  select board, frozen_tiles, player_a_id, player_b_id, player_a_score, player_b_score,
         player_a_moves, player_b_moves, move_limit, resolved_seq
    into m
    from public.matches
   where id = p_match_id;
  return jsonb_build_object('move', to_jsonb(v_move), 'match', to_jsonb(m));
end;
$$;

revoke all on function public.claim_next_move(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_next_move(uuid, integer) to service_role;

-- 9. finish_move: one transaction that advances resolved_seq by exactly one
--    (compare-and-set on the value the claimer read), writes the board, the
--    freeze map, the mover's total and count, the move row and its words.
--    Returns {written: 0} when someone else finished first or the match is no
--    longer in progress; nothing is written in that case.
create or replace function public.finish_move(
  p_move_id uuid,
  p_expected_resolved_seq integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_move public.match_moves;
  v_is_a boolean;
  v_resolved boolean;
  v_delta integer;
  v_moves_a smallint;
  v_moves_b smallint;
  v_score_a integer;
  v_score_b integer;
  v_limit smallint;
begin
  select * into v_move from public.match_moves where id = p_move_id;
  if not found then
    return jsonb_build_object('written', 0);
  end if;
  v_resolved := (p_payload->>'status') = 'resolved';
  v_delta := coalesce((p_payload->>'delta')::integer, 0);
  select (player_a_id = v_move.player_id) into v_is_a from public.matches where id = v_move.match_id;

  update public.matches
     set resolved_seq = resolved_seq + 1,
         board = case when v_resolved then p_payload->'boardAfter' else board end,
         frozen_tiles = case when v_resolved then p_payload->'frozenAfter' else frozen_tiles end,
         player_a_score = player_a_score + case when v_resolved and v_is_a then v_delta else 0 end,
         player_b_score = player_b_score + case when v_resolved and not v_is_a then v_delta else 0 end,
         player_a_moves = player_a_moves + case when v_resolved and v_is_a then 1 else 0 end,
         player_b_moves = player_b_moves + case when v_resolved and not v_is_a then 1 else 0 end,
         updated_at = now()
   where id = v_move.match_id
     and resolved_seq = p_expected_resolved_seq
     and state = 'in_progress'
   returning player_a_moves, player_b_moves, player_a_score, player_b_score, move_limit
        into v_moves_a, v_moves_b, v_score_a, v_score_b, v_limit;
  if not found then
    return jsonb_build_object('written', 0);
  end if;

  update public.match_moves
     set status = case when v_resolved then 'resolved' else 'rejected' end,
         rejection_reason = case when v_resolved then null else p_payload->>'rejectionReason' end,
         seq = case when v_resolved then (case when v_is_a then v_moves_a else v_moves_b end) else null end,
         resolved_at = clock_timestamp(),
         board_before = p_payload->'boardBefore',
         board_after = case when v_resolved then p_payload->'boardAfter' else p_payload->'boardBefore' end,
         frozen_before = p_payload->'frozenBefore',
         frozen_after = case when v_resolved then p_payload->'frozenAfter' else p_payload->'frozenBefore' end,
         delta = case when v_resolved then v_delta else 0 end,
         score_a_after = v_score_a,
         score_b_after = v_score_b
   where id = p_move_id;

  if v_resolved then
    insert into public.word_score_entries
      (match_id, move_id, player_id, word, length, letters_points, bonus_points, total_points, tiles)
    select v_move.match_id, p_move_id, v_move.player_id,
           w->>'word', (w->>'length')::smallint, (w->>'lettersPoints')::smallint,
           (w->>'bonusPoints')::smallint, (w->>'totalPoints')::smallint, w->'tiles'
      from jsonb_array_elements(coalesce(p_payload->'words', '[]'::jsonb)) as w;
  end if;

  return jsonb_build_object(
    'written', 1,
    'playerAMoves', v_moves_a,
    'playerBMoves', v_moves_b,
    'playerAScore', v_score_a,
    'playerBScore', v_score_b,
    'bothDone', v_moves_a >= v_limit and v_moves_b >= v_limit
  );
end;
$$;

revoke all on function public.finish_move(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.finish_move(uuid, integer, jsonb) to service_role;

-- 10. find_due_matches: in progress and past the deadline (2s of slack so a
--     last-second move's own settlement usually wins). Consumed by the cron
--     sweep beside find_orphaned_matches.
create or replace function public.find_due_matches()
returns setof uuid
language sql
stable
as $$
  select m.id
    from public.matches m
   where m.state = 'in_progress'
     and m.deadline_at is not null
     and m.deadline_at < now() - interval '2 seconds';
$$;

comment on function public.find_due_matches() is
  'Spec 050: matches whose shared clock has run out and that are still in progress. Consumed by /api/cron/sweep-stale-matches.';
