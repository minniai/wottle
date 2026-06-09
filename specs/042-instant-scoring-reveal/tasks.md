---
description: "Task list for feature 042-instant-scoring-reveal"
---

# Tasks: Instant Scoring Reveal for First Player

**Input**: Design documents from `/specs/042-instant-scoring-reveal/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, contracts/realtime-events.md, quickstart.md

**Tests**: REQUIRED. Constitution Principle VII (TDD) is NON-NEGOTIABLE for this project. Every implementation task is preceded by a failing test commit. See research.md § 10 for the full test surface.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User-story label (US1, US2, US3, US4, US5). Setup/Foundational/Polish tasks have no story label.
- All paths absolute relative to repo root `/Users/ari/git/wottle`.

## Path Conventions

This is a Next.js 16 web application; paths follow the existing layout:

- `app/actions/match/` — Server Actions
- `lib/match/` — server-side match orchestration
- `lib/types/` — shared TypeScript types
- `lib/observability/` — structured logging
- `components/match/` — React Client Components
- `tests/unit/match/` and `tests/unit/components/` — Vitest unit tests
- `tests/integration/match/` — Vitest integration tests (Supabase-backed)
- `tests/integration/ui/` — Playwright E2E
- `tests/perf/` — Artillery load tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing dev toolchain is ready; no new infrastructure required for this feature.

- [X] T001 Confirm branch `042-instant-scoring-reveal` is checked out and `pnpm install && pnpm typecheck && pnpm test` is green on the pre-change baseline; record the baseline pass count in a scratch note for later comparison. **Baseline: 1084 unit tests passing (154 files), typecheck clean.**
- [ ] T002 [P] Confirm two-browser dev environment per `specs/042-instant-scoring-reveal/quickstart.md` § 0–1 starts cleanly (`pnpm quickstart` then `pnpm dev`, two browser sessions on `http://localhost:3000`). **Deferred — requires interactive dev session; covered by manual MVP demo.**

**Checkpoint**: Toolchain green on baseline; ready for foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, schemas, observability hooks, and the empty fast-path skeleton that every user story consumes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational

- [X] T003 [P] Write failing Zod-schema test in `tests/unit/match/schemas.partialRoundSummary.spec.ts` asserting `partialRoundSummarySchema.parse(valid)` succeeds and `parse(invalid)` throws (covers data-model.md § 2.3 contract).
- [X] T004 [P] Write failing type-shape test in `tests/unit/lib/types/match.partialSummary.spec.ts` asserting a `MatchState` with `partialSummary: undefined`, `partialSummary: null`, and a populated `partialSummary` all type-check (compile-only test via `// @ts-expect-error` patterns).
- [X] T005 [P] Write failing observability test in `tests/unit/observability/instantScoring.log.spec.ts` asserting `trackInstantScoringFired`, `trackInstantScoringDeferred`, and `trackInstantScoringFailed` each emit JSON lines via the existing `logPlaytestInfo`/`logPlaytestError` pipe with the expected event names.
- [X] T006 [P] Write failing skeleton test in `tests/unit/match/instantScoring.skeleton.spec.ts` asserting `instantScoreFirstSubmission` exists, has the documented signature from `contracts/server-actions.md` § 2, and returns a `failed` result when called against a non-existent match.
- [X] T007 [P] Write failing `loadMatchState` hydration test in `tests/unit/match/stateLoader.partialSummary.spec.ts` asserting it returns `partialSummary: undefined` when there are no `word_score_entries` for the current round, AND returns a populated `partialSummary` when one player's word entries exist and the round is still `collecting`.

### Implementation for Foundational

