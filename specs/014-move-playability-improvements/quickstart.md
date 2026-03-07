# Quickstart: Move Playability Improvements

**Branch**: `014-move-playability-improvements`
**Date**: 2026-03-07

## Prerequisites

- Node.js 20+, pnpm
- Supabase local instance running (`pnpm quickstart` if not set up)
- Feature branch checked out: `git checkout 014-move-playability-improvements`

## Implementation Order

Work in this order to minimize inter-feature dependencies:

### 1. Tile Score Values (FR-010) — Standalone, no dependencies

Add Scrabble-style point values to tiles in `BoardGrid.tsx`.

**Key files**: `components/game/BoardGrid.tsx`, `app/styles/board.css`
**Data source**: `docs/wordlist/letter_scoring_values_is.ts` (already exported)
**Test**: Verify each tile displays correct point value; values don't obscure letters.

### 2. Timer Panel Colors (FR-006) — Standalone, no dependencies

Redesign timer display in `GameChrome.tsx` with colored background panels.

**Key files**: `components/match/GameChrome.tsx`
**Colors**: green (`bg-emerald-600/80`) running, orange (`bg-amber-500/80`) paused, red (`bg-red-600/80`) expired
**Test**: Timer panel background changes based on `TimerStatus`.

### 3. Always-Visible Round Summary (FR-011, FR-012) — Standalone

Always render `match-layout__summary` container in `MatchClient.tsx`.

**Key files**: `components/match/MatchClient.tsx`, `app/styles/board.css`
**Change**: Remove conditional rendering on the summary container div. Keep `RoundSummaryPanel` conditional inside it.
**Test**: Summary area visible from round 1; no CLS when data populates.

### 4. Move Lock + Orange Highlight (FR-001, FR-002, FR-003, FR-004) — Core feature

Add move lock state to `MatchClient`, pass to `BoardGrid`.

**Key files**: `components/match/MatchClient.tsx`, `components/game/BoardGrid.tsx`, `app/styles/board.css`
**State**: `moveLocked: boolean`, `lockedSwapTiles: [Coordinate, Coordinate] | null`
**CSS**: New `.board-grid__cell--locked` class with orange background
**Test**: After submission, tiles stay orange, board ignores clicks; resets on new round.

### 5. RoundSummary Moves Extension — Server-side prerequisite for opponent reveal

Add `moves` field to `RoundSummary` type and populate in broadcast.

**Key files**: `lib/types/match.ts`, `app/actions/match/publishRoundSummary.ts`
**Data**: Query `move_submissions` for the round, extract from/to coordinates per player
**Test**: Unit test that `aggregateRoundSummary` includes moves; integration test that broadcast contains moves.

### 6. Opponent Move Reveal (FR-005) — Depends on #4, #5

Add `"revealing-opponent-move"` animation phase to `MatchClient`.

**Key files**: `components/match/MatchClient.tsx`, `components/game/BoardGrid.tsx`, `app/styles/board.css`
**Phase sequence**: `idle → revealing-opponent-move (~1s) → highlighting (~700ms) → showing-summary → idle`
**CSS**: New `@keyframes opponent-reveal-fade` (orange → transparent, 1s)
**Test**: Opponent tiles flash orange on round completion; fade to final color; own tiles not re-highlighted.

### 7. Dual Timeout Game End (FR-007, FR-008) — Depends on #2

Client-side detection when both timers reach zero.

**Key files**: `components/match/MatchClient.tsx`
**Logic**: Watch both timer states; when both show expired, display timeout state. Server already handles match completion via existing `advanceRound` both_players_flagged logic.
**Test**: Both timers at zero → match marked completed → navigation to summary.

### 8. Frozen Tiles on Final Summary (FR-009) — Standalone

Thread `frozenTiles` prop through to BoardGrid on summary page.

**Key files**: `app/match/[matchId]/summary/page.tsx`, `components/match/FinalSummary.tsx`
**Change**: Pass `frozenTiles` from match record to FinalSummary → BoardGrid
**Test**: Summary board shows player-colored frozen tiles.

## Running Tests

```bash
# Unit tests (specific to this feature)
pnpm test:unit -- tests/unit/components/MatchClient.test.tsx
pnpm test:unit -- tests/unit/components/GameChrome.test.tsx
pnpm test:unit -- tests/unit/lib/scoring/roundSummary.test.tsx

# All unit tests
pnpm test

# Lint + typecheck
pnpm lint && pnpm typecheck

# E2E (run individually to avoid Realtime contention)
pnpm exec playwright test --grep "move lock"
pnpm exec playwright test --grep "timer panel"
```

## Key Patterns

- **CSS animations**: Define keyframes in `app/styles/board.css`, apply via class toggling in React
- **State machine**: Use `AnimationPhase` enum for sequential animation phases with `setTimeout` transitions
- **Timer colors**: Derive from `TimerStatus` type (`"running" | "paused" | "expired"`)
- **Move lock**: Client-side guard only — server already prevents duplicate submissions via `move_submissions` unique constraint
