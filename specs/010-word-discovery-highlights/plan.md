# Implementation Plan: Word Discovery Highlights

**Branch**: `010-word-discovery-highlights` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-word-discovery-highlights/spec.md`

## Summary

After each round resolves, tiles belonging to scored words glow with the scoring player's color (Player A = blue, Player B = red) for 600–800ms, then the round summary panel appears. This is a pure frontend change: no server or schema modifications. The implementation requires three coordinated changes — (1) a CSS keyframe update for player-colored timing, (2) a new `highlightPlayerColors` prop in `BoardGrid`, and (3) an animation phase state machine in `MatchClient` that defers the summary panel until after the highlight animation completes.

This spec implements T029–T033 from `specs/005-board-ui-animations/tasks.md`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x, CSS Animations/Transforms (GPU-accelerated, no Framer Motion)
**Storage**: N/A — reads existing `RoundSummary` from Supabase Realtime broadcasts; no new persistence
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web browser (desktop + mobile)
**Project Type**: Web application (frontend-only change)
**Performance Goals**: Highlight animation at 60 FPS; no layout thrashing; 700ms total duration
**Constraints**: Animations via CSS transform/opacity only; reduced-motion path must reach final state in <100ms; no Framer Motion
**Scale/Scope**: 3 files modified, 1 CSS keyframe updated, ~5 tasks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative Game Logic | ✅ PASS | Pure frontend change; no game logic on client; uses existing server-broadcast `RoundSummary` data |
| II. Real-Time Performance Standards | ✅ PASS | CSS-only animation (GPU-accelerated); 60 FPS target; no server round-trips; reduced-motion path is instant |
| III. Type-Safe End-to-End | ✅ PASS | New `highlightPlayerColors` prop will be fully typed; no `any`; shared types from `/lib/types/` |
| IV. Progressive Enhancement & Mobile-First | ✅ PASS | `prefers-reduced-motion` override included; touch targets unaffected; animation is additive enhancement |
| V. Observability & Resilience | ✅ PASS | Animation phase state machine is local; if summary arrives while animating, it is queued |
| VI. Clean Code | ✅ PASS | Phase machine <20 lines; `deriveHighlightPlayerColors()` pure utility function |
| VII. TDD | ✅ PASS | Tests T029–T030 written (failing) before T031–T033 implementation |
| VIII. External Context Providers | N/A | No external libraries or framework APIs consulted |
| IX. Commit Message Standards | ✅ PASS | Each test commit before each implementation commit |

**Constitution violations**: None.

## Project Structure

### Documentation (this feature)

```text
specs/010-word-discovery-highlights/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── checklists/
│   └── requirements.md  # Spec quality checklist (all passing)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
components/
├── game/
│   └── BoardGrid.tsx                    # Add highlightPlayerColors prop + --highlight-color CSS var per tile
└── match/
    └── MatchClient.tsx                  # Add animationPhase state machine; derive highlightPlayerColors from summary.words

app/styles/
└── board.css                            # Update @keyframes scored-tile-highlight: 3s→700ms, --highlight-color variable, add prefers-reduced-motion

lib/constants/
└── playerColors.ts                      # READ-ONLY: PLAYER_A_HIGHLIGHT + PLAYER_B_HIGHLIGHT already defined

tests/
├── unit/components/
│   ├── BoardGrid.test.tsx               # T029 (new failing test)
│   └── MatchClient.test.tsx             # T030 (new failing test)
└── integration/ui/
    └── board-ui.spec.ts                 # E2E: verify highlight → freeze → summary sequence (T041 partial)
