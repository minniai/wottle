# Tasks: Board UI and Animations

**Input**: Design documents from `/specs/005-board-ui-animations/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

**Tests**: TDD is NON-NEGOTIABLE per constitution. Test tasks are included and MUST be written and fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared constants and configuration that multiple user stories depend on

- [x] T001 [P] Create centralized player color constants in `lib/constants/playerColors.ts` — export PLAYER_A_HEX (#3B82F6), PLAYER_A_OVERLAY (rgba 40%), PLAYER_A_HIGHLIGHT (rgba 60%), PLAYER_B_HEX (#EF4444), PLAYER_B_OVERLAY (rgba 40%), PLAYER_B_HIGHLIGHT (rgba 60%), BOTH_GRADIENT (linear-gradient 135deg split), and a `getPlayerColors(slot: PlayerSlot)` helper that returns the correct color set for a given player slot
- [x] T002 [P] Update `tailwind.config.ts` — add player color tokens under `colors.player` (player.a: #3B82F6, player.b: #EF4444) and animation duration tokens under `transitionDuration` (swap: 200ms, shake: 350ms, highlight: 700ms) so Tailwind classes like `bg-player-a` and `duration-swap` are available

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refactor existing components to accept the new layout pattern. MUST complete before any user story work begins.

- [x] T003 Refactor `components/match/MatchShell.tsx` — accept a `loading` boolean prop. When `loading=true`, render a skeleton layout (gray header bars + 10x10 gray tile grid via `aria-hidden` divs reusing `.board-grid` CSS). When `loading=false`, render only `{children}`. Remove the always-visible "Board Loading" / "Players" placeholder sections. Keep `data-testid="match-shell"`
- [x] T004 Fix nested `<main>` tag in `app/match/[matchId]/page.tsx` — replace the inner `<main>` element with a `<div>` or `<section>` to avoid invalid HTML nesting with root layout's `<main>`. Preserve existing className and responsive constraints
- [x] T005 Add skeleton board rendering to `components/game/BoardGrid.tsx` — when `grid` prop is empty or undefined, render 100 inert gray `<div>` placeholder tiles (not `<button>`) using the same `.board-grid` CSS grid. Include `aria-hidden="true"` on the skeleton container. No layout shift when real data replaces skeleton (FR-017a)

**Checkpoint**: MatchShell conditionally renders skeleton or content. Page has valid HTML structure. BoardGrid handles empty state.

---

## Phase 3: User Story 1 — PRD Match Layout Structure (Priority: P1) — MVP

**Goal**: Match screen displays opponent bar (top) → 10x10 grid (center) → player bar (bottom) per PRD §7.1. Debug metadata hidden by default.

**Independent Test**: Navigate to an active match. Verify three vertically stacked regions with no debug metadata visible.

### Tests for User Story 1

- [x] T006 [P] [US1] Write failing test in `tests/unit/components/GameChrome.test.tsx` — test that GameChrome renders opponent bar with name, timer, and score; renders player bar with name, timer, score, and move counter M{n}; correctly maps playerSlot to opponent/player position; does not render move counter in opponent bar
- [x] T007 [P] [US1] Write failing test in `tests/unit/components/MatchClient.test.tsx` — test that MatchClient renders layout in order: GameChrome(opponent) → BoardGrid → GameChrome(player); no debug metadata (match ID, "Round limit", "Status") is rendered when `?debug` param is absent; debug metadata IS rendered when `?debug=1` is in URL

### Implementation for User Story 1

- [x] T008 [US1] Create `components/match/GameChrome.tsx` — a client component that renders a horizontal bar with: player name/label, timer (using TimerHud or inline), cumulative score, and optional move counter M{n}. Accept props: `position` ("opponent" | "player"), `playerName`, `score`, `timerSeconds`, `isPaused`, `hasSubmitted`, `moveCounter?`, `playerColor`. Use `playerColor` for a subtle accent (border or score text color). Apply Tailwind responsive classes for mobile stacking (FR-004)
- [x] T009 [US1] Refactor `components/match/MatchClient.tsx` layout — replace current render structure with: `<GameChrome position="opponent" .../>` → `<BoardGrid .../>` → `<GameChrome position="player" .../>`. Derive opponent/player props from `matchState.scores`, `matchState.timers`, `matchState.currentRound`, `playerSlot`, and `currentPlayerId`. Remove the inline `<TimerHud>` usage above the board (timer is now inside GameChrome). Keep reconnect/polling/error banners and RoundSummaryPanel
- [x] T010 [US1] Implement debug metadata toggle in `components/match/MatchClient.tsx` — read `?debug=1` URL parameter via `useSearchParams()`. Only when present, render a collapsible section showing match ID, round number, status, player IDs. In production builds (check `process.env.NODE_ENV`), skip rendering the debug section entirely (FR-015, FR-016)

**Checkpoint**: Match screen shows opponent bar → board → player bar. Debug metadata hidden by default, accessible via `?debug=1`. US1 acceptance scenarios satisfied.

---

## Phase 4: User Story 2 — Board Fits Viewport on All Devices (Priority: P1)

**Goal**: Board scales to fit available viewport space. No overflow. Square tiles. Works on desktop, tablet, phone.

**Independent Test**: Open match at 1280x800, 768x1024, 375x667. Board fully visible, tiles square, no horizontal scrollbar.

### Tests for User Story 2

- [x] T011 [US2] Write failing test in `tests/unit/components/BoardGrid.test.tsx` — test that BoardGrid container has CSS properties ensuring square aspect ratio; test that `--board-max` custom property is computed (or verify the responsive CSS classes are applied); test minimum tile size of 28px is enforced via CSS min-width

### Implementation for User Story 2

- [x] T012 [US2] Update `app/styles/board.css` — replace `width: 95%` on `.board-grid` with viewport-responsive sizing: use CSS custom properties `--chrome-height` (sum of opponent bar + player bar + gaps, ~120px) and `--board-max: min(calc(100vh - var(--chrome-height) - 2rem), calc(100vw - 2rem))`. Set `width: var(--board-max); max-width: var(--board-max)` on the board container. Ensure `aspect-ratio: 1` on the grid wrapper. Add `min-width: 28px` on `.board-grid__cell` (FR-009). Keep existing gap/font clamp values but adjust breakpoints if needed
- [x] T013 [US2] Update mobile breakpoints in `app/styles/board.css` — at `@media (max-width: 768px)`, set `--chrome-height` to account for taller stacked bars. At `@media (max-width: 480px)`, enable `overflow-x: auto` only if board exceeds viewport (FR-009 fallback). Verify no horizontal scroll on 375px viewport when tiles are >= 28px

**Checkpoint**: Board fits viewport on all three reference viewports. Tiles remain square. No horizontal scroll on desktop/tablet. Mobile allows vertical scroll if needed.

---

## Phase 5: User Story 3 — Scores and Move Counter in Game Chrome (Priority: P1)

**Goal**: Both players' scores, timers with state colors, and move counter M{n} are visible in game chrome.

**Independent Test**: Complete two rounds. Scores update, move counter increments, timer shows green/neutral.

### Tests for User Story 3

- [ ] T014 [P] [US3] Write failing test in `tests/unit/components/GameChrome.test.tsx` — test that score displays the numeric value from props; test that move counter renders "M3" when moveCounter=3; test that move counter is absent for position="opponent"; test that timer text is green (class or style) when `hasSubmitted=false` and neutral when `hasSubmitted=true`
- [ ] T015 [P] [US3] Write failing test in `tests/unit/components/TimerHud.test.tsx` — test that TimerHud accepts `hasSubmitted` prop and applies green text color class when false, neutral color class when true (FR-014)

### Implementation for User Story 3

- [ ] T016 [US3] Add score and move counter data binding in `components/match/GameChrome.tsx` — render `score` as a prominent number (e.g., `text-2xl font-bold`). Render `moveCounter` as "M{n}" (e.g., `text-sm font-mono`). Use `playerColor` for score accent. Format timer via existing MM:SS logic or delegate to TimerHud sub-component
- [ ] T017 [US3] Add timer state colors to `components/game/TimerHud.tsx` — accept new `hasSubmitted` boolean prop. When `hasSubmitted=false`, apply green text color (`text-emerald-400`). When `hasSubmitted=true`, apply neutral color (`text-slate-400`). Keep existing countdown and paused logic unchanged (FR-014)
- [ ] T018 [US3] Wire submission status into GameChrome in `components/match/MatchClient.tsx` — derive `hasSubmitted` for each player from round submission state. If not directly available in MatchState, use timer `status === "paused"` as proxy (timer pauses on submission per existing logic). Pass to GameChrome → TimerHud

**Checkpoint**: Opponent bar shows opponent score + timer. Player bar shows own score + timer + M{n}. Timer color changes on submission.

---

## Phase 6: User Story 4 — Frozen Tiles Display Player Ownership (Priority: P1)

**Goal**: Frozen tiles show colored overlays (blue/red/split) at 40% opacity with WCAG-compliant contrast.

**Independent Test**: Score words for both players. Verify distinct blue, red, and split-diagonal overlays.

### Tests for User Story 4

- [ ] T019 [US4] Write failing test in `tests/unit/components/BoardGrid.test.tsx` — test that a tile with `frozenTiles["3,5"] = { owner: "player_a" }` renders with blue overlay style; test `player_b` renders red overlay; test `both` renders the split-diagonal gradient; test that frozen tile letters remain visible (not hidden by overlay); test `aria-disabled="true"` on frozen tiles

### Implementation for User Story 4

- [ ] T020 [US4] Refactor frozen tile rendering in `components/game/BoardGrid.tsx` — replace inline `FROZEN_COLORS` constant with import from `lib/constants/playerColors.ts`. Use the centralized `PLAYER_A_OVERLAY`, `PLAYER_B_OVERLAY`, and `BOTH_GRADIENT` values. Ensure the overlay is a pseudo-element or positioned div layered behind the letter text (not replacing background) so text contrast is maintained. Add `data-frozen-owner` attribute for test targeting. Verify existing `board-grid__cell--frozen` CSS class is still applied (FR-018, FR-019, FR-020)
- [ ] T021 [US4] Enhance frozen tile CSS in `app/styles/board.css` — ensure `.board-grid__cell--frozen` positions the color overlay behind the letter text (e.g., via `::after` pseudo-element with `position: absolute; inset: 0; z-index: 0` and the color as background, with letter text at `z-index: 1`). Verify letter text contrast meets 4.5:1 WCAG AA against each overlay color (FR-021). Update `board-grid__cell--frozen` hover to prevent the lift effect on frozen tiles

**Checkpoint**: Frozen tiles display blue (player_a), red (player_b), or split (both) overlays at 40% opacity. Letters readable. WCAG contrast passes.

---

## Phase 7: User Story 5 — Tile Swap Animates Smoothly (Priority: P1)

**Goal**: Swapped tiles animate to each other's positions over 150-250ms. Input blocked during animation.

**Independent Test**: Select two tiles and trigger swap. Tiles slide smoothly. Cannot interact during animation.

### Tests for User Story 5

- [ ] T022 [US5] Write failing test in `tests/unit/components/BoardGrid.test.tsx` — test that triggering a swap sets an `isAnimating` state that blocks further tile clicks; test that after swap animation completes (transitionend fires), `isAnimating` is cleared and tiles are clickable again; test that swap animation uses `transform` property (not top/left)

### Implementation for User Story 5

- [ ] T023 [US5] Update swap transition in `app/styles/board.css` — ensure `.board-grid__cell` has `transition: transform 200ms ease-out, border-color 150ms ease, box-shadow 150ms ease`. Add `.board-grid__cell--animating` class that applies `will-change: transform` for GPU layer promotion during animation. Add `@media (prefers-reduced-motion: reduce)` override that sets `transition-duration: 0ms` (FR-042, FR-044)
- [ ] T024 [US5] Implement swap animation in `components/game/BoardGrid.tsx` — on swap trigger: (1) measure positions of both tiles via `getBoundingClientRect()` using refs, (2) calculate dx/dy pixel offsets between the two tiles, (3) set inline `style.transform = translate(dx, dy)` on each tile (opposite directions), (4) set `isAnimating=true` to block all tile interactions (FR-024), (5) listen for `transitionend` event on either tile, (6) on transition end: clear transforms, update `currentGrid` state with swapped values, set `isAnimating=false`, call existing `submitSwapRequest()` (FR-023, FR-026, FR-027)
- [ ] T025 [US5] Add tile refs for animation measurement in `components/game/BoardGrid.tsx` — create a `tileRefs` map (Map<string, HTMLButtonElement>) keyed by "col,row" coordinate strings. Assign refs to each tile button via callback ref. Used by T024 for `getBoundingClientRect()` measurement during swap animation

**Checkpoint**: Swap triggers smooth 200ms slide animation. Tiles end at correct positions. Cannot click during animation.

---

## Phase 8: User Story 6 — Invalid Swap Shows Rejection Feedback (Priority: P2)

**Goal**: Frozen tile swap attempts trigger shake (3-4 oscillations, 300-400ms) + red border flash (200ms).

**Independent Test**: Click a frozen tile for swap. Tiles shake and flash red.

### Tests for User Story 6

- [ ] T026 [US6] Write failing test in `tests/unit/components/BoardGrid.test.tsx` — test that attempting to swap a frozen tile adds `board-grid__cell--shake` CSS class to the selected tiles; test that the shake class is removed after animation completes (animationend event); test that tile positions do not change after shake

### Implementation for User Story 6

- [ ] T027 [US6] Add shake keyframe animation to `app/styles/board.css` — define `@keyframes tile-shake` with 3-4 horizontal oscillations (`translateX` alternating +-4px) over 350ms. Define `.board-grid__cell--shake` class that applies the keyframe with `animation: tile-shake 350ms ease-out`. Add concurrent red border via `.board-grid__cell--shake { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239,68,68,0.5) }` that fades after 200ms. Add `prefers-reduced-motion` override to disable (FR-028, FR-029, FR-031, FR-044)
- [ ] T028 [US6] Implement shake trigger in `components/game/BoardGrid.tsx` — when a player selects a frozen tile as the second tile in a swap (or selects a frozen tile as first tile), detect that the swap is invalid BEFORE sending to server. Add `board-grid__cell--shake` class to the involved tiles. Listen for `animationend` event, then remove the class and clear selection. Ensure `isAnimating` is set during shake to block further interactions (FR-030). Also trigger shake on server-rejected swaps (existing error path)

**Checkpoint**: Frozen tile interactions trigger visible shake + red flash. Tiles return to original positions. Input re-enabled after animation.

---

## Phase 9: User Story 7 — Word Discovery Highlights Scored Tiles (Priority: P2)

**Goal**: After round resolves, scored tiles highlight with player-colored glow for 600-800ms. Sequential: highlights → freeze overlays → summary panel.

**Independent Test**: Complete a round scoring two words. Both highlight simultaneously for 600-800ms with fade in/out.

### Tests for User Story 7

- [ ] T029 [P] [US7] Write failing test in `tests/unit/components/BoardGrid.test.tsx` — test that tiles matching highlight coordinates receive `board-grid__cell--scored` class with the correct player color CSS variable; test that multiple word groups highlight simultaneously; test that highlight class is removed after 700ms
- [ ] T030 [P] [US7] Write failing test in `tests/unit/components/MatchClient.test.tsx` — test that when a round-summary event is received, MatchClient transitions through animation phases: "highlighting" → "freezing" → "showing-summary"; test that `RoundSummaryPanel` is only rendered when phase is "showing-summary"; test that frozen tiles are only updated when phase transitions from "highlighting" to "freezing"

### Implementation for User Story 7

- [ ] T031 [US7] Update scored-tile-highlight keyframe in `app/styles/board.css` — replace existing `@keyframes scored-tile-highlight` (currently 3s) with new timing: 200ms fade-in (opacity 0→1, box-shadow grows), 300ms hold at full intensity, 200ms fade-out (opacity 1→0, box-shadow shrinks). Total 700ms. Use CSS custom property `--highlight-color` so the glow color is set per-tile by the component. Add `prefers-reduced-motion` override (FR-033, FR-044). Ensure highlight glow is visually distinct from frozen overlay (FR-035) — use `box-shadow` outer glow rather than background tint
- [ ] T032 [US7] Implement animation phase state machine in `components/match/MatchClient.tsx` — add `animationPhase` state: `"idle" | "highlighting" | "freezing" | "showing-summary"`. On `onSummary` callback: (1) store summary data, (2) set phase to "highlighting" and pass highlight coordinates + player colors to BoardGrid, (3) after 800ms timeout → set phase to "freezing" and apply new frozen tiles from summary to matchState, (4) after 200ms → set phase to "showing-summary" and render RoundSummaryPanel. On summary dismiss → set phase to "idle". Ensure incoming state broadcasts are queued (not applied) while `animationPhase !== "idle"` (edge case from spec) (FR-036a)
- [ ] T033 [US7] Wire player-colored highlights in `components/game/BoardGrid.tsx` — accept new optional `highlightPlayerColors` prop (map of coordinate key to player color hex). When applying `board-grid__cell--scored` class, also set `--highlight-color` CSS variable on the tile element to the scoring player's color from `playerColors.ts`. Update highlight timeout from `highlightDurationMs` (currently 3000) to 800ms default

**Checkpoint**: Round resolution plays highlight → freeze → summary sequence. Highlights last ~700ms with player colors. Summary panel appears only after highlights + freeze complete.

---

## Phase 10: User Story 8 — Score Delta Popup Shows Breakdown (Priority: P3 — Deferrable)

**Goal**: Transient popup near player's score showing "+N letters, +N length, +N combo" after round resolves. Auto-dismisses in 2-3s.

**Independent Test**: Complete a round scoring a word. Popup appears near score with breakdown, auto-dismisses.

### Tests for User Story 8

- [ ] T034 [US8] Write failing test for score delta popup component — create `tests/unit/components/ScoreDeltaPopup.test.tsx`. Test that component renders breakdown text with non-zero components; test that zero-value components are omitted; test that popup auto-dismisses after ~2.5s (via timer mock); test that popup dismisses immediately when `onDismiss` is called

### Implementation for User Story 8

- [ ] T035 [US8] Create `components/match/ScoreDeltaPopup.tsx` — a client component positioned absolutely near the player score area. Accept props: `lettersPoints`, `lengthBonus`, `comboBonus`, `onDismiss`. Render "+N letters" for non-zero lettersPoints, "+N length" for non-zero lengthBonus, "+N combo" for non-zero comboBonus (FR-038). Use CSS `opacity` transition for 200ms fade-in, hold 2.5s, 200ms fade-out (FR-039). Auto-dismiss via `setTimeout`. Add `prefers-reduced-motion` support. `aria-live="polite"` for screen readers
- [ ] T036 [US8] Integrate ScoreDeltaPopup in `components/match/MatchClient.tsx` — during the "showing-summary" animation phase, also render `<ScoreDeltaPopup>` with the current player's round deltas extracted from `summary.deltas` and word breakdown. Dismiss popup when player selects a tile (FR-040) or after auto-dismiss timeout. Position popup adjacent to the player's GameChrome bar using relative positioning

**Checkpoint**: Score delta popup appears after round resolution with breakdown text. Auto-dismisses in 2-3s. Dismissed by tile interaction.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, performance, and integration validation across all stories

- [ ] T037 Add `prefers-reduced-motion` support to all animation CSS in `app/styles/board.css` — verify that a single `@media (prefers-reduced-motion: reduce)` block disables all animation durations (swap transition, shake keyframe, highlight keyframe, popup fade). Functional state changes (grid update, overlay application, popup visibility) still occur instantly (FR-044)
- [ ] T038 Add ARIA live regions for score and round announcements in `components/match/MatchClient.tsx` — add a visually hidden `aria-live="polite"` region that announces: score updates ("Your score: 45. Opponent score: 30."), round transitions ("Round 3 of 10"), and error states ("Swap rejected: tile is frozen"). Ensure announcements do not duplicate the RoundSummaryPanel's own ARIA (FR-045)
- [ ] T039 [P] Verify 44x44px touch targets on mobile in `app/styles/board.css` — ensure `.board-grid__cell` minimum size is 44px on viewports where tiles can be that large. On very small viewports where 28px minimum applies, accept the trade-off (already documented in edge cases). Add `min-height: 44px; min-width: 44px` via `@media (min-width: 480px)` (FR-043)
- [ ] T040 [P] Run lint, typecheck, and existing test suite — execute `pnpm lint && pnpm typecheck && pnpm test:unit` and fix any regressions introduced by the refactoring. Ensure zero warnings policy is maintained
- [ ] T041 Write Playwright E2E test in `tests/integration/ui/board-ui.spec.ts` — test three viewport sizes (1280x800, 768x1024, 375x667): verify layout structure (opponent bar, board, player bar), board fits viewport, no horizontal scroll on desktop. Test swap interaction: two tiles animate. Test frozen tile: shake on attempt. Test round summary: highlights appear then summary panel shows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — BLOCKS US2, US3, US7, US8
- **US2 (Phase 4)**: Depends on US1 (needs layout structure to size within)
- **US3 (Phase 5)**: Depends on US1 (needs GameChrome component to add data to)
- **US4 (Phase 6)**: Depends on Foundational only (modifies BoardGrid, independent of layout)
- **US5 (Phase 7)**: Depends on Foundational only (modifies BoardGrid, independent of layout)
- **US6 (Phase 8)**: Depends on US5 (extends swap interaction with rejection feedback)
- **US7 (Phase 9)**: Depends on US1 (adds sequencing to MatchClient)
- **US8 (Phase 10)**: Depends on US3 (positions popup near score in GameChrome)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies (DAG)

```text
Setup (T001-T002)
  └─→ Foundational (T003-T005)
        ├─→ US1 Layout (T006-T010) ──→ US2 Sizing (T011-T013)
        │                            ├─→ US3 Chrome (T014-T018) ──→ US8 Popup (T034-T036)
        │                            └─→ US7 Highlights (T029-T033)
        ├─→ US4 Frozen Overlays (T019-T021) [independent]
        └─→ US5 Swap Animation (T022-T025) ──→ US6 Shake (T026-T028)
