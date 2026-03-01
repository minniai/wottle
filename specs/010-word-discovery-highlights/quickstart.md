# Quickstart: Word Discovery Highlights

**Branch**: `010-word-discovery-highlights`
**Scope**: Pure frontend — no Supabase migrations, no seed data changes, no environment variables

## Prerequisites

- Node.js 20+, pnpm installed
- `.env.local` populated (run `pnpm quickstart` once if not done)
- Local Supabase running (needed for E2E tests only)

## Development

```bash
# Start dev server
pnpm dev
# → http://localhost:3000

# Run unit tests for the changed files
pnpm test:unit -- BoardGrid
pnpm test:unit -- MatchClient

# Run all unit tests
pnpm test:unit

# Run lint + typecheck (zero-warnings policy)
pnpm lint && pnpm typecheck
```

## Testing the Feature Manually

1. Open two browser windows at `http://localhost:3000`
2. Log in as two different players and start a match
3. Complete a round where at least one word is scored
4. After round resolves: scored tiles should glow (blue for Player A, red for Player B) for ~700ms
5. After glow fades: round summary panel appears
6. Enable OS "Reduce Motion" setting: repeat step 3-4, summary should appear instantly with no glow

## E2E Tests

```bash
# Full E2E suite (requires Supabase + Next.js running)
pnpm exec playwright test board-ui

# Specific highlight test (once added)
pnpm exec playwright test --grep "word discovery highlights"
```

## Key Files Changed

| File | Change |
|------|--------|
| `app/styles/board.css` | `scored-tile-highlight` keyframe: 3s→700ms, `--highlight-color` var, add reduced-motion override |
| `components/match/MatchClient.tsx` | Add `animationPhase` state machine; derive `highlightPlayerColors`; gate `RoundSummaryPanel` |
| `components/game/BoardGrid.tsx` | Add `highlightPlayerColors` prop; set `--highlight-color` inline style per scored tile |
| `tests/unit/components/BoardGrid.test.tsx` | New failing tests for T029 |
| `tests/unit/components/MatchClient.test.tsx` | New failing tests for T030 |

## Debugging

Add `?debug=1` to the match URL to see the animation phase state in the debug panel (after wiring).

Check browser DevTools → Elements → board tile with `board-grid__cell--scored` class to confirm `--highlight-color` CSS variable is set correctly.
