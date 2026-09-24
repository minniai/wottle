-- Spec 072: invite links and profiles.
--
-- A link is a single-use invitation with no recipient until it is used. Only
-- sha256(token) is stored; the token lives in the sender's clipboard. Opening a
-- link reads it (read_link, stable); only the explicit accept (accept_link)
-- writes, by compare-and-set under row locks, through create_match_between.
-- A link is the sender's one outgoing challenge: every path that withdraws a
-- challenge withdraws it too. Profiles read best_words and presence_word.

-- ─── The table ─────────────────────────────────────────────────────────

create table if not exists public.match_links (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null,
  sender_id uuid not null references public.players(id) on delete cascade,
  language text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  used_by uuid references public.players(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  constraint match_links_token_hash_key unique (token_hash),
  constraint match_links_language_check check (language in ('is', 'en')),
  constraint match_links_status_check check (status in ('pending', 'used', 'cancelled', 'expired', 'withdrawn', 'superseded'))
);

comment on table public.match_links is
  'Spec 072: invite links. token_hash = sha256(token); the token is never stored. At most one pending link per sender; it counts as their outgoing challenge.';

create index if not exists match_links_sender_created_idx on public.match_links (sender_id, created_at desc);
create index if not exists match_links_pending_expiry_idx on public.match_links (expires_at) where status = 'pending';
create unique index if not exists match_links_one_pending_per_sender on public.match_links (sender_id) where status = 'pending';

alter table public.match_links enable row level security;

-- ─── Links ─────────────────────────────────────────────────────────────

-- The sender's pending link ends, by whatever withdrew it. Returns nothing.
create or replace function public.withdraw_links_of(p_player uuid, p_except uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.match_links
     set status = 'withdrawn', responded_at = now()
   where sender_id = p_player and status = 'pending' and id is distinct from p_except;
$$;

revoke all on function public.withdraw_links_of(uuid, uuid) from public, anon, authenticated;

create or replace function public.create_link(p_sender uuid, p_token_hash bytea, p_ttl_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lang text;
  v_until timestamptz;
  v_withdrawn uuid[];
  v_link uuid;
  v_expires timestamptz;
begin
  if p_sender is null or p_token_hash is null or coalesce(p_ttl_seconds, 0) <= 0 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select coalesce(lobby_language, 'is') into v_lang from public.players where id = p_sender for update;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if public.player_in_live_match(p_sender) then
    return jsonb_build_object('status', 'busy_sender');
  end if;
  v_until := public.table_leave_cooldown_until(p_sender);
  if v_until is not null and v_until > now() then
    return jsonb_build_object('status', 'cooldown', 'until', v_until);
  end if;
  if (select count(*) from public.match_invitations where sender_id = p_sender and created_at > now() - interval '1 minute')
   + (select count(*) from public.match_links where sender_id = p_sender and created_at > now() - interval '1 minute') >= 6 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- One outgoing challenge, and a link ends a search (§7.5 invariants 1 and 3).
  with withdrawn as (
    update public.match_invitations
       set status = 'withdrawn', responded_at = now()
     where sender_id = p_sender and status = 'pending'
    returning recipient_id
  )
  select coalesce(array_agg(recipient_id), '{}') into v_withdrawn from withdrawn;
  perform public.withdraw_links_of(p_sender);
  update public.players
     set status = 'available', queue_language = null, queued_at = null, search_paused = false
   where id = p_sender and status = 'matchmaking';

  v_expires := now() + make_interval(secs => p_ttl_seconds);
  insert into public.match_links (token_hash, sender_id, language, expires_at)
  values (p_token_hash, p_sender, v_lang, v_expires)
  returning id into v_link;

  return jsonb_build_object('status', 'created', 'link_id', v_link, 'expires_at', v_expires, 'language', v_lang,
                            'withdrawn_from', to_jsonb(v_withdrawn));
end;
$$;

-- Reads a link; writes nothing, so a preview, a prefetch or a crawler is harmless.
create or replace function public.read_link(p_token_hash bytea)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
              'found', true,
              'valid', l.status = 'pending' and l.expires_at > now(),
              'link_id', l.id,
              'sender_id', l.sender_id,
              'sender_name', p.display_name,
              'sender_handle', p.username,
              'sender_rating', coalesce(r.elo_rating, 1200),
              'language', l.language,
              'expires_at', l.expires_at)
       from public.match_links l
       join public.players p on p.id = l.sender_id
       left join public.player_ratings r on r.player_id = l.sender_id and r.language = l.language
      where l.token_hash = p_token_hash),
    jsonb_build_object('found', false, 'valid', false));
