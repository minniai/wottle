# Quickstart: Scoring Rules Overhaul

**Feature**: 013-scoring-change | **Date**: 2026-03-06

## What Changed

The scoring pipeline is being overhauled with these key changes:

1. **Orthogonal-only word scanning from swap coordinates** — words are found by scanning up/down/left/right from the two swapped tile positions, not by scanning the entire board
2. **Exhaustive word enumeration** — all valid words (including subwords) are found, then the highest-scoring valid combination is selected
3. **Time-based precedence** — the first player to submit their move gets scored first; their tiles freeze before the second player's words are evaluated
4. **Exclusive tile ownership** — no more `"both"` ownership; first player to freeze a tile owns it permanently
5. **Cross-validation invariant** — every scored tile adjacent to another scored tile must form a valid word in the perpendicular direction
6. **No combo bonus** — scoring is letter points + length bonus only
7. **Coordinate-based uniqueness** — the same word text can score multiple times at different positions
8. **2-letter minimum** — words of 2+ letters are valid (was 3)

## Key Files

### Game Engine (primary changes)

| File | What Changes |
|------|-------------|
| `lib/game-engine/boardScanner.ts` | New `scanFromSwapCoordinates()` function |
| `lib/game-engine/crossValidator.ts` | **New file** — cross-validation invariant + combination optimization |
| `lib/game-engine/deltaDetector.ts` | Major rewrite — replaced by per-player targeted scanning |
| `lib/game-engine/wordEngine.ts` | Sequential player processing, combo removal, duplicate removal |
| `lib/game-engine/frozenTiles.ts` | Remove `"both"` ownership, first-owner-wins |
| `lib/game-engine/scorer.ts` | Remove `calculateComboBonus()` |

### Types

| File | What Changes |
|------|-------------|
| `lib/types/match.ts` | Remove `"both"` from `FrozenTileOwner`, remove `isDuplicate`, remove `comboBonus` |
| `lib/types/board.ts` | Update JSDoc for 2-letter minimum |
| `lib/constants/game-config.ts` | `minimumWordLength: 2` |

### Scoring & Persistence

| File | What Changes |
|------|-------------|
| `lib/scoring/roundSummary.ts` | Remove combo bonus from aggregation |
| `app/actions/match/publishRoundSummary.ts` | Remove text-based duplicate query, adapt to new pipeline |

### Client Components

| File | What Changes |
|------|-------------|
| `components/match/RoundSummaryPanel.tsx` | Remove combo bonus display |
| `components/match/ScoreDeltaPopup.tsx` | Remove combo line |
| `components/match/deriveScoreDelta.ts` | Remove combo derivation |
| `components/match/deriveRoundHistory.ts` | Remove combo from history |
| `components/match/FinalSummary.tsx` | Remove isDuplicate badges |

## Implementation Order

1. **Foundation**: Types + config changes (FrozenTileOwner, minimumWordLength, remove combo/duplicate types)
2. **Scanner**: New `scanFromSwapCoordinates()` with TDD
3. **Cross-validator**: New `selectOptimalCombination()` with TDD
4. **Pipeline**: Rewrite `processRoundScoring()` for sequential player processing
5. **Frozen tiles**: Update ownership logic (remove "both")
6. **Scoring**: Remove combo bonus, remove text-based duplicates
7. **Persistence**: Update publishRoundSummary, DB migration
8. **Client**: Remove combo/duplicate UI elements
9. **Integration**: End-to-end round scoring tests
10. **Performance**: Verify <50ms word validation, <200ms round RTT

## Running Tests

```bash
# Unit tests for the scoring pipeline
pnpm test:unit -- tests/unit/lib/game-engine/

# Integration tests
pnpm test:integration -- tests/integration/roundScoring.test.ts

# All tests
pnpm test

# Performance
pnpm perf:round-resolution
```

## Architecture Diagram

```
                     ┌─────────────────────────┐
                     │   processRoundScoring()  │
                     │   (wordEngine.ts)        │
                     └────────┬────────────────┘
                              │
                    sort moves by submittedAt
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌──────────────────┐           ┌──────────────────┐
    │ First Submitter   │           │ Second Submitter  │
    │ 1. applySwap()   │           │ 1. applySwap()   │
    │ 2. scanFromSwap  │           │ 2. scanFromSwap  │
    │    Coordinates() │           │    Coordinates() │
    │ 3. selectOptimal │           │ 3. selectOptimal │
    │    Combination() │           │    Combination() │
    │ 4. score words   │           │ 4. score words   │
    │ 5. freezeTiles() │──freeze──▶│ 5. freezeTiles() │
    └──────────────────┘  tiles    └──────────────────┘
              │            fed            │
              │         into #2           │
              └──────────┬────────────────┘
                         ▼
              ┌──────────────────┐
              │  Merge Results   │
              │  (no combo bonus)│
              │  Return Result   │
              └──────────────────┘
```
