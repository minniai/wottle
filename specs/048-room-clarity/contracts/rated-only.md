# Contract: rated only

**Supersedes** `specs/045-field-ledger-completion/contracts/rated-flag.md` (decision 1 of 15 September 2026). Decided 20 September 2026: there is one kind of match.

## Storage

`matches.rated` is not dropped in this feature. Nothing reads or writes it; new rows take the default `true`. A later migration may drop the column.

## Creation

`MatchBootstrapInput` loses `rated`. `respondToInvite` no longer passes `rated: false`; `requestRematch` / `respondToRematch` no longer call `isMatchRated` (deleted).

## Rating

`completeMatch`: the `rated` gate is removed; every completed match with a winner (and every draw, as today) writes `match_ratings` rows and updates `players.elo_rating`. `abandoned` stays excluded as today.

## Read

`loadMatchState` no longer selects `rated`; `MatchState.rated` is removed. `getMatchRatings` unchanged.

## Copy

| Place | before | after |
| --- | --- | --- |
| match caption | `ranked · round 4 of 10` / `unranked · …` | `round 4 of 10` |
| final caption | `final · 10 rounds · 18:50` / `final · unranked · …` | `final · 10 of 10 · 18:50` |
| queue caption | `ranked · 10 rounds · 5:00 clocks` | `10 rounds · 5:00 clocks` |
| queue bar sub-line | `ranked · 0:07 · cancel ▸` | unchanged (the one place `ranked` survives with `play ranked ▸`) |
| lobby here-now | `here now · challenge for an unranked match` | `here now` |
| final rating line, no row | `unranked · no rating change` | `rating pending` |

`rankLabel`, `NO_RATING` deleted; `roundContext(round)`, `finalContext(mmss)`, `ratingLine(rows, playerId, wins)`, `finalCaption(a, b)` lose their `rated` parameter.

## Legacy rows

A row with `rated = false` (directory challenges 15–20 September 2026) renders as ranked. It has no `match_ratings` row, so its final bars read `rating pending`; no recomputation.

## Tests

- `tests/unit/lib/room/rankedCaptions.spec.ts` rewritten: captions carry no rank label; `HERE_NOW === "here now"`.
- `tests/contract/post-invite.contract.test.ts` — an invite-created match has no `rated` field in its bootstrap input.
- `tests/unit/lib/rating/**` — `completeMatch` writes ratings for an invite-created match.
- `tests/integration/ui/{match-completion,rounds-flow}.spec.ts` — the `unranked` expectations become rating-line expectations (`/\d+ → \d+ · [+−]\d+/`).
- `tests/unit/styles/acceptance-grep.test.ts` — `unranked` and `no rating change` return nothing under `components/`, `lib/`, `app/`.
