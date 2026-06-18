# Quickstart: Improve Scoring Resolution Visualization

## Prerequisites

```bash
pnpm install
pnpm quickstart      # Supabase preflight, Docker, migrations, seed, .env.local (first run only)
```

## Run locally

```bash
pnpm dev             # http://localhost:3000
```

Open two browser sessions (e.g. a normal window + an incognito window), log in as two different
players, and start a match between them so you can drive both sides of a round.

## What to verify manually (maps to user stories)

### US2 — Calm waiting state (no grey-out)
1. As player A, submit a move.
2. **Expect**: the board tiles stay full color (no dim/desaturation). A board frame + a
   "Move submitted — waiting for opponent" banner indicate you are waiting.
3. Try clicking tiles — nothing submits a second move.

### US1 — Current-round scored, distinct from previous rounds
1. Play a round where at least one earlier round already froze some tiles.
2. Score a word this round (on either side).
3. **Expect**: the newly-scored tiles show a distinct, player-colored glow/ring that **persists until
   the round completes** (it does not vanish after ~1s). Earlier-round tiles show the calmer frozen
   tint.
4. Let the round complete (both players move). **Expect**: the just-scored tiles settle into the
   frozen tint; the next round's scored tiles are again uniquely marked.

### US3 — Swap reveal-then-fade
1. Make a swap that forms **no** word.
2. **Expect**: the swapped tiles animate in and briefly lift, then the lift fades, leaving plain
   letters (no leftover highlight).
3. Make a swap that **does** form a word. **Expect**: the scoring tiles transition into the
   current-round scored mark instead of fading.

### Spec-042 consistency (instant scoring)
1. As the **first** mover, score a word.
2. **Expect**: your scored tiles reveal on both boards immediately and keep the current-round mark.
   When the full round resolves, those tiles must **not** re-flash or change color.

### Reduced motion
1. Enable OS "reduce motion".
2. **Expect**: waiting frame, scored-current ring, and swap reveal all use static (non-animated)
   equivalents that still clearly convey each state.

### Realtime/polling parity (FR-014)
1. Set `NEXT_PUBLIC_DISABLE_REALTIME=true` in `.env.local` and restart `pnpm dev`.
2. Re-run the US1/US2/US3 checks above.
3. **Expect**: the current-round mark, waiting frame, and swap reveal-fade behave
   identically to Realtime mode (all new visuals derive from `matchState`, which the
   polling fallback populates the same way).

## Automated tests

```bash
# Unit — new pure helper + BoardGrid class output
pnpm test:unit -- lib/match/currentRoundScored.spec.ts
pnpm test:unit -- tests/unit/components/BoardGrid

# E2E — two-player resolution visualization
pnpm exec playwright test --grep "scoring resolution"

# Gates
pnpm lint
pnpm typecheck
```

## Done criteria
- All three user stories verified manually in a two-player match.
- New unit + E2E specs pass; `pnpm lint` (zero warnings) and `pnpm typecheck` clean.
- No regression in the existing round-recap, instant-scoring (042), and opponent-reveal (#210)
  behaviors.
