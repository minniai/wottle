# Tasks: Match Completion

**Input**: Design documents from `/specs/006-match-completion/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Included — TDD is non-negotiable per constitution Principle VII. Write failing test first, then implement.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: User story this task belongs to (US1, US2, US3)
- Paths are relative to repository root `/Users/ari/git/wottle/`

---

## Phase 1: Setup

**Purpose**: Create the migration file and apply it. No implementation work starts until Phase 2 is complete.

- [x] T001 Create migration file `supabase/migrations/20260225001_match_completion.sql`: add `rounds.started_at timestamptz` column with backfill from `created_at` and a descriptive COMMENT per data-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core changes that MUST be complete before any user story work begins.

**⚠️ CRITICAL**: US1, US2, and US3 all depend on this phase.

- [x] T002 Apply migration and verify schema: run `pnpm supabase:migrate` then `pnpm supabase:verify` to confirm `rounds.started_at` column exists
- [x] T003 Run test baseline: run `pnpm test:unit` and confirm all existing tests pass on this branch before any changes
- [x] T004 [P] Update `lib/types/match.ts`: add `ClockCheckResult` type (`{ allowed: true } | { allowed: false; remainingMs: number }`); rename `"timeout"` to `"time_expiry"` in `MatchEndedReason`; find-and-replace all usages of `"timeout"` reason value across the codebase

**Checkpoint**: Schema applied, types updated, baseline green — user story work can begin.

---

## Phase 3: User Story 1 — Match Ends After 10 Rounds (Priority: P1) 🎯 MVP

**Goal**: Verify the existing 10-round limit is correct, harden the server-side rejection of moves on a completed match, and confirm the client navigates to the game-over screen.

**Independent Test**: Run `pnpm test:unit -- lib/match/roundEngine` and `pnpm test:unit -- app/actions/match/submitMove` — both must confirm 10-round limit and completed-match rejection.

> **TDD**: Write each failing test BEFORE the implementation task that follows it.

### Tests

- [x] T005 [US1] Write failing unit test in `tests/unit/match/roundEngine.spec.ts`: `advanceRound()` transitions `matches.state` to `"completed"` and calls `completeMatchInternal("round_limit")` when `nextRound > 10`
- [x] T007 [US1] Write failing unit test in `tests/unit/match/submitMove.spec.ts`: `submitMove()` returns `{ status: "rejected", error: "Match has ended" }` when `match.state === "completed"`
- [x] T009 [US1] Write failing integration test in `tests/integration/match/matchCompletion.spec.ts`: full 10-round match — submit 10 moves per player, assert match state becomes `"completed"` and an 11th submission is rejected
- [x] T010 [US1] Write unit test in `tests/unit/components/MatchClient.spec.tsx`: `MatchClient` calls `router.push("/match/[id]/summary")` when received `matchState.state === "completed"`

### Implementation

- [x] T006 [US1] Verify T005 passes against existing `lib/match/roundEngine.ts` (round-limit check at `isGameOver = nextRound > 10` should already be green — fix if not)
- [x] T008 [US1] Add completed-match guard to `app/actions/match/submitMove.ts`: after session check, reject with `{ status: "rejected", error: "Match has ended" }` if `match.state !== "in_progress"`

**Checkpoint**: User Story 1 fully functional — 10-round limit enforced, post-game navigation wired. Can deploy and playtest a bounded match.

---

## Phase 4: User Story 2 — Clock Enforcement & Timeout (Priority: P2)

**Goal**: Replace the client-only timer display with server-authoritative clock enforcement. Submissions after clock expiry are rejected. When one player's clock expires mid-round, the round resolves with their move treated as a pass. Both-clocks-expired ends the match.

**Independent Test**: Run `pnpm test:unit -- lib/match/clockEnforcer` and `pnpm test:integration -- tests/integration/match/clockEnforcement` — clock expiry rejects move, opponent can continue, match ends correctly.

> **TDD**: Write each failing test BEFORE the implementation task that follows it.

### Tests — Clock Enforcer (Pure Functions)

- [ ] T011 [US2] Write failing unit tests in `tests/unit/match/clockEnforcer.spec.ts` covering: `computeRemainingMs` returns correct ms from `roundStartedAt` and `storedRemainingMs`; `isClockExpired` returns true when remaining ≤ 0; `computeElapsedMs` returns correct difference; injectable `now` parameter enables deterministic tests

### Implementation — Clock Enforcer

- [ ] T012 [US2] Create `lib/match/clockEnforcer.ts` with three pure functions: `computeRemainingMs(roundStartedAt, storedRemainingMs, now?)`, `isClockExpired(roundStartedAt, storedRemainingMs, now?)`, `computeElapsedMs(roundStartedAt, submittedAt)` — all ≤20 lines each, no side effects

### Tests — Round Engine: started_at

- [ ] T013 [US2] Write failing unit test in `tests/unit/match/roundEngine.spec.ts`: `createNextRound()` inserts a `rounds` row with `started_at` set to the current server timestamp (non-null)

### Implementation — Round Engine: started_at

- [ ] T014 [US2] Update `lib/match/roundEngine.ts` `createNextRound()`: include `started_at: new Date()` in the `rounds` INSERT statement

### Tests — submitMove Clock Gate

- [ ] T015 [US2] Write failing unit test in `tests/unit/match/submitMove.spec.ts`: `submitMove()` returns `{ status: "rejected", error: "Your time has expired" }` when `isClockExpired(round.started_at, player_x_timer_ms)` returns true

### Implementation — submitMove Clock Gate

- [ ] T016 [US2] Add clock expiry gate to `app/actions/match/submitMove.ts`: after completed-match guard (T008), load `round.started_at`, load `player_x_timer_ms` from match record, call `isClockExpired()`, reject if expired — no new DB query (round already fetched for frozen-tile check)

### Tests — Timeout-Pass Synthesis

- [ ] T017 [US2] Write failing unit test in `tests/unit/match/roundEngine.spec.ts`: `advanceRound()` with 1 existing submission inserts a synthetic `move_submissions` row with `status = "timeout"` when the absent player's `isClockExpired()` returns true, then proceeds to resolution

### Implementation — Timeout-Pass Synthesis

- [ ] T018 [US2] Update `lib/match/roundEngine.ts` `advanceRound()`: if `submissions.length === 1` and `round.started_at` is set, compute absent player's remaining time; if expired, insert synthetic submission `{ player_id: absentPlayerId, status: "timeout", from_x: -1, from_y: -1, to_x: -1, to_y: -1, submitted_at: now() }`
- [ ] T019 [US2] Update `lib/match/conflictResolver.ts`: skip submissions with `status === "timeout"` in conflict resolution (no tile coordinates to lock; treated as a pass)

### Tests — Timer Deduction

- [ ] T020 [US2] Write failing unit test in `tests/unit/match/roundEngine.spec.ts`: after `advanceRound()` resolves, `matches.player_a_timer_ms` and `matches.player_b_timer_ms` are each reduced by the player's elapsed time for that round (computed via `computeElapsedMs`)

### Implementation — Timer Deduction

- [ ] T021 [US2] Update `lib/match/roundEngine.ts`: after round resolves, for each submission compute `elapsed = computeElapsedMs(round.started_at, submission.submitted_at)`; update `matches.player_a_timer_ms` and `matches.player_b_timer_ms` by deducting elapsed (clamped to 0); include in the existing match UPDATE statement

### Tests — stateLoader Mid-Round Computation

- [ ] T022 [US2] Write failing unit test in `tests/unit/match/stateLoader.spec.ts`: when round state is `"collecting"` and `round.started_at` is set, `loadMatchState()` returns `timers.playerA.remainingMs = computeRemainingMs(round.started_at, stored_timer_ms)` (not the static stored value)

### Implementation — stateLoader Mid-Round Computation

- [ ] T023 [US2] Update `lib/match/stateLoader.ts`: when loading timer state and round is in `"collecting"` state with a valid `started_at`, call `computeRemainingMs()` for each player instead of reading `player_x_timer_ms` directly

### Tests — Both-Clocks-Expired Completion

- [ ] T024 [US2] Write failing unit test in `tests/unit/match/roundEngine.spec.ts`: when both players' computed remaining time is ≤ 0, `advanceRound()` calls `completeMatch(matchId, "time_expiry")` and transitions match to `"completed"` with `ended_reason = "time_expiry"`

### Implementation — Both-Clocks-Expired Completion

- [ ] T025 [US2] Update `app/actions/match/submitMove.ts` and `lib/match/stateLoader.ts`: after computing remaining time for both players, if both ≤ 0 call `completeMatch(matchId, "time_expiry")` and return `{ status: "rejected", error: "Match has ended" }`

### Integration Test

- [ ] T026 [US2] Write failing integration test in `tests/integration/match/clockEnforcement.spec.ts` covering: (a) submission rejected when player's computed clock ≤ 0, (b) opponent's submission accepted when only one player's clock expired, (c) round resolves and scores correctly with timeout-pass for expired player, (d) match ends with `ended_reason = "time_expiry"` when both clocks expire

**Checkpoint**: User Story 2 fully functional — server-authoritative clock enforced end-to-end. Can independently playtest with time pressure.

---

## Phase 5: User Story 3 — Post-Game Victory Screen (Priority: P3)

**Goal**: Extend the existing game-over screen to show each player's frozen tile count and top-scoring words, providing richer match closure.

**Independent Test**: Complete a match, navigate to `/match/[id]/summary`, verify frozen tile counts and top-5 words per player are displayed correctly.

> **TDD**: Write each failing test BEFORE the implementation task that follows it.

### Tests — Frozen Tile Helper

- [ ] T027 [P] [US3] Write failing unit test in `tests/unit/match/matchSummary.spec.ts`: `computeFrozenTileCountByPlayer()` returns correct counts for `"player_a"`, `"player_b"`, and `"both"` entries in `FrozenTileMap`

### Implementation — Frozen Tile Helper

- [ ] T028 [P] [US3] Create `lib/match/matchSummary.ts` with `computeFrozenTileCountByPlayer(frozenTiles: FrozenTileMap): { playerA: number; playerB: number }` — counts entries where `owner === "player_a"` or `"both"` toward playerA, and `"player_b"` or `"both"` toward playerB

### Implementation — Summary Page Data

- [ ] T029 [US3] Update `app/match/[matchId]/summary/page.tsx`: (a) call `computeFrozenTileCountByPlayer(match.frozen_tiles)` to derive counts, (b) query `word_score_entries` for `is_duplicate = false` ordered by `total_points DESC`, slice top 5 per player; pass both as new props to `FinalSummary`

### Implementation — FinalSummary Component

- [ ] T030 [US3] Update `components/match/FinalSummary.tsx`: extend `PlayerSummary` interface with `frozenTileCount: number`; render frozen tile count in each player's score card (label: "Frozen tiles")
- [ ] T031 [US3] Update `components/match/FinalSummary.tsx`: add `topWords: TopWord[]` (where `TopWord = { word: string; totalPoints: number; lettersPoints: number; bonusPoints: number }`) to each player's section; render top-scoring words list; type `TopWord` defined in `lib/types/match.ts`

### Tests — Component and Integration

- [ ] T032 [US3] Write unit test in `tests/unit/components/FinalSummary.spec.tsx`: component renders frozen tile count and top words for each player given valid props
- [ ] T033 [US3] Write integration test in `tests/integration/match/matchSummary.spec.ts`: summary page returns `frozenTileCount` matching `matches.frozen_tiles` and `topWords` matching the top-5 non-duplicate entries in `word_score_entries`

**Checkpoint**: All three user stories functional. Complete playtestable game: bounded match, time pressure, rich game-over screen.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation, minor cleanups, and performance confirmation.

- [ ] T034 Write full E2E test in `tests/integration/ui/match-completion.spec.ts`: two-player match played to round 10; game-over screen displays winner declaration, frozen tile counts, and top words; both players click "Return to Lobby" and land on lobby page
- [ ] T035 [P] Remove incorrect disconnect-timer-pause behavior in `app/actions/match/handleDisconnect.ts`: remove or guard the `pauseMatchTimers()` call so that timer `status: "paused"` is only set when a player submits their move (not on disconnect); clock authority now rests in `round.started_at`
- [ ] T036 [P] Run `pnpm perf:round-resolution` and confirm move RTT remains <200ms p95 with the new clock check in submitMove; document result
- [ ] T037 [P] Run `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit` — resolve all warnings; confirm zero lint errors and all tests green

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational) — BLOCKS all user stories
        ├─► Phase 3 (US1) — can start immediately after Phase 2
        ├─► Phase 4 (US2) — depends on Phase 2; T014 (started_at) is a prerequisite for T016+
        └─► Phase 5 (US3) — depends on Phase 2 only; independent of US1 and US2
              └─► Phase 6 (Polish) — depends on all desired stories being complete
```

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only. No dependencies on US2 or US3.
- **US2 (P2)**: Depends on Foundational only. Internally sequential (clockEnforcer → started_at → gate → synthesis → deduction → stateLoader → both-expired).
- **US3 (P3)**: Depends on Foundational only. Fully parallel with US1 and US2.

