# Data Model: Word Engine & Scoring

**Feature Branch**: `003-word-engine-scoring`
**Date**: 2026-02-14

## Entity Relationship Overview

```text
matches (1) ──── (*) rounds (1) ──── (*) word_score_entries
   │                    │                        │
   │ frozen_tiles       │ board_snapshot_before   │ tiles (JSONB coords)
   │ (JSONB)            │ board_snapshot_after     │
   │                    │                        │
   └──── (*) scoreboard_snapshots                │
                                                 │
players (1) ─────────────────────────────────────┘
```

## Entities

### Dictionary (In-Memory Only)

Runtime-only data structure. Not persisted to database.

| Field | Type | Description |
|-------|------|-------------|
| words | `Set<string>` | All valid Icelandic words, NFC-normalized, lowercased |

- **Source**: `docs/wordlist/word_list_is.txt` (~2.76M entries)
- **Lifecycle**: Loaded once at first request, cached as module singleton
- **Validation**: Case-insensitive lookup via pre-lowercased keys
- **Normalization**: Unicode NFC applied at load time; lookups normalize input

### BoardWord (Transient)

In-memory only. Represents a valid word found on the board before scoring rules are applied.

| Field | Type | Description |
|-------|------|-------------|
| text | `string` | The word text (NFC-normalized, lowercase) |
| displayText | `string` | Original-case text for UI display |
| direction | `Direction` | One of 8 cardinal/diagonal directions |
| start | `Coordinate` | Starting tile `{ x, y }` |
| length | `number` | Number of letters (≥3) |
| tiles | `Coordinate[]` | Ordered list of tile coordinates |

- **Direction enum**: `"right" | "left" | "down" | "up" | "down-right" | "down-left" | "up-right" | "up-left"`
- **Identity key**: `${text}:${direction}:${start.x},${start.y}` — uniquely identifies a word instance on the board
- **State transitions**: `candidate → attributed → scored | duplicate`

### WordScoreEntry (Persisted)

Stored in `word_score_entries` table. One row per scored word per player per round.

| Field | DB Column | Type | Description |
|-------|-----------|------|-------------|
| id | `id` | `uuid` | Primary key (auto-generated) |
| matchId | `match_id` | `uuid` | FK → matches |
| roundId | `round_id` | `uuid` | FK → rounds |
| playerId | `player_id` | `uuid` | FK → players |
| word | `word` | `text` | The word text (lowercase) |
| length | `length` | `smallint` | Character count |
| lettersPoints | `letters_points` | `smallint` | Sum of letter values |
| bonusPoints | `bonus_points` | `smallint` | Length bonus: `(length - 2) * 5` |
| totalPoints | `total_points` | `smallint` | `letters_points + bonus_points` (0 if duplicate) |
| tiles | `tiles` | `jsonb` | `[{ x: number, y: number }, ...]` |
| isDuplicate | `is_duplicate` | `boolean` | True if word was previously scored by this player |

**Existing table** — `word_score_entries` already exists in the schema. **New column needed**: `is_duplicate` (boolean, default false).

```sql
ALTER TABLE public.word_score_entries
ADD COLUMN is_duplicate boolean NOT NULL DEFAULT false;
```

### FrozenTileMap (Persisted as JSONB)

Stored as `frozen_tiles` JSONB column on the `matches` table. Tracks cumulative frozen tiles across the match.

| Field | Type | Description |
|-------|------|-------------|
| key | `string` | Coordinate key `"x,y"` |
| owner | `FrozenTileOwner` | `"player_a" \| "player_b" \| "both"` |

**In-memory representation**:

```typescript
type FrozenTileOwner = "player_a" | "player_b" | "both";
type FrozenTileMap = Record<string, { owner: FrozenTileOwner }>;
```

**Database JSONB structure**:

```json
{
  "0,0": { "owner": "player_a" },
  "1,0": { "owner": "player_a" },
  "2,0": { "owner": "both" },
  "5,3": { "owner": "player_b" }
}
```

**Migration** (new column on existing `matches` table):

```sql
ALTER TABLE public.matches
ADD COLUMN frozen_tiles jsonb NOT NULL DEFAULT '{}';
```

**State transitions**:
- `{}` → tiles added after round 1 scoring
- `{ "x,y": { "owner": "player_a" } }` → tile frozen by Player A's word
- If Player B later scores a word using the same tile: owner changes to `"both"`
- Tiles are never unfrozen (monotonically growing)

