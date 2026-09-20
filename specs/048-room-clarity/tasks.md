# Tasks: Room Clarity

**Input**: Design documents from `/specs/048-room-clarity/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/{slip,round-state,rated-only,rules-route,fixture-phases}.md`, `quickstart.md`
**Design source**: canvas https://claude.ai/artifact/95RjzxvNKFrqSm5bThtxvn (artboards 1–9)

**Tests**: MANDATORY (constitution VII). Every `[test]` task fails before its `[impl]` task and passes after; one commit per passing test (`test(scope): …` then `feat|fix|refactor(scope): …`). Visual baselines change only through `pnpm test:visual --update-snapshots` after the unit tests of that phase are green.

**Organization**: by user story in spec priority order. The foundational phase carries the two things every story leans on: the slip (store + component) and the fixture phase list.

| Story | Slice | Priority |
| --- | --- | --- |
| US1 The match ends and the player knows it | C2 slip (matchOver) | P1 |
| US2 A round is legible from start to settle | C1 round state + settle hold | P1 |
| US3 Ten rounds are counted where the player looks | C1 rail | P1 |
| US4 No field before a name | C3 | P2 |
| US5 Rules are learned outside the room | C4 | P2 |
| US6 Every match is rated | C5 | P2 |
| US7 Resign and claim the win on a slip | C2 slip (resign, claimWin) | P3 |

## Path Conventions

Single Next.js application at the repository root. Room code in `lib/room/` and `components/room/`; fixture route `app/dev/room/`; baselines `tests/integration/ui/room-fixtures.spec.ts-snapshots/`; design system `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md`.

---

## Phase 1: Setup

- [ ] T001 Create `specs/048-room-clarity/{spec,plan,research,data-model,quickstart,tasks}.md` and `contracts/` (done by `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`)
- [ ] T002 [P] Add to `tests/unit/styles/acceptance-grep.test.ts` a second pattern set for retired room strings — `unranked`, `no rating change`, `? rules`, `FIRST_MATCH_RULES`, `firstMatchRules`, `resignConfirm`, `RESIGN_CONFIRM_MS` — over `app`, `components`, `lib/room`, `lib/constants/copy.ts`, `lib/matchmaking`, `app/actions/match`; mark the test `todo` until Phase 8/9 so it is committed red-by-design only as `[WIP]` (or add it in T088 instead — choose one, never commit a red test)
- [ ] T003 [P] Add `SETTLE_HOLD_MS = 1200` and `MATCH_OVER_DELAY_MS = 600` beside `SETTLE_MS` in `lib/room/revealSequence.ts` (constants only; no behaviour yet)

---

## Phase 2: Foundational — the slip and the fixture list

**Purpose**: US1, US4 and US7 all render a slip; US2/US3/US4/US7 all add fixture phases. Nothing else blocks the stories.

