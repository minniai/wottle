# Contract: `lastMoves`

```ts
export function lastMoves(latest: { you: MoveResolution | null; opp: MoveResolution | null }, frozen: FrozenTileMap): LastMoves;
export function latestResolved(prev: MoveResolution | null, next: MoveResolution): MoveResolution | null; // keeps prev when next is rejected
```

- `latest.*` holds only `status === "resolved"` resolutions. The store never replaces a resolved move with a rejected one.
- Output: at most two cells per seat, `swap.from` and `swap.to`, minus the frozen cells.
- `FieldCell` draws a 2px bar in `getSeatColors(seat).ink` along its bottom inner edge, above any band. Its `aria-label` ends with `copy.lastMoveOf(name)`.
- A snapshot's `lastResolution` with status `rejected` is ignored, which leaves no tick after a reload (review 1A).
