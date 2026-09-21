# Data Model: Ten moves each on one shared clock

**Spec**: `specs/050-async-moves/spec.md` · **Migration**: `supabase/migrations/20260921001_async_moves.sql` (one file, destructive)

## 1. Why a hard cut

No live users; a beta relaunch is ahead. Keeping `rounds` as "one row per move" would leave every reader calling a move a round, make the unique `(match_id, round_number)` a silent global sequence, and key `scoreboard_snapshots` by a number nobody shows. The migration deletes all match data (`delete from matches` cascades) and resets `players.elo_rating`, `games_played`, `wins`, `losses`, `draws`.

## 2. `matches` (changed)

| Column | Type | Note |
| --- | --- | --- |
| `board` | jsonb | the live board; set at start, written by every resolved move |
| `started_at` | timestamptz | set when both players have loaded the room or 10s after `created_at`; `now + 3s` so the countdown is server-anchored |
| `deadline_at` | timestamptz | `started_at + 5:00` |
| `move_seq` | int not null default 0 | receipt counter, gap-free |
| `resolved_seq` | int not null default 0 | resolution cursor; every move at `resolved_seq + 1` is next |
| `player_a_moves` / `player_b_moves` | smallint 0..10 | resolved moves |
| `player_a_score` / `player_b_score` | int | running totals |
| `move_limit` | smallint default 10 | |
| `ended_reason` | text | `moves_complete` · `incomplete` · `both_incomplete` · `disconnect` · `forfeit` · `abandoned` · `error` |

Dropped: `player_a_timer_ms`, `player_b_timer_ms`, `current_round`, `round_limit`, `rated`. Kept: `state` (`pending` · `in_progress` · `completed` · `abandoned`), `frozen_tiles`, `winner_id`, `completed_at`, `rematch_of`, `board_seed`.

## 3. `match_moves` (new)

| Column | Type | Note |
| --- | --- | --- |
| `id` | uuid pk | |
| `match_id` | uuid → matches (cascade) | |
| `player_id` | uuid → players (cascade) | |
| `global_seq` | int not null | receipt order; `unique (match_id, global_seq)` |
| `seq` | smallint 1..10 | the player's Nth **resolved** move; null until resolved; unique per (match, player) where not null |
| `from_x` `from_y` `to_x` `to_y` | smallint 0..9 | |
| `from_letter` `to_letter` | text | what the client saw; the `moved` check |
| `received_at` | timestamptz default `clock_timestamp()` | informational |
| `claimed_at` `resolved_at` | timestamptz | |
| `status` | text | `pending` · `resolving` · `resolved` · `rejected` |
| `rejection_reason` | text | `frozen` · `moved` |
| `board_before` `board_after` `frozen_before` `frozen_after` | jsonb | written at finish |
| `delta` `score_a_after` `score_b_after` | int | written at finish |

Indexes: partial unique `(match_id, player_id) where status in ('pending','resolving')` (one in flight, FR-004); `(match_id, global_seq) where status in ('pending','resolving')` for the claim. RLS: participants select; writes service-role only.

## 4. `word_score_entries` (changed)

`round_id` → `move_id uuid → match_moves (cascade)`; `is_duplicate` dropped (FR-007). Index on `move_id`. Written only by `finish_move`, so delete-then-insert idempotency is no longer needed.

## 5. Dropped

Tables `rounds`, `move_submissions`, `scoreboard_snapshots`; function `update_frozen_tiles_if_unchanged` (freeze writes go through `finish_move`).

## 6. Functions (security definer, `search_path = ''`, execute granted to `service_role` only)

- `receive_move(p_match_id, p_player_id, p_from_x, p_from_y, p_to_x, p_to_y, p_from_letter, p_to_letter) returns jsonb` — `select … for update` on the match row; gates in order `ended`, `deadline` (`clock_timestamp() > deadline_at`), `cap`, `in_flight`; each returns `{status:'rejected', reason}` without inserting; else `move_seq + 1`, insert `pending`, return `{status:'accepted', moveId, globalSeq, receivedAt}`.
- `claim_next_move(p_match_id, p_stale_ms) returns setof …` — one `update … set status='resolving', claimed_at=clock_timestamp() where match_id=$1 and global_seq = (select resolved_seq+1 …) and (status='pending' or (status='resolving' and claimed_at < clock_timestamp() - p_stale_ms))` returning the move joined with the match's board, frozen map, scores, counts and player ids.
- `finish_move(p_move_id, p_expected_resolved_seq, p_payload jsonb) returns int` — one transaction: CAS `update matches set resolved_seq = resolved_seq + 1, board, frozen_tiles, player_x_score, player_x_moves where id = … and resolved_seq = p_expected_resolved_seq`; zero rows → return 0; else update the move row (status, seq, resolved_at, snapshots, delta, totals) and insert word rows; return 1.
- `find_due_matches() returns setof uuid` — in_progress and `deadline_at < now() - interval '2 seconds'`, for the cron sweep.

## 7. `MatchState` (client contract)

```ts
type MatchPhase = "pending" | "in_progress" | "completed" | "abandoned";
interface PlayerMatchFacts { playerId; movesPlayed; score; inFlight: { moveId; globalSeq; receivedAt } | null; lastResolution: MoveResolution | null }
interface MatchState {
  matchId; board; state: MatchPhase;
  players: { playerA: PlayerMatchFacts; playerB: PlayerMatchFacts };
  clock: { startedAt: string | null; deadlineAt: string | null; serverNow: string };
  moveLimit: 10; resolvedSeq: number; scores: ScoreTotals; frozenTiles: FrozenTileMap;
  winnerId?; endedReason?; disconnectedPlayerId?; disconnectedAt?; reconnectWindowMs?;
}
```

Retired: `timers`, `currentRound`, `lastSummary`, `partialSummary`, `pendingMoves`, `RoundSummary`, `PartialRoundSummary`, `PendingMove`, `RoundMove`, `TimerState`, `SubmissionRecord`, `RoundTracker`, `MoveSubmission`.

## 8. `MoveResolution` (broadcast `move-resolved`)

```ts
interface MoveResolution {
  matchId; moveId; playerId; globalSeq; seq: number | null;
  status: "resolved" | "rejected"; rejectionReason?: "frozen" | "moved";
  swap: { from: Coordinate; to: Coordinate };
  board: string[][];            // after (unchanged when rejected)
  words: WordScore[]; delta: number; totals: ScoreTotals;
  frozenTiles: FrozenTileMap; movesPlayed: { playerA: number; playerB: number };
  resolvedAt: string;
}
```

## 9. Invariants

- I8′: a move is scored against the board and freeze map written by move `global_seq − 1`.
- I9: `resolved_seq` is gap-free and never decreases; `global_seq` is the ordering authority.
- I10: `player_x_moves` equals the count of that player's `resolved` rows; a `rejected` row has `seq = null`.
