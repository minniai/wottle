# Tasks: Visual Feedback Polish — Score Delta Popup & Invalid Swap Feedback

**Input**: Design documents from `/specs/008-score-delta-popup/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓

**Context**: Both deliverables are already implemented in code. All tasks target the remaining test gaps and one robustness fix (FR-012). TDD applies: new tests are written first and must fail before code changes.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Confirm existing implementation is green before adding new tests.

- [X] T001 Run `pnpm test` and `pnpm exec playwright test` and confirm zero failures — no code changes, baseline only

**Checkpoint**: All existing tests pass. Proceed to user story phases.

---

## Phase 2: Foundational (No Blocking Prerequisites)

No foundational tasks required. The `ScoreDelta` type, CSS keyframes, component implementations, and `MatchClient` wiring are all complete. User story phases can begin immediately after Phase 1.

---

## Phase 3: User Story 1 — Score Delta Popup (Priority: P1) 🎯 MVP

**Goal**: Verify the score delta popup system (ScoreDeltaPopup component + GameChrome wiring + MatchClient derivation) is fully tested and spec-compliant.

**Independent Test**: Complete a scoring round in a two-player match and confirm the popup appears near the player's score with the correct letter/length/combo breakdown, and that no popup appears when the player earns zero points.

### Tests for User Story 1 (TDD — write first, confirm they FAIL, then verify implementation passes)

- [X] T002 [P] [US1] Write failing unit test: `deriveScoreDelta` returns `null` when `letterPoints`, `lengthBonus`, and `combo` are all zero — add to `tests/unit/components/MatchClient.test.tsx`
- [X] T003 [P] [US1] Write failing unit test: `deriveScoreDelta` excludes words belonging to the opponent (filters by `playerId`) — add to `tests/unit/components/MatchClient.test.tsx`
- [X] T004 [P] [US1] Write failing unit test: `deriveScoreDelta` excludes words where `isDuplicate === true` from all totals — add to `tests/unit/components/MatchClient.test.tsx`
- [X] T005 [P] [US1] Write failing unit test: `deriveScoreDelta` correctly sums `lettersPoints` and `bonusPoints` across all valid words — add to `tests/unit/components/MatchClient.test.tsx`
- [X] T006 [P] [US1] Write failing unit test: `deriveScoreDelta` reads `comboBonus.playerA` when slot is `"player_a"` and `comboBonus.playerB` when slot is `"player_b"` — add to `tests/unit/components/MatchClient.test.tsx`
- [X] T007 [P] [US1] Write failing unit test: `deriveScoreDelta` returns `null` when `comboBonus` is `undefined` and no scoreable words exist — add to `tests/unit/components/MatchClient.test.tsx`

### Implementation for User Story 1

- [X] T008 [US1] Export `deriveScoreDelta` from `components/match/MatchClient.tsx` (or extract to a sibling utility file) so it can be imported in tests — confirm T002–T007 now pass
- [X] T009 [P] [US1] Write Playwright E2E test: after a scoring round completes, `[data-testid="score-delta-popup"]` is visible near the player's `[data-testid="score-container"]` and contains at least "+N letters" — add to `tests/integration/ui/rounds-flow.spec.ts`
- [X] T010 [P] [US1] Write Playwright E2E test: when the current player earns zero points in a round (no new words), `[data-testid="score-delta-popup"]` is NOT in the DOM — add to `tests/integration/ui/rounds-flow.spec.ts`
- [X] T011 [US1] Write Playwright E2E test: after a round resolves, both `[data-testid="score-delta-popup"]` (HUD) and `[data-testid="round-summary-panel"]` (or equivalent) are simultaneously visible — add to `tests/integration/ui/round-summary.spec.ts`
- [X] T012 [US1] Run `pnpm exec playwright test tests/integration/ui/rounds-flow.spec.ts` and `round-summary.spec.ts` — confirm T009, T010, T011 pass against the existing implementation

**Checkpoint**: `deriveScoreDelta` is unit-tested in isolation (T002–T008). Popup appearance, zero-delta suppression, and panel coexistence are E2E-verified (T009–T012). User Story 1 is fully tested.

---

## Phase 4: User Story 2 — Invalid Swap Feedback (Priority: P2)

**Goal**: Ensure the invalid-swap shake animation is robustly re-triggerable on rapid consecutive rejections (FR-012) and is verified in a live match E2E context.

**Independent Test**: Submit an invalid swap against a frozen tile and confirm both tiles receive the `board-grid__cell--invalid` CSS class, then lose it after ~400ms, with no board state change.

### Tests for User Story 2 (TDD — write first, confirm they FAIL, then fix)

- [X] T013 [P] [US2] Write failing unit test: when a second server rejection arrives while the first 400ms shake window is still active, the `board-grid__cell--invalid` class is present on the new tile pair immediately (not deferred) — add to `tests/unit/components/game/BoardGrid.test.tsx`
- [X] T014 [P] [US2] Write Playwright E2E test: attempting to swap a frozen tile results in both tiles receiving `data-frozen` and the `board-grid__cell--invalid` class within one render cycle of the server's rejection response — add to `tests/integration/ui/swap-flow.spec.ts`

### Implementation for User Story 2

- [X] T015 [US2] Add `invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)` to `BoardGridActive` in `components/game/BoardGrid.tsx`
- [X] T016 [US2] In the `handleSwap` catch block in `components/game/BoardGrid.tsx`: call `clearTimeout(invalidTimerRef.current)` before `setInvalidTiles([from, to])`, then assign the new timeout to `invalidTimerRef.current`, clearing to `null` on completion
- [ ] T017 [US2] Run `pnpm test:unit -- tests/unit/components/game/BoardGrid.test.tsx` and confirm T013 and all existing BoardGrid invalid-shake tests pass
- [ ] T018 [US2] Run `pnpm exec playwright test tests/integration/ui/swap-flow.spec.ts` and confirm T014 passes

**Checkpoint**: FR-012 rapid re-rejection is robustly handled and both the unit and E2E tests for User Story 2 are green.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Run `pnpm lint` and `pnpm typecheck` — confirm zero warnings and zero type errors after all changes
- [ ] T020 Run full test suite `pnpm test && pnpm exec playwright test` — confirm all tests pass, no regressions
- [ ] T021 Update `specs/008-score-delta-popup/spec.md` Status field from `Draft` to `Implemented`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run immediately
- **Phase 2 (Foundational)**: N/A — skipped
- **Phase 3 (US1)**: Depends on Phase 1 baseline passing
- **Phase 4 (US2)**: Depends on Phase 1 baseline passing; independent of Phase 3 (can proceed in parallel)
- **Phase 5 (Polish)**: Depends on Phase 3 and Phase 4 completion

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2. Start after Phase 1.
- **User Story 2 (P2)**: No dependency on US1. Start after Phase 1.

### Within Each User Story (TDD Order)

```
Write failing test(s) → Confirm failure → Implement/fix code → Confirm tests pass → Commit
```

### Parallel Opportunities

Within US1 — T002 through T007 can all be written in parallel (different `describe` blocks, same file):
```
T002: returns null when all zero
T003: filters by playerId          ← parallel with T002, T004, T005, T006, T007
T004: excludes isDuplicate
T005: sums points correctly
T006: reads comboBonus by slot
T007: handles undefined comboBonus
```

Within US2 — T013 and T014 can be written in parallel (different files):
```
T013: unit test (BoardGrid.test.tsx)        ← parallel with T014
T014: E2E test (swap-flow.spec.ts)
```

---

## Parallel Execution Example: User Story 1

```bash
# Step 1: Write all 6 unit tests for deriveScoreDelta in parallel (same file, sequential blocks)
# T002, T003, T004, T005, T006, T007 — all in tests/unit/components/MatchClient.test.tsx

