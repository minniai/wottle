# Tasks: Field & Ledger Redesign

**Input**: Design documents from `/specs/044-field-ledger-redesign/` — `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Prerequisites**: Decisions Q1–Q3 are resolved in `spec.md` (5:00 clock, instant commit default + opt-in preview, placeholder queue board).

**Tests**: Included and mandatory — the constitution requires TDD (Red → Green → Refactor). Within every story, the test tasks come first and MUST fail before the implementation task that follows them. Commit each passing test separately (`test(scope): …`), never a failing one.

**Organization**: Phases 1–2 are shared infrastructure (design plan step P0 + the token/shell part of P1). Phases 3–13 are the eleven user stories in spec priority order. The design plan's steps map as: P1 → US1 + US5, P2 → US4, P3 → US2 + US3 + US6, P4 → US7 + US8 + US9, P5 → US10 + US11. Each phase ends with the two-player Playwright flow green and the acceptance greps for its retired components returning nothing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US11 from `spec.md`
- Every task names the exact file(s) it creates or edits

## Path Conventions

Single Next.js app at the repository root: `app/`, `components/`, `lib/`, `tests/{unit,integration,contract,perf}/`. New folders: `app/(room)/`, `components/room/`, `lib/room/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, copy module, and the shared pure helpers every story reads.