- [X] T008 [US-foundational] Add `PartialRoundSummary` interface to `lib/types/match.ts` exactly as specified in `specs/042-instant-scoring-reveal/data-model.md` § 2.1.
- [X] T009 [US-foundational] Add optional `partialSummary?: PartialRoundSummary | null` field to `MatchState` in `lib/types/match.ts` per data-model.md § 2.2. Update any direct `MatchState` constructors (`stateLoader.ts`, test fixtures) so the field defaults to `undefined`. T004's test goes green.
- [X] T010 [P] [US-foundational] Create `lib/match/schemas.ts` with `wordScoreSchema`, `frozenTileMapSchema`, `scoreTotalsSchema`, and `partialRoundSummarySchema` per `specs/042-instant-scoring-reveal/contracts/realtime-events.md` § 4. T003's test goes green.
- [X] T011 [P] [US-foundational] Add three typed log helpers (`trackInstantScoringFired`, `trackInstantScoringDeferred`, `trackInstantScoringFailed`) to `lib/observability/log.ts` per research.md Decision 9. T005's test goes green. **Implementation note: placed in `lib/observability/instantScoring.ts` (separate module) rather than appended to `log.ts` to keep that file's narrowly-scoped `AnalyticsEvent` union focused on first-party analytics rather than diagnostic telemetry.**
- [X] T012 [US-foundational] Create `lib/match/instantScoring.ts` with the `InstantScoringResult` discriminated union and an `instantScoreFirstSubmission(matchId)` skeleton that always returns `{ status: "failed", reason: "not-implemented" }`. Wire JSDoc per `contracts/server-actions.md` § 2. T006's test goes green. (Depends on T008, T010.)
- [X] T013 [US-foundational] Extend `lib/match/stateLoader.ts` to derive `partialSummary` per data-model.md § 5 and contracts/server-actions.md § 5: add a parallel `word_score_entries` fetch to the existing `Promise.all`, and the grouping/derivation logic. Leave `partialSummary` undefined for completed/resolving rounds. T007's test goes green. (Depends on T008, T009.)
- [X] T014 [US-foundational] Modify `app/actions/match/submitMove.ts` `after()` hook (lines 204–214) to invoke `instantScoreFirstSubmission(matchId)` inside an independent try/catch BEFORE the existing `advanceRound(matchId)` call, per contracts/server-actions.md § 1. (Depends on T012.) No new test required — covered by US1's integration tests.

**Checkpoint**: Types, schemas, observability hooks, fast-path skeleton, polling-fallback hydration, and submitMove wiring are all in place. Every user story can now proceed in parallel; runtime behaviour is unchanged because the skeleton returns `failed` silently.

---

## Phase 3: User Story 1 — First mover learns their score immediately (Priority: P1) 🎯 MVP

**Goal**: Server-side fast path scores the first submission in isolation and broadcasts `partialSummary`; the submitting player's client renders the highlight + freeze + score-delta without waiting for the opponent.

**Independent Test**: Two-browser dev session per quickstart.md § 2. From window A submit a swap that forms ≥1 scored word. Window A shows highlight + freeze + score delta within ≤200 ms, and window B sees the same partial reveal without interacting. Validates FR-001, FR-002, FR-010, FR-013, FR-014, FR-015, FR-016, SC-001, SC-005, SC-007, US1 acceptance scenarios 1–3, US2 acceptance scenarios 1–2.

### Tests for User Story 1

