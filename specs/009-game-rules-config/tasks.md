# Implementation Tasks: Game Rules Configuration

**Feature**: `009-game-rules-config`
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Phase 1: Setup & Foundation

_Goal: Establish the new configuration constants and types that all subsequent engine logic will depend on._

- [x] T001 Create `GameConfig` and `MoveEvaluation` TypeScript interfaces in `lib/types/index.ts` (or appropriate types file)
- [x] T002 Create `DEFAULT_GAME_CONFIG` constant in `lib/constants/game-config.ts`

## Phase 2: User Story 1 - Configurable Game Parameters Engine

_Goal: Developers and Game Designers need to be able to configure core game parameters (word length, number of rounds, time per round, and valid directions)._
_Independent Test: Unit tests pass confirming config object structures are correctly imported._

- [x] T003 [US1] Remove hardcoded board size and limits in `lib/game-engine/board.ts` and replace with `GameConfig` parameters
- [x] T004 [US1] Propagate `DEFAULT_GAME_CONFIG` through the game-engine modules that need it (`lib/game-engine/board.ts`, `lib/game-engine/deltaDetector.ts`, `lib/game-engine/word-finder.ts`)

## Phase 3: User Story 2 - Scrabble-style Word and Adjacency Validation

_Goal: Players must place words purely in vertical or horizontal directions, and any new tile placement must only form valid words with all adjacent tiles, mimicking standard Scrabble crossing rules._
_Independent Test: Engine unit tests validate complex orthogonal crossroads and reject diagonal/invalid adjacencies._

- [x] T005 [P] [US2] Write unit tests in `tests/unit/game-engine/word-finder.test.ts` for orthogonal adjacency validation (Red phase)
- [x] T006 [P] [US2] Write unit tests in `tests/unit/game-engine/scorer.test.ts` for scoring multiple crossing words without diagonals (Red phase)
- [x] T007 [US2] Implement purely orthogonal (non-diagonal) extraction logic in `lib/game-engine/word-finder.ts` (Green phase)
- [x] T008 [US2] Implement recursive cross-word adjacency scanning in `lib/game-engine/word-finder.ts` (Green phase)
- [x] T009 [US2] Update `lib/game-engine/word-finder.ts` (`extractValidCrossWords`, `hasCrossWordViolation`) and `lib/game-engine/deltaDetector.ts` (`hasCrossWordViolation`, `hasInlineExtensionViolation`) to iterate through all extracted words and validate each against the dictionary (Set-based, not Trie)
- [x] T010 [US2] Update `lib/game-engine/scorer.ts` to sum the scores of all uniquely formed valid cross-words, explicitly ignoring diagonal sequences

## Phase 3c: User Story 2 - Bidirectional (All 4 Orthogonal Directions) Scoring

_Goal: All four orthogonal directions (right, left, down, up) are independently scored. Words valid in either reading direction along an axis score as distinct attributed words._
_Independent Test: T035 (left direction), T036 (up direction), T037 (left subword suppression), T038 (OR validation in word-finder) all pass._

- [x] T016 [P] [US2] Write unit tests in `tests/unit/lib/game-engine/deltaDetector.test.ts` (T035: left direction scoring, T036: up direction scoring, T037: left subword suppression) and `tests/unit/lib/game-engine/word-finder.test.ts` (T038: OR bidirectional dictionary validation) — Red phase
- [x] T017 [US2] Expand `filterAndAttribute` direction filter in `lib/game-engine/deltaDetector.ts` to pass "left" and "up" words; extend `isStrictSubword` with `case "left"` and `case "up"` arms; fix `isHorizontal` in `hasCrossWordViolation` and `hasInlineExtensionViolation` to include "left" — Green phase
- [x] T018 [US2] Add OR bidirectional dictionary checks to `lib/game-engine/word-finder.ts` (`extractValidCrossWords` main word validation and `hasCrossWordViolation` cross-line validation): `!dict.has(text) && !dict.has(reversed)` — Green phase

## Phase 3b: User Story 3 - Frozen Tile Word Extension Scoring

_Goal: Players can score words containing opponent-frozen tiles; letter points are partial (own tiles only), length bonus uses full word length._
_Independent Test: Unit tests confirm `lettersPoints` excludes opponent-frozen tile values and `lengthBonus` uses full word length._

- [x] T013 [US3] Rename `containsOpponentFrozenTile` → `getOpponentFrozenKeys` in `lib/game-engine/deltaDetector.ts`; extend `AttributedWord` with `opponentFrozenKeys: ReadonlySet<string>`; remove move rejection for opponent-frozen tiles
- [x] T014 [US3] Update `scoreAttributedWords` in `lib/game-engine/wordEngine.ts` to compute `lettersPoints` from own tiles only (exclude `opponentFrozenKeys`) while keeping `lengthBonus` on full word length
- [x] T015 [P] [US3] Write/update unit tests in `tests/unit/lib/game-engine/deltaDetector.test.ts` (T032 update + T034 new) and `tests/unit/lib/game-engine/wordEngine.test.ts` (partial scoring tests)

## Phase 4: Polish & Integration

_Goal: Ensure the overarching game loop respects the new validation returns and that all existing tests pass._

- [x] T011 Update integration tests in `tests/integration/` to reflect the new strict orthogonal validation rules
- [x] T012 Run performance benchmarks (if any exist for engine validation) to ensure the recursive cross-word logic executes under the 50ms SLA

---

## Dependencies & Execution Order

```text
Phase 1 (Setup)
   │
   ├─► Phase 2 (Config Integration)
   │
   └─► Phase 3 (Engine Overhaul)
          ├─► Unit Tests (T005, T006)
          └─► Implementation (T007 - T010)
                 │
                 ├─► Phase 3b (Frozen Tile Scoring: T013 - T015)
                 │
                 ├─► Phase 3c (Bidirectional Scoring: T016 - T018)
                 │
                 ▼
       Phase 4 (Integration & Polish)
```

**Parallel Execution Examples**:

- **T005** and **T006** can be written in parallel as they test different game engine modules (`word-finder` vs `scorer`).

## Implementation Strategy

1. **Foundation First**: Establish the types and constants in Phase 1 immediately, as Phase 2 and 3 depend on the new signatures.
2. **Test-Driven Engine Overhaul**: Following the Constitution (Principle VII), Phase 3 begins with explicitly writing the new Scrabble adjacency test cases. The engine overhaul is the highest risk component and must be driven by failing tests.
3. **Refactor**: Once the unit tests pass, ensure the main Server Actions orchestrating the game loop cleanly consume `ExtractCrossWordsResult` (from `word-finder.ts`) and `AttributedWord[]` (from `deltaDetector.ts`).
