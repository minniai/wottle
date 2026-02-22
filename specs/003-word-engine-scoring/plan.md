# Implementation Plan: Word Engine & Scoring

**Branch**: `003-word-engine-scoring` | **Date**: 2026-02-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-word-engine-scoring/spec.md`

## Summary

Implement the core word-finding engine, PRD-compliant scoring formula, unique word tracking, and frozen tile mechanics. The engine loads a ~2.76M-entry Icelandic dictionary into an in-memory Set, scans a 10×10 board in 8 directions, detects newly formed words via delta comparison against the pre-round board state, scores them using the PRD formula (letter values + length bonus + combo bonus), and freezes claimed tiles with ownership tracking. Integrates into the existing round resolution flow by replacing the `computeWordScoresForRound()` placeholder.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20.x
**Primary Dependencies**: Next.js 16 (App Router), React 19, Supabase JS, Zod, Vitest, Playwright
**Storage**: Supabase PostgreSQL 15+ (existing tables: `word_score_entries`, `scoreboard_snapshots`, `rounds`, `matches`; new: `frozen_tiles` JSONB column on `matches`)
**Testing**: Vitest (unit + integration), Playwright (E2E), Artillery (performance)
**Target Platform**: Linux server (Vercel), modern browsers
**Project Type**: Web application (Next.js monorepo)
**Performance Goals**: Word validation <50ms server-side (p95), dictionary load <1000ms (FR-022, adjusted for 2.76M entries), move RTT <200ms (p95), 60 FPS tile animations
**Constraints**: Dictionary server-side only (never exposed to client), all scoring server-authoritative, 10×10 board fixed size, Icelandic Unicode NFC normalization required
**Scale/Scope**: Single concurrent match per server instance (playtest), ~2.76M dictionary entries, 10 rounds per match, up to 100 tiles per board

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative (NON-NEG) | PASS | All word validation, scoring, and freeze logic execute server-side via Server Actions. Dictionary never sent to client. |
| II. Real-Time Performance (NON-NEG) | PASS | FR-021 (<50ms validation), FR-022 (<1000ms dict load), FR-023 (<200ms RTT) directly encode SLAs. Performance tests required. |
| III. Type-Safe End-to-End | PASS | New types in `lib/types/` for BoardWord, FrozenTileMap. Server Actions have explicit return types. Zod validation on inputs. |
| IV. Progressive Enhancement | PASS | Frozen tile overlay uses CSS (GPU-accelerated). Scoring display degrades gracefully. No new mobile concerns. |
| V. Observability & Resilience | PASS | Dictionary load time logged via `performance.mark()`. Scan duration instrumented. Structured logs for word scoring events. |
| VI. Clean Code | PASS | Pure functions for scanner, scorer, delta detector. Single-responsibility modules. <20 lines per function target. |
| VII. TDD (NON-NEG) | PASS | All modules built test-first. Unit tests for Trie/Set, scanner, scorer. Integration tests for round flow. Perf benchmarks. |
| VIII. External Context (Context7) | N/A | No new external libraries beyond existing stack. |
| IX. Commit Standards | PASS | `test(word-engine):` → `feat(word-engine):` commit pattern per TDD cycle. |

**Gate Result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-word-engine-scoring/
├── plan.md              # This file
├── research.md          # Phase 0: data structure decisions, algorithm analysis
├── data-model.md        # Phase 1: entity schemas, frozen tile migration
├── quickstart.md        # Phase 1: dev setup for this feature
├── contracts/           # Phase 1: internal API contracts
│   └── word-engine.ts   # TypeScript interface contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
lib/game-engine/
├── board.ts             # [EXISTING] Board grid utilities, swap operations
├── mutations.ts         # [EXISTING] Legacy DB persistence
├── dictionary.ts        # [NEW] Dictionary loader (Set-based, NFC-normalized)
├── boardScanner.ts      # [NEW] 8-directional word finder
├── deltaDetector.ts     # [NEW] Pre-round vs post-round word diff
├── scorer.ts            # [NEW] PRD-compliant scoring formula
├── frozenTiles.ts       # [NEW] Frozen tile tracking, validation, ownership
└── wordEngine.ts        # [NEW] Facade: orchestrates scan → delta → score → freeze

lib/scoring/
├── roundSummary.ts      # [MODIFY] Fix scoring formula to match PRD
└── highlights.ts        # [EXISTING] Coordinate highlighting utilities

lib/match/
├── roundEngine.ts       # [MODIFY] Wire word engine into advanceRound()
├── stateLoader.ts       # [MODIFY] Load frozen tiles into match state
└── ...                  # [EXISTING] Other match modules unchanged

lib/types/
├── board.ts             # [MODIFY] Add BoardWord, Direction, ScanResult types
└── match.ts             # [MODIFY] Add FrozenTile, FrozenTileMap, WordScoreBreakdown types

app/actions/
├── match/
│   └── publishRoundSummary.ts  # [MODIFY] Implement computeWordScoresForRound()
└── match/submitMove.ts         # [MODIFY] Add frozen tile swap validation

components/
├── game/
│   └── BoardGrid.tsx           # [MODIFY] Add frozen tile overlay, scored tile highlight
└── match/
    └── RoundSummaryPanel.tsx    # [MODIFY] Enhanced word breakdown display

supabase/migrations/
└── YYYYMMDD_frozen_tiles.sql   # [NEW] Add frozen_tiles JSONB column to matches

tests/
├── unit/lib/game-engine/
│   ├── dictionary.test.ts        # [NEW] Dictionary load, lookup, normalization
│   ├── dictionaryErrors.test.ts  # [NEW] DictionaryLoadError class (FR-001a)
│   ├── boardScanner.test.ts      # [NEW] 8-direction scanning, edge wrapping
│   ├── deltaDetector.test.ts     # [NEW] New word detection, pre-existing filtering
│   ├── scorer.test.ts            # [NEW] PRD formula, combo bonuses, duplicate handling
│   ├── frozenTiles.test.ts       # [NEW] Freeze, validate, ownership, 24-tile minimum
│   ├── wordEngine.test.ts        # [NEW] Full pipeline integration
│   ├── retry.test.ts             # [NEW] Retry wrapper, ScoringPipelineError (FR-026)
│   └── atomicFrozenTiles.test.ts # [NEW] Atomic update contract (FR-027)
├── integration/
│   └── roundScoring.test.ts      # [NEW] Round engine + scoring end-to-end
└── perf/
    ├── dictionaryLoad.bench.ts   # [NEW] <1000ms cold start benchmark
    └── boardScan.bench.ts        # [NEW] <50ms scan benchmark
```