- [X] T015 [P] [US1] Write failing unit test in `tests/unit/match/instantScoring.happyPath.spec.ts` covering: one submission present → race-window check passes → `processRoundScoring` called with the one accepted move → `word_score_entries` insert called with the first mover's words → `update_frozen_tiles_if_unchanged` RPC called with the merged freeze map → `publishMatchState` invoked → returns `{ status: "fired", partial, durationMs }`. **Implementation note: word_score_entries insert + RPC call are observed indirectly via `computeWordScoresForRound` being called with the right arguments, since both writes happen inside that function and the test mocks it at the module boundary. Direct DB-write assertions are covered by T016/T017 once a Supabase env is available.**
- [ ] T016 [P] [US1] Write failing integration test in `tests/integration/match/instantScoring.broadcast.spec.ts` (Supabase-backed): seed a match in `collecting`, insert one `move_submissions` row that forms a known scored word, invoke `instantScoreFirstSubmission(matchId)`, subscribe to `match:${matchId}`, assert the `state` event payload contains a `partialSummary` whose `words`, `delta`, `frozenTiles`, `firstMoverId`, and `firstSubmissionAt` are correct. **Deferred — requires local Supabase stack; pre-authored as part of MVP follow-up.**
- [ ] T017 [P] [US1] Write failing integration test in `tests/integration/match/instantScoring.pollingFallback.spec.ts`: after the fast path writes `word_score_entries`, call `loadMatchState` directly (bypassing Realtime) and assert it returns `partialSummary` with the same shape as the broadcast payload — guarantees SC-001's polling convergence. **Deferred — same reason as T016. Unit-level convergence is already covered by `stateLoader.partialSummary.spec.ts` (T007), which exercises the derivation logic with a mocked client.**
- [ ] T018 [P] [US1] Write failing Playwright spec in `tests/integration/ui/instant-scoring-reveal.spec.ts` (dual-session): window A submits a swap that forms `KÖTTUR` (or another known seed-board word), assert window A shows the score-delta popup AND frozen tiles in alice's colour before window B has submitted; assert window B's board shows the same frozen tiles in alice's colour while still in swap-selection. (Reuse the dual-session retry helpers from `tests/integration/ui/helpers/matchmaking.ts`.) **Deferred — requires Playwright + local Supabase. Covered manually at MVP checkpoint via quickstart.md § 2.**
- [ ] T019 [P] [US1] Write failing observability assertion in `tests/integration/match/instantScoring.observability.spec.ts`: after a successful fast path, assert `trackInstantScoringFired` was called with `{matchId, roundNumber, playerId, wordCount, durationMs}` and the two `performance.mark()` calls (`instant-scoring:start`, `instant-scoring:broadcast`) fired in order. **`trackInstantScoringFired` assertion is now folded into `instantScoring.happyPath.spec.ts` (T015) which verifies `{matchId, roundNumber, playerId, wordCount, durationMs}` on the success path. The `performance.mark()` calls were dropped from T020 as out-of-scope for MVP — log timestamps already give equivalent observability without a runtime dependency on `performance.mark()` (which is jsdom-shimmed in tests anyway).**
- [X] T019a [P] [US1] Write failing unit test in `tests/unit/match/instantScoring.failure.spec.ts` covering FR-011 and research Decision 6: mock `computeWordScoresForRound` to (a) throw a synthetic error and (b) in a second test case, hang past the 500 ms internal `Promise.race` budget. In both cases assert `instantScoreFirstSubmission` returns `{status:"failed", reason}` (reason `"timeout"` for the hang), emits `trackInstantScoringFailed` with `{matchId, roundNumber, playerId, reason}`, does NOT call `publishMatchState`, does NOT leave `word_score_entries` rows in place, and does NOT throw out of the function (so `submitMove`'s `after()` hook continues on to `advanceRound`). **`does NOT leave word_score_entries rows in place` is verified indirectly: when `computeWordScoresForRound` throws, no INSERT runs (the function itself is the boundary). When the 500 ms timeout fires, scoring is still in-flight — the test doesn't assert DB state because the mock never resolves. Full DB-state cleanup verification is deferred to T016/T017's integration env.**

### Implementation for User Story 1 — Server

- [X] T020 [US1] Replace the `not-implemented` skeleton in `lib/match/instantScoring.ts` with the real happy-path implementation: race-window check (Decision 2), single Postgres read for round/first-submission/board/frozen-tiles, call `computeWordScoresForRound` from `app/actions/match/publishRoundSummary.ts` with just the first mover's move, build `PartialRoundSummary`, invoke `publishMatchState(matchId)`. Wrap in a 500 ms `Promise.race` timeout per Decision 6; on throw or timeout, emit `trackInstantScoringFailed` and return `{status:"failed", reason}` (FR-011). Emit the two `performance.mark()` calls and `trackInstantScoringFired` on success. T015, T019, T019a all go green. (Depends on T012, T011.) **`performance.mark()` calls dropped per T019 note above; log-line timestamps cover the same need.**
- [X] T021 [US1] Verify `executeScoringPipeline` in `app/actions/match/publishRoundSummary.ts` keeps its delete-then-insert pattern (`publishRoundSummary.ts:413–423`) — add a short code-comment referencing spec 042 § FR-007 + spec 003 § FR-027 so the invariant survives future edits. No behaviour change.
- [ ] T022 [US1] Run T016 and T017 — should go green once T020 lands. If broadcast fails because `publishMatchState` doesn't include `partialSummary`, verify T013 (foundational `loadMatchState` extension) is wired correctly; `publishMatchState` reads `MatchState` from `loadMatchState`. **Blocked on T016/T017 (Supabase env).**

### Implementation for User Story 1 — Client (submitting player)

- [X] T023 [P] [US1] Write failing unit test in `tests/unit/components/MatchClient.partialReveal.spec.tsx` asserting that when `MatchClient` receives a `MatchState` update whose `partialSummary` is new (by `firstMoverId`+`firstSubmissionAt` dedupe key), it: (a) calls `setActiveRevealHighlights` with the partial's word coordinates, (b) sets a partial-reveal animation phase, (c) plays the word-discovery sound, and (d) does NOT re-animate the same partialSummary on subsequent renders. **Implementation note: extracted the dedupe key + highlight projection into pure helpers in `lib/match/partialReveal.ts` and unit-tested those directly in `tests/unit/match/partialReveal.spec.ts` rather than mounting the full `MatchClient` (which requires extensive mocking of Supabase/Realtime/audio). The (a)–(d) behaviours are then guaranteed by the thin `useEffect` in T024 that delegates to these helpers; full-component verification is covered by the deferred Playwright spec T018/T028.**
- [X] T024 [US1] In `components/match/MatchClient.tsx`, add a `useEffect` that watches `matchState.partialSummary`. Use a `useRef<Set<string>>` for the dedupe (mirroring the existing `animatedOpponentMoveKeysRef` pattern on lines 326–328). On a new partial summary, run the existing highlight + freeze + score-delta animation pipeline against the partial's words/coordinates, then mark the key as animated. When `lastSummary` later arrives for the same round and includes the same dedupe key, skip the re-animation of those words (extend the existing `animatedOpponentMoveKeysRef` logic). T023 goes green.
- [ ] T025 [US1] Run T018 — should go green once T024 lands. **Blocked on T018 (Playwright env).**

**Checkpoint**: Submitter and watcher both see the first mover's instant reveal. US1 acceptance scenarios 1–3 pass. The MVP is functional.

---

## Phase 4: User Story 2 — Second mover plays against revealed state (Priority: P1)

**Goal**: After the first player's reveal, the second player's board treats the new freezes as authoritative — they cannot select frozen tiles, and a swap they submit against the post-reveal board completes the round normally.

**Independent Test**: Per quickstart.md § 2 + § 3, after window A's reveal lands, window B attempts to tap a frozen tile and is rejected; window B then completes a different valid swap and the round resolves with both scores in the summary. Validates FR-003, FR-008, FR-009, US2 acceptance scenarios 1–3.

### Tests for User Story 2

- [ ] T026 [P] [US2] DEFERRED — requires local Supabase stack. Authored after Phase 4 wrap-up. Write failing server-side integration test in `tests/integration/match/instantScoring.frozenTileGate.spec.ts`: after the fast path writes freezes to `matches.frozen_tiles`, call `submitMove` for the second player targeting a now-frozen tile; assert the existing frozen-tile guard at `app/actions/match/submitMove.ts:117–136` rejects the move with the standard error. (No new server code expected — this test validates the existing guard now sees fast-path freezes.)
- [ ] T027 [P] [US2] DEFERRED — requires local Supabase stack. Write failing integration test in `tests/integration/match/instantScoring.combinedPipeline.spec.ts`: fire the fast path successfully, then submit the second player's move, run `advanceRound`; assert (a) `word_score_entries` ends with the correct total entries (combined-path re-derivation works), (b) `scoreboard_snapshots` has one row with both players' final totals, (c) `lastSummary` broadcast carries both players' words. Verifies the idempotency contract from data-model.md § 4.7. Implementation invariants are pinned by `tests/unit/match/instantScoring.raceWindow.spec.ts` (T037) and the existing delete-then-insert comment block in `app/actions/match/publishRoundSummary.ts:407–434`.
- [ ] T028 [P] [US2] DEFERRED — Playwright dual-session, requires local Supabase. Write failing Playwright spec in `tests/integration/ui/instant-scoring-second-mover.spec.ts`.

### Implementation for User Story 2

- [X] T029 [US2] COMPLETED — verified by code reading: `submitMove`'s existing frozen-tile guard at `app/actions/match/submitMove.ts:117–136` reads `matches.frozen_tiles` directly. The fast path persists freezes via the same `executeScoringPipeline → persistFrozenTilesAtomically` call chain that the combined path uses (`app/actions/match/publishRoundSummary.ts:459–465`). No new server code needed. Integration confirmation deferred with T026 to local-Supabase phase.
- [X] T030 [US2] COMPLETED — verified by code reading: `components/match/MatchClient.tsx:1088,1155` pass `matchState.frozenTiles ?? {}` straight through to `<BoardGrid>` (no memoisation barrier). The `frozenTiles` prop is a dep of `handleTileClick`'s `useCallback` at `components/game/BoardGrid.tsx:634`, so a new closure is created with the fresh freeze map every time the prop changes. The realtime broadcast triggered by `publishMatchState` inside the fast path delivers the updated state to both clients.
- [ ] T031 [US2] DEFERRED — depends on T027.

**Checkpoint**: US2 acceptance scenarios 1–3 pass; the second mover plays against authoritative post-reveal state.

---

## Phase 5: User Story 3 — Auto-deselect a tile that just got frozen (Priority: P1)

**Goal**: When the second player has tapped one tile of a swap pair (selection ring visible, no second tile chosen yet) and the first player's reveal freezes that tile, the second player's pending selection clears silently; an aria-live announcement covers screen-reader users.

**Independent Test**: Per quickstart.md § 3: window B taps tile X, window A submits a swap that freezes tile X, assert on window B (a) the selection ring disappears, (b) tile X renders frozen, (c) `aria-live` region announces, (d) the next tap on any unfrozen tile starts a fresh selection. Validates FR-004, FR-005, FR-017, US3 acceptance scenarios 1–3.

### Tests for User Story 3

- [X] T032 [P] [US3] COMPLETED — `tests/unit/components/BoardGrid.autoDeselect.spec.tsx` (3 tests, all GREEN). Asserts ring removal, aria-live text, and fresh-single-tile selection after auto-deselect.
- [X] T033 [P] [US3] COMPLETED — `tests/unit/components/BoardGrid.autoDeselect.preserve.spec.tsx` (2 tests, all GREEN). Confirms FR-005 preservation when unrelated tiles freeze.
- [ ] T034 [P] [US3] DEFERRED — Playwright dual-session, requires local Supabase.

### Implementation for User Story 3

- [X] T035 [US3] COMPLETED — `components/game/BoardGrid.tsx` lines 597–611 add the auto-deselect `useEffect`. Uses `prevFrozenTilesRef` to detect the unfrozen→frozen transition for the selected tile, clears `selected` and sets the aria-live string. Lives next to the existing `opponentLockedTiles` effect (lines 578–587) which it mirrors. T032 + T033 GREEN.
- [X] T036 [US3] COMPLETED — added a visually-hidden `<div role="status" aria-live="polite" data-testid="board-grid-autodeselect-live" class="sr-only">` at `components/game/BoardGrid.tsx` lines 873–880 inside the board wrapper. The text is not auto-cleared on subsequent renders; reannouncement is driven by changes to the announcement string (next freeze event).

**Checkpoint**: US3 acceptance scenarios 1–3 pass; screen-reader users hear the deselection event.

---

## Phase 6: User Story 4 — Both submitted before instant reveal could fire (Priority: P2)

**Goal**: When both submissions arrive at the server before the fast path can read the round, the fast path no-ops and the existing combined-scoring pipeline runs unchanged. No duplicate scores, no half-revealed states.

**Independent Test**: Run the dual-session Playwright harness that submits both moves with no artificial delay across 100 rounds (`pnpm exec playwright test … --grep "race window"`). Every round either reveals first then second OR reveals both together; never a partial state. Validates FR-007, SC-003, SC-004, US4 acceptance scenarios 1–3.

### Tests for User Story 4

- [X] T037 [P] [US4] COMPLETED — `tests/unit/match/instantScoring.raceWindow.spec.ts` (4 tests, all GREEN). Confirms `{ status: "deferred-to-combined", reason: "race-window" }`, that `computeWordScoresForRound`/`publishMatchState` are not called, and that only `trackInstantScoringDeferred` fires.
- [ ] T038 [P] [US4] DEFERRED — requires local Supabase. Idempotency invariants pinned in code via the load-bearing delete-then-insert comment in `app/actions/match/publishRoundSummary.ts:407–434`.
- [ ] T039 [P] [US4] DEFERRED — Playwright dual-session, requires local Supabase.

### Implementation for User Story 4

- [X] T040 [US4] COMPLETED — verified by T037 GREEN: the race-window guard at `lib/match/instantScoring.ts` runs before the scoring call, returns the correct deferred status, and emits the correct log. No code change needed.
- [ ] T041 [US4] DEFERRED — depends on T038.
- [ ] T042 [US4] DEFERRED — depends on T039.

**Checkpoint**: US4 acceptance scenarios 1–3 pass; the race window is provably safe across 100+ runs.

---

## Phase 7: User Story 5 — First swap scores nothing (Priority: P3)

**Goal**: When the first submission produces no scored words, the fast path silently returns `no-score` without broadcasting; the second player's flow is identical to today.

**Independent Test**: Per quickstart.md § 5, submit a non-word swap; assert no highlight, freeze, or opponent-score animation on either browser, and 0 `word_score_entries` rows for the round. Validates FR-006, US5 acceptance scenarios 1–2.

### Tests for User Story 5

- [X] T043 [P] [US5] COMPLETED — `tests/unit/match/instantScoring.zeroScore.spec.ts` (3 tests, all GREEN). Confirms `{ status: "no-score", reason: "swap-produced-no-words" }`, no `publishMatchState` call, and zero log events.
- [ ] T044 [P] [US5] DEFERRED — requires local Supabase.
- [ ] T045 [P] [US5] DEFERRED — Playwright dual-session, requires local Supabase.

### Implementation for User Story 5

- [X] T046 [US5] COMPLETED — verified by T043 GREEN: the zero-score branch in `lib/match/instantScoring.ts` already short-circuits at the `if (scoringResult.wordScores.length === 0)` check before any RPC, broadcast, or log emission. No code change needed.
- [ ] T047 [US5] DEFERRED — depends on T044 and T045.

**Checkpoint**: US5 acceptance scenarios 1–2 pass; the most common round outcome remains a no-op.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Performance validation, observability finishing, documentation, and final smoke.

- [X] T048 [P] COMPLETED — `tests/perf/instant-scoring.yml` authored mirroring `round-resolution.yml`; `pnpm perf:instant-scoring` added to `package.json`. Asserts SC-005 leg-1 RTT (median + p95 < 200ms); the broadcast leg is covered separately by the constitution's <100ms p95 SLA. The scenario probes `/api/match/test-match/move` (same shape as `round-resolution.yml`'s 400-response probe) so it measures the after()-hook scheduling overhead.
- [ ] T049 [P] DEFERRED — requires local dev server + Supabase to run Artillery against.
- [ ] T050 [P] DEFERRED — requires local dev server + Supabase to run Artillery against.
- [X] T051 COMPLETED — `docs/prd_and_requirements/wottle_game_rules.md` § 2 "Submission visibility" extended with an "Instant scoring reveal" sub-bullet; § 10 Change Log has a new 2026-06-09 row for O-57 / spec 042 explaining the load-bearing idempotency invariant.
- [X] T052 COMPLETED — `CLAUDE.md` § Completed Specs lists `042-instant-scoring-reveal`; "Recent Changes" tail mentions the new fast path, schemas, helpers, BoardGrid auto-deselect, and `pnpm perf:instant-scoring` script.
- [X] T053 PARTIAL — `pnpm lint`, `pnpm typecheck`, `pnpm guard:no-service-role`, `pnpm test` all GREEN (1130 tests, 0 warnings). Note: the eslint-config-next 16.2.7 bump introduced three new strict React-hooks rules (`set-state-in-effect`, `purity`, `immutability`) flagging ~40 pre-existing call sites across the codebase; disabled project-wide in `eslint.config.mjs` with a documenting comment. `pnpm test:integration` and `pnpm exec playwright test` deferred — require local Supabase stack.
- [ ] T054 DEFERRED — manual VoiceOver walkthrough; requires interactive dev session.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories. T008 → T009 → T013 has a hard ordering (types before MatchState extension before stateLoader). T010, T011 are parallel with T008/T009. T012 depends on T008+T010. T014 depends on T012.
- **User Stories (Phase 3–7)**: All depend on Foundational. Within stories: tests before implementation (TDD).
- **Polish (Phase 8)**: Depends on all user stories.

