# Contract: the move resolver

`lib/match/moveResolver.ts` — `resolvePendingMoves(matchId): Promise<void>`

## Loop

```
loop
  claimed = rpc claim_next_move(matchId, STALE_CLAIM_MS)          // the move at resolved_seq + 1, pending or stale
  if none: break
  result  = resolveOne(claimed)                                     // pure
  written = rpc finish_move(claimed.id, claimed.global_seq - 1, payload)
  if written === 0: break                                           // someone else finished it; stop
  publish move-resolved(result); publish state
  if both counts === moveLimit: settleMatchIfDue(matchId)
```

## `resolveOne` (pure, deterministic over its inputs)

Inputs: the move row, `board`, `frozen_tiles`, both scores and counts, the player's prior words (not needed for scoring; kept for the integrity log).

1. `frozen`: either endpoint in `frozen_tiles` → `rejected / frozen`.
2. `moved`: `board[from] !== from_letter || board[to] !== to_letter` → `rejected / moved`.
3. `applySwap` → scan from the two coordinates (`scanFromSwapCoordinates`) → `selectOptimalCombination` (rules §4, §7.2) → score (letter points + length bonus, combo per move) → `freezeTiles` with the 24-unfrozen floor.
4. No duplicate suppression (FR-007).
5. Output: `{ status, rejectionReason?, boardAfter, frozenAfter, words, delta, seq (player count + 1 when resolved) }`.

## Ordering guarantee

Only the move at `resolved_seq + 1` can be claimed; the claim is one atomic `UPDATE … WHERE status = 'pending'`; the finish is a CAS on `resolved_seq`. Two lambdas racing on the same match: one claims, one gets nothing. A zombie that finishes after a reclaim writes zero rows.

## Recovery

- Claim not finished in `STALE_CLAIM_MS` (10 000) → reclaimable by any resolver.
- Triggers of `resolvePendingMoves`: the `after()` hook of `submitMove`; `loadMatchState` when it sees a pending or stale move (deduplicated per process as today's `pendingSelfHeals`); the cron sweep; `settleMatchIfDue`.
- Three consecutive failed claims on one move (tracked by `claimed_at` churn) → `completeMatchInternal(matchId, "error")`.

## Observability

`move.resolved { matchId, moveId, playerId, globalSeq, seq, status, durationMs, words, delta }`, `move.reclaimed { matchId, moveId, staleMs }`, `move.resolver.failed`.
