# Contract: table database functions

All are `security definer`, granted to `service_role` only, and every one takes the match row lock (`for update`) first.

## `create_match_between(a, b, language, origin, ref, pressed_by uuid[] default '{}')` (changed)
- The existing behaviour is unchanged: it locks both players and refuses `busy`, and it withdraws and supersedes their challenges and rematch requests.
- New:
  - `table_deadline_at = now() + interval '20 seconds'`.
  - For each player, `seated_at = now()` if they are in `pressed_by`, or their attention is fresh (data-model).
- Returns: the existing object, plus `seats: {a: bool, b: bool}`.
- **Callers:**
  - `pair_from_queue`: `'{}'`.
  - `accept_invite`: `{accepter}`; a crossed challenge passes `{a, b}`.
  - `accept_rematch`: `{accepter}`; a crossed rematch passes `{a, b}`.

## `seat_player(match, player, board jsonb, lead_ms int, clock_ms int) → jsonb`
| Precondition | Result |
|---|---|
| no such match / not a participant | `{status:'not_found'}` |
| ended (`completed`) | `{status:'void'}` when void, else `{status:'ended'}` |
| `pending` and `now() >= table_deadline_at` | `{status:'late'}` (caller then voids lazily) |
| already seated, other not | `{status:'seated'}` (idempotent) |
| this seat completes the table | writes `board`, `state='in_progress'`, `started_at = now()+lead`, `deadline_at = started_at+clock` → `{status:'started', startedAt, deadlineAt, serverNow}` |
| `in_progress` already | `{status:'started', …}` (idempotent) |

## `start_table_if_seated(match, board, lead_ms, clock_ms) → jsonb`
Does the completion step when both seats are set and the match is still `pending`. Otherwise it is a no-op returning the current status.

## `void_table(match, reason text, by uuid) → jsonb`
- **Applies to:**
  - `pending`;
  - `in_progress` with `now() < started_at` (a leave during the count).
- **For `not_seated`:** requires `now() >= table_deadline_at` and not both seated; `by` is recomputed in SQL as the one unseated player (null if both are unseated).
- **For `left`:** `by` must be a participant.
- **Writes:** `state='completed'`, `ended_reason='void'`, `void_reason`, `voided_by`, `completed_at=now()`, `winner_id=null`.
- **Players, in the same transaction:**
  - the unseated player(s) of a `not_seated` void: `status='available'`, `queued_at=null`, `queue_language=null`, `search_paused=false`, `table_missed_at=now()`;
  - the leaver: `status='available'`, `queued_at=null`, `queue_language=null`;
  - a seated non-leaver of a `queue` table: `status='matchmaking'`, `queue_language=match.language`, `search_paused=false`, and `queued_at` kept (or `now()` if null);
  - everyone else: `status='available'`.
- **Returns:** `{status:'void'|'not_pending'|'not_due', reason, voidedBy}`.

## `find_due_tables() → setof uuid`
Returns pending matches with `table_deadline_at <= now()`.

## `table_leave_cooldown_until(player uuid) → timestamptz`
See data-model. Returns null when there is no cooldown.

## `pair_from_queue(a, b, language)` (changed)
Under its locks it also requires, for both players, not `search_paused` and `last_seen_at > now() - 10s`. Otherwise it returns `not_searching`.

## Dropped
`start_match_if_ready`.
