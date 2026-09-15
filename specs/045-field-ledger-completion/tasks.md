# Tasks: Field & Ledger Completion

**Input**: Design documents from `/specs/045-field-ledger-completion/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Design sources**: `docs/design_documentation/260915-design-scope-clarification/` — `IMPLEMENTATION_REVIEW.md` (findings A1–E2), `Wottle Implementation Review.dc.html` §02 fixture **B** (the target field), `Wottle UX Audit.dc.html` Fig. 2, 5–10.

**Tests**: MANDATORY. Constitution Principle VII (TDD, non-negotiable) applies to every task below. Within each story the test task comes first and **MUST fail** before the implementation task that follows. Commit each passing test separately (`test(scope): …`); never commit a failing one.

**Organization**: grouped by user story. The seven stories map 1:1 to the handoff bundle's steps R1–R7, so both traceability paths hold:

| Story | Handoff step | Review findings |
| --- | --- | --- |
| US1 Room renders without a database (P1) | R1 Seen | E1 |
| US2 The field looks like the design (P1) | R2 Field paint | A1 A2 A3 B3 B4 B8 + decision 3 |
| US3 The room sits as one composition (P2) | R3 Composition | B1 B2 B7 B10 |
| US4 The room fits a phone (P2) | R4 Phone | A4 C4 |
| US5 Hand and keyboard (P2) | R5 Interaction & motion | C1 C2 C3 B5 B6 |
| US6 Only the design's vocabulary (P3) | R6 Debt, decisions, documents | D1–D4 B9 B11 E2 + decisions 1–2 |
| US7 Someone has looked at it (P3) | R7 Baselines & real run | C5 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: US1–US7; Setup, Foundational and Polish tasks carry no story label
- Every task names the exact file(s) it creates, edits, deletes or moves

## Path Conventions

Single Next.js application at the repository root: `app/`, `components/`, `lib/`, `tests/{unit,contract,integration}/`, `supabase/migrations/`, `scripts/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: unblock the branch's own quality gate. Every step from US1 on ends with `pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check` green, and the gate was red before this phase.

- [x] T001 Write failing test `tests/unit/scripts/docsConsistencyGrep.test.ts`: a retired phrase used plainly still fails; the same phrase on a line carrying `<!-- retired-name -->` passes; the marker exempts its own line only; it works for the whole-word phrase too; the repository as it stands is clean — then add the line-level exemption to `scripts/docs/consistency-grep.sh` by factoring the scan loop into one `report_hits file phrase mode` helper that filters the marker out of the hits (research §9)
- [x] T002 Apply `<!-- retired-name -->` to the lines in `specs/045-field-ledger-completion/{spec,plan,research,tasks}.md` that name a retired token in order to delete it; confirm `pnpm docs:check` exits 0
- [x] T003 Adopt the board-responsiveness amendment in `.specify/memory/constitution.md`: replace Principle IV's pinch-zoom bullet with "the field fills the available width without scrolling or zoom; cells never fall below 35px, and the page itself never scrolls (spec 045 FR-021)"; convert the pending-amendment block to an adoption record; bump to v1.5.0 / Last Amended 2026-09-15 in the Sync Impact Report and the footer

**Checkpoint**: `pnpm docs:check` green, constitution v1.5.0, Principle IV no longer contradicts FR-021.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the view/controller split that US1's fixture route mounts. Nothing else depends on it, but US1 cannot start without it.

⚠️ **MUST complete before US1.**

- [x] T004 [P] Write failing test `tests/unit/components/room/LobbyRoomView.spec.tsx` (renders from props alone: both bars, the field and the ledger present; the module imports no store, transport or Server Action) then extract `components/room/LobbyRoomView.tsx` from `components/room/LobbyRoomController.tsx`, exactly as `MatchRoomView.tsx` is split from `MatchRoomController.tsx`; the controller keeps store, transport and timers and passes props; `LobbyRoomController.spec.tsx` stays green unchanged
- [x] T005 [P] Write failing test `tests/unit/components/room/QueueRoomView.spec.tsx` (same contract) then extract `components/room/QueueRoomView.tsx` from `components/room/QueueRoomController.tsx`; `QueueRoomController.spec.tsx` stays green unchanged

**Checkpoint**: three room views are presentational and prop-driven; three controllers own state.

---

## Phase 3: User Story 1 — The room can be seen without a database (Priority: P1) 🎯 MVP

**Goal**: any of nine room states renders at any viewport from static data, with no database, no session and no second player, and a screenshot suite captures them.

**Independent test**: on a machine with no `.env.local`, `pnpm dev` then open `/dev/room?phase=match` — the room renders complete; no request reaches a database; the field shows the grey slab of review fixture A (this is the "before").