```

**Structure Decision**: Single Next.js project. All changes are in `components/`, `app/styles/`, and `tests/`. No new files created; all changes are modifications to existing files.

## Phase 0: Research Findings

See [`research.md`](./research.md) for full findings. Summary:

- **Duration**: 700ms CSS animation, 800ms JS timer (end-of-range buffer so fade-out completes before callback)
- **Colors**: `PLAYER_A_HIGHLIGHT` / `PLAYER_B_HIGHLIGHT` from `lib/constants/playerColors.ts` (already defined)
- **Data shape**: Derive `Record<"x,y", color>` from `summary.words[].playerId` + `words[].coordinates` in MatchClient
- **CSS approach**: `--highlight-color` CSS custom property set per-tile via inline style; single keyframe variant
- **Phase count**: 3 phases — `"idle" | "highlighting" | "showing-summary"`
- **Reduced motion**: CSS `animation-duration: 0ms` + immediate JS phase transition
- **No server changes**: All data is in the existing `RoundSummary` broadcast

## Phase 1: Design

### Component Architecture

#### `MatchClient.tsx` — Animation Phase State Machine

New state added to `MatchClient`:

```
animationPhase: "idle" | "highlighting" | "showing-summary"
pendingSummary: RoundSummary | null
highlightPlayerColors: Record<string, string>
```

**Flow on `onSummary` callback**:
1. Derive `highlightPlayerColors` from `nextSummary.words` (see `deriveHighlightPlayerColors()` below)
2. Set `animationPhase = "highlighting"`, store `pendingSummary`
3. Update `matchState.scores` and `matchState.lastSummary` (existing behavior, unaffected)
4. If `prefers-reduced-motion` → immediately set `animationPhase = "showing-summary"`
5. Otherwise: `setTimeout(800ms)` → set `animationPhase = "showing-summary"`, clear `pendingSummary`, call `setSummary(pendingSummary)`

**Guard on `setSummary`**: The existing `useEffect` that syncs `summary` from `matchState.lastSummary` must not fire while `animationPhase !== "idle"`. The existing guard (`dismissedSummaryIdRef`) already prevents re-show on poll; we add an `animationPhase` guard here.

**`RoundSummaryPanel` render condition**: Currently renders always when `summary !== null`. Change to: render only when `summary !== null && animationPhase !== "highlighting"`. (Panel already exists for the `"showing-summary"` and `"idle"` phases.)

**`BoardGrid` props change**:
- `scoredTileHighlights`: pass `pendingSummary?.highlights ?? []` during `"highlighting"` phase; `[]` otherwise (prevents re-trigger on poll)
- `highlightPlayerColors`: pass `highlightPlayerColors` map during `"highlighting"` phase; `{}` otherwise
- `highlightDurationMs`: change from `3000` to `800`

#### `deriveHighlightPlayerColors()` — Pure Utility

New helper function (in `MatchClient.tsx` or a co-located utility):

```typescript
function deriveHighlightPlayerColors(
  words: WordScore[],
  playerAId: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const word of words) {
    const color = word.playerId === playerAId
      ? PLAYER_A_HIGHLIGHT
      : PLAYER_B_HIGHLIGHT;
    for (const coord of word.coordinates) {
      map[`${coord.x},${coord.y}`] = color;
    }
  }
  return map;
}
```

This function is a pure utility with no side effects — testable in isolation.

#### `BoardGrid.tsx` — Per-Tile Color Application

New optional prop: `highlightPlayerColors?: Record<string, string>`

In the render loop, when computing per-tile classes and styles:
```
const highlightColor = highlightPlayerColors?.[tileKey];
const isScoredHighlight = activeHighlights.length > 0 && isTileInHighlights(colIndex, rowIndex, activeHighlights);
```

When `isScoredHighlight && highlightColor`:
- Add `board-grid__cell--scored` class (existing)
- Add inline style `{ '--highlight-color': highlightColor } as CSSProperties` to the tile button

When `isScoredHighlight && !highlightColor` (fallback — no color provided):
- Add `board-grid__cell--scored` class only (CSS falls back to `--highlight-color` being undefined → box-shadow `var(--highlight-color)` resolves to invalid → glow does not render, which is acceptable for the fallback)

**Default prop update**: `highlightDurationMs` default changes from `3000` to `800`.

#### `board.css` — Updated Keyframe

Replace the existing `scored-tile-highlight` keyframe:

```css
/* Scored tile highlight: 700ms player-colored glow (PRD §7.2) */
.board-grid__cell--scored {
  animation: scored-tile-highlight 700ms ease-out forwards;
}

@keyframes scored-tile-highlight {
  0%   {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 0 -4px 12px rgba(15, 23, 42, 0.35),
      0 0 0 0 var(--highlight-color, transparent);
    opacity: 1;
  }
  28% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.30),
      inset 0 -4px 12px rgba(15, 23, 42, 0.35),
      0 0 0 6px var(--highlight-color, transparent);
    opacity: 1;
  }
  71% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.30),
      inset 0 -4px 12px rgba(15, 23, 42, 0.35),
      0 0 0 6px var(--highlight-color, transparent);
    opacity: 1;
  }
  100% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 0 -4px 12px rgba(15, 23, 42, 0.35),
      0 0 0 0 var(--highlight-color, transparent);
    opacity: 0.8;
  }
}

