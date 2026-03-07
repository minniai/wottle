# Research: Move Playability Improvements

**Branch**: `014-move-playability-improvements`
**Date**: 2026-03-07

## R1: Passing Opponent Swap Coordinates to Client

**Decision**: Extend `RoundSummary` with a `moves` field containing per-player swap coordinates.

**Rationale**: The opponent move reveal (FR-005) requires the client to know which tiles the opponent swapped. Currently `RoundSummary` only includes scored words and their tile coordinates, not the raw swap coordinates. The data is already available in `roundEngine.ts` via `acceptedMoves` (from_x, from_y, to_x, to_y per player). Adding it to the broadcast payload is the minimal-impact approach.

**Alternatives considered**:
- Separate Realtime event for move reveal → Rejected: adds complexity, timing coordination issues
- Query `move_submissions` from client → Rejected: violates server-authoritative principle, exposes data prematurely
- Derive from board diff → Rejected: unreliable when multiple swaps overlap or tiles have same letters

**Implementation**: Add `moves: Array<{ playerId: string; from: Coordinate; to: Coordinate }>` to `RoundSummary` type and populate in `publishRoundSummary`.

## R2: Move Lock State Management

**Decision**: Add `moveLocked` boolean + `lockedSwapTiles` coordinate pair to `MatchClient` state, set on successful submission, cleared on next round.

**Rationale**: Currently `isSubmitting` in `BoardGrid` only blocks during the async request. After success, the board is interactive again. The lock must persist until the next round starts (signaled by a state broadcast with incremented `currentRound`).

**Alternatives considered**:
- Block in BoardGrid via prop → Rejected: BoardGrid shouldn't know about round lifecycle
- Derive from server state (check move_submissions) → Rejected: requires extra server call; latency-sensitive
- Disable board via CSS pointer-events → Rejected: doesn't preserve tile highlight state; not accessible

**Implementation**: `MatchClient` manages `moveLocked` state. Passes `disabled` prop + `lockedTiles` to `BoardGrid`. BoardGrid ignores clicks when disabled. The locked tiles receive orange background styling.

## R3: Animation Phase State Machine Extension

**Decision**: Extend `AnimationPhase` type from `"idle" | "highlighting" | "showing-summary"` to add `"revealing-opponent-move"` phase before highlighting.

**Rationale**: Per clarification, the round completion animation sequence is: opponent move reveal (~1s) → scored-tile-highlight (~700ms) → summary panel. The existing state machine already handles highlighting → summary. Adding a preceding phase maintains the clean sequential model.

**Alternatives considered**:
- Use setTimeout chains without state machine → Rejected: fragile, hard to test, race conditions
- Merge opponent reveal into highlighting phase → Rejected: different visual treatment (orange fade vs player-colored glow)

**Implementation**: New phase sequence: `idle → revealing-opponent-move → highlighting → showing-summary → idle`. Transition timing: ~1000ms for reveal, then existing 800ms for highlights.

## R4: Timer Panel Redesign

**Decision**: Redesign `GameChrome` timer section to use prominent colored background panels with green/orange/red status colors.

**Rationale**: Current timer uses subtle text colors (emerald-400 running, slate-400 paused). Spec requires prominent panels with background colors visible at a glance.

**Alternatives considered**:
- Separate TimerPanel component → Rejected: over-engineering; GameChrome already encapsulates timer display
- CSS-only change → Insufficient: need to add "expired" status detection (red panel when remainingMs === 0)

**Implementation**: Add background color classes to the timer container in GameChrome based on `TimerStatus`: `bg-emerald-600/80` (running), `bg-amber-500/80` (paused), `bg-red-600/80` (expired). Add padding and rounded corners for panel appearance.

## R5: Tile Score Value Display

**Decision**: Import `LETTER_SCORING_VALUES_IS` in `BoardGrid` and render a small `<span>` in each tile's bottom-right corner.

**Rationale**: Scrabble-style point values help players make strategic decisions. The letter values are already defined in `docs/wordlist/letter_scoring_values_is.ts` and used by the scorer.

**Alternatives considered**:
- Precompute a lookup map at module level → Selected: avoids per-render import overhead
- Show values only on hover/long-press → Rejected: user wants always-visible values
- Use a tooltip → Rejected: not visible at a glance; mobile-unfriendly

**Implementation**: Small absolute-positioned span with `font-size: 0.5em`, `bottom-right` positioning inside the tile button. Value from `LETTER_SCORING_VALUES_IS[letter.toUpperCase()]`.

## R6: Dual Timeout Detection

**Decision**: Leverage existing `both_players_flagged` logic in `roundEngine.ts`. Add client-side detection in `MatchClient` for immediate UI response.

**Rationale**: Server already handles dual timeout in `advanceRound()` (lines 166-180). However, client needs to detect when both displayed timers hit zero to show immediate feedback before the server broadcast arrives.

**Alternatives considered**:
- Server-only detection → Partially insufficient: client shows stale state until next broadcast
- Client triggers server action on local zero detection → Rejected: race condition if both clients trigger simultaneously

**Implementation**: Client watches both timer states. When both show `remainingMs <= 0`, display "Both players timed out" state and wait for server confirmation (match state → completed). No new server action needed — existing `advanceRound` handles it.

## R7: FinalSummary Frozen Tile Colors

**Decision**: Pass `frozenTiles` from the match record to `BoardGrid` in `FinalSummary`.

**Rationale**: Research confirms `BoardGrid` already renders frozen tile overlay colors when `frozenTiles` prop is provided. The `FinalSummary` component receives `board` but the `frozenTiles` map may not be passed through. The summary page loads `match.frozen_tiles` — it just needs to be threaded to the BoardGrid component.

**Implementation**: Ensure `frozenTiles` prop flows from summary page → FinalSummary → BoardGrid. Verify overlay colors render correctly in read-only mode.

## R8: Always-Visible Round Summary Table

**Decision**: Always render `match-layout__summary` div in MatchClient, regardless of whether `summary` is null. Show empty reserved space when no data.

**Rationale**: Currently the `match-layout__summary` div is conditionally rendered only when `animationPhase !== "highlighting" && summary`. Removing the conditional on the container div ensures layout stability from round 1.

**Alternatives considered**:
- Use CSS min-height on a placeholder → Rejected: doesn't match actual panel dimensions
- Pre-render with visibility:hidden → Possible but more complex than always rendering the container

**Implementation**: Always render the `match-layout__summary` container. Conditionally render `RoundSummaryPanel` inside it. Container maintains its CSS-defined width (20rem on desktop) as blank space.
