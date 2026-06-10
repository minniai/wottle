# Server Action Contracts

**Branch**: `042-instant-scoring-reveal` | **Date**: 2026-06-09

This file enumerates the Server Action / server-only function contracts touched by this feature. Public-facing Server Actions are unchanged; one new internal function is added.

---

## 1. `submitMove` (existing — public signature unchanged)

**Location**: `app/actions/match/submitMove.ts`

**Signature** (unchanged):

```ts
export async function submitMove(
  matchId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Promise<MoveResult | { error: string }>;
```

**Behaviour changes** (additive, post-response only):

The function body up through `move_submissions` insert + `revalidatePath` + return is **byte-for-byte identical** to today. The only change is in the existing `after()` hook on lines 204–214: today it calls `advanceRound(matchId)`; after this change it calls a sequence of two independent fire-and-forget operations.

```diff
   after(async () => {
+    try {
+      await instantScoreFirstSubmission(matchId);
+    } catch (e) {
+      console.error("[InstantScoring] Failed (non-fatal):", e);
+    }
     try {
       await advanceRound(matchId);
     } catch (e) {
       console.error("Failed to advance round:", e);
     }
   });
```

**Why sequential, not parallel**: the fast path is bounded by a 5 s internal budget in the worst case (Decision 6 as revised for O-71 — dominated by a cold dictionary load on serverless) and `advanceRound` will no-op on a `pending` round with <2 submissions, so sequencing them costs nothing user-facing in the happy path. Sequencing also guarantees the race-window check in `instantScoreFirstSubmission` (Decision 2) reads a consistent view of `move_submissions`.

