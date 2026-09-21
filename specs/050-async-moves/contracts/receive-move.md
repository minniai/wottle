# Contract: receiving a move

**Server action** `submitMove(matchId, { fromX, fromY, toX, toY, fromLetter, toLetter })` → `Promise<MoveResult>`
**Route** `POST /api/match/[matchId]/move` (same body; 200 on `accepted`, 400 on `rejected`, 401/403/429 as today)

## Gates, in order

1. Session; participant check inside the RPC.
2. Rate limit `match:submit-move` 30/min per player (unchanged).
3. Zod `moveRequestSchema`: coordinates 0..9, not the same cell, `fromLetter`/`toLetter` one uppercase letter each.
4. `receive_move` RPC under `select … for update` on the match row:
   - `state <> 'in_progress'` → `rejected / ended`
   - `clock_timestamp() > deadline_at` → `rejected / deadline`
   - `player_x_moves >= move_limit` → `rejected / cap`
   - a `pending|resolving` row for the player → `rejected / in_flight`
   - else `move_seq += 1`, insert `pending`, return `accepted`.
5. `after(() => resolvePendingMoves(matchId))`.

No frozen-tile check in the action: the resolver decides authoritatively (FR-005). The client already refuses frozen picks locally.

## Result

```ts
type MoveResult =
  | { status: "accepted"; moveId: string; globalSeq: number; receivedAt: string }
  | { status: "rejected"; reason: "ended" | "deadline" | "cap" | "in_flight"; error: string };
```

`grid` is gone: the board arrives with the resolution.

## Observability

`move.received { matchId, playerId, globalSeq, receivedAt }`, `move.refused { matchId, playerId, reason }`.
