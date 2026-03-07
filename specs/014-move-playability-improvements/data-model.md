# Data Model: Move Playability Improvements

**Branch**: `014-move-playability-improvements`
**Date**: 2026-03-07

## No New Database Tables or Columns

This feature is entirely client-side UI and existing server-side data. No schema migrations required.

## Modified Types

### RoundSummary (extended)

**File**: `lib/types/match.ts`

```typescript
export interface RoundSummary {
  matchId: string;
  roundNumber: number;
  words: WordScore[];
  deltas: ScoreTotals;
  totals: ScoreTotals;
  highlights: Coordinate[][];
  resolvedAt: string;
  // NEW: Accepted moves for opponent move reveal
  moves: RoundMove[];
}

export interface RoundMove {
  playerId: string;
  from: Coordinate;
  to: Coordinate;
}
```

**Validation**: No Zod schema change needed — RoundSummary is constructed server-side and broadcast via Realtime (not a Server Action input).

### AnimationPhase (extended)

**File**: `components/match/MatchClient.tsx` (local type)

```typescript
type AnimationPhase =
  | "idle"
  | "revealing-opponent-move"  // NEW: Orange fade on opponent's swapped tiles
  | "highlighting"
  | "showing-summary";
```

**State transitions**:
```
idle
  → revealing-opponent-move  (onSummary callback fires)
  → highlighting             (after ~1000ms opponent reveal)
  → showing-summary          (after ~800ms scored-tile highlight)
  → idle                     (player dismisses summary)
```

## Client-Side State (no persistence)

### Move Lock State

Managed in `MatchClient` component state:

```typescript
// Whether the current player has submitted this round
moveLocked: boolean;

// The two tile coordinates that were swapped (for orange highlight)
lockedSwapTiles: [Coordinate, Coordinate] | null;
```

**Lifecycle**:
- Set to `true` + coordinates on successful move submission
- Reset to `false` + `null` when `matchState.currentRound` increments (next round begins)

### Opponent Move Reveal State

Managed in `MatchClient` component state:

```typescript
// Opponent's swapped tile coordinates (for fade-out animation)
opponentRevealTiles: [Coordinate, Coordinate] | null;
```

**Lifecycle**:
- Set from `RoundSummary.moves` (filtered to opponent's move) when round summary arrives
- Cleared after reveal animation completes (~1000ms)

## Existing Data Used (no changes)

| Data | Source | Usage |
|------|--------|-------|
| `LETTER_SCORING_VALUES_IS` | `docs/wordlist/letter_scoring_values_is.ts` | Tile score value display |
| `frozenTiles` (FrozenTileMap) | `matches.frozen_tiles` JSONB column | FinalSummary board colors |
| `TimerState.status` | Derived in `stateLoader.ts` | Timer panel color |
| `move_submissions.from_x/y, to_x/y` | `move_submissions` table | Populates `RoundSummary.moves` |
