# Data Model: 008-score-delta-popup

**Date**: 2026-02-26

No new persistent entities. All data is derived client-side from the existing `RoundSummary` broadcast.

---

## Client-Only Types

### `ScoreDelta` (client display model)

Defined in `components/match/ScoreDeltaPopup.tsx`. Derived from `RoundSummary` for the current player.

| Field | Type | Description |
|-------|------|-------------|
| `letterPoints` | `number` | Sum of `lettersPoints` across non-duplicate words for the current player in the round |
| `lengthBonus` | `number` | Sum of `bonusPoints` across non-duplicate words for the current player in the round |
| `combo` | `number` | `comboBonus.playerA` or `comboBonus.playerB` based on current player's slot |

**Null semantics**: `deriveScoreDelta()` returns `null` when all three fields are 0. A null delta means no popup is shown.

---

## Derivation Logic (no server changes)

```
deriveScoreDelta(summary: RoundSummary, playerId: string, slot: PlayerSlot): ScoreDelta | null

  playerWords ← summary.words where word.playerId === playerId AND NOT word.isDuplicate
  letterPoints ← sum(playerWords.lettersPoints)
  lengthBonus  ← sum(playerWords.bonusPoints)
  combo        ← slot === "player_a" ? summary.comboBonus?.playerA ?? 0
                                      : summary.comboBonus?.playerB ?? 0

  if letterPoints === 0 AND lengthBonus === 0 AND combo === 0 → return null
  return { letterPoints, lengthBonus, combo }
```

---

## Existing Types Used (unchanged)

- **`RoundSummary`** (`lib/types/match.ts`) — source of scoring data
- **`WordScore`** (`lib/types/match.ts`) — per-word breakdown with `playerId`, `lettersPoints`, `bonusPoints`, `isDuplicate`
- **`ScoreTotals`** (`lib/types/match.ts`) — `playerA`/`playerB` combo bonus container

---

## Invalid Swap Feedback State

Client-only transient state in `BoardGridActive`. No new types needed.

| State | Type | Description |
|-------|------|-------------|
| `invalidTiles` | `[Coordinate, Coordinate] \| null` | The two tile coordinates involved in the rejected swap; null when no rejection is active |

Cleared 400ms after being set (matching CSS animation duration).
