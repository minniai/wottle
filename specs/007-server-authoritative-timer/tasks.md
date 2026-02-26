# Tasks: Server-Authoritative Timer and Frozen-Tile Tiebreaker

**Input**: Design documents from `/specs/007-server-authoritative-timer/`
**Branch**: `007-server-authoritative-timer`
**Total tasks**: 25

**Context**: Most timer enforcement infrastructure was built in spec 006 (clock gate in `submitMove`, timeout synthesis and deduction in `roundEngine`, `clockEnforcer` pure functions, `stateLoader` hydration, `GameChrome` countdown). This spec closes three remaining gaps identified in `research.md`:
- `MatchEndedReason` type uses `"time_expiry"` but DB constraint requires `"timeout"` (silent DB write failure)
- `computeFrozenTileCountByPlayer` incorrectly counts `"both"` tiles for both players (clarification Q2: exclude them)
- `determineMatchWinner` uses score only — no frozen-tile tiebreaker (FR-004, FR-006)

**Format**: `[ID] [P?] [Story?] Description with file path`
- **[P]**: Can run in parallel (different files, no pending dependencies)
- **[Story]**: Maps to user story from spec.md

---

## Phase 1: Setup

No new infrastructure needed — all Supabase tables, columns, and indexes are in place.

- [x] T001 Verify test suite baseline: run `pnpm test` and `pnpm typecheck` and confirm 0 failures before any changes in `package.json` context

---

## Phase 2: Foundational — Fix `MatchEndedReason` Type (Unblocks All Stories)

**Purpose**: `"time_expiry"` in TypeScript does not match DB constraint `"timeout"`. After this fix, TypeScript will surface all stale `"time_expiry"` usages as compile errors, which must be resolved before any story work.

**⚠️ CRITICAL**: Complete this phase before implementing any user story. The type fix produces compile errors that must be resolved in US2 and US3 phases.

- [x] T002 Write failing type-assertion test: add file `tests/unit/lib/types/matchEndedReason.test.ts` asserting `"timeout"` is assignable to `MatchEndedReason` and `"time_expiry"` is not (use `expectTypeOf` from vitest)
- [x] T003 Fix `MatchEndedReason` in `lib/types/match.ts`: rename `"time_expiry"` → `"timeout"`, remove `"error"` (not in DB constraint)
- [x] T004 [P] Update `app/actions/match/submitMove.ts`: change `completeMatchInternal(matchId, "time_expiry")` → `completeMatchInternal(matchId, "timeout")` at the clock-expiry trigger (lines ~85–86)
- [x] T005 [P] Update `components/match/FinalSummary.tsx`: change `reasonLabel` switch case from `"time_expiry"` → `"timeout"` and remove `"error"` case; verify display string is "Time expired"
- [x] T006 Update existing integration test `tests/integration/match/clockEnforcement.spec.ts` T026c: change assertion from `ended_reason: "time_expiry"` → `ended_reason: "timeout"` to match DB constraint and corrected type

**Checkpoint**: `pnpm typecheck` passes with 0 errors. `pnpm test` passes with 0 failures.

---

## Phase 3: User Story 1 — Server Deducts Time on Round Resolution (Priority: P1)

**Goal**: Each player's stored remaining time is reduced by their elapsed time per round, persisted, and visible on the next round.

**Independent Test**: Submit two moves in a round; after resolution, assert that `matches.player_a_timer_ms` and `matches.player_b_timer_ms` have each decreased by the correct elapsed amount.

**Note**: Core implementation exists in `lib/match/roundEngine.ts` (lines 278–289, `deductTimerMs`). Tasks here add missing unit-test coverage required by the TDD constitution.

- [x] T007 [US1] Write unit tests for `deductTimerMs` helper in `tests/unit/lib/match/roundEngine.test.ts`: (a) deducts elapsed when submission exists, (b) clamps to 0 when elapsed > remaining, (c) returns unchanged timer when no submission provided
- [x] T008 [P] [US1] Write integration test in `tests/integration/match/timerDeduction.spec.ts`: create a round with known `started_at`, insert two submissions at known times, call `advanceRound`, assert both `player_a_timer_ms` and `player_b_timer_ms` in DB reflect correct deductions

**Story 1 checkpoint**: `pnpm test -- tests/unit/lib/match/roundEngine.test.ts` and `tests/integration/match/timerDeduction.spec.ts` both pass.

---

## Phase 4: User Story 2 — Move Rejected When Player Has No Time Left (Priority: P2)

