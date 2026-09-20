# Phase 1 data model — Scored-letter integrity and ownership

No table or column changes. This feature adds invariants to entities that exist and one derived value.

## 1. Match row — the round pointer is not the board's address

| Field | Today | After |
| --- | --- | --- |
| `matches.current_round` | read by the loader as "the round whose board to serve" | for `in_progress`, the round to load; if its row is missing, a fault. For `completed` / `abandoned`, ignored for the board, scores and summary |
| `matches.board_seed` | regenerates a board whenever the round row is missing | a source only when the match has **no** round (bootstrap) |
| round-end write (`advanceRound` step 14, recovery) | `update … where id = ?` | `update … where id = ? and current_round = <round read at step 1> and state <> 'completed'`; zero rows → `match.write.stale` at warn, nothing else |

**Derived: `lastPlayedRound(matchId)`** — the highest `rounds.round_number` for the match with a non-null `board_snapshot_after`. For a completed match it is 10 (or the round a resignation, timeout or abandonment ended on). The loader serves that round's `board_snapshot_after`, that round's scoreboard snapshot, and that round's summary.

## 2. Word record and frozen tile — the invariants

Existing shapes (`word_score_entries.tiles`, `matches.frozen_tiles`) unchanged. Two invariants, checked after every resolution by `verifyMatchIntegrity`:

1. **Spelling.** For every record, the letters of the persisted board at `tiles`, in order, upper-cased Icelandic, equal the record's `word`.
2. **Immutability.** For every frozen cell, the letter on the persisted board equals the letter that was there when the cell froze. The "letter at freeze" is read from the board of the round the freezing word belongs to (`board_snapshot_after` of that round), so no new column is needed.

A violation is a `MatchIntegrityFailure { matchId, round, kind: "spelling" | "immutability", record?, cell?, expected, found }`, logged as `match.integrity.failed` and routed to `recoverStuckRound`.

## 3. Band (client) — derived, narrower

```ts
interface WordBand {
  id, seat, direction, strength, round, word;   // unchanged
  cells: Coordinate[];   // NOW: only the cells this word froze first — cells whose frozenTiles owner is this word's seat
  wordCells: Coordinate[]; // NEW: the whole word, for hover and the chevron
}
```

`bandCells(word, board, frozenTiles, seat)` returns `null` (no band) unless every coordinate is frozen **and** the board spells the word there; otherwise the subset owned by `seat`. The chevron is placed from `wordCells`. A band with fewer than two owned cells is still drawn if the word has ≥ 3 letters (an extension by one letter is one owned cell and one chevron).

## 4. Cell colour (client) — one source

`ownerSeatOf(frozenTiles, coord, viewerSlot): Seat | null` = `seatForSlot(viewerSlot, frozenTiles[key].owner)`. `Field` uses it for every scored cell's letter and numeral. The `shared` `CellState` and `sharedCells()` are removed; `Field`'s `sharedCells` prop goes with them.

## 5. Removed

- `CellState` member `"shared"`; `.field__cell[data-state="shared"]` and its numeral rule.
- `sharedCells` export and its tests.
- `ensureBoardSnapshot`'s seed fallback for a match with rounds.
