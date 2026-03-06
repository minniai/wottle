# Data Model: Round History & Post-Game Recap

**Branch**: `012-round-history-and-game-recap` | **Date**: 2026-03-06

## Entities

### Extended: WordHistoryRow

Extends the existing `WordHistoryRow` type used by FinalSummary with coordinates and duplicate tracking.

| Field | Type | Description |
|-------|------|-------------|
| roundNumber | number | Round in which the word was scored (1-based) |
| playerId | string | ID of the player who scored the word |
| word | string | The scored word text |
| totalPoints | number | Total points awarded (0 if duplicate) |
| lettersPoints | number | Base letter value points |
| bonusPoints | number | Length bonus: (word_length - 2) * 5 |
| coordinates | Coordinate[] | **NEW** — Tile positions where the word appeared on the board |
| isDuplicate | boolean | **NEW** — True if this word was already scored by this player in a prior round |

**Source**: Extended from existing `WordHistoryRow` in `components/match/FinalSummary.tsx`. New fields sourced from `word_score_entries.tiles` (jsonb) and `word_score_entries.is_duplicate` (boolean) columns already in the database.

### New: RoundHistoryEntry

A computed, display-ready representation of a single round's scoring for both players. Derived client-side from `WordHistoryRow[]` and `ScoreboardRow[]`.

| Field | Type | Description |
|-------|------|-------------|
| roundNumber | number | Round number (1-based) |
| playerA | RoundPlayerSlice | Player A's scoring for this round |
| playerB | RoundPlayerSlice | Player B's scoring for this round |

### New: RoundPlayerSlice

Per-player scoring within a single round.

| Field | Type | Description |
|-------|------|-------------|
| playerId | string | Player identifier |
| username | string | Display name |
| delta | number | Points scored this round (from ScoreboardRow deltas) |
| cumulative | number | Running total after this round (from ScoreboardRow scores) |
| words | WordHistoryRow[] | Words scored by this player in this round |
| comboBonus | number | Combo bonus for this round (derived from non-duplicate word count via `calculateComboBonus()`) |

### New: BiggestSwingCallout

Computed from all rounds — identifies the round with the largest scoring differential.

| Field | Type | Description |
|-------|------|-------------|
| roundNumber | number | Round with the biggest swing |
| swingAmount | number | Absolute difference: |playerA.delta - playerB.delta| |
| favoredPlayerId | string | Player who benefited from the swing |

**Tiebreaker**: Earlier round wins.

### New: HighestScoringWordCallout

Computed from all word entries — identifies the single highest-scoring word across the match.

| Field | Type | Description |
|-------|------|-------------|
| word | string | The word text |
| totalPoints | number | Total points for this word |
| playerId | string | Player who scored it |
| username | string | Display name of the player |
| roundNumber | number | Round it occurred in |

**Tiebreaker**: Earlier round wins. Same round: first player alphabetically by username.

## Existing Entities (Unchanged)

### ScoreboardRow (no changes)

Already used by FinalSummary. Contains per-round cumulative and delta scores.

| Field | Type | Source |
|-------|------|--------|
| roundNumber | number | scoreboard_snapshots.round_number |
| playerAScore | number | scoreboard_snapshots.player_a_score |
| playerBScore | number | scoreboard_snapshots.player_b_score |
| playerADelta | number | scoreboard_snapshots.player_a_delta |
| playerBDelta | number | scoreboard_snapshots.player_b_delta |

**Note**: `playerADelta` and `playerBDelta` are already available in the `scoreboard_snapshots` table and currently fetched by the summary page — no query changes needed for this entity.

### Coordinate (no changes)

Existing type from `lib/types/board.ts`.

| Field | Type | Description |
|-------|------|-------------|
| x | number | Column index (0-based) |
| y | number | Row index (0-based) |

### BoardGrid (string[][]) (no changes)

10x10 grid stored as `rounds.board_snapshot_after` (jsonb). The final round's snapshot provides the board for the summary page.

## Data Flow

```
Database (existing tables, no schema changes)
├── word_score_entries → WordHistoryRow[] (extended with tiles + is_duplicate)
├── scoreboard_snapshots → ScoreboardRow[] (unchanged)
└── rounds (last round) → board_snapshot_after → BoardGrid (new fetch)

Client-side derivation (pure functions, no DB writes)
├── WordHistoryRow[] + ScoreboardRow[] → RoundHistoryEntry[]
├── ScoreboardRow[] → BiggestSwingCallout
├── WordHistoryRow[] → HighestScoringWordCallout
└── WordHistoryRow (single) → highlightPlayerColors (for board highlight)
```

## Validation Rules

- `roundNumber`: Must be 1-based positive integer, ≤ total rounds in match
- `coordinates`: Non-empty array of valid board positions (0 ≤ x,y < 10)
- `totalPoints`: ≥ 0; exactly 0 when `isDuplicate` is true
- `swingAmount`: ≥ 0 (absolute value)
- `comboBonus`: Derived deterministically from non-duplicate word count via `calculateComboBonus()`
