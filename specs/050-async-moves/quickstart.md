# Quickstart: Ten moves each on one shared clock

## Run it

```bash
pnpm quickstart          # applies 20260921001_async_moves.sql (destructive: deletes matches, resets ratings)
pnpm dev
```

Open two browsers, sign in as two names, `find an opponent ▸` in both. Each player has ten moves; the ledger clock counts 5:00 down for both.

## See every state without a database

```
/dev/room?phase=idle          your move, caption clock
/dev/room?phase=scoring       your move resolving, field locked
/dev/room?phase=scored        the 600ms hold
/dev/room?phase=opp-reveal    Kári's band drawing while you pick
/dev/room?phase=rejected      frozen · Kári just froze it · pick another
/dev/room?phase=done-waiting  10 of 10 played, over `waiting for Kári · 8 of 10 · 1:12 left`
/dev/room?phase=time-up       time · scoring
/dev/room?phase=end-early     Kári is gone · end the match ▸
/dev/room?phase=over-slip     match over with `Kári played 8 of 10`
```

`pnpm test:visual` compares them all at three viewports.

## Verify the server

```bash
pnpm test:unit -- tests/unit/lib/match/moveResolver.spec.ts
pnpm test:unit -- tests/unit/lib/match/resultCalculator.test.ts
pnpm test:unit -- tests/unit/lib/match/matchSettlement.spec.ts
pnpm test:integration -- tests/integration/db/receiveMove.race.test.ts
pnpm test:integration -- tests/integration/db/moveResolver.race.test.ts
pnpm test:integration -- tests/integration/db/settlement.test.ts
pnpm exec playwright test tests/integration/ui/moves-flow.spec.ts
PLAYTEST_MATCH_CLOCK_MS=20000 pnpm exec playwright test tests/integration/ui/deadline-flow.spec.ts
pnpm perf:move-receipt
pnpm perf:move-resolve
```

## What to look for in a live match

- The field is framed teal only while a move is yours to make; it loses the frame the moment you commit and gets it back after the hold.
- Kári's bands draw on your field while you pick; a pick on a letter he just touched clears with a notice.
- The caption reads `move 4 of 10 · 3:12`; under 1:00 the numeral blinks.
- At 0:00, or when both have ten, the match-over slip says who won and why (`Kári played 8 of 10`, `neither finished`, or the counted line).
