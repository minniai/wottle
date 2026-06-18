# Visual Contract: BoardGrid scoring-resolution states

This feature exposes **no HTTP/Server-Action endpoints** — it is a client presentation change. The
contract that must be honored is therefore the **component interface** between `MatchClient` and
`BoardGrid`, plus the CSS classes that encode each visual state. These are the "endpoints" reviewers
and tests assert against.

## Component prop contract (`BoardGrid`)

### New prop

```ts
/**
 * Tiles scored in the CURRENT round, mapped to the scoring player's highlight
 * color. Rendered with a persistent player-colored ring (`scored-current`)
 * that holds until cleared by the parent on round advance. Keys are "x,y".
 */
currentRoundScoredTiles?: Record<string, string>; // default: {} (stable constant)
```

### Changed behavior of existing props

| Prop | Before | After |
|---|---|---|
| `disabled` | Adds `board-grid--locked` → whole-board dim (`opacity 0.45`, `saturate 0.3`) | Adds `board-grid--locked` → calm board **frame** (no dim); still blocks clicks |
| `showLockBanner` | Passed `false` in-match (banner hidden) | Passed `moveLocked` in-match (banner shown while waiting) |
| `lockedTiles` / `opponentLockedTiles` | Lift held until round resolves | Lift is transient: reveal-then-fade, or promote to `currentRoundScoredTiles` if scored |

### Invariants (must hold)

1. When `disabled` is true, no tile is greyed-out/desaturated; all tiles keep full color (FR-001).
2. A tile present in `currentRoundScoredTiles` renders `board-grid__cell--scored-current` with its
   `--highlight-color` set, regardless of whether it is also frozen (FR-007).
3. `currentRoundScoredTiles` entries persist on the board until the parent clears the prop (FR-008);
   BoardGrid applies **no** auto-clear timer to them (unlike the legacy `scoredTileHighlights` path).
4. Clicks on locked/frozen tiles remain inert (FR-003) — unchanged from current `handleTileClick`.

## CSS class contract (`app/styles/board.css`)

| Class | State it encodes | Key visual | Reduced-motion fallback |
|---|---|---|---|
| `.board-grid--locked` (revised) | Player has submitted; waiting | Soft board frame/border (optionally pulsing); **no dim** | Static frame, no pulse |
| `.board-grid__lock-banner` (restyled) | Waiting label | Subtle chip "Move submitted — waiting for opponent" | No entry animation |
| `.board-grid__cell--scored-current` (new) | Tile scored **this** round | Persistent player-colored ring/glow (animate-in, then hold) | Static ring, no animation |
| `.board-grid__cell--frozen` (unchanged) | Tile scored a **previous** round | Calm player tint | n/a (already static) |
| own-swap reveal-fade (new keyframe) | Unscored swapped tile fading out | Lift fades to plain | Instant removal, no fade |

## Pure helper contract (`lib/match/currentRoundScored.ts`)

```ts
/** Build the current-round scored color map from a full round summary. */
buildCurrentRoundScoredFromSummary(
  summary: RoundSummary,
  playerAId: string,
): Record<string, string>;

/** Build the current-round scored color map from a first-mover partial summary. */
buildCurrentRoundScoredFromPartial(
  partial: PartialRoundSummary,
  playerAId: string,
): Record<string, string>;
```

- Both reuse `deriveHighlightPlayerColors` for attribution and return canonical `"x,y"` keys.
- Pure, deterministic, side-effect free → unit-testable in isolation (Constitution VI/VII).
- Merge semantics (idempotent, dedup-safe) live in `MatchClient`; helpers only project one source to
  a map.
