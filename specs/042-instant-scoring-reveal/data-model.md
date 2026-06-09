# Phase 1 Data Model: Instant Scoring Reveal for First Player

**Branch**: `042-instant-scoring-reveal` | **Date**: 2026-06-09 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This document defines the in-memory types, the (zero) DB schema changes, the state-machine deltas, and the invariants that must hold across the fast-path / combined-path handoff.

---

## 1. Database Schema

**No new tables. One new column (post-ship amendment). No new indexes. No new RLS policies.**

| Table | Reused as | Touched by fast path? |
|---|---|---|
| `matches` | Holds `frozen_tiles` (JSONB) and `player_*_timer_ms`. | Yes — updates `frozen_tiles` via existing `update_frozen_tiles_if_unchanged` RPC. |
| `rounds` | Holds `board_snapshot_before`, `state`, `started_at`, `frozen_tiles_before`. | Reads `frozen_tiles_before` as the scoring baseline; `state` stays `collecting` during the fast path. |
| `move_submissions` | One row per player swap per round. | Reads (existence check + first-row fetch); no writes. |
| `word_score_entries` | One row per scored word in a round. | Writes — fast-path inserts the first-mover's words. |
| `scoreboard_snapshots` | Per-round running totals. | No — written only at round completion by `publishRoundSummary`. |

**Rationale**: All canonical state already exists; the fast path just observes part of the round-resolution work earlier than today.

**Post-ship amendment — `rounds.frozen_tiles_before` (JSONB, NOT NULL, default `{}`)**: the original design ("no new columns") had the combined pass re-read `matches.frozen_tiles` as its scoring baseline. That map is mutated by the fast path *mid-round*, so the combined re-derivation rejected the first mover's own swap on its freshly-frozen tiles (frozen-coordinate guard in `processPlayerMove`), violating § 4.7. `frozen_tiles_before` snapshots the round-start freeze map (mirroring `board_snapshot_before`); both scoring passes read it as their baseline, written by `advanceRound` when it creates the next round (migration `20260609001_rounds_frozen_tiles_before.sql`). `submitMove`'s frozen-tile rejection gate intentionally keeps reading the live `matches.frozen_tiles` so mid-round freezes still block new swaps (FR-014).

---

## 2. New In-Memory Types

### 2.1 `PartialRoundSummary`

Add to `lib/types/match.ts`:

```ts
/**
 * Server-published partial state for a round that is still `collecting` but
 * for which the first player's instant-scoring pass has fired. Carries the
 * first mover's scored words and the resulting frozen tiles so the second
 * player's client can render the reveal before they submit (spec 042 / O-57).
 *
 * Distinct from `RoundSummary` (which represents a *completed* round and
 * carries both players' scores). When `lastSummary` for the same round
 * arrives, the partial reveal is deduplicated by `firstSubmissionAt`.
 */
export interface PartialRoundSummary {
  matchId: string;
  roundNumber: number;
  /** ID of the player whose submission triggered the fast path. */
  firstMoverId: string;
  /** ISO timestamp of that submission. Stable dedupe key with `firstMoverId`. */
  firstSubmissionAt: string;
  /** Only the first mover's words; empty when the swap scored nothing. */
  words: WordScore[];
  /** Score delta this submission produced (zero for the other player). */
  delta: ScoreTotals;
  /**
   * Frozen-tile map AFTER applying the fast path's freezes. Includes all
   * pre-existing freezes plus the new ones. Replaces `MatchState.frozenTiles`
   * for rendering until the round completes.
   */
  frozenTiles: FrozenTileMap;
}
```

### 2.2 `MatchState` delta

```diff
 export interface MatchState {
   matchId: string;
   board: string[][];
   currentRound: number;
   state: MatchPhase;
   timers: { playerA: TimerState; playerB: TimerState };
   scores: ScoreTotals;
   lastSummary?: RoundSummary | null;
   disconnectedPlayerId?: string | null;
   frozenTiles?: FrozenTileMap;
   pendingMoves?: PendingMove[];
+  /**
+   * Set while the current round is still `collecting` and the first player's
+   * instant-scoring pass has fired. Cleared when the round transitions to
+   * `completed` (at which point `lastSummary` carries the canonical state).
+   */
+  partialSummary?: PartialRoundSummary | null;
 }
```

