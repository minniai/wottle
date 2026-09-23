# Tasks: The scoreboard, one grid, the new colours and the capitalised brand

**Input**: Design documents from `specs/068-match-scoreboard/`: plan.md, spec.md, eng-review.md (binding), research.md, data-model.md, contracts/, quickstart.md
**Tests**: Required. The constitution mandates TDD (VII), and eng-review.md lists the tests. Every test task is written first and must fail before its implementation task.

**Format:** `[ID] [P?] [Story] Description`. `[P]` means different files and no dependency on an unfinished task.

**Delivery phases (eng-review S0).** Phase A is US1–US6 plus US9's first half, and ships green on its own: a new baseline, migrated E2E specs, and `docs:check`. Phase B is US7, US8 and the rest of US9.

---

## Phase 1: Setup

- [X] T001 Confirm the baseline: run `pnpm test:unit`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:check` and `pnpm test:visual` on `068-match-scoreboard` and record the pass counts in `specs/068-match-scoreboard/tasks.md` (Notes)
- [ ] T002 [P] Add the copy keys this feature needs to the `Copy` type, with placeholders in both languages (`SCOREBOARD`, `MATCH_CLOCK_LABEL`, `pace`, `LAST_SECONDS`, `TIME_LABEL`, `matchOverClock`, `READY`, `BEHIND_PACE`, `goneFor`, `OFFLINE_RECONNECTING`, `moveNoWord`, `missedLine`, `missedFloorLine`, `stakesLine`, `NOTHING_TO_LOSE`, `frozenWord`, `backAway`, `endEarlyOffer`, `lastMoveOf`, `oppAnnouncement`, `tabTitle`, `NO_WORD`, `NOT_PLAYED`, `IF_UNPLAYED`) in `lib/i18n/copy/types.ts`, `lib/i18n/copy/en.ts` and `lib/i18n/copy/is.ts`, with the strings from spec FR-004/005/028–038 and `contracts/live-line2.md`

---

## Phase 2: Foundational (blocks every story)

- [X] T003 [P] Write failing tests in `tests/unit/lib/room/segments.spec.ts`: `segmentStates(movesPlayed, limit, inFlight)` returns 10 entries (left first, spent after, the in-flight one as `scoring`), matching the current BarLane behaviour
- [X] T004 Move `segmentStates` from `components/room/BarLane.tsx` to the new `lib/room/segments.ts`, and import it back into `BarLane.tsx` (the lobby and queue still use `BarLane`)
- [X] T005 [P] Write failing tests in `tests/unit/components/room/hooks/useFieldSize.spec.ts`, following `contracts/field-size.md`:
  - scoreboard 1440×900 (ledger 340, gutter 56) → `{cell:71, field:713}`;
  - 1280×800 → whole cell, and `field = cell×10+3`;
  - scoreboard 1000×800 (ledger 260, gutter 40) is width-bound;
  - bars 1000×800 is width-bound (the 901–1100 overflow fix);
  - phone 390×844 → `field = 358`, fractional `cell`;
  - never negative.
- [X] T006 Implement `computeFieldSize(width, height, { layout, paddingX, ledgerWidth, gutter, scoreboardHeight })` returning `{ cell, field }`, and update `useFieldSize` to take the layout and read the ledger width and gutter from computed style, in `components/room/hooks/useFieldSize.ts`
- [X] T007 Add a `layout: "bars" | "scoreboard"` prop to `Room`: pass it to `useFieldSize`, set `data-layout`, and set `--cell-size` from `cell` (not `field/10`) and `--field-size` from `field`, in `components/room/Room.tsx`. Update `tests/unit/components/room/Room.spec.tsx` for both layouts.
- [X] T008 [P] Write failing tests in `tests/unit/lib/room/clock.spec.ts`:
  - `ticksLeft(ms) = ceil(ms/5000)`, with 192000 → 39;
  - `blocks(39)` → `[6,6,6,6,6,6,3,0,0,0]`;
  - `clockRowPhase` for each of `starting | running | underMinute | lastSeconds | time | over`;
  - `pace(192000, 7)` → 27 and `pace(800, 3)` → `<1`;
  - `behindPace(3, 48000)` true, `behindPace(7, 192000)` false, `behindPace(0, …)` false.
- [X] T009 Implement `ticksLeft`, `blocks`, `clockRowPhase`, `pace`, `behindPace` and `LAST_SECONDS_MS`; remove `FLASH_CLOCK_MS` and the `flash` phase; keep `formatClock` and `remainingFromDeadline`. All in `lib/room/clock.ts`.
- [X] T010 [P] Add `serverCorrectedNow(serverNow, localNowAtSnapshot, now)` to `lib/room/clock.ts`, test it in `tests/unit/lib/room/clock.spec.ts`, and use it for `reconnectMsLeft` in `components/room/MatchRoomController.tsx` (research R9)

**Checkpoint:** the foundation is ready. No visible change yet.

---

## Phase 3: User Story 1: read time, moves and score in one place (P1) 🎯 MVP

**Goal:** one scoreboard above the field in the match states, with no player bars.
**Independent test:** `/en/dev/room?phase=idle` at 1440×900 shows exactly three rows (clock, Kári, Birna), with no `player-bar-*` in the match.

- [X] T011 [P] [US1] Write failing tests in `tests/unit/lib/room/scoreboard.spec.ts` for `deriveScoreboard`:
  - clock label, pace or `match clock`, numeral and blocks for the `idle` fixture values;
  - every sub-line suffix in `data-model.md`'s table (playing, scoring, done, reconnecting, gone for, ready, final and `rating pending`);
  - `suffixTone`;
  - segments;
  - read-only drops `· you` and `· opponent`.
- [X] T012 [US1] Implement `deriveScoreboard(input, copy)` in the new `lib/room/scoreboard.ts` (contract `contracts/scoreboard.md`), absorbing `subline()` from `components/room/MatchRoomView.tsx` and `barSuffixFor` / `barToneFor` from `lib/room/moveState.ts`. Delete the originals and move their tests from `tests/unit/lib/room/moveState.spec.ts` into `scoreboard.spec.ts`.
- [X] T013 [P] [US1] Write failing tests in `tests/unit/components/room/Scoreboard.spec.tsx`:
  - three rows in the order clock, opp, you;
  - the testids from research R13;
  - `role="timer"` on the clock row, which is not live;
  - the clock track is `aria-hidden`;
  - each player track is a `progressbar` with `aria-valuetext` "7 of 10 moves left";
  - totals in the value column;
  - names link to profiles and open in a new tab while live;
  - the phone variant renders no tick marks.
- [X] T014 [US1] Implement `components/room/Scoreboard.tsx`, which renders a `ScoreboardView`. Its seat colours come from `getSeatColors`.
- [X] T015 [US1] Add the `.scoreboard` styles to `app/styles/room.css`:
  - desktop: rows 40px, columns 216 · 1fr · 64, gap 16, padding 14, 1.5px `--ink` frame;
  - clock track: 10 blocks of 6 ticks on the move lanes' 10-column grid with 3px gaps;
  - segments reuse the lane segment styles (spent, scoring at 30%, outlined);
  - phone (≤900px): rows 34px, columns 112 · 1fr · 36, gap 10, padding 8, blocks filled with no tick marks.
- [X] T016 [US1] Swap the bars for the scoreboard in `components/room/MatchRoomView.tsx`: `Room layout="scoreboard"`, `topBar={<Scoreboard …/>}` (count-up totals kept) and no `bottomBar`. Drop the `PlayerBar` import. Pass the clock inputs from `components/room/MatchRoomController.tsx`: `remainingMs`, `msToStart`, and `elapsedMs` for the over state.
- [X] T017 [US1] **CRITICAL regression, in the same commit as T016.** Migrate the match selectors from `player-bar-top|bottom`, `player-bar-subline`, `player-bar-score` and `player-bar-turn` to `scoreboard-row-opp|you`, `scoreboard-subline`, `scoreboard-total` and `scoreboard-turn` in:
  - `tests/integration/ui/moves-flow.spec.ts`
  - `tests/integration/ui/disconnect-claim.spec.ts`
  - `tests/integration/ui/match-completion.spec.ts`
  - `tests/integration/ui/reconnect-flow.spec.ts`
  - `tests/integration/ui/room-layout.spec.ts`
  - `tests/integration/ui/room-flow.spec.ts`
  - `tests/integration/ui/sensoryFeedback.spec.ts`
  - `tests/integration/ui/locale-is.spec.ts`
  - `tests/integration/ui/ledger-scroll.spec.ts`
  - `tests/integration/ui/helpers/swaps.ts`
  - `tests/integration/ui/helpers/matchmaking.ts`

  Also migrate the match-state unit tests `tests/unit/components/room/MatchRoomController.spec.tsx` and `MatchRoomView` tests. Leave the lobby and queue selectors (`landing`, `lobby-logout`, `identity`, `matchmaking` lobby steps, `cross-language-queue`) unchanged.
- [X] T018 [US1] Render the `starting` state: the clock row fills left to right over the 3·2·1 (end state under reduced motion), both rows read `ready`. Implement in `lib/room/scoreboard.ts` and `components/room/Scoreboard.tsx`, with a test in `tests/unit/lib/room/scoreboard.spec.ts`.
- [X] T019 [US1] Render the match-over state: the clock holds `match over · 4:52 of 5:00` with numeral `0:08`, and the rows carry the rating lines or `rating pending`. Wire the final `finalLine` from `components/room/MatchRoomController.tsx`, with a test in `tests/unit/lib/room/scoreboard.spec.ts`.

**Checkpoint:** US1 works. The match specs pass on the scoreboard (run `moves-flow` locally on `playtest-firefox --workers=1`).

---

## Phase 4: User Story 2: urgency without blinking (P1)

**Goal:** weight-only urgency and `behind pace` in words.
**Independent test:** `low-clock` and `last-seconds` show the tinted row, ink ticks and a heavy numeral; in 3 seconds only the numeral and ticks change.

- [X] T020 [P] [US2] Add failing tests to `tests/unit/lib/room/scoreboard.spec.ts`:
  - phases → `data-phase` and the label (`last 12s`, `time`);
  - `behind pace` suffix in the seat tone for 3 moves at 0:48;
  - none for 7 moves at 3:12;
  - none with 10 played;
  - a case table (SC-007).
- [X] T021 [US2] Implement the phase styles in `app/styles/room.css`:
  - `running`: `--paper`, `--muted` ticks, numeral 500;
  - `underMinute` and `lastSeconds`: `--tint`, `--ink` ticks, numeral 700;
  - `lastSeconds` label: `--ink` 600;
  - `time`: empty track.

  Delete `@keyframes clock-flash` and every `[data-phase="flash"]` rule.
- [X] T022 [US2] Implement the `behindPace` suffix in `lib/room/scoreboard.ts`, which replaces `move N of 10` with `move N · behind pace`.
- [X] T023 [US2] Add a no-blink fixture test to `tests/integration/ui/room-fixtures.spec.ts`: on `last-seconds`, take two screenshots 1s apart with the clock frozen by the fixture and assert pixel identity outside the numeral and track boxes (SC-002). Also assert that `room.css` holds no `clock-flash` or `animation` on `.scoreboard`, in `tests/unit/styles/room-css.test.ts`.
- [X] T024 [US2] Assert that time still steps under reduced motion: the numeral and ticks update each second with `prefers-reduced-motion`, in `tests/unit/components/room/Scoreboard.spec.tsx`.

---

## Phase 5: User Story 3: the board and the ledger on one grid (P1)

**Goal:** the ledger's rows are level with the scoreboard's rows and with the board's rows.
**Independent test:** at 1440×900 and 1280×800, every ledger edge is within 1px of its left-column edge.

- [X] T025 [P] [US3] Write failing tests in `tests/unit/components/room/Ledger.grid.spec.tsx`: the match ledger renders no `LedgerClock`; its first three rows are `ledger-caption` (wordmark, context, `⋯`), `ledger-state-line` (territory or the state's line) and `ledger-header`; there are ten move rows.
- [X] T026 [US3] Remove `LedgerClock` and the clock fields (`clock`, `clockPhase`, `clockFraction`) from `components/room/Ledger.tsx` and `lib/room/ledgerRows.ts` (plus `tests/unit/components/room/Ledger.rail.spec.tsx` and `ledgerRows.spec.ts`). Move `⋯` (`RoomMenu`) into the caption row on desktop in the match states, and drop the desktop foot there.
- [X] T027 [US3] Grid the ledger in `app/styles/room.css` for `.room[data-layout="scoreboard"]`:
  - caption, state line and header are each `--sb-row` (40px);
  - the header's 1.5px `--ink` rule is level with the box's bottom border;
  - a 12px gap;
  - each `.ledger__row` is `height: var(--cell-size)` with its rule on the cell boundary;
  - `.room__ledger` height = scoreboard + 12 + field.
- [X] T028 [US3] Add a grid-alignment fixture test to `tests/integration/ui/room-fixtures.spec.ts`: at 1440×900 and 1280×800, measure the `boundingBox` of the scoreboard rows against the ledger's first three rows, and the field row boundaries against the ledger move rows, and assert |Δ| ≤ 1px (SC-001). Also assert that at 1000×800 the room has no horizontal overflow.
- [X] T029 [US3] Place the live row on the viewer's next open move row (unchanged behaviour) and check that row-level folding (`useMeasuredLines`) still fits one cell in `components/room/Ledger.tsx`. Update `tests/unit/components/room/Ledger.rows.spec.tsx`.

---

## Phase 6: User Story 4: the phone match (P1)

**Goal:** the scoreboard, then the field, then the ledger block, then the pinned foot, with nothing scrolling.
**Independent test:** `phone-match`, `phone-match-664` and `phone-match-360` show no scroll and a visible foot.

- [X] T030 [P] [US4] Write failing tests in `tests/unit/components/room/Scoreboard.spec.tsx` and `tests/unit/lib/room/scoreboard.spec.ts`: the phone short sub-lines (`6 of 10`, `move 4`), with the square and name kept.
- [X] T031 [US4] Implement the phone short forms in `lib/room/scoreboard.ts` (a `compact` flag from `useIsPhone`).
- [X] T032 [US4] Lay out the phone match in `app/styles/room.css` (≤900px, `data-layout="scoreboard"`):
  - the scoreboard at the field's width above the field;
  - the ledger block holds the live row (with `history ▸`), then territory;
  - territory hides first as the height shrinks (a height media query or a measured class);
  - the foot is pinned (`position: sticky/fixed; bottom:0; padding-bottom: env(safe-area-inset-bottom)`), holding `⋯` at 44×44 and the language label.

  Remove the phone clock block and strip.
- [X] T033 [US4] Keep the sheet between the field and the foot, never over the scoreboard or the foot, and return focus to the live row on Esc, in `components/room/LedgerSheet.tsx` and `app/styles/room.css`. Update `tests/unit/components/room/LedgerSheet.spec.tsx`.
- [X] T034 [US4] Add the fixture phases `phone-match`, `phone-match-664` and `phone-match-360` to `app/[locale]/dev/room/fixtures.ts` (`ROOM_PHASES`) and `RoomFixture.tsx`, with viewports in `tests/integration/ui/room-fixtures.spec.ts` asserting no scroll (`scrollHeight <= clientHeight`) and a visible foot (SC-005).

---

## Phase 7: User Story 5: terracotta, and red only for points lost (P1)

**Goal:** new opponent colours and `--err` behind one helper.
**Independent test:** sampled colours in `idle`, `low-clock` and `final` match; every `−5` number is crimson with its label muted.

- [X] T035 [P] [US5] Write failing tests in `tests/unit/styles/tokens.test.ts`: `--opp #B56A4F`, `--opp-text #A1583D`, `--err #AD1F3D`, nine tokens in total. Update `tests/unit/styles/tailwind-config.test.ts` for the `err` token.
- [X] T036 [US5] Change `--opp` and `--opp-text`, add `--err`, and rewrite the coral comments as terracotta in `app/globals.css`. Add `err: "var(--err)"` to `tailwind.config.ts`. <!-- retired-name -->
- [X] T037 [P] [US5] Write failing tests in `tests/unit/components/room/PointsLost.spec.tsx` for `renderPointsLost(value, label, order)`: a negative value renders the number in a `.points-lost` span with the label muted; `0` renders muted with no `.points-lost`; both orders work (`no word −5`, `−5 not played`, `−15 if unplayed`).
- [X] T038 [US5] Implement `components/room/PointsLost.tsx` (`renderPointsLost`) and add `.points-lost { color: var(--err) }` to `app/styles/room.css` as the only `--err` rule.
- [X] T039 [US5] Render every ledger penalty cell (`no word −5`, `−5 not played`, floored values) through `renderPointsLost` in `components/room/Ledger.tsx` and `lib/room/ledgerRows.ts` (both seats' columns). Update `tests/unit/components/room/Ledger.rows.spec.tsx`.
- [X] T040 [P] [US5] Write the guard `tests/unit/styles/err-token-grep.test.ts`: `var(--err)` appears only in the `.points-lost` rule, `points-lost` only in `PointsLost.tsx` and room.css, and `renderPointsLost` never takes a rating value (a grep for rating-line builders) (FR-022).
- [X] T041 [US5] Confirm that rating lines stay ink and the clock never uses `--err`, with assertions in `tests/unit/lib/room/scoreboard.spec.ts` (the final rating line has no points-lost markup).

---

## Phase 8: User Story 6: the capitalised brand (P2)

**Goal:** Orðusta and Wottle everywhere, from one source.
**Independent test:** the tab title reads `3:12 · move 4 · Wottle`, the ledger wordmark reads `Wottle`, and the grep test passes.

- [X] T042 [P] [US6] Write the failing guard `tests/unit/styles/brand-casing-grep.test.ts`: there is no `"wottle"` or `"orðusta"` string literal used as displayed text in `lib/i18n/copy/`, `lib/i18n/locales.ts`, `app/[locale]/**/layout.tsx`, `app/[locale]/**/page.tsx` metadata or `components/rules/content/`. Identifiers, paths, cookie names (`wottle-*`) and URLs are exempt by pattern (FR-026).
- [X] T043 [US6] Set `wordmark: "Orðusta"` / `"Wottle"` in `lib/i18n/locales.ts`, make `WORDMARK` in `lib/i18n/copy/en.ts` and `is.ts` read `getLocale(id).wordmark`, and fix every prose occurrence (the `rulesMetaTitle` users, `SITE_DESCRIPTION`, `components/rules/content/{en,is}.tsx`). Update `tests/unit/lib/i18n/locales.spec.ts` and `copyEn.spec.ts`.
- [X] T044 [P] [US6] Write failing tests in `tests/unit/lib/room/tabTitle.spec.ts`: `tabTitle({clockMs:192000, move:4, live:true}, copy)` → `3:12 · move 4 · Wottle` (and IS `3:12 · leikur 4 · Orðusta`); outside a live match → the wordmark alone.
- [X] T045 [US6] Implement `lib/room/tabTitle.ts`, and set `document.title` once a second from `components/room/MatchRoomController.tsx`, restoring the wordmark on unmount.

---

## Phase 9: User Story 9 (Phase A part): documents, fixtures, baselines

- [X] T046 [US9] Update `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md`:
  - §2: nine tokens, terracotta and `--err` with its only use;
  - §3: the display tier and the capitalised wordmark;
  - §5.3: the scoreboard replaces the bars in the match states (the lobby and queue keep them);
  - §5.4: no ledger clock, and the ledger grid; <!-- retired-name -->
  - §6: time is not motion, and nothing blinks;
  - §9: `role=timer` and the lane value text.
- [X] T047 [US9] Update the Design section of `CLAUDE.md`: the scoreboard, one grid, nine tokens, `--err`'s only use, terracotta, the capitalised wordmark, and the fixture phase list. Remove the bar-lane, ledger-clock, inverted-flash, coral, eight-token and lowercase-wordmark sentences. <!-- retired-name -->
- [X] T048 [US9] Add the retired phrases to `scripts/docs/consistency-grep.sh`: `ledger clock` (as the current design), `inverted face`, `eight colour tokens`, `lowercase wordmark`, `coral`. Run `pnpm docs:check`. <!-- retired-name -->
- [X] T049 [US9] Update `docs/prd_and_requirements/wottle_game_rules.md` §12 rows for the clock (the scoreboard, weight only) and for scoring (a crimson penalty number).
- [X] T050 [US9] Re-baseline the visual suite on darwin (`pnpm test:visual --update-snapshots`) for every phase. Delete orphaned baselines. Record in the Notes that the Linux baselines come from the CI artifact.
- [ ] T051 [US9] **Phase A gate:** run `pnpm test:unit`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:check`, `pnpm test:visual`, and the chromium E2E room specs, plus `moves-flow` and `disconnect-claim` on `playtest-firefox --workers=1`. All must be green before Phase B.

**Checkpoint:** Phase A is shippable.

---

## Phase 10: User Story 7: the match room reads the whole move (P2)

**Goal:** the tick, the missed beat, stakes, the illegal word, pick cleared, line 2 precedence, announcements and focus at go.
**Independent test:** the fixtures `missed`, `stakes`, `pick-cleared` and `last-moved` show their strings and ticks.

- [X] T052 [P] [US7] Write failing tests in `tests/unit/lib/room/lastMoves.spec.ts` (contract `contracts/last-moves.md`):
  - two cells per seat from the resolved swap;
  - frozen cells are dropped;
  - `latestResolved` keeps the previous move when the next is rejected;
  - a snapshot `lastResolution` that is rejected gives no cells (review 1A).
- [X] T053 [US7] Implement `lib/room/lastMoves.ts`, and keep `latestResolved` per seat in `lib/room/roomStore.ts` (fed by `applyResolution`, and by `applySnapshot` only for `status === "resolved"`). Test the store in `tests/unit/lib/room/roomStore.spec.ts`.
- [X] T054 [P] [US7] Write failing tests in `tests/unit/components/room/FieldCell.tick.spec.tsx`: a ticked cell renders `.field-cell__tick` in its seat colour on the bottom inner edge, above any band; its aria-label ends with `Kári's last move` / `síðasti leikur · Kári`.
- [X] T055 [US7] Draw the tick in `components/room/FieldCell.tsx` and `components/room/Field.tsx` (a `lastMoves` prop from `MatchRoomController`), with its CSS in `app/styles/room.css`.
- [X] T056 [P] [US7] Write failing tests in `tests/unit/lib/room/liveLine2.spec.ts` (contract `contracts/live-line2.md`): the `LINE2_ORDER` precedence for every adjacent pair, and a held lower source returning after the higher one clears.
- [X] T057 [US7] Implement `lib/room/liveLine2.ts` (`selectLine2`, `LINE2_ORDER`) and route live row line 2 through it in `lib/room/moveState.ts` (`liveLinesFor`) and `components/room/Ledger.tsx`. Line 2 numbers of points lost use `renderPointsLost`.
- [X] T058 [P] [US7] Write failing tests in `tests/unit/lib/room/moveState.spec.ts`:
  - the missed beat: a resolution with no words → `move 4 · no word`, and line 2 is `−5 · move 5 opens`;
  - a floored delta of −3 → `−3 · a total never falls below 0`;
  - the illegal pick names the word: `frozen · GILT · Kári · pick another`.
- [X] T059 [US7] Implement the missed beat (a `missed` kind in `MoveState`, or `scored` with no words) in `lib/room/moveState.ts`, and the illegal word (`LiveState.illegal.word`) in `lib/room/liveLines.ts` and `lib/room/fieldInteraction.ts`. The word is looked up by cell from the accumulated words in `components/room/hooks/useFieldInteraction.ts`.
- [X] T060 [P] [US7] Write failing tests in `tests/unit/lib/room/stakes.spec.ts`: under 1:00, with the move yours and nothing picked → `3 moves left · −15 if unplayed` from `timeoutPenalty(total, 3)`; with a total of 0 → `3 moves left · nothing to lose`; not shown above 1:00 or while a letter is picked.
- [X] T061 [US7] Implement `lib/room/stakes.ts` and feed it as the `missedOrStakes` source.
- [X] T062 [US7] Move pick cleared from a ledger notice to the line 2 `pickCleared` source, held for 2s, flashing the opponent's tick once on that cell (held under reduced motion). Retire `pickClearedNotice` from the match in `lib/room/notices.ts`, and update `components/room/MatchRoomController.tsx`, `components/room/Field.tsx`, `tests/unit/lib/room/notices.spec.ts` and `tests/unit/components/room/useNotices.spec.tsx`.
- [X] T063 [P] [US7] Write failing tests in `tests/unit/components/room/hooks/useOpponentAnnouncements.spec.tsx`:
  - a live `move-resolved` opponent move → one polite line `Kári SKÓ +11 · 5 of 10`, after the viewer's own reveal is idle;
  - the same `globalSeq` twice → announced once;
  - a snapshot or catch-up poll → nothing;
  - two moves within 1.5s → only the newest;
  - the 1:00 and 0:15 marks are each announced once, and never after a reload past them.
- [X] T064 [US7] Implement `components/room/hooks/useOpponentAnnouncements.ts` with its polite region in `components/room/MatchRoomView.tsx`.
- [X] T065 [US7] Focus at go: when `starting` ends, move focus to the field and announce line 1, in `components/room/MatchRoomController.tsx`. Test it in `tests/unit/components/room/MatchRoomController.spec.tsx`.
- [X] T066 [US7] Add the line 2 fit test in `tests/integration/ui/room-fixtures.spec.ts`: render the longest line 2 string of each source in both languages at 1440 in the 340px ledger and assert a single line (SC-006). Shorten any string that wraps in `lib/i18n/copy/{en,is}.ts` and note it for design system §8.
- [X] T067 [US7] Add the fixture phases `missed`, `stakes`, `pick-cleared` and `last-moved` (EN-M values where the canvas draws them) to `app/[locale]/dev/room/fixtures.ts` and `RoomFixture.tsx`.

---

## Phase 11: User Story 8: resign, disconnect and end early (P2)

**Goal:** the C6 and C8 states in scoreboard terms, with your own outage handled in place.
**Independent test:** the `resign`, `disconnect`, `gone`, `end-early` and `offline` fixtures match the ResignSlip and Disconnect artboards.

- [ ] T068 [P] [US8] Write failing tests in `tests/unit/components/room/Slip.decisions.spec.tsx`:
  - resign: label `move 4 of 10 · 3:12 left`, headline `Resign the match?`, body with no number, `keep playing ▸` focused, `yes, resign ▸` on the second line, Esc keeps playing;
  - end early: label `10 of 10 played · 1:12 on the clock`, headline focused, `end the match ▸` ignoring activation for 500ms, `keep waiting ▸`.
- [ ] T069 [US8] Update the resign and end-early slips in `components/room/Slip.tsx` and their copy in `lib/i18n/copy/{en,is}.ts`. The phone slips fill exactly the field's square, following F8's rows in `app/styles/room.css`.
- [X] T070 [US8] Remove the 10s end-early re-raise (`endDeferred` timer) in `components/room/MatchRoomController.tsx`. `keep waiting` sets a per-match flag, the slip is never raised again, and the offer becomes the `endEarlyOffer` line 2 source (`Kári is gone · end the match ▸`, a secondary action). Update `tests/unit/components/room/MatchRoomController.spec.tsx`.
- [ ] T071 [P] [US8] Add failing tests to `tests/unit/lib/room/scoreboard.spec.ts`: the opp `gone for 2:04` counts up from the server-corrected `disconnectedAt` and never reads `0:00 left`; the lane is outlined while reconnecting or gone; you at `10 of 10 · done`.
- [ ] T072 [US8] Compute `goneForMs` with `serverCorrectedNow` in `components/room/MatchRoomController.tsx`, and pass it into `deriveScoreboard`.
- [ ] T073 [P] [US8] Write failing tests in `tests/unit/components/room/hooks/useMatchTransport.outage.spec.tsx`:
  - the channel closes and a poll fails → `lostAt` is set and `offline` is true;
  - the first good snapshot → `recoveredAt` is set, `awayMs` is computed, and `handlePlayerReconnect` is called once;
  - no page load is needed.
- [ ] T074 [US8] Implement the outage lifecycle in `components/room/hooks/useMatchTransport.ts` and `lib/room/roomStore.ts` (`connection.outage`).
- [ ] T075 [US8] Wire your own outage:
  - the scoreboard reads `offline · reconnecting` with your lane outlined;
  - the turn frame goes to ink (`turnFrameFor`);
  - the field takes no pick;
  - line 2 shows the `offline` source, then `back · you were away 0:34 · the clock kept running` for 4s.

  Changes go in `lib/room/scoreboard.ts`, `lib/room/moveState.ts`, `components/room/hooks/useFieldInteraction.ts` and `components/room/MatchRoomController.tsx`, with tests in the matching spec files.
- [ ] T076 [US8] Add the fixture phases `gone` and `offline`, and update `disconnect`, `end-early` and `resign` to the canvas values, in `app/[locale]/dev/room/fixtures.ts` and `RoomFixture.tsx`.

---

## Phase 12: User Story 9 (Phase B part) and polish

- [ ] T077 [US9] Complete the design system for Phase B in `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md`:
  - §5.1: the last-moved letter state;
  - §5.4 and §8: the missed beat, stakes, the illegal word, pick cleared on line 2, the line 2 precedence, back, gone for, and the end-early offer;
  - §9: announcements and focus at go.

  Record any strings shortened by T066.
- [ ] T078 [US9] Update `docs/prd_and_requirements/wottle_game_rules.md` §12 rows: frozen tile (names the word), reconnection window (`gone for`, end early with headline focus), resigning (`keep playing ▸` primary), letter states (last moved).
- [ ] T079 [US9] Update `CLAUDE.md`: the fixture phase count and list, and the new Icelandic strings added to gap 4's native-read list.
- [ ] T080 Re-baseline the visual suite on darwin for the new and changed phases (`pnpm test:visual --update-snapshots`).
- [ ] T081 Walk through every row of `specs/068-match-scoreboard/quickstart.md` by hand in the browser, at 1440×900 and 390×844.
- [ ] T082 Final gate: run `pnpm test:unit`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:check` and `pnpm test:visual`; the chromium E2E room specs; `moves-flow` and `disconnect-claim` on `playtest-firefox --workers=1`; and `pnpm perf:move-receipt` (SC-009, unchanged). Record the results in the Notes.

---

## Dependencies

```text
Setup (T001–T002) ─▶ Foundational (T003–T010) ─▶ US1 (T011–T019) ─┬─▶ US2 (T020–T024)
                                                                   ├─▶ US3 (T025–T029)
                                                                   ├─▶ US4 (T030–T034)   (needs US3's grid CSS for the ledger block)
                                                                   ├─▶ US5 (T035–T041)   (independent of US2–US4)
                                                                   └─▶ US6 (T042–T045)   (independent)
US1–US6 ─▶ US9 Phase A (T046–T051) ─▶ US7 (T052–T067) ─┐
                                    └▶ US8 (T068–T076) ─┴─▶ US9 Phase B + polish (T077–T082)
```

- T016 and T017 land in one commit (the CRITICAL regression).
- T057 (the line 2 selector) comes before T061, T062, T070 and T075, which feed it.
- T053 comes before T055.

## Parallel examples

- **Foundational:** T003, T005, T008 and T010 (different files).
- **US1:** T011 and T013 (tests), then T012 and T014.
- **After US1:** US5 (T035–T041) and US6 (T042–T045) can run beside US2 and US3.
- **US7:** T052, T054, T056, T058, T060 and T063 (all tests, different files).
- **US8:** T068, T071 and T073.

## Implementation strategy

1. **MVP:** Setup, Foundational and US1. The scoreboard replaces the bars, and the E2E specs are migrated.
2. **Phase A:** US2 through US6, then US9's first half. Tag the gate at T051; this is shippable on its own.
3. **Phase B:** US7 and US8 in parallel after T057, then T077–T082.
4. **Commits:** one per passing test or tight group, as conventional commits, e.g. `feat(room): scoreboard replaces the player bars in the match (spec 068)`.

## Notes

- T001 baseline (2026-09-23): 175 unit files, 1721 tests passing (2 skipped); lint, typecheck and docs:check clean.
- T002 folded into each task: `Copy` is derived from the English object and guarded by the parity test, so each key is added with the test that needs it.
- US1: the opponent row names no seat word (`1265 · 6 of 10 · playing`), as the canvas draws it; the full sub-line does not fit 216px. The phone total takes `--opp-text` (20px is under the large-text size; axe). The clock row has two lines, the phase label (`match clock`, `under a minute`, …) over the pace or detail, as the canvas draws it. `gone for` shipped in Phase A with the scoreboard (analysis I2).
- US2/US3: tests were written before the CSS they check (analysis D1). A `postcss.parse` check was added to `room-css.test.ts` after a stray brace broke the stylesheet while every grep still passed. The ledger reads the room's whole-pixel cell through `--cell-size` on `.room[data-layout="scoreboard"]`.
- US4: the phone phases `phone-match`, `phone-match-664` and `phone-match-360` are viewport tests over the `idle` fixture with their own baselines, not new `ROOM_PHASES` (each phase is already captured at every project viewport). The phone foot is pinned by the one-viewport room's auto margin, not by positioning, so only the slip is ever positioned.
- US5: `PointsLost` takes `labelFirst` rather than an order enum. The muted rule for a floored 0 is `.points-none`, the same specificity as `.points-lost`. A fixture test samples the rendered colours (analysis C2).
- Phase A, final state on the desktop grid (interim until the result stage, D1): the ledger drops its totals row (the scoreboard rows carry the totals), and the final foot's actions (`result ▸`, `lobby`) take the caption's context beside `⋯`, so nothing runs past the field. The final `⋯` menu gains `how to play`. On a phone the sheet keeps the totals row and the foot.
- T048: the retired phrases (`ledger clock`, `inverted face`, `eight colour tokens`, `eight tokens`, `lowercase wordmark`, `coral`) are matched case-insensitively. Historical lines in specs 044, 050, 060 and 068 carry the `<!-- retired-name -->` marker.
- T050: 89 darwin baselines regenerated (final and over-slip deleted and regenerated, because the tolerance hid the removed totals row). The Linux baselines come from the CI visual job's artifact.
- Phase B, line 2: the stakes live in `moveState.ts` (`Line2Extras.stakes`, priced by `timeoutPenalty`) rather than a separate `stakes.ts`. `LiveLines.line2Parts` carries the crimson number and the end-early action. Pick cleared and submit errors hold on line 2 with their own timers. The `pickCleared` notice kind is no longer raised in a match, but it stays in `notices.ts` with the generic timed-notice machinery; removing it is a follow-up. The pick-cleared tick flash is not built, because the opponent's tick already marks the swapped cells.
- T063–T066: the announcement hook is `useAnnouncements`, which also says 1:00 and 0:15. Line 2 runs under the opponent's total (it sits on line 1 only), about 40 mono characters, and never wraps. Shortened for it: `frozen · Kári froze it · pick another`, `moved · Kári moved it · pick another`, the waiting fact in C4's form `Kári · 8 of 10 · 1:12 left` (the Icelandic `bíður eftir Kári` also broke the name-safe rule), `back · away 0:34 · the clock ran on`, and the Icelandic end-early offer without the name (`án tengingar · ljúka viðureigninni ▸`). All are to be recorded in design system §8 (T077).
- T006 keeps `computeFieldSize` (bars, a number) and adds `computeScoreboardField` (`{cell, field}`) plus `useFieldGeometry`; the existing hook tests read a number.
