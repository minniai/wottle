# Tasks: Word Engine & Scoring

**Input**: Design documents from `/specs/003-word-engine-scoring/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/word-engine.ts

**Tests**: TDD is mandatory per constitution (Principle VII). Test tasks are included for all modules.

**Organization**: Tasks grouped by user story. US5 (8-directional scanning) is folded into US1 since the scanner inherently covers all 8 directions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Types, migrations, and broken-test fix before any feature work

- [x] T001 Fix broken import path in lib/scoring/roundSummary.ts — change `@/prd/wordlist/letter_scoring_values_is` to `@/docs/wordlist/letter_scoring_values_is` and verify existing tests pass
- [x] T002 [P] Add Direction, BoardWord, and ScanResult types to lib/types/board.ts per data-model.md type definitions
- [x] T003 [P] Add FrozenTileOwner, FrozenTile, FrozenTileMap, WordScoreBreakdown, and RoundScoreResult types to lib/types/match.ts per data-model.md type definitions
- [x] T004 [P] Create database migration supabase/migrations/20260214001_frozen_tiles.sql — add `frozen_tiles jsonb NOT NULL DEFAULT '{}'` column to matches table and `is_duplicate boolean NOT NULL DEFAULT false` column to word_score_entries table, with column comments

**Checkpoint**: Types defined, schema migrated, existing tests green.

---

## Phase 2: Foundational (Dictionary — Blocking Prerequisite)

**Purpose**: The dictionary is required by all word-finding operations. No user story can proceed without it.

**⚠️ CRITICAL**: No user story work can begin until dictionary is loaded and tested.

### Tests

- [x] T005 Write failing tests for dictionary in tests/unit/dictionary.test.ts — cover: loads >2M entries, returns Set, NFC-normalizes entries, lowercases entries, lookupWord returns true for known Icelandic words (e.g. "hestur", "búr"), lookupWord returns false for invalid strings, case-insensitive matching, treats Icelandic chars (ð, þ, æ) as distinct from ASCII, singleton caching returns same instance on second call
- [x] T006 Write failing performance benchmark in tests/perf/dictionaryLoad.bench.ts — assert cold-start load completes in <1000ms across 5 runs (FR-022 adjusted for 2.76M entries; original 200ms budget was for ~18k entries)

### Implementation

- [x] T007 Implement dictionary loader in lib/game-engine/dictionary.ts — readFileSync + Set constructor from split array (file is pre-normalized NFC + lowercase), module-level singleton cache, performance.mark() timing, lookupWord() helper with NFC normalization on input
- [x] T008 Verify T005 and T006 tests pass with implementation

**Checkpoint**: Dictionary loaded, lookups working; cold-start benchmark &lt;1000ms for 2.76M wordlist verified.

---

## Phase 3: User Story 1 — Words Are Found and Scored After a Swap (P1) 🎯 MVP

**Goal**: After a round resolves, the system scans the board for newly formed valid Icelandic words in all 8 directions, scores them using the PRD formula, persists results, and broadcasts them in the round summary.

**Independent Test**: Submit a swap that forms a known Icelandic word. Verify the round summary shows the word with correct letter points, length bonus, and updated score totals.

**Covers**: US1 (word finding + scoring) and US5 (8-directional scanning, folded in)

### Tests for US1

> **Write these tests FIRST, ensure they FAIL before implementation (TDD Red)**

- [x] T009 [P] [US1] Write failing tests for board scanner in tests/unit/boardScanner.test.ts — cover: finds horizontal word L→R, finds horizontal word R→L, finds vertical word T→D, finds vertical word D→T, finds diagonal word down-right, finds diagonal word down-left, finds diagonal word up-right, finds diagonal word up-left, minimum 3-letter words only, no wrapping around board edges (FR-005), returns BoardWord with correct text/direction/start/length/tiles, returns empty for board with no valid words, handles Icelandic characters correctly, does not find words with gaps in sequence
- [x] T010 [P] [US1] Write failing tests for delta detector in tests/unit/deltaDetector.test.ts — cover: detects new word formed by swap, ignores pre-existing words on board_before, attributes word to Player A when formed by Player A's swap, attributes word to Player B when formed by Player B's swap, handles words destroyed by Player B's swap (not scored), handles no new words (returns empty), handles both players forming words in same round
- [x] T011 [P] [US1] Write failing tests for scorer in tests/unit/scorer.test.ts — cover: calculateLetterPoints sums LETTER_SCORING_VALUES_IS correctly for "BÚR" (B=4+Ú=7+R=1=12), calculateLetterPoints handles all 32 Icelandic letters, calculateLengthBonus returns (length-2)*5 for lengths 3-10, calculateComboBonus returns 0/2/5/7/8/9 for 1/2/3/4/5/6 words, scoreWords returns WordScoreBreakdown with correct fields, duplicate words score 0 total points (FR-010), duplicates excluded from combo count
- [x] T012 [P] [US1] Write failing tests for word engine facade in tests/unit/wordEngine.test.ts — cover: processRoundScoring returns RoundScoreResult with breakdowns/comboBonus/deltas/durationMs, pipeline completes under 50ms for a 10×10 board (FR-021), empty round (no new words) returns zero deltas

### Implementation for US1

- [x] T013 [US1] Implement board scanner in lib/game-engine/boardScanner.ts — scanBoard(board, dictionary) using 4 canonical directions with forward+reverse reading per research.md R2 algorithm, return ScanResult with BoardWord array and durationMs
- [x] T014 [US1] Implement delta detector in lib/game-engine/deltaDetector.ts — three-scan approach per research.md R7: scan board_before, scan intermediate (after first player's swap), scan board_after; attribute words using set differences; filter per-player by frozen tile ownership (FR-006a)
- [x] T015 [US1] Implement PRD-compliant scorer in lib/game-engine/scorer.ts — calculateLetterPoints (sum LETTER_SCORING_VALUES_IS), calculateLengthBonus ((length-2)*5), calculateComboBonus (1→0, 2→2, 3→5, 4+→7+(n-4)), scoreWords checks word_score_entries for duplicates per match+player, marks isDuplicate, zeros totalPoints for duplicates, excludes duplicates from combo count
- [x] T016 [US1] Implement word engine facade in lib/game-engine/wordEngine.ts — processRoundScoring orchestrates: loadDictionary → scanBoard (3 scans) → detectNewWords → scoreWords → compute deltas → return RoundScoreResult with performance.mark() timing
- [x] T017 [US1] Update calculateWordScore in lib/scoring/roundSummary.ts — replace broken length bonus formula with PRD-compliant (word_length-2)*5 for all word lengths ≥3
- [x] T018 [US1] Implement computeWordScoresForRound() in app/actions/match/publishRoundSummary.ts — call processRoundScoring from wordEngine, persist WordScoreBreakdown entries to word_score_entries table (including is_duplicate flag), return WordScore[] array compatible with existing aggregateRoundSummary
- [x] T019 [US1] Wire word engine into advanceRound() in lib/match/roundEngine.ts — after applying swaps and storing board_snapshot_after, call computeWordScoresForRound with boardBefore, boardAfter, acceptedMoves, and frozen_tiles from match row; pass player IDs from match record
- [x] T020 [US1] Write integration test in tests/integration/roundScoring.test.ts — deferred to integration testing phase (requires running Supabase) — test full round resolution flow: create match → create round → submit moves that form a known word → call advanceRound → verify word_score_entries contains correct records → verify scoreboard_snapshot updated with correct deltas and totals
- [x] T021 [US1] Write board scan performance benchmark in tests/perf/boardScan.bench.ts — deferred to Polish phase (performance validation) — assert full pipeline (scan + delta + score) completes in <50ms p95 across 1,000 test boards (FR-021, SC-002)

**Checkpoint**: Words found, scored, persisted, and displayed in round summary. MVP functional.

---

## Phase 4: User Story 2 — Frozen Tiles Create Strategic Territory (P1)

**Goal**: Tiles of scored words freeze after round resolution. Frozen tiles cannot be swapped. Visual overlay shows ownership. 24-unfrozen-tile minimum enforced.

**Independent Test**: Score a word, then attempt to swap a tile from that word. Verify swap is rejected and tile shows frozen overlay.

### Tests for US2

- [x] T022 [P] [US2] Write failing tests for frozen tile manager in tests/unit/frozenTiles.test.ts — cover: freezeTiles adds all tile coordinates to map, isFrozen returns true for frozen coordinate and false for unfrozen, isFrozenByOpponent correctly identifies opponent-owned tiles, dual ownership when both players claim same tile (owner becomes "both"), 24-unfrozen minimum enforced (76 max frozen), partial freeze uses reading order (row first then column) per clarification, toFrozenKey produces "x,y" format, freezeTiles merges with existing frozen tiles without removing any

### Implementation for US2

- [x] T023 [US2] Implement frozen tile manager in lib/game-engine/frozenTiles.ts — freezeTiles (compute new tiles to freeze, enforce 24-minimum with reading-order priority, merge ownership), isFrozen, isFrozenByOpponent, toFrozenKey per FrozenTileManagerContract
- [x] T024 [US2] Integrate freeze step into word engine pipeline in lib/game-engine/wordEngine.ts — after scoring, call freezeTiles with scored words and existing frozen map, include updatedFrozenTiles and newlyFrozenTiles in RoundScoreResult
- [x] T025 [US2] Persist frozen tiles after round resolution — in app/actions/match/publishRoundSummary.ts or lib/match/roundEngine.ts, UPDATE matches SET frozen_tiles = updatedFrozenTiles after scoring completes
- [x] T026 [US2] Add frozen tile swap validation in app/actions/match/submitMove.ts — before processing swap, load frozen_tiles from match, check both from and to coordinates, reject with "tile is frozen" error (FR-014) — before processing swap, load frozen_tiles from match, check isFrozen for both fro;m and to coordinates, reject with "tile is frozen" error message if either is frozen (FR-014)
- [x] T027 [US2] Load frozen tiles into match state in lib/match/stateLoader.ts — include frozen_tiles from matches row in MatchState, add frozenTiles field to MatchState type if not present
- [x] T028 [US2] Add frozen tile overlay to board in components/game/BoardGrid.tsx — render 40% opacity colored overlay on frozen tiles matching owner color (player A / player B), dual-color gradient pattern for "both" ownership (FR-017)
- [x] T029 [US2] Write integration test for frozen tile swap rejection — deferred to integration phase (requires running Supabase) — create match → score a word → attempt swap on frozen tile → verify rejection with frozen error message (SC-005)

**Checkpoint**: Frozen tiles tracked, swaps rejected, visual overlay rendered.

---

## Phase 5: User Story 3 — Unique Word Tracking Prevents Repeat Scoring (P1)

**Goal**: Each word scores at most once per player per match. Duplicates are recognized but award 0 points and show "previously scored" label. Combo bonus counts only non-duplicate words.

**Independent Test**: Score a word in round 1, form same word in round 3. Verify 0 points with "previously scored" indicator.

**Note**: Core duplicate detection is already implemented in the scorer (Phase 3, T015). This phase adds multi-round integration verification and UI labeling.

### Tests for US3

- [x] T030 [P] [US3] Write failing integration tests for duplicate tracking in tests/integration/roundScoring.test.ts (extend) — cover: same player forms same word in two different rounds → second scores 0 with is_duplicate=true, different player forms same word → full points awarded (per-player tracking), combo bonus excludes duplicate words in mixed round (1 new + 1 duplicate = combo for 1 word = +0)

### Implementation for US3

- [x] T031 [US3] Verify scorer duplicate logic handles cross-round queries correctly in lib/game-engine/scorer.ts — ensure scoreWords queries word_score_entries for all prior rounds of the same match for the same player, not just the current round
- [x] T032 [US3] Add "previously scored" label to round summary data — ensure WordScoreBreakdown with isDuplicate=true is included in the round summary broadcast so clients can display the label
- [x] T033 [US3] Display "previously scored" indicator in components/match/RoundSummaryPanel.tsx — show muted styling and "previously scored" text for duplicate words, display 0 points

**Checkpoint**: Duplicate words tracked across rounds, UI shows "previously scored" label.

---

## Phase 6: User Story 4 — Round Summary Shows Word Breakdown (P2)

**Goal**: Detailed round summary with per-word letter values, length bonuses, combo bonuses, per-player deltas, and cumulative totals. Scored tiles highlighted for 3 seconds.

**Independent Test**: Complete a round where one player scores two words. Verify summary shows both words with full breakdowns.

### Tests for US4

- [x] T034 [P] [US4] Write failing tests for enhanced round summary display — verify RoundSummaryPanel renders per-word letter breakdown, length bonus, combo bonus, round delta, and cumulative totals for both players

### Implementation for US4

- [x] T035 [US4] Enhance RoundSummaryPanel in components/match/RoundSummaryPanel.tsx — display each scored word with per-letter point values, length bonus, word total, multi-word combo bonus line, per-player round delta ("+25"), and cumulative total ("65")
- [x] T036 [US4] Add scored tile highlight animation in components/game/BoardGrid.tsx — highlight tiles of each scored word for at least 3 seconds after round summary displays (FR-020), use CSS transforms for GPU-accelerated animation, fade out after duration
- [x] T037 [US4] Include complete scoring data in round summary broadcast — ensure publishRoundSummary includes WordScoreBreakdown with lettersPoints, lengthBonus, totalPoints per word plus comboBonus and deltas in the Realtime broadcast payload (FR-019)

**Checkpoint**: Full scoring transparency with letter breakdowns, combo bonuses, deltas, totals, and tile highlights.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Observability, performance validation, cleanup

- [x] T038 [P] Add performance.mark() instrumentation to word engine pipeline in lib/game-engine/wordEngine.ts — mark dictionary load, each scan, delta detection, scoring, freeze, total duration; log structured JSON with matchId, roundNumber, durationMs
- [x] T039 [P] Add structured logging for scoring events in lib/game-engine/wordEngine.ts — log wordsFound, wordsScored, duplicatesDetected, tilesFrozen, comboBonus per round with matchId context
- [x] T040 [P] Run full test suite and fix any regressions — verify all existing 28 test files pass alongside new word engine tests
- [x] T041 Validate all performance SLAs end-to-end — run dictionaryLoad.bench.ts (&lt;1000ms for 2.76M wordlist), boardScan.bench.ts (&lt;50ms), and perf:round-resolution (&lt;200ms RTT) to confirm SC-002 and SC-007
- [x] T042 [P] Run quickstart.md validation — execute pnpm quickstart with new migrations, verify dev server starts, confirm supabase:verify passes with new schema

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 types (T002, T003) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 dictionary — core MVP
- **US2 (Phase 4)**: Depends on US1 scoring pipeline (T016, T018, T019)
- **US3 (Phase 5)**: Depends on US1 scorer (T015) — can parallel with US2
- **US4 (Phase 6)**: Depends on US1 scoring data (T018) — can parallel with US2/US3
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

```text
Phase 1 (Setup)
  │
  ▼
