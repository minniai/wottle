# Quickstart: Rematch & Post-Game Loop

**Feature**: 016-rematch-post-game-loop | **Date**: 2026-03-15

## Prerequisites

- Node.js 20+, pnpm
- Supabase CLI + Docker (for local DB)
- Running dev environment (`pnpm quickstart` previously completed)

## Setup

### 1. Apply migration

```bash
pnpm supabase:migrate
```

This creates the `rematch_requests` table and adds `matches.rematch_of` column.

### 2. Verify migration

```bash
pnpm supabase:verify
```

### 3. Start dev server

```bash
pnpm dev
```

## Manual Testing Flow

### Rematch Request → Accept

1. Open two browser windows (different players)
2. Complete a match (play through 10 rounds or let timer expire)
3. Both players land on the FinalSummary page
4. Player A clicks "Rematch" → button shows "Waiting for opponent..."
5. Player B sees banner: "[Player A] wants a rematch!" with Accept/Decline
6. Player B clicks "Accept"
7. Both see "Starting new game..." interstitial (~500ms)
8. Both redirect to new match

### Rematch Request → Decline

1. Follow steps 1-5 above
2. Player B clicks "Decline"
3. Player A sees "Opponent declined" (button disabled)
4. Both can click "Back to Lobby"

### Simultaneous Rematch

1. Follow steps 1-3 above
2. Both players click "Rematch" at the same time
3. Both see interstitial → redirect to new match (no invitation step)

### Timeout

1. Follow steps 1-4 above
2. Wait 30 seconds without responding
3. Player A sees "No response — returning to lobby" → redirected to lobby

### Series Tracking

1. Complete a rematch (any flow above that creates a new match)
2. Play through the new match
3. On FinalSummary, verify series badge: "Game 2 — You lead 1-0" (or similar)

## Running Tests

```bash
# Unit tests (includes rematchService tests)
pnpm test

# Specific rematch tests
pnpm test -- tests/unit/lib/match/rematchService.test.ts

# All checks
pnpm typecheck && pnpm lint && pnpm test
```

## Key Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260316001_rematch.sql` | Database migration |
| `lib/types/match.ts` | RematchRequest, RematchEvent, SeriesContext types |
| `lib/match/rematchService.ts` | Pure business logic |
| `lib/match/rematchRepository.ts` | Database access |
| `lib/match/rematchBroadcast.ts` | Realtime broadcasting |
| `app/actions/match/requestRematch.ts` | Request server action |
| `app/actions/match/respondToRematch.ts` | Respond server action |
| `components/match/useRematchNegotiation.ts` | Client state machine hook |
| `components/match/FinalSummary.tsx` | Updated UI with rematch flow |
| `components/match/RematchBanner.tsx` | Invitation banner |
| `components/match/RematchInterstitial.tsx` | Transition overlay |