- [ ] T004 [test] `tests/unit/lib/room/slip.spec.ts`: `slipPrecedence` orders `matchOver > claimWin > resign > signIn`; `setSlip` keeps a higher-ranked slip; `clearSlip(kind)` clears only that kind; `setViewer(player)` clears `signIn`; `slip` and `slipDismissed` reset on a new `matchId` in `hydrateMatch`
- [ ] T005 [impl] `lib/room/slip.ts` (`SlipState` union per `data-model.md` §2, `slipPrecedence`, `outranks`) and `lib/room/roomStore.ts` (`slip: SlipState | null`, `slipDismissed: boolean`, `setSlip`, `clearSlip`, `dismissSlip`, `restoreSlip`; reset in `hydrateMatch` and `leaveToLobby`)
- [ ] T006 [test] `tests/unit/components/room/Slip.spec.tsx`: renders `role="dialog" aria-modal="true"` with `data-testid="slip"` and `data-kind`; carries `data-field-safe`; focus lands on the primary action on mount and is restored on unmount; Escape calls the kind's cancel action (`resign → keepPlaying`, `claimWin → keepWaiting`, `matchOver → reviewField`, none for `signIn`); the headline is inside a `role="status" aria-live="assertive"` region
- [ ] T007 [impl] `components/room/Slip.tsx`: shell only — frame, padding, width by kind, `useFocusTrap`, announcement region, `data-field-safe`; body rendered by a `children`/kind switch stubbed to the headline for now
- [ ] T008 [test] `tests/unit/components/room/Room.slip.spec.tsx`: `Room` renders `<Slip>` inside `[data-testid="room-slot-field"]` when the store has a slip and sets `data-slipped="true"` on the slot; nothing when `slip === null`
- [ ] T009 [impl] `components/room/Room.tsx` reads `slip` from the store and mounts `<Slip>` after `{field}`; `app/styles/room.css`: `.room__field-slot { position: relative }`, `.room__field-slot[data-slipped] .field { opacity: 0.32; transition: opacity 150ms cubic-bezier(0.2,0,0.2,1) }`, `.slip` (paper, `1.5px solid var(--ink)`, `border-radius: 0`, centred absolute, `width: 420px`, `[data-kind="matchOver"] 440px`, phones `min(300px, 100%)`, padding 28/28/24 → 20 on phones), actions ≥44px on phones; nothing added outside the existing `.room *` reduced-motion block
- [ ] T010 [test] `tests/unit/styles/room.css.spec.ts` (extend the existing stylesheet assertions): `.slip` has no `border-radius` other than 0 and no `box-shadow`; the field-slot fade is `0.32`; `.slip` appears inside the `prefers-reduced-motion` scope by inheritance (assert the block still targets `.room *`)
- [ ] T011 [impl] Adjust `room.css` until T010 passes
- [ ] T012 [test] `tests/unit/app/roomFixtures.phases.spec.ts`: `ROOM_PHASES` contains `landing-slip`, `settle`, `resign`, `claim-win`, `over-slip`, `rules` and no longer `landing`; `isRoomPhase` accepts each; the imports test (`roomFixtures.imports.test.ts`) still passes
- [ ] T013 [impl] `app/dev/room/fixtures.ts`: extend `ROOM_PHASES` and add literal fixtures `SETTLE_STATE` (`currentRound: 4`, round-3 words, `holdRound: 3`), `RESIGN_SLIP`, `CLAIM_WIN_SLIP`, `OVER_SLIP` (from `FINAL_VERDICT`, `YOU_FINAL_LINE`, `OPP_FINAL_LINE`), `SIGN_IN_SLIP`; `app/dev/room/RoomFixture.tsx`: seed `slip`/`holdRound` per phase, rename `landing` → `landing-slip`, add `rules` (renders the page content from T059 inside the fixture shell); `tests/integration/ui/room-fixtures.spec.ts`: `rules` uses `fullPage: true`

**Checkpoint**: `pnpm test:unit -- tests/unit/lib/room/slip.spec.ts tests/unit/components/room/Slip.spec.tsx tests/unit/app` green; `/dev/room?phase=over-slip` shows an empty slip shell over a faded field.

---

## Phase 3: User Story 2 — A round is legible from start to settle (Priority: P1)

**Goal**: One `RoundState` drives the live row's two lines, the field's turn frame and both bar sub-lines; a 1.2s settle hold closes each round before the next opens.

**Independent Test**: `/dev/room?phase=idle|played|opp-played|reveal|settle` show the signals in `contracts/round-state.md`; two live rounds on two clients show `your move → played → resolving → scored → your move` on both.

