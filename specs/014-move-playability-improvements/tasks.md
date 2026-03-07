# Tasks: Move Playability Improvements

**Input**: Design documents from `/specs/014-move-playability-improvements/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per TDD mandate (Constitution VII). Red → Green → Refactor for each feature.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Type Extensions & Server-Side)

**Purpose**: Shared type extension and server-side data population needed by US2 (opponent move reveal). Also used for move lock coordinate tracking in US1.

- [x] T001 Add `RoundMove` interface and `moves` field to `RoundSummary` in `lib/types/match.ts` — `RoundMove { playerId: string; from: Coordinate; to: Coordinate }`, add `moves: RoundMove[]` to `RoundSummary`
- [x] T002 Write failing test: `aggregateRoundSummary` includes `moves` param in output in `tests/unit/lib/scoring/roundSummary.test.ts`
- [x] T003 Update `aggregateRoundSummary` in `lib/scoring/roundSummary.ts` to accept `moves: RoundMove[]` parameter and include it in the returned `RoundSummary`
- [x] T004 Write failing test: `publishRoundSummary` populates `moves` from `move_submissions` in `tests/unit/lib/scoring/roundSummary.test.ts`
- [x] T005 Update `publishRoundSummary` in `app/actions/match/publishRoundSummary.ts` to query `move_submissions` for accepted moves (`from_x, from_y, to_x, to_y, player_id`) and pass as `RoundMove[]` to `aggregateRoundSummary`

**Checkpoint**: `RoundSummary` broadcast now includes swap coordinates per player. All existing tests still pass.

---

## Phase 2: User Story 1 — Move Lock and Swap Visibility (Priority: P1) 🎯 MVP

**Goal**: After submitting a swap, tiles stay in place with orange highlight; board is locked until next round. Opponent sees paused timer only, not which tiles were swapped.

**Independent Test**: Submit a swap → tiles stay orange → board ignores further clicks → resets on new round.

### Tests for User Story 1

- [x] T006 [P] [US1] Write failing test: `moveLocked` state set to true and `lockedSwapTiles` populated after successful swap submission in `tests/unit/components/MatchClient.test.tsx`
- [x] T007 [P] [US1] Write failing test: BoardGrid ignores tile clicks when `disabled` prop is true in `tests/unit/components/BoardGrid.test.tsx`
- [x] T008 [P] [US1] Write failing test: tiles with `lockedTiles` coordinates render with `.board-grid__cell--locked` class in `tests/unit/components/BoardGrid.test.tsx`
- [x] T009 [US1] Write failing test: `moveLocked` resets to false and `lockedSwapTiles` clears when `matchState.currentRound` increments in `tests/unit/components/MatchClient.test.tsx`

### Implementation for User Story 1

- [x] T010 [P] [US1] Add `.board-grid__cell--locked` CSS class with orange background (`background: rgba(251, 146, 60, 0.7)`) in `app/styles/board.css`
- [x] T011 [US1] Add `moveLocked` boolean and `lockedSwapTiles: [Coordinate, Coordinate] | null` state to `MatchClient` in `components/match/MatchClient.tsx` — set on successful `onSwapComplete`, reset on `currentRound` change via `useEffect`
- [x] T012 [US1] Add `disabled?: boolean` and `lockedTiles?: [Coordinate, Coordinate] | null` props to `BoardGrid` in `components/game/BoardGrid.tsx` — when `disabled`, early-return from `handleTileClick`; when tile matches `lockedTiles` coordinate, add `board-grid__cell--locked` class
- [x] T013 [US1] Pass `disabled={moveLocked}` and `lockedTiles={lockedSwapTiles}` from `MatchClient` to `BoardGrid` in `components/match/MatchClient.tsx`

**Checkpoint**: Move lock works — swap tiles stay orange, board locked until next round. FR-001, FR-002, FR-003, FR-004 satisfied.

---

## Phase 3: User Story 2 — Opponent Move Reveal on Round Completion (Priority: P1)

**Goal**: On round completion, opponent's swapped tiles briefly highlight orange then fade to final color (~1s), before scored-tile-highlight begins.

**Independent Test**: Both players submit → opponent's tiles flash orange → fade out → scored highlight plays → summary panel shows.

**Dependencies**: Phase 1 (RoundSummary moves), Phase 2 (move lock for animation phase)

### Tests for User Story 2

- [ ] T014 [P] [US2] Write failing test: `AnimationPhase` includes `"revealing-opponent-move"` and transitions `idle → revealing-opponent-move → highlighting → showing-summary` in `tests/unit/components/MatchClient.test.tsx`
- [ ] T015 [P] [US2] Write failing test: `opponentRevealTiles` populated from `RoundSummary.moves` filtered to opponent's move in `tests/unit/components/MatchClient.test.tsx`
- [ ] T016 [P] [US2] Write failing test: tile with opponent-reveal class renders with `.board-grid__cell--opponent-reveal` in `tests/unit/components/BoardGrid.test.tsx`

### Implementation for User Story 2

- [ ] T017 [P] [US2] Add `@keyframes opponent-reveal-fade` (orange background → transparent, 1s ease-out) and `.board-grid__cell--opponent-reveal` class in `app/styles/board.css` — include `prefers-reduced-motion` bypass
- [ ] T018 [US2] Extend `AnimationPhase` type to include `"revealing-opponent-move"` in `components/match/MatchClient.tsx`
- [ ] T019 [US2] Add `opponentRevealTiles: [Coordinate, Coordinate] | null` state to `MatchClient` in `components/match/MatchClient.tsx`
- [ ] T020 [US2] Update `onSummary` callback in `MatchClient`: extract opponent's move from `summary.moves`, set `opponentRevealTiles`, set phase to `"revealing-opponent-move"`, after ~1000ms transition to `"highlighting"` phase in `components/match/MatchClient.tsx`
- [ ] T021 [US2] Add `opponentRevealTiles?: [Coordinate, Coordinate] | null` prop to `BoardGrid` — when tile matches, apply `.board-grid__cell--opponent-reveal` class in `components/game/BoardGrid.tsx`
- [ ] T022 [US2] Pass `opponentRevealTiles` from `MatchClient` to `BoardGrid` in `components/match/MatchClient.tsx`
- [ ] T023 [US2] Clear `moveLocked`, `lockedSwapTiles`, and `opponentRevealTiles` on transition from `"revealing-opponent-move"` to `"highlighting"` in `components/match/MatchClient.tsx`

**Checkpoint**: Round completion shows opponent's move first (orange fade ~1s), then scored-tile-highlight (~700ms), then summary. FR-005 satisfied.

---

## Phase 4: User Story 3 — Prominent Timer with Status Colors (Priority: P1)

**Goal**: Timer panels have colored backgrounds: green (running), orange (paused), red (expired). Clearly visible at a glance.

**Independent Test**: Timer panel background changes based on timer status.

### Tests for User Story 3

- [x] T024 [P] [US3] Write failing test: timer container renders with `bg-emerald-600/80` when status is running in `tests/unit/components/GameChrome.test.tsx`
- [x] T025 [P] [US3] Write failing test: timer container renders with `bg-amber-500/80` when status is paused in `tests/unit/components/GameChrome.test.tsx`
- [x] T026 [P] [US3] Write failing test: timer container renders with `bg-red-600/80` when `timerSeconds === 0` in `tests/unit/components/GameChrome.test.tsx`

### Implementation for User Story 3

- [x] T027 [US3] Add `timerStatus` derived value in `GameChrome`: `"expired"` when `timerSeconds <= 0`, `"paused"` when `hasSubmitted`, `"running"` otherwise in `components/match/GameChrome.tsx`
- [x] T028 [US3] Update timer container element in `GameChrome` with background color classes based on `timerStatus`: `bg-emerald-600/80` (running), `bg-amber-500/80` (paused), `bg-red-600/80` (expired); add `rounded-lg px-3 py-2` for panel appearance in `components/match/GameChrome.tsx`
- [x] T029 [US3] Remove old text-color-only timer styling (`text-emerald-400` / `text-slate-400`) and replace with white text on colored background in `components/match/GameChrome.tsx`

**Checkpoint**: Timers display as prominent colored panels. FR-006 satisfied.

---

## Phase 5: User Story 4 — Dual Timeout Game End (Priority: P2)

**Goal**: When both players' timers reach zero, game ends immediately with dual-timeout reason and navigates to summary.

**Independent Test**: Both timers at zero → match completes → summary screen shows timeout reason.

**Dependencies**: Phase 4 (timer expired detection)

### Tests for User Story 4

- [ ] T030 [US4] Write failing test: when both timer states show `remainingMs <= 0`, MatchClient displays dual-timeout indicator in `tests/unit/components/MatchClient.test.tsx`

### Implementation for User Story 4

- [ ] T031 [US4] Add `useEffect` in `MatchClient` that detects when both `matchState.timers.playerA.remainingMs <= 0` AND `matchState.timers.playerB.remainingMs <= 0` — set a `dualTimeoutDetected` flag in `components/match/MatchClient.tsx`
- [ ] T032 [US4] When `dualTimeoutDetected` is true, display "Both players timed out" overlay text; existing match completion logic (server broadcasts `state: "completed"`) handles navigation to summary in `components/match/MatchClient.tsx`
- [ ] T033 [US4] Verify `FinalSummary` displays "Both players timed out" when `endedReason === "timeout"` and both timer values are zero in `components/match/FinalSummary.tsx` — add dual-timeout specific messaging if not already present

**Checkpoint**: Dual timeout ends game immediately. FR-007, FR-008 satisfied.

---

## Phase 6: User Story 5 — Frozen Tile Colors on Final Summary Board (Priority: P2)

**Goal**: Final summary board shows frozen tiles with player-specific overlay colors.

**Independent Test**: Completed game summary shows tiles colored by owning player.

### Tests for User Story 5

- [x] T034 [US5] Write failing test: `FinalSummary` passes `frozenTiles` prop to `BoardGrid` in `tests/unit/components/FinalSummary.test.tsx` (or existing test file)

### Implementation for User Story 5

- [x] T035 [US5] Add `frozenTiles?: FrozenTileMap` prop to `FinalSummary` component and pass it to `BoardGridComponent` in `components/match/FinalSummary.tsx`
- [x] T036 [US5] Pass `frozenTiles` from match record (`match.frozen_tiles`) through to `FinalSummary` component in `app/match/[matchId]/summary/page.tsx`

**Checkpoint**: Summary board shows player-colored frozen tiles. FR-009 satisfied.

---

## Phase 7: User Story 6 — Tile Score Values (Priority: P2)

**Goal**: Each tile displays its letter point value as a small number in the bottom-right corner (Scrabble-style).

**Independent Test**: Every tile shows correct Krafla scoring value; values don't obscure primary letter.

### Tests for User Story 6

- [x] T037 [P] [US6] Write failing test: tile renders a score value element with correct point value for known letters (A=1, X=10) in `tests/unit/components/BoardGrid.test.tsx`
- [x] T038 [P] [US6] Write failing test: score value element has `board-grid__tile-score` class in `tests/unit/components/BoardGrid.test.tsx`

### Implementation for User Story 6

- [x] T039 [P] [US6] Add `.board-grid__tile-score` CSS class in `app/styles/board.css` — absolute positioned bottom-right, `font-size: 0.45em`, `opacity: 0.7`, `line-height: 1`, `pointer-events: none`
- [x] T040 [US6] Import `LETTER_SCORING_VALUES_IS` in `BoardGrid` from `docs/wordlist/letter_scoring_values_is.ts` and render a `<span className="board-grid__tile-score">` inside each tile button showing the letter's point value in `components/game/BoardGrid.tsx`

**Checkpoint**: All tiles show Scrabble-style point values. FR-010 satisfied.

---

## Phase 8: User Story 7 — Always-Visible Round Summary Table (Priority: P3)

**Goal**: Round summary table area visible from round 1 as blank reserved space; no layout shift when data populates.

**Independent Test**: Start game → summary area present (blank) → populates after round 1 with no layout jump.

### Tests for User Story 7

- [x] T041 [US7] Write failing test: `match-layout__summary` div renders even when `summary` is null in `tests/unit/components/MatchClient.test.tsx`

### Implementation for User Story 7

- [x] T042 [US7] Always render `<div className="match-layout__summary">` container in `MatchClient` render method, regardless of `summary` or `animationPhase` state — keep `RoundSummaryPanel` conditionally rendered inside the container in `components/match/MatchClient.tsx`
- [x] T043 [US7] Add `min-height` to `.match-layout__summary` in `app/styles/board.css` to ensure consistent reserved space (match existing panel height, e.g., `min-height: 12rem` on desktop)

**Checkpoint**: Summary area present from round 1; no CLS. FR-011, FR-012 satisfied.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verification across all stories

- [ ] T044 Run full test suite (`pnpm test`) — all existing + new tests pass
- [ ] T045 Run `pnpm lint && pnpm typecheck` — zero warnings, zero errors
- [ ] T046 Verify `prefers-reduced-motion` handling for new animations (opponent-reveal-fade, locked tile orange) in `app/styles/board.css`
- [ ] T047 Manual playtest verification: play a full 2-player game and confirm all 7 improvements work together

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 Move Lock (Phase 2)**: No dependencies — can start in parallel with Phase 1
- **US2 Opponent Reveal (Phase 3)**: Depends on Phase 1 (RoundSummary moves) + Phase 2 (move lock/animation)
- **US3 Timer Panels (Phase 4)**: No dependencies — can start in parallel with any phase
- **US4 Dual Timeout (Phase 5)**: Light dependency on Phase 4 (timer expired concept), but independently implementable
- **US5 Frozen Summary (Phase 6)**: No dependencies — can start in parallel
- **US6 Tile Scores (Phase 7)**: No dependencies — can start in parallel
- **US7 Summary Table (Phase 8)**: No dependencies — can start in parallel
- **Polish (Phase 9)**: Depends on all story phases complete

### User Story Dependencies

```
Phase 1 (Foundational) ─────────────────────────────┐
                                                      ↓
