# Phase 1 Data Model: Improve Scoring Resolution Visualization

This feature introduces **no persisted data** and **no new shared `/lib/types` contracts on the
wire**. The "model" here is client-only React view-state plus one new component prop. All inputs are
existing match state already broadcast to the client.

## Inputs (existing — consumed, not changed)

| Entity | Source | Shape | Used for |
|---|---|---|---|
| `RoundSummary` | `matchState.lastSummary` | `{ matchId, roundNumber, words[], highlights: Coordinate[][], totals, deltas, ... }` | Full round scored words + per-word coordinates |
| `PartialRoundSummary` | `matchState.partialSummary` | `{ firstMoverId, firstSubmissionAt, words[] }` | First mover's mid-round scored words (spec 042) |
| `FrozenTileMap` | `matchState.frozenTiles` | `Record<"x,y", { owner: "player_a"\|"player_b" }>` | Previously-scored / frozen tiles (the "previous rounds" visual) |
| `pendingMoves` | `matchState.pendingMoves` | `Array<{ playerId, from, to, submittedAt }>` | Opponent swap reveal (issue #210) |
| `currentRound` | `matchState.currentRound` | `number` | Round-advance boundary that clears current-round marks |
| Player colors | `lib/constants/playerColors.ts` | CSS color strings per slot | Attributing the glow to the scoring player |

## New client view-state (in `MatchClient.tsx`)

### `currentRoundScored: Record<"x,y", string>`
- **Represents**: tiles scored in the **current** round, mapped to the scoring player's highlight
  color. The persistent "scored this round" marker.
- **Populated by**:
  - the partial-reveal effect (first mover, mid-round) — merge in `partial.words` coordinates;
  - the `lastSummary` effect (full round) — merge in `summary.words` coordinates.
- **Cleared by**: the existing round-reset effect keyed on `matchState.currentRound`
  (`MatchClient.tsx:628-634`).
- **Validation/rules**:
  - Keys use the canonical `"x,y"` string form already used by `frozenTiles` and
    `highlightPlayerColors`.
  - Merges are idempotent and dedup-guarded (reuse `buildPartialRevealKey` /
    `animatedPartialRevealsRef`) so the same tile is not re-added or recolored when partial + full
    summaries describe the same first-mover word (FR-011 — no re-flash / no attribution change).
  - Color attribution is deterministic via `deriveHighlightPlayerColors(words, playerAId)`.

### Swap-reveal lifecycle (refinement of existing state)
- `lockedSwapTiles` / `opponentSwapTiles` remain the swap-lift coordinates, but become **transient**:
  cleared after a short reveal window (timer) or promoted into `currentRoundScored` when the tile is
  part of a scored word.
- `moveLocked` stays decoupled and remains `true` until the round resolves (drives the waiting
  state), independent of the swap-lift fade.

## New component prop (in `BoardGrid.tsx`)

### `currentRoundScoredTiles?: Record<"x,y", string>`
- **Represents**: same map as `currentRoundScored`, passed down so BoardGrid can render the
  persistent `.board-grid__cell--scored-current` ring with per-tile `--highlight-color`.
- **Default**: `{}` (use a stable empty-object constant to avoid effect re-run loops, mirroring
  `EMPTY_HIGHLIGHTS` at `BoardGrid.tsx:132`).
- **Rendering rule**: a tile is current-round-scored when `currentRoundScoredTiles["x,y"]` exists;
  it then receives the `scored-current` class and CSS var. This is independent of (and stacks
  correctly with) the frozen tint so a tile can be both "frozen" (server) and "current-round-scored"
  (bright ring) during the resolving window.

## State transitions

```text
Round in progress (collecting)
  player submits swap
    → moveLocked = true                       (waiting frame + banner appear; board click-locked)
    → lockedSwapTiles = [from, to]            (brief reveal lift)

First mover scored (partialSummary arrives)
    → merge first mover words into currentRoundScored   (persistent bright ring on those tiles)
    → swap-lift tiles that are in a scored word promote to scored-current; others fade out

Round resolves (lastSummary arrives)
    → merge all scored words into currentRoundScored     (dedup-guarded vs partial)
    → unscored swap-lift tiles fade to plain
    → scoreDelta / recap play as today

Round advances (currentRound increments)
    → clear currentRoundScored                 (bright marks removed)
    → scored tiles now show only frozen tint    ("previous rounds" look — settle)
    → moveLocked = false, lockedSwapTiles = null (waiting frame + banner removed)
```

## Reduced-motion variants

Every new visual (waiting frame, `scored-current` ring, swap reveal-fade) has a static
`prefers-reduced-motion` equivalent that conveys the same state without animation (FR-013), matching
the existing reduced-motion blocks in `app/styles/board.css`.
