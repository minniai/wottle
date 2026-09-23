-- Spec 067: signing out never resigns (FR-013). While a match is live it is
-- refused; otherwise it ends the player's other commitments so nobody is paired
-- with, or waits on, someone who has left (FR-015).

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
  update public.rematch_requests
     set status = 'withdrawn', responded_at = now()
   where status = 'pending' and requester_id = p_player;
  update public.players
     set status = 'available', queue_language = null, updated_at = now()
   where id = p_player and status = 'matchmaking';

  return jsonb_build_object('status', 'signed_out');
end;
$$;

revoke all on function public.sign_out_player(uuid) from public, anon, authenticated;
grant execute on function public.sign_out_player(uuid) to service_role;