**Why first**: the review's root cause. Until the room renders cheaply, no fix in US2–US6 can be verified and no regression can be caught. Worth shipping alone.

- [x] T006 [US1] Create `app/dev/room/fixtures.ts`: the 10-row board from `data-model.md` §6, players (Birna 1204 you / Kári 1187 opp), rounds 1–3 scored (`BORÐ` you R1 ltr x2–5 y2; `GILT` opp R2 ttb x7 y4–7; a third word from the board for R3), clocks 4:12 and 2:31 of 5:00, territory, verdict `Kári wins 170–127` / `by 43 points · 10 words to 8 · territory 32–25`, disconnect `reconnecting · 0:42 left`, profile fixture (12 rating points, record row, best words, recent matches); typed with the existing `MatchState`, `LedgerModel`, `AccumulatedWord`, `FrozenTileMap` and profile types — **declare no new interface in this file**; every clock, count and timestamp is a literal (no `Date.now()`, `Math.random()` or locale formatting)
- [x] T007 [US1] Write failing test `tests/unit/app/roomFixtures.imports.test.ts` (walks `app/dev/room/` and fails on any import from `lib/supabase/**`, `app/actions/**` or `components/room/*Controller.tsx`) then create `app/dev/room/page.tsx`: a server component that returns `notFound()` when `process.env.NODE_ENV === "production" && !process.env.ROOM_FIXTURES`, reads `phase` (`landing | lobby | queue | found | match | reveal | final | disconnect | profile`, defaulting to `match`), wrapping a client component that seeds `useRoomStore` and `usePreferencesStore` from the fixtures and renders `RoomShell` → `Room` with `LobbyRoomView` / `QueueRoomView` / `MatchRoomView` / `ProfilePage`; `reveal` mounts `useReveal` once over the round-3 words; `match` starts with `T` picked at x0 y9 — per `contracts/fixture-route.md`
- [x] T008 [US1] Add three Playwright projects to `playwright.config.ts` — `visual-1440x900`, `visual-1280x800`, `visual-390x844`, each with `testMatch: /room-fixtures\.spec\.ts/` and its own `viewport` — and set `expect.toHaveScreenshot` defaults (`maxDiffPixelRatio: 0.002`, `animations: "disabled"`) once in `TestConfig.expect`; exclude `room-fixtures` from the existing `chromium` project (research §6)
- [x] T009 [US1] Create `tests/integration/ui/room-fixtures.spec.ts`: for each of the nine phases, navigate to `/dev/room?phase=…`, wait for the field's 100 cells, then `await expect(page).toHaveScreenshot(\`${phase}.png\`)` — no viewport loop and no explicit font wait (Playwright resolves the baseline path per project and already awaits `document.fonts.ready` and two identical frames); add `"test:visual": "playwright test --project=visual-1440x900 --project=visual-1280x800 --project=visual-390x844"` to `package.json`; document `pnpm test:visual --update-snapshots` in `CLAUDE.md` → Testing
- [x] T010 [US1] Add a CI job `visual` to `.github/workflows/ci.yml`: `pnpm build && ROOM_FIXTURES=1 pnpm start` + wait-on, then `pnpm test:visual`, with **no Supabase services**; set `continue-on-error: true` and upload the screenshots as artifacts — **baselines are NOT committed in this story**, they would enshrine defects A1–A4 (US7 T040 removes both)

**Checkpoint**: `/dev/room?phase=match` renders with no `.env.local`; the visual job runs in CI and uploads the "before" images.

---

## Phase 4: User Story 2 — The field looks like the design (Priority: P1)

**Goal**: paper cells, 1px rules crossing the bands, a 1.5px frame, letters at 55% of the cell at every size, 1.5px chevrons at each word's reading start.

**Independent test**: `/dev/room?phase=match` at 1440×900 and 390×844 matches review fixture **B** point for point.

**Depends on**: US1 (the screenshots are how this story is judged).