### Within Phase 4 (US2): Internal Order

```
T011/T012 (clockEnforcer)
  └─► T013/T014 (started_at on rounds)
        └─► T015/T016 (submitMove gate)
              └─► T017/T018/T019 (timeout-pass synthesis)
                    └─► T020/T021 (timer deduction)
                          └─► T022/T023 (stateLoader computation)
                                └─► T024/T025 (both-clocks-expired)
                                      └─► T026 (integration test)
```

### Parallel Opportunities

- T004 (types update) and T003 (baseline test run) can run in parallel after T002
- T027/T028 (frozen tile helper) can run in parallel with any US2 tasks since they touch different files
- All Polish tasks (T034–T037) can run in parallel

---

## Parallel Example: User Story 2

```bash
# Step 1 — Run in parallel (different files, no deps):
Task: "Write clockEnforcer unit tests (T011)"
Task: "Update lib/types/match.ts ClockCheckResult type (T004)"

# Step 2 — Sequential within US2:
Task: "Implement clockEnforcer.ts (T012)"
Task: "Write started_at unit test (T013)"
Task: "Update roundEngine createNextRound (T014)"
# ... continue in order T015 → T016 → T017 → T018 ...
```

## Parallel Example: User Story 3 (runs alongside any US2 task)

```bash
# Can start any time after Phase 2 — fully independent:
Task: "Write computeFrozenTileCountByPlayer test (T027)"
Task: "Implement computeFrozenTileCountByPlayer (T028)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: US1 (T005–T010)
4. **STOP and VALIDATE**: Run `pnpm test:unit`, `pnpm test:integration -- matchCompletion`, confirm 10-round limit and navigation work
5. Game is now a complete, bounded experience — ready for playtest

### Incremental Delivery

1. Setup + Foundational → baseline green
2. US1 (T005–T010) → bounded match → validate independently → deploy
3. US2 (T011–T026) → time pressure → validate independently → deploy
4. US3 (T027–T033) → rich game-over screen → validate independently → deploy
5. Polish (T034–T037) → E2E + performance validation → final deploy

### Single Developer Strategy

Work sequentially through phases. Phase 3 → Phase 4 → Phase 5 → Phase 6. Commit after each passing test (TDD: test commit, then implementation commit).

---

## Notes

- `[P]` tasks = different files, no unresolved dependencies — safe to parallelize
- `[Story]` label maps each task to its user story for traceability
- TDD: every test task (T005, T007, T009, etc.) MUST fail before its corresponding implementation task
- Commit format: `test(match): verify [behavior]` for test commits; `feat(match): [feature]` for implementation commits
- Migration backfill (T001): `started_at` null for old completed matches is acceptable; enforcement only applies to new rounds
- `MatchEndedReason` rename (T004): search for `"timeout"` as a reason string across `lib/`, `app/`, `tests/` — update all usages
