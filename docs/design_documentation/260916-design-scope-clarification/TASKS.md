# Tasks: Field & Ledger — as rendered (spec 047)

> Repo note (2026-09-16): the executed task list is `specs/047-room-as-rendered/tasks.md`; paths there are the repo's (`/dev/room`, `room-fixtures.spec.ts-snapshots/`).

**Input**: `README.md` (this handoff), `Wottle Implementation Review.dc.html` §07, `room-match-2026-09-16.png`, `WOTTLE_DESIGN_SYSTEM.md` as amended by P1–P4.
**Prerequisites**: spec 045 merged. Test-first: every `[test]` task fails before its `[impl]` task and passes after. Files are exact; grep before renaming.

## R1 — Data integrity (S5, S4) — P0, first

- [ ] **T001 [test]** `tests/unit/lib/room/wordIntegrity.spec.ts`: `assertWordsSpellBoard(FIXTURE_BOARD, FIXTURE_WORDS)` returns `[]`; a word with 4 coordinates and a 3-letter `word` returns one message naming the round and word; a word whose letters at its coordinates differ returns a message quoting what the board spells; comparison uses `toLocaleUpperCase("is")` (`ð`→`Ð`, `æ`→`Æ`).
- [ ] **T002 [impl]** `lib/room/wordIntegrity.ts` exporting `assertWordsSpellBoard(board, words): string[]`. Call it from `components/room/MatchRoomController.tsx` in a `useEffect` on `[match.board, words]` when `process.env.NODE_ENV !== "production"`; `console.error` each message once per `matchId`.
- [ ] **T003 [test]** `tests/unit/lib/room/bandGeometry.spec.ts` (extend): for a settled round, a word with one unfrozen coordinate is not returned; a word with zero frozen coordinates is not returned and `console.warn` is called once; a word with exactly one frozen coordinate is not returned; for `roundNumber === liveRound` a word with zero frozen coordinates is returned from its coordinates (reveal, as today). No returned band has `cells.length < 2`.
- [ ] **T004 [impl]** `lib/room/bandGeometry.ts:110–130` `bandsFromWords`: implement the rule in T003. Keep `sharedCells` and `seatOfCell` unchanged.
- [ ] **T005 [investigate → test → impl]** Reproduce S5 on the seen match: for that `matchId`, compare `word_score_entries.coordinates` with `matches.board` for round 1, both players. Then, in order: (a) `lib/room/roomStore.ts` — do `words` / `frozenTiles` reset when `matchId` changes (rematch)? Add a test that a new match starts with `words = []`. (b) The round-summary loader (`app/actions/match/*RoundSummary*`, `get-round-summary` contract) — is the query scoped by `matchId` and `round_number`? Add a contract test. (c) The server writer — are coordinates recorded after the swap is applied? Add a unit test on the scorer's output. Fix the layer that fails; keep the tests.
- [ ] **T006 [test]** `tests/unit/app/dev/fixtures.spec.ts`: `assertWordsSpellBoard(FIXTURE_BOARD, FIXTURE_WORDS)` is `[]` and every coordinate of every fixture word is a key of `FIXTURE_FROZEN` — the fixture may never carry the bug it exists to catch.

## R2 — Room geometry (S1, P3)

- [ ] **T007 [test]** `tests/unit/styles/room-css.test.ts`: the ≥900px `.room__ledger` block has `align-self: start` and `height: calc(var(--field-size) + 2 * var(--bar-height) + 2 * var(--bar-gap))`; contains no `align-self: stretch` and no `min-height`; the `@media (max-width: 900px)` `.room__ledger` block has `height: auto`.
- [ ] **T008 [impl]** `app/styles/room.css:46–49` and the phone block at `:84–89`.
- [ ] **T009 [test]** `tests/integration/ui/room-layout.spec.ts`: at 1440×900 and 1280×800 on `/__room?phase=picking`, `|ledger.bottom − bottomBar.bottom| ≤ 1` and `|ledger.top − topBar.top| ≤ 1`; the ten `ledger-row-*` boxes share one height ±1px.

## R3 — Ledger (S2, S3, S6, S9, P1)

