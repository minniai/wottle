# Phase 1 data model — Room Clarity

No table or column changes. Two new client-side unions, one store extension, one removal.

## 1. `RoundState` — derived, never stored

```ts
type RoundState =
  | { kind: "yourMove";  round: number }
  | { kind: "played";    round: number; opponentName: string }   // you played, they have not
  | { kind: "oppPlayed"; round: number }                          // they played, you have not
  | { kind: "resolving"; round: number }
  | { kind: "scored";    round: number; you: number; opp: number; next: number } // settle hold
  | { kind: "outOfTime"; round: number; opponentName: string };
```

Derived by `deriveRoundState({ match, viewerSlot, holdRound, reveal })` in `lib/room/roundState.ts`:

| Condition (first match wins) | kind |
| --- | --- |
| `holdRound === match.currentRound - 1` (or `completed` and hold running) | `scored` |
| `match.state === "resolving"` or reveal running | `resolving` |
| viewer timer `remainingMs <= 0` and not paused | `outOfTime` |
| viewer timer `paused` | `played` |
| opponent timer `paused` | `oppPlayed` |
| otherwise | `yourMove` |

It feeds three pure projections:

- `liveLinesFor(roundState, fieldLive: LiveState): LiveLines` — line 1 from the round state (`round 4 · your move`, `played · waiting for Kári`, `resolving round 4`, `round 4 scored`, `out of time · waiting for Kári`); line 2 from `fieldLive` while `yourMove`/`oppPlayed` (`pick a letter`, `picking · T (2) · tap a second letter`, `24 · hestur · tap again to play · esc cancels`, `frozen · Kári R2 · pick another`), else the state's fact (`Kári is thinking · their clock runs`, `you +12 · Kári +0 · round 5 opens in 1`).
- `barSublineFor(base, roundState, seat): string` — appends `· your move` / `· played ●` (you) or `· thinking` / `· played ●` (opp) during `yourMove`, `played`, `oppPlayed`; nothing during `resolving`, `scored`, final.
- `turnFrameFor(roundState): Seat | null` — `"you"` for `yourMove` and `oppPlayed`, else `null`.

Existing `LiveState` (`lib/room/ledgerRows.ts`) keeps its field-interaction members (`idle | picking | previewing | illegal`); `played` and `resolving` move out of it into `RoundState`.

## 2. `SlipState` — store state

```ts
type SlipState =
  | { kind: "signIn" }
  | { kind: "resign";    round: number; clockMs: number; opponentName: string }
  | { kind: "claimWin";  opponentName: string }
  | { kind: "matchOver"; verdict: Verdict; reason: EndReason; ratings: RatingLine[]; rematch: RematchPhase; readOnly: boolean };
```

Precedence (`slipPrecedence`): `matchOver` > `claimWin` > `resign` > `signIn`. `setSlip(next)` keeps the current slip if it outranks `next`; `clearSlip(kind)` clears only that kind. The store field is `slip: SlipState | null`, plus `slipDismissed: boolean` for the final phase (set by `review the field ▸`, cleared by `result ▸` and on a new `matchId`).

Store invariants:

- At most one slip. `signIn` exists only while `viewer === null`; `setViewer(player)` clears it.
- `matchOver` is set by the match controller 600ms after `reveal.settled` for the final round (or immediately on mount when `completed` and nothing to reveal); it is cleared by `slipDismissed`, never by the store's phase change.
- `claimWin` mirrors `reconnectMsLeft === 0`; clears itself when the opponent reconnects.
- `resign` is cleared by `keepPlaying`, Escape, or a `matchOver`/`claimWin` outranking it.

## 3. Round rail — derived

`railCells(currentRound, completed): RailCell[]` → ten `{ round, state: "past" | "current" | "future" }`; `completed` makes all ten `past`. Accessible name from `roundContext`.

## 4. `holdRound` — store state

`holdRound: number | null`. `beginHold(round)`, `endHold()`. Written only by `useSettleHold`; reset on `matchId` change. `SETTLE_HOLD_MS = 1200` in `lib/room/revealSequence.ts` beside `SETTLE_MS`.

## 5. Removed

- `MatchState.rated`, `MatchBootstrapInput.rated`, `isMatchRated`, the `rated` gate in `completeMatch`, `BuildRowsInput.rated`, `ratingLine(..., rated)`, `finalCaption(..., rated)`, `rankLabel`, `NO_RATING`, `HERE_NOW`'s unranked text.
- `Notice` kinds `firstMatchRules`, `resignConfirm`, `claimWin` (the last two become slips). `LedgerAction` `"rules"` → `"howToPlay"`; `+"result"`, `+"keepWaiting"`, `+"keepPlaying"`, `+"reviewField"`.
- Copy: `RULES`, `FIRST_MATCH_RULES`, `RESIGN_CONFIRM`, `claimWinLine`, `PLAYED`, `RESOLVING`, `PICK_A_LETTER` (folded into `liveLinesFor`).

## 6. Fixture literals (no new types)

Each new phase is assembled from the types above with literal values: `landing-slip` (`viewer: null`, `slip: signIn`, `landedCount: 0`), `resign` (idle match + `slip: resign`), `claim-win` (disconnect + `slip: claimWin`), `over-slip` (final + `slip: matchOver`), `settle` (`holdRound: 3`, round-4 state, round-3 words), `rules` (the page itself, no room). `Verdict`, `RatingLine`, `EndReason` already exist.