@media (prefers-reduced-motion: reduce) {
  .board-grid__cell--scored {
    animation-duration: 0ms;
  }
}
```

**Key differences from existing keyframe**:
- Duration: 3s → 700ms
- Color: hardcoded green → `var(--highlight-color, transparent)` (player-specific)
- Shape: glow ring via `box-shadow` outer spread (not border-color) — visually distinct from frozen overlay and selected state
- Percentages tuned for 200ms fade-in / 300ms hold / 200ms fade-out
- `transform: scale(1)` removed (no scale effect — avoids interaction with FLIP swap transforms)
- `opacity` at 100% is 0.8 (not 0.6) so the tile doesn't feel "dimmed" after highlight

### Reduced Motion Detection in `MatchClient`

To bypass the 800ms timer, detect `prefers-reduced-motion` once on mount:

```typescript
const prefersReducedMotion = useRef(
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
);
```

In the `onSummary` handler, if `prefersReducedMotion.current === true`, skip the timer and immediately set `animationPhase = "showing-summary"`.

### Data Flow Diagram

```
Round resolves (server)
  → onState fires: applySnapshot() → frozenTiles updated in matchState
  → onSummary fires:
       deriveHighlightPlayerColors(nextSummary.words, playerAId)
       animationPhase = "highlighting"
       pendingSummary = nextSummary
       scores + lastSummary updated in matchState

       [BoardGrid receives scoredTileHighlights + highlightPlayerColors]
       [Tiles with scored class glow with --highlight-color for 700ms]

       setTimeout(800ms) [or immediate if prefers-reduced-motion]:
         animationPhase = "showing-summary"
         setSummary(pendingSummary)

       [RoundSummaryPanel renders]
       [Frozen overlays already visible since onState fired earlier]

User dismisses summary:
  animationPhase = "idle"
  pendingSummary = null
  highlightPlayerColors = {}
```

### Test Strategy (TDD)

Per constitution VII, tests must fail before implementation.

**T029 — `BoardGrid.test.tsx` (unit)**:
- Tile at coordinates in `scoredTileHighlights` AND in `highlightPlayerColors` gets `board-grid__cell--scored` class AND has `--highlight-color` CSS variable set to the player color
- Tile at coordinates in `scoredTileHighlights` but NOT in `highlightPlayerColors` gets `board-grid__cell--scored` class but no `--highlight-color`
- Multiple word groups highlight simultaneously
- After 800ms (via `vi.advanceTimersByTime(800)`), `board-grid__cell--scored` class is removed

**T030 — `MatchClient.test.tsx` (unit)**:
- On `onSummary` event, `RoundSummaryPanel` is NOT rendered while `animationPhase === "highlighting"`
- After 800ms timer fires, `RoundSummaryPanel` IS rendered
- When `prefers-reduced-motion` is mocked as true, `RoundSummaryPanel` renders immediately (no 800ms wait)
- `deriveHighlightPlayerColors()` unit test: maps player A words to blue, player B words to red, handles coordinate deduplication

### No Data Model Changes

This feature is pure frontend rendering logic. No new Supabase tables, columns, or Server Actions are introduced. The existing `RoundSummary` type carries all required data.

### No API Contract Changes

No new HTTP endpoints. No changes to existing Server Action signatures or return types.

## Quickstart

See [`quickstart.md`](./quickstart.md) for full setup instructions.

**TL;DR for this feature**:
```bash
pnpm dev                          # Run dev server
pnpm test:unit -- BoardGrid       # Run BoardGrid unit tests
pnpm test:unit -- MatchClient     # Run MatchClient unit tests
pnpm exec playwright test board-ui # E2E highlight sequence test
```

## Implementation Order (TDD)

| Step | Task | File(s) | Type |
|------|------|---------|------|
| 1 | T029: Failing test for BoardGrid highlight colors | `tests/unit/components/BoardGrid.test.tsx` | Test |
| 2 | T030: Failing test for MatchClient phase machine | `tests/unit/components/MatchClient.test.tsx` | Test |
| 3 | T031: Update scored-tile-highlight keyframe (700ms, --highlight-color, reduced-motion) | `app/styles/board.css` | Impl |
| 4 | T032: Implement animation phase state machine in MatchClient | `components/match/MatchClient.tsx` | Impl |
| 5 | T033: Add highlightPlayerColors prop to BoardGrid; set --highlight-color per tile | `components/game/BoardGrid.tsx` | Impl |

**Commit cadence** (per constitution IX):
- `test(board-grid): verify player-colored scored tile highlights`
- `test(match-client): verify animation phase machine gates summary panel`
- `feat(board-css): update scored-tile-highlight to 700ms with --highlight-color`
- `feat(match-client): add highlighting→showing-summary phase machine`
- `feat(board-grid): apply --highlight-color per scored tile from highlightPlayerColors prop`
