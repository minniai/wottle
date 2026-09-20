# Contract: the post-resolution integrity check

`verifyMatchIntegrity({ board, records, frozenTiles, letterAtFreeze }): MatchIntegrityFailure[]` — `lib/match/matchIntegrity.ts`, pure.

Called by `advanceRound` after step 9c (the board is persisted) and before step 13 (the next round), and by recovery after it re-scores. Inputs come from what the caller already holds plus one read of the match's records.

| Check | Passes when |
| --- | --- |
| spelling | for every record, `upper(board at tiles) === upper(word)` (Icelandic upper case, `ð → Ð`, `æ → Æ`) |
| immutability | for every frozen cell, `board[cell] === letterAtFreeze[cell]`, where `letterAtFreeze` is read from the `board_snapshot_after` of the round whose word froze the cell |

On any failure: `logPlaytestError("match.integrity.failed", { matchId, round, failures })`, then `recoverStuckRound(matchId)`; the round does not open the next one from this invocation. The check never throws.

## Client mirror

`bandCells(word, board, frozenTiles, seat)` returns `null` when the board does not spell the word at its cells. `assertWordsSpellBoard` reports once per match at warn in every environment (`bands.record-mismatch`), never throws.

## Tests

- `tests/unit/lib/match/matchIntegrity.spec.ts`: clean match → `[]`; a record whose letters moved → one spelling failure naming the letters found; a frozen cell whose letter changed → one immutability failure; Icelandic case folding.
- `tests/unit/lib/room/bandGeometry.spec.ts` (extend): a frozen-but-misspelled record draws no band.
- `tests/unit/lib/room/wordIntegrity.spec.ts` (extend): one warn per match, none in a second render.