**Return-type contract**: unchanged. Callers (the `/api/match/[matchId]/move` route, tests, and the client's `MatchClient`) see no API surface change.

**Rate limiting**: unchanged (`assertWithinRateLimit({scope: "match:submit-move", limit: 30, windowMs: 60_000})`).

**Authentication**: unchanged (`readLobbySession`).

---

## 2. `instantScoreFirstSubmission` (NEW — internal, server-only)

**Location**: `lib/match/instantScoring.ts`

**Signature**:

```ts
/**
 * Fast-path scoring for the first submission of a round.
 *
 * Invoked from `submitMove`'s `after()` hook. No-op when the second submission
 * has already arrived (FR-007) or when scoring throws / exceeds the internal
 * budget (FR-011). Idempotent on repeat invocation — relies on
 * `executeScoringPipeline`'s existing delete-then-insert pattern for word
 * score entries (#177 regression guard).
 *
 * @returns A discriminated result for tests/observability. NOT consumed by the
 *   caller in production (`submitMove` ignores the return value).
 */
export async function instantScoreFirstSubmission(
  matchId: string,
): Promise<InstantScoringResult>;

export type InstantScoringResult =
  | { status: "fired"; partial: PartialRoundSummary; durationMs: number }
  | { status: "deferred-to-combined"; reason: "race-window" | "no-submissions" }
  | { status: "no-score"; reason: "swap-produced-no-words" }
  | { status: "failed"; reason: string };
```

**Inputs**: `matchId` only. The fast path resolves the round, the first submission, and the board state from the DB. Passing `matchId` (instead of `submissionId`) makes the function resilient to the rare case where `submitMove` and the fast path race to the DB.

**Side effects**:

| Effect | Trigger | Cleanup on failure |
|---|---|---|
| `word_score_entries` rows inserted | Status `fired` | `executeScoringPipeline` wraps in try/catch internally; partial rows from a mid-insert failure are wiped on the next pipeline run by the existing delete-before-insert guard |
| `matches.frozen_tiles` JSONB updated via `update_frozen_tiles_if_unchanged` RPC | Status `fired` | CAS retry on stale; logs `frozen-tiles.stale-retry` (existing) |
| `publishMatchState(matchId)` broadcast on `match:${matchId}` | Status `fired` | Best-effort with 2 s subscribe timeout (existing `BROADCAST_SUBSCRIBE_TIMEOUT_MS`); polling fallback covers any miss |
| Structured log event | All statuses | N/A — logging is best-effort |
| `performance.mark()` pair (`instant-scoring:start`, `instant-scoring:broadcast`) | Status `fired` | N/A |

**Read budget**: 3 DB roundtrips in the happy path —
1. `SELECT count(*) FROM move_submissions WHERE round_id = ? AND status = 'pending'` (race-window check)
2. `SELECT * FROM matches, rounds, move_submissions` joined (read first submission + board + frozen tiles) — can be a single Postgres query
3. `processRoundScoring` internal reads (dictionary is in-process Set after first load)

**Write budget**: up to 3 DB roundtrips in the happy path —
1. `INSERT INTO word_score_entries` (batch)
2. `update_frozen_tiles_if_unchanged` RPC
3. `publishMatchState` broadcast (Realtime + 1 DB read via `loadMatchState`)

**Internal timeout**: 5 s (`INSTANT_SCORING_TIMEOUT_MS`, revised from 500 ms for Linear O-71 — the old budget was below a cold serverless dictionary load, so the fast path never fired in production) via `Promise.race` against a `setTimeout`. On timeout, log `instant-scoring.failed` and return `{status: "failed", reason: "timeout"}`. The caller (`submitMove`'s `after()` hook) ignores the return value; `advanceRound` then runs the combined path normally.

**Pre-write guard (O-58/O-70/O-71)**: after warming the dictionary and immediately before `computeWordScoresForRound`, the fast path re-reads `rounds.state` and returns `deferred-to-combined` unless it is still `collecting`. `Promise.race` does not cancel the losing branch, so a timed-out run keeps executing detached and — on serverless — can resume after the instance thaws, when the round has already been resolved by the combined path; without this guard its delete-then-insert would wipe the round's canonical entries.

**Concurrency / Idempotency contract**:

- If two concurrent invocations of `instantScoreFirstSubmission(matchId)` happen (e.g. first player submits twice in quick succession before rate-limiting), they observe the same `word_score_entries` state thanks to `executeScoringPipeline`'s delete-then-insert. The second invocation either no-ops (race-window check sees ≥2 submissions because the first call wrote rows already, OR a duplicate-submission insert in `submitMove` would have been rejected at the unique constraint before reaching the fast path).
- If the fast path and `advanceRound` race (both queued in the same `after()` hook), `advanceRound`'s `state = 'collecting' → 'resolving'` CAS in step 9.5 serialises them. Worst case: the fast path's writes are immediately overwritten by `advanceRound`'s combined pass — semantically identical to a fast-path-fired-then-combined-path-fired sequence and covered by the delete-then-insert idempotency.

**Failure modes**:

| Failure | Detection | Effect |
|---|---|---|
| Dictionary not loaded yet | Fast path warms it via `loadDictionary` before scoring (1.3–4 s cold on serverless) | Absorbed by the 5 s budget; only a pathological load hits the timeout |
| Postgres unavailable | Supabase client throws | try/catch logs `instant-scoring.failed`; no state change |
| Realtime subscribe times out | Existing 2 s `BROADCAST_SUBSCRIBE_TIMEOUT_MS` | DB writes already persisted; polling fallback covers the broadcast miss |
| Race window | `count(*) >= 2` | Returns `deferred-to-combined`, logs the event |
| First swap scores nothing | `processRoundScoring` returns empty word list | Returns `no-score`, logs nothing (every submit would log otherwise) |

---

## 3. `advanceRound` (existing — minor additive guards)

**Location**: `lib/match/roundEngine.ts`

**Signature** (unchanged):

```ts
export async function advanceRound(matchId: string): Promise<{
  status: "waiting" | "advanced" | "completed" | "not_advancing";
  // ... existing return shape
}>;
```

**Behaviour changes**:

The combined-scoring path is unchanged in semantics. The only modification is **adding the idempotency guarantee in writing** — that is, asserting in a comment + a sanity test that `executeScoringPipeline` wipes `word_score_entries` for the round before inserting, so fast-path rows are correctly superseded. No new SQL.

There is no functional change in `advanceRound` itself; the existing CAS on `rounds.state` (step 9.5) and the existing delete-then-insert in `executeScoringPipeline` together provide the correctness guarantees the fast path needs.

---

## 4. `publishRoundSummary` (existing — no change)

**Location**: `app/actions/match/publishRoundSummary.ts`

Unchanged. Continues to:
- Read `word_score_entries` rows for the round (which now may include rows written by the fast path and then wiped+rewritten by the combined path, but the read is at round completion and sees the canonical set).
- Aggregate via `aggregateRoundSummary` and broadcast a `RoundSummary`.
- Persist `scoreboard_snapshots` (still exactly once per round, with combined totals).

---

## 5. `loadMatchState` (existing — additive `partialSummary` hydration)

**Location**: `lib/match/stateLoader.ts`

**Signature** (unchanged):

```ts
export async function loadMatchState(
  client: AnyClient,
  matchId: string,
): Promise<MatchState | null>;
```

**Behaviour changes**:

Add a parallel fetch (alongside the existing parallel block at line 353) that derives `partialSummary` when:

- `round.state === 'collecting'` AND
- at least one `word_score_entries` row exists for `round.id` AND
- all such rows share a single `player_id` (the first mover — confirms fast-path rows haven't been superseded by combined-path rows yet)

If so, build a `PartialRoundSummary` per data-model.md § 5 and attach to the returned `MatchState`. Otherwise leave it `undefined`.

**Why parallel**: keeps the existing 3-way `Promise.all` extension to 4-way; no added latency for clients that already poll this endpoint.

**Performance**: one additional `SELECT * FROM word_score_entries WHERE round_id = ?` per call. The table is indexed on `round_id` (FK); the read is sub-millisecond.

---

## 6. No new public Server Action surface

This feature does **not** add:

- new Server Actions
- new `/app/api/*` routes
- new client-callable RPCs
- new Supabase functions or database functions
- new Realtime channels

All client→server contracts are unchanged. The only new server-internal function (`instantScoreFirstSubmission`) is never reachable from the client.
