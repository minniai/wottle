# Implementation Plan: Match HUD Three-Column Layout

**Branch**: `018-match-hud-layout` | **Date**: 2026-03-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/018-match-hud-layout/spec.md`

## Summary

Replace the current GameChrome horizontal bars with a three-column desktop layout (player panel | board | opponent panel) that prominently displays player identity, timers, scores, round number, and game controls. On mobile, collapse to compact horizontal bars above/below the board. The RoundSummaryPanel becomes a modal overlay on the board area.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x, CSS Animations/Transforms (GPU-accelerated, no Framer Motion)
**Storage**: Supabase PostgreSQL — reads existing `players` table (no new tables/columns)
**Testing**: Vitest (unit/component), Playwright (E2E)
**Target Platform**: Web (desktop + mobile browsers)
**Project Type**: Web application (real-time competitive game)
**Performance Goals**: 60 FPS animations, timer updates at 1s precision, no layout thrashing
**Constraints**: CSS-only responsive switching (no JS viewport detection), server-side player data fetching
**Scale/Scope**: 2 players per match, 10 rounds per match

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative | ✅ Pass | Player profiles fetched server-side in page.tsx; client is view-only |
| II. Real-Time Performance | ✅ Pass | No new server round-trips during gameplay; profiles loaded once at match start |
| III. Type-Safe End-to-End | ✅ Pass | New MatchPlayerProfile types shared between server loader and client components |
| IV. Progressive Enhancement | ✅ Pass | Three-column on desktop, compact bars on mobile; CSS media queries only |
| V. Observability | ✅ Pass | No new critical paths; existing instrumentation sufficient |
| VI. Clean Code | ✅ Pass | Components <20 lines/function, ≤3 params via object pattern |
| VII. TDD | ✅ Pass | All new components get tests first |
| VIII. External Context | N/A | No external library APIs needed |
| IX. Commit Standards | ✅ Pass | Conventional commits format |

## Project Structure

### Documentation (this feature)

```text
specs/018-match-hud-layout/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
components/match/
├── PlayerPanel.tsx       # NEW — replaces GameChrome (full + compact variants)
├── PlayerAvatar.tsx      # NEW — avatar image or letter-placeholder circle
├── TimerDisplay.tsx      # NEW — extracted timer with urgency styling
├── MatchClient.tsx       # MODIFY — new layout, PlayerPanel, overlay RoundSummary
├── GameChrome.tsx        # DELETE (after PlayerPanel is integrated)
└── ...existing files

lib/
├── match/stateLoader.ts  # MODIFY — add loadMatchPlayerProfiles()
└── types/match.ts        # MODIFY — add MatchPlayerProfile, MatchPlayerProfiles

app/
├── match/[matchId]/page.tsx  # MODIFY — fetch player profiles, pass to MatchClient
└── styles/board.css          # MODIFY — three-column layout, overlay, timer urgency

tests/unit/components/
├── PlayerPanel.test.tsx      # NEW
├── PlayerAvatar.test.tsx     # NEW
├── TimerDisplay.test.tsx     # NEW
└── MatchClient.test.tsx      # MODIFY — update for new props/layout
```

**Structure Decision**: All changes within existing directory conventions. Three new presentational components in `components/match/`. One new utility function in `lib/match/stateLoader.ts`. No new directories needed.

## Architecture

### Data Flow

```
┌── page.tsx (Server Component) ──────────────────────┐
│  1. loadMatchState(supabase, matchId)                │
│  2. loadMatchPlayerProfiles(supabase, playerAId,     │
│     playerBId) ← NEW                                │
│  3. Pass both to MatchClient                         │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌── MatchClient (Client Component) ───────────────────┐
│  Props: initialState, currentPlayerId, matchId,      │
│         playerProfiles ← NEW                        │
│                                                      │
│  Determines playerSlot / opponentSlot                │
│  Maps profiles to player/opponent                    │
│                                                      │
│  Desktop (≥900px, CSS-toggled):                      │
│  ┌─────────┬──────────────┬─────────┐               │
│  │PlayerPnl│   BoardGrid  │PlayerPnl│               │
│  │ (full)  │ + Overlay    │ (full)  │               │
│  │ "me"    │   Summary    │ "opp"   │               │
│  └─────────┴──────────────┴─────────┘               │
│                                                      │
│  Mobile (<900px, CSS-toggled):                       │
│  ┌──────────────────────────┐                       │
│  │ PlayerPanel (compact) opp│                       │
│  ├──────────────────────────┤                       │
│  │       BoardGrid          │                       │
│  ├──────────────────────────┤                       │
│  │ PlayerPanel (compact) me │                       │
│  └──────────────────────────┘                       │
└──────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
MatchClient
├── PlayerPanel (variant="full", className="match-layout__panel--left")
│   ├── PlayerAvatar (size="md")
│   ├── TimerDisplay (size="lg")
│   ├── ScoreDeltaPopup (player panel only)
│   ├── History button (player panel only)
│   └── Resign button (player panel only)
├── Board container (relative, for overlay)
│   ├── PlayerPanel (variant="compact", className="match-layout__compact-top")
│   │   ├── PlayerAvatar (size="sm")
│   │   └── TimerDisplay (size="sm")
│   ├── BoardGrid
│   ├── PlayerPanel (variant="compact", className="match-layout__compact-bottom")
│   │   ├── PlayerAvatar (size="sm")
│   │   └── TimerDisplay (size="sm")
│   └── RoundSummaryPanel overlay (conditional)
└── PlayerPanel (variant="full", className="match-layout__panel--right")
    ├── PlayerAvatar (size="md")
    └── TimerDisplay (size="lg")