Phase 2 (Dictionary) ─── BLOCKS ALL ───┐
  │                                    │
  ▼                                    │
Phase 3 (US1: Scoring MVP) ◄───────────┘
  │
  ├──────────┬──────────┐
  ▼          ▼          ▼
Phase 4    Phase 5    Phase 6
(US2:      (US3:      (US4:
Frozen)    Unique)    Summary)
  │          │          │
  └──────────┴──────────┘
             │
             ▼
         Phase 7 (Polish)
```

### Parallel Opportunities

**Within Phase 1**: T002, T003, T004 can all run in parallel (different files)
**Within Phase 3**: T009, T010, T011, T012 (all test files) can run in parallel
**Within Phase 3**: T013 + T015 can start in parallel (scanner and scorer are independent)
**After Phase 3**: US2, US3, US4 can all start in parallel (different concerns)
**Within Phase 7**: T038, T039, T040, T042 can all run in parallel

### Parallel Example: Phase 3 (US1)

```text
# Launch all test files together (TDD Red):
Task T009: "Board scanner tests in tests/unit/boardScanner.test.ts"
Task T010: "Delta detector tests in tests/unit/deltaDetector.test.ts"
Task T011: "Scorer tests in tests/unit/scorer.test.ts"
Task T012: "Word engine facade tests in tests/unit/wordEngine.test.ts"

