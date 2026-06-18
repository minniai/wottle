# Phase 0 Research: Improve Scoring Resolution Visualization

All Technical Context unknowns were resolved during `/speckit.specify` (the three open UX decisions
were answered by the user and recorded in the spec's Assumptions). This document captures the
codebase research that grounds the implementation decisions. No external (Context7) lookups were
required — the change is internal CSS/React only.

## Current behavior (as-is), with source anchors

### A. Waiting state (whole-board grey-out)

- **Decision point**: `BoardGrid` adds `board-grid--locked` to the grid container when `disabled` is
  true (`components/game/BoardGrid.tsx:370-377`). `MatchClient` passes `disabled={moveLocked}` and
  `showLockBanner={false}` (`components/match/MatchClient.tsx:1085-1086`).
- **Styling**: `.board-grid--locked .board-grid__cell { opacity: 0.45; filter: saturate(0.3); }`
  (`app/styles/board.css:190-198`) — this is the unappealing dim called out by the proposal.
- **Banner**: `.board-grid__lock-banner` exists and is centered/overlaid (`board.css:255-291`), but is
  currently never shown in-match (`showLockBanner={false}`).

### B. Scored-tile highlight (no current-vs-previous distinction)

- Scored tiles animate with `.board-grid__cell--scored` → `scored-tile-highlight` 700ms one-shot
  (`board.css:317-351`), colored by `--highlight-color`.
- `MatchClient` only feeds `scoredTileHighlights` / `highlightPlayerColors` to BoardGrid while
  `animationPhase === "round-recap"` (`MatchClient.tsx:1094-1103`), and a timer reverts
  `animationPhase` to `idle` after `announceDurationMs` (1200ms, or 2400ms on match end)
  (`MatchClient.tsx:360-366`). After that window the glow disappears.
- **Gap**: once the glow clears, current-round tiles are indistinguishable from earlier rounds —
  both show only the frozen tint `.board-grid__cell--frozen` (`board.css:298-315`) driven by
  `matchState.frozenTiles` (`MatchClient.tsx:1083`). There is **no** persistent "scored this round"
  marker.

### C. Swap reveal lift (persists to round end)

- Own swap: `lockedTiles` → `.board-grid__cell--locked` (player-hued lift, `board.css:214-229`),
  held until the recap timer clears `lockedSwapTiles` (`MatchClient.tsx:347-366`).
- Opponent swap: `opponentLockedTiles` → `.board-grid__cell--opponent-locked` (`board.css:235-253`),
  set in the issue-#210 effect (`MatchClient.tsx:683-706`), also held until round resolves.
- **Gap**: swapped tiles that score nothing keep their lift for the whole round; the proposal wants
  them to reveal then fade.

### D. Instant-scoring fast path (spec 042) — must stay consistent

- `partialSummary` arrives mid-`collecting`; the effect at `MatchClient.tsx:646-677` derives colors
  (`deriveHighlightPlayerColors`) and highlights (`deriveRevealHighlightsFromPartial`,
  `lib/match/partialReveal.ts`), sets `animationPhase = "round-recap"`, plays the discovery sound,
  and auto-reverts to `idle` after 1200ms **unless** `lastSummary` has taken over.
- Dedupe via `animatedPartialRevealsRef` + `animatedOpponentMoveKeysRef`
  (`MatchClient.tsx:166-173, 651-654`) prevents a double-flash when the full `lastSummary` lands.
- **Implication**: the new persistent current-round marker must be fed from BOTH the partial-reveal
  effect and the `lastSummary` effect, using the same dedupe key shape, so the first mover's words
  persist from mid-round through round completion with no re-flash or color change.

### E. Round-advance reset boundary (reuse this)

- An effect keyed on `matchState.currentRound` already resets per-round dedupe sets
  (`MatchClient.tsx:628-634`). This is the natural place to clear the new current-round scored map so
  that, on round advance, those tiles fall back to the frozen tint (US1 settle behavior).

## Decisions

### D1. Persistence boundary for current-round scored marks
- **Decision**: Hold current-round scored marks until `matchState.currentRound` advances, then clear
  them in the existing round-reset effect (`MatchClient.tsx:628-634`).
- **Rationale**: Scored tiles freeze server-side, so after the round they already appear in
  `matchState.frozenTiles` with the calm tint. Clearing the bright marker on round advance yields the
  exact "settle into previously-scored look" behavior (FR-009) with no extra state.
- **Alternatives considered**: (a) Auto-clear after a fixed timeout — rejected, reintroduces the
  premature-clear problem (FR-008). (b) Track a per-tile "round scored in" number and diff — rejected
  as unnecessary; the frozen map already encodes "previous", and "current" is a single transient set.

### D2. Distinct visual for current-round scored vs frozen
- **Decision**: New CSS class `.board-grid__cell--scored-current` — a persistent player-colored
  ring/glow (animates in once, then holds) that is visually louder than the flat frozen tint. Fed by
  a new BoardGrid prop `currentRoundScoredTiles: Record<"x,y", color>`.
- **Rationale**: Keeps "current" (bright ring) cleanly separable from "previous" (frozen tint) using
  the established per-tile `--highlight-color` CSS-var mechanism and player colors from
  `lib/constants/playerColors.ts`.
- **Alternatives considered**: Reusing the existing one-shot `.board-grid__cell--scored` with a long
  duration — rejected; its keyframes fade the ring to `0 0 0 0` at 100% (`board.css:344-349`), so it
  cannot hold a steady ring, and stacking it with a static class causes box-shadow conflicts.

### D3. Waiting indicator without dim
- **Decision**: Replace the `opacity/saturate` dim in `.board-grid--locked` with a calm board
  **frame** (soft, optionally pulsing border on the grid container) and surface the existing banner
  by passing `showLockBanner={moveLocked}`; restyle the banner to a less obtrusive chip.
- **Rationale**: Matches the user's chosen "framed board + banner" option; keeps tiles legible
  (FR-001) while clearly signaling the locked/waiting state (FR-002). Click-blocking stays via
  `disabled`/`aria-disabled` and the existing `handleTileClick` guard (FR-003).
- **Alternatives considered**: Status-chip-only and lighter-dim options — rejected by the user.

### D4. Swap reveal-then-fade
- **Decision**: Decouple the visual swap lift from the move-lock. Keep `moveLocked` true until the
  round resolves (waiting state), but clear the swap-lift coordinates (`lockedSwapTiles` /
  `opponentSwapTiles`) after a short reveal window via a timer, OR transition the tiles into
  `currentRoundScoredTiles` when they belong to a scored word. Add a fade-out animation for the
  own-swap lift analogous to the existing `opponent-reveal-fade` keyframe (`board.css:161-180`).
- **Rationale**: Implements "stay a few seconds or until scored words are shown, then disappear if
  unscored" (FR-004/005/006) while preserving the waiting indicator (which is now the frame+banner,
  not the tile lift).
- **Alternatives considered**: Removing the lift immediately on submit — rejected; the brief reveal
  is explicitly desired.

### D5. Reduced motion, Realtime/polling parity
- **Decision**: Provide `@media (prefers-reduced-motion: reduce)` static equivalents for the new
  frame, scored-current ring, and reveal-fade (mirroring existing reduced-motion blocks at
  `board.css:182-187, 287-291, 380-388`). All new state is derived from the same `matchState` the
  polling path already populates, so behavior is delivery-agnostic.
- **Rationale**: FR-013 / FR-014.

## Open questions

None. All resolved.