Phase 2 (US1: Move Lock) ──────────────────────────→ Phase 3 (US2: Opponent Reveal)

Phase 4 (US3: Timer Panels) ──── [independent] ────→ Phase 5 (US4: Dual Timeout)

Phase 6 (US5: Frozen Summary) ── [independent]
Phase 7 (US6: Tile Scores) ───── [independent]
Phase 8 (US7: Summary Table) ── [independent]
```

### Parallel Opportunities

These groups can run in parallel:

**Group A** (can all start immediately):
- Phase 1: Foundational type extensions
- Phase 4: US3 Timer Panels
- Phase 6: US5 Frozen Summary
- Phase 7: US6 Tile Scores
- Phase 8: US7 Summary Table

**Group B** (after Phase 1):
- Phase 2: US1 Move Lock

**Group C** (after Phase 1 + Phase 2):
- Phase 3: US2 Opponent Reveal

**Group D** (after Phase 4):
- Phase 5: US4 Dual Timeout

---

## Parallel Example: Independent Stories

```bash
# These can all launch simultaneously (no file conflicts):
Task: "T024 [US3] Timer panel green background test" (GameChrome.test.tsx)
Task: "T037 [US6] Tile score value test" (BoardGrid.test.tsx — different test block)
Task: "T034 [US5] Frozen tiles summary test" (FinalSummary.test.tsx)
Task: "T041 [US7] Summary container visible test" (MatchClient.test.tsx — different test block)
```

---

## Implementation Strategy

### MVP First (P1 Stories)

1. Complete Phase 1: Foundational type extension
2. Complete Phase 2: US1 Move Lock (core gameplay clarity)
3. Complete Phase 3: US2 Opponent Move Reveal
4. Complete Phase 4: US3 Timer Panels
5. **STOP and VALIDATE**: All P1 stories functional — core playability fixed

### Incremental Delivery

6. Add US6 Tile Scores → visible letter values
7. Add US5 Frozen Summary → colored summary board
8. Add US4 Dual Timeout → stuck game prevention
9. Add US7 Summary Table → layout stability
10. Polish phase → full verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD: test tasks MUST fail before implementation tasks
- Commit after each passing test (Constitution VII)
- All CSS animations use transforms/opacity only (GPU-accelerated, Constitution II)
- No new database tables or migrations — all changes are client-side UI or broadcast payload