# Step 2: Run unit tests to confirm they all fail (deriveScoreDelta not yet exported)
pnpm test:unit -- tests/unit/components/MatchClient.test.tsx

# Step 3: Export deriveScoreDelta (T008) — all 6 tests should now pass
pnpm test:unit -- tests/unit/components/MatchClient.test.tsx

# Step 4: Write E2E tests in parallel (different files)
# T009, T010 → tests/integration/ui/rounds-flow.spec.ts
# T011       → tests/integration/ui/round-summary.spec.ts

# Step 5: Confirm E2E tests pass (T012)
pnpm exec playwright test tests/integration/ui/rounds-flow.spec.ts tests/integration/ui/round-summary.spec.ts
```

---

## Implementation Strategy

### MVP (User Story 1 Only — P1)

1. Complete Phase 1: Verify baseline green
2. Complete Phase 3 (T002–T012): `deriveScoreDelta` unit tests + E2E popup verification
3. **STOP and VALIDATE**: Score delta popup is fully tested
4. Demo: Two-player match shows breakdown popup after each scoring round

### Incremental Delivery

1. Phase 1 (baseline) → confirms feature works before changes
2. Phase 3 (US1) → score delta fully tested → shippable
3. Phase 4 (US2) → invalid shake robustness fix + E2E → shippable
4. Phase 5 (polish) → clean lint/types, spec updated

### Single Developer

Work sequentially: Phase 1 → Phase 3 → Phase 4 → Phase 5.
Within each phase, write all tests first (they should fail), then make them pass.

---

## Notes

- [P] tasks = different files or independently addable test cases; no blocking dependency on each other
- [Story] label maps each task to its user story for traceability
- `deriveScoreDelta` must be exported (or extracted to a utility) before unit tests can import it (T008)
- The `invalidTimerRef` fix (T015–T016) is the only production code change in this feature; all other implementation is already complete
- Commit after each `[P]` group or logical task completion; include `test:` prefix commits before `feat:` fix commits
