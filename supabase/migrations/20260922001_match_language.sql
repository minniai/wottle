-- Spec 060: a match is played in one language, fixed when it is created.
-- Additive: every existing row is Icelandic, which is what it was played in.

alter table public.matches
  add column if not exists language text not null default 'is'
  constraint matches_language_check check (language in ('is', 'en'));

comment on column public.matches.language is
  'Spec 060: the game language — dictionary, letter values and letter frequencies. Written once by bootstrapMatchRecord; a rematch copies it.';

-- A challenge carries the language of the lobby it was sent from.
alter table public.match_invitations
  add column if not exists language text not null default 'is'
  constraint match_invitations_language_check check (language in ('is', 'en'));

-- Who is here, per language: the lobby a player is present in.
alter table public.lobby_presence
  add column if not exists language text not null default 'is'
  constraint lobby_presence_language_check check (language in ('is', 'en'));

-- The queue a player is waiting in. Set together with status = 'matchmaking'
-- and cleared when they leave it, so two languages never pair.
alter table public.players
  add column if not exists queue_language text
  constraint players_queue_language_check check (queue_language in ('is', 'en'));

create index if not exists idx_players_queue_language
  on public.players (queue_language, last_seen_at)
  where status = 'matchmaking';

-- claim_next_move: unchanged, except that the match object now carries the
-- language, so the resolver loads the right dictionary and letter values.
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
         player_a_moves, player_b_moves, move_limit, resolved_seq, language
    into m
    from public.matches
   where id = p_match_id;
  return jsonb_build_object('move', to_jsonb(v_move), 'match', to_jsonb(m));
end;
$$;

revoke all on function public.claim_next_move(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_next_move(uuid, integer) to service_role;
