# Data Model: 006-match-completion

**Branch**: `006-match-completion` | **Date**: 2026-02-25

## Summary of Changes

One new column on the `rounds` table. Existing `matches` timer columns become mutable (updated server-side after each round resolves). No new tables.

---

## Schema Changes

### Migration: `supabase/migrations/20260225001_match_completion.sql`

```sql
-- Add round start timestamp for server-authoritative clock computation.
-- Used to calculate elapsed time per player per round.
ALTER TABLE public.rounds
  ADD COLUMN started_at timestamptz;

-- Backfill: use completed_at of the prior round as an approximation for
-- existing completed rounds. For in-progress or future rounds this will
-- be set explicitly when the round enters "collecting" state.
UPDATE public.rounds
  SET started_at = created_at
  WHERE started_at IS NULL;

-- Comment documents the invariant for future developers.
COMMENT ON COLUMN public.rounds.started_at IS
  'Server timestamp when this round entered the collecting state. '
  'Used to compute per-player elapsed time for clock enforcement. '
  'Set by roundEngine when creating a new round.';
```

---

## Entity Definitions

### `rounds` table (updated)

| Column | Type | Change | Description |
|--------|------|--------|-------------|
| `id` | `uuid` | existing | Primary key |
| `match_id` | `uuid` | existing | Parent match |
| `round_number` | `smallint` | existing | 1–10 |
| `state` | `text` | existing | `collecting`, `resolving`, `completed` |
| `board_snapshot_before` | `jsonb` | existing | Board state at round start |
| `board_snapshot_after` | `jsonb` | existing | Board state after resolution |
| `started_at` | `timestamptz` | **NEW** | When round entered `collecting` state |
| `resolution_started_at` | `timestamptz` | existing | When resolution began |
| `completed_at` | `timestamptz` | existing | When round fully resolved |

### `matches` table (behaviour change — no column additions)

| Column | Type | Old Behaviour | New Behaviour |
|--------|------|---------------|---------------|
| `player_a_timer_ms` | `integer` | Set once at creation (300,000); never updated | Updated after each round resolves: reduced by player A's elapsed time for that round |
| `player_b_timer_ms` | `integer` | Set once at creation (300,000); never updated | Updated after each round resolves: reduced by player B's elapsed time for that round |
| `winner_id` | `uuid` | Set on round-limit completion | Also set on `time_expiry` completion |
| `ended_reason` | `text` | Only ever `"round_limit"` in practice | Also `"time_expiry"` when both clocks expire |

### `move_submissions` table (no schema changes)

The `status = "timeout"` value already exists in the schema. A synthetic timeout submission (with `from_x/y` and `to_x/y` set to sentinel values, e.g. `(-1, -1)`) will be inserted server-side when a player's clock expires mid-round. The sentinel move is treated as a pass by the conflict resolver.

---

## Server-Side Clock Computation

The authoritative clock state for a player at any point mid-round is:

```
elapsed_this_round_ms  = now() - round.started_at
remaining_ms           = player_x_timer_ms - elapsed_this_round_ms
is_expired             = remaining_ms <= 0
```

After a round resolves (both submissions received):

```
-- For player A:
player_a_elapsed_ms    = player_a_submission.submitted_at - round.started_at
new_player_a_timer_ms  = player_a_timer_ms - player_a_elapsed_ms

-- For player B:
player_b_elapsed_ms    = player_b_submission.submitted_at - round.started_at
new_player_b_timer_ms  = player_b_timer_ms - player_b_elapsed_ms
```

For a timeout submission (synthetic pass), `submitted_at` is set to the moment the timeout was detected (i.e. `now()` at synthesis time), which means the player's full remaining time is consumed for that round.

---

## State Transitions (updated)

### Match lifecycle

```
pending
  └─► in_progress  (first loadMatchState() call)
        └─► completed  (after round 10 resolves — reason: "round_limit")
        └─► completed  (after both clocks expire — reason: "time_expiry")
        └─► abandoned  (future: forfeit/disconnect — not in this spec)
```

### Round lifecycle

```
collecting  (started_at set here)
  └─► resolving  (both submissions received OR timeout-pass synthesised)
        └─► completed  (word scoring done, scoreboard snapshot written)
```

### Player clock lifecycle (per match)

```
running     (round opens — both players' clocks tick simultaneously)
  └─► paused   (player submits their move — server stops counting elapsed for this player)
  └─► expired  (player_x_timer_ms - elapsed <= 0 at submission time OR at round start)
```

---

## Match Result Data (for game-over screen)

All data required for the rich game-over screen already exists in the database. No new tables or columns required.

| Display element | Source |
|-----------------|--------|
| Final score per player | `scoreboard_snapshots` — row where `round_number = max(round_number)` for match |
| Winner / draw | `matches.winner_id` (null = draw), `matches.ended_reason` |
| Top-scoring words per player | `word_score_entries` — grouped by `player_id`, sorted by `total_points DESC`, `is_duplicate = false` |
| Frozen tile count per player | `matches.frozen_tiles` JSONB — count entries where `owner = "player_a"`, `"player_b"`, or `"both"` (counts toward both) |
| Match end reason | `matches.ended_reason` — `"round_limit"` or `"time_expiry"` |

---

## Type Changes (`lib/types/match.ts`)

### `TimerState` — no structural changes required

The existing shape is sufficient. `remainingMs` will now carry server-computed values instead of the static initial value.

### New type: `ClockCheckResult`

```typescript
export type ClockCheckResult =
  | { allowed: true }
  | { allowed: false; remainingMs: number };
```

Used as the return type of the new pure function `checkPlayerClock(match, round, playerId)` in `lib/match/clockEnforcer.ts`.

### Updated `MatchEndedReason`

```typescript
// "timeout" renamed to "time_expiry" for clarity and consistency with spec terminology
export type MatchEndedReason =
  | "round_limit"
  | "time_expiry"    // was "timeout" — update all usages
  | "disconnect"
  | "forfeit"
  | "error";
```
