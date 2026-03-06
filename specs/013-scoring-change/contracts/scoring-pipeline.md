# Contract: Scoring Pipeline

**Feature**: 013-scoring-change | **Date**: 2026-03-06

## Overview

Internal module contracts for the refactored scoring pipeline. No new HTTP endpoints — all changes are within existing Server Actions and game engine modules.

---

## scanFromSwapCoordinates

**Module**: `lib/game-engine/boardScanner.ts` (new export)

**Purpose**: Exhaustive orthogonal word discovery from specific swap coordinates.

```typescript
function scanFromSwapCoordinates(
  board: BoardGrid,
  swapCoordinates: Coordinate[],
  dictionary: Set<string>,
): BoardWord[]
```

**Preconditions**:
- `board` is a valid 10×10 `BoardGrid`
- `swapCoordinates` has exactly 2 entries (from/to of the swap)
- `dictionary` is loaded and NFC-normalized

**Postconditions**:
- Returns only words with `direction ∈ {right, left, down, up}` (no diagonals)
- Every returned word contains at least one coordinate from `swapCoordinates`
- Every returned word has `length >= 2`
- All returned words exist in `dictionary`
- Includes overlapping subwords and superwords (exhaustive enumeration)

**Performance**: Must complete in <10ms for a 10×10 board.

---

## selectOptimalCombination

**Module**: `lib/game-engine/crossValidator.ts` (new file)

**Purpose**: Select the highest-scoring subset of candidate words that satisfies the global cross-validation invariant.

```typescript
function selectOptimalCombination(
  candidates: BoardWord[],
  board: BoardGrid,
  frozenTiles: FrozenTileMap,
  dictionary: Set<string>,
  playerSlot: "player_a" | "player_b",
): BoardWord[]
```

**Preconditions**:
- `candidates` are all individually valid dictionary words
- `frozenTiles` reflects the current board state (including first submitter's frozen tiles if processing second submitter)

**Postconditions**:
- Every word in the result passes cross-validation against:
  1. All currently frozen tiles
  2. All other words in the result set
- No valid combination with a higher total score exists
- Empty array if no valid combination exists

**Algorithm**:
1. Filter candidates that fail cross-validation against frozen tiles
2. Generate all subsets of remaining candidates
3. For each subset, verify mutual cross-validation consistency
4. Return the subset with the maximum total score (letter points + length bonus)

---

## processRoundScoring (modified)

**Module**: `lib/game-engine/wordEngine.ts`

**Signature change**:

```typescript
// BEFORE
export async function processRoundScoring(params: {
  matchId: string;
  roundId: string;
  roundNumber?: number;
  boardBefore: BoardGrid;
  boardAfter: BoardGrid;
  acceptedMoves: AcceptedMove[];
  frozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
  priorScoredWordsByPlayer?: PriorScoredWordsByPlayer;
}): Promise<RoundScoreResult>

// AFTER
export async function processRoundScoring(params: {
  matchId: string;
  roundId: string;
  roundNumber?: number;
  boardBefore: BoardGrid;
  acceptedMoves: AcceptedMove[];  // Must include submittedAt
  frozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
}): Promise<RoundScoreResult>
```

**Changes**:
- Removed `boardAfter` — board state is computed internally per-player
- Removed `priorScoredWordsByPlayer` — no text-based duplicate tracking
- `AcceptedMove` now includes `submittedAt: string` for precedence ordering

**New behavior**:
1. Sort `acceptedMoves` by `submittedAt` ascending
2. Process first submitter: apply swap → scan → cross-validate → score → freeze
3. Process second submitter: apply both swaps → scan → cross-validate (with updated frozen tiles) → score → freeze
4. Return merged `RoundScoreResult` without `comboBonus`

---

## freezeTiles (modified)

**Module**: `lib/game-engine/frozenTiles.ts`

**Behavior change**:
- `resolveOwnership()` returns existing owner when a tile is already frozen (first-owner-wins)
- No `"both"` variant in return type
- `FrozenTileOwner = "player_a" | "player_b"`

---

## scoreAttributedWords (modified)

**Module**: `lib/game-engine/wordEngine.ts`

**Changes**:
- Removed `priorScoredWordsByPlayer` parameter
- Removed `isDuplicate` logic — all words score full points
- `WordScoreBreakdown` no longer has `isDuplicate` field

---

## aggregateRoundSummary (modified)

**Module**: `lib/scoring/roundSummary.ts`

**Changes**:
- Removed combo bonus calculation
- Deltas = sum of word totalPoints per player (no combo bonus added)
- `RoundSummary` no longer has `comboBonus` field
