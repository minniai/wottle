# Quickstart: Elo Rating & Player Stats

**Feature**: 017-elo-rating-player-stats
**Date**: 2026-03-15

## Prerequisites

- Supabase local instance running (`pnpm supabase start`)
- `.env.local` configured (`pnpm quickstart`)
- Feature branch checked out: `017-elo-rating-player-stats`

## Setup Steps

### 1. Apply Migration

```bash
pnpm supabase:migrate
```

This applies the new migration that:
- Sets `elo_rating` default to 1200 and makes it NOT NULL
- Adds `games_played`, `wins`, `losses`, `draws` columns to `players`
- Creates `match_ratings` table with indexes and RLS policies

### 2. Verify Schema

```bash
pnpm supabase:verify
```

### 3. Run Tests

```bash
# Unit tests for Elo calculation (pure logic)
pnpm test:unit -- lib/rating/

# Integration tests for rating persistence
pnpm test:integration -- rating

# All tests (verify nothing broken)
pnpm test
```

### 4. Start Dev Server

```bash
pnpm dev
```

## Manual Verification

1. **Lobby ratings**: Log in → lobby shows "1200" next to each username
2. **Post-match ratings**: Complete a match → FinalSummary shows rating change (green/red delta)
3. **Profile view**: Click a username in lobby → modal shows stats and rating trend
4. **Elo difference**: In lobby, each opponent shows their Elo difference from you

## Key Files

| File | Purpose |
|------|---------|
| `lib/rating/calculateElo.ts` | Pure Elo formula (no deps) |
| `lib/rating/persistRatingChanges.ts` | Atomic DB write |
| `app/actions/player/getPlayerProfile.ts` | Profile data Server Action |
| `app/actions/match/completeMatch.ts` | Modified: triggers Elo calc |
| `components/lobby/LobbyCard.tsx` | Modified: shows Elo rating |
| `components/match/FinalSummary.tsx` | Modified: shows rating delta |
| `components/player/PlayerProfileModal.tsx` | New: profile modal |
| `supabase/migrations/20260315001_elo_rating.sql` | Schema changes |
