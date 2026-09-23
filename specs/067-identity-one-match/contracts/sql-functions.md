# Contract: database functions

All functions are `language plpgsql security definer set search_path = ''`. They use fully qualified names and return `jsonb`. Each ends with `revoke all … from public, anon, authenticated; grant execute … to service_role;`, the style of `receive_move`.

## create_match_between(p_a, p_b, p_language, p_origin, p_ref)

1. `invalid` if `p_a = p_b`, if `p_language` is not in (`is`,`en`), or if `p_origin` is not in the origin list.
2. `select id from public.players where id in (p_a, p_b) order by id for update`. `invalid` unless both rows exist.
3. `busy (player_id)` if either player appears in `public.matches` with `state in ('pending','in_progress')`. When both do, the one with the lower id is named.
4. Insert the match: `board_seed = gen_random_uuid()`, `player_a_id = p_a`, `player_b_id = p_b`, `language`, `state = 'pending'`, `origin`, `origin_ref = p_ref`, and `rematch_of` = the request's `match_id` when the origin is `rematch` or `crossed_rematch`.
5. `update public.players set status = 'in_match', queue_language = null where id in (p_a, p_b)`.
6. `update public.lobby_presence set mode = 'auto', invite_token = null where player_id in (p_a, p_b)`.
7. Invites and rematch requests. Except the row whose `id = p_ref`, each pending one becomes:
   - `withdrawn` when its sender or requester is `p_a` or `p_b`;
   - `superseded` when its recipient or responder is `p_a` or `p_b`.
   Every change sets `responded_at = now()`.
8. Return `{status:'created', match_id}`.

**Lock order (all functions).** Players first, in ascending id order, then invites and rematch requests. Row locks are re-entrant within one transaction, so `create_match_between` locking players its caller already holds is free.

**Invariant pinned by tests.** After any interleaving of concurrent calls, no player has more than one match in (`pending`, `in_progress`).

## accept_invite(p_invite, p_actor, p_ttl_seconds, p_origin = 'challenge')

1. Read the invite without a lock to learn `sender_id` and `recipient_id`. Lock both players in id order, **then** `select … from public.match_invitations where id = p_invite for update`. Every function takes player locks before invite or request locks, and `create_match_between` updates invites and requests only while holding the player locks, so two functions can never each wait on a lock the other holds.
2. Validate the invite:
   - `not_recipient` unless `recipient_id = p_actor`;
   - `not_pending` unless `status = 'pending'`;
   - `expired` if `created_at + p_ttl_seconds` has passed (and set its status to `expired`).
3. Inside `begin … exception when others` (a sub-transaction):
   - Set `status = 'accepted'`, `responded_at = now()`.
   - `r := create_match_between(sender, recipient, coalesce(language,'is'), p_origin, p_invite)`.
   - If `r.status <> 'created'`, raise to roll back the sub-block.
   - Otherwise set `match_id` and return `r`.
4. On the raised path, if the busy player is the sender, mark the invite `superseded`. Return `r` (`busy`).

## accept_rematch(p_request, p_actor, p_origin = 'rematch')

Same shape as `accept_invite`, over `public.rematch_requests`:
- The responder must be `p_actor`.
- The request must be pending.
- The age check (30s) is skipped when `p_origin = 'crossed_rematch'`.
- The original match must be `completed`.
- The language is taken from the original match.
- On `created`, write `new_match_id`.

## pair_from_queue(p_self, p_opponent, p_language)

1. Lock both players in id order.
2. `not_searching` unless both have `status = 'matchmaking'` and `queue_language = p_language`.
3. Return `create_match_between(p_self, p_opponent, p_language, 'queue', null)`.

## enter_player(p_username, p_display_name, p_claim_hash)

1. `insert into public.players (username, display_name, status, last_seen_at) values (…, 'available', now()) on conflict (username) do nothing`.
2. `select … where username = p_username for update`.
3. Check the claim:
   - if `claim_hash` is null, set it to `p_claim_hash` and set `claimed_at = now()`;
   - else if it differs from `p_claim_hash`, return `{status:'name_taken'}`.
4. Set `last_entered_at = now()` and `last_seen_at = now()`. Return `{status:'entered', player: {id, username, display_name}}`.

## resolve_claim(p_claim_hash)

Select the player where `claim_hash = p_claim_hash`, ordered by `last_entered_at desc nulls last`, `limit 1`, `for update`. If none, return `{status:'unknown'}`. Otherwise stamp `last_entered_at` and return `{status:'entered', player}`.

## sign_out_player(p_player)

1. Lock the player.
2. If the player is in a match in (`pending`, `in_progress`), return `{status:'in_match', match_id}`.
3. Otherwise:
   - withdraw the player's pending outgoing invites and rematch requests;
   - if the status is `matchmaking`, set `status = 'available', queue_language = null`.
4. Return `{status:'signed_out'}`.
