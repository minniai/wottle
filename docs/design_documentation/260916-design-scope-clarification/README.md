# Handoff: Field & Ledger — as rendered (spec 047)

> Repo note (2026-09-16): implemented as `specs/047-room-as-rendered/`. Where this handoff says `/__room` read `/dev/room`; where it says `tests/integration/ui/__screenshots__/` read `tests/integration/ui/room-fixtures.spec.ts-snapshots/`. S8 was already closed by spec 045 decision 2 (verified, no change). S9 is not a defect: the line under the seat header is `--ink` by design (Fig. 2); rules between rows are `--rule`. S5's root cause is recorded in `specs/047-room-as-rendered/research.md`.

For Claude Code. Follows spec 045 (`design_handoff_field_ledger_completion/`). Source: `Wottle Implementation Review.dc.html` §07 and `room-match-2026-09-16.png` (a live match, Bari · Lari, round 4, ~1024px). Design system: `WOTTLE_DESIGN_SYSTEM.md` as amended below. When this document and the code disagree, the code is wrong.

## What landed — do not redo

Seen in the screenshot and confirmed in source: paper field with 1px cell rules and row-relative edge exclusions (`room.css:284`); `--cell-size` from the measured field (`room.css:249`) with `useFieldSize` subtracting the room's padding and taking the 56px phone bar; letters at 55% and numerals at `max(9px, 18%)` (`room.css:270, 297`); 1.5px chevrons (`FieldBands.tsx:48`); `--opp-text #C2402A` declared (`globals.css:22`) and used for ledger words (`Ledger.tsx:44`); the `unranked · round 4 of 10` caption; the fixture route `app/dev/room` with nine phases; bars, lanes (5:00 budgets), 14% bands, crossings, shared letters in ink 700.

## What the screenshot shows — nine findings

| Id | Priority | Finding | Cause | Fix |
| --- | --- | --- | --- | --- |
| S1 | P1 | Ledger foot ~330px below the bottom bar; rows ~100px; hint 300px from the field. §4 / §5.4 say height = stack, foot flush. | `.room__ledger { align-self: stretch; min-height: … }` (`room.css:46–49`) beats the room's `align-items: start`; the ledger fills the grid row (= viewport) while the stack stops at 720 + bars. | `align-self: start; height: calc(var(--field-size) + 2 * var(--bar-height) + 2 * var(--bar-gap))`; `height: auto` inside the ≤900px block. |
| S2 | P1 | Nothing is picked, yet the hint reads `tap a second letter` and the live row is empty. The beat has no signal. | `buildMatchLedger` defaults `hint` to `tap a second letter`; `liveText({kind:"idle"})` returns "" (`lib/room/ledgerRows.ts`; `ledgerRows.spec.ts:62–65`). | Copy table below (amendment P1). |
| S3 | P2 | Live-row label reads `4`: the `R` is under the 3px rule. | `.ledger__live-row` draws the rule as `box-shadow: inset 3px 0 0`, `padding-left: 0` (`room.css:474–486`). | `.ledger__round { padding-left: 6px }` on every row — labels aligned, rule never touches them. |
| S4 | P1 | Teal ︿ over Ð (row 4, col 5) with no band beneath; MOÐ carries two chevrons. Team decision: one per run. | `bandsFromWords` (`lib/room/bandGeometry.ts:119–120`) draws a word's frozen cells, or falls back to all coordinates when none are frozen; a one-cell band on an already-tinted cell shows only its chevron. | Settled rounds draw only words whose every coordinate is frozen; a band with fewer than two cells is never drawn; `console.warn` in dev. The fallback stays only for `roundNumber === liveRound` (reveal). |
| S5 | **P0** | Bands do not spell the ledger's words: NHMÖ for `úðu` (4 tiles for 3 letters), ERG for `urg`, RIÉ for `réi`, ÉTE for `eti`. Territory `12 · 6` counts exactly R2 + R3's tiles (B owned by coral) — R1's tiles are not frozen. | R1's records belong to another board. Candidates, in order: the accumulated `words` are not cleared or scoped by `matchId` on rematch (`lib/room/roomStore.ts`, `MatchRoomController.tsx`); the round-summary loader returns entries from a prior match; coordinates written pre-swap on the server. | Invariant `assertWordsSpellBoard(board, words)` — `coordinates.length === [...word].length` and `board[y][x]` spells the word (Icelandic uppercase) — asserted in dev and in a test; then fix the writer or loader with a regression test at that layer. |
| S6 | P2 | Every row rule is three dashes. | `.ledger__row { display: contents }`; rule on each cell across `column-gap: 8px` (`room.css:426–439`). | The row is the grid item (`display: grid; grid-column: 1 / -1; grid-template-columns: 34px 1fr 1fr; column-gap: 8px; border-bottom: 1px solid var(--rule)`), cells lose their border, the live row loses its inline `gridColumn` (`Ledger.tsx:71`). |
| S7 | P2 | Shared letters' numerals take an arbitrary seat: R (row 5) coral, B (row 8) teal. | Last record wins in the seat resolution for `.field__value`. | Amendment P4: `.field__cell[data-state="shared"] .field__value { color: var(--ink) }`. |
| S8 | verify | Coral under 17px. | Ledger words already use `getSeatColors(seat).text`. | Confirm `room.css:338` is the scored-numeral rule and is `--opp-text`; delete the axe exclusions at `room-layout.spec.ts:150` and `room-fixtures.spec.ts:236` except `.ledger__row--future .ledger__round`. |
| S9 | verify | Line under `■ Lari · you / ■ Bari` reads darker than `--rule`. | `.ledger__header` border. | Rules inside an object are `--rule` (§2). |

