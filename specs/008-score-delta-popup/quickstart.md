# Quickstart: 008-score-delta-popup

**Date**: 2026-02-26

No new infrastructure required. This feature is a pure client-side addition to the existing match UI.

---

## Prerequisites

Standard project setup (already in place):

```bash
pnpm quickstart        # One-command: Supabase + Docker + migrations + seed + .env.local
pnpm dev               # Start Next.js dev server
```

---

## Manual Testing

1. Start a two-player match (two browser sessions / incognito tabs)
2. Each player selects a tile pair and submits a swap
3. After both submit, the round resolves — watch for the score delta popup above the player's score
4. To test invalid swap: attempt to swap a frozen tile (requires at least one round to complete first)

---

## Running Tests

```bash
# Unit tests (ScoreDeltaPopup, GameChrome, BoardGrid)
pnpm test

# E2E tests (requires Supabase + Docker running)
pnpm exec playwright test

# Specific unit file
pnpm test:unit -- tests/unit/components/match/ScoreDeltaPopup.test.tsx
pnpm test:unit -- tests/unit/components/GameChrome.test.tsx
pnpm test:unit -- tests/unit/components/game/BoardGrid.test.tsx
```

---

## Key Files

| File | Purpose |
|------|---------|
| `components/match/ScoreDeltaPopup.tsx` | Popup component (already implemented) |
| `components/match/GameChrome.tsx` | HUD bar, mounts popup (already implemented) |
| `components/match/MatchClient.tsx` | Derives `ScoreDelta` from `RoundSummary` (already implemented) |
| `components/game/BoardGrid.tsx` | Invalid shake via `invalidTiles` state (already implemented) |
| `app/styles/board.css` | CSS keyframes for both animations (already implemented) |
| `tests/unit/components/match/ScoreDeltaPopup.test.tsx` | Unit tests (9 passing) |
| `tests/unit/components/GameChrome.test.tsx` | Integration tests (passing) |
| `tests/unit/components/game/BoardGrid.test.tsx` | Invalid shake tests (passing) |