- [ ] T014 [P] [US2] [test] `tests/unit/lib/room/roundState.spec.ts`: `deriveRoundState` returns `scored` when `holdRound === currentRound − 1`; `resolving` when `match.state === "resolving"` or `revealing`; `outOfTime` when the viewer's timer is spent and not paused; `played` when the viewer's timer is paused; `oppPlayed` when the opponent's timer is paused; else `yourMove`; precedence in that order
- [ ] T015 [P] [US2] [test] `tests/unit/lib/room/roundState.lines.spec.ts`: `liveLinesFor` produces the six line-1 strings and the line-2 rules of `contracts/round-state.md` (field instruction during `yourMove`/`oppPlayed`, `illegal` still replaces line 2, `Kári is thinking · their clock runs`, `you +12 · Kári +0 · round 5 opens in 1`, `both played · scoring`, `your clock is spent · rounds pass`); `barSublineFor` appends `· your move` / `· played ●` / `· thinking` / `· 0:00` only during `yourMove`, `oppPlayed`, `played`, `outOfTime`; `turnFrameFor` is `"you"` for `yourMove`/`oppPlayed` else `null`
- [ ] T016 [US2] [impl] `lib/room/roundState.ts` (`RoundState`, `deriveRoundState`, `liveLinesFor`, `barSublineFor`, `turnFrameFor`); `lib/constants/copy.ts` gains `roundYourMove(n)`, `playedWaiting(name)`, `resolvingRound(n)`, `roundScored(n)`, `outOfTimeWaiting(name)`, `opponentThinking(name)`, `scoredDeltas(you, opp, next)`, `BOTH_PLAYED_SCORING`, `CLOCK_SPENT`, `YOUR_MOVE_SUFFIX`, `PLAYED_SUFFIX`, `THINKING_SUFFIX`; `PLAYED`/`RESOLVING`/`PICK_A_LETTER` move into `liveLinesFor`
- [ ] T017 [US2] [test] `tests/unit/lib/room/ledgerRows.spec.ts` (extend): `buildLedgerRows` takes `roundState` and marks the previous round `settled` while `holdRound` is set (status `"settled"`, `live` = scored lines, words present) and the current round `future`; `LiveState` no longer has `played`/`resolving` members (type-level test via `expectTypeOf`)
- [ ] T018 [US2] [impl] `lib/room/ledgerRows.ts`: `LiveState` reduced to field-interaction kinds; `BuildRowsInput.roundState`, `holdRound`; `LedgerRow.status` gains `"settled"`; `liveText` → `liveLinesFor`; `lib/room/ledgerTypes.ts` updated
- [ ] T019 [US2] [test] `tests/unit/components/room/hooks/useSettleHold.spec.tsx` (fake timers): `beginHold(round)` fires on the `settled` false→true edge for a reveal with `planIds.length > 0` or a total change; `endHold` after exactly `SETTLE_HOLD_MS`; no hold for a settle-only plan; reset on `matchId` change; `performance.mark` names `room:settle-hold:start`/`:end`
- [ ] T020 [US2] [impl] `components/room/hooks/useSettleHold.ts`; `lib/room/roomStore.ts` `holdRound`, `beginHold`, `endHold` (reset in `hydrateMatch`)
- [ ] T021 [US2] [test] `tests/unit/components/room/hooks/useFieldInteraction.spec.tsx` (extend): `canPick: false` while `holdRound` is set or a slip is up returns the reducer to idle on tap and ignores drags
- [ ] T022 [US2] [impl] `components/room/hooks/useFieldInteraction.ts` `canPick` input honoured for hold and slip (read from the store in the controller, passed in)
- [ ] T023 [US2] [test] `tests/unit/components/room/Field.turnFrame.spec.tsx`: `turnFrame="you"` sets `data-turn="you"` on `[data-testid="field"]`; `null` sets none; stylesheet assertion that `.field[data-turn="you"]` uses `outline: 3px solid var(--you); outline-offset: -3px` and never changes `border`
- [ ] T024 [US2] [impl] `components/room/Field.tsx` `turnFrame?: Seat | null` → `data-turn`; `app/styles/room.css` rule
- [ ] T025 [US2] [test] `tests/unit/components/room/Ledger.rows.spec.tsx` (extend): the live row's line 1 renders in `.ledger__live-line1` at the board face 17px (stylesheet assertion); a `settled` row renders tint + `inset 3px` ink rule + its words with totals; a `future` current round has no live text
- [ ] T026 [US2] [impl] `components/room/Ledger.tsx` `Row` handles `settled`; `room.css` `.ledger__row--settled` (same as live), `.ledger__live-line1 { font-family: var(--font-board); font-weight: 600; font-size: 17px }`
- [ ] T027 [US2] [test] `tests/unit/components/room/MatchRoomView.roundState.spec.tsx`: given a `roundState`, `MatchRoomView` passes `turnFrame` to `Field`, the suffixed sub-lines to both `PlayerBar`s (viewer suffix in `--you` when `· your move`), and `roundState` into the ledger model
- [ ] T028 [US2] [impl] `components/room/MatchRoomView.tsx` (+`roundState` prop; sub-line suffix styling via a `sublineTone` prop on `PlayerBar`) and `components/room/PlayerBar.tsx` (`sublineTone?: "seat"`)
- [ ] T029 [US2] [impl] `components/room/MatchRoomController.tsx`: derive `roundState` with `deriveRoundState({ match, viewerSlot, holdRound, revealing })`, mount `useSettleHold`, pass `canPick` (no hold, no slip, not disabled), remove the `played`/`resolving` branches of the old `live` memo; announce line 1 changes once (existing polite region)
- [ ] T030 [US2] [test] `tests/integration/ui/rounds-flow.spec.ts` (extend the two-player spec): over two rounds both pages show, in order, `round N · your move` (with `data-turn="you"`), `played · waiting for <name>` on the mover, `· played ●` on the other's top bar, `resolving round N`, `round N scored` held ≥1s, then `round N+1 · your move`
- [ ] T031 [US2] [impl] Fix anything T030 surfaces (transport ordering, hold across the summary/state bundle)
- [ ] T032 [US2] Update `app/dev/room/fixtures.ts` phase specs so `idle`, `played`, `opp-played`, `reveal`, `low-clock`, `illegal`, `picking`, `previewed` carry a `roundState` and `settle` carries `holdRound: 3`; run `pnpm test:visual --update-snapshots` for these phases and commit the six baselines per phase

**Checkpoint**: `pnpm test:unit -- tests/unit/lib/room tests/unit/components/room` green; `/dev/room?phase=settle` matches artboard 5.

---