**Structure Decision**: Follows existing `lib/game-engine/` pattern established in spec 001. New modules are pure functions organized by domain responsibility. The `wordEngine.ts` facade coordinates the pipeline without leaking internal module dependencies.

## Complexity Tracking

No constitution violations requiring justification. All modules follow existing patterns.

## Architecture Overview

### Data Flow: Round Resolution with Word Scoring

```text
submitMove()
  → advanceRound(matchId)
    → resolveConflicts(submissions)
    → applySwap(board, move) × N accepted moves
    → computeWordScoresForRound(matchId, roundId, boardBefore, boardAfter, moves, frozenTiles)
      → loadDictionary()                    [singleton, cached]
      → scanBoard(boardAfter, frozenTiles)  [8-direction scan, ownership-aware]
      → scanBoard(boardBefore, frozenTiles) [same scan on pre-round board]
      → detectNewWords(wordsBefore, wordsAfter) [set difference]
      → attributeWordsToPlayers(newWords, moves) [per-player word sets]
      → filterDuplicates(playerWords, matchId)   [check word_score_entries]
      → scoreWords(uniqueNewWords)               [PRD formula]
      → freezeTiles(scoredWords, existingFrozen)  [ownership + 24-tile minimum]
      → persistResults(scores, frozenTiles)       [word_score_entries + matches.frozen_tiles]
    → publishRoundSummary(matchId, roundNumber)
      → aggregateRoundSummary(...)
      → broadcast via Realtime
```

### Dictionary Lifecycle

```text
Server startup → loadDictionary()
  → Read docs/wordlist/word_list_is.txt (streaming)
  → NFC-normalize each line
  → Lowercase each entry
  → Insert into Set<string>
  → Cache as module-level singleton
  → Log load time via performance.mark()

Subsequent calls → return cached Set (O(1))
```

### Frozen Tile State Flow

```text
Match start: frozen_tiles = {}

Each round resolution:
  1. Load current frozen_tiles from matches.frozen_tiles (JSONB)
  2. Scanner uses frozen_tiles to filter per-player word candidates (FR-006a)
  3. After scoring, compute new tiles to freeze
  4. Enforce 24-unfrozen minimum (FR-016, reading order priority)
  5. Merge new frozen tiles into existing map with ownership
  6. Persist updated frozen_tiles back to matches row
  7. Broadcast frozen_tiles in match state update

Swap validation:
  1. Load frozen_tiles from matches row
  2. Check if either from/to coordinate is in frozen map
  3. If frozen → reject with "tile is frozen" error
```
