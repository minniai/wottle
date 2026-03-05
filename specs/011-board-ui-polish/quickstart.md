# Quickstart: Board UI Polish

**Branch**: `011-board-ui-polish`
**Scope**: Pure frontend — no Supabase migrations, no seed data changes.

## Prerequisites

- Node.js 20+, pnpm installed
- `.env.local` populated (run `pnpm quickstart` once if not done)

## Development

```bash
# Start dev server
pnpm dev
# → http://localhost:3000

# Run unit tests
pnpm test:unit

# Run lint + typecheck
pnpm lint && pnpm typecheck
```

## Testing the Feature Manually

1. Open `http://localhost:3000` on a mobile viewport simulator (e.g. iPhone 14 Pro in Chrome DevTools).
2. Ensure you can vertically scroll the page by dragging outside or inside the board.
3. Perform a pinch-to-zoom gesture on the board and verify it scales between 50% and 150%.
4. Log in and start a match.
5. Attempt to swap a tile that is frozen (or any invalid swap). Verify the tiles flash a red border and shake.
6. Check the HUD above the board. Verify it shows `M{n}` (e.g. M1) instead of "Round X".

## E2E Tests

```bash
# Full E2E suite
pnpm exec playwright test board-ui
```