```

### New Types

```typescript
// In lib/types/match.ts
export interface MatchPlayerProfile {
  playerId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  eloRating: number;
}

export interface MatchPlayerProfiles {
  playerA: MatchPlayerProfile;
  playerB: MatchPlayerProfile;
}
```

### PlayerPanel Props (Clean Code: object grouping)

```typescript
interface PlayerPanelProps {
  player: {
    displayName: string;
    avatarUrl: string | null;
    eloRating: number;
  };
  gameState: {
    score: number;
    timerSeconds: number;
    isPaused: boolean;
    hasSubmitted: boolean;
    currentRound: number;
    totalRounds: number;
    playerColor: string;
  };
  controls?: {
    scoreDelta?: ScoreDelta | null;
    scoreDeltaRound?: number;
    roundHistoryCount?: number;
    onHistoryToggle?: () => void;
    onResign?: () => void;
    resignDisabled?: boolean;
  };
  variant: "full" | "compact";
  isDisconnected?: boolean;
}
```

### CSS Strategy

**Responsive switching via CSS only** (no hydration mismatch):
- Render both full panels and compact bars in the DOM
- Desktop: show `.match-layout__panel--left/right`, hide `.match-layout__compact-top/bottom`
- Mobile: hide panels, show compact bars

**Key CSS additions in board.css:**
- `.match-layout__panel` — 14rem wide flex column on desktop
- `.match-layout__overlay` — absolute positioned overlay for RoundSummaryPanel
- `.timer-display--urgent` — red pulse keyframe for <30s
- `--chrome-height` recalculated for desktop (no more GameChrome bars)

### Timer Urgency Styling

```css
@keyframes timer-urgency-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.timer-display--urgent {
  background: rgba(220, 38, 38, 0.85) !important;
  animation: timer-urgency-pulse 1s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .timer-display--urgent {
    animation: none;
    border: 2px solid #dc2626;
  }
}
```

## Implementation Phases

### Phase 1: Data Layer (2 tasks)
1. Add `MatchPlayerProfile` and `MatchPlayerProfiles` types
2. Add `loadMatchPlayerProfiles()` function with unit test

### Phase 2: Presentational Components (3 tasks)
3. Create `PlayerAvatar` component with tests
4. Create `TimerDisplay` component with tests (extract timer logic from GameChrome)
5. Create `PlayerPanel` component (full + compact) with tests

### Phase 3: CSS Layout (2 tasks)
6. Add three-column layout CSS, responsive breakpoints
7. Add timer urgency pulse keyframe and board overlay CSS

### Phase 4: Integration (3 tasks)
8. Update match page to fetch/pass player profiles
9. Update MatchClient to use PlayerPanel + new layout
10. Move RoundSummaryPanel to overlay positioning

### Phase 5: Cleanup (2 tasks)
11. Update MatchShell skeleton for new layout
12. Remove GameChrome component and tests

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Board sizing regression from --chrome-height change | High | Recalculate on desktop; compact bars keep mobile budget unchanged |
| Hydration mismatch from viewport-conditional rendering | High | CSS-only responsive switching; both layouts in DOM |
| RoundSummaryPanel overlay breaks FLIP animations | Medium | Overlay uses z-index stacking; FLIP uses transform on cells (independent) |
| usernameMap in MatchClient uses playerIds | Low | Update to use playerProfiles display names |

## Complexity Tracking

No constitution violations. No complexity justification needed.
