-- Spec 071: the result, rematch and review.
--
-- * presence_tabs.match_id: a tab on a match page names the match, so "both players are still
--   on this match" (the rematch offer, GAME_FLOW_SPEC §7.8) is one fresh-tab test. A hidden tab
--   counts (clarification Q2).
-- * rematch_requests.expires_at: a request lasts 30s. The database expires it (the sweep, and
--   lazily on read); the client only draws the drain.
-- * matches.ended_reason 'ended_early': an end-early claim settles like `incomplete` but says so.
-- * One locked function decides a rematch request (request_rematch): completed and rated, within
--   2:00 of the end, both players on the match, one request per match. A crossed press accepts.
-- * A declined or expired rematch starts the pair's 60s cooldown, shared with challenges
--   (pair_cooldown_until); it does not count toward the three-declines rule (clarification Q1).
-- * rematch_series: the chain of rematches in one query.

-- ─── Columns ─────────────────────────────────────────────────────────────────────────────

alter table public.presence_tabs
  add column if not exists match_id uuid null references public.matches(id) on delete set null;
create index if not exists presence_tabs_match_idx on public.presence_tabs (match_id) where match_id is not null;

alter table public.rematch_requests
  add column if not exists expires_at timestamptz not null default (now() + interval '30 seconds');
update public.rematch_requests set expires_at = created_at + interval '30 seconds';

alter table public.matches drop constraint if exists matches_ended_reason_check;
alter table public.matches
  add constraint matches_ended_reason_check
  check (
    ended_reason is null
    or ended_reason in ('moves_complete', 'incomplete', 'both_incomplete', 'ended_early', 'disconnect', 'forfeit', 'abandoned', 'error', 'void')
  );

-- ─── Presence on a match ─────────────────────────────────────────────────────────────────

-- A fresh tab whose page is this match, visible or hidden.
create or replace function public.player_on_match(p_player uuid, p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.presence_tabs t
     where t.player_id = p_player and t.match_id = p_match
       and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at)
  );
$$;

drop function if exists public.beat_tab(uuid, uuid, boolean, integer, text);
create or replace function public.beat_tab(
  p_player uuid,
  p_tab uuid,
  p_visible boolean,
  p_input_ago_ms integer,
  p_page text,
  p_match_id uuid default null
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
  v_match uuid := case when p_page = 'match' then p_match_id end;
  v_prev_visible boolean;
  v_had_fresh boolean;
begin
  select coalesce(p.lobby_language, 'is') into v_lang from public.players p where p.id = p_player;
  if not found then
    raise exception 'beat_tab: unknown player %', p_player;
  end if;
  if v_match is not null and not exists (select 1 from public.matches m where m.id = v_match) then
    v_match := null;
  end if;

  select exists (
    select 1 from public.presence_tabs t
     where t.player_id = p_player and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at)
  ) into v_had_fresh;
  select t.visible into v_prev_visible from public.presence_tabs t where t.tab_id = p_tab and t.player_id = p_player;

  insert into public.presence_tabs as t (tab_id, player_id, language, page, visible, hidden_since, last_input_at, cadence_ms, beat_at, leaving_at, match_id)
  values (p_tab, p_player, v_lang, p_page, p_visible, case when p_visible then null else now() end, v_input, v_cadence, now(), null, v_match)
  on conflict (tab_id) do update
     set language = excluded.language,
         page = excluded.page,
         visible = excluded.visible,
         hidden_since = case when excluded.visible then null else coalesce(t.hidden_since, now()) end,
         last_input_at = greatest(t.last_input_at, excluded.last_input_at),
         cadence_ms = excluded.cadence_ms,
         beat_at = now(),
         -- A closing tab's last beat is hidden and may land after its leave; only a visible beat (a reload) cancels it.
         leaving_at = case when excluded.visible then null else t.leaving_at end,
         match_id = excluded.match_id
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

-- ─── The pair cooldown ───────────────────────────────────────────────────────────────────

