# Contract: which round a match state is served from

`loadMatchState(client, matchId)` — `lib/match/stateLoader.ts`. Read by the match page, the `/state` poll and every `publishMatchState`.

## Round selection

| `matches.state` | round used for board · scores · summary | when its row is missing |
| --- | --- | --- |
| `pending` (no rounds) | none; round 1 is upserted from the seed (bootstrap, unchanged) | — |
| `in_progress` | `current_round` | serve `lastPlayedRound`'s board, log `match.round.missing` at error, `triggerRecoveryInBackground` |
| `completed` / `abandoned` | `lastPlayedRound` = max `round_number` with `board_snapshot_after` | log at error; serve the seed board only if there is truly no round (then the match is broken beyond this loader) |

`currentRound` on the returned `MatchState` stays `matches.current_round` (the ledger's `final · 10 of 10` and the rail read it); only the board, the scores snapshot and the summary move to `lastPlayedRound`.

## `ensureBoardSnapshot`

Regenerates from the seed **only** when called with `hasRounds === false`. Otherwise a missing or unparseable snapshot throws `MatchStateError("board snapshot missing")`, which the loader turns into the error log and the recovery trigger above, and serves the last readable snapshot it can find (previous round's `_after`) rather than nothing.

## Tests

- `tests/unit/lib/match/stateLoader.lastPlayed.spec.ts`: a completed match with rounds 1–10 and `current_round = 11` serves round 10's `_after`, round 10's scoreboard and summary; the same with `current_round = 6` (the 20 September row) serves round 10's; an in-progress match with `current_round = 7` and no round 7 serves round 6's `_after` and triggers recovery; a match with no rounds still bootstraps round 1 from the seed.
- `tests/integration/ui/match-completion.spec.ts`: after round 10 both clients' fields show the last board (a letter moved in round 10 is where round 10 put it) and every band spells its word.
