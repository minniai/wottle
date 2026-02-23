# Quickstart: Board UI and Animations

**Feature**: 004-board-ui-animations
**Date**: 2026-02-23

## Prerequisites

- Node.js (version per `.nvmrc` or 18+)
- pnpm (package manager)
- Supabase CLI (for local DB; already configured from prior specs)

## Setup

No additional setup required beyond the standard project setup. This feature modifies only frontend components and CSS.

```bash
# 1. Switch to feature branch
git checkout 004-board-ui-animations

# 2. Install dependencies (no new packages added)
pnpm install

# 3. Start local Supabase (if not already running)
pnpm supabase start

# 4. Start dev server
pnpm dev
```

## Development Workflow

### Running Tests

```bash
# Unit tests (watch mode for TDD)
pnpm test:unit -- --watch

# Specific component tests
pnpm test:unit -- components/game/BoardGrid.test.tsx
pnpm test:unit -- components/match/GameChrome.test.tsx

# All unit tests
pnpm test:unit

# E2E tests (requires dev server running)
pnpm exec playwright test tests/integration/ui/board-ui.spec.ts

# Lint + typecheck
pnpm lint && pnpm typecheck
```

### Visual Testing Viewports

Test the responsive board at these viewport sizes:

| Name | Width | Height | Notes |
|------|-------|--------|-------|
| Desktop | 1280 | 800 | Primary development viewport |
| Tablet | 768 | 1024 | Portrait tablet |
| Phone | 375 | 667 | iPhone SE / small phone |

Use Chrome DevTools device toolbar or Playwright viewport config.

### Testing Animation Timing

1. **Swap animation**: Select two tiles → verify 150-250ms smooth translate
2. **Shake animation**: Click a frozen tile → verify 3-4 oscillations in 300-400ms
3. **Word highlight**: Complete a round that scores a word → verify 600-800ms glow
4. **Reduced motion**: Enable `prefers-reduced-motion` in DevTools → verify instant state changes

### Testing Frozen Tile Overlays

1. Complete rounds that score words for both players
2. Verify Player 1 (blue) and Player 2 (red) overlays at 40% opacity
3. If both players score words sharing a tile, verify split-diagonal pattern
4. Use a contrast checker on frozen tile letter text (target: 4.5:1)

### Debug Mode

Access debug metadata (match ID, status, round info) via URL parameter:

```
http://localhost:3000/match/<matchId>?debug=1
```

This is stripped in production builds.

## Key Files

| File | Role |
|------|------|
| `components/match/GameChrome.tsx` | NEW: Opponent/player bars |
| `components/match/MatchClient.tsx` | Animation sequencing, layout |
| `components/match/MatchShell.tsx` | Skeleton/content toggle |
| `components/game/BoardGrid.tsx` | Swap/shake/highlight animations |
| `components/game/TimerHud.tsx` | Green/neutral timer colors |
| `app/styles/board.css` | Responsive sizing, keyframes |
| `lib/constants/playerColors.ts` | NEW: Centralized color constants |
| `tailwind.config.ts` | Player color + animation tokens |

## No New Dependencies

This feature uses only existing dependencies:
- **Tailwind CSS** for utility classes and responsive breakpoints
- **CSS animations/transitions** for all motion (no Framer Motion)
- **Vitest** for component/unit tests
- **Playwright** for E2E visual tests
