# Data Model: Elo Rating & Player Stats

**Feature**: 017-elo-rating-player-stats
**Date**: 2026-03-15

## Entity Changes

### Players Table (Modified)

Existing table with new columns added:

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `id` | uuid | gen_random_uuid() | NO | PK (existing) |
| `username` | citext | — | NO | Unique (existing) |
| `display_name` | text | '' | NO | (existing) |
| `avatar_url` | text | — | YES | (existing) |
| `status` | text | 'available' | NO | (existing) |
| `last_seen_at` | timestamptz | now() | NO | (existing) |
| `elo_rating` | integer | 1200 | NO | **Modified**: change from nullable to NOT NULL with default 1200 |
| `games_played` | integer | 0 | NO | **New**: total completed matches |
| `wins` | integer | 0 | NO | **New**: total wins |
| `losses` | integer | 0 | NO | **New**: total losses |
| `draws` | integer | 0 | NO | **New**: total draws |
| `created_at` | timestamptz | now() | NO | (existing) |
| `updated_at` | timestamptz | now() | NO | (existing) |

**Constraints**:
- `elo_rating >= 100` (CHECK constraint — rating floor)
- `games_played >= 0`, `wins >= 0`, `losses >= 0`, `draws >= 0`
- `games_played = wins + losses + draws` (CHECK constraint — consistency)

**Migration notes**:
- Existing `elo_rating` column is nullable integer. Migration sets all NULL values to 1200, then alters to NOT NULL DEFAULT 1200.
- New columns added with DEFAULT 0.

### Match Ratings Table (New)

Stores per-match rating snapshots for both players.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `id` | uuid | gen_random_uuid() | NO | PK |
| `match_id` | uuid | — | NO | FK → matches(id), UNIQUE per player |
| `player_id` | uuid | — | NO | FK → players(id) |
| `rating_before` | integer | — | NO | Rating at start of match |
| `rating_after` | integer | — | NO | Rating after match |
| `rating_delta` | integer | — | NO | Change (rating_after - rating_before) |
| `k_factor` | integer | — | NO | K-factor used (16 or 32) |
| `match_result` | text | — | NO | 'win', 'loss', or 'draw' |
| `created_at` | timestamptz | now() | NO | Timestamp |

**Constraints**:
- UNIQUE(match_id, player_id) — one rating record per player per match
- `match_result IN ('win', 'loss', 'draw')`
- `k_factor IN (16, 32)`
- `rating_before >= 100`, `rating_after >= 100`

**Indexes**:
- `idx_match_ratings_player_created` ON (player_id, created_at DESC) — for trend query (last 5 games)
- `idx_match_ratings_match` ON (match_id) — for match-specific lookups

**RLS Policies**:
- SELECT: Any authenticated player can read any match rating record (ratings are public)
- INSERT/UPDATE/DELETE: Service role only (server-side mutations)

## TypeScript Types

### New Types (`/lib/types/match.ts`)

```typescript
export interface EloCalculationInput {
  playerRating: number;
  opponentRating: number;
  actualScore: number; // 1.0 = win, 0.5 = draw, 0.0 = loss
  kFactor: number;     // 32 or 16
}

export interface EloCalculationResult {
  newRating: number;
  delta: number;
  expectedScore: number;
}

export interface MatchRatingResult {
  playerId: string;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  kFactor: number;
  matchResult: "win" | "loss" | "draw";
}

export interface PlayerStats {
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null; // null if no decisive games
}

export interface PlayerProfile {
  identity: PlayerIdentity;
  stats: PlayerStats;
  ratingTrend: number[]; // last 5 rating_after values, oldest first
}

export interface RatingChange {
  playerADelta: number;
  playerBDelta: number;
  playerARatingAfter: number;
  playerBRatingAfter: number;
}
```

### Modified Types

```typescript
// Extend PlayerSummary (used in FinalSummary props)
export interface PlayerSummary {
  // ... existing fields ...
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
}
```

## State Transitions

```
Match Completion Flow:

  match.state = "completed"
         ↓
  determineMatchWinner()
         ↓
  calculateEloDeltas()  ← NEW
    - Fetch both players' current elo_rating, games_played
    - Determine K-factor per player
    - Compute expected scores
    - Compute new ratings (with floor)
         ↓
  persistRatingChanges()  ← NEW
    - INSERT 2 rows into match_ratings
    - UPDATE players SET elo_rating, games_played, wins/losses/draws
    - (single transaction)
         ↓
  publishMatchState()
    - MatchState now includes rating deltas
```

## Query Patterns

### Rating Update (write, on match completion)
```sql
-- Atomic: insert rating records + update player stats
BEGIN;

INSERT INTO match_ratings (match_id, player_id, rating_before, rating_after, rating_delta, k_factor, match_result)
VALUES ($1, $2, $3, $4, $5, $6, $7), ($1, $8, $9, $10, $11, $12, $13);

UPDATE players SET elo_rating = $4, games_played = games_played + 1, wins = wins + $14, losses = losses + $15, draws = draws + $16, updated_at = now() WHERE id = $2;
UPDATE players SET elo_rating = $10, games_played = games_played + 1, wins = wins + $17, losses = losses + $18, draws = draws + $19, updated_at = now() WHERE id = $8;

COMMIT;
```

### Player Profile (read)
```sql
-- Stats from players table (indexed by PK)
SELECT elo_rating, games_played, wins, losses, draws FROM players WHERE id = $1;

-- Trend from match_ratings (indexed by player_id + created_at)
SELECT rating_after FROM match_ratings WHERE player_id = $1 ORDER BY created_at DESC LIMIT 5;
```

### Match Rating Deltas (read, for FinalSummary)
```sql
SELECT player_id, rating_before, rating_after, rating_delta, match_result
FROM match_ratings WHERE match_id = $1;
```