**Constraints**:
- Maximum frozen tiles: 76 (100 board tiles - 24 minimum unfrozen per FR-016)
- Freeze order: reading order (row first, then column) when partial freeze required

### ScoreboardSnapshot (Persisted)

Existing table — no schema changes needed.

| Field | DB Column | Type | Description |
|-------|-----------|------|-------------|
| id | `id` | `uuid` | Primary key |
| matchId | `match_id` | `uuid` | FK → matches |
| roundNumber | `round_number` | `smallint` | Round that produced this snapshot |
| playerAScore | `player_a_score` | `integer` | Cumulative score for Player A |
| playerBScore | `player_b_score` | `integer` | Cumulative score for Player B |
| playerADelta | `player_a_delta` | `integer` | Points earned this round by Player A |
| playerBDelta | `player_b_delta` | `integer` | Points earned this round by Player B |
| generatedAt | `generated_at` | `timestamptz` | When the snapshot was created |

### ComboBonus (Computed, Not Persisted)

Calculated at scoring time. Not stored separately — folded into the round delta.

| Word Count | Bonus |
|-----------|-------|
| 1 | +0 |
| 2 | +2 |
| 3 | +5 |
| 4+ | +7 + (n - 4) |

Only **non-duplicate** words count toward the combo word count.

## Database Migrations Required

### Migration 1: Add frozen_tiles to matches

```sql
-- Add frozen tile tracking to matches table
ALTER TABLE public.matches
ADD COLUMN frozen_tiles jsonb NOT NULL DEFAULT '{}';

-- Add index for frozen tile queries (optional, matches are fetched by PK)
COMMENT ON COLUMN public.matches.frozen_tiles IS
  'Cumulative frozen tile map. Keys are "x,y" coordinate strings. Values have owner: player_a | player_b | both.';
```

### Migration 2: Add is_duplicate to word_score_entries

```sql
-- Track duplicate word scoring
ALTER TABLE public.word_score_entries
ADD COLUMN is_duplicate boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.word_score_entries.is_duplicate IS
  'True when this word was previously scored by the same player in an earlier round of the same match. Total points will be 0.';
```

## Validation Rules

### Word Validation

- Word text MUST be ≥3 characters
- Word MUST exist in dictionary (NFC-normalized, case-insensitive)
- Word MUST be contiguous in a straight line on the board
- Word MUST NOT wrap around board edges
- Word MUST NOT contain opponent's frozen tiles (per FR-006a)
- Word MUST be newly formed (not present on pre-round board)

### Frozen Tile Validation

- A swap MUST be rejected if either the `from` or `to` coordinate is in the frozen tile map
- Frozen tiles MUST NOT be removed or reassigned (monotonic growth)
- When freezing would leave <24 unfrozen tiles, freeze in reading order up to the limit
- A tile owned by `"player_a"` that is also claimed by Player B becomes `"both"`

### Scoring Validation

- Letter points MUST match `LETTER_SCORING_VALUES_IS` for each character
- Length bonus MUST equal `(length - 2) * 5`
- Duplicate words (per-player-per-match) MUST score 0 total points
- Combo bonus counts only non-duplicate words
- Round delta MUST equal sum of all word totals + combo bonus
- Cumulative total MUST equal previous total + round delta

## Type Definitions

### New Types (lib/types/board.ts)

```typescript
export type Direction =
  | "right" | "left"
  | "down" | "up"
  | "down-right" | "down-left"
  | "up-right" | "up-left";

export interface BoardWord {
  text: string;
  displayText: string;
  direction: Direction;
  start: Coordinate;
  length: number;
  tiles: Coordinate[];
}

export interface ScanResult {
  words: BoardWord[];
  scannedAt: number; // performance.now() timestamp
  durationMs: number;
}
```

### New Types (lib/types/match.ts)

```typescript
export type FrozenTileOwner = "player_a" | "player_b" | "both";

export interface FrozenTile {
  owner: FrozenTileOwner;
}

export type FrozenTileMap = Record<string, FrozenTile>;

export interface WordScoreBreakdown {
  word: string;
  length: number;
  lettersPoints: number;
  lengthBonus: number;
  totalPoints: number;
  isDuplicate: boolean;
  tiles: Coordinate[];
  playerId: string;
}

export interface RoundScoreResult {
  playerAWords: WordScoreBreakdown[];
  playerBWords: WordScoreBreakdown[];
  comboBonus: { playerA: number; playerB: number };
  deltas: ScoreTotals;
  newFrozenTiles: FrozenTileMap;
}
```