-- 60s after the sender's latest declined challenge to the recipient, or their latest declined or
-- unanswered rematch request to them; null once that has passed.
create or replace function public.pair_cooldown_until(p_sender uuid, p_recipient uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select max(t) + interval '60 seconds' as until from (
      select i.responded_at as t from public.match_invitations i
       where i.sender_id = p_sender and i.recipient_id = p_recipient
         and i.status = 'declined' and not i.auto_declined
      union all
      select r.responded_at from public.rematch_requests r
       where r.requester_id = p_sender and r.responder_id = p_recipient
         and r.status in ('declined', 'expired')
    ) s
  )
  select case when until > now() then until end from latest;
$$;

-- The cooldown now reads pair_cooldown_until; everything else is spec 070's send_challenge.
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

  -- Spec 071 (Q1): a declined or unanswered rematch holds the pair too.
  v_until := public.pair_cooldown_until(p_sender, p_recipient);
  if v_until is not null then
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


-- ─── Rematch ─────────────────────────────────────────────────────────────────────────────

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
  if p_origin <> 'crossed_rematch' and v_request.expires_at < now() then
    update public.rematch_requests set status = 'expired', responded_at = expires_at where id = p_request;
    return jsonb_build_object('status', 'expired');
  end if;
  select state, language, ended_reason into v_match from public.matches where id = v_request.match_id;
  if v_match.state is distinct from 'completed' or v_match.ended_reason in ('void', 'abandoned', 'error') then
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
  elsif v_result->>'status' = 'busy' then
    -- One of them is already at another table: the request ends as `started another match`.
    update public.rematch_requests set status = 'superseded', responded_at = now() where id = p_request;
  end if;
  return v_result;
end;
$$;

-- The one decision of a rematch request (spec 071 FR-010, FR-011). The match row is locked first,
-- so two presses at once serialize here and the second becomes the crossed accept (SC-003).
create or replace function public.request_rematch(p_match uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match record;
  v_opponent uuid;
  v_request record;
  v_result jsonb;
  v_id uuid;
  v_expires timestamptz;
begin
  select id, state, ended_reason, completed_at, player_a_id, player_b_id into v_match
    from public.matches where id = p_match for update;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'not_completed');
  end if;
  if p_actor not in (v_match.player_a_id, v_match.player_b_id) then
    return jsonb_build_object('status', 'refused', 'reason', 'not_participant');
  end if;
  if v_match.state <> 'completed' or v_match.ended_reason in ('void', 'abandoned', 'error') then
    return jsonb_build_object('status', 'refused', 'reason', 'not_completed');
  end if;
  v_opponent := case when p_actor = v_match.player_a_id then v_match.player_b_id else v_match.player_a_id end;
  perform 1 from public.players where id in (p_actor, v_opponent) order by id for update;

  select * into v_request from public.rematch_requests where match_id = p_match for update;
  if found then
    if v_request.status = 'pending' and v_request.expires_at < now() then
      update public.rematch_requests set status = 'expired', responded_at = expires_at where id = v_request.id;
      return jsonb_build_object('status', 'refused', 'reason', 'expired');
    end if;
    if v_request.status = 'pending' and v_request.responder_id = p_actor then
      v_result := public.accept_rematch(v_request.id, p_actor, 'crossed_rematch');
      if v_result->>'status' = 'created' then
        return jsonb_build_object('status', 'accepted', 'new_match_id', v_result->>'match_id');
      end if;
      return jsonb_build_object('status', 'refused', 'reason', 'busy');
    end if;
    return jsonb_build_object('status', 'refused', 'reason', 'already_requested');
  end if;

  if v_match.completed_at is null or now() > v_match.completed_at + interval '120 seconds' then
    return jsonb_build_object('status', 'refused', 'reason', 'window_closed');
  end if;
  if not public.player_on_match(p_actor, p_match) then
    return jsonb_build_object('status', 'refused', 'reason', 'self_left');
  end if;
  if not public.player_on_match(v_opponent, p_match) then
    return jsonb_build_object('status', 'refused', 'reason', 'opponent_left');
  end if;

  insert into public.rematch_requests (match_id, requester_id, responder_id, status, expires_at)
  values (p_match, p_actor, v_opponent, 'pending', now() + interval '30 seconds')
  returning id, expires_at into v_id, v_expires;
  return jsonb_build_object('status', 'sent', 'request_id', v_id, 'expires_at', v_expires);
end;
$$;