- [x] T011 [US2] Write failing assertions in `tests/unit/styles/room-css.test.ts`: `.field` declares `background: var(--paper)`, `gap: 0` and `--cell-size: calc(var(--field-size) / 10)`; no `.field::before` rule exists; `.field__cell` declares `background: transparent`, `border-right: 1px solid var(--rule)` and `border-bottom: 1px solid var(--rule)`; **`.field__cell:nth-of-type(10n)` has `border-right: 0` and `.field__row:last-child .field__cell` has `border-bottom: 0`**; letter `font-size: calc(var(--cell-size) * 0.55)` and numeral `font-size: max(9px, calc(var(--cell-size) * 0.18))` with no `48px` fallback anywhere (decision 3's floor, folded in here so US6 cannot contradict this assertion); `[data-cell-size="small"] .field__value { display: none }`; `.player-bar` declares `padding: 0`
- [x] T012 [US2] Edit `app/styles/room.css` per `plan.md` → Field: paper ground, `gap: 0`, delete `.field::before` entirely, merge the two `.field__cell` blocks into one (transparent background + borders), add the two edge-suppression rules, declare `--cell-size` on `.field`, remove both `, 48px` fallbacks, floor the numeral at `max(9px, …)` and hide it under `[data-cell-size="small"]` (decision 3), `.player-bar { padding: 0 }`; keep `.field__bands` at `z-index: 0` beneath the cells. **Do not use the handoff's `:nth-last-of-type(-n + 10)`** — `Field.tsx` wraps each row in `.field__row { display: contents }`, so it matches all ten cells of every row and would strip every horizontal rule (research §1). Do not remove the row wrappers; they are the `grid → row → gridcell` tree axe requires
- [x] T013 [P] [US2] Write failing assertion in `tests/unit/components/room/FieldBands.spec.tsx` (`stroke-width="1.5"` on every chevron path, `vector-effect="non-scaling-stroke"` retained) then change `strokeWidth={0.15}` → `strokeWidth={1.5}` in `components/room/FieldBands.tsx`
- [x] T014 [US2] Write failing tests in `tests/unit/components/room/hooks.spec.tsx` (`computeFieldSize(390, 844, { barHeight: 56, paddingX: 32 })` → 358; `useFieldSize` reads 56 when `matchMedia("(max-width: 900px)")` matches) then edit `components/room/hooks/useFieldSize.ts` to take an **options object** rather than a fourth positional parameter (Principle VI), subtract the horizontal padding read from `getComputedStyle(el)` — `clientWidth` includes it — and pick the bar height from `matchMedia`; edit `app/styles/room.css` so `.room__field-slot { width: var(--field-size) }` holds below 900px too (keep `width: 100%` for `.room__stack`); `components/room/Room.tsx` sets `data-cell-size={fieldSize / 10 < 32 ? "small" : "regular"}` on `.room__field-slot` (research §2); assert in `tests/unit/components/room/Room.spec.tsx` that `fieldSize = 310` yields `data-cell-size="small"`, and in `FieldCell.spec.tsx` that the cell's `aria-label` still states the letter's value when the numeral is hidden (FR-009)
- [x] T015 [P] [US2] Write failing test in `tests/unit/components/room/MatchRoomController.spec.tsx` (picking `T` shows `picking · T (${LETTER_SCORING_VALUES_IS.T})`) then replace `value: 0` in `components/room/MatchRoomController.tsx` with `LETTER_SCORING_VALUES_IS[letter] ?? 0`, imported as `components/room/Field.tsx` does
- [x] T016 [P] [US2] Write failing test in `tests/unit/components/room/MatchRoomController.spec.tsx` (a letter frozen in round 2, tapped during round 4, shows `frozen · Kári R2 · pick another`; a letter covered by two scored words names the **earliest** round) then in `MatchRoomController.tsx` resolve `onNotice("frozen", at)`'s round from the `useAccumulatedRounds` word whose `coordinates` include `at`, falling back to `match.currentRound` (research §8)
- [x] T017 [US2] Extend `tests/integration/ui/room-fixtures.spec.ts` with computed-style assertions at 1440×900 and 390×844: field `backgroundColor` is `#FFFDF7`; an interior cell's `borderRightColor` is `#E6E2D6` at `1px`; a row-10 cell's `borderBottomWidth` is `0px` and a row-9 cell's is `1px`; the letter `font-size` is 0.55 × the measured cell width. Capture the screenshots and compare with fixture B and Fig. 2 by eye; attach to the PR

**Checkpoint**: the field looks like fixture B at both sizes.

---

## Phase 5: User Story 3 — The room sits as one composition (Priority: P2)

**Goal**: one gutter of the designed width between field and ledger at any window width, the pair centred; a full-width tinted live row; the queue using the same element; no bare page outside the room.

**Independent test**: measure field-right to ledger-left at 1440×900 (56px) and 1000×800 (40px); open the queue state and see the progress in a tinted live row.

**Depends on**: US2 (the gutter can only be measured once the field is its true size).

- [x] T018 [US3] Write failing assertions in `tests/unit/styles/room-css.test.ts` (`.room` declares `grid-template-columns: auto var(--ledger-width)` and `justify-content: center`; `.room__stack` declares `margin: 0` and no `margin: 0 auto`) and in `tests/integration/ui/room-layout.spec.ts` (`ledger.left − field.right` is 56 ± 1 at 1440×900 and 40 ± 1 at 1000×800) then edit `app/styles/room.css`; the ≤ 900px block keeps `minmax(0, 1fr)`
- [x] T019 [US3] Write failing test in `tests/unit/components/room/Ledger.spec.tsx` (exactly one `[data-testid="ledger-live-row"]`; it contains the round label `R4`, `picking · T (1)` and `played ●`; its style carries `gridColumn: "1 / -1"`) then edit `components/room/Ledger.tsx` so the live row is one element spanning all three columns with `background: var(--tint)` and `box-shadow: inset 3px 0 0 var(--ink)`, containing an inner `34px 1fr 1fr` grid with the round label inside it; update `.ledger__live-row` in `app/styles/room.css` (replacing its `border-left`)
- [x] T020 [US3] Write failing tests in `tests/unit/lib/room/ledgerRows.spec.ts` (the queue model carries `live: "setting the field · 58 of 100 letters"` while landing and `live: "round 1 in 3"` when found) and `Ledger.spec.tsx` (the queue variant renders the live row with that text above the hint) then add `live?: string` to `LedgerModel` in `lib/room/ledgerTypes.ts`, set it in `components/room/QueueRoomController.tsx` (moving the strings out of `hint`), and render it for the queue variant in `Ledger.tsx`
- [x] T021 [P] [US3] Write failing tests in `tests/unit/lib/constants/copy.spec.ts` (`NO_SUCH_MATCH === "that match does not exist"`) and `tests/unit/components/room/LobbyRoomController.spec.tsx` (`?notice=no-match` shows a `text` notice with that copy in the live-row style) then replace the bare `<div>Match not found</div>` in `app/(room)/match/[matchId]/page.tsx` with `redirect("/lobby?notice=no-match")`, add the constant to `lib/constants/copy.ts`, and read + clear the param with `history.replaceState` in `components/room/LobbyRoomController.tsx`
- [x] T022 [US3] Screenshot `lobby`, `queue`, `found` and `match` at 1440×900 and 1280×800; check against Fig. 6, 7 and 2: one gutter, the live row tinted edge to edge with its 3px rule at the left, the ledger's top rule and foot aligned with the bars' outer edges

---

## Phase 6: User Story 4 — The room fits a phone (Priority: P2)

**Goal**: bar / field / bar / live row at 390×844 with no page scroll; the rest of the ledger opens in flow beneath the live row and never covers the field or either bar.

**Independent test**: at 390×844 the page does not scroll with the sheet closed or open; the sheet's top is at or below the bottom bar's lower edge; cells stay ≥ 35px.

**Depends on**: US3 (the phone ledger reuses the full-width live row).

- [x] T023 [P] [US4] Write failing test `tests/unit/components/room/hooks.useIsPhone.spec.tsx` (`false` on the server; follows `matchMedia("(max-width: 900px)")` and its `change` event) then create `components/room/hooks/useIsPhone.ts`
- [x] T024 [US4] Write failing tests in `tests/unit/components/room/Ledger.spec.tsx` (with `collapsed`: renders the caption, the live row as `<button aria-expanded="false">` whose opponent cell reads `history ▸`, the territory bar and counts line, and **not** the seat header, rows, hint or foot; activating it renders `[data-testid="ledger-sheet"]` with header, rows and foot and sets `aria-expanded="true"`; Esc closes it and returns focus to the button; `sheetOpen` resets when `collapsed` becomes false) then edit `components/room/Ledger.tsx` (prop `collapsed`, local `sheetOpen`, renders `components/room/LedgerSheet.tsx`) and pass `collapsed={isPhone}` from `MatchRoomView.tsx`, `LobbyRoomView.tsx` and `QueueRoomView.tsx`
- [x] T025 [US4] Write failing assertions in `tests/unit/styles/room-css.test.ts` (`.ledger-sheet` declares `flex: 1`, `min-height: 0`, `overflow-y: auto` and **no `position: fixed|absolute`, no `z-index`, no `max-height: 70dvh`**; the ≤ 900px block gives `.room__ledger` `display: flex`, `flex-direction: column`, `min-height: 0`) and extend `tests/unit/components/room/LedgerSheet.spec.tsx` with the same negative assertion, then **rewrite** `.ledger-sheet` in `app/styles/room.css` — it is currently a fixed-position panel at `z-index: 3`, which would sit over the field and the bottom bar (research §3)
- [x] T026 [US4] Extend the phone test in `tests/integration/ui/room-layout.spec.ts` (390×844, `/dev/room?phase=match`): `document.scrollingElement.scrollHeight <= window.innerHeight` with the sheet closed **and** open; every `[data-testid="field-cell"]` ≥ 35px square; the sheet's `getBoundingClientRect().top >= bottomBar.bottom`; `@axe-core/playwright` clean with the sheet open; every touch target inside the sheet ≥ 44px
- [x] T027 [US4] Screenshot `match`, `final` and `lobby` at 390×844 with the sheet closed and open; check against Fig. 5

---

## Phase 7: User Story 5 — The room answers the hand and the keyboard (Priority: P2)

**Goal**: drag to swap, tap outside to cancel, `?` and `M`, a 150ms letter exchange, a 200ms pin fade and name write, and a correctly dashed disconnected lane.

**Independent test**: in a live match, drag one letter onto another and the swap commits; with a letter picked, tapping the ledger caption cancels; `?` opens the rules and `M` flips the sound setting.

**Depends on**: US1 only. **Independent of US3 and US4 — may run in parallel with them.**

- [x] T028 [US5] Write failing tests in `tests/unit/components/room/Field.interaction.spec.tsx` (`pointerdown` on A then `pointerup` over B — stubbing `document.elementFromPoint` — dispatches `{ type: "drag", from: A, to: B }` once and no `tap`; `pointerdown`/`pointerup` on the same cell dispatches one `tap`; a `pointerup` outside the field cancels and dispatches neither) then add `onPointerDown`/`onPointerUp` to `components/room/FieldCell.tsx` and pointer capture, cell resolution and synthetic-click suppression (a ref flag cleared on the next `click`) to `components/room/Field.tsx` / `hooks/useFieldInteraction.ts`; add `.field { touch-action: none }` to `app/styles/room.css` and assert it in `room-css.test.ts`
- [x] T029 [P] [US5] Write failing test in `Field.interaction.spec.tsx` (state `picked`: a document `pointerdown` on `document.body` dispatches `tapOutside`; on an element carrying `data-field-safe` it dispatches nothing; state `idle`: no listener is attached) then add the document listener to `components/room/hooks/useFieldInteraction.ts` and `data-field-safe` to the action buttons in `components/room/LedgerFoot.tsx` and the notice buttons in `components/room/Ledger.tsx`
- [x] T030 [P] [US5] Write failing test `tests/unit/components/room/hooks.useRoomHotkeys.spec.tsx` (`?` → `onAction("rules")`; `m` and `M` → `onAction("toggleSound")`; ignored when the target is an `<input>`, `<textarea>` or `[contenteditable]`, and when `metaKey|ctrlKey|altKey` is held) then create `components/room/hooks/useRoomHotkeys.ts` and call it from `LobbyRoomController.tsx`, `QueueRoomController.tsx` and `MatchRoomController.tsx` with their existing `onAction`
- [x] T031 [US5] Write failing assertions in `tests/unit/styles/room-css.test.ts` (`@keyframes letter-exchange` from `translate(var(--dx), var(--dy))` to `translate(0, 0)`; `.field__cell--exchange` runs 150ms `cubic-bezier(0.2, 0, 0.2, 1)`; `.field__cell--unpinned` uses `pin-fade` 200ms; `.player-bar__name--writing` goes opacity 0 → 1 over 200ms; all three are 0ms or `none` inside the `prefers-reduced-motion` block) and in `hooks.spec.tsx` (a `displayBoard` change that swaps two cells sets `--dx`/`--dy` and the class on exactly those two cells and clears them on `animationend`) then implement: `Field.tsx` computes FLIP offsets from the two cells' `getBoundingClientRect` before and after the swap, `FieldCell.tsx` accepts `exchange?: { dx: number; dy: number }` and `unpinned?: boolean`, `PlayerBar.tsx` accepts `writing?: boolean` and `QueueRoomController.tsx` sets it when the opponent is found; apply `pin-fade` wherever a cell leaves `pinned`
- [x] T032 [P] [US5] Write failing test in `tests/unit/components/room/PlayerBar.spec.tsx` (the disconnected lane renders an `<svg>` containing `<line stroke-dasharray="6 4" stroke-width="4">` and no `border-top` rule applies) then edit `components/room/ClockLane.tsx` per `plan.md` and delete `.player-bar__lane--disconnected .player-bar__lane-fill { border-top: … dashed }` from `app/styles/room.css`
- [x] T033 [US5] Extend `tests/integration/ui/room-flow.spec.ts` (Supabase-backed, they need a live move): drag A → B commits a swap; with a letter picked, tapping the ledger caption cancels with no notice; add a fixture-route variant for `?` and `M` to `tests/integration/ui/room-fixtures.spec.ts`

---

## Phase 8: User Story 6 — Only the design's vocabulary is left in the tree (Priority: P3)

**Goal**: exactly eight colour values, no leftovers from the previous look, no engine setting that contradicts the rules, and a design bundle that describes what the code does.

**Independent test**: search the stylesheets and theme for the retired names and find nothing; `tokens.test.ts` asserts the exact set; `pnpm docs:check` green.

**Depends on**: US1. T039 (the design bundle) must come last within this story, after T034–T038 are settled.

- [x] T034 [P] [US6] Edit `tests/unit/styles/tokens.test.ts` to assert the `:root` declaration set equals EXACTLY `SEVEN ∪ DERIVED` and `tests/unit/styles/acceptance-grep.test.ts` to compile `BANNED` with the `i` flag plus the retired alias families, and fix `tokens.test.ts`'s own case-sensitive `not.toContain` checks (research §8 — both files have the hole) (fails) then delete the legacy alias block from `app/globals.css` and the `/* legacy */` block from `tailwind.config.ts`; update `tests/unit/styles/tailwind-config.test.ts` to assert the legacy keys are absent <!-- retired-name -->
- [x] T035 [P] [US6] **Decision 1 — unranked challenges.** Write failing tests: `tests/contract/post-invite.contract.test.ts` (an invite-created match has `rated: false`), a queue-path test (`rated: true`), a rematch test (**a rematch inherits the source match's `rated`** — research §4), `tests/unit/lib/rating/**` (no rating update and no `match_ratings` row when `rated === false`), `tests/unit/lib/room/ledgerRows.spec.ts` (captions `unranked · round n of 10` and `unranked · 10 rounds · mm:ss`), `tests/unit/lib/constants/copy.spec.ts` (`HERE_NOW` contains `challenge for an unranked match`) — then implement per `contracts/rated-flag.md`: migration `supabase/migrations/<ts>_matches_rated.sql` (`rated boolean not null default true`), `rated?` on `MatchBootstrapInput` in `lib/matchmaking/service.ts`, `rated: false` in `respondToInvite`'s accept branch in `lib/matchmaking/inviteService.ts`, inheritance in `app/actions/match/requestRematch.ts` and `respondToRematch.ts`, `rated` on `MatchState` in `lib/types/match.ts` + its Zod schema + `lib/match/stateLoader.ts`, the rating guard in `app/actions/match/completeMatch.ts`, rated-aware captions in `lib/room/ledgerRows.ts`, and the copy edit. **If the team inverts the decision: skip this task and record it in T038.**
- [x] T036 [US6] **Decision 2 — `--opp-text`.** (Not `[P]`: shares `tokens.test.ts`, `app/globals.css` and `tailwind.config.ts` with T034 — run it after.) Write failing tests: `tokens.test.ts` (`--opp-text: #C2402A` joins the `SEVEN` map, not `DERIVED` — it is a raw hex and the "must alias a token" assertion would otherwise reject it, research §5; eight colour tokens total), `tests/unit/lib/constants/seatColors.spec.ts` (`getSeatColors("you").text` is `var(--you)`, `getSeatColors("opp").text` is `var(--opp-text)`), `Ledger.spec.tsx` (opponent words use `text`), `Field.spec.tsx` (the scored numeral on an opponent cell uses `text`) then add the token to `app/globals.css` and `tailwind.config.ts`, `text` to the `SeatColors` interface in `lib/constants/seatColors.ts`, and apply it in `components/room/Ledger.tsx`, `app/styles/room.css` (`.field__cell[data-state="scored"][data-seat="opp"] .field__value`) and `components/profile/ProfilePage.tsx`'s `vs` rows; remove the two coral selectors from `CONTRAST_EXCLUSIONS` in `tests/integration/ui/room-layout.spec.ts`, keeping `.ledger__row--future .ledger__round` and its justification comment, and assert the list has exactly one entry; change `CLAUDE.md`'s "Seven colour tokens" to "Eight colour tokens (`--opp-text` is text-only)"
- [x] T037 [P] [US6] Delete `lib/ui/tokens.ts`, `lib/ui/avatarGradient.ts` and their tests under `tests/unit/lib/ui/` once `grep -r "lib/ui/" app components lib` returns nothing; remove `lib/ui/` if empty. Separately: `git mv ds-bundle docs/archive/ds-bundle-warm-editorial`, recreate `ds-bundle/README.md` as the one-paragraph pointer, and add the entry to `docs/archive/README.md`. Separately: grep `timePerRoundMs` and remove it from `DEFAULT_GAME_CONFIG` in `lib/constants/game-config.ts` and `GameConfig` in `lib/types/**` if unused, else rename it to `matchClockBudgetMs` imported from `lib/room/clock.ts`; update its test
- [x] T038 [US6] Write failing test in `tests/unit/components/profile/ProfilePage.spec.tsx` (the chart `viewBox` width equals the measured container width; `preserveAspectRatio` is `xMinYMin meet`; axis labels keep `font-size: 11px`) then edit `components/profile/ProfileRatingChart.tsx` to measure its container with a ResizeObserver (the `useMeasuredLines` pattern) and set `viewBox="0 0 ${width} 180"`
- [x] T039 [US6] Update the design bundle in `docs/design_documentation/260914-wottle-new-design/` to the eight decisions: `WOTTLE_DESIGN_SYSTEM.md` §2 (eight tokens, the text-only rule), §4 (phone: caption + live row + territory; the sheet in flow below the live row, never over the field or bars), §5.1 (numeral `max(9px, 18%)`, hidden below 32px cells), §5.2 (one chevron per band — delete the two-chevron clause, cite rules §3.1), §5.3/§8/§9 (5:00, `ranked · 10 rounds · 5:00 clocks`, `aria-valuemax=300`), §6 (the 150ms exchange applies to preview and commit), §8 (`unranked` captions, or the ranked wording if decision 1 is inverted), §9 (remove the coral-under-17px exception); `WOTTLE_DESIGN_PLAN.md` §1.3, §4.3 (preview opt-in), §5, §12 (mark all eight decisions decided, with dates); copy `IMPLEMENTATION_REVIEW.md` into the folder and add both to `docs/design/README.md`; extend `scripts/docs/consistency-grep.sh` with a **second phrase list scoped to `docs/design_documentation/260914-wottle-new-design/**/*.md` only** (`10:00`, `ten-minute`, `two chevrons`, `preview by default`) — do not lift the folder-wide exclusion, the archived bundles must keep their retired words (research §7); add a pointer from `specs/044-field-ledger-redesign/spec.md`'s ranked-challenge clarification to this spec; `pnpm docs:check` green

---

## Phase 9: User Story 7 — Someone has looked at it (Priority: P3)

**Goal**: a person has compared every state with its figure, the baselines are committed and blocking, and the two-player suite has run once for real.

**Independent test**: `checklists/visual.md` is complete and signed; the 27 baselines are committed; the visual job passes in CI without a database.

**Depends on**: US2–US6 (it is the check they are measured by).

- [ ] T040 [US7] Create `specs/045-field-ledger-completion/checklists/visual.md` and tick every line for each phase at 1440×900 and 390×844: **Fig. 2 match** — bars 60px `1fr auto 1fr`, 12px seat square aligned with the field frame, clock 26px mono (ink 500 running / muted 400 stopped), total 40px in the seat colour, 4px lane on the bar's inner edge, paper field with 1px rules and a 1.5px frame, bands at 14% with 1.5px chevrons at the reading start, letters 55%, numerals top-right, ledger caption / seat header / ten rows sharing the height / full-width live row / territory / hint / foot, ledger top rule and foot aligned with the bars; **Fig. 5 phone** — bar 56 / field 358 / bar 56 / live row, no page scroll, sheet in flow; **Fig. 6 lobby** — `No opponent yet`, warm-up field, `here now` and `your last matches`; **Fig. 7 queue** — `Finding an opponent`, travelling 12% lane segment, live row `setting the field · n of 100 letters`; **Fig. 8 final** — verdict block above the header, rating lines in both bars, foot `rematch ▸ · new opponent ▸ · lobby`; **Fig. 9 profile** — 14px square, 28px name, 48px rating, hairline chart with unstretched labels; **Fig. 10 states** — landing input in the bar, disconnect dashed lane + `reconnecting · 0:42 left`. Record who compared what and when
- [x] T041 [US7] Commit the `toHaveScreenshot` baselines (`tests/integration/ui/room-fixtures.spec.ts-snapshots/`, chromium, 9 phases × 3 projects = 27 images); remove `continue-on-error` from the CI `visual` job; document `pnpm test:visual --update-snapshots` as the only way to change a baseline, with a screenshot in the PR

  **54 baselines, not 27:** Playwright suffixes a snapshot with the platform, and
  CI runs ubuntu while development here is macOS. Committing darwin images alone
  would have made the blocking job fail on its first push for a reason that has
  nothing to do with the room. The linux set was generated in
  `mcr.microsoft.com/playwright:v1.60.0-noble`, the image CI uses, and both sets
  pass without `--update-snapshots`.

  That cross-platform run also caught a test bug: the composition spec measured
  centring against `window.innerWidth`, but `scrollbar-gutter: stable` reserves
  15px that both `innerWidth` and `clientWidth` still count, so Linux reported a
  correctly centred room as 15px off. It now measures inside the room's own box,
  which is what "centred" means and is platform-independent.
- [x] T042 [US7] Run the Supabase-backed suite once end to end (`pnpm quickstart && pnpm exec playwright test`), axe clean on landing, lobby, queue, match, final and profile; record pass/fail per spec in this file and replace spec 044's "Not run locally: no Supabase" notes in `specs/044-field-ledger-redesign/tasks.md` with the run date and result

  **Run 2026-09-15, local Supabase (CLI 2.117.0, Docker), `pnpm dev` with
  `NEXT_PUBLIC_DISABLE_REALTIME=false`, rate limits off, `--workers=1`:**

  | Suite | Result |
  | --- | --- |
  | chromium, all specs except `@two-player-playtest` | **23 passed, 0 failed** (1.9 min) |
  | `playtest-firefox` `@two-player-playtest` (ten rounds) | **1 passed** (1.5 min) |
  | axe (`@room-layout`) | clean on landing, lobby, queue, match, final, profile — with **no coral exclusions**, which decision 2 removed |

  Four failures on the first attempt, none of them regressions in the room:
  - two were caused by `NEXT_PUBLIC_DISABLE_REALTIME=true` in the local
    `.env.local`. `onRematchEvent` is delivered only through the realtime
    channel — `useMatchTransport` returns early when `usePolling` — so the
    rematch notice can never arrive in polling mode. **A real gap in the
    polling fallback, filed below, not fixed here.**
  - one was my own run: the auth rate limit is enforced by the server, and I
    had set `RATE_LIMIT_DISABLE_ALL` on the test runner instead.
  - one was a genuine bug this run found: the phone lobby collapsed its ledger
    and hid the here-now directory behind `history ▸`. Fixed — only a ledger
    with a rounds table collapses.

  Three assertions were updated because they pinned behaviour this spec
  deliberately changed: the final caption (now `final · unranked · …` for the
  invite-created matches the suite uses), the queue progress (now a live row),
  and the winner's sub-line (now `unranked · no rating change` rather than a
  `rating pending` that would never resolve).

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Update `CLAUDE.md`: the Current State paragraph gains "completion (spec 045, <date>): fixture route `/dev/room`, `pnpm test:visual`, eight tokens"; the Testing section lists `pnpm test:visual`; `README.md`'s Testing section lists it too
- [ ] T044 Write the Outcome section of `specs/045-field-ledger-completion/spec.md`: which findings closed, which decisions were implemented as recommended and which inverted, and the date of the real run

---

## Dependencies

```
Setup (T001–T003)  ──►  Foundational (T004–T005)  ──►  US1 (T006–T010)
                                                          │
                                        ┌─────────────────┼─────────────────┐
                                        ▼                 ▼                 ▼
                                   US2 (T011–T017)   US5 (T028–T033)   US6 (T034–T039)
                                        │                 │                 │
                                        ▼                 │                 │
                                   US3 (T018–T022)        │                 │
                                        │                 │                 │
                                        ▼                 │                 │
                                   US4 (T023–T027)        │                 │
                                        └─────────────────┴─────────────────┘
                                                          ▼
                                                   US7 (T040–T042)
                                                          ▼
                                                  Polish (T043–T044)
```

- **US1 before everything** — the screenshots are the acceptance of US2–US6.
- **US2 before US3** — the gutter measurement assumes the field is its true size.
- **US3 before US4** — the phone ledger reuses the full-width live row.
- **US5 and US6 are independent of US2–US4** and may run in parallel with them.
- **T039 last within US6**, after T034–T038 are settled.
- **US7 last.**

## Parallel Execution Examples

**Foundational** — both views at once:

```
T004 (LobbyRoomView) ‖ T005 (QueueRoomView)
```

**US2** — after T011–T012 land, three independent files:

```
T013 (FieldBands.tsx) ‖ T015 (picking value) ‖ T016 (frozen round)
```

**US5** — after T028:

```
T029 (tapOutside) ‖ T030 (useRoomHotkeys) ‖ T032 (ClockLane)
```

**US6** — five independent files:

```
T034 (tokens) ‖ T035 (rated) ‖ T036 (--opp-text) ‖ T037 (numeral) ‖ T037 (dead weight)
```

**Three streams at once**, once US1 is done: one developer on US2 → US3 → US4, one on US5, one on US6.

## Implementation Strategy

**MVP = Setup + Foundational + US1.** The fixture route alone is worth shipping: it turns "looks right to me" into an artefact and is the direct fix for the review's root cause. Everything after it is judged by it.

**Then, in value order**: US2 (the field is the game, and the largest visible gap), US3 (highly visible, cheap), US4 (the phone is currently broken), US5 and US6 in parallel with them, US7 to close.

**Each story is one PR**, ending with `pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check` green and — from US2 on — the `/dev/room` screenshots at 1440×900, 1280×800 and 390×844 for every phase it touched.

**Do not restructure** `components/room/`, `lib/room/` or the room states beyond the two view extractions in T004–T005. The review's section 3 lists every value already checked and matched; SC-012 requires none of it to change.

## Estimates

Setup ¼ d (done) · Foundational ¼ d · US1 ½ d · US2 ½ d · US3 ½ d · US4 1 d · US5 1 d · US6 1 d · US7 1 d · Polish ¼ d — about 5½ days.
