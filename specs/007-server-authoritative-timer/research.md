# Research: Server-Authoritative Timer and Frozen-Tile Tiebreaker

**Branch**: `007-server-authoritative-timer` | **Date**: 2026-02-26

## Decision Log

### D-001: Existing Timer Infrastructure (from spec 006)

**Decision**: Build on existing clock enforcement infrastructure from spec 006; do not re-implement.

**What already exists:**

| File | What it provides |
|------|-----------------|
| `lib/match/clockEnforcer.ts` | Pure functions: `computeRemainingMs`, `isClockExpired`, `computeElapsedMs` |
| `app/actions/match/submitMove.ts` lines 74–93 | Clock gate: rejects submission if `isClockExpired(roundStartedAt, playerTimerMs)` |
| `lib/match/roundEngine.ts` lines 76–111 | `maybeSynthesizeTimeoutPass()`: auto-pass for timed-out player when opponent submits |
| `lib/match/roundEngine.ts` lines 278–289 | `deductTimerMs()`: deducts elapsed time per player after each round |
| `lib/match/roundEngine.ts` lines 296–310 | Creates next round with `started_at: now()` for fresh clock baseline |
| `lib/match/stateLoader.ts` lines 239–294 | Server-computes `remainingMs` and `status` from DB timestamps for client hydration |
| `components/match/GameChrome.tsx` | Client countdown: syncs from server on broadcast, counts down locally between rounds |

**Rationale**: These are correctly implemented and tested. Only gaps remain.

---

### D-002: ended_reason Type Mismatch

**Decision**: Rename TypeScript `"time_expiry"` → `"timeout"` to align with the database constraint.

**Finding**: Database constraint in `20251115001_playtest.sql`:
```sql
ended_reason text check (ended_reason in ('round_limit','timeout','disconnect','forfeit','draw'))
```

Current TypeScript type in `lib/types/match.ts`:
```typescript
export type MatchEndedReason = "round_limit" | "time_expiry" | "disconnect" | "forfeit" | "error";
```

Mismatches:
- `"time_expiry"` (TS) vs `"timeout"` (DB) — **bug**: DB insert would fail
- `"error"` (TS) — not in DB constraint
- `"draw"` (DB) — not in TS type (draw expressed by `winner_id = null`, not ended_reason)

**Rationale**: DB is the source of truth. The spec (FR-004) specifies `"round_limit"` or `"timeout"`. Fix TS type to match. Remove `"error"` from TS (not a valid DB value). Do not add `"draw"` to TS (draws use `winner_id = null` with `"round_limit"` or `"timeout"` as reason).

**Callsites to update**:
- `app/actions/match/submitMove.ts` — `completeMatchInternal(matchId, "time_expiry")` → `"timeout"`
- Any other callers of `completeMatchInternal` passing `"time_expiry"`

---

### D-003: computeFrozenTileCountByPlayer Includes "both" (violates clarification Q2)

**Decision**: Fix the function to count only exclusively-owned tiles.

**Finding**: `lib/match/matchSummary.ts`:
```typescript
export function computeFrozenTileCountByPlayer(frozenTiles: FrozenTileMap) {
  let playerA = 0;
  let playerB = 0;
  for (const tile of Object.values(frozenTiles)) {
    if (tile.owner === "player_a" || tile.owner === "both") playerA++;  // BUG: includes "both"
    if (tile.owner === "player_b" || tile.owner === "both") playerB++;  // BUG: includes "both"
  }
  return { playerA, playerB };
}
```

**Clarification Q2**: `"both"` tiles count for neither player; only exclusively-owned tiles (`"player_a"` or `"player_b"`) are included in tiebreaker totals.

**Fix**:
```typescript
if (tile.owner === "player_a") playerA++;
if (tile.owner === "player_b") playerB++;
```

**Downstream impact**: `app/match/[matchId]/summary/page.tsx` calls this function and passes counts to `FinalSummary`. Once fixed, the display is automatically correct (FR-007). No other changes needed to the display layer.

