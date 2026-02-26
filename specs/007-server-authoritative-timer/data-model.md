# Data Model: Server-Authoritative Timer and Frozen-Tile Tiebreaker

**Branch**: `007-server-authoritative-timer` | **Date**: 2026-02-26

No new tables or migrations required. All schema is in place from prior specs.

## Changes to Existing Types

### 1. `MatchEndedReason` — `lib/types/match.ts`

**Current (incorrect)**:
```typescript
export type MatchEndedReason =
  | "round_limit"
  | "time_expiry"    // ← wrong: DB uses "timeout"
  | "disconnect"
  | "forfeit"
  | "error";         // ← not in DB constraint
```

**Updated**:
```typescript
export type MatchEndedReason =
  | "round_limit"
  | "timeout"        // aligns with DB: ('round_limit','timeout','disconnect','forfeit','draw')
  | "disconnect"
  | "forfeit";
```

**DB constraint (unchanged)**:
```sql
ended_reason text check (ended_reason in ('round_limit','timeout','disconnect','forfeit','draw'))
```

Note: `"draw"` remains in DB constraint for potential future use; it is not added to the TS type because draws are currently expressed via `winner_id = null` with reason `"round_limit"` or `"timeout"`.

---

## Changes to Existing Functions

### 2. `computeFrozenTileCountByPlayer` — `lib/match/matchSummary.ts`

**Purpose**: Count exclusively-owned frozen tiles per player for tiebreaker and display.

**Current signature** (unchanged):
```typescript
computeFrozenTileCountByPlayer(frozenTiles: FrozenTileMap): { playerA: number; playerB: number }
```

**Behaviour change**: Exclude `"both"` tiles from both counts (per Q2 clarification).

| Owner value | Old behaviour | New behaviour |
|-------------|---------------|---------------|
| `"player_a"` | +1 to playerA | +1 to playerA |
| `"player_b"` | +1 to playerB | +1 to playerB |
| `"both"` | +1 to **both** | **no change** (excluded) |

---

### 3. `determineMatchWinner` — `app/actions/match/completeMatch.ts`

**Purpose**: Determine winner using score, then frozen-tile tiebreaker.

**Current signature**:
```typescript
function determineMatchWinner(
  scores: { playerAScore: number; playerBScore: number },
  playerAId: string,
  playerBId: string,
): { winnerId: string | null; loserId: string | null; isDraw: boolean }
```

**Updated signature** (frozen counts added):
```typescript
function determineMatchWinner(
  scores: { playerAScore: number; playerBScore: number },
  frozenCounts: { playerA: number; playerB: number },
  playerAId: string,
  playerBId: string,
): { winnerId: string | null; loserId: string | null; isDraw: boolean }
```

**Decision logic** (FR-004):
1. If `scoreA > scoreB` → Player A wins
2. If `scoreB > scoreA` → Player B wins
3. If `scoreA === scoreB` and `frozenA > frozenB` → Player A wins
4. If `scoreA === scoreB` and `frozenB > frozenA` → Player B wins
5. If `scoreA === scoreB` and `frozenA === frozenB` → draw (`winnerId = null`)

---

### 4. `completeMatchInternal` call site — `app/actions/match/completeMatch.ts`

After calling `computeFrozenTileCountByPlayer(match.frozen_tiles)`, pass the result to `determineMatchWinner`.

**Before**:
```typescript
const scores = await fetchLatestScores(supabase, matchId);
const result = determineMatchWinner(scores, match.player_a_id, match.player_b_id);
```

**After**:
```typescript
const scores = await fetchLatestScores(supabase, matchId);
const frozenCounts = computeFrozenTileCountByPlayer(
  (match.frozen_tiles as FrozenTileMap) ?? {},
);
const result = determineMatchWinner(scores, frozenCounts, match.player_a_id, match.player_b_id);
```

---

### 5. `submitMove.ts` callsite — `app/actions/match/submitMove.ts`

**Before** (line ~86):
```typescript
completeMatchInternal(matchId, "time_expiry")
```

**After**:
```typescript
completeMatchInternal(matchId, "timeout")
```

---

## Existing Schema (unchanged, for reference)

### matches table (relevant columns)

| Column | Type | Purpose |
|--------|------|---------|
| `player_a_timer_ms` | `integer` default 300000 | Remaining time for Player A (ms) |
| `player_b_timer_ms` | `integer` default 300000 | Remaining time for Player B (ms) |
| `winner_id` | `uuid` nullable | NULL = draw |
| `ended_reason` | `text` constrained | `'round_limit'` or `'timeout'` (for this spec) |
| `frozen_tiles` | `jsonb` default `'{}'` | Cumulative `FrozenTileMap` across all rounds |

### rounds table (relevant columns)

| Column | Type | Purpose |
|--------|------|---------|
| `started_at` | `timestamptz` nullable | Server timestamp when round entered collecting state |
| `completed_at` | `timestamptz` nullable | Server timestamp when round completed |

### move_submissions table (relevant columns)

| Column | Type | Purpose |
|--------|------|---------|
| `submitted_at` | `timestamptz` | Server timestamp of player submission (used for elapsed-time deduction) |
| `status` | `text` | `'pending'`, `'accepted'`, `'rejected_invalid'`, `'timeout'` |

---

## Downstream Impact Summary

| File | Change | Impact |
|------|--------|--------|
| `lib/types/match.ts` | `MatchEndedReason` rename | TypeScript callers get compile-time errors on `"time_expiry"` and `"error"` — all must be updated |
| `lib/match/matchSummary.ts` | Exclude `"both"` from counts | `app/match/[matchId]/summary/page.tsx` automatically shows correct exclusive counts in FinalSummary (FR-007) |
| `app/actions/match/completeMatch.ts` | Tiebreaker + frozen counts | Winner determination now correct for tied scores |
| `app/actions/match/submitMove.ts` | `"time_expiry"` → `"timeout"` | DB insert no longer silently fails on timeout completion |
