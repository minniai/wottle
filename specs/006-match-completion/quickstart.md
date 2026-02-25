# Quickstart: 006-match-completion

**Branch**: `006-match-completion`

## Prerequisites

All tools from prior specs are required. No new dependencies.

```bash
pnpm quickstart          # Start Supabase + apply migrations + seed
pnpm dev                 # Start Next.js dev server
```

## Apply the New Migration

After checking out the branch:

```bash
pnpm supabase:migrate    # Applies 20260225001_match_completion.sql (adds rounds.started_at)
pnpm supabase:verify     # Confirm schema is clean
```

## Running Tests for This Feature

```bash
# Unit tests (clock logic, timeout-pass synthesis)
pnpm test:unit -- lib/match/clockEnforcer

# Integration tests (submitMove with expired clock, round advancement)
pnpm test:integration -- tests/integration/match/clockEnforcement.spec.ts
pnpm test:integration -- tests/integration/match/matchCompletion.spec.ts

# All unit + contract tests
pnpm test:unit

# E2E: Full match with time-expired scenario
pnpm exec playwright test --grep "match completion"

# Performance gate (move RTT must remain <200ms p95)
pnpm perf:round-resolution
```

## Key Files to Understand Before Implementing

| File | Why |
|------|-----|
| `lib/match/roundEngine.ts` | Core loop; where `started_at` is set and timeout-pass is synthesised |
| `app/actions/match/submitMove.ts` | Where clock check is inserted |
| `lib/match/stateLoader.ts` | Where mid-round `remainingMs` is computed for broadcasts |
| `app/match/[matchId]/summary/page.tsx` | Game-over screen data loading |
| `components/match/FinalSummary.tsx` | Game-over screen component |
| `supabase/migrations/20260225001_match_completion.sql` | New migration |

## TDD Order of Implementation

Follow task order in `tasks.md`. Each task includes a "Red" step (failing test first).

1. Migration + schema tests
2. `clockEnforcer.ts` — pure functions, fully unit-testable
3. `submitMove` clock gate
4. `roundEngine` `started_at` write + timeout-pass synthesis
5. Timer deduction after round resolution
6. `stateLoader` mid-round remaining computation
7. `FinalSummary` frozen tile count + top words
8. Integration + E2E tests