**Goal**: Any move submission from a player with `remaining_time ≤ 0` is rejected with a clear error. Opponent can continue submitting.

**Independent Test**: Set a player's `player_a_timer_ms = 0` in DB; call `submitMove` as that player; assert response `{ status: "rejected", error: "Your time has expired" }`. Call `submitMove` as the other player; assert it is accepted.

**Note**: Clock gate exists in `app/actions/match/submitMove.ts` (lines 74–93). Auto-pass synthesis exists in `lib/match/roundEngine.ts` (lines 76–111, `maybeSynthesizeTimeoutPass`). Tasks here add missing unit-test coverage for auto-pass.

- [x] T009 [US2] Write unit tests for `maybySynthesizeTimeoutPass` in `tests/unit/lib/match/roundEngine.test.ts`: (a) returns original submissions when both players have submitted, (b) synthesizes a "timeout" submission for absent player when their clock is expired, (c) returns original submissions (waiting) when absent player still has time
- [x] T010 [P] [US2] Write integration test in `tests/integration/match/autoPass.spec.ts`: set Player A `timer_ms = 0`; call `submitMove` as Player B; call `advanceRound`; assert round resolved with Player A having a synthetic `status: "timeout"` submission and Player B's move applied normally

**Story 2 checkpoint**: T009 and T010 pass. Existing T026a and T026b in `clockEnforcement.spec.ts` continue to pass.

---

## Phase 5: User Story 3 — Match Ends on Time Expiry with Correct Winner (Priority: P3)

**Goal**: When a player's clock hits zero the match eventually completes with `ended_reason = "timeout"` (persisted to DB) and the winner determined by score (not yet tiebreaker — that is US4).

**Independent Test**: Play a match to completion by zeroing a player's timer; assert `matches.ended_reason = "timeout"` and `matches.winner_id` reflects the higher-scoring player (or `null` for draw when scores equal).

- [x] T011 [US3] Write integration test in `tests/integration/match/matchEndTimeout.spec.ts`: seed a match with Player A `timer_ms = 1`; trigger a round resolution; assert `matches.state = "completed"`, `matches.ended_reason = "timeout"`, `matches.winner_id` is correct player ID (higher score) or null (equal scores)
- [x] T012 [P] [US3] Write integration test in `tests/integration/match/matchEndRoundLimit.spec.ts`: complete all 10 rounds via `advanceRound`; assert `matches.ended_reason = "round_limit"`, `matches.state = "completed"`, `matches.winner_id` correct

**Story 3 checkpoint**: T011 and T012 pass. `matches.ended_reason` correctly stored in DB for both end conditions.

---

## Phase 6: User Story 4 — Frozen-Tile Tiebreaker at Match End (Priority: P4)

**Goal**: Equal-score matches are decided by exclusive frozen-tile count (`"both"` tiles excluded from both counts). `computeFrozenTileCountByPlayer` returns correct exclusive counts. `determineMatchWinner` applies the tiebreaker. `FinalSummary` displays correct counts.

**Independent Test**: Complete a match with equal scores; assert `winner_id` corresponds to the player with more exclusively-owned frozen tiles (or `null` if also equal). Verify FinalSummary receives the corrected counts.

### 6a — Fix `computeFrozenTileCountByPlayer`

- [x] T013 [US4] Write failing unit tests in `tests/unit/lib/match/matchSummary.test.ts`: assert `computeFrozenTileCountByPlayer` (a) counts `"player_a"` tiles only for playerA, (b) counts `"player_b"` tiles only for playerB, (c) does NOT count `"both"` tiles for either player, (d) returns `{ playerA: 0, playerB: 0 }` when map is empty
- [x] T014 [US4] Fix `lib/match/matchSummary.ts` `computeFrozenTileCountByPlayer`: remove `|| tile.owner === "both"` from both branches so only `tile.owner === "player_a"` increments playerA and only `tile.owner === "player_b"` increments playerB
- [x] T015 [P] [US4] Verify `app/match/[matchId]/summary/page.tsx` passes `frozenTileCounts` (from corrected `computeFrozenTileCountByPlayer`) correctly to `FinalSummary` props — no code change expected; confirm by reading the file

### 6b — Add Frozen-Tile Tiebreaker to Winner Determination

