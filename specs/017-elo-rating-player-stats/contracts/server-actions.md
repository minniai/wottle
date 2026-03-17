# Server Action Contracts: Elo Rating & Player Stats

**Feature**: 017-elo-rating-player-stats
**Date**: 2026-03-15

## Modified Actions

### completeMatchInternal (Modified)

**File**: `/app/actions/match/completeMatch.ts`
**Change**: Add Elo calculation and rating persistence after `determineMatchWinner()`.

**New return shape** (extends existing):
```typescript
interface CompleteMatchResult {
  // ... existing fields ...
  ratingChanges?: RatingChange; // NEW: populated when ratings update successfully
}
```

## New Actions

### getPlayerProfile

**File**: `/app/actions/player/getPlayerProfile.ts`
**Purpose**: Fetch a player's full profile including stats and rating trend.
**Auth**: Requires valid session (any authenticated player can view any profile).
**Rate limit**: None (read-only, low risk).

**Input**:
```typescript
interface GetPlayerProfileInput {
  playerId: string; // UUID of the player to fetch
}
```

**Output**:
```typescript
interface GetPlayerProfileResult {
  status: "ok" | "not_found" | "error";
  profile?: PlayerProfile;
  error?: string;
}
```

**Validation**:
- `playerId` must be a valid UUID (Zod)
- Player must exist in `players` table

**Behavior**:
1. Validate session via `readLobbySession()`
2. Fetch player row from `players` (stats + identity)
3. Fetch last 5 `match_ratings` rows for trend
4. Compute `winRate`: `wins / (wins + losses)` or null if `wins + losses === 0`
5. Return assembled `PlayerProfile`

### getMatchRatings

**File**: `/app/actions/match/getMatchRatings.ts`
**Purpose**: Fetch rating changes for a completed match (for FinalSummary display).
**Auth**: Requires valid session.
**Rate limit**: None.

**Input**:
```typescript
interface GetMatchRatingsInput {
  matchId: string; // UUID of the completed match
}
```

**Output**:
```typescript
interface GetMatchRatingsResult {
  status: "ok" | "not_found" | "error";
  ratings?: MatchRatingResult[];  // Array of 2 (one per player)
  error?: string;
}
```

**Behavior**:
1. Validate session
2. Query `match_ratings WHERE match_id = $1`
3. Return both players' rating records

## Internal Functions (not Server Actions)

### calculateElo

**File**: `/lib/rating/calculateElo.ts`
**Purpose**: Pure function implementing Elo formula.
**No side effects, no DB access.**

```typescript
function calculateElo(input: EloCalculationInput): EloCalculationResult;
```

### determineKFactor

**File**: `/lib/rating/calculateElo.ts`
**Purpose**: Returns K-factor based on games played.

```typescript
function determineKFactor(gamesPlayed: number): number;
// Returns 32 if gamesPlayed < 20, else 16
```

### persistRatingChanges

**File**: `/lib/rating/persistRatingChanges.ts`
**Purpose**: Atomic DB write for rating updates.

```typescript
function persistRatingChanges(
  matchId: string,
  playerA: MatchRatingResult,
  playerB: MatchRatingResult,
): Promise<void>;
```
