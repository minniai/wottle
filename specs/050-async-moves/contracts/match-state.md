# Contract: `MatchState`

`GET /api/match/[matchId]/state` and the `state` broadcast carry the same shape (`lib/types/match.ts`).

```ts
type MatchPhase = "pending" | "in_progress" | "completed" | "abandoned";

interface PlayerMatchFacts {
  playerId: string;
  movesPlayed: number;                                          // resolved moves
  score: number;
  inFlight: { moveId: string; globalSeq: number; receivedAt: string } | null;
  lastResolution: MoveResolution | null;                        // this player's latest finished move
}

interface MatchState {
  matchId: string;
  board: string[][];                                            // matches.board
  state: MatchPhase;
  players: { playerA: PlayerMatchFacts; playerB: PlayerMatchFacts };
  clock: { startedAt: string | null; deadlineAt: string | null; serverNow: string };
  moveLimit: 10;
  resolvedSeq: number;
  scores: ScoreTotals;
  frozenTiles: FrozenTileMap;
  winnerId?: string | null;
  endedReason?: MatchEndedReason | null;                        // moves_complete | incomplete | both_incomplete | disconnect | forfeit | abandoned | error
  disconnectedPlayerId?: string | null; disconnectedAt?: string | null; reconnectWindowMs?: number;
}
```

## Loader behaviour (`lib/match/stateLoader.ts`)

- `pending` on first load → set `board` (from the seed), `started_at`, `deadline_at`, `state = in_progress`; warm the dictionary in `after()`.
- In progress with a pending or stale move → dispatch `resolvePendingMoves` (deduplicated).
- In progress past `deadline_at` → dispatch `settleMatchIfDue` (deduplicated).
- `serverNow` is the database clock at read time; the client anchors its tick to `deadlineAt − (serverNow − localNow)`.
- Disconnect detection unchanged (heartbeats + `disconnectStore`); nothing pauses.

## Safety poll (`lib/room/safetySnapshot.ts`)

Apply a polled snapshot when `resolvedSeq` advanced, `state` changed, `inFlight` changed for either player, or the disconnect fields changed. Never regress `resolvedSeq` or scores.
