# Contract: one owner, one colour

## Letter colour

A scored cell's letter and numeral take the seat of `frozenTiles[cell].owner` (`ownerSeatOf` in `lib/room/bandGeometry.ts`), resolved through `getSeatColors`. Band membership never decides a cell's colour. `CellState` loses `"shared"`.

## Band cells

`bandCells` returns, for a word that spells and is fully frozen, the cells whose owner is the word's own seat: the letters this word froze first. `WordBand` gains `wordCells` (the whole word) for hover and chevron placement.

| Case | Band cells | Chevron |
| --- | --- | --- |
| word froze all its letters | all | reading start |
| crosses one letter the other seat froze earlier | all but that one | reading start (may sit over the other seat's cell; drawn in this band's colour, 1.5px, as today) |
| extends the other seat's run by one letter (`gáta` → `gátan`) | the one new letter | reading start of `gátan`, over the other seat's `g` |
| same seat, same cell twice (a word re-crossing its owner's earlier word) | all cells (same owner) — the tints stack as today | reading start |

## Hover

`highlightRound` lights every `wordCells` of the round's bands, including cells another band owns; the lit cell keeps its owner's colour.

## Fixtures and docs

- `app/dev/room/fixtures.ts`: `LEK` (round 3, you) over `GILT` (round 2, opp): `(7,6)` is Kári's; LEK's band covers `(8,6)` and `(9,6)`; comment updated.
- Design system §2 (drop the "shared letter is ink" bullet), §5.1 (drop the `shared` row; scored/frozen row reads "the owner's seat colour, inside the owner's band"), §5.2 (a band covers the letters its word froze first; crossings keep the earlier owner).
- Rules §12 crossing row: "Both words are recorded; the crossing letter keeps the colour and band of the player who froze it first; the later word's band covers its other letters."
- Baselines: `reveal`, `settle`, `final`, `over-slip` and the phone phases that show the crossing.

## Tests

- `tests/unit/components/room/Field.spec.tsx`: a cell frozen by `player_b` renders `data-seat="opp"` whatever bands cover it; no cell ever has `data-state="shared"`; `aria-label` names one owner.
- `tests/unit/lib/room/bandGeometry.spec.ts`: the four cases above; `sharedCells` no longer exported (type-level).
- `tests/integration/ui/room-fixtures.spec.ts`: `reveal` shows the L in coral inside GILT's tint and LEK's band over two cells.