## Phase 4: User Story 3 — Ten rounds are counted where the player looks (Priority: P1)

**Goal**: A ten-cell rail under the ledger caption, visible collapsed on phones.

**Independent Test**: any match fixture at 1440/1280/390 shows the rail with the right states; `phone-sheet` shows it above the live row.

- [ ] T033 [P] [US3] [test] `tests/unit/lib/room/roundRail.spec.ts`: `railCells(4, false)` → 3 past, 1 current, 6 future; `railCells(10, true)` → 10 past; `railCells(0, false)` → 10 future
- [ ] T034 [P] [US3] [test] `tests/unit/components/room/RoundRail.spec.tsx`: renders `role="img"` with `aria-label="round 4 of 10"`, ten `[data-state]` cells `aria-hidden`, numerals 1–10; stylesheet assertions for past (ink fill, paper numeral), current (tint, `2px solid var(--ink)`, weight 600), future (`1px solid var(--rule)`, `#B9B4A6` numeral), 26px tall, no transition
- [ ] T035 [US3] [impl] `lib/room/roundRail.ts` (`railCells`, `RailCell`), `components/room/RoundRail.tsx`, `room.css` `.rail`, `.rail__cell[data-state]`
- [ ] T036 [US3] [test] `tests/unit/components/room/Ledger.rail.spec.tsx`: `match` and `final` variants render `RoundRail` directly after `.ledger__caption`; `queue` renders it all-future; `lobby` renders none; collapsed (phone) renders it between the caption and the live-row trigger; caption text is `round 4 of 10` / `final · 10 of 10 · 18:50`
- [ ] T037 [US3] [impl] `components/room/Ledger.tsx` mounts `RoundRail` from `model.round`/`model.completed` (add both to `LedgerModel`); `lib/room/ledgerRows.ts` `buildMatchLedger` sets them; `lib/constants/copy.ts` `roundContext(round)` → `round N of 10`, `finalContext(mmss)` → `final · 10 of 10 · mmss`, `QUEUE_CONTEXT` → `10 rounds · 5:00 clocks`
- [ ] T038 [US3] [test] `tests/integration/ui/room-fixtures.spec.ts` (extend): at `visual-390x844` the rail is visible with the sheet closed and sits above `[data-testid="ledger-live-trigger"]`; at all viewports `[data-testid="round-rail"]` has `aria-label` matching the caption
- [ ] T039 [US3] Update baselines for every match/final/queue/phone phase (`pnpm test:visual --update-snapshots`) and commit

**Checkpoint**: rail visible on every match-bearing fixture at three widths.

---

## Phase 5: User Story 1 — The match ends and the player knows it (Priority: P1)

**Goal**: The match-over slip lands 600ms after the final settle, states the result once, offers the actions, and can be lifted and restored.

**Independent Test**: `/dev/room?phase=over-slip` matches artboard 6; a completed two-player match shows the slip on both clients; `review the field ▸` lifts it; `result ▸` restores it; a rematch request rewrites its action line.

- [ ] T040 [P] [US1] [test] `tests/unit/lib/room/slipCopy.spec.ts`: `matchOverSlip(verdict, reason, ratings, rematch, readOnly)` yields label `match over · 10 rounds · 18:50` (+ `· resigned` / `· out of time` / `· <name> left`), headline `Kári wins` in the winner seat (`draw 140–140` in ink), score parts with seat tones, detail line, two rating rows, actions `rematch ▸`, `new opponent ▸`, `review the field ▸`, `lobby`; read-only → `lobby` only; `rematch.phase === "incoming"` → action line `Kári asks for a rematch · accept ▸ · decline`; `"requested"` → `waiting for Kári`
- [ ] T041 [US1] [impl] `lib/room/slipCopy.ts` `matchOverSlip`; `lib/constants/copy.ts` `matchOverLabel(rounds, mmss, reason?)`, `REVIEW_FIELD`, `RESULT`; `lib/room/ledgerTypes.ts` `LedgerAction` + `"reviewField"`, + `"result"`
- [ ] T042 [US1] [test] `tests/unit/components/room/Slip.matchOver.spec.tsx`: renders every string from T040 with the winner headline in `--opp`/`--you`, totals in seat inks (`--opp` 40px is allowed, `--opp-text` not needed), rating rows with seat squares; primary `data-testid="slip-rematch"`; `review the field ▸` dispatches `reviewField`; Escape dispatches `reviewField`
- [ ] T043 [US1] [impl] `components/room/Slip.tsx` `matchOver` body
- [ ] T044 [US1] [test] `tests/unit/components/room/MatchRoomController.matchOver.spec.tsx` (fake timers, mocked transport): on the final round the slip is set `MATCH_OVER_DELAY_MS` after the hold ends; on mount with `completed` and nothing to reveal it is set immediately; `reviewField` sets `slipDismissed`; `result` restores; an incoming rematch updates the slip's `rematch` field; the final ledger no longer pushes `rematchRequest` notices; `matchEnd` sound still fires once
- [ ] T045 [US1] [impl] `components/room/MatchRoomController.tsx`: match-over slip scheduling (`useMatchOverSlip` hook in `components/room/hooks/useMatchOverSlip.ts`), `reviewField`/`result` actions, rematch state into the slip, `footActions` for final = `result ▸` (when dismissed) + `how to play ▸` placeholder wired in T060; remove the ledger `rematchRequest` notice path
- [ ] T046 [US1] [test] `tests/unit/components/room/Ledger.final.spec.tsx`: the final foot renders `result ▸` (`data-testid="ledger-result"`) only when `slipDismissed`; the verdict block remains for the read-only and dismissed states
- [ ] T047 [US1] [impl] `components/room/LedgerFoot.tsx` / `Ledger.tsx` per T046
- [ ] T048 [US1] [test] `tests/integration/ui/match-completion.spec.ts` (extend): after round 10 both pages show `[data-testid="slip"][data-kind="matchOver"]` within 3s; headline names the winner; both rating rows show deltas; A clicks `review the field ▸` → slip gone, `ledger-result` visible; click restores; B clicks `slip-rematch` → A's slip shows `asks for a rematch`; axe clean with the slip up
- [ ] T049 [US1] [impl] Fix anything T048 surfaces
- [ ] T050 [US1] Baselines for `over-slip` and `final` (dismissed) at three viewports; commit