create or replace function public.decline_rematch(p_request uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
begin
  select * into v_request from public.rematch_requests where id = p_request for update;
  if not found or v_request.status <> 'pending' then
    return jsonb_build_object('status', 'refused', 'reason', 'not_pending');
  end if;
  if v_request.responder_id <> p_actor then
    return jsonb_build_object('status', 'refused', 'reason', 'not_responder');
  end if;
  if v_request.expires_at < now() then
    update public.rematch_requests set status = 'expired', responded_at = expires_at where id = p_request;
    return jsonb_build_object('status', 'expired');
  end if;
  update public.rematch_requests set status = 'declined', responded_at = now() where id = p_request;
  return jsonb_build_object('status', 'declined');
end;
$$;

-- The requester cancels (`withdrawn`); the responder leaves for a new opponent or the lobby
-- (`superseded`, read as `started another match`). Neither starts a cooldown.
create or replace function public.withdraw_rematch(p_request uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
  v_status text;
begin
  select * into v_request from public.rematch_requests where id = p_request for update;
  if not found or v_request.status <> 'pending' then
    return jsonb_build_object('status', 'refused', 'reason', 'not_pending');
  end if;
  v_status := case p_actor when v_request.requester_id then 'withdrawn'
                           when v_request.responder_id then 'superseded' end;
  if v_status is null then
    return jsonb_build_object('status', 'refused', 'reason', 'not_participant');
  end if;
  update public.rematch_requests set status = v_status, responded_at = now() where id = p_request;
  return jsonb_build_object('status', v_status);
end;
$$;

-- The sweep (30s cron) and every offer read: a request past its time is `expired` (the pair
-- cooldown starts from expires_at); one whose players are no longer on the match ends with no
-- cooldown. Returns the matches whose request changed, so both players can be poked.
create or replace function public.expire_due_rematches()
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  with due as (
    update public.rematch_requests
       set status = 'expired', responded_at = expires_at
     where status = 'pending' and expires_at <= now()
    returning match_id
  ), gone as (
    update public.rematch_requests r
       set status = case when public.player_on_match(r.responder_id, r.match_id) then 'withdrawn' else 'superseded' end,
           responded_at = now()
     where r.status = 'pending' and r.expires_at > now()
       and (not public.player_on_match(r.responder_id, r.match_id)
            or not public.player_on_match(r.requester_id, r.match_id))
    returning r.match_id
  )
  select match_id from due union select match_id from gone;
$$;

-- The rematch chain ending at p_match, oldest first; void tables are not matches and are skipped.
create or replace function public.rematch_series(p_match uuid)
returns table (match_id uuid, winner_id uuid, ordinal integer)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select m.id, m.rematch_of, m.winner_id, m.ended_reason, 0 as depth
      from public.matches m where m.id = p_match
    union all
    select p.id, p.rematch_of, p.winner_id, p.ended_reason, c.depth + 1
      from public.matches p join chain c on p.id = c.rematch_of
     where c.depth < 50
  )
  select c.id, c.winner_id, (row_number() over (order by c.depth desc))::integer
    from chain c
   where c.ended_reason is distinct from 'void'
   order by c.depth desc;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────────────────

revoke all on function public.player_on_match(uuid, uuid) from public, anon, authenticated;
grant execute on function public.player_on_match(uuid, uuid) to service_role;
revoke all on function public.beat_tab(uuid, uuid, boolean, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.beat_tab(uuid, uuid, boolean, integer, text, uuid) to service_role;
revoke all on function public.pair_cooldown_until(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pair_cooldown_until(uuid, uuid) to service_role;
revoke all on function public.send_challenge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.send_challenge(uuid, uuid) to service_role;
revoke all on function public.accept_rematch(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.accept_rematch(uuid, uuid, text, integer) to service_role;
revoke all on function public.request_rematch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_rematch(uuid, uuid) to service_role;
revoke all on function public.decline_rematch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.decline_rematch(uuid, uuid) to service_role;
revoke all on function public.withdraw_rematch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.withdraw_rematch(uuid, uuid) to service_role;
revoke all on function public.expire_due_rematches() from public, anon, authenticated;
grant execute on function public.expire_due_rematches() to service_role;
revoke all on function public.rematch_series(uuid) from public, anon, authenticated;
grant execute on function public.rematch_series(uuid) to service_role;