No other type changes. `RoundSummary`, `WordScore`, `RoundMove`, `PendingMove`, and `FrozenTileMap` are reused verbatim.

### 2.3 Zod validation

Add a Zod schema mirroring `PartialRoundSummary` in `lib/match/schemas.ts` (or wherever the project keeps Realtime payload validation). Used by the client when decoding broadcast payloads to reject malformed messages.

---

## 3. Round State Machine

### 3.1 Round states (existing — unchanged)

```text
collecting ─→ resolving ─→ completed
```

### 3.2 New observable sub-states inside `collecting`

The DB state `collecting` is unchanged, but observers can now distinguish three *sub-states* by looking at the row counts:

| Sub-state | Detection | Client renders |
|---|---|---|
| `collecting-empty` | 0 `move_submissions` rows for this round | Idle board, both clocks running |
| `collecting-one-pending` | 1 `move_submissions` row, 0 `word_score_entries` rows for this round | First swap animation (existing `pendingMoves`); no reveal |
| `collecting-one-revealed` | 1 `move_submissions` row, ≥1 `word_score_entries` rows for this round | First swap animation + partial reveal (NEW) |

The transition from `collecting-one-pending` → `collecting-one-revealed` is the moment the fast path completes. The transition from any of the above → `resolving` is the existing CAS in `advanceRound` step 9.5.

### 3.3 `MatchState.partialSummary` lifecycle

```text
[round starts as collecting-empty]
   │  partialSummary = undefined
   ▼
[first player submits → collecting-one-pending]
   │  partialSummary = undefined  (fast path not yet run)
   │  pendingMoves = [{firstMover's swap}]      (existing #210 path)
   ▼
[fast path fires successfully → collecting-one-revealed]
   │  partialSummary = { firstMoverId, firstSubmissionAt, words, delta, frozenTiles }
   │  pendingMoves = [{firstMover's swap}]       (unchanged)
   │  frozenTiles  = (updated to include fast-path freezes)
   ▼
[second player submits → resolving (CAS in advanceRound)]
   │  partialSummary = (still set, kept for dedupe)
   ▼
[advanceRound completes → completed]
   │  partialSummary = null            (cleared by loadMatchState once round.state === 'completed')
   │  lastSummary    = canonical RoundSummary (both players' words, both deltas)
   │  pendingMoves   = []              (cleared on round transition)
```

### 3.4 Fast-path skipped (FR-007 race window) transitions

```text
[collecting-empty]
   │  fast path tries to run, sees 2 submissions
   │  logs `instant-scoring.deferred-to-combined`, returns
   ▼
[advanceRound runs → resolving → completed]
   │  partialSummary is never set
   │  lastSummary  arrives with both players' words simultaneously (today's behaviour)
```

### 3.5 Fast-path failure (FR-011) transitions

```text
[collecting-one-pending]
   │  fast path throws or exceeds 500 ms budget
   │  logs `instant-scoring.failed`, returns without writing anything
   ▼
[second player eventually submits → advanceRound → completed]
   │  partialSummary is never set
   │  lastSummary arrives normally
```

In both 3.4 and 3.5, observable client behaviour is identical to today's combined-scoring path.

---

## 4. Field-Level Invariants

### 4.1 `partialSummary.words[*].playerId === partialSummary.firstMoverId`

The partial summary only carries the first mover's words. If the renderer encounters a word with a different `playerId`, that is a bug (the broadcast was corrupted or the type was mis-cast). The Zod schema enforces this.

### 4.2 `partialSummary.delta` has non-zero only for the first mover

