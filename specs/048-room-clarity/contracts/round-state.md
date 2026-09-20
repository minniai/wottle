# Contract: round state → signals

`lib/room/roundState.ts`. Pure; every input is already on the client.

## Input

```ts
deriveRoundState({ match: MatchState, viewerSlot: PlayerSlot, holdRound: number | null, revealing: boolean }): RoundState
```

## Output → homes

| RoundState | live row line 1 (board 17px) | live row line 2 (mono 12) | field frame | your sub-line suffix | their sub-line suffix |
| --- | --- | --- | --- | --- | --- |
| `yourMove` | `round 4 · your move` | field instruction (`pick a letter`, `picking · T (2) · tap a second letter`, …) | 3px `--you` | `· your move` (in `--you`) | `· thinking` |
| `oppPlayed` | `round 4 · your move` | field instruction | 3px `--you` | `· your move` | `· played ●` |
| `played` | `played · waiting for Kári` | `Kári is thinking · their clock runs` | ink | `· played ●` | `· thinking` |
| `resolving` | `resolving round 4` | `both played · scoring` | ink | — | — |
| `scored` (hold) | `round 4 scored` | `you +12 · Kári +0 · round 5 opens in 1` | ink | — | — |
| `outOfTime` | `out of time · waiting for Kári` | `your clock is spent · rounds pass` | ink | `· 0:00` | `· thinking` |

The `illegal` field state (`frozen · Kári R2 · pick another`) still replaces line 2 for two seconds during `yourMove`/`oppPlayed`.

## Settle hold

- `useSettleHold({ round, settled })` → `beginHold(round)` when `settled` flips true for a reveal that drew ≥1 band or changed a total; `endHold()` after `SETTLE_HOLD_MS = 1200`.
- While held: the previous round's row has `status: "settled"` (tint + 3px ink rule, like live), the current round's row is `future`, `Field` is `disabled`, the caption already reads `round 5 of 10`, the rail already marks 5 as current (the rail and caption are facts about the match; the row is the beat).
- On the final round the hold runs, then `MATCH_OVER_DELAY_MS` runs from the hold's end (total 1.8s after settle).
- `performance.mark("room:settle-hold:start" | ":end")`.

## Rail

`railCells(currentRound, completed)`; `RoundRail` renders `role="img" aria-label={roundContext(...)}`; cells 26px tall, `1fr` each, states `past | current | future` as `data-state`; no motion.

## Announcements

The live row's existing `aria-live="polite"` region announces line 1 on every change of `RoundState.kind` and of `round`. Line 2 changes do not announce (they follow the player's own actions).

## Tests

- `tests/unit/lib/room/roundState.spec.ts` — the six derivations, precedence order, `liveLinesFor`, `barSublineFor`, `turnFrameFor`.
- `tests/unit/components/room/hooks/useSettleHold.spec.tsx` — begins on settle, ends at 1200ms (fake timers), no hold for a settle-only reveal, resets on matchId.
- `tests/unit/components/room/RoundRail.spec.tsx` — ten cells, states, accessible name, all past when completed.
- `tests/unit/styles/room.css` assertions — `.field[data-turn="you"]` outline, `.ledger__live-line1` 17px board face.
- `tests/integration/ui/rounds-flow.spec.ts` — the sequence `your move → played → resolving → scored → your move` observed on both clients over two rounds.