- [x] T016 [US4] Write failing unit tests in `tests/unit/lib/match/resultCalculator.test.ts` for `determineMatchWinner` covering all tiebreaker scenarios: (a) higher score wins regardless of frozen tiles, (b) equal scores + more frozen tiles for A → A wins, (c) equal scores + more frozen tiles for B → B wins, (d) equal scores + equal frozen tiles → draw (`winnerId = null`), (e) both scores 0 + both frozen 0 → draw
- [x] T017 [US4] Ensure `determineMatchWinner` is unit-testable: if it is a private local function inside `app/actions/match/completeMatch.ts`, extract it to `lib/match/resultCalculator.ts` and export it; update the import in `completeMatch.ts`
- [x] T018 [US4] Update `determineMatchWinner` signature in `lib/match/resultCalculator.ts` (or `completeMatch.ts`) to accept `frozenCounts: { playerA: number; playerB: number }` as second parameter
- [x] T019 [US4] Implement tiebreaker logic in `determineMatchWinner`: (1) higher score wins; (2) if scores equal, player with more exclusively-owned frozen tiles wins; (3) if still equal, `winnerId = null` (draw)
- [x] T020 [US4] Update `completeMatchInternal` in `app/actions/match/completeMatch.ts`: after `fetchLatestScores`, call `computeFrozenTileCountByPlayer((match.frozen_tiles as FrozenTileMap) ?? {})` and pass the result as second argument to `determineMatchWinner`
- [x] T021 [US4] Write integration test in `tests/integration/match/frozenTileTiebreaker.spec.ts`: seed a completed match with equal scores and Player A owning more exclusively-owned frozen tiles; call `completeMatchInternal`; assert `winner_id = playerAId` and not `null`
- [x] T022 [P] [US4] Write integration test in same file: seed equal scores and equal exclusively-owned frozen tiles (some `"both"` tiles present); call `completeMatchInternal`; assert `winner_id = null` (draw), confirming `"both"` tiles do not break the tie

**Story 4 checkpoint**: All T013–T022 tests pass. `pnpm typecheck` clean.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Run `pnpm lint` and fix any ESLint warnings introduced by type rename or function extraction; zero-warning policy must hold
- [ ] T024 [P] Run `pnpm typecheck`; confirm 0 errors across entire project after all changes
- [ ] T025 Run full test suite `pnpm test && pnpm test:integration`; confirm ≥ 310 tests pass with 0 failures and no regressions

---

## Dependencies

```text
T001 (baseline)
  └── T002 (type test) → T003 (fix type)
        ├── T004 (submitMove callsite)  [parallel with T005]
        ├── T005 (FinalSummary label)   [parallel with T004]
        └── T006 (update T026c test)
              ├── T007 (deductTimerMs unit tests) [US1]
              │     └── T008 (integration: timer deduction) [parallel with T009]
              ├── T009 (autoPass unit tests) [US2]
              │     └── T010 (integration: auto-pass) [parallel with T008]
              ├── T011 (integration: timeout ended_reason) [US3, parallel with T012]
              ├── T012 (integration: round_limit ended_reason) [US3, parallel with T011]
              ├── T013 (failing unit tests: exclusive count) [US4]
              │     └── T014 (fix computeFrozenTileCountByPlayer)
              │           └── T015 (verify summary page wiring) [parallel with T016]
              └── T016 (failing unit tests: tiebreaker) [US4]
                    └── T017 (extract determineMatchWinner if needed)
                          └── T018 (update signature)
                                └── T019 (implement tiebreaker)
                                      └── T020 (wire frozenCounts into completeMatchInternal)
                                            ├── T021 (integration: tiebreaker winner)
                                            └── T022 (integration: "both" tiles neutral) [parallel with T021]
T023, T024, T025 (polish — after all above)
```

## Parallel Execution Examples

**Phase 2 (after T003)**: T004 and T005 can run simultaneously (different files).

**Phase 3 + Phase 4 Setup**: T007 (deductTimerMs tests) and T009 (autoPass tests) can run simultaneously (different test files, no shared state).

**Phase 5**: T011 and T012 can run simultaneously (different integration test files).

**Phase 6, final integration**: T021 and T022 can run simultaneously (same file, different test cases — merge into one commit).

**Phase 7**: T023 and T024 can run simultaneously (lint vs. typecheck).

## Implementation Strategy

**MVP (minimum to unblock playtesting)**:
- Complete Phase 2 (type fix) + T011/T012 (match completion reason) = matches now correctly record `ended_reason` in DB
- Total: T001–T006, T011, T012 = 8 tasks

**Full delivery**:
- All 25 tasks — adds unit test coverage for existing logic + frozen-tile tiebreaker

**Suggested approach**: Complete phases in order. Phase 2 is the only true blocker; after it, Phases 3–5 and the Phase 6a block (T013–T015) can proceed in parallel on separate branches if desired.