`delta.playerA` and `delta.playerB` are non-negative; exactly one of them is non-zero (the first mover's), and the other is `0`. If both are zero, `words` MUST be empty and the fast path MUST NOT have published (FR-006: zero-score swap → no broadcast).

### 4.3 `partialSummary.frozenTiles` is a superset of the pre-fast-path `matches.frozen_tiles`

The fast path can only *add* freezes for the round (it scores one move). It MUST NOT remove or modify existing freezes from prior rounds. The `update_frozen_tiles_if_unchanged` RPC enforces this at the DB level by requiring the prior state as a CAS precondition.

### 4.4 At most one `partialSummary` per round

Each round produces at most one `partialSummary` because the fast path runs against exactly one submission (the first by `submittedAt`). When the second submission arrives, the round transitions to `resolving` and the combined path takes over. The combined path does not produce another `partialSummary`; it produces a `lastSummary`.

### 4.5 Dedupe key: `${firstMoverId}-${firstSubmissionAt}`

This is the stable identifier the client uses to skip re-animating the partial reveal once the `lastSummary` arrives. Mirrors the pattern `animatedOpponentMoveKeysRef` uses for `PendingMove` (PR #210).

### 4.6 `lastSummary` supersedes `partialSummary` for the same round

When `lastSummary?.roundNumber === partialSummary?.roundNumber`, the client SHOULD treat `lastSummary` as canonical and stop consulting `partialSummary` for that round. `loadMatchState` clears `partialSummary` once `round.state !== 'collecting'`.

### 4.7 Idempotency: `word_score_entries` count for the round equals the canonical combined-scoring count

After the round completes, the number of `word_score_entries` rows MUST equal what the combined pipeline would have produced if instant scoring had never run. This is enforced by `executeScoringPipeline`'s existing delete-then-insert pattern (`publishRoundSummary.ts:413`). The fast-path's rows are wiped and recreated by the combined-path's re-derivation against the combined board.

This invariant additionally requires both passes to score against the same freeze baseline — `rounds.frozen_tiles_before` (see § 1 post-ship amendment). If the combined pass scored against the fast-path-mutated `matches.frozen_tiles`, the re-derivation would reject the first mover's swap and the DELETE would destroy their score instead of recreating it. Pinned by `tests/unit/lib/match/roundEngine.frozenTilesBaseline.test.ts` and `tests/unit/match/instantScoring.frozenBaseline.spec.ts`.

### 4.8 No `scoreboard_snapshots` write by the fast path

The fast path MUST NOT call `recordScoreSnapshot`. `scoreboard_snapshots` is written exactly once per round by `publishRoundSummary` at round completion, and that single row carries both players' final totals.

---

## 5. Polling-Fallback Derivation Rules (extends `loadMatchState`)

When `loadMatchState` runs and `round.state === 'collecting'`:

1. Fetch `word_score_entries` rows for the current round. If none, set `partialSummary = undefined` and return.
2. Fetch the earliest accepted `move_submissions` row for the current round (by `submitted_at ASC, status IN ('pending', 'accepted')`). This is the first mover.
3. Group `word_score_entries` rows by `player_id`. If only the first mover's rows exist, build a `PartialRoundSummary`:
    - `firstMoverId` = step 2's `player_id`
    - `firstSubmissionAt` = step 2's `submitted_at`
    - `words` = mapped from step 1's rows
    - `delta` = `{playerA: sum-if-first-mover-is-A-else-0, playerB: sum-if-first-mover-is-B-else-0}`
    - `frozenTiles` = current `matches.frozen_tiles` (already includes fast-path freezes)
4. If `word_score_entries` rows include the second player too, the combined path has already run — set `partialSummary = undefined` (the `lastSummary` query that runs in parallel will surface the canonical summary instead).

This makes polling-fallback clients fully consistent with realtime clients within one poll interval (FR-002, SC-001).

---

## 6. Type-Safety Boundary

- `submitMove` return type **unchanged** (`Promise<MoveResult | { error: string }>`). The fast path is invoked from inside the `after()` hook and is invisible to the caller.
- `MatchState` adds **one** optional field. All consumers (`MatchClient`, `loadMatchState`, polling-fallback hydration) handle `undefined` gracefully.
- All inbound Realtime payloads are validated by Zod before reaching `MatchClient` state setters. Adding `PartialRoundSummary` to the schema means malformed `partialSummary` data on the wire causes the entire `state` payload to be rejected and the client falls back to polling.

---

## 7. Migration Considerations

- **None.** No DB migration. No deploy ordering concerns.
- A stale client (older bundle) that subscribes to a `state` event carrying `partialSummary` will see an unknown field and ignore it (TypeScript's `excess property` check is compile-time; the runtime decoder doesn't reject unknown fields). Stale clients simply don't render the partial reveal — degrade to today's behaviour.
- A new client receiving a `state` event from an older server (during deploy rolling window) will see `partialSummary === undefined` and render today's behaviour. No errors.
