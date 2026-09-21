# Contract: the `move-resolved` broadcast

Channel `match:<matchId>`. Events: `state` (full `MatchState`, unchanged name), `move-resolved` (new), `rematch` (unchanged). `round-summary` is retired.

## Payload

```ts
interface MoveResolution {
  matchId: string; moveId: string; playerId: string; globalSeq: number;
  seq: number | null;                       // null when rejected
  status: "resolved" | "rejected"; rejectionReason?: "frozen" | "moved";
  swap: { from: Coordinate; to: Coordinate };
  board: string[][];                        // after; unchanged when rejected
  words: WordScore[]; delta: number; totals: ScoreTotals;
  frozenTiles: FrozenTileMap; movesPlayed: { playerA: number; playerB: number };
  resolvedAt: string;
}
```

Zod: `moveResolutionSchema` in `lib/match/schemas.ts`. Size: the board is ~400 bytes; the whole payload stays under 4 KB.

## Client handling (`roomStore.applyResolution`)

- Ignore when `globalSeq <= resolvedSeq` (idempotent under the safety poll).
- Write `board`, `frozenTiles`, `scores`, both counts, `players.<slot>.lastResolution`; clear that player's `inFlight`.
- Own resolution → `ownReveal` (bands + count-up, locks the field, then the 600ms hold). Opponent's → `oppReveal` (bands only, never locks). Rejected own → `moveRejected` to the field reducer; no reveal.

## Delivery

Best effort, as today; the 2s safety poll converges on `resolvedSeq`, and `loadMatchState` carries `lastResolution` per player so a reload draws the last move's bands without re-animating already drawn ones.