$$;

create or replace function public.accept_link(p_token_hash bytea, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link record;
  v_result jsonb;
begin
  select id, sender_id into v_link from public.match_links where token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_link.sender_id = p_actor then
    return jsonb_build_object('status', 'own');
  end if;

  -- Players before the link (spec 067's lock order), then the link: a second
  -- accept waits here and then finds it used.
  perform 1 from public.players where id in (v_link.sender_id, p_actor) order by id for update;
  select * into v_link from public.match_links where token_hash = p_token_hash for update;
  if v_link.status <> 'pending' then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_link.expires_at <= now() then
    update public.match_links set status = 'expired', responded_at = now() where id = v_link.id;
    return jsonb_build_object('status', 'expired');
  end if;

  v_result := public.create_match_between(
    v_link.sender_id, p_actor, v_link.language, 'link', v_link.id, array[p_actor]);

  if v_result->>'status' = 'created' then
    update public.match_links
       set status = 'used', responded_at = now(), used_by = p_actor, match_id = (v_result->>'match_id')::uuid
     where id = v_link.id;
    -- A link table waits for its sender until the link would have expired (§3 timings).
    update public.matches set table_deadline_at = v_link.expires_at
     where id = (v_result->>'match_id')::uuid;
    return v_result || jsonb_build_object('sender_id', v_link.sender_id, 'link_id', v_link.id);
  end if;
  if v_result->>'status' = 'busy' and (v_result->>'player_id')::uuid = v_link.sender_id then
    update public.match_links set status = 'superseded', responded_at = now() where id = v_link.id;
    return jsonb_build_object('status', 'expired');
  end if;
  return v_result;
end;
$$;

create or replace function public.cancel_link(p_sender uuid, p_link uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.match_links
     set status = 'cancelled', responded_at = now()
   where id = p_link and sender_id = p_sender and status = 'pending';
  if not found then
    return jsonb_build_object('status', 'not_pending');
  end if;
  return jsonb_build_object('status', 'cancelled');
end;
$$;

create or replace function public.expire_links()
returns table (link_id uuid, sender_id uuid)
language sql
security definer
set search_path = ''
as $$
  update public.match_links l
     set status = 'expired', responded_at = now()
   where l.status = 'pending' and l.expires_at <= now()
  returning l.id, l.sender_id;
$$;

-- ─── Profiles ──────────────────────────────────────────────────────────

-- The player's best distinct words in one language, each at its best score;
-- a tie goes to the earlier match. Only played, completed matches count.
create or replace function public.best_words(p_player uuid, p_language text, p_limit integer)
returns table (word text, points integer, tiles jsonb, match_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select b.word, b.points, b.tiles, b.match_id
    from (
      select distinct on (upper(w.word))
             w.word, w.total_points::integer as points, w.tiles, w.match_id, m.completed_at
        from public.word_score_entries w
        join public.matches m on m.id = w.match_id
       where w.player_id = p_player
         and m.language = p_language
         and m.state = 'completed'
         and (m.ended_reason is null or m.ended_reason not in ('void', 'abandoned'))
       order by upper(w.word), w.total_points desc, m.completed_at asc
    ) b
   order by b.points desc, b.completed_at asc
   limit greatest(coalesce(p_limit, 3), 0);
$$;

-- A player's presence as another player's profile shows it: a word, never a time.
create or replace function public.presence_word(p_player uuid, p_language text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select case when m.player_a_id = p_player then m.player_a_moves else m.player_b_moves end::integer as moves
      from public.matches m
     where m.state in ('pending', 'in_progress')
       and (m.player_a_id = p_player or m.player_b_id = p_player)
     limit 1
  ),
  tabs as (
    select t.language,
           t.visible or t.hidden_since > now() - interval '2 minutes' as present
      from public.presence_tabs t
     where t.player_id = p_player
       and public.tab_is_fresh(t.beat_at, t.cadence_ms, t.leaving_at)
  )
  select case
           when exists (select 1 from live) then
             jsonb_build_object('state', 'in_match', 'moves_played', (select moves from live))
           when not exists (select 1 from tabs) then
             jsonb_build_object('state', 'not_here', 'moves_played', null)
           when not exists (select 1 from tabs where language = p_language) then
             jsonb_build_object('state', 'other_lobby', 'moves_played', null)
           when not exists (select 1 from tabs where language = p_language and present) then
             jsonb_build_object('state', 'away', 'moves_played', null)
           else jsonb_build_object('state', 'here', 'moves_played', null)
         end;
$$;

-- ─── Every withdraw path withdraws the link (§7.5 invariant 1) ────────────

-- send_challenge, as spec 071 left it, plus the link and its limit.
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
  -- Spec 072: a link counts toward the six a minute.
  if (select count(*) from public.match_invitations where sender_id = p_sender and created_at > now() - interval '1 minute')
   + (select count(*) from public.match_links where sender_id = p_sender and created_at > now() - interval '1 minute') >= 6 then
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

  v_until := public.pair_cooldown_until(p_sender, p_recipient);
  if v_until is not null then
    return jsonb_build_object('status', 'declined_recently', 'until', v_until);
  end if;

  select id into v_reverse from public.match_invitations
   where sender_id = p_recipient and recipient_id = p_sender and status = 'pending' and expires_at > now()
   order by created_at desc limit 1;
  if v_reverse is not null then
    v_result := public.accept_invite(v_reverse, p_sender, 60, 'crossed_challenge');
    if v_result->>'status' = 'created' then
      return jsonb_build_object('status', 'crossed', 'match_id', v_result->>'match_id');
    end if;
  end if;

  with withdrawn as (
    update public.match_invitations
       set status = 'withdrawn', responded_at = now()
     where sender_id = p_sender and status = 'pending'
    returning recipient_id
  )
  select coalesce(array_agg(recipient_id), '{}') into v_withdrawn from withdrawn;
  perform public.withdraw_links_of(p_sender);
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

-- create_match_between, as spec 070 left it, plus both players' links.
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

  update public.players
     set status = 'in_match', queue_language = null, search_paused = false, updated_at = now()
   where id in (p_a, p_b);
  update public.lobby_presence
     set mode = 'auto', invite_token = null, updated_at = now()
   where player_id in (p_a, p_b);
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
  -- Spec 072: both players' links, except the one being used.
  update public.match_links
     set status = 'withdrawn', responded_at = now()
   where status = 'pending' and sender_id in (p_a, p_b)
     and (p_origin <> 'link' or id is distinct from p_ref);

  return jsonb_build_object(
    'status', 'created',
    'match_id', v_match,
    'seats', jsonb_build_object('a', v_seat_a, 'b', v_seat_b));
end;
$$;

-- void_table, as spec 069 left it, plus clarification Q1: on a link table the
-- friend who accepted may leave while the sender has not sat down. That is the
-- sender not sitting down, never the friend leaving.
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
  v_reason text := p_reason;
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

  if not (m.state = 'pending' or (m.state = 'in_progress' and p_reason = 'left' and clock_timestamp() < m.started_at)) then
    return jsonb_build_object('status', 'not_pending');
  end if;
  v_a_seated := m.player_a_seated_at is not null;
  v_b_seated := m.player_b_seated_at is not null;

  if v_reason = 'left' and m.state = 'pending' and m.origin = 'link'
     and exists (select 1 from public.match_links l where l.id = m.origin_ref and l.used_by = p_by)
     and ((p_by = m.player_a_id and v_a_seated and not v_b_seated)
       or (p_by = m.player_b_id and v_b_seated and not v_a_seated)) then
    v_reason := 'not_seated';
    v_by := case when p_by = m.player_a_id then m.player_b_id else m.player_a_id end;
  elsif v_reason = 'not_seated' then
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
     set state = 'completed', ended_reason = 'void', void_reason = v_reason, voided_by = v_by,
         winner_id = null, completed_at = now(), updated_at = now()
   where id = p_match;

  perform public.table_release_player(
    m.player_a_id, v_a_seated, v_reason = 'not_seated' and not v_a_seated, v_reason = 'left' and v_by = m.player_a_id, m.origin, m.language);
  perform public.table_release_player(
    m.player_b_id, v_b_seated, v_reason = 'not_seated' and not v_b_seated, v_reason = 'left' and v_by = m.player_b_id, m.origin, m.language);

  return jsonb_build_object('status', 'void', 'reason', v_reason, 'voidedBy', v_by);
end;
$$;

-- sign_out_player, as spec 067 left it, plus the link.
create or replace function public.sign_out_player(p_player uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match uuid;
begin
  perform 1 from public.players where id = p_player for update;

  select id into v_match
    from public.matches
   where state in ('pending', 'in_progress')
     and (player_a_id = p_player or player_b_id = p_player)
   limit 1;
  if v_match is not null then
    return jsonb_build_object('status', 'in_match', 'match_id', v_match);
  end if;

  update public.match_invitations
     set status = 'withdrawn', responded_at = now()
   where status = 'pending' and sender_id = p_player;
  perform public.withdraw_links_of(p_player);
  update public.rematch_requests
     set status = 'withdrawn', responded_at = now()
   where status = 'pending' and requester_id = p_player;
  update public.players
     set status = 'available', queue_language = null, updated_at = now()
   where id = p_player and status = 'matchmaking';

  return jsonb_build_object('status', 'signed_out');
end;
$$;

-- lobby_pending and confirm_lobby_switch, as spec 070 left them, plus the link.
create or replace function public.lobby_pending(p_player uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select array_remove(array[
    case when exists (select 1 from public.players p where p.id = p_player and p.status = 'matchmaking') then 'search' end,
    case when exists (select 1 from public.match_invitations i where i.sender_id = p_player and i.status = 'pending') then 'outgoing' end,
    case when exists (select 1 from public.match_invitations i where i.recipient_id = p_player and i.status = 'pending') then 'incoming' end,
    case when exists (select 1 from public.match_links l where l.sender_id = p_player and l.status = 'pending' and l.expires_at > now()) then 'link' end
  ], null);
$$;

create or replace function public.confirm_lobby_switch(p_player uuid, p_language text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counterparts uuid[];
begin
  if p_language not in ('is', 'en') then
    return jsonb_build_object('status', 'invalid');
  end if;
  perform 1 from public.players where id = p_player for update;
  update public.players
     set status = 'available', queue_language = null, queued_at = null, search_paused = false
   where id = p_player and status = 'matchmaking';
  with ended as (
    update public.match_invitations i
       set status = case when i.sender_id = p_player then 'withdrawn' else 'left' end,
           responded_at = now()
     where i.status = 'pending' and (i.sender_id = p_player or i.recipient_id = p_player)
    returning case when i.sender_id = p_player then i.recipient_id else i.sender_id end as other_id
  )
  select coalesce(array_agg(distinct other_id), '{}') into v_counterparts from ended;
  perform public.withdraw_links_of(p_player);
  perform public.move_to_lobby(p_player, p_language);
  return jsonb_build_object('status', 'switched', 'counterparts', to_jsonb(v_counterparts));
end;
$$;

-- ─── Grants ────────────────────────────────────────────────────────────

revoke all on function public.create_link(uuid, bytea, integer) from public, anon, authenticated;
grant execute on function public.create_link(uuid, bytea, integer) to service_role;
revoke all on function public.read_link(bytea) from public, anon, authenticated;
grant execute on function public.read_link(bytea) to service_role;
revoke all on function public.accept_link(bytea, uuid) from public, anon, authenticated;
grant execute on function public.accept_link(bytea, uuid) to service_role;
revoke all on function public.cancel_link(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_link(uuid, uuid) to service_role;
revoke all on function public.expire_links() from public, anon, authenticated;
grant execute on function public.expire_links() to service_role;
revoke all on function public.best_words(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.best_words(uuid, text, integer) to service_role;
revoke all on function public.presence_word(uuid, text) from public, anon, authenticated;
grant execute on function public.presence_word(uuid, text) to service_role;
revoke all on function public.send_challenge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.send_challenge(uuid, uuid) to service_role;
revoke all on function public.create_match_between(uuid, uuid, text, text, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_match_between(uuid, uuid, text, text, uuid, uuid[]) to service_role;
revoke all on function public.void_table(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.void_table(uuid, text, uuid) to service_role;
revoke all on function public.sign_out_player(uuid) from public, anon, authenticated;
grant execute on function public.sign_out_player(uuid) to service_role;
revoke all on function public.confirm_lobby_switch(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_lobby_switch(uuid, text) to service_role;
revoke all on function public.lobby_pending(uuid) from public, anon, authenticated;