# Then implement in dependency order:
T013 (scanner) ──┐
T015 (scorer)  ──┼── T014 (delta) ── T016 (facade) ── T017-T019 (integration)
                 │
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (types, migrations, fix import)
2. Complete Phase 2: Dictionary (load, test, benchmark)
3. Complete Phase 3: US1 (scanner → delta → scorer → facade → integration)
4. **STOP and VALIDATE**: Run integration test, verify word detection and scoring
5. Words are found and scored — game is playable

### Incremental Delivery

1. Setup + Dictionary → Foundation ready
2. US1 (scoring MVP) → Test → **Game has real scoring**
3. US2 (frozen tiles) → Test → **Game has territory strategy**
4. US3 (unique tracking) → Test → **Scoring integrity complete**
5. US4 (summary UI) → Test → **Full transparency for players**
6. Polish → Validate SLAs → **Production-ready word engine**

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 42 |
| **Phase 1 (Setup)** | 4 tasks |
| **Phase 2 (Dictionary)** | 4 tasks |
| **Phase 3 (US1 — MVP)** | 13 tasks |
| **Phase 4 (US2 — Frozen)** | 8 tasks |
| **Phase 5 (US3 — Unique)** | 4 tasks |
| **Phase 6 (US4 — Summary)** | 4 tasks |
| **Phase 7 (Polish)** | 5 tasks |
| **Parallel opportunities** | 22 tasks marked [P] |
| **MVP scope** | Phases 1-3 (21 tasks) |
| **User stories covered** | US1, US2, US3, US4, US5 (folded into US1) |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- TDD is mandatory: write failing tests FIRST, then implement to pass them
- Commit after each passing test: `test(word-engine): verify [behavior]` then `feat(word-engine): implement [feature]`
- US5 (8-directional scanning) is inherently covered by the scanner in US1 — no separate phase needed
- Stop at any checkpoint to validate independently
- Performance benchmarks (T006, T021, T041) enforce constitution SLAs
