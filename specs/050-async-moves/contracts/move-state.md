# Contract: the move state (room beats)

`lib/room/moveState.ts` — `deriveMoveState({ match, viewerSlot, opponentName, holdMove, revealingOwn, rejected })` → `MoveState`; `liveLinesFor(state, field)`, `barSuffixFor(state, seat)`, `turnFrameFor(state)`.

Derived, never stored. Six kinds:

| kind | line 1 (board face, 17px) | line 2 (mono, muted) | field frame | your sub-line suffix | their suffix |
| --- | --- | --- | --- | --- | --- |
| `yourMove {move}` | `move 4 · your move` | the field's instruction (`pick a letter`, `picking · T (2) · tap a second letter`, `24 · hestur · tap again to play · esc cancels`) | `--you` 3px | `move 4 of 10` (seat colour, 600) | `6 of 10 · playing` |
| `rejected {move, reason, by}` (2s) | `move 4 · your move` | `frozen · Kári just froze it · pick another` / `moved · Kári just moved it · pick another` | `--you` | `move 4 of 10` | as above |
| `scoring {move}` | `move 4 · scoring` | (empty; the row collapses to one line) | ink | `move 4 of 10 · scoring` | as above |
| `scored {move, delta, next}` (600ms hold) | `move 4 scored` | `you +13 · move 5 opens` | ink | `move 4 of 10` | as above |
| `done {oppMoves, clock}` | `10 of 10 played` | `waiting for Kári · 8 of 10 · 1:12 left` | ink | `10 of 10 · done` | `8 of 10 · playing` |
| `timeUp` | `time · scoring` | (empty) | ink | — | — |

Their suffix variants: `6 of 10 · playing` (idle or picking), `6 of 10 · scoring` (their move in flight), `10 of 10 · done`. `reconnecting · 0:42 left` replaces the suffix while they are gone.

Derivation order: `timeUp` when `deadlineAt` has passed and the match is not completed → `done` when the viewer's count is the limit → `scored` when `holdMove` is set → `scoring` when the viewer has a move in flight or `revealingOwn` → `rejected` while the two-second notice runs → `yourMove`.

## Field interaction (`lib/room/fieldInteraction.ts`)

States unchanged (`idle → picked → (preview) → committed`). Events: `tap`, `drag`, `enter`, `escape`, `tapOutside`, `priced`, `submitRejected` (HTTP 400), **`moveResolved`** (own; committed → idle, dispatched when the hold ends), **`moveRejected {reason}`** (own; committed → idle + notice), **`opponentResolved {tiles}`** (a picked or previewed letter among `tiles` → idle + `pickCleared`). Retired: `opponentPinned`, `roundAdvanced`, `FieldContext.pinned`.

`canPick = !readOnly && match.state === "in_progress" && moveState.kind === "yourMove" && !slipUp`.

## Reveal timing (`lib/room/revealSequence.ts`)

`BAND_DRAW_MS 400`, `BAND_STAGGER_MS 120`, `COUNT_UP_MS 400`, `SETTLE_MS 200`, **`MOVE_HOLD_MS 600`** (replaces `SETTLE_HOLD_MS 1200`), `MATCH_OVER_DELAY_MS 600`. The hold is a reading pause and stays under reduced motion; everything else is 0ms there.
