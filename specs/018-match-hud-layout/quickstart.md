# Quickstart: Match HUD Three-Column Layout

**Feature**: 018-match-hud-layout
**Date**: 2026-03-16

## Prerequisites

```bash
pnpm quickstart    # Supabase + migrations + seed + .env.local
pnpm dev           # Start dev server
```

Ensure at least two player accounts exist in the database (created via lobby login).

## Development Workflow

### 1. Run existing tests to establish baseline

```bash
pnpm test          # All unit tests should pass
pnpm typecheck     # Zero errors
pnpm lint          # Zero warnings
```

### 2. TDD cycle for each new component

```bash
# Write failing test first
pnpm test:unit -- tests/unit/components/PlayerAvatar.test.tsx

# Implement component to pass test
# Refactor while keeping tests green
```

### 3. Visual testing during development

1. Start dev server: `pnpm dev`
2. Open two browser windows (or incognito)
3. Log in as two different players
4. Create and join a match
5. Verify three-column layout on desktop (≥900px viewport)
6. Resize to <900px to verify compact layout
7. Play through rounds to verify timer, score, round counter updates

### 4. Key test commands

```bash
# Unit tests for new components
pnpm test:unit -- tests/unit/components/PlayerPanel.test.tsx
pnpm test:unit -- tests/unit/components/PlayerAvatar.test.tsx
pnpm test:unit -- tests/unit/components/TimerDisplay.test.tsx

# Data loading test
pnpm test:unit -- tests/unit/match/loadMatchPlayerProfiles.test.ts

# Full test suite (verify no regressions)
pnpm test
pnpm typecheck
pnpm lint
```

### 5. E2E verification

```bash
# Run match E2E tests to verify no regressions
pnpm exec playwright test tests/integration/ui/match-flow.spec.ts
```

## Key Files to Edit

| File | Action | Purpose |
|------|--------|---------|
| `lib/types/match.ts` | Add types | MatchPlayerProfile, MatchPlayerProfiles |
| `lib/match/stateLoader.ts` | Add function | loadMatchPlayerProfiles() |
| `components/match/PlayerAvatar.tsx` | Create | Avatar image or letter placeholder |
| `components/match/TimerDisplay.tsx` | Create | Extracted timer with urgency styling |
| `components/match/PlayerPanel.tsx` | Create | Full + compact player info panel |
| `app/match/[matchId]/page.tsx` | Modify | Fetch player profiles, pass as prop |
| `components/match/MatchClient.tsx` | Modify | New layout, PlayerPanel, overlay summary |
| `app/styles/board.css` | Modify | Three-column CSS, overlay, urgency pulse |
| `components/match/GameChrome.tsx` | Delete | Replaced by PlayerPanel |