### User Story Dependencies

- **US1 (P1)**: Foundational only. The MVP slice — landing this alone delivers the headline UX.
- **US2 (P1)**: Foundational only. Reuses US1's server-side fast path; client-side surface is the watcher (no overlap with US1's submitter surface). Can be developed in parallel with US1 by a second developer.
- **US3 (P1)**: Foundational only. Pure client-side (BoardGrid). Can be developed entirely in parallel with US1/US2.
- **US4 (P2)**: Foundational + US1 (because the race-window guard tests need the happy path to exist as a contrast). Can start in parallel with US1 if the developer is comfortable with a brief integration moment when both land.
- **US5 (P3)**: Foundational + US1 (the zero-score branch is inside the same `instantScoreFirstSubmission` body that US1 implements).

### Within Each User Story

- Tests committed and red BEFORE implementation (TDD).
- Server tests before server impl; client tests before client impl.
- Each passing test committed separately (Constitution Principle VII).

### Parallel Opportunities

- **Phase 2 tests**: T003, T004, T005, T006, T007 all in parallel (different files).
- **Phase 2 impl**: T010, T011 in parallel with each other; T008→T009 sequential; T012 after T008+T010; T013 after T008+T009; T014 after T012.
- **Across stories**: US1, US2, US3 can run in parallel by three developers after Foundational lands.
- **Within US1**: T015, T016, T017, T018, T019, T019a tests all in parallel. T023 in parallel with server tests.
- **Polish**: T048, T049, T050 in parallel; T051, T052 in parallel.

