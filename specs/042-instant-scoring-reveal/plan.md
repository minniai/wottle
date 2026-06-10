# Implementation Plan: Instant Scoring Reveal for First Player

**Branch**: `042-instant-scoring-reveal` | **Date**: 2026-06-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/042-instant-scoring-reveal/spec.md`

## Summary

Today the round-resolution pipeline (`lib/match/roundEngine.ts → advanceRound`) only fires when `move_submissions.length === 2`; scoring, freezing, and broadcasting all wait for the second submission. This feature adds a **first-mover fast path** that scores the first submission in isolation and broadcasts the resulting words and frozen tiles to both clients while the second player is still choosing — *unless* the second submission is already present, in which case the existing combined pipeline runs unchanged (Clarifications Q1 → FR-007).

Server-side, the fast path is a new function `instantScoreFirstSubmission(matchId)` invoked from `submitMove`'s existing `after()` hook before falling through to `advanceRound`. It takes `matchId` only and resolves the first submission from the DB itself (see [contracts/server-actions.md § 2](contracts/server-actions.md) for the signature rationale — passing `submissionId` would be brittle under the `submitMove` ↔ fast-path race). It uses the same `processRoundScoring` pipeline as combined scoring, but for a single accepted move; it persists `word_score_entries` and updates `matches.frozen_tiles` via the existing `update_frozen_tiles_if_unchanged` RPC. State delivery reuses the existing `match:${matchId}` Realtime channel (no new topic) by extending `MatchState` with a new optional `partialSummary` field, and the existing polling fallback (`loadMatchState`) reads the partial state from the database so polling clients converge within one poll interval (FR-002).

Client-side, `MatchClient` and `BoardGrid` already know how to render frozen tiles and word highlights; the change is to consume `MatchState.partialSummary` and (a) play the highlight + freeze animations against the first-mover's tiles, (b) clear the second player's pending single-tile selection if it overlaps the new freezes (FR-004 → FR-017), and (c) suppress the duplicate highlight when the full round summary arrives later (mirroring the existing `animatedOpponentMoveKeysRef` pattern used for opponent-move-reveal #210).

No new tables, no new Realtime channels, no new Server Actions, no clock-pause primitive. Scoring formula, dictionary, per-letter coverage rule, same-axis standalone invariant, and the ≥24-unfrozen safeguard are all reused verbatim from `lib/game-engine/wordEngine.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router), Node 20.
**Primary Dependencies**: `@supabase/supabase-js` (Postgres + Realtime + RPC), existing `lib/game-engine/*` (dictionary, scanner, scorer, wordEngine), existing `lib/match/*` (state machine, conflict resolver, state publisher/loader), Zod for validation. No new runtime dependencies.
**Storage**: Supabase Postgres (PG 15+). No new tables. Existing tables touched: `matches.frozen_tiles` (JSONB, atomic update via existing `update_frozen_tiles_if_unchanged` RPC), `word_score_entries` (one row per scored word, written by `executeScoringPipeline` — partially populated by the fast path, completed by the combined path on the second submission), `move_submissions` (status transitions; one extra status read to detect race-window collision in FR-007).
**Testing**: Vitest (unit + integration), Playwright (E2E, dual-session two-browser harness), Artillery (performance — reuses `pnpm perf:round-resolution` to validate the instant-scoring leg adds no regression to combined-path RTT).
**Target Platform**: Web — Vercel-hosted Next.js (Server Actions on Node runtime, `after()` hook for post-response work), modern evergreen browsers, iOS Safari 16+, Android Chrome 110+.
**Project Type**: Web application (real-time competitive game).
**Performance Goals**: Reveal RTT < 200 ms p95 from "first submission accepted" to "reveal received on second player's client" (SC-005, matches constitution Principle II). Instant-scoring server compute ≤ 50 ms p95 (matches constitution's word-validation budget; the fast path scores one move, half the combined pipeline's work). Realtime broadcast remains best-effort with polling fallback within one ~2 s poll interval (FR-002, SC-001).
**Constraints**: No clock-pause primitive (FR-016). No new Realtime channel topic — extend the existing `match:${matchId}` `state` event payload. No client-side scoring (FR-013, Principle I — Server-Authoritative). Idempotency MUST be preserved: instant scoring writing `word_score_entries` and then the combined path running must not double-count rows — `executeScoringPipeline` already deletes prior entries per `round_id` before insert (`#177` regression guard); we extend that guarantee to be safe under the new fast-path/combined-path race. Frozen-tile updates use the existing `update_frozen_tiles_if_unchanged` RPC (optimistic locking), which protects against fast-path + combined-path racing to mutate `matches.frozen_tiles`.
**Scale/Scope**: Playtest scale today (~30 concurrent matches; `PLAYTEST_MAX_CONCURRENT_MATCHES = 20` by default). One additional Postgres roundtrip per round on the fast path (the existence check for the second submission). No fanout change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative Game Logic | ✅ Pass | All new scoring runs server-side in `instantScoreFirstSubmission` using the existing `processRoundScoring` pipeline. Clients never compute scores or freezes locally (FR-013). The fast path uses the same `submittedAt` comparator as the existing conflict resolver to identify "first" (FR-012). |
| II. Real-Time Performance | ✅ Pass | Reveal RTT target <200 ms p95 (SC-005) matches the move-RTT SLA. Instant-scoring server work is ≤50 ms p95 (one move instead of the combined pipeline's two). No new round-trip on the second player's submit path. Polling fallback preserved (FR-002, FR-011). |
| III. Type-Safe End-to-End | ✅ Pass | New `PartialRoundSummary` type added to `lib/types/match.ts` with Zod schema in `lib/match/schemas.ts`. `MatchState.partialSummary?: PartialRoundSummary` is the only `MatchState` surface change. `submitMove` return type unchanged. |
| IV. Progressive Enhancement & Mobile-First | ✅ Pass | UI is purely additive on `MatchClient` / `BoardGrid`; existing 44×44 touch targets, pinch-zoom, and frozen-tile visuals (spec 011) are reused. Auto-deselect (FR-017) is a CSS class state change + aria-live announcement, no new gesture. |
| V. Observability & Resilience | ✅ Pass | New structured log events `instant-scoring.fired`, `instant-scoring.deferred-to-combined`, `instant-scoring.failed` via `lib/observability/log.ts`. Fallback path on failure (FR-011) is the existing combined `advanceRound`. Performance marks `instant-scoring:start` and `instant-scoring:broadcast` on the server. |
| VI. Clean Code | ✅ Pass | New `lib/match/instantScoring.ts` keeps the fast path as a single-responsibility module (≤300 LOC target). Each function ≤20 lines, names verbs (`instantScoreFirstSubmission`, `hasSecondSubmissionArrived`, `mergePartialIntoSummary`). No boolean parameters; the race-window check is a query, not a flag. |
| VII. TDD | ✅ Pass | Every server function and component change ships with a failing test first. Test commits precede implementation commits. The race-window for FR-007 has a dedicated integration test that submits both moves with no artificial delay; the auto-deselect (FR-004/FR-017) has a Playwright spec that times two browsers to overlap selection. |
| VIII. External Context (Context7) | N/A | No new external library APIs are introduced; reuses Supabase JS v2 patterns already in use (`channel.send` for broadcast, `from().update().eq()` for conditional updates). |
| IX. Commit Standards | ✅ Pass | Conventional Commits; test commits precede impl commits; subject lines <80 chars. |

**Result**: All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/042-instant-scoring-reveal/
├── plan.md                       # This file
├── research.md                   # Phase 0 — invocation site, idempotency, broadcast shape
├── data-model.md                 # Phase 1 — state-machine deltas, in-memory types, no new tables
├── quickstart.md                 # Phase 1 — two-browser repro of the fast path and the race-window
├── contracts/
│   ├── server-actions.md         # `submitMove` (unchanged signature) + new internal `instantScoreFirstSubmission`
│   └── realtime-events.md        # `match:${matchId}` `state` event extended with `partialSummary`
├── checklists/
│   └── requirements.md           # From /speckit.specify (already passing post-clarify)
└── tasks.md                      # Phase 2 — /speckit.tasks (NOT created here)
```

### Source Code (repository root)

```text
lib/match/
├── instantScoring.ts                       # NEW — fast-path orchestrator (server-side)
├── instantScoring.test.ts                  # (unit tests live under tests/unit/match/)
├── roundEngine.ts                          # NO CHANGE — idempotency under fast-path + combined-path
│                                           # interleaving is provided by `executeScoringPipeline`'s
│                                           # existing delete-then-insert (#177 regression guard at
│                                           # publishRoundSummary.ts:413). See research Decision 3,
│                                           # contracts/server-actions.md § 3, and tasks T021
│                                           # (which only adds a code-comment, no behaviour change).
├── stateLoader.ts                          # MODIFY — populate `MatchState.partialSummary` from
│                                           # `word_score_entries` + `matches.frozen_tiles` when round is
│                                           # `collecting` and ≥1 word entry exists (polling-fallback support)
├── statePublisher.ts                       # NO CHANGE (publishes whatever loadMatchState returns)
└── revealSequence.ts                       # NO CHANGE (the partial summary is rendered separately)

app/actions/match/
├── submitMove.ts                           # MODIFY — after `move_submissions.insert`, invoke
│                                           # `instantScoreFirstSubmission(matchId)`
│                                           # inside the existing `after()` hook BEFORE `advanceRound`
│                                           # (instantScoring is a no-op when both subs already exist)
└── publishRoundSummary.ts                  # MODIFY — `executeScoringPipeline` already deletes prior
                                            # word_score_entries before insert; extend that guarantee
                                            # to cover the fast-path → combined-path handoff

lib/types/
└── match.ts                                # MODIFY — add `PartialRoundSummary` interface and
                                            # `MatchState.partialSummary?: PartialRoundSummary`

lib/match/
└── schemas.ts                              # MODIFY — Zod schema for PartialRoundSummary
                                            # (or add to existing match schemas file)

lib/observability/
└── log.ts                                  # MODIFY — register three new event names

components/match/
├── MatchClient.tsx                         # MODIFY — consume `matchState.partialSummary`, drive
│                                           # the partial reveal (swap-suppression dedupe key reused
│                                           # from animatedOpponentMoveKeysRef #210 pattern)
├── BoardGrid.tsx                           # MODIFY — auto-clear pending single-tile selection when
│                                           # the tile becomes frozen mid-selection (FR-004, FR-017)
└── PartialRevealOverlay.tsx                # (no new component required; reuse existing
                                            #  WordHighlightOverlay + frozen-tile classes)

components/match/
└── (no new component — partial reveal uses existing highlight overlay + frozen-tile CSS)

tests/unit/match/
├── instantScoring.spec.ts                  # NEW — pure fast-path logic, mocked Supabase
├── instantScoring.race-window.spec.ts      # NEW — FR-007 race-window guard
└── stateLoader.partialSummary.spec.ts      # NEW — polling fallback hydration

tests/integration/
├── match/
│   ├── instantScoring.broadcast.spec.ts    # NEW — end-to-end: submit one → Realtime payload
│   │                                       # contains partialSummary
│   └── instantScoring.idempotency.spec.ts  # NEW — fast-path + combined path do not double-count
└── ui/
    ├── instant-scoring-reveal.spec.ts      # NEW — Playwright dual-session: first mover sees freezes
    │                                       # before second mover submits
    ├── instant-scoring-auto-deselect.spec.ts  # NEW — Playwright dual-session: FR-004 / FR-017
    └── instant-scoring-no-score.spec.ts    # NEW — Playwright: first swap scores nothing → no reveal

tests/perf/
└── instant-scoring.yml                     # NEW — Artillery scenario: assert p95 reveal RTT <200 ms
                                            # (extends existing perf:round-resolution invariant)
```

**Structure Decision**: Existing Wottle layout — `lib/` for domain logic, `app/actions/` for Server Actions, `components/` for UI. The fast path is a new single-responsibility module (`lib/match/instantScoring.ts`) called from existing `submitMove`. No new top-level directories. UI changes are localised to two components (`MatchClient.tsx`, `BoardGrid.tsx`) that already own the surfaces being extended.

## Phase 0 Output

See [research.md](research.md). Key decisions:

1. **Trigger site** — invoke `instantScoreFirstSubmission` from inside `submitMove`'s existing `after()` hook, before `advanceRound`. Reason: keeps the response path fast and matches the existing post-response work pattern; the `after()` hook already keeps the Vercel function alive at full CPU (`submitMove.ts:204–214`).
2. **Race-window guard (FR-007)** — `instantScoreFirstSubmission` opens with a `SELECT COUNT(*) FROM move_submissions WHERE round_id = ? AND status = 'pending'`. If count ≥ 2, log `instant-scoring.deferred-to-combined` and return; `advanceRound` will do the combined path. This single read is the only added Postgres roundtrip in the happy path.
3. **Idempotency contract** — `executeScoringPipeline` already deletes prior `word_score_entries` rows for the round before insert (`#177` regression guard, `publishRoundSummary.ts:413`). The combined path on the second submission re-runs the whole pipeline on the combined board; if instant scoring already ran, those rows are deleted and re-derived against the combined board. Frozen tiles use the existing `update_frozen_tiles_if_unchanged` RPC (optimistic lock). The fast path does not write `scoreboard_snapshots` — that remains the combined path's responsibility, written once per round at completion.
4. **Broadcast shape** — extend `MatchState` with `partialSummary?: PartialRoundSummary`. The existing `state` event on `match:${matchId}` carries it. Clients diff: if `partialSummary` is present and its `submissionId` is new, apply the partial reveal. When the full `lastSummary` arrives, the `submissionId`-based dedupe key reuses the same pattern as `animatedOpponentMoveKeysRef` (PR #210) to suppress re-animation.
5. **Polling fallback hydration** — `loadMatchState` derives `partialSummary` from the database when `round.state === 'collecting'` AND `word_score_entries` rows exist for this round AND only one accepted move's worth of words are present. This means polling clients converge without a separate event.
6. **Failure mode (FR-011)** — if `instantScoreFirstSubmission` throws or exceeds a 5 s internal budget (revised from 500 ms for Linear O-71: the old budget was below a cold serverless dictionary load, so the fast path never fired in production), log `instant-scoring.failed`, do not publish a partial reveal, and let `advanceRound` (already queued in the same `after()` hook) do the combined path. A pre-write `rounds.state` recheck keeps a timed-out, detached run from overwriting an already-resolved round's entries. The fast-path never leaves clients in a half-revealed state because failure means we simply don't publish.
7. **Clock semantics (Clarifications Q2 / FR-016)** — no change. The fast path runs entirely inside the existing `after()` hook; the timer is server-authoritative and driven by `rounds.started_at` (spec 007). The second player's clock ticks down normally during the ≤200 ms reveal window. No pause primitive is added.
8. **Auto-deselect feedback (Clarifications Q3 / FR-017)** — `BoardGrid.tsx` maintains a single-tile pending selection in local state; when `props.frozenTiles` updates and includes the pending tile, the selection clears and an `aria-live="polite"` region announces "Opponent claimed your selected tile — pick another." No toast, no new animation.

## Phase 1 Output

See:

- [data-model.md](data-model.md) — `PartialRoundSummary` shape, `MatchState` delta, state-machine transitions, idempotency invariants.
- [contracts/server-actions.md](contracts/server-actions.md) — `submitMove` (unchanged public signature) and internal `instantScoreFirstSubmission` contract.
- [contracts/realtime-events.md](contracts/realtime-events.md) — extended `state` event payload, polling-fallback hydration rules.
- [quickstart.md](quickstart.md) — two-browser repro of the fast path and the race-window deferral, plus failure-mode rehearsal.

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative | ✅ Pass | Confirmed in data-model.md — every `partialSummary` field is derived server-side; client never authors scores or freezes. |
| II. Real-Time Performance | ✅ Pass | Confirmed in contracts/realtime-events.md — payload growth is bounded (1 player's words only; typical ≤4 words ≤20 coords). Broadcast SLA unchanged. |
| III. Type-Safe End-to-End | ✅ Pass | One new type (`PartialRoundSummary`), one optional field on `MatchState`, Zod schema for both. No `any`. |
| IV. Progressive Enhancement & Mobile-First | ✅ Pass | Confirmed — reuses existing frozen-tile and highlight visuals; aria-live announcement is the only new UI surface and is text-only. |
| V. Observability & Resilience | ✅ Pass | Three log events + two performance marks documented in research.md. Failure path is a silent no-op + fallback. |
| VI. Clean Code | ✅ Pass | Module-level structure verified in Project Structure; no module exceeds 300 LOC; functions are verbs; race-window check is a CQS-respecting query. |
| VII. TDD | ✅ Pass | Test file list in Project Structure shows test-first for every new function and integration. |
| VIII. External Context | N/A | No new external APIs. |
| IX. Commit Standards | ✅ Pass | Plan to commit each test green separately; conventional commit subjects <80 chars. |

**Result**: All gates still pass post-design. No new violations introduced by Phase 1.

## Complexity Tracking

> *No constitution violations — table intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | — | — |
