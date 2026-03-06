# Tasks: Scoring Rules Overhaul

**Input**: Design documents from `/specs/013-scoring-change/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/scoring-pipeline.md, quickstart.md

**Tests**: TDD is NON-NEGOTIABLE per Constitution Principle VII. Test tasks are included for all new and modified modules.

**Organization**: Tasks are grouped by user story. Due to the deeply intertwined nature of the scoring pipeline, some stories have cross-dependencies noted in the Dependencies section.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type changes, config updates, and obsolete code removal that all stories depend on

- [x] T001 Update `FrozenTileOwner` type to remove `"both"` variant in `lib/types/match.ts` — change from `"player_a" | "player_b" | "both"` to `"player_a" | "player_b"` (FR-008)
- [x] T002 Remove `isDuplicate` field from `WordScoreBreakdown` interface in `lib/types/match.ts` (FR-015/FR-016)
- [x] T003 Remove `isDuplicate` field from `WordScore` interface in `lib/types/match.ts` (FR-015/FR-016)
- [x] T004 Remove `comboBonus` field from `RoundScoreResult` interface in `lib/types/match.ts` (FR-017)
- [x] T005 Remove `comboBonus` field from `RoundSummary` interface in `lib/types/match.ts` (FR-017)
- [x] T006 Move `AcceptedMove` interface from `lib/game-engine/deltaDetector.ts` to `lib/types/match.ts`, add `submittedAt: string` field, and update all import sites (FR-005)
- [x] T007 Update `minimumWordLength` from 3 to 2 in `lib/constants/game-config.ts` (FR-004)
- [x] T008 Update `BoardWord.length` JSDoc from "≥3" to "≥2" in `lib/types/board.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove combo bonus and text-based duplicate infrastructure that is incompatible with new scoring model

**⚠️ CRITICAL**: These removals must be complete before pipeline rewrite begins

- [x] T009 Write failing test for `calculateLetterPoints` with 2-letter words in `tests/unit/lib/game-engine/scorer.test.ts` — verify 2-letter words score correctly with length bonus of 0 (FR-004)
- [x] T010 Remove `calculateComboBonus()` function and its export from `lib/game-engine/scorer.ts` (FR-017)
- [x] T011 Update `scorer.test.ts` — remove combo bonus test cases, update existing tests for 2-letter word support in `tests/unit/lib/game-engine/scorer.test.ts`
- [x] T012 Remove combo bonus calculation from `aggregateRoundSummary()` in `lib/scoring/roundSummary.ts` — deltas become sum of word totalPoints only
- [x] T013 Update `roundSummary.test.ts` — remove combo bonus assertions, verify deltas exclude combo in `tests/unit/lib/scoring/roundSummary.test.ts`
- [x] T014 Remove `getPriorScoredWordsByPlayer()` function from `app/actions/match/publishRoundSummary.ts` (FR-015/FR-016)
- [x] T015 Fix all TypeScript compilation errors caused by type changes in T001–T008 across the codebase — update all references to removed fields (`isDuplicate`, `comboBonus`, `"both"`)
- [x] T016 Ensure `pnpm typecheck` passes cleanly after all Phase 1–2 changes

**Checkpoint**: Types are updated, combo bonus removed, duplicate tracking removed. Codebase compiles. Existing tests may fail (expected — they will be rewritten in subsequent phases).

---

## Phase 3: User Story 1 — Orthogonal Word Discovery from Swap Coordinates (Priority: P1) 🎯 MVP

**Goal**: Implement exhaustive orthogonal-only word scanning from swap coordinates, replacing full-board 8-directional scanning

**Independent Test**: Swap two tiles on a board with known letter arrangements → verify only orthogonal words through swap coordinates are found

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (TDD Red)**

- [x] T017 [P] [US1] Write failing test: `scanFromSwapCoordinates` finds horizontal word through swap coordinate in `tests/unit/lib/game-engine/boardScanner.test.ts`
- [x] T018 [P] [US1] Write failing test: `scanFromSwapCoordinates` finds vertical word through swap coordinate in `tests/unit/lib/game-engine/boardScanner.test.ts`
- [x] T019 [P] [US1] Write failing test: `scanFromSwapCoordinates` does NOT find diagonal words in `tests/unit/lib/game-engine/boardScanner.test.ts`
- [x] T020 [P] [US1] Write failing test: `scanFromSwapCoordinates` does NOT find words that don't pass through swap coordinate in `tests/unit/lib/game-engine/boardScanner.test.ts`
- [x] T021 [P] [US1] Write failing test: `scanFromSwapCoordinates` finds 2-letter words in `tests/unit/lib/game-engine/boardScanner.test.ts`
- [x] T022 [P] [US1] Write failing test: `scanFromSwapCoordinates` finds both a horizontal and vertical word through same swap coordinate in `tests/unit/lib/game-engine/boardScanner.test.ts`
- [x] T023 [P] [US1] Write failing test: `scanFromSwapCoordinates` exhaustively finds overlapping subwords (e.g., "ÁS" and "ÁSTIN" in same direction through swap coord) in `tests/unit/lib/game-engine/boardScanner.test.ts`
- [x] T024 [P] [US1] Write failing test: `scanFromSwapCoordinates` finds words in both directions from a single swap coordinate (up vs down, left vs right) in `tests/unit/lib/game-engine/boardScanner.test.ts`

### Implementation for User Story 1

- [x] T025 [US1] Implement `scanFromSwapCoordinates()` in `lib/game-engine/boardScanner.ts` — for each swap coordinate, trace 4 orthogonal directions, extract full lines, enumerate all subsequences of length ≥2 containing the swap coordinate, check dictionary (FR-001, FR-002, FR-003, FR-004, FR-020)
- [x] T026 [US1] Verify all US1 tests pass (TDD Green) — run `pnpm test:unit -- tests/unit/lib/game-engine/boardScanner.test.ts`
- [x] T027 [US1] Update existing `boardScanner.test.ts` tests that assumed minimum length 3 or 8-directional scanning — keep `scanBoard()` tests for backward compat but add new `scanFromSwapCoordinates()` test section

**Checkpoint**: `scanFromSwapCoordinates()` works independently. Given a board and swap coordinates, it finds all valid orthogonal words through those coordinates.

---

## Phase 4: User Story 5 — Board-Wide Cross-Validation Invariant (Priority: P2, moved up — US2 depends on it)

**Goal**: Implement cross-validation as a global board invariant with combination optimization that selects the highest-scoring valid word subset

**Independent Test**: Given multiple candidate words from a swap, verify the system selects the combination where all cross-words are valid, maximizing total score

### Tests for User Story 5

> **NOTE: Write these tests FIRST (TDD Red)**

- [x] T028 [P] [US5] Write failing test: `selectOptimalCombination` returns single word when it passes cross-validation against frozen tiles in `tests/unit/lib/game-engine/crossValidator.test.ts`
- [x] T029 [P] [US5] Write failing test: `selectOptimalCombination` excludes word that creates invalid cross-word with frozen tile in `tests/unit/lib/game-engine/crossValidator.test.ts`
- [x] T030 [P] [US5] Write failing test: `selectOptimalCombination` returns empty array when no valid combination exists in `tests/unit/lib/game-engine/crossValidator.test.ts`
- [x] T031 [P] [US5] Write failing test: `selectOptimalCombination` picks highest-scoring combination when multiple valid subsets exist in `tests/unit/lib/game-engine/crossValidator.test.ts`
- [x] T032 [P] [US5] Write failing test: `selectOptimalCombination` handles mutual cross-validation between candidate words (word A valid alone but invalid with word B) in `tests/unit/lib/game-engine/crossValidator.test.ts`
- [x] T033 [P] [US5] Write failing test: `selectOptimalCombination` prefers superword "ANDINN" over subword "ANDI" when both pass cross-validation (higher score) in `tests/unit/lib/game-engine/crossValidator.test.ts`
- [x] T034 [P] [US5] Write failing test: `selectOptimalCombination` falls back to subword "ANDI" when superword "ANDINN" fails cross-validation in `tests/unit/lib/game-engine/crossValidator.test.ts`
- [x] T035 [P] [US5] Write failing test: word with no adjacent scored tiles passes cross-validation without checks in `tests/unit/lib/game-engine/crossValidator.test.ts`

### Implementation for User Story 5

- [x] T036 [US5] Create `lib/game-engine/crossValidator.ts` — extract and adapt the existing `hasCrossWordViolation()` from `lib/game-engine/deltaDetector.ts` (lines 57–116) to check perpendicular sequences against frozen tiles + candidate tiles; update the original to re-export from crossValidator.ts to avoid duplication (FR-013)
- [x] T037 [US5] Implement `selectOptimalCombination()` in `lib/game-engine/crossValidator.ts` — brute-force subset enumeration over candidates, filter by mutual cross-validation, return highest-scoring valid combination (FR-014, FR-014a)
- [x] T038 [US5] Verify all US5 tests pass (TDD Green) — run `pnpm test:unit -- tests/unit/lib/game-engine/crossValidator.test.ts`

**Checkpoint**: `selectOptimalCombination()` works as a pure function. Given candidate words, frozen tiles, board, and dictionary, it returns the optimal valid subset.

---

## Phase 5: User Story 3 — Exclusive Tile Ownership (Priority: P1)

**Goal**: Enforce single-owner tiles — remove `"both"` ownership, first-owner-wins semantics

**Independent Test**: When both players claim the same tile, verify the first claimer retains ownership permanently

### Tests for User Story 3

> **NOTE: Write these tests FIRST (TDD Red)**

- [x] T039 [P] [US3] Write failing test: `resolveOwnership` returns existing owner when tile is already frozen (first-owner-wins) in `tests/unit/lib/game-engine/frozenTiles.test.ts`
- [x] T040 [P] [US3] Write failing test: `freezeTiles` never produces `"both"` ownership in output in `tests/unit/lib/game-engine/frozenTiles.test.ts`
- [x] T041 [P] [US3] Write failing test: `isFrozenByOpponent` returns true for opponent-owned tiles (no "both" case) in `tests/unit/lib/game-engine/frozenTiles.test.ts`

### Implementation for User Story 3

- [x] T042 [US3] Update `resolveOwnership()` in `lib/game-engine/frozenTiles.ts` — return existing owner when tile already frozen, never return `"both"` (FR-008, FR-009)
- [x] T043 [US3] Update `isFrozenByOpponent()` in `lib/game-engine/frozenTiles.ts` — remove `"both"` special case
- [x] T044 [US3] Update `freezeTiles()` in `lib/game-engine/frozenTiles.ts` — remove `"both"` from tile claim deduplication logic (lines 204–206)
- [x] T045 [US3] Update existing `frozenTiles.test.ts` — replace all `"both"` ownership tests with first-owner-wins assertions in `tests/unit/lib/game-engine/frozenTiles.test.ts`
- [x] T046 [US3] Verify all US3 tests pass (TDD Green) — run `pnpm test:unit -- tests/unit/lib/game-engine/frozenTiles.test.ts`

**Checkpoint**: Frozen tile ownership is exclusive. No tile ever has `"both"` ownership. First owner wins permanently.

---

## Phase 6: User Story 2 — Time-Based Scoring Precedence with Immediate Freezing (Priority: P1)

**Goal**: Rewrite the scoring pipeline to process players sequentially by submission time — first submitter's tiles freeze before second submitter's evaluation

**Independent Test**: Two players submit moves → first submitter's words scored and tiles frozen → second submitter's scoring respects new frozen tiles

### Tests for User Story 2

> **NOTE: Write these tests FIRST (TDD Red)**

- [x] T047 [P] [US2] Write failing test: `processRoundScoring` processes first submitter (by `submittedAt`) before second submitter in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T048 [P] [US2] Write failing test: first submitter's tiles are frozen before second submitter's words are evaluated in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T049 [P] [US2] Write failing test: second submitter's words through first submitter's newly frozen tiles score zero letter points for those tiles in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T050 [P] [US2] Write failing test: precedence is by `submittedAt` timestamp, not player slot (player_b can have precedence) in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T050a [P] [US2] Write failing test: when both moves have identical `submittedAt` timestamps, player_a receives scoring precedence as deterministic tiebreaker in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T051 [P] [US2] Write failing test: `processRoundScoring` returns result without `comboBonus` field in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T052 [P] [US2] Write failing test: single-player submission (only one move) is processed correctly in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T053 [P] [US2] Write failing test: zero-move round returns empty result in `tests/unit/lib/game-engine/wordEngine.test.ts`

### Implementation for User Story 2

- [x] T054 [US2] Rewrite `processRoundScoring()` in `lib/game-engine/wordEngine.ts` — sort moves by `submittedAt`, process first submitter (scan → cross-validate → score → freeze), then process second submitter with updated frozen tiles (FR-005, FR-006, FR-007)
- [x] T055 [US2] Remove `scoreAttributedWords()` text-based duplicate logic from `lib/game-engine/wordEngine.ts` — all words score full points
- [x] T056 [US2] Remove `computeDeltas()` combo bonus parameter from `lib/game-engine/wordEngine.ts` — deltas are pure word point sums
- [x] T057 [US2] Remove `PriorScoredWordsByPlayer` export and `boardAfter` parameter from `processRoundScoring()` signature in `lib/game-engine/wordEngine.ts`
- [x] T058 [US2] Verify all US2 tests pass (TDD Green) — run `pnpm test:unit -- tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T058a [US2] Write test: freezeTiles stops freezing when ≥24 unfrozen tile safeguard would be violated under sequential processing in `tests/unit/lib/game-engine/wordEngine.test.ts` (FR-018)

**Checkpoint**: Full scoring pipeline works with sequential processing, no combo bonus, no text-based duplicates. First submitter's tiles freeze before second submitter's evaluation. Unfrozen tile safeguard verified.

---

## Phase 7: User Story 4 — Cross-Opponent Word Scoring (Priority: P2)

**Goal**: Words spanning opponent-owned tiles score zero letter points for those positions but full length bonus

**Independent Test**: Create a word spanning own + opponent tiles → verify partial letter scoring with full length bonus

### Tests for User Story 4

> **NOTE: Write these tests FIRST (TDD Red)**

- [x] T059 [P] [US4] Write failing test: word spanning opponent tiles scores zero letter points for opponent positions but full length bonus in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T060 [P] [US4] Write failing test: word where ALL tiles are opponent-owned scores zero letter points but full length bonus in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [x] T061 [P] [US4] Write failing test: word where no tiles are opponent-owned scores full letter points plus length bonus in `tests/unit/lib/game-engine/wordEngine.test.ts`

### Implementation for User Story 4

- [x] T062 [US4] Move `getOpponentFrozenKeys()` from `lib/game-engine/deltaDetector.ts` to `lib/game-engine/frozenTiles.ts`, remove `"both"` exception, and update all import sites — all tiles owned by opponent are opponent-frozen (FR-010, FR-011, FR-012)
- [x] T063 [US4] Verify opponent-tile scoring logic in `scoreAttributedWords()` works correctly with exclusive ownership in `lib/game-engine/wordEngine.ts`
- [x] T064 [US4] Verify all US4 tests pass (TDD Green) — run relevant test files

**Checkpoint**: Words correctly cross opponent territory. Letter points exclude opponent tiles, length bonus uses full word length.

---

## Phase 8: User Story 6 — Coordinate-Based Duplicate Allowance (Priority: P3)

**Goal**: Same word text scores full points at different coordinates — no text-based duplicate penalty

**Independent Test**: Score "HÚS" at two different coordinate sets → verify both score full points

### Tests for User Story 6

> **NOTE: Write these tests FIRST (TDD Red)**

- [ ] T065 [P] [US6] Write failing test: same word text at different coordinates both score full points across rounds in `tests/unit/lib/game-engine/wordEngine.test.ts`
- [ ] T066 [P] [US6] Write failing test: both players scoring same word text at different coordinates in same round both get full points in `tests/unit/lib/game-engine/wordEngine.test.ts`

### Implementation for User Story 6

- [ ] T067 [US6] Verify coordinate-based uniqueness is enforced by frozen tile system — tiles that are already frozen cannot be re-scored at same coordinates (no explicit duplicate tracking needed)
- [ ] T068 [US6] Verify all US6 tests pass (TDD Green) — confirm no text-based duplicate penalties remain anywhere in pipeline

**Checkpoint**: Word uniqueness is coordinate-based. Same word at different positions scores full points each time.

---

## Phase 9: Persistence & Integration

**Purpose**: Update Server Actions, database, and integration tests to work with the new scoring pipeline

- [ ] T069 Update `executeScoringPipeline()` in `app/actions/match/publishRoundSummary.ts` — remove `priorScoredWordsByPlayer` call, pass `submittedAt` in accepted moves, remove `boardAfter` param, adapt to new `RoundScoreResult` (no `comboBonus`, no `isDuplicate`)
- [ ] T070 Update `computeWordScoresForRound()` signature in `app/actions/match/publishRoundSummary.ts` — align with new `processRoundScoring()` contract
- [ ] T071 Update word score entry persistence in `executeScoringPipeline()` — remove `is_duplicate` field from insert payload in `app/actions/match/publishRoundSummary.ts`
- [ ] T072 Create Supabase migration to update `matches.frozen_tiles` JSONB — convert existing `"both"` owner values to `"player_a"` in `supabase/migrations/`
- [ ] T073 Create Supabase migration to set `word_score_entries.is_duplicate` default to false (or drop column) in `supabase/migrations/`
- [ ] T074 Update `roundEngine` callers to pass `submittedAt` from `move_submissions.created_at` to `computeWordScoresForRound()` in `lib/match/roundEngine.ts`
- [ ] T075 Write integration test: full round scoring pipeline with new rules (orthogonal scan, cross-validation, sequential precedence) in `tests/integration/roundScoring.test.ts`
- [ ] T076 Verify integration test passes — run `pnpm test:integration -- tests/integration/roundScoring.test.ts`

---

## Phase 10: Client Updates

**Purpose**: Update UI components to remove combo bonus display and isDuplicate badges

- [ ] T077 [P] Remove combo bonus derivation from `deriveScoreDelta()` in `components/match/deriveScoreDelta.ts` — remove `combo` field from `ScoreDelta` interface
- [ ] T078 [P] Remove combo bonus display line from `ScoreDeltaPopup` in `components/match/ScoreDeltaPopup.tsx`
- [ ] T079 [P] Remove combo bonus display from `RoundSummaryPanel` in `components/match/RoundSummaryPanel.tsx`
- [ ] T080 [P] Remove combo derivation from `deriveRoundHistory()` in `components/match/deriveRoundHistory.ts`
- [ ] T081 [P] Remove `isDuplicate` badges and combo totals from `FinalSummary` in `components/match/FinalSummary.tsx`
- [ ] T082 Update `deriveScoreDelta.test.ts` — remove combo bonus assertions in `tests/unit/components/match/deriveScoreDelta.test.ts`
- [ ] T083 Update any remaining client component tests that reference `comboBonus` or `isDuplicate`

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Verify full system integrity, performance, and cleanup

- [ ] T084 Run `pnpm typecheck` — verify zero TypeScript errors across entire codebase
- [ ] T085 Run `pnpm lint` — verify zero ESLint warnings
- [ ] T086 Run `pnpm test` — verify all unit and contract tests pass
- [ ] T087 Run `pnpm test:integration` — verify all integration tests pass
- [ ] T088 Performance validation: verify word validation completes in <50ms with new scanner — run `pnpm perf:round-resolution` or add targeted perf test (SC-008)
- [ ] T089 Remove dead code: clean up unused imports, delete `removeSubwords()`, `removeSuffixOverlaps()`, `buildUnionText()`, `startsLater()` from `lib/game-engine/deltaDetector.ts` if no longer used
- [ ] T090 Remove unused `calculateMoveScore()` from `lib/game-engine/scorer.ts` if no longer called
- [ ] T091 Verify `pnpm build` succeeds — production build with no errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 type changes — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — new scanner function, no other story deps
- **US5 (Phase 4)**: Depends on Phase 2 — new cross-validator, no other story deps (can parallel with US1)
- **US3 (Phase 5)**: Depends on Phase 2 — frozen tile changes, no other story deps (can parallel with US1/US5)
- **US2 (Phase 6)**: Depends on US1 + US5 + US3 — pipeline rewrite uses scanner + cross-validator + exclusive ownership
- **US4 (Phase 7)**: Depends on US3 — opponent scoring simplified by exclusive ownership
- **US6 (Phase 8)**: Depends on Phase 2 — mostly verification that removal is complete
- **Persistence (Phase 9)**: Depends on US2 — Server Actions adapted to new pipeline
- **Client (Phase 10)**: Depends on Phase 2 type changes — can parallel with Phases 3–9
- **Polish (Phase 11)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — independent scanner module
- **US5 (P2)**: Can start after Foundational — independent cross-validator module (moved up because US2 depends on it)
- **US3 (P1)**: Can start after Foundational — independent frozen tile changes
- **US2 (P1)**: BLOCKED until US1 + US5 + US3 complete — pipeline rewrite integrates all three
- **US4 (P2)**: Depends on US3 — opponent scoring uses exclusive ownership
- **US6 (P3)**: Can start after Foundational — mostly removal/verification

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD Red)
- Implementation makes tests pass (TDD Green)
- Refactor while keeping tests green (TDD Refactor)
- Commit after each passing test

### Parallel Opportunities

**After Phase 2 completes, these can run in parallel:**
- US1 (scanner) ‖ US5 (cross-validator) ‖ US3 (frozen tiles) ‖ US6 (duplicate removal) ‖ Client updates (Phase 10)

**Sequential dependencies:**
- US1 + US5 + US3 → US2 (pipeline rewrite)
- US3 → US4 (opponent scoring)
- US2 → Phase 9 (persistence)
- All → Phase 11 (polish)

---

## Parallel Example: After Foundational Phase

```bash
# These three user stories can be implemented in parallel:

# Agent 1: US1 — Scanner
Task: "T017–T027: scanFromSwapCoordinates() tests and implementation"

# Agent 2: US5 — Cross-validator
Task: "T028–T038: selectOptimalCombination() tests and implementation"

# Agent 3: US3 — Frozen tiles
Task: "T039–T046: Exclusive ownership tests and implementation"

# Agent 4: Client updates (independent of pipeline)
Task: "T077–T083: Remove combo bonus and isDuplicate from UI"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (type changes)
2. Complete Phase 2: Foundational (combo/duplicate removal)
3. Complete Phase 3: US1 (scanner)
4. **STOP and VALIDATE**: Test scanner independently with known boards
5. Scanner is the foundation — all other stories build on it

### Incremental Delivery

1. Setup + Foundational → Types compile, combo/duplicate code removed
2. US1 (scanner) → Targeted word discovery works
3. US5 (cross-validator) → Combination optimization works
4. US3 (exclusive ownership) → Frozen tiles simplified
5. US2 (pipeline rewrite) → Full sequential scoring pipeline works → **Core feature complete**
6. US4 (cross-opponent scoring) → Opponent tile handling verified
7. US6 (coordinate duplicates) → Duplicate removal verified
8. Persistence → Server Actions + DB aligned
9. Client → UI reflects new scoring model
10. Polish → Full system validated

### Critical Path

```
Phase 1 → Phase 2 → US1 + US5 + US3 (parallel) → US2 → Phase 9 → Phase 11
```

The critical path is **~58 tasks**, with Phases 3/4/5 and Phase 10 offering significant parallelism.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD is mandatory — all test tasks must be completed BEFORE their corresponding implementation tasks
- US5 (cross-validation) is moved ahead of US2 (precedence) because the pipeline rewrite depends on the cross-validator
- The existing `scanBoard()` function is preserved for backward compatibility — `scanFromSwapCoordinates()` is a new export
- The existing `deltaDetector.ts` `detectNewWords()` function will be superseded by the new pipeline in `wordEngine.ts` but not deleted until all callers are migrated
- Database migrations (T072–T073) should be run with `pnpm supabase:migrate` after creation
