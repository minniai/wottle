# Phase 0 Research: Instant Scoring Reveal for First Player

**Branch**: `042-instant-scoring-reveal` | **Date**: 2026-06-09 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This document captures the design decisions that resolve every NEEDS-CLARIFICATION-style unknown in Technical Context before Phase 1 begins. The spec's three `[NEEDS CLARIFICATION]` markers were already resolved in `/speckit.clarify` (recorded in `spec.md` § Clarifications); this file resolves the remaining *implementation* unknowns surfaced while writing the plan.

---

## Decision 1 — Where to invoke the fast path from `submitMove`

**Decision**: Invoke `instantScoreFirstSubmission(matchId)` from inside `submitMove`'s existing `after()` hook, *before* the existing `advanceRound(matchId)` call. Wrap both in independent try/catch so an instant-scoring failure cannot block `advanceRound`. The fast path takes `matchId` only (not `submissionId`) and resolves the first submission from the DB itself — see [contracts/server-actions.md § 2](contracts/server-actions.md) for the signature rationale.

**Rationale**:

- `submitMove` already uses `next/server`'s `after()` hook to run post-response work at full Vercel CPU priority (see `app/actions/match/submitMove.ts:181–214`). The fast path belongs in the same hook because it does work that is logically post-response.
- The response to `submitMove` must stay fast (it returns the optimistic swapped board for the submitting client). Doing fast-path scoring synchronously would make the submit endpoint slower than today's RTT budget.
- Putting it *before* `advanceRound` makes the two calls a clean sequence: if both submissions are present (FR-007 race window), instant scoring no-ops in <5 ms (one COUNT(*) query) and `advanceRound` immediately runs the combined path.
- Independent try/catch ensures FR-011: a failure in instant scoring does not poison the combined-path advancement queued in the same `after()` hook.

**Alternatives considered**:

- *Synchronous in `submitMove`'s response path*: rejected — would push p95 submit latency above the 200 ms move-RTT SLA (Constitution Principle II) for every submission, not just the first.
- *Postgres trigger on `move_submissions` insert*: rejected — Wottle's pattern is Server Actions for orchestration; pushing scoring into a DB trigger fights the Server-Authoritative principle's organisational layer (logic in `/lib/match`, not in SQL) and would make the scoring pipeline impossible to debug without DB access.
- *Separate Server Action invoked from the client after submit*: rejected — adds a client round-trip and creates a window where a malicious client could choose not to call it, violating server-authoritative principle.

---

## Decision 2 — Race-window guard (FR-007)

**Decision**: Open `instantScoreFirstSubmission` with a single `SELECT count(*) FROM move_submissions WHERE round_id = $1 AND status = 'pending'`. If the result is ≥ 2, log `instant-scoring.deferred-to-combined` and return without doing any scoring work. Otherwise proceed.

**Rationale**:

- The Clarifications Q1 answer is "defer instant scoring whenever the second submission is already present when the server begins processing the first." The cleanest server-side reading of "begins processing" is "as the first DB roundtrip the fast path makes."
- `move_submissions` has an existing index on `round_id` (it's the FK); the count is a sub-millisecond lookup.
- We cannot use `pendingSubmissions.length` from `advanceRound`'s fetch because the fast path runs in parallel with the second player's `submitMove` and `advanceRound`. Reading freshly here is the correct atomicity boundary.
- We use `status = 'pending'` (the status `submitMove` writes on insert) to avoid counting timeout-pass synthesised rows or already-accepted rows from concurrent advanceRound calls.

**Alternatives considered**:

- *Postgres advisory lock around the fast path*: rejected — adds DB load, blocks the second player's submit on the first player's scoring, and the lossy "first to acquire the lock wins" semantic doesn't match the spec's "first by `submittedAt`" semantic.
- *Check on Realtime presence of pending broadcast*: rejected — Realtime is best-effort and a race-detector built on it would be inherently lossy.
- *Optimistic write + rollback if collision detected*: rejected — would create transient `word_score_entries` rows that other code paths (polling fallback, observability queries) might observe.

---

## Decision 3 — Idempotency under fast-path + combined-path interleaving

**Decision**: Reuse the existing `executeScoringPipeline` invariant: *delete prior `word_score_entries` for the round before insert*. The combined path on the second submission re-runs the full pipeline against the combined board; this naturally discards any rows the fast path wrote and re-derives them against the combined post-swap state. Frozen-tile updates use the existing `update_frozen_tiles_if_unchanged` RPC (optimistic lock).

**Rationale**:

- `app/actions/match/publishRoundSummary.ts:413–423` already deletes prior word-score entries by `round_id` before inserting, originally to guard against the `#177` duplicate-broadcast regression. This is exactly the invariant we need.
- Frozen tiles use a CAS RPC (`update_frozen_tiles_if_unchanged`) that returns 0 rows affected when stale (`publishRoundSummary.ts:230–257`). The fast path uses this RPC too. If the combined path tries to write its merged freezes and the fast-path's update is in the way, the RPC's existing fallback (reload current value, plain update) takes over.
- The combined path re-scoring is *semantically correct* even when the fast path already ran, because the combined board includes both swaps and may produce a different (typically additional) set of scored words. Re-deriving from the combined board is the correct thing to do — it's not "wasted work," it's the canonical pass.
- `scoreboard_snapshots` is *not* written by the fast path. That's the responsibility of `publishRoundSummary` at round completion (`recordScoreSnapshot`). Skipping it on the fast path is correct: scoreboard snapshots are per-round-completion artefacts that need both players' final scores.

**Alternatives considered**:

- *Mark fast-path rows with an `is_partial` flag and merge*: rejected — adds a schema migration and a code path complexity that the existing delete-then-insert already handles.
- *Skip the combined path's scoring step entirely when fast-path rows exist*: rejected — the combined board may produce different words because of cross-axis interactions between the two swaps. Re-running on the combined board is the only correct semantic.

---

## Decision 4 — Broadcast shape: extend `MatchState` vs new event type

**Decision**: Extend the existing `MatchState` interface with a new optional field `partialSummary?: PartialRoundSummary`. Continue using the existing `match:${matchId}` channel's `state` event. Do not introduce a new event name or a new channel topic.

**Rationale**:

- The existing `state` broadcast already carries everything a client needs to render: board, timers, scores, `lastSummary`, `frozenTiles`, `pendingMoves` (added with `#210`). Adding `partialSummary` follows the established additive pattern.
- A new event type would force clients to handle two parallel broadcast paths and reconcile their ordering. A single event whose payload may include partial data is simpler and matches how `pendingMoves` works today.
- `loadMatchState` already derives every field of `MatchState` from the database. We extend it to derive `partialSummary` from `word_score_entries` + `matches.frozen_tiles` when the round is still `collecting` — that gives polling clients identical hydration with zero extra realtime work.
- The deduplication concern (don't re-animate when `lastSummary` arrives with the same words) is handled the same way `animatedOpponentMoveKeysRef` handles it for `pendingMoves`: stash a stable key (e.g. `${playerId}-${earliestSubmittedAt}`) and skip if already animated.

**Alternatives considered**:

- *New `partial-summary` event type on the existing channel*: rejected — duplicates the realtime+polling reconciliation problem that `MatchState`'s single-event design exists to solve.
- *New `match:${matchId}:partial` channel topic*: rejected — doubles the Realtime subscription count per match, and the polling fallback would still have to read the same DB state.
- *Reuse `lastSummary` directly with a marker bit*: rejected — `lastSummary` semantics today mean "the most recent *completed* round"; overloading it would break post-game replay code that reads `lastSummary` from completed matches.

**Payload size**: A typical first-mover scored set is 1–4 words (most rounds 0–2). At ~4 coordinates per word + word string + score breakdown, a partial summary is <500 bytes. Negligible against the existing `MatchState` size (board grid alone is ~600 bytes serialised).

---

## Decision 5 — Polling fallback hydration

**Decision**: In `loadMatchState`, when `round.state === 'collecting'` AND there are `word_score_entries` rows for the current round AND `matches.frozen_tiles` has more entries than were present at round start, derive `partialSummary` from those rows. Otherwise omit the field.

**Rationale**:

- Polling fallback (FR-002, 2 s interval) means a client on polling sees the same state as a realtime client within one poll cycle. The DB is the canonical source.
- `word_score_entries` is the authoritative store; the fast path writes there. So polling clients read the same rows the realtime broadcast would carry.
- We compute "more frozen tiles than at round start" by comparing against the rounds.board_snapshot_before's implied frozen state (frozen tiles are stored on the *match*, not per-round, but their count at round start is recoverable: it's the size of `matches.frozen_tiles` minus the words found in `word_score_entries` for the current round). Even simpler: just check whether any `word_score_entries` rows exist for the current round-id; if yes, the fast path has fired, derive the partial summary from them.
- This means: a client that subscribes mid-match (e.g. opens the tab after the first player has already submitted) sees the partial reveal as soon as it loads, with no extra logic.

**Alternatives considered**:

- *Don't hydrate `partialSummary` from DB, rely on realtime only*: rejected — would create a class of bugs where polling-only clients (e.g. spotty wifi) see the freezes but not the partial summary words, leading to "where did those frozen tiles come from?" UX.
- *Persist `partialSummary` as a JSONB column on `rounds`*: rejected — pure denormalisation; the constituent data already lives in `word_score_entries`.

---

## Decision 6 — Failure mode for instant scoring (FR-011)

**Decision**: Wrap `instantScoreFirstSubmission`'s body in a try/catch and a 500 ms timer. On either error or timeout: log `instant-scoring.failed` with `{matchId, submissionId, reason}`, do *not* publish a partial state, do *not* leave any `word_score_entries` rows in place (the existing delete-then-insert flow handles this naturally if the failure is mid-insert), and return silently. The combined `advanceRound` in the same `after()` hook then runs the canonical combined path on the second submission and clients see the round through that path as if instant scoring had never happened.

**Rationale**:

- The fast path is an optimisation. If it fails, the existing combined path is a *complete* fallback — clients see the round end with all scores together exactly as they do today. This matches FR-011's "without leaving the clients in a half-revealed state."
- 500 ms is generous: the constitution's word-validation budget is 50 ms p95; even a dictionary cold-load adds ≤2 s (per AGENTS.md) but that only happens once per process lifetime. 500 ms catches pathological cases without false positives.
- Not publishing on failure means there's no "phantom" partial state on the wire. Clients only ever see consistent state.

**Alternatives considered**:

- *Retry instant scoring with `withRetry` like `computeWordScoresForRound`*: rejected — adds latency that may push past the second player's submission, making the fast path moot. The retry semantics of `computeWordScoresForRound` exist for the *terminal* scoring pass; for the fast path, failing fast and falling through is the correct trade.
- *Surface the failure to the second player's UI*: rejected — the second player is meant to see the round resolve normally on failure; surfacing instant-scoring failures would leak implementation detail and confuse players.

---

## Decision 7 — Clock semantics during the fast-path window (Q2 / FR-016)

**Decision**: No change to the timer state machine. The second player's clock continues to tick during the ≤200 ms fast-path window. This is already what Clarifications Q2 / FR-016 specify; this section confirms there is no implementation work needed beyond *not* introducing a pause primitive.

**Rationale**:

- `lib/match/clockEnforcer.ts` and `rounds.started_at`-driven server-authoritative timing (spec 007) are unchanged.
- The fast path runs in `submitMove`'s `after()` hook, *after* the submission has been written and *after* the response has been sent. The timer math is purely a function of `rounds.started_at` and `move_submissions.submitted_at`; the fast-path window does not influence either value.
- The constitution's <200 ms move-RTT SLA bounds the worst-case "unfair" time at 200 ms p95, which matches the existing model's tolerance for network jitter.

**Alternatives considered**: All three pause-strategy variants from Clarifications Q2 were considered and rejected during the clarify session.

---

## Decision 8 — Auto-deselect feedback (Q3 / FR-017)

**Decision**: `BoardGrid.tsx` maintains the "first tile of pending swap" in local React state. Add a `useEffect` that watches `props.frozenTiles`; when the pending tile becomes frozen, clear the local state and announce via an `aria-live="polite"` region. No toast component, no new animation, no new CSS class.

**Rationale**:

- The freeze visual is already shipped (spec 011: spec-011-board-ui-polish). It renders the tile in the freezing player's colour with the existing letterpress treatment.
- The selection ring is removed by clearing local React state, which is a 1-line change inside `BoardGrid`.
- An `aria-live="polite"` announcement is the established a11y pattern in this codebase (matches `MoveFeedback`, lobby invite announcements). Adding a single text string is the only new content.
- This matches Clarifications Q3 answer and FR-017 exactly.

**Alternatives considered**: All three feedback strategies from Clarifications Q3 were considered and rejected during the clarify session.

---

## Decision 9 — Performance instrumentation

**Decision**: Add two `performance.mark()` calls inside `instantScoreFirstSubmission`:

- `instant-scoring:start` — at function entry, after the race-window check passes
- `instant-scoring:broadcast` — after the publish succeeds (or after the 500 ms timeout)

Plus three structured log events via `lib/observability/log.ts`:

- `instant-scoring.fired` — `{matchId, roundNumber, playerId, wordCount, durationMs}`
- `instant-scoring.deferred-to-combined` — `{matchId, roundNumber, reason: "race-window"}`
- `instant-scoring.failed` — `{matchId, roundNumber, playerId, reason}`

**Rationale**:

- Matches the existing observability pattern (`trackRoundCompleted`, `logPlaytestError`).
- SC-005's "200 ms p95" claim needs a measurement to be enforceable; the `performance.mark()` pair provides that.
- The three log events let post-ship analytics answer "how often does the fast path fire?", "how often does the race-window deferral happen in practice?", "what is the failure rate?" — all of which inform whether the optimisation pays for itself.

**Alternatives considered**:

- *Send instant-scoring duration as a Realtime broadcast field*: rejected — leaks server timing to clients with no UX value.

---

## Decision 10 — Test surface coverage

**Decision**: The TDD test surface is enumerated below. Each test commits before the implementation that satisfies it (Constitution Principle VII).

Server unit tests (`tests/unit/match/`):

- `instantScoring.spec.ts` — happy path: one submission → calls scoring pipeline with one move → writes word entries → updates frozen tiles.
- `instantScoring.race-window.spec.ts` — FR-007: when two submissions exist at entry, the fast path returns without touching scoring.
- `instantScoring.zero-score.spec.ts` — FR-006: when the first submission scores nothing, no `word_score_entries` rows are written and no broadcast is queued.
- `instantScoring.failure.spec.ts` — FR-011: when `processRoundScoring` throws, the fast path logs and returns; `advanceRound` still works.
- `stateLoader.partialSummary.spec.ts` — Decision 5: polling fallback hydration from `word_score_entries`.

Server integration tests (`tests/integration/match/`):

- `instantScoring.broadcast.spec.ts` — end-to-end: submitMove → Realtime `state` event payload contains `partialSummary` with the expected words and freezes.
- `instantScoring.idempotency.spec.ts` — fast path runs, then combined path runs; assert no duplicate `word_score_entries` rows, assert `scoreboard_snapshots` has correct totals.

Playwright E2E (`tests/integration/ui/`):

- `instant-scoring-reveal.spec.ts` — User Story 1+2: dual-session, first browser submits scoring swap → second browser sees freezes before submitting.
- `instant-scoring-auto-deselect.spec.ts` — User Story 3 / FR-004 / FR-017: second browser taps a tile, first browser freezes that tile, second browser's selection clears and aria-live fires.
- `instant-scoring-no-score.spec.ts` — User Story 5: zero-score first swap produces no reveal beyond swap animation.

Performance (`tests/perf/`):

- `instant-scoring.yml` — Artillery scenario asserting reveal RTT <200 ms p95.

**Rationale**: Covers every FR with at least one test; covers every User Story acceptance scenario with at least one Playwright spec; covers every measurable SC with at least one performance check.

---

## Open items handed to `/speckit.tasks`

None. All design questions are resolved. `/speckit.tasks` can decompose the test files and implementation files listed in plan.md § Project Structure directly.