## Amendments to the design (binding unless the team strikes one)

**P1 · The instruction travels with the state.** During a match the live row has a state line and, beneath it, an instruction line (`--font-mono` 12px, `--muted`). The hint line (`ledger-hint`) shows match-level lines only and collapses when empty (`.ledger__hint:empty { display: none }`). §7 "preview total in the hint line" moves to the live row. §8 gains `pick a letter`. The lobby and queue hints are unchanged.

| State | Live row · line 1 | Live row · line 2 |
| --- | --- | --- |
| idle · your move, nothing picked | `pick a letter` | — |
| one letter picked | `picking · T (2)` | `tap a second letter` |
| previewing (opt-in preview) | `24 · hestur` | `tap again to play · esc cancels` |
| committed | `played ●` | — |
| illegal pick (frozen / pinned) | `frozen · Kári R2 · pick another` | — |
| opponent played (broadcast) | unchanged | unchanged — their pins on the field, their clock `--muted` |

**P2 · Fixture phases for every asymmetric signal.** `ROOM_PHASES` gains `idle`, `picking` (rename of today's `match`), `previewed`, `played`, `opp-played`, `low-clock` (0:48 left: 8px lane blinking; reduced-motion variant holds solid), `illegal` (shake + live row line) and `phone-sheet` (390×844, sheet open). Every value a literal (`fixtures.ts` header rule).

**P3 · Leftover height.** When the 720px cap binds, the room top-aligns at its 24px padding (already `align-items: start`, `padding: 24px`) and the ledger keeps the stack's height. It is never stretched. §4.

**P4 · Shared letters are ink throughout.** Letter 700 and numeral both `--ink`. §5.1.

## Steps

| Step | Scope | Findings | Acceptance |
| --- | --- | --- | --- |
| R1 Data integrity | Word/board invariant, rematch/loader scoping, degenerate-band guard | S5, S4 | Invariant test green on fixtures and on the seen match's data; `bandsFromWords` never returns a band under two cells or on unfrozen tiles for a settled round |
| R2 Room geometry | Ledger height bound to the stack | S1, P3 | Playwright: ledger bottom = bottom bar bottom ±1px and ledger top = top bar top ±1px at 1440×900 and 1280×800 |
| R3 Ledger | Row as grid item, label offset, copy table, hint collapse | S2, S3, S6, S9, P1 | `R4` fully visible; one continuous rule per row; `idle` shows `pick a letter`; `picking` shows two lines; hint empty and hidden during a match |
| R4 Field marks | Shared numeral ink; coral numeral token; axe exclusions removed | S7, S8, P4 | `Field.spec.tsx` asserts ink on shared numerals; axe passes on `?phase=picking` with only the future-label exclusion |
| R5 Fixtures & baselines | New phases; screenshots at 1440×900, 1280×800, 390×844; human check against Fig. 2 | P2 | Baselines committed under `tests/integration/ui/__screenshots__/`; the checklist below ticked in the PR |
| R6 Documents | DS §4, §5.1, §5.4, §7, §8; CLAUDE.md; repo copies of the design bundle | — | `DOCS_CONSISTENCY` grep green; `tokens.test.ts` unchanged (eight colours) |

Order: R1 first (a data bug makes every screenshot a lie), then R2–R4 in any order, R5 last with R6 alongside. Tasks: `TASKS.md`.

## Carry-over from spec 045 to confirm, not redo

- `LedgerSheet` in flow: `.ledger-sheet` (`room.css:663`) has no `position: fixed|absolute`, no `z-index`; the negative assertion exists in `LedgerSheet.spec.tsx` and `room-css.test.ts`.
- Decision 1: `matches.rated`, invites create `false`, lobby copy `challenge for an unranked match`. The caption is right; check the lobby.
- Decision 3: `data-cell-size="small"` hides the numeral below 32px cells and the `aria-label` keeps `value n` — check at 390×844.
- Playwright and reference screenshots were never run before spec 045; R5 here is where they first run. Do not close spec 046 without them.

## Binding specs

**Ledger height (≥900px).** `.room__ledger { align-self: start; height: calc(var(--field-size) + 2 * var(--bar-height) + 2 * var(--bar-gap)); }`. Below 900px the phone block sets `height: auto` and keeps `display: flex; flex-direction: column; min-height: 0`.

**Row markup.** One grid item per round: `.ledger__row { display: grid; grid-template-columns: 34px 1fr 1fr; column-gap: 8px; grid-column: 1 / -1; border-bottom: 1px solid var(--rule); }`; `.ledger__rows { display: grid; grid-auto-rows: minmax(0, 1fr); }` with no columns or gap of its own. The live row is `.ledger__row--live` with `background: var(--tint); box-shadow: inset 3px 0 0 var(--ink)`; no nested `.ledger__live-row` inside the table. `.ledger__round { padding-left: 6px }`.

**Live-row copy.** The table under P1. `liveText` returns `{ line1, line2 }`; `line2` renders only when non-empty. `buildMatchLedger` no longer defaults `hint`; a match ledger's `hint` is `""` unless a match-level line is set.

**Word invariant.** `lib/room/wordIntegrity.ts`: `assertWordsSpellBoard(board: string[][], words: AccumulatedWord[]): string[]` returns one message per violation (`R1 úðu: expected 3 coordinates, got 4`; `R1 urg: board spells ERG at (4,4)…(6,4)`); `MatchRoomController` calls it in `process.env.NODE_ENV !== "production"` and `console.error`s each message once per match. Letters compare with `toLocaleUpperCase("is")`.

**Band rule.** `bandsFromWords`: for `roundNumber !== liveRound`, use only coordinates present in `frozenTiles`; if any coordinate is missing, skip the word and `console.warn` in dev; never return a band with `cells.length < 2`. For `roundNumber === liveRound` the coordinates are used as today.

**Shared numeral.** `.field__cell[data-state="shared"] .field__value { color: var(--ink); }` — weight stays 400.

## Acceptance checklist (human, on the baselines)

1. Ledger top rule aligns with the top bar's top; ledger foot aligns with the bottom bar's bottom (1440×900, 1280×800).
2. Every ledger row is one continuous `--rule` line; the live row's label is fully visible.
3. `idle`: live row `pick a letter`, hint hidden. `picking`: `picking · T (2)` over `tap a second letter`. `played`: `played ●`, your clock `--muted`, your lane stopped.
4. Every band spells its word in the chevron's direction; one chevron per band; no chevron without a band.
5. Shared letters: letter and numeral in ink. Coral numerals on scored letters `#C2402A`; coral letters, lanes, totals, squares `#E4573D`.
6. `low-clock`: 8px lane blinking at 1Hz, colour only; steady under reduced motion.
7. 390×844: field cells ≥ 35px, numerals hidden below 32px cells, sheet opens in flow, nothing over the field.
