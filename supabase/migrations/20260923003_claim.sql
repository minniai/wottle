-- Spec 067: a name belongs to the browser that claimed it (S1).
--
-- enter_player claims a name for a device key (by its hash) or refuses it as
-- taken; resolve_claim finds the name a key entered as most recently, for the
-- silent renewal of a lapsed session. Neither ever writes a player's status.

create or replace function public.enter_player(
  p_username text,
  p_display_name text,
  p_claim_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players;
begin
  if p_claim_hash is null or length(p_claim_hash) <> 64 then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.players (username, display_name, status, last_seen_at)
  values (p_username, p_display_name, 'available', now())
  on conflict (username) do nothing;

  -- Row lock: of two keys racing for one unclaimed name, exactly one sets the hash.
  -- username is citext; with an empty search_path its case-blind `=` must be named.
  select * into v_player
    from public.players
   where username operator(public.=) p_username::public.citext
     for update;

  if v_player.claim_hash is null then
    update public.players
       set claim_hash = p_claim_hash, claimed_at = now()
     where id = v_player.id;
  elsif v_player.claim_hash <> p_claim_hash then
    return jsonb_build_object('status', 'name_taken');
  end if;

  update public.players
     set last_entered_at = clock_timestamp(), last_seen_at = now(), updated_at = now()
   where id = v_player.id;

  return jsonb_build_object(
    'status', 'entered',
    'player', jsonb_build_object('id', v_player.id, 'username', v_player.username, 'display_name', v_player.display_name)
  );
end;
$$;

revoke all on function public.enter_player(text, text, text) from public, anon, authenticated;
grant execute on function public.enter_player(text, text, text) to service_role;

create or replace function public.resolve_claim(p_claim_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player record;
begin
  select id, username, display_name into v_player
    from public.players
   where claim_hash = p_claim_hash
   order by last_entered_at desc nulls last
   limit 1
   for update;
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;

  update public.players
     set last_entered_at = clock_timestamp(), last_seen_at = now()
   where id = v_player.id;

  return jsonb_build_object(
    'status', 'entered',
    'player', jsonb_build_object('id', v_player.id, 'username', v_player.username, 'display_name', v_player.display_name)
  );
end;
$$;

revoke all on function public.resolve_claim(text) from public, anon, authenticated;
grant execute on function public.resolve_claim(text) to service_role;