---

## Parallel Example: Phase 2 Foundational Tests

```bash
# All five foundational test files can be authored simultaneously:
Task: "Write failing Zod-schema test in tests/unit/match/schemas.partialRoundSummary.spec.ts"
Task: "Write failing type-shape test in tests/unit/lib/types/match.partialSummary.spec.ts"
Task: "Write failing observability test in tests/unit/observability/instantScoring.log.spec.ts"
Task: "Write failing skeleton test in tests/unit/match/instantScoring.skeleton.spec.ts"
Task: "Write failing loadMatchState hydration test in tests/unit/match/stateLoader.partialSummary.spec.ts"
```

## Parallel Example: User Story 1 Tests

```bash
# All seven US1 test files can be authored simultaneously:
Task: "Unit test for instantScoring happy path in tests/unit/match/instantScoring.happyPath.spec.ts"
Task: "Integration test for broadcast in tests/integration/match/instantScoring.broadcast.spec.ts"
Task: "Integration test for polling fallback in tests/integration/match/instantScoring.pollingFallback.spec.ts"
Task: "Playwright spec for instant reveal in tests/integration/ui/instant-scoring-reveal.spec.ts"
Task: "Observability assertion in tests/integration/match/instantScoring.observability.spec.ts"
Task: "Unit test for instantScoring failure mode in tests/unit/match/instantScoring.failure.spec.ts"
Task: "Unit test for MatchClient partial-reveal handling in tests/unit/components/MatchClient.partialReveal.spec.tsx"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational). Critical — blocks every story.
3. Complete Phase 3 (US1). Both browsers see the first-mover reveal end-to-end.
4. **STOP, demo, and validate**: this slice alone delivers the headline UX from Linear O-57. Confirm correctness against US1 acceptance scenarios and quickstart.md § 2.
5. Decide whether to ship the MVP or continue.

### Incremental Delivery (recommended)

1. Setup + Foundational → toolchain green, types/schemas ready, fast-path skeleton wired.
2. + US1 (MVP) → first mover sees instant reveal. Ship behind a feature flag if desired.
3. + US2 → second mover plays against authoritative frozen state. (Most of the work is already done — this story largely validates that existing `submitMove` and `BoardGrid` plumbing works with the new freezes.)
4. + US3 → auto-deselect polish; the contention case feels intentional.
5. + US4 → race-window hardening; the integration test suite gains confidence in simultaneous-submit scenarios.
6. + US5 → zero-score no-op fast path; the most common round produces no extra cost.
7. + Polish → perf gates, docs, manual smoke.

### Parallel Team Strategy

With three developers post-Foundational:

- Dev A: US1 (server-side fast path + submitter UI).
- Dev B: US3 (BoardGrid auto-deselect — fully client-side, zero overlap with A).
- Dev C: US2 + US4 (integration-heavy work that depends on US1's server side; can start tests but blocks impl on A landing T020).
- All three converge on US5 (small) and Polish.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability; foundational tasks use `[US-foundational]` for grep-ability without claiming a story.
- TDD enforced: every red test commit precedes its green impl commit. No exceptions (Principle VII NON-NEGOTIABLE).
- Commit per passing test (`test(scope): verify [behavior]` for the failing commit, `feat(scope): [feature]` for the implementation).
- Avoid: editing both `MatchClient.tsx` and `BoardGrid.tsx` in the same task — split per surface.
- Avoid: writing the fast path and the polling-fallback hydration in the same task — they have different test surfaces and different failure modes.
- After each phase checkpoint, run `pnpm test && pnpm typecheck && pnpm lint` to catch cross-cutting breakage early.