- [ ] **T010 [test]** `room-css.test.ts`: `.ledger__rows` has `display: grid` and `grid-auto-rows: minmax(0, 1fr)`, no `grid-template-columns`, no `column-gap`; `.ledger__row` has `display: grid`, `grid-template-columns: 34px 1fr 1fr`, `column-gap: 8px`, `grid-column: 1 / -1`, `border-bottom: 1px solid var(--rule)`; `.ledger__row > *` has no `border`; `.ledger__row--live` has `background: var(--tint)` and `box-shadow: inset 3px 0 0 var(--ink)`; `.ledger__round` has `padding-left: 6px`; `.ledger__header` border colour is `var(--rule)`; `.ledger__hint:empty` has `display: none`.
- [ ] **T011 [impl]** `app/styles/room.css:426–500`: rewrite per README "Row markup". Remove the nested table live row from `components/room/Ledger.tsx:64–75` — `Row` renders `ledger__round`, then a `ledger__live-text` spanning `2 / -1` with two children `ledger__live-line1` and `ledger__live-line2` (the second only when non-empty); keep `data-testid="ledger-live-row"` and `aria-live="polite"` on the row. The collapsed trigger (`ledger__live-row--trigger`) and the queue/lobby live row (`Ledger.tsx:262–266`) are unchanged.
- [ ] **T012 [test]** `tests/unit/lib/room/ledgerRows.spec.ts`: `liveText` returns `{ line1, line2 }` per the README table for `idle`, `picking`, `previewing`, `played`, `illegal`; `buildMatchLedger` returns `hint: ""` when no match-level line is given (replace the `tap a second letter` default assertion at `:62–65`).
- [ ] **T013 [impl]** `lib/constants/copy.ts`: add `PICK_A_LETTER = "pick a letter"`, `ESC_CANCELS = "esc cancels"`; `lib/room/ledgerRows.ts` `liveText` and `buildMatchLedger` per T012; `LiveState` gains `{ kind: "previewing"; total: number; word: string }` and `{ kind: "illegal"; ownerName: string; round: number }` if not already present.
- [ ] **T014 [test]** `tests/unit/components/room/MatchRoomController.spec.tsx:115–119`: after one pick the live row contains `picking · A (n)` and `tap a second letter`, and `ledger-hint` is empty; after commit the live row is `played ●` and the hint is empty. `tests/unit/components/room/Field.interaction.spec.tsx:60–79`: the preview line `24 · hestur` / `tap again to play · esc cancels` is read from the live row, not the hint.
- [ ] **T015 [impl]** `components/room/MatchRoomController.tsx` and `Field` hint plumbing: the controller passes `live` (not `hint`) for the field states; `hint` is reserved for match-level lines. `tests/integration/ui/room-flow.spec.ts:51–67` updated to read the live row.
- [ ] **T016 [test]** `tests/integration/ui/room-layout.spec.ts`: on `?phase=picking` the element `ledger-live-round` text is `R4` and its `getBoundingClientRect().left − row.left ≥ 6`; each `ledger-row-*` has a computed `border-bottom-width` of `1px` and its children `0px`.

## R4 — Field marks (S7, S8, P4)

- [ ] **T017 [test]** `tests/unit/components/room/Field.spec.tsx`: the cell at (7,6) in the fixture (LEK ∩ GILT) renders `data-state="shared"` and its `.field__value` resolves to `var(--ink)`; `room-css.test.ts`: block `.field__cell[data-state="shared"] .field__value` has `color: var(--ink)`; the scored-numeral rule for the opponent seat uses `var(--opp-text)`.
- [ ] **T018 [impl]** `app/styles/room.css` near `:338`: add the shared rule; confirm the coral numeral rule.
- [ ] **T019 [impl]** Remove the coral exclusions from `tests/integration/ui/room-layout.spec.ts:150` and `tests/integration/ui/room-fixtures.spec.ts:236`; only `.ledger__row--future .ledger__round` stays. Axe must pass on `?phase=picking`, `?phase=final`, `?phase=profile`.

## R5 — Fixtures & baselines (P2)

- [ ] **T020 [impl]** `app/dev/room/fixtures.ts` + `RoomFixture.tsx`: rename `match` → `picking`; add `idle` (no pick; live `pick a letter`), `previewed` (T at (0,9) and A at (0,3) exchanged, dotted rings, live `4 · TÖLU · tap again to play · esc cancels` — use real fixture letters and a real word), `played` (your two pins, your clock `paused`, live `played ●`), `opp-played` (opponent's pins, their clock `paused`, yours running), `low-clock` (`YOU_CLOCK_MS = 48_000`), `illegal` (shake on (2,2), live `frozen · Kári R1 · pick another`), `phone-sheet` (same as `picking`; the spec opens the sheet). Update `ROOM_PHASES`, `isRoomPhase`, `tests/unit/app/dev/*`.
- [ ] **T021 [test]** `tests/integration/ui/room-fixtures.spec.ts`: one screenshot per phase at 1440×900, 1280×800 and 390×844 (`phone-sheet` at 390×844 only, after clicking `ledger-live-trigger`); `low-clock` also under `reducedMotion: "reduce"`. Baselines committed under `tests/integration/ui/__screenshots__/`.
- [ ] **T022 [human]** Tick the README acceptance checklist against the baselines and Fig. 2; paste the ticked list and the `picking` baselines into the PR.

## R6 — Documents

- [ ] **T023** `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` (and the project copy): §4 leftover-height rule (P3); §5.1 shared numeral ink (P4) and the row-markup sentence; §5.4 "one grid row per round; the rule belongs to the row; `.ledger__round` 6px left padding"; §7 Think row: "state and instruction in the live row"; §8 add `pick a letter`, `esc cancels` placement, the state table. `CLAUDE.md`: same three sentences. `DOCS_CONSISTENCY.md` grep green.
- [ ] **T024** `specs/046-*/spec.md`, `plan.md`, `tasks.md` mirror this file; `research.md` records S5's root cause once found.

## Dependencies

- T001–T006 before anything is screenshotted.
- T010–T011 before T016; T012–T013 before T014–T015; T020 before T021–T022.
- T023–T024 last.