---

### D-004: determineMatchWinner Uses Score Only (no tiebreaker)

**Decision**: Extend `determineMatchWinner()` to accept frozen tile counts and apply the tiebreaker when scores are equal.

**Finding**: `completeMatchInternal()` in `app/actions/match/completeMatch.ts`:
```typescript
const scores = await fetchLatestScores(supabase, matchId);
const result = determineMatchWinner(scores, match.player_a_id, match.player_b_id);
```

The function signature takes `scores` and two player IDs — no frozen tile input. Winner is determined by score only; equal scores yield a draw with no tiebreaker applied.

**Required change**:
1. After computing `scores`, also compute frozen tile counts from `match.frozen_tiles`
2. Pass counts to `determineMatchWinner(scores, frozenCounts, playerAId, playerBId)`
3. In the function: if `scoreA === scoreB`, compare `frozenA` vs `frozenB`; if equal → draw

**Rationale**: FR-004 specifies the tiebreaker. This is the only place winner determination happens.

---

### D-005: Round Start Timestamp — Already Exists

**Decision**: No action needed. `rounds.started_at` column was added in `20260225001_match_completion.sql` and is already set when a new round is created (`roundEngine.ts` line ~304: `started_at: new Date().toISOString()`).

**Rationale**: Clarification confirmed this resolves the "round start" ambiguity.

---

### D-006: Auto-Pass for Timed-Out Player — Already Exists

**Decision**: No action needed. `maybeSynthesizeTimeoutPass()` in `roundEngine.ts` handles this correctly.

**How it works**: When `advanceRound` is called (triggered by opponent's submission) and only 1 submission exists, it checks if the absent player's clock is expired via `isClockExpired(roundStartedAt, absentTimerMs)`. If expired, it inserts a synthetic `"timeout"` submission for the absent player, allowing round resolution to proceed.

**Aligns with**: Clarification Q1 (auto-resolve when opponent submits, timed-out player = automatic pass).

---

### D-007: Client Timer Countdown — Already Exists

**Decision**: No action needed. `GameChrome.tsx` already implements the specified behavior.

**How it works**:
- `useEffect` syncs `displaySeconds` whenever `timerSeconds` prop changes (server broadcast)
- `useEffect` with `setInterval(1000ms)` decrements locally when not paused
- Re-syncs on every round resolution broadcast

**Aligns with**: Clarification Q4 (count down from last server-synced value; re-sync on broadcast).

---

### D-008: Simultaneous Timeout — No Special Case

**Decision**: No special case needed in code. `ended_reason = "timeout"` and normal tiebreaker applies.

**How it works**: When both players' stored timers are 0 at round resolution:
- Both get synthetic "timeout" submissions
- Round resolves normally (no moves applied for either)
- `completeMatchInternal("timeout")` is called
- `determineMatchWinner` uses scores (likely 0-0) → tiebreaker → frozen tiles → draw if equal

**Aligns with**: Clarification Q5.

---

## Summary: Implementation Scope for Spec 007

| Item | Status | Action |
|------|--------|--------|
| Clock gate in submitMove | ✅ Complete | None |
| Timer deduction in roundEngine | ✅ Complete | None |
| Auto-pass synthesis | ✅ Complete | None |
| Client countdown | ✅ Complete | None |
| stateLoader timer hydration | ✅ Complete | None |
| `ended_reason` type alignment | ❌ Bug | Fix `"time_expiry"` → `"timeout"` in TS + callsites |
| `computeFrozenTileCountByPlayer` | ❌ Wrong | Exclude `"both"` tiles |
| `determineMatchWinner` tiebreaker | ❌ Missing | Add frozen-tile tiebreaker |
| Test: frozen tile tiebreaker | ❌ Missing | Add unit + integration tests |
| Test: exclusive count | ❌ Missing | Add unit tests for fixed function |
