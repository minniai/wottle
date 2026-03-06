# Data Model: Scoring Rules Overhaul

**Feature**: 013-scoring-change | **Date**: 2026-03-06 | **Phase**: 1

## Entity Changes

### Modified Entities

#### FrozenTile (type change)

```
FrozenTile
  owner: FrozenTileOwner     ← CHANGE: remove "both" variant
```

- **Before**: `FrozenTileOwner = "player_a" | "player_b" | "both"`
- **After**: `FrozenTileOwner = "player_a" | "player_b"`
- **Rule**: First player to freeze a tile owns it permanently (FR-008, FR-009)
- **Migration**: Existing `"both"` values → `"player_a"` (deterministic fallback)

#### AcceptedMove (field addition)

```
AcceptedMove
  playerId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  submittedAt: string         ← NEW: ISO timestamp for precedence ordering
```

- **Rule**: Moves are processed in `submittedAt` order within each round (FR-005)
- **Source**: Already available in `move_submissions.created_at` column

#### WordScoreBreakdown (field removal)

```
WordScoreBreakdown
  word: string
  length: number              ← JSDoc: "≥2" (was "≥3")
  lettersPoints: number
  lengthBonus: number
  totalPoints: number
  tiles: Coordinate[]
  playerId: string
  ─ isDuplicate: boolean      ← REMOVED (FR-015/FR-016: coordinate-based uniqueness)
```

#### WordScore (field removal)

```
WordScore
  playerId: string
  word: string
  length: number
  lettersPoints: number
  bonusPoints: number
  totalPoints: number
  coordinates: Coordinate[]
  ─ isDuplicate?: boolean     ← REMOVED
```

#### RoundScoreResult (field removal)

```
RoundScoreResult
  playerAWords: WordScoreBreakdown[]
  playerBWords: WordScoreBreakdown[]
  ─ comboBonus: { playerA: number; playerB: number }   ← REMOVED (FR-017)
  deltas: ScoreTotals
  newFrozenTiles: FrozenTileMap
  wasPartialFreeze: boolean
  durationMs: number
```

#### RoundSummary (field removal)

```
RoundSummary
  matchId: string
  roundNumber: number
  words: WordScore[]
  deltas: ScoreTotals
  totals: ScoreTotals
  ─ comboBonus?: ScoreTotals   ← REMOVED (FR-017)
  highlights: Coordinate[][]
  resolvedAt: string
```

#### GameConfig (value change)

```
GameConfig
  minimumWordLength: 2         ← CHANGE: was 3 (FR-004)
```

#### BoardWord (JSDoc update only)

```
BoardWord
  length: number               ← JSDoc: "≥2" (was "≥3")
```

### New Entities

#### SwapScanResult

```
SwapScanResult
  playerId: string
  swapCoordinates: Coordinate[]     ← The two positions involved in the swap
  candidateWords: BoardWord[]       ← All valid words found through swap coords
  selectedWords: BoardWord[]        ← Subset passing cross-validation optimization
  frozenTilesSnapshot: FrozenTileMap ← Frozen state at time of evaluation
```

- **Purpose**: Intermediate result of the per-player scanning phase
- **Lifecycle**: Created during `processRoundScoring()`, consumed for scoring, not persisted

## State Transitions

### Tile Ownership Lifecycle (simplified)

```
[unfrozen] ──(player scores word containing tile)──→ [frozen: player_a | player_b]
[frozen: player_X] ──(any future round)──→ [frozen: player_X]  (immutable)
```

No transition from `frozen: player_a` to `frozen: player_b` or `frozen: both`.

### Round Scoring Sequence (new)

```
[moves submitted]
  → sort by submittedAt
  → [process first submitter]
    → scan from swap coords
    → enumerate candidates
    → cross-validate against frozen tiles
    → select optimal combination
    → score words
    → freeze tiles (update FrozenTileMap)
  → [process second submitter]
    → scan from swap coords (sees first submitter's frozen tiles)
    → enumerate candidates
    → cross-validate against ALL frozen tiles (prior + first submitter)
    → select optimal combination
    → score words (opponent tiles = zero letter points)
    → freeze tiles
  → [merge results]
    → combine both players' word breakdowns
    → compute deltas (no combo bonus)
    → return RoundScoreResult
```

## Validation Rules

| Rule | Entity | Constraint |
|------|--------|------------|
| Min word length | BoardWord | `length >= 2` |
| Orthogonal only | BoardWord | `direction ∈ {right, left, down, up}` |
| Contains swap coord | BoardWord | At least one tile coordinate matches a swap coordinate |
| Exclusive ownership | FrozenTile | `owner ∈ {player_a, player_b}` — no `"both"` |
| Immutable ownership | FrozenTile | Once set, `owner` never changes |
| Cross-validation | BoardWord set | Every scored tile adjacent to another scored tile must form a valid dictionary word in the perpendicular direction |
| Unfrozen minimum | FrozenTileMap | `BOARD_TILE_COUNT - |frozenTiles| >= 24` |
| Precedence | AcceptedMove | Processed in `submittedAt` ascending order |

## Database Schema Changes

### Migration: Remove "both" from frozen_tiles

```sql
-- Update existing "both" entries to "player_a" (deterministic fallback)
UPDATE matches
SET frozen_tiles = (
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN value->>'owner' = 'both' THEN jsonb_build_object('owner', 'player_a')
      ELSE value
    END
  )
  FROM jsonb_each(frozen_tiles)
)
WHERE frozen_tiles::text LIKE '%"both"%';
```

### Migration: Drop is_duplicate column (optional)

```sql
-- Option A: Drop column
ALTER TABLE word_score_entries DROP COLUMN IF EXISTS is_duplicate;

-- Option B: Keep column, set default false (safer for rollback)
ALTER TABLE word_score_entries ALTER COLUMN is_duplicate SET DEFAULT false;
```