- [x] T001 Add `@axe-core/playwright` as a dev dependency in `package.json` (pnpm) and add the `perf:preview-swap` script mirroring `perf:instant-scoring`
- [x] T002 [P] Create `lib/constants/copy.ts` exporting every fixed string from design system §8 with the 5:00 substitutions (`ranked · 10 rounds · 5:00 clocks`, `No opponent yet`, `Finding an opponent`, `picking · {letter} ({value})`, `played ●`, `tap a second letter`, `tap again to play`, `frozen · {name} R{n} · pick another`, `reconnecting · {mmss} left`, `{name} asks for a rematch · accept ▸ · decline`, `resign the match? · yes, resign ▸ · no`, `rating pending`, first-match sentence) as functions/constants; unit test `tests/unit/lib/constants/copy.spec.ts` asserts no `!` and lowercase `wottle`
- [x] T003 [P] Write failing test `tests/unit/lib/constants/seatColors.spec.ts` (resolveSeat for both viewer slots; getSeatColors returns `var(--you)`/`var(--opp)` + `-band`/`-live` refs) then create `lib/constants/seatColors.ts` per data-model §3.2
- [x] T004 [P] Write failing test `tests/unit/lib/game-engine/boardGenerator.pure.test.ts` (same seed → same grid; every alphabet letter present; `diffBoards` returns only differing coordinates; module has no `node:` imports) then move `scripts/supabase/generateBoard.ts` to `lib/game-engine/boardGenerator.ts` with a required `seed`, add `diffBoards`, and make `scripts/supabase/generateBoard.ts` a re-export that supplies `randomUUID()`; update `lib/match/stateLoader.ts` import
- [x] T005 [P] Write failing test `tests/unit/lib/room/clock.spec.ts` (`isLowClock(59_999)` true / `60_000` false; `formatClock`; `laneFraction(ms, 300_000)` clamps 0–1) then create `lib/room/clock.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Design plan step P0 (contract changes) plus the token/font/route-group shell that every story renders into. No user story work starts before this phase is green.

**⚠️ CRITICAL**: T006–T019 are the only server-side changes in the whole feature; all are additive.

### Contracts (design plan §1, research R1, R2, R3, R13, R14)

- [ ] T006 Write failing test `tests/unit/lib/game-engine/readingDirection.test.ts` (ltr/rtl/ttb/btt from two coordinates; throws `InvalidWordGeometryError` on <2 coords or diagonal step) then create `lib/game-engine/readingDirection.ts` and add `ReadingDirection` + `WordScore.direction?` to `lib/types/match.ts`
- [ ] T007 Write regression test `tests/unit/lib/game-engine/doubleReading.test.ts` — a run valid both ways (`fár`/`ráf`) produces **one** `WordScoreBreakdown` (forward reading, ltr tiles); a reverse-only word keeps reversed tile order; a single-direction run produces one — against `lib/game-engine/wordEngine.ts` (test only; pins current behaviour, rules §3.1)
- [ ] T008 [P] Write failing regression test `tests/unit/lib/game-engine/wholeRun.bordaGilt.test.ts` — frozen horizontal `BORÐA` cols 1–5, new `GILT` cols 6–9 rejected by `violatesFrozenAdjacencyOnSameAxis` when the dictionary lacks `borðagilt` (test only) and add the case to `docs/prd_and_requirements/wottle_game_rules.md` §10 change log as "pinned 2026-09"
- [ ] T009 Write failing test `tests/unit/lib/match/wordScoreRow.test.ts` (row with `tiles` → `WordScore` with `direction`; legacy row without tiles order still maps) then create `lib/match/wordScoreRow.ts` (`mapWordScoreRow`) and use it in `lib/match/stateLoader.ts` (`mapWordScores`), `app/actions/match/publishRoundSummary.ts`, `app/api/match/[matchId]/rounds/[round]/summary/route.ts`, `app/match/[matchId]/summary/page.tsx`
- [ ] T010 Extend `wordScoreSchema` in `lib/match/schemas.ts` with `direction: z.enum([...]).optional()` and update `tests/unit/match/schemas.partialRoundSummary.spec.ts` fixture to include `direction`
- [ ] T011 Write failing test `tests/unit/lib/match/stateLoader.disconnectedAt.test.ts` (when `disconnectedPlayerId` is set, `MatchState.disconnectedAt` equals the store/heartbeat timestamp and `reconnectWindowMs === 90_000`) then add the two optional fields to `MatchState` in `lib/types/match.ts` and emit them in `lib/match/stateLoader.ts`
- [ ] T012 Write failing unit test `tests/unit/app/actions/previewSwap.spec.ts` (stub dictionary: match variant prices `words` + `total`, rejects frozen tile, `unauthenticated` without session for **both** variants; warm-up variant validates board shape and alphabet; result has `direction` per word) then create `app/actions/match/previewSwap.ts` per `contracts/preview-swap.md` (Zod discriminated union, `assertWithinRateLimit({ scope: "match:preview-swap" })`, pipeline `applySwap → scanFromSwapCoordinates → selectOptimalCombination → scoreBoardWords`, structured log `preview-swap.priced`)
- [ ] T013 Register scope `match:preview-swap` (60/min, key = player id) in `lib/rate-limiting/middleware.ts` (or its scope table) and add a case to `tests/unit/lib/rate-limiting/*.spec.ts`
- [ ] T014 Write failing contract test `tests/contract/preview-swap.contract.test.ts` against `specs/044-field-ledger-redesign/contracts/preview-swap.openapi.yaml` then create `app/api/match/preview/route.ts` (POST wrapper returning 200/400/401/403/429 with `Retry-After`)
- [ ] T015 Write failing integration test `tests/integration/match/previewSwap.spec.ts` (real Supabase: match variant reads the authoritative board; `word_score_entries` row count unchanged before/after; `matches.frozen_tiles` unchanged) — runs against T012/T014
- [ ] T016 [P] Create `tests/perf/preview-swap.yml` (Artillery, 20 rps, p95 < 200 ms) wired to the `perf:preview-swap` script from T001
- [ ] T017 Write failing test `tests/unit/preferences/preferencesStore.spec.ts` (defaults `sound: true, haptics: true, preview: false`; legacy stored object without `previewEnabled` reads as `false`; two subscribers see one toggle) then create `lib/preferences/preferencesStore.ts` (zustand, key `wottle-sensory-prefs`), rename `SensoryPreferences` → `PlayerPreferences` in `lib/types/preferences.ts`, and make `lib/preferences/useSensoryPreferences.ts` a thin selector over the store (existing tests in `tests/unit/preferences/` stay green)

### Tokens, fonts, shell (design plan §2, §3; research R4, R5, R7)

- [ ] T018 Write failing test `tests/unit/styles/tokens.test.ts` (exactly `--paper --ink --rule --tint --muted --you --opp` + `--you-band --you-live --opp-band --opp-live --future-label --font-board --font-mono` declared on `:root`; the seven hex values match design system §2; no `--p1/--p2/--ochre/--shadow-*`) then rewrite `app/globals.css`; delete `tests/unit/styles/{globals,board-css,lobby-css,hud-card-css,board-letterpress,board-static-highlight,frozen-tile-visibility,match-layout-css}.test.ts`
- [ ] T019 Write failing test `tests/unit/styles/tailwind-config.test.ts` (colors keys exactly paper/ink/rule/tint/muted/you/opp; fontFamily `board` + `mono`; `borderRadius.DEFAULT === "0"`; no `boxShadow`) then rewrite `tailwind.config.ts`
- [ ] T020 Replace `Fraunces`/`JetBrains_Mono` with `Zilla_Slab` (500/600/700) and `Red_Hat_Mono` (400/500/600), subsets latin + latin-ext, variables `--font-board`/`--font-mono`, in `app/layout.tsx`; remove `<TopBar />` and the `lobby.css`/`profile.css` imports; import `app/styles/room.css`
- [ ] T021 [P] Create `app/styles/room.css` skeleton: `.room` grid (design system §4 breakpoints 1100/900), `.room__stack`, `.room__field-slot` sized by `--field-size`, `.player-bar`, `.field`, `.ledger` placeholders, `@keyframes` (`field-shake`, `band-draw`, `count-up`, `lane-blink`, `letter-land`) and the `prefers-reduced-motion` block; delete `app/styles/matchmaking.css`
- [ ] T022 Write failing test `tests/unit/styles/acceptance-grep.test.ts` that scans a configurable folder list for `rounded-|shadow-|gradient|emerald|red-|amber|Fraunces|Inter\b|JetBrains` and initially scopes it to `app/globals.css`, `app/layout.tsx`, `app/styles/`, `components/room/` (widen in later phases)
- [ ] T023 Write failing test `tests/unit/lib/room/roomStore.spec.ts` (phase transitions `lobby→queue→found→match→final→lobby`, `queue→lobby` on cancel, `board` reference survives every transition, `connection` flag) then create `lib/room/roomStore.ts` (zustand `RoomState` per data-model §3.1 with `hydrateMatch(state)`, `setPhase`, `applySnapshot`, `applySummary`)
- [ ] T024 Create route group `app/(room)/layout.tsx` (reads `readLobbySession()` once, renders `<RoomShell session>{children}</RoomShell>`), move `app/(landing)/page.tsx` → `app/(room)/page.tsx`, `app/(lobby)/lobby/page.tsx` → `app/(room)/lobby/page.tsx`, `app/matchmaking/page.tsx` → `app/(room)/matchmaking/page.tsx`, `app/match/[matchId]/page.tsx` → `app/(room)/match/[matchId]/page.tsx`; delete `app/(landing)/layout.tsx`, `app/(lobby)/layout.tsx`, `app/matchmaking/layout.tsx`, `app/match/[matchId]/loading.tsx`; pages keep their current children for now
- [ ] T025 Create `components/room/RoomShell.tsx` (client; mounts `roomStore`, owns the match channel subscription + 2 s safety poller lifted from `components/match/MatchClient.tsx`, sets `connection`) and `components/room/Room.tsx` rendering `data-testid="room" data-phase` with four slots; write `tests/unit/components/room/Room.spec.tsx` (renders slots per phase; `data-phase` reflects store)
- [ ] T026 [P] Create `components/room/hooks/useReducedMotion.ts`, `useFieldSize.ts` (ResizeObserver → `min(h − 2·bar − 24 − 48, 720)`), `useClockTick.ts` (1 s tick of both `TimerState`s) with unit tests `tests/unit/components/room/hooks.spec.tsx`

**Checkpoint**: Contracts live and additive; tokens/fonts/shell in place; two-player Playwright flow still green with the old match UI rendered inside `Room`.

---

## Phase 3: User Story 1 — Read the match at a glance from the room (Priority: P1) 🎯 MVP

**Goal**: Opponent bar / field / your bar + ledger column, nothing over the field, no scrolling at the three reference sizes, no top bar.

**Independent Test**: `pnpm exec playwright test tests/integration/ui/room-layout.spec.ts` at 1440×900, 1280×800 (field ≥ 560 px), 390×844; `player-bar-top` above `field` above `player-bar-bottom`; `ledger` top aligned with the top bar and foot flush with the bottom bar; no element's box intersects the field's box; `topbar` test id absent.

- [ ] T027 [P] [US1] Write failing Playwright spec `tests/integration/ui/room-layout.spec.ts` (three viewports; stack order; ledger alignment ±2 px; overlap check over `[data-testid=field]`; no vertical scroll; `topbar` absent; ≤ 260 px ledger at 1000 px width)
- [ ] T028 [P] [US1] Write failing component test `tests/unit/components/room/PlayerBar.spec.tsx` (states empty/searching/found/playing/final; name + subline + score; `player-bar-lane` role/aria per contracts; disconnected dashed lane; low clock class) then create `components/room/PlayerBar.tsx` + `components/room/ClockLane.tsx` per `contracts/room-components.md`, styles in `app/styles/room.css`
- [ ] T029 [P] [US1] Write failing component test `tests/unit/components/room/Field.spec.tsx` (100 `role=gridcell` cells with `aria-label="row 8, column F, T, value 2, free"`; value numeral; frozen cells `data-state=frozen` with seat colour; `disabled` blocks clicks) then create `components/room/Field.tsx` + `components/room/FieldCell.tsx` (static cells, letter 55 % / numeral 18 %, 1 px rules, 1.5 px frame; no bands or interaction yet)
- [ ] T030 [US1] Write failing component test `tests/unit/components/room/Ledger.spec.tsx` (caption `wottle` + context; `ledger-foot` with `? rules` and `ledger-menu`; variant `match` renders header) then create `components/room/Ledger.tsx`, `components/room/LedgerFoot.tsx`, `components/room/RoomMenu.tsx` (⋯ menu: sound, preview, profile, sign out | sound, resign, leave — wired to `preferencesStore`, `logoutAction`, `resignMatch` via `onAction`)
- [ ] T031 [US1] Wire `Room.tsx` for `phase: match`: map `roomStore.match` → two `PlayerBar`s (opponent top via `resolveSeat`), `Field` with board + frozen tiles, `Ledger` caption `ranked · round n of 10`; delete the old HUD/rail/panel rendering from `components/match/MatchClient.tsx` and render it only as a temporary logic host (no visible chrome)
- [ ] T032 [US1] Create `components/room/LedgerSheet.tsx` (below 900 px: live row under the bottom bar opens a focus-trapped sheet using `lib/a11y/useFocusTrap.ts`) with test `tests/unit/components/room/LedgerSheet.spec.tsx`; add `.ledger-sheet` styles
- [ ] T033 [US1] Delete `components/match/{HudCard,PlayerPanel,PlayerAvatar,TimerDisplay,MatchCenterChrome,RoundPipBar,MatchShell}.tsx`, `components/ui/{TopBar,UserMenu,LogoutConfirmDialog}.tsx` and their tests; delete `tests/integration/ui/{hud-classic,match-surfaces,theme-flip}.spec.ts`; widen T022 grep to `components/match/`
- [ ] T034 [US1] Update `docs/design/README.md` and `CLAUDE.md` component list to mark P1 retirements done; run `pnpm lint && pnpm typecheck && pnpm test:unit` and the two-player flow

**Checkpoint**: The match renders as bar / field / bar + ledger. MVP demonstrable.

---

## Phase 4: User Story 2 — Pick and commit a swap, with optional preview (Priority: P1)

**Goal**: Instant commit by default; opt-in preview with server pricing; Esc/tap-outside cancels; frozen/pinned tap shakes + live-row notice; opponent pin clears a pick; keyboard operation.

**Independent Test**: `tests/unit/lib/room/fieldInteraction.spec.ts` green; `tests/integration/ui/room-flow.spec.ts` "pick → commit", "preview on: pick → preview → commit", "Esc reverses a preview", "opponent pin during preview" green.

- [ ] T035 [P] [US2] Write failing reducer tests `tests/unit/lib/room/fieldInteraction.spec.ts` covering every rule in data-model §3.3 (default commit on second tap; preview when `previewEnabled`; third tap/Enter commits; tap A again → idle; escape/tapOutside → idle; frozen/pinned tap → `shake` + notice, state unchanged; `opponentPinned` covering a/b → idle + notice; drag = second tap; `priced` fills the preview price) then create `lib/room/fieldInteraction.ts`
- [ ] T036 [P] [US2] Write failing test `tests/unit/lib/room/notices.spec.ts` (frozen notice expires after 2 s; resign confirm expires after 5 s; at most one frozen/pickCleared notice) then create `lib/room/notices.ts`
- [ ] T037 [US2] Write failing component tests in `tests/unit/components/room/Field.interaction.spec.tsx` (picked state class + `scale`; preview exchange renders letters swapped with dotted rings; committed dashed rings in seat colour; shake class for 300 ms; keyboard arrows move focus, Space picks, Enter commits, Escape cancels) then implement in `components/room/Field.tsx` / `FieldCell.tsx` (dispatch `FieldEvent`s via `onEvent`, roving focus with `lib/a11y/rovingFocus.ts`)
- [ ] T038 [US2] Wire effects in `components/room/RoomShell.tsx`: `submit` → `POST /api/match/[id]/move` (moved from `BoardGrid.handleSwap`, keep optimistic revert on error); `requestPrice` → `previewSwap({ kind: "match" })` once, hint line `tap again to play` until priced; `soundPick/soundCommit/haptic` → `lib/audio/useSoundEffects.ts` / `lib/haptics/useHapticFeedback.ts`; `shake`/notice → `roomStore`
- [ ] T039 [US2] Feed opponent `pendingMoves` and `partialSummary.frozenTiles` from `roomStore` into `Field` `oppPins`/`frozenTiles` and dispatch `opponentPinned` / frozen transitions (port the dedupe keys `${playerId}-${submittedAt}` and `buildPartialRevealKey` from `MatchClient.tsx`); aria-live announcement moves to `ledger-live-row`
- [ ] T040 [US2] Write failing Playwright spec `tests/integration/ui/room-flow.spec.ts` (two players via `helpers/matchmaking.ts`): default second tap commits; toggle preview in `ledger-menu` → second tap previews, hint shows a total or `tap again to play`, Esc reverses, third tap commits; opponent pin arriving during a preview clears it and the live row explains; frozen tap shakes and writes `frozen · … · pick another`
- [ ] T041 [US2] Delete `components/game/{BoardGrid,Board,BoardCoordLabels,MoveFeedback}.tsx`, `components/game/usePinchZoom.ts`, `components/game/README.md`, their unit tests, and `tests/integration/ui/{board-grid,board-ui,swap-feedback,swap-flow}.spec.ts`; remove `.board-grid*`, `.board-coords*`, `.match-layout*` from `app/styles/board.css` (file deleted when US6 lands); widen T022 grep to `components/game/`
- [ ] T042 [US2] Update `docs/prd_and_requirements/wottle_prd.md` §1.3 and `CLAUDE.md` "Example: Full Move Submission Flow" to the Field event flow

**Checkpoint**: Swaps work through the new field in both modes; the old board is gone.

---

## Phase 5: User Story 3 — See words, not tiles (Priority: P2)

**Goal**: One band per scored word record with a chevron at the reading start (one record per run, so one chevron); both bands at crossings; shared letters in ink; row hover dims other bands.

**Independent Test**: `tests/unit/lib/room/bandGeometry.spec.ts` + `tests/unit/components/room/FieldBands.spec.tsx` green; fixture match state renders `field-band[data-direction]` for all four directions and two bands on a FÁR/RÁF run.

- [ ] T043 [P] [US3] Write failing tests `tests/unit/lib/room/bandGeometry.spec.ts` (rect for horizontal/vertical runs in percent units with 20 % short-axis / 5 % long-axis insets; chevron edge per direction; clipping to frozen subset for partial freezes; `bandsFromWords(words, frozenTiles, viewerSlot, round)` builds `WordBand[]` with stable ids and falls back to `deriveReadingDirection` when `direction` is absent) then create `lib/room/bandGeometry.ts`
- [ ] T044 [US3] Write failing component test `tests/unit/components/room/FieldBands.spec.tsx` (one `<rect>` + one chevron `<path>` per band; `data-seat`, `data-direction`, `data-round`; `dimmed` opacity when `highlightRound` set elsewhere; `strength` live vs settled classes) then create `components/room/FieldBands.tsx` (single `<svg>` sibling under the cells, `pointer-events:none`, ≤ 60 lines)
- [ ] T045 [US3] Extend `components/room/FieldCell.tsx` + test: letters inside a band take the scorer's seat colour, numerals too; a cell in bands of both seats renders `--ink` at 700 (`data-state=shared`)
- [ ] T046 [US3] Accumulate `WordBand[]` in `lib/room/roomStore.ts` from `lastSummary.words` + `partialSummary.words` (dedupe by band id, cleared on rematch) and pass to `Field`; test in `tests/unit/lib/room/roomStore.bands.spec.ts` including a reversed-reading word producing a right/bottom-edge chevron
- [ ] T047 [US3] Add "bands" section to `tests/integration/ui/room-flow.spec.ts`: after a scored round, `field-band` count equals ledger word count (one per record) and the chevron edge matches `data-direction`
- [ ] T048 [US3] Delete `components/match/{WordHighlightOverlay,deriveHighlightPlayerColors,derivePostGameHighlightColors}.ts(x)`, `lib/match/currentRoundScored.ts`, `lib/constants/playerColors.ts`, `lib/match/selfColorStore.ts` and their tests (`tests/unit/match/currentRoundScored.spec.ts`, `tests/unit/components/BoardGrid.*.spec.tsx`); update `docs/prd_and_requirements/wottle_game_rules.md` §12 if any rendering detail changed

---

## Phase 6: User Story 4 — Follow the match in the ledger (Priority: P2)

**Goal**: Caption, seat header, ten equal rows, live row states, per-word points, fold rule, territory, hint, notices as lines (rematch, resign, first match), row hover → band highlight.

**Independent Test**: `tests/unit/lib/room/ledgerRows.spec.ts` + `tests/unit/components/room/Ledger.spec.tsx` green; in a two-player match after three rounds, `ledger-row-1..3` show words/totals, `ledger-row-4` is `ledger-live-row`, rows 5–10 show labels only.

- [ ] T049 [P] [US4] Write failing tests `tests/unit/lib/room/ledgerRows.spec.ts` (`buildLedgerRows` from `MatchState` + accumulated summaries: past/live/future, per-seat `WordCell`s with `isDuplicate`, totals; live text `picking · T (2)` / `played ●`; `foldRows` collapses rounds older than the last three when any row > 3 lines; `territory` counts from `FrozenTileMap`; `buildVerdict` produces `Kári wins 170–127` / `by 43 points · 10 words to 8 · territory 32–25` and a draw line) then create `lib/room/ledgerRows.ts`
- [ ] T050 [US4] Write failing component tests in `tests/unit/components/room/Ledger.rows.spec.tsx` (header `■ Birna · you` / `■ Kári`; grid `34px 1fr 1fr`; ten rows share height; words joined by ` · ` in seat colour; total top-right; future labels use `--future-label`; live row `--tint` + 3 px left rule + `aria-live=polite`; hover row calls `onRowHover(n)` and shows per-word points; territory bar proportions + counts; hint line) then create `components/room/LedgerRow.tsx`, `components/room/LedgerLiveRow.tsx` and extend `components/room/Ledger.tsx`
- [ ] T051 [US4] Create `components/room/hooks/useMeasuredLines.ts` (offsetHeight ÷ line-height per row) with test, and apply `foldRows` in `Ledger.tsx`
- [ ] T052 [US4] Render `Notice[]` from `roomStore` as live-row-styled lines in `Ledger.tsx` (rematch request with `accept ▸ · decline`, resign confirmation with 5 s revert, first-match rules sentence, frozen/pickCleared, claim-win) with tests in `tests/unit/components/room/Ledger.notices.spec.tsx`; `RoomMenu` "resign" now pushes a `resignConfirm` notice instead of opening a dialog
- [ ] T053 [US4] Wire `onRowHover` → `Field.highlightRound` in `Room.tsx`; show the `firstMatchRules` notice when the viewer's `PlayerStats.gamesPlayed === 0` (pass `viewerGamesPlayed` from `app/(room)/match/[matchId]/page.tsx` via `loadMatchPlayerProfiles`/`getPlayerProfile` into `roomStore`); no device flag; `? rules` re-shows it as a notice; test in `tests/unit/lib/room/notices.spec.ts`
- [ ] T054 [US4] Add "ledger" section to `tests/integration/ui/room-flow.spec.ts` (rows fill per round; live row text transitions; resign flow via `ledger-menu` → confirmation line → `no` reverts)
- [ ] T055 [US4] Delete `components/match/{MatchLeftRail,HowToPlayCard,LegendCard,YourMoveCard,ScoredWordsCard,TilesClaimedCard,ScoreDeltaPopup,RoundSummaryPanel,RoundHistoryPanel,deriveScoreDelta,deriveRoundHistory,deriveCallouts}.ts(x)` and tests, `tests/integration/ui/{left-rail,round-summary,round-history}.spec.ts`; remove the resign dialog + `historyOpen` code from `MatchClient.tsx`; widen T022 grep

---

## Phase 7: User Story 5 — Clocks as two lengths on one scale (Priority: P2)

**Goal**: Lanes on both bars sized to the 5:00 budget, stop on submit, thicken + blink under 1:00, dashed + held on disconnect with a counting sub-line; `role=progressbar` semantics.

**Independent Test**: `tests/unit/components/room/PlayerBar.clock.spec.tsx` green; in Playwright, after A submits, `player-bar-bottom [data-testid=player-bar-lane]` width stops changing while the top lane keeps draining; `aria-valuemax="300"`.

- [ ] T056 [P] [US5] Write failing tests `tests/unit/components/room/PlayerBar.clock.spec.tsx` (lane width = `laneFraction`; running numeral `--ink` 500 vs stopped `--muted` 400; `< 60_000` → `player-bar-lane--low` 8 px + blink class, solid under reduced motion; disconnected → dashed class + subline `reconnecting · 1:29 left` from `disconnectedAt + reconnectWindowMs`; `aria-valuenow` seconds, `aria-valuetext="6:45 remaining, running"`) then implement in `components/room/ClockLane.tsx` / `PlayerBar.tsx`
- [ ] T057 [US5] Feed `MatchState.timers` through `useClockTick` in `Room.tsx`; hold both clocks while `disconnectedPlayerId` is set; add claim-win notice to `roomStore` when `now − disconnectedAt ≥ reconnectWindowMs` and wire `claimWinAction` to the ledger line (port status handling from `MatchClient.handleClaimWin`)
- [ ] T058 [US5] Reduce `components/match/deriveClockUrgency.ts` to a re-export of `lib/room/clock.ts` `isLowClock` and then delete it with `tests/unit/components/deriveClockUrgency*.spec.ts`; delete `components/match/{DisconnectionModal,useCountdown}.ts(x)` + tests and `tests/integration/ui/disconnect-modal.spec.ts`; rewrite `tests/integration/ui/reconnect-flow.spec.ts` against `player-bar-subline` + `ledger-notice`
- [ ] T059 [US5] Append an Outcome note to `docs/superpowers/specs/2026-06-18-prominent-match-timers-design.md` confirming the numeral weight decision and update `docs/superpowers/plans/2026-04-22-phase-6-disconnect-modal.md` superseded note with the replacing notice

---

## Phase 8: User Story 6 — The reveal: five beats, one signal each (Priority: P2)

**Goal**: Bands draw sequentially (400 ms, 120 ms stagger) at 30 %, words written into the live row per band, totals count up, then settle (pins fade, 14 %, territory, next row); first-mover partial reveal uses the same choreography; reduced motion → end state.

**Independent Test**: `tests/unit/lib/room/revealSequence.spec.ts` + `tests/unit/components/room/hooks.useReveal.spec.tsx` green; Playwright: after resolution, `field-band[data-strength=live]` count increases one at a time and `ledger-live-row` gains one word per band; with `reducedMotion: "reduce"` the end state is immediate.

- [ ] T060 [P] [US6] Write failing tests `tests/unit/lib/room/revealSequence.spec.ts` (`planReveal(3 words)` → band at 0/520/1040 ms, writes at band end, countUp after last band, settle +200 ms; empty words → settle only; `reducedMotion` → single `settle` at 0; `alreadyDrawn` band ids get no band/write step and the count-up delta excludes their points — no band ever draws twice) then create `lib/room/revealSequence.ts`
- [ ] T061 [US6] Write failing hook test `tests/unit/components/room/hooks.useReveal.spec.tsx` (fake timers; progress counters advance per step; cancels on key change) then create `components/room/hooks/useReveal.ts`
- [ ] T062 [US6] Drive `FieldBands` `drawnCount`/`strength`, `LedgerLiveRow` written words, `PlayerBar` count-up (`useCountUp` in `components/room/hooks/useReveal.ts`), pin fade and next-row open from `useReveal` in `Room.tsx`; keys: `roundNumber` for `lastSummary`, `buildPartialRevealKey` for `partialSummary`; play `playWordDiscovery` tick per band
- [ ] T063 [US6] Add `band-draw` (transform scale from reading start via `transform-origin` per direction), `count-up`, `pin-fade` CSS in `app/styles/room.css` with reduced-motion zeros; unit test `tests/unit/styles/room-css.test.ts` asserts only `transform`/`opacity` are animated
- [ ] T064 [US6] Add "reveal" section to `tests/integration/ui/room-flow.spec.ts` incl. a `reducedMotion: "reduce"` project run
- [ ] T065 [US6] Remove `animationPhase`, `roundAnnounce`, recap timers, `playWordDiscovery` wiring and the remaining rendering from `components/match/MatchClient.tsx` so it only exports the logic hooks still in use; delete `app/styles/board.css`, `.round-announce`, `.score-delta-popup`, `.timer-display*`, `lib/match/partialReveal.ts` consumers moved to `roomStore`; delete `tests/integration/ui/{scoring-resolution-viz,rounds-flow,sensoryFeedback}.spec.ts` after porting their assertions into `room-flow.spec.ts`
- [ ] T066 [US6] Update `specs/043-scoring-resolution-viz/SUPERSEDED.md` and `specs/015-sensory-feedback/SUPERSEDED.md` with the replacing hook names

---

## Phase 9: User Story 7 — Landing and lobby are one room (Priority: P3)

**Goal**: Landing = lobby room with an empty bottom seat (name input, `play ▸`), warm-up field with pick/(preview) and no scoring, `LobbyLedger` (here now with `challenge ▸`, last matches), sign-in converts the bar in place.

**Independent Test**: Playwright: open `/` signed out → `player-bar-name-input` visible, `field` present; pick two letters → letters swap locally, no `/api/match/*/move` request; enter name → bar shows name/rating with the same `field` element identity and no full navigation.

- [ ] T067 [P] [US7] Write failing test `tests/unit/components/room/NameInput.spec.tsx` (underlined input, placeholder `your name`, submit on Enter/`play ▸`, error line for invalid names) then create `components/room/NameInput.tsx` calling `loginAction` via `useActionState`
- [ ] T068 [P] [US7] Write failing test `tests/unit/components/room/LobbyLedger.spec.tsx` (`ledger-here-now` rows name/rating/±/`challenge ▸`; `ledger-last-matches` rows opponent/score/±; `—` rows while loading; hint in live row) then create `components/room/LobbyLedger.tsx`
- [ ] T069 [US7] Extend `lib/room/roomStore.ts` for `phase: lobby`: warm-up board from `generateBoard({ seed })`, local swap on commit (no submit), `previewSwap({ kind: "warmup" })` only when preview is on **and** `viewer` is signed in (signed out: hint `tap a second letter`, no request); presence list lifted from `lib/matchmaking/presenceStore.ts` (connect/disconnect in `RoomShell`); tests in `tests/unit/lib/room/roomStore.lobby.spec.ts`
- [ ] T070 [US7] Implement `app/(room)/page.tsx` and `app/(room)/lobby/page.tsx` to hydrate the store with `session?.player`, `fetchLobbySnapshot()`, `getRecentGames()`; after `loginAction` success set `viewer` in the store and `router.replace("/lobby")` (no `router.refresh()`); top bar `state: empty` with `play ranked ▸` disabled until signed in
- [ ] T071 [US7] Wire `challenge ▸` → `sendInviteAction` and incoming invites (poll `/api/lobby/invite` from `RoomShell`, 3 s) as a ledger notice `<name> challenges you · accept ▸ · decline` → `respondInviteAction`; `/api/match/active` poll → `hydrateMatch` + `router.replace('/match/{id}')`
- [ ] T072 [US7] Write failing Playwright spec section in `tests/integration/ui/room-flow.spec.ts` "landing" (name entry without navigation; warm-up swap sends no move request and, signed out, no preview request; challenge notice between two players) and rewrite `tests/integration/ui/lobby-presence.spec.ts` + `lobby-logout.spec.ts` against the ledger
- [ ] T073 [US7] Delete `components/landing/`, `components/lobby/`, `lib/lobby/heroWords.ts`, `lib/constants/lobby.ts` hero constants, `components/ui/{Toast,ToastProvider}.tsx`, `app/styles/lobby.css`, tests `tests/integration/ui/{landing,lobby-finish,lobby-visual}.spec.ts` and the lobby component unit tests; remove `ToastProvider` from `app/layout.tsx`; widen T022 grep

---

## Phase 10: User Story 8 — Queue and opponent found stay in the room (Priority: P3)

**Goal**: `play ranked ▸` → searching bar with travelling lane segment and `cancel ▸`; placeholder letters land ~100 ms apart with a counting live row; matched → opponent name writes in, lane fills, `round 1 in 3 · 2 · 1`, match phase with no route flash.

**Independent Test**: Playwright two players press `player-bar-action` → `player-bar-top` reads `Finding an opponent`; `field-cell` letters populate over time; then the opponent's name appears and `data-phase` becomes `match` while the `field` element identity is unchanged.

- [ ] T074 [P] [US8] Write failing test `tests/unit/lib/room/useMatchmaking.spec.ts` (start → poll `startQueueAction` every 3 s → matched → `getMatchOverviewAction` → found; cancel → `cancelQueueAction`; elapsed counter) then create `lib/room/useMatchmaking.ts` from the logic in `components/matchmaking/MatchmakingClient.tsx`
- [ ] T075 [US8] Extend `lib/room/roomStore.ts` + test `tests/unit/lib/room/roomStore.queue.spec.ts`: `phase: queue` seeds a placeholder board (`queue:${playerId}:${startedAt}`), `lettersLanded` advances on a timer (0 ms under reduced motion), live row `setting the field · n of 100 letters`; on match state fetch, `diffBoards` swaps only differing cells; `found.countdown` 3→2→1 then `phase: match`
- [ ] T076 [US8] Implement searching/found rendering: `PlayerBar` `state: searching` (`ranked · 0:07 · cancel ▸`, 12 %-wide coral segment travelling the lane at 1 cycle/3 s via `lane-search` keyframe) and `state: found` (name write-in 200 ms, lane fills, countdown subline); `letter-land` per cell; ledger `variant: queue` caption + foot `cancel ▸`; tests in `tests/unit/components/room/PlayerBar.queue.spec.tsx`
- [ ] T077 [US8] Implement `app/(room)/matchmaking/page.tsx` (hydrates `phase: queue`) and make `play ranked ▸` set the phase + `router.replace("/matchmaking")`; on found `router.replace('/match/{id}')` without unmounting; `app/(room)/match/[matchId]/page.tsx` hydrates `match` and detects `phase: final` when `state === "completed"`; for a signed-in non-participant it hydrates `final` read-only (`viewerSlot: null`, actions hidden) when completed and `redirect("/lobby")` when live; signed out → `redirect("/")` — unit test `tests/unit/app/roomMatchPage.guard.spec.tsx` (FR-043a)
- [ ] T078 [US8] Add "queue → found → match" section to `tests/integration/ui/room-flow.spec.ts` (field identity check for SC-008; cancel returns to lobby) and delete `tests/integration/ui/{matchmaking,matchmaking-phase-4b}.spec.ts`
- [ ] T079 [US8] Delete `components/matchmaking/` and its tests; widen T022 grep

---

## Phase 11: User Story 9 — The result is stated once, in the same room (Priority: P3)

**Goal**: Final phase keeps the field with all bands; bars show totals + `old → new · ±n · wins` or `rating pending`; ledger verdict block, all rows, territory, rematch notice, actions `rematch ▸ · new opponent ▸ · lobby`; verdict announced once.

**Independent Test**: Playwright: complete or resign a match → `verdict` text matches `/^\S+ wins \d+–\d+$|^draw/`, `player-bar-subline` shows a rating line or `rating pending`, `field-band` count unchanged, `ledger-notice` shows the rematch request in the other window; no navigation to `/summary`.

- [ ] T080 [P] [US9] Write failing tests `tests/unit/lib/room/ledgerRows.final.spec.ts` (verdict for win/loss/draw incl. `by n points · w words to w · territory a–b`; rating sublines from `match_ratings` rows; `rating pending` when absent) then extend `lib/room/ledgerRows.ts` (`buildVerdict`, `buildRatingSubline`)
- [ ] T081 [US9] Wire `getMatchRatings(matchId)` (`app/actions/match/getMatchRatings.ts`, currently unused) into `roomStore` on `phase: final` with one retry after 3 s while pending; test `tests/unit/lib/room/roomStore.final.spec.ts`
- [ ] T082 [US9] Render `variant: final` in `Ledger.tsx` (verdict block `aria-live=assertive` above header, all rows, territory, foot actions) and `PlayerBar state: final` sublines; `Field disabled`; tests `tests/unit/components/room/Ledger.final.spec.tsx`
- [ ] T083 [US9] Port `components/match/useRematchNegotiation.ts` into `RoomShell`: `incoming` → `rematchRequest` notice, `waiting` → hint `waiting for <name>`, `accepted` → `hydrateMatch(newMatchId)` + `router.replace` (phase `found` countdown then `match`), `declined/expired` → hint; `new opponent ▸` → `phase: queue`; `lobby` → `phase: lobby`; keep `rematch_requests` server flow unchanged
- [ ] T084 [US9] Replace `app/match/[matchId]/summary/page.tsx` with a `redirect('/match/{id}')` (room detects `completed` → `final`); move `computeFrozenTileCountByPlayer` / series context helpers still needed into `lib/room/ledgerRows.ts` or delete
- [ ] T085 [US9] Add "final + rematch" section to `tests/integration/ui/room-flow.spec.ts` and rewrite `tests/integration/ui/match-completion.spec.ts`; delete `tests/integration/ui/{postgame,z-final-summary}.spec.ts`
- [ ] T086 [US9] Delete `components/match/{FinalSummary,PostGameVerdict,PostGameScoreboard,RoundByRoundChart,WordsOfMatch,RematchBanner,RematchInterstitial,MatchClient}.tsx` and tests; `components/match/` now holds only `useRematchNegotiation.ts` (move to `lib/room/useRematchNegotiation.ts`); delete `components/ui/{Dialog}.tsx` only if `LedgerSheet` no longer uses it; widen T022 grep to all of `components/`
- [ ] T087 [US9] Update `specs/016-rematch-post-game-loop/SUPERSEDED.md`, `specs/012-round-history-and-game-recap/SUPERSEDED.md`, `CLAUDE.md` component lists and "Frontend Communication" flow for the room

---

## Phase 12: User Story 10 — Profile in the same grammar (Priority: P4)

**Goal**: `/profile` and `/profile/[handle]` on the `1fr 340px` grid: identity row, hairline 30-day rating chart, four-cell record row; `best words` and `recent matches` ledgers; foot `◂ lobby` / `change name · sign out`; opponent colour for other players; match tap opens the final room state read-only.

**Independent Test**: `tests/unit/components/profile/ProfilePage.spec.tsx` green; Playwright `tests/integration/ui/profile-room.spec.ts`: own profile uses `--you`, another player's `--opp`; chart is one `<polyline>` + three gridlines, no `<circle>`; clicking a recent match opens `/match/{id}` in `data-phase=final`.

- [ ] T088 [P] [US10] Write failing test `tests/unit/components/profile/ProfileRatingChart.spec.tsx` (single 1.5 px polyline in seat colour, three `--rule` gridlines, ink axes, mono labels, no fill/markers/tooltip) then rewrite `components/profile/ProfileRatingChart.tsx`
- [ ] T089 [P] [US10] Write failing test `tests/unit/components/profile/ProfilePage.spec.tsx` (identity row `playing since <month> · <n> matches`, rating 48 px mono + `rating · peak n · ±n this week`, record row won/lost/drawn/win rate, `best words` rows word/points/`vs <name>`, `recent matches` rows, foot actions, `seat` prop switches colours) then rewrite `components/profile/ProfilePage.tsx` using `Ledger`-style ruled rows
- [ ] T090 [US10] Extend `app/actions/player/getBestWords.ts` to return `opponentName` per word (join on `matches`/`players`) with test `tests/unit/app/actions/getBestWords.spec.ts`; update `lib/types/lobby.ts` schema
- [ ] T091 [US10] Update `app/profile/page.tsx` and `app/profile/[handle]/page.tsx` to pass `seat` (`you`/`opp`) and render inside the room grid classes; `change name` → inline `NameInput` (reuse T067) calling `loginAction`; `◂ lobby` link
- [ ] T092 [US10] Write failing Playwright spec `tests/integration/ui/profile-room.spec.ts` (replaces `profile-page.spec.ts`, `profile-modal.spec.ts`) incl. read-only final room from a recent match
- [ ] T093 [US10] Delete `components/profile/{ProfileSidebar,ProfileStat,ProfileWordCloud,ProfileMatchHistoryList}.tsx`, `components/player/`, `components/ui/{Avatar,Badge,Button,Card,Skeleton,GearMenu,SettingsPanel}.tsx`, `app/styles/profile.css`, their tests and `tests/integration/ui/{profile-page,profile-modal}.spec.ts`; widen T022 grep to all of `app/` + `components/`

---

## Phase 13: User Story 11 — Documentation matches the design (Priority: P4)

**Goal**: Docs describe the room as built; test-id docs name the new ids; the `DOCS_CONSISTENCY.md §10` grep list returns nothing over `README.md`, `CLAUDE.md`, `docs/` (excl. `docs/archive/`) and `specs/`.

**Independent Test**: the grep in `quickstart.md` "Acceptance greps" and the `DOCS_CONSISTENCY.md §10` list both print nothing; `tests/unit/styles/acceptance-grep.test.ts` scoped to `app/` + `components/` passes.

- [ ] T094 [P] [US11] Update `tests/integration/ui/README.md` and `specs/016-rematch-post-game-loop/tasks.md` test-id references to the ids in `contracts/room-components.md`
- [ ] T095 [P] [US11] Update `README.md` project structure (remove deleted component folders, add `components/room/`, `lib/room/`) and `CLAUDE.md` Architecture directory list, "Frontend Communication", "Common Workflows" for the room; mark P0–P5 rows Done in the CLAUDE.md step table
- [ ] T096 [P] [US11] Move historical plans/specs still containing grep-list phrases into `docs/archive/` (`docs/superpowers/plans/2026-04-*-phase-*.md`, `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md`, `docs/superpowers/specs/2026-06-16-scored-words-side-panels-design.md`, `docs/superpowers/specs/2026-06-18-prominent-match-timers-design.md`) and add `docs/archive/README.md` explaining the archive; for retired `specs/0xx` folders keep them in place and add the phrase-free `SUPERSEDED.md` pointer at the top of each `spec.md`
- [ ] T097 [US11] Add `scripts/docs/consistency-grep.sh` running the `DOCS_CONSISTENCY.md §10` list over `README.md CLAUDE.md docs specs` excluding `docs/archive` and `docs/design_documentation/260914-wottle-new-design`; wire it as `pnpm docs:check` in `package.json` and into `.github/workflows/ci.yml` lint job
- [ ] T098 [US11] Update `docs/prd_and_requirements/wottle_game_rules.md` §11 code references (`readingDirection.ts`, `wordScoreRow.ts`, `boardGenerator.ts`, `previewSwap.ts`) and §12 if rendering changed; update `docs/design/README.md` status to "implemented"

---

## Phase 14: Polish & Cross-Cutting Concerns

- [ ] T099 [P] Add `@axe-core/playwright` checks for every `data-phase` (lobby empty, lobby, queue, found, match, final) and the profile to `tests/integration/ui/room-layout.spec.ts`; fix any violation in `components/room/*`
- [ ] T100 [P] Add `performance.mark("field:hydrated")` in `components/room/Field.tsx` and `performance.mark("room:phase-change")` in `lib/room/roomStore.ts`; structured log for `preview-swap.priced` verified in `tests/unit/app/actions/previewSwap.spec.ts`
- [ ] T101 [P] Run `pnpm perf:round-resolution`, `pnpm perf:instant-scoring`, `pnpm perf:preview-swap`; record results in `specs/044-field-ledger-redesign/quickstart.md` "Performance checks"
- [ ] T102 Capture 1440×900 and 390×844 screenshots of lobby, queue, match and final (`tests/integration/ui/room-layout.spec.ts` `toHaveScreenshot` stored under `tests/integration/ui/__screenshots__/`) and compare against the audit figures; attach to the PR
- [ ] T103 Delete remaining dead code: `lib/constants/featureFlags.ts` if still unreferenced, `components/ui/` leftovers, `lib/preferences/useSensoryPreferences.ts` if only the store is used, `components/match/` folder; run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration`
- [ ] T104 Open a governance follow-up: draft the Constitution IV amendment (full-width non-scrolling field replaces pinch-zoom) in `.specify/memory/constitution.md` "Amendment Process" notes — do not change the principle text in this feature
- [ ] T105 Final `quickstart.md` walkthrough (two-browser smoke) and update `CLAUDE.md` "Current State" to "Field & Ledger shipped"

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → US1** are strictly sequential (shell before any story).
- **US1 (bars/field/ledger shell)** unblocks everything else. **US2** (interaction) and **US3** (bands) both depend only on US1 and can run in parallel. **US4** (ledger rows) depends on US1; its notices (T052) are used by US2's frozen/pickCleared lines — build T036 before T052 or stub. **US5** depends on US1 only. **US6** depends on US3 (bands) and US4 (live row writes).
- **US7** (lobby) depends on US2 (field interaction for the warm-up) and US4 (ledger variants). **US8** depends on US7 (play ranked ▸ lives in the lobby bar). **US9** depends on US4 and US6 (final bands + rows) and US8 (new opponent → queue).
- **US10** depends on US4's ruled-row styles and US9 (read-only final room). **US11** is last (docs describe what shipped).
- Design-plan step boundaries for PR slicing: **PR-P0** = Phase 1–2 contracts (T001–T017); **PR-P1** = T018–T034 + T056–T059 (US1 + US5); **PR-P2** = US4; **PR-P3** = US2 + US3 + US6; **PR-P4** = US7 + US8 + US9; **PR-P5** = US10 + US11 + Polish.

## Parallel Execution Examples

- Phase 1: T002, T003, T004, T005 in parallel after T001.
- Phase 2: T006/T007/T008 in parallel; T012 + T016 + T017 in parallel; T018/T019/T021 in parallel; T026 alongside T024–T025.
- US1: T027, T028, T029 in parallel (spec, bars, field), then T030 → T031.
- US2 + US3 together: T035, T036, T043 in parallel; then T037/T044.
- US4: T049 while US2/US3 finish; T050 → T051/T052 parallel.
- US7: T067 + T068 parallel; US8: T074 parallel with US7's T069.
- US10: T088 + T089 parallel. US11: T094, T095, T096 parallel.
- Polish: T099, T100, T101 parallel.

## Implementation Strategy

1. **MVP = Phase 1 + Phase 2 + US1** (T001–T034): the match already looks like the room — bars, field, ledger caption — with the old interaction underneath. Demonstrable and mergeable.
2. Then **US2 + US3 + US6** (the field) and **US4 + US5** (ledger + clocks) as two parallel tracks that meet at the reveal (US6).
3. Then **US7 → US8 → US9** to fold the other screens into the room.
4. Finish with **US10 + US11 + Polish** and the acceptance greps.

Every phase ends with the two-player Playwright flow green, the acceptance grep widened to the folders it converted, `pnpm lint && pnpm typecheck` clean, and two screenshots on the PR.
