# Function Contracts: Server-Authoritative Timer and Frozen-Tile Tiebreaker

No new HTTP endpoints or Server Actions are introduced by this spec.
Changes are limited to internal function signatures and a type alias.

---

## Modified: `MatchEndedReason` — `lib/types/match.ts`

```typescript
// Before
export type MatchEndedReason =
  | "round_limit"
  | "time_expiry"
  | "disconnect"
  | "forfeit"
  | "error";

// After
export type MatchEndedReason =
  | "round_limit"
  | "timeout"
  | "disconnect"
  | "forfeit";
```

**Consumers**: `completeMatchInternal`, `submitMove`, `FinalSummary`, `reasonLabel` switch.

---

## Modified: `computeFrozenTileCountByPlayer` — `lib/match/matchSummary.ts`

```typescript
// Signature unchanged; behaviour updated
function computeFrozenTileCountByPlayer(
  frozenTiles: FrozenTileMap,
): { playerA: number; playerB: number }
```

**Invariant**: For any `FrozenTileMap`, `result.playerA + result.playerB ≤ Object.keys(frozenTiles).length`.
(`"both"` tiles are no longer double-counted.)

---

## Modified: `determineMatchWinner` — `app/actions/match/completeMatch.ts`

```typescript
// Before
function determineMatchWinner(
  scores: { playerAScore: number; playerBScore: number },
  playerAId: string,
  playerBId: string,
): WinnerResult;

// After
function determineMatchWinner(
  scores: { playerAScore: number; playerBScore: number },
  frozenCounts: { playerA: number; playerB: number },
  playerAId: string,
  playerBId: string,
): WinnerResult;

// WinnerResult (unchanged)
interface WinnerResult {
  winnerId: string | null;   // null = draw
  loserId: string | null;
  isDraw: boolean;
}
```

**Tiebreaker rules** (applied in order):
1. Higher score → wins
2. Equal score, more exclusively-owned frozen tiles → wins
3. Equal score, equal frozen tiles → draw (`winnerId = null`)

**Testable scenarios**:

| scoreA | scoreB | frozenA | frozenB | Expected |
|--------|--------|---------|---------|----------|
| 100 | 80 | any | any | Player A wins |
| 80 | 100 | any | any | Player B wins |
| 100 | 100 | 10 | 8 | Player A wins |
| 100 | 100 | 8 | 10 | Player B wins |
| 100 | 100 | 10 | 10 | Draw |
| 0 | 0 | 0 | 0 | Draw |

---

## Unchanged Server Actions

These Server Actions exist and enforce the spec requirements; no signature changes needed:

| Action | FR | What it enforces |
|--------|----|-----------------|
| `submitMove` | FR-002, FR-003 | Rejects move if `isClockExpired(roundStartedAt, playerTimerMs)` |
| `advanceRound` (internal) | FR-001, FR-003 | Deducts elapsed time; synthesizes auto-pass for timed-out players |
| `completeMatchInternal` | FR-004, FR-006, FR-007 | Sets `ended_reason`, calls updated `determineMatchWinner` |
