# Implementation Plan: Board UI and Animations

**Branch**: `004-board-ui-animations` | **Date**: 2026-02-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-board-ui-animations/spec.md`

## Summary

Transform the match screen from a backend test harness into a playable game view by implementing the PRD Section 7.1 layout (opponent bar, 10x10 grid, player bar), responsive board sizing that fits all viewports, frozen tile ownership overlays, swap/shake/highlight animations, and game chrome (scores, move counter, timer state colors). This is a frontend-only feature requiring no server-side or database changes.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x, CSS Animations/Transforms (no Framer Motion needed for this scope)
**Storage**: N/A (reads existing MatchState from Supabase Realtime broadcasts; no new persistence)
**Testing**: Vitest for unit/component tests, Playwright for E2E visual flows
**Target Platform**: Web (desktop, tablet, mobile browsers)
**Project Type**: Web application (Next.js fullstack)
**Performance Goals**: 60 FPS sustained for all animations, no dropped frames during swap/highlight sequences
**Constraints**: GPU-accelerated properties only (transform, opacity); 44x44px minimum touch targets on mobile; WCAG 2.1 AA contrast (4.5:1) on frozen tile overlays
**Scale/Scope**: ~8 modified files, ~3 new files, 0 API changes, 0 migration changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative Game Logic | PASS | No server changes. All game state mutations remain server-side. This spec is view-layer only. |
| II. Real-Time Performance Standards | PASS | 60 FPS animation target aligns with constitution. No impact on move RTT (<200ms) or word validation (<50ms). |
| III. Type-Safe End-to-End | PASS | Consumes existing typed MatchState. No new Server Actions or API contracts. |
| IV. Progressive Enhancement & Mobile-First | PASS | Core feature: responsive board sizing, 44x44px touch targets, mobile-first layout. |
| V. Observability & Resilience | PASS | Existing `performance.mark("board-grid:hydrated")` preserved. Animation timing is client-only; no server-side observability needed. |
| VI. Clean Code Principles | PASS | Functions <20 lines, single responsibility. New animation utilities will be pure functions. |
| VII. Test Driven Development (TDD) | PASS | TDD workflow required: failing test first for each visual behavior. |
| VIII. External Context Providers | N/A | No external libraries or APIs introduced. Pure CSS animations. |
| IX. Commit Message Standards | PASS | Conventional Commits format with `feat(board-ui):` and `test(board-ui):` scopes. |

**Gate result**: All principles pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/004-board-ui-animations/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (client-side entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (no new API contracts)
│   └── README.md        # Explains why no contracts needed
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
components/
├── game/
│   ├── BoardGrid.tsx          # MODIFY: add swap animation, shake, highlight timing, skeleton
│   ├── TimerHud.tsx           # MODIFY: add green/neutral color state per submission status
│   ├── MoveFeedback.tsx       # NO CHANGE (not used in match flow)
│   └── Board.tsx              # NO CHANGE (legacy standalone, not in match flow)
├── match/
│   ├── MatchClient.tsx        # MODIFY: new layout, animation sequencing, score delta popup
│   ├── MatchShell.tsx         # MODIFY: remove debug metadata, conditional skeleton vs. content
│   ├── RoundSummaryPanel.tsx  # NO CHANGE (already complete)
│   ├── GameChrome.tsx         # NEW: opponent bar and player bar components
│   └── WordHighlightOverlay.tsx # NO CHANGE (unused, may remove in cleanup)

app/
├── match/[matchId]/
│   └── page.tsx               # MODIFY: remove nested <main>, simplify wrapper
├── styles/
│   └── board.css              # MODIFY: responsive viewport sizing, animation keyframes

lib/
├── constants/
│   └── playerColors.ts        # NEW: centralized player color constants
├── types/                     # NO CHANGE (existing types sufficient)

tailwind.config.ts             # MODIFY: add animation tokens, player color tokens

tests/
├── unit/
│   └── components/
│       ├── BoardGrid.test.tsx     # NEW/MODIFY: animation timing, frozen overlay, skeleton
│       ├── GameChrome.test.tsx     # NEW: score display, move counter, timer colors
│       └── MatchClient.test.tsx   # MODIFY: layout structure, animation sequencing
├── integration/
│   └── ui/
│       └── board-ui.spec.ts       # NEW: Playwright E2E for layout, responsive, animations
```

**Structure Decision**: Follows existing feature-based organization. New `GameChrome.tsx` component extracts opponent/player bar logic from MatchClient. Player colors centralized in `lib/constants/playerColors.ts` (currently hardcoded in BoardGrid only). No new directories needed.

## Key Architectural Decisions

### 1. CSS Animations over Framer Motion

**Decision**: Use pure CSS animations (keyframes + transitions) instead of Framer Motion.

**Rationale**: The animations in scope (swap translate, shake oscillation, highlight glow) are all achievable with CSS transforms and opacity. Adding Framer Motion (~32KB gzipped) for these simple cases violates the constitution's complexity justification principle. CSS animations are GPU-accelerated by default and require no additional runtime.

**Implementation**: Define keyframes in `board.css`, trigger via CSS class toggling from React state. Use `onTransitionEnd` / `onAnimationEnd` callbacks for sequencing.

### 2. Layout Refactor Strategy

**Decision**: Refactor MatchShell into a thin wrapper that conditionally renders skeleton or game content. Extract game chrome (opponent/player bars) into a new `GameChrome.tsx` component.