**Checkpoint**: US1 demonstrable end to end. This is the MVP together with Phases 3–4.

---

## Phase 6: User Story 4 — No field before a name (Priority: P2)

**Goal**: Signed out, the room shows an empty ruled frame and the sign-in slip; signing in lifts the slip and lands the letters.

**Independent Test**: `/dev/room?phase=landing-slip` has no glyph in the field slot; `/` signed out likewise; entering a name lifts the slip and the letters land.

- [ ] T051 [P] [US4] [test] `tests/unit/components/room/Slip.signIn.spec.tsx`: renders wordmark 28px, `two players · one field · Icelandic words`, `NameInput` with `data-testid="player-bar-name-input"` and `player-bar-action-play`, `no account needed`, link `new here · how to play ▸` → `/rules`; the error from `LoginActionState` renders beneath the input inside the slip; no cancel on Escape
- [ ] T052 [US4] [impl] `components/room/Slip.tsx` `signIn` body hosting `NameInput` (moved, unchanged ids); `lib/constants/copy.ts` `TAGLINE`, `NEW_HERE_HOW_TO_PLAY`, `SIGN_IN_TO_SET_THE_FIELD`
- [ ] T053 [US4] [test] `tests/unit/components/room/LobbyRoomView.signedOut.spec.tsx`: with `viewer === null` the top bar has no action, the bottom bar reads `—` / `sign in to set the field` with no `nameInput`, the field receives `landedCount={0}`, and the store slip is `signIn`; with a viewer the field receives `landedCount={null}` and no slip
- [ ] T054 [US4] [impl] `components/room/LobbyRoomView.tsx` and `components/room/PlayerBar.tsx` (`nameInput` prop removed)
- [ ] T055 [US4] [test] `tests/unit/components/room/LobbyRoomController.landing.spec.tsx` (fake timers): signed out → `canPick: false`, `setSlip({kind:"signIn"})` on mount; `onSignedIn` → `setViewer`, slip cleared, `setLettersLanded` ramps 0→100 at ~100ms steps (0ms under reduced motion), `router.replace("/lobby")` unchanged
- [ ] T056 [US4] [impl] `components/room/LobbyRoomController.tsx` per T055 (reuse the queue's landing ramp by extracting `useLettersLanding` into `components/room/hooks/useLettersLanding.ts` shared with `QueueRoomController`)
- [ ] T057 [US4] [test] `tests/integration/ui/landing.spec.ts` (new, chromium): `/` signed out has zero `[data-testid="field-cell"]` with text; `slip[data-kind="signIn"]` visible; a direct `/match/<id>` without a session shows the same slip; after sign-in the slip is gone and 100 letters are present; the helper `loginViaSlip` in `tests/integration/ui/helpers/matchmaking.ts` waits for `slip` to detach
- [ ] T058 [US4] [impl] Rename `loginViaBar` → `loginViaSlip` across `tests/integration/ui/**` (same ids), fix anything T057 surfaces; baselines for `landing-slip` at three viewports

**Checkpoint**: SC-003 holds on the live route and the fixture.

---

## Phase 7: User Story 5 — Rules are learned outside the room (Priority: P2)

**Goal**: `/rules` page; `? rules`, the first-match notice and the `?` hotkey gone; `how to play ▸` in the lobby/final feet, the sign-in slip and the match menu.

**Independent Test**: `/rules` renders without a session with six headings, three figures, the table; opening it from a live match's menu leaves that match running.

- [ ] T059 [P] [US5] [test] `tests/unit/app/rules.parity.spec.tsx`: the page's `ScoringTable` numbers equal `DEFAULT_GAME_CONFIG` (length bonus per letter, combo bonus, duplicate = 0); the clock section states `MATCH_CLOCK_BUDGET_MS` as `5:00` and `TOTAL_ROUNDS` as ten; six `<h2>` in the contract's order; three `RulesFigure`s with `aria-hidden` fields and captions
- [ ] T060 [US5] [impl] `app/rules/page.tsx` (`dynamic = "force-static"`), `components/rules/RulesFigure.tsx` (real `Field`, 300px, literal boards/bands, `disabled`), `components/rules/ScoringTable.tsx`, `app/styles/rules.css` (max-width 800, single column <900px, room tokens only); header/footer links per `contracts/rules-route.md`
- [ ] T061 [P] [US5] [test] `tests/unit/components/room/RoomMenu.spec.tsx`: match variant lists `how to play` as an `<a href="/rules" target="_blank" rel="noopener">` (`data-testid="ledger-menu-item-howToPlay"`); lobby/final variants do not (it is in their foot)
- [ ] T062 [US5] [impl] `components/room/RoomMenu.tsx`
- [ ] T063 [US5] [test] `tests/unit/components/room/LedgerFoot.spec.tsx`: no `ledger-rules` button in any variant; lobby and final feet render `how to play ▸` as a same-tab link (`data-testid="ledger-how-to-play"`); match foot does not
- [ ] T064 [US5] [impl] `components/room/LedgerFoot.tsx`, `lib/room/ledgerTypes.ts` (`LedgerAction` −`"rules"` +`"howToPlay"`), `lib/constants/copy.ts` (`HOW_TO_PLAY`; delete `RULES`, `FIRST_MATCH_RULES`)
- [ ] T065 [US5] [test] `tests/unit/components/room/hooks/useRoomHotkeys.spec.tsx`: `?` does nothing; `M` still toggles sound
- [ ] T066 [US5] [impl] `components/room/hooks/useRoomHotkeys.ts`; delete the `firstMatch` effect and `rules` branches in `MatchRoomController.tsx`, `LobbyRoomController.tsx`, `QueueRoomController.tsx`; delete `firstMatchRules` from `Notice` and `notices.ts`
- [ ] T067 [US5] [test] `tests/integration/ui/rules-page.spec.ts` (new): renders signed out; headings in order; axe clean; at 390 wide `document.scrollingElement.scrollWidth <= 390`; from a live match (`startMatchWithDirectInvite`) clicking the menu item opens a new page whose URL ends `/rules` while the original page's `[data-testid="room"]` keeps `data-phase="match"` and its clock text changes within 3s
- [ ] T068 [US5] [impl] Fix anything T067 surfaces; baselines for `rules` (full page, three viewports), `lobby`, `final` (foot change)

**Checkpoint**: `grep -rn "? rules\|firstMatchRules\|FIRST_MATCH_RULES" app components lib` returns nothing.

---

## Phase 8: User Story 6 — Every match is rated (Priority: P2)

**Goal**: The `rated` distinction is gone from code and copy; directory challenges write ratings.

**Independent Test**: an invite-created match completes with rating deltas on both bars; `unranked` occurs nowhere under `app`, `components`, `lib`.

- [ ] T069 [P] [US6] [test] Rewrite `tests/unit/lib/room/rankedCaptions.spec.ts`: `roundContext(4) === "round 4 of 10"`, `finalContext("18:50") === "final · 10 of 10 · 18:50"`, `HERE_NOW === "here now"`, `ratingLine(null, id, true) === "rating pending"`, no `rankLabel`/`NO_RATING` exports (type-level)
- [ ] T070 [US6] [impl] `lib/constants/copy.ts` (delete `rankLabel`, `NO_RATING`; `HERE_NOW`; `finalContext`), `lib/room/ledgerRows.ts` (`rated` params removed from `BuildRowsInput`, `ratingLine`, `finalCaption`), `components/room/MatchRoomView.tsx` (`rated` prop removed), `components/room/MatchRoomController.tsx` (four `match.rated !== false` call sites)
- [ ] T071 [P] [US6] [test] `tests/contract/post-invite.contract.test.ts` (extend): the bootstrap input for an accepted invite carries no `rated` key; `tests/unit/lib/matchmaking/service.spec.ts`: `MatchBootstrapInput` has no `rated` (type-level) and `isMatchRated` no longer exists
- [ ] T072 [US6] [impl] `lib/matchmaking/inviteService.ts` (remove `rated: false`), `lib/matchmaking/service.ts` (remove `rated` from the input, payload builder and `isMatchRated`), `app/actions/match/requestRematch.ts` and `respondToRematch.ts` (remove the inheritance lines)
- [ ] T073 [P] [US6] [test] `tests/unit/lib/rating/completeMatch.rated.spec.ts` (or extend the existing rating tests): `completeMatch` applies rating changes for an invite-created match; still skips `abandoned`
- [ ] T074 [US6] [impl] `app/actions/match/completeMatch.ts` (remove `rated` from the row type, the select and the gate), `lib/match/stateLoader.ts` (remove the `rated` select, fallback and field), `lib/types/match.ts` (`MatchState.rated` removed)
- [ ] T075 [US6] [test] Update `tests/integration/ui/match-completion.spec.ts` L36–44 and `rounds-flow.spec.ts` L42–44: expect `final · 10 of 10 · m:ss` and rating lines `/\d+ → \d+ · [+−]\d+/` on both bottom bars
- [ ] T076 [US6] [impl] Fix anything T075 surfaces; add `unranked`, `no rating change` to the acceptance grep (T002) and un-`todo` it
- [ ] T077 [US6] Add `SUPERSEDED` note to `specs/045-field-ledger-completion/contracts/rated-flag.md` pointing at `specs/048-room-clarity/contracts/rated-only.md`; note the unread column in `CLAUDE.md` "Remaining Gaps"

**Checkpoint**: `pnpm test:integration` and the two-player specs green with rating lines on invite-created matches.

---

## Phase 9: User Story 7 — Resign and claim the win on a slip (Priority: P3)

**Goal**: Both match-ending decisions are slips; the `resignConfirm` and `claimWin` notices are gone.

**Independent Test**: `/dev/room?phase=resign|claim-win` match artboard 2 and the claim variant; on a live match `resign ▸` opens the slip and `keep playing ▸` closes it unchanged; past the reconnection window the claim slip shows and lifts itself on reconnect.

- [ ] T078 [P] [US7] [test] `tests/unit/lib/room/slipCopy.resign.spec.ts`: `resignSlip(round, clockMs, opponentName)` → label `round 4 of 10 · 4:12 on your clock`, headline `Resign the match?`, body `Kári wins · your rating moves as a loss`, actions `yes, resign ▸` (`confirmResign`), `keep playing ▸` (`keepPlaying`); `claimWinSlip(opponentName)` → `Kári is gone`, `0:00 left to reconnect`, `claim the win ▸` (`claimWin`), `keep waiting ▸` (`keepWaiting`)
- [ ] T079 [US7] [impl] `lib/room/slipCopy.ts` additions; `lib/constants/copy.ts` (`RESIGN_QUESTION`, `resignConsequence(name)`, `resignLabel(round, mmss)`, `isGone(name)`, `RECONNECT_SPENT`, `KEEP_PLAYING`, `KEEP_WAITING`, `YES_RESIGN`; delete `RESIGN_CONFIRM`, `claimWinLine`); `LedgerAction` −`"cancelResign"` +`"keepPlaying"` +`"keepWaiting"`
- [ ] T080 [US7] [test] `tests/unit/components/room/Slip.decisions.spec.tsx`: both bodies render; primaries `slip-confirm-resign` / `slip-claim-win`; Escape → `keepPlaying` / `keepWaiting`
- [ ] T081 [US7] [impl] `components/room/Slip.tsx` `resign` and `claimWin` bodies
- [ ] T082 [US7] [test] `tests/unit/components/room/MatchRoomController.decisions.spec.tsx`: `resign`/`leave` → `setSlip(resign)` with the live round and clock; `keepPlaying` → `clearSlip("resign")`; `confirmResign` → `resignMatch` and clear; `reconnectMsLeft === 0` → `setSlip(claimWin)`; opponent reconnects → `clearSlip("claimWin")`; `keepWaiting` clears until the next window tick re-arms it after 10s; a `matchOver` slip replaces either; the clocks keep running (no `clocksHeld` change)
- [ ] T083 [US7] [impl] `components/room/MatchRoomController.tsx` per T082; delete `resignConfirm`, `RESIGN_CONFIRM_MS`, `claimWin` from `lib/room/notices.ts`, `ledgerTypes.ts` `Notice`, and `Ledger.tsx` `NoticeLine`
- [ ] T084 [US7] [test] `tests/integration/ui/disconnect-claim.spec.ts` (extend the existing disconnect spec): past the window the claim slip appears; `keep waiting ▸` lifts it; `claim the win ▸` completes the match and the match-over slip follows with `· Kári left`
- [ ] T085 [US7] [impl] Fix anything T084 surfaces; baselines for `resign`, `claim-win` at three viewports

---

## Phase 10: Polish & cross-cutting

- [ ] T086 [P] Design system amendments in `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md`: §1.1, §1.8, §1.9, §6, §10 (the slip as the one overlay and the one opacity change; rules outside the room); new §5.9 Slip; §5.1 turn frame; §5.3 turn sub-lines; §5.4 rail and live-row line 1 in the board face; §7 add the Settle beat's hold; §8 every string added/removed (`round 4 of 10`, `final · 10 of 10 · 18:50`, `10 rounds · 5:00 clocks`, `here now`, the six line-1 states, the slip strings, `how to play ▸`, `result ▸`); §9 slip focus/announcement; keep "eight values" wording (bundle grep)
- [ ] T087 [P] `docs/prd_and_requirements/wottle_game_rules.md` §12: rewrite the "Round number and progression" row (rail + caption), add rows for the slip (match over, resign, claim), the turn frame and the settle hold; check §2–§6 prose against `app/rules/page.tsx`
- [ ] T088 [P] `tests/unit/styles/acceptance-grep.test.ts`: finalise the retired-string set from T002 (all green now) and allow `position: absolute` inside the field slot only for `.slip`
- [ ] T089 [P] `tests/integration/ui/README.md`: add `slip`, `slip-rematch`, `slip-confirm-resign`, `slip-claim-win`, `round-rail`, `ledger-result`, `ledger-how-to-play`, `ledger-menu-item-howToPlay`; remove `ledger-rules`; note `loginViaSlip`
- [ ] T090 [P] `CLAUDE.md`: Project Overview paragraph for spec 048 (the slip, the rail, rated only, `/rules`), Design section (the slip exception, live row line 1), fixture phase list, Remaining Gaps (`matches.rated` unread column), test counts
- [ ] T091 Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm docs:check && pnpm test:visual`; fix residue; regenerate linux baselines in CI (`playwright-results-*` artifact) and commit them
- [ ] T092 Update the canvas https://claude.ai/artifact/95RjzxvNKFrqSm5bThtxvn only if implementation deviated from an artboard; record the deviation in `specs/048-room-clarity/spec.md` Assumptions

---

## Dependencies & Execution Order

```text
Phase 1 (T001–T003)
  └─ Phase 2 Foundational (T004–T013)  ← slip shell + fixture list
       ├─ Phase 3 US2 round state + hold (T014–T032)
       │     └─ Phase 4 US3 rail (T033–T039)        ← needs LedgerModel.round from T018
       │           └─ Phase 5 US1 match-over slip (T040–T050)   ← needs the hold's end (T020) for the 600ms delay
       ├─ Phase 6 US4 sign-in slip (T051–T058)      ← needs only Phase 2
       ├─ Phase 7 US5 rules page (T059–T068)        ← needs only Phase 2; T060 before T013's `rules` fixture renders
       ├─ Phase 8 US6 rated only (T069–T077)        ← independent of the UI phases; touches copy also touched by T037 (merge order: T037 first)
       └─ Phase 9 US7 decision slips (T078–T085)    ← needs Phase 2; shares Slip.tsx with US1/US4 (sequence the [impl] tasks)
Phase 10 Polish (T086–T092) after everything
```

## Parallel Opportunities

- Phase 2: T004/T006/T008/T010/T012 tests can be written together; their impls follow in order because they share `roomStore.ts`, `Slip.tsx`, `room.css`.
- Phase 3: T014 ∥ T015 (two spec files); T019 ∥ T023 after T018.
- Phase 4: T033 ∥ T034.
- Phase 5: T040 ∥ T042 (after T041's types); T046 ∥ T044.
- Phases 6, 7, 8 can run in parallel with Phase 3 on separate branches; Phase 8 only conflicts with T037 in `copy.ts`.
- Phase 10: T086–T090 all parallel.

## Implementation Strategy

1. **MVP** = Phase 2 + Phase 3 + Phase 4 + Phase 5: the round is legible, the ten rounds are counted, the match end is unmissable. Ship as one PR if the baselines stay reviewable; otherwise PR per phase.
2. **Second PR**: Phases 6 + 7 (entry and exit of the room: sign-in slip, rules page).
3. **Third PR**: Phase 8 (rated only) — small, mostly deletions, its own review because it touches rating writes.
4. **Fourth PR**: Phase 9 + Phase 10.

Every PR runs the visual suite; baselines for both platforms are committed in the PR that changes them.
