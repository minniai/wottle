# Quickstart: Server-Authoritative Timer and Frozen-Tile Tiebreaker

**Branch**: `007-server-authoritative-timer`

No new infrastructure. All Supabase tables, columns, and indexes are already in place from prior specs.

## Prerequisites

```bash
# From repo root
pnpm quickstart         # Starts Supabase (Docker), applies migrations, seeds data
pnpm dev                # Start Next.js dev server
```

## Run Tests

```bash
pnpm test               # Unit tests (Vitest) — includes clockEnforcer, matchSummary, resultCalculator
pnpm test:integration   # Integration tests (requires Supabase running)
pnpm exec playwright test --grep "timer|tiebreaker"  # E2E for timer flows
```

## Key Files for This Feature

| File | Purpose |
|------|---------|
| `lib/types/match.ts` | `MatchEndedReason` type — fix `"time_expiry"` → `"timeout"` |
| `lib/match/matchSummary.ts` | `computeFrozenTileCountByPlayer` — fix "both" exclusion |
| `app/actions/match/completeMatch.ts` | `determineMatchWinner` — add frozen-tile tiebreaker |
| `app/actions/match/submitMove.ts` | Fix `"time_expiry"` → `"timeout"` in `completeMatchInternal` call |
| `lib/match/clockEnforcer.ts` | Clock utilities (read-only; already correct) |
| `lib/match/roundEngine.ts` | Timer deduction + auto-pass synthesis (read-only; already correct) |

## TDD Cycle

```bash
# 1. Write failing test (Red)
pnpm test -- tests/unit/lib/match/matchSummary.test.ts

# 2. Implement fix (Green)
# Edit lib/match/matchSummary.ts

# 3. Confirm all tests pass
pnpm test && pnpm typecheck && pnpm lint
```

## Verify Timer Enforcement Manually

1. Start a match via the lobby
2. Open browser dev tools and set `player_a_timer_ms = 0` in the DB (via Supabase Studio)
3. Attempt a swap as Player A → should receive "Your time has expired" error
4. Attempt a swap as Player B → should succeed and auto-resolve the round