```

### Parallel Opportunities

**After Foundational completes**, these can run in parallel:
- US1 (layout) — modifies MatchClient, creates GameChrome
- US4 (frozen overlays) — modifies BoardGrid overlay rendering
- US5 (swap animation) — modifies BoardGrid swap interaction

**After US1 completes**, these can run in parallel:
- US2 (sizing) — modifies board.css
- US3 (chrome data) — modifies GameChrome, TimerHud
- US7 (highlights) — modifies MatchClient sequencing

---

## Parallel Example: After Foundational

```bash
# These three stories touch different files and can run simultaneously:
# US1: MatchClient.tsx, GameChrome.tsx (new), page.tsx
# US4: BoardGrid.tsx frozen overlay code, board.css frozen styles
# US5: BoardGrid.tsx swap logic, board.css swap transition
```

## Parallel Example: After US1

```bash
# These three stories touch different files:
# US2: board.css sizing only
# US3: GameChrome.tsx data, TimerHud.tsx colors
# US7: MatchClient.tsx sequencing, board.css highlight keyframe
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 — Layout (T006-T010)
4. **STOP and VALIDATE**: Match screen shows PRD layout. Debug metadata hidden.
5. Deploy/demo if ready — game is visually recognizable as a game

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 (Layout) → PRD match screen structure (MVP!)
3. US2 (Sizing) + US4 (Frozen) + US5 (Swap) → Board fits, territory visible, swaps feel good
4. US3 (Chrome) → Scores and timers with state colors
5. US6 (Shake) + US7 (Highlights) → Full animation suite
6. US8 (Popup) → Polish feature (deferrable)
7. Polish → Accessibility, E2E tests, regression check

### Task Count Summary

| Phase | Story | Tasks | Parallel |
|-------|-------|-------|----------|
| 1 | Setup | 2 | 2 |
| 2 | Foundational | 3 | 0 |
| 3 | US1 Layout (P1) | 5 | 2 |
| 4 | US2 Sizing (P1) | 3 | 0 |
| 5 | US3 Chrome (P1) | 5 | 2 |
| 6 | US4 Frozen (P1) | 3 | 0 |
| 7 | US5 Swap (P1) | 4 | 0 |
| 8 | US6 Shake (P2) | 3 | 0 |
| 9 | US7 Highlights (P2) | 5 | 2 |
| 10 | US8 Popup (P3) | 3 | 0 |
| 11 | Polish | 5 | 2 |
| **Total** | | **41** | **10** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after its phase completes
- TDD: Write failing tests FIRST (T006/T007 before T008/T009/T010, etc.)
- Commit after each task or logical group per constitution Principle VII
- US8 (Score Delta Popup) is P3 and explicitly deferrable — skip if time-constrained
- All animation CSS must include `prefers-reduced-motion` overrides (consolidated in T037)
- No server-side changes, no migrations, no new API contracts in this entire feature