**Rationale**: MatchShell currently always renders loading skeletons alongside children (never hides them). The headline, status text, and debug metadata grid are always visible. The cleanest approach is to:
1. Make MatchShell accept a `loading` prop to toggle skeleton vs. children
2. Move debug metadata behind a dev-only toggle
3. Extract the opponent/player bar chrome into a composable `GameChrome` component

### 3. Board Responsive Sizing Approach

**Decision**: Use CSS `min(calc(100vh - chrome-height), 100vw)` to constrain the board to the smaller of available height and width, maintaining square aspect ratio.

**Rationale**: The current `width: 95%` approach doesn't account for vertical constraints (the board can overflow vertically on short viewports). The board needs to fit in the space between opponent bar (~60px) and player bar (~60px), so the available height is `100vh - ~120px - padding`. Using `min()` ensures the board is as large as possible without overflowing in either dimension.

### 4. Animation Sequencing Model

**Decision**: Use a state machine pattern in MatchClient for round resolution visual sequence: `idle → highlighting → freezing → summary`.

**Rationale**: The spec requires sequential visual events (FR-036a): word highlights (600-800ms) → frozen overlays appear → round summary panel. A simple state machine with timeout-based transitions ensures deterministic sequencing and is easy to test. Each state triggers the appropriate visual change via props passed to children.

### 5. Player Color Centralization

**Decision**: Extract `FROZEN_COLORS` from BoardGrid into `lib/constants/playerColors.ts` and expand to include full-opacity and highlight variants.

**Rationale**: Player colors are used in multiple components (BoardGrid frozen overlays, GameChrome score displays, word highlights). Centralizing prevents drift and makes the WCAG contrast requirement (FR-021) verifiable against a single source of truth.

### 6. Skeleton Loading State

**Decision**: Render a 10x10 grid of gray placeholder tiles (no letters) as the loading state, matching the final board dimensions exactly.

**Rationale**: The skeleton grid prevents layout shift (CLS) when the real board data arrives. Gray tiles at the correct size provide spatial context while the match state loads. The skeleton reuses the same grid CSS as the real board.

## Existing Code Analysis

### Files to Modify

| File | Lines | Key Changes |
|------|-------|-------------|
| `components/match/MatchClient.tsx` | 327 | New layout structure, animation state machine, pass chrome props |
| `components/match/MatchShell.tsx` | 64 | Conditional skeleton/content, remove debug metadata from default view |
| `components/game/BoardGrid.tsx` | 309 | Swap animation (CSS transform), shake animation, highlight timing update |
| `components/game/TimerHud.tsx` | 47 | Green/neutral color based on submission status |
| `app/match/[matchId]/page.tsx` | 52 | Remove nested `<main>`, simplify wrapper |
| `app/styles/board.css` | 134 | Viewport-responsive sizing, new keyframes (shake, swap) |
| `tailwind.config.ts` | 24 | Player color tokens, animation duration tokens |

### Files to Create

| File | Purpose |
|------|---------|
| `components/match/GameChrome.tsx` | Opponent bar + player bar (scores, timers, move counter) |
| `lib/constants/playerColors.ts` | Centralized Blue/Red color values (hex, rgba, overlay variants) |
| `tests/unit/components/GameChrome.test.tsx` | Unit tests for chrome component |

### Key Data Dependencies (Already Available)

| Data | Source | Type |
|------|--------|------|
| Board grid | `matchState.board` | `string[][]` (10x10) |
| Frozen tiles | `matchState.frozenTiles` | `FrozenTileMap` (Record<"x,y", { owner }>) |
| Scores | `matchState.scores` | `ScoreTotals` ({ playerA, playerB }) |
| Timers | `matchState.timers` | `{ playerA: TimerState, playerB: TimerState }` |
| Current round | `matchState.currentRound` | `number` |
| Player slot | Derived from `currentPlayerId` + timer playerId | `"player_a" \| "player_b"` |
| Scored words | `summary.words` | `WordScore[]` with coordinates |
| Highlights | `summary.highlights` | `Coordinate[][]` |
| Combo bonus | `summary.comboBonus` | `ScoreTotals` (optional) |
| Score deltas | `summary.deltas` | `ScoreTotals` |

### Existing Animation Infrastructure

| What | Where | Status |
|------|-------|--------|
| Tile hover transition | `board.css` line 79 | `transform 150ms ease` - keep |
| Tile selected state | `board.css` line 89 | `box-shadow` ring - keep |
| Scored tile highlight | `board.css` line 106 | `@keyframes scored-tile-highlight` (3s) - replace with 600-800ms per spec |
| Frozen tile colors | `BoardGrid.tsx` line 83 | `FROZEN_COLORS` object - extract to shared constant |
| Frozen tile CSS class | `board.css` line 100 | `.board-grid__cell--frozen` - keep, enhance |
| Highlight CSS class | `board.css` line 103 | `.board-grid__cell--scored` - update timing |

### Known Issues to Address

1. **Nested `<main>` tags**: Root layout has `<main>`, match page also wraps in `<main>`. Fix by removing inner `<main>` from page.tsx.
2. **MatchShell always shows skeletons**: Loading placeholders render alongside real content. Fix with conditional rendering.
3. **`aria-disabled` but not `disabled` on frozen tiles**: Frozen tiles have `aria-disabled={true}` but no `disabled` attribute, so they're still clickable. Should trigger shake animation instead of allowing click-through.
4. **No swap animation**: Tiles update instantly. Need CSS transform-based position swap.
5. **Highlight duration mismatch**: Current `scored-tile-highlight` keyframe is 3s; spec requires 600-800ms.
6. **Width: 95% board sizing**: Not viewport-relative, can overflow vertically. Need min() based approach.

## Complexity Tracking

> No constitution violations; no complexity justifications needed.
