-- Spec 067: one way to make a match (S2).
--
-- create_match_between is the only writer of new matches. The three callers add
-- their own precondition and nothing else: accept_invite (a challenge, or crossed
-- challenges), accept_rematch (a rematch, or crossed rematches) and
-- pair_from_queue (two searchers).
--
-- Lock order, everywhere: both players' rows in ascending id, then the invite or
-- rematch request. create_match_between touches other invites and requests only
-- while holding the player locks, so no two calls can wait on each other.

create or replace function public.create_match_between(
  p_a uuid,
  p_b uuid,
  p_language text,
  p_origin text,
  p_ref uuid
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

  insert into public.matches (board_seed, player_a_id, player_b_id, language, state, origin, origin_ref, rematch_of)
  values (gen_random_uuid(), p_a, p_b, p_language, 'pending', p_origin, p_ref, v_rematch_of)
  returning id into v_match;

  update public.players
     set status = 'in_match', queue_language = null, updated_at = now()
   where id in (p_a, p_b);
  update public.lobby_presence
     set mode = 'auto', invite_token = null, updated_at = now()
   where player_id in (p_a, p_b);

  -- Every other commitment either player had is over. The cause itself is left
  -- to its caller, which marks it accepted.
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

  return jsonb_build_object('status', 'created', 'match_id', v_match);
end;
$$;

revoke all on function public.create_match_between(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_match_between(uuid, uuid, text, text, uuid) to service_role;

-- A challenge is accepted by its recipient, once, while it is pending and in
-- time. The compare-and-set is the status check under the invite's row lock;
-- the invite is marked accepted only when the match was created, so a refusal
-- leaves it pending (or superseded, when its sender can never play it).
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

  v_result := public.create_match_between(
    v_invite.sender_id, v_invite.recipient_id, coalesce(v_invite.language, 'is'), p_origin, p_invite);

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

revoke all on function public.accept_invite(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.accept_invite(uuid, uuid, integer, text) to service_role;

-- A rematch request is accepted by its responder while pending, in time and
-- after the match it follows is over. Crossed requests (both asked) skip the
-- clock: the second request is the answer to the first.
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
  select state, language into v_match from public.matches where id = v_request.match_id;
  if v_match.state is distinct from 'completed' then
    return jsonb_build_object('status', 'not_completed');
  end if;

  v_result := public.create_match_between(
    v_request.requester_id, v_request.responder_id, v_match.language, p_origin, p_request);

  if v_result->>'status' = 'created' then
    update public.rematch_requests
       set status = 'accepted', responded_at = now(), new_match_id = (v_result->>'match_id')::uuid
     where id = p_request;
  end if;
  return v_result;
end;
$$;

revoke all on function public.accept_rematch(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.accept_rematch(uuid, uuid, text, integer) to service_role;

-- Two players still searching in one language become a match.
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
         and queue_language = p_language) <> 2 then
    return jsonb_build_object('status', 'not_searching');
  end if;
  return public.create_match_between(p_self, p_opponent, p_language, 'queue', null);
end;
$$;

revoke all on function public.pair_from_queue(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.pair_from_queue(uuid, uuid, text) to service_role;
