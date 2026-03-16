# Tasks: Match HUD Three-Column Layout

**Input**: Design documents from `/specs/018-match-hud-layout/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — TDD is mandated by the constitution (Principle VII).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Types and data loading that all user stories depend on

- [x] T001 Add `MatchPlayerProfile` and `MatchPlayerProfiles` types in `lib/types/match.ts`
- [x] T002 Write failing test for `loadMatchPlayerProfiles()` in `tests/unit/match/loadMatchPlayerProfiles.test.ts`
- [x] T003 Implement `loadMatchPlayerProfiles()` in `lib/match/stateLoader.ts` — query players table for id, username, display_name, avatar_url, elo_rating; map to MatchPlayerProfile shape
- [x] T004 Update `app/match/[matchId]/page.tsx` to call `loadMatchPlayerProfiles()` after `loadMatchState()` and pass `playerProfiles` prop to MatchClient
- [x] T005 Add `playerProfiles: MatchPlayerProfiles` to `MatchClientProps` in `components/match/MatchClient.tsx` — wire up playerSlot/opponentSlot to resolve current player and opponent profiles

**Checkpoint**: Player profile data flows from server to MatchClient. All existing tests still pass.

---

## Phase 2: Foundational (Presentational Components)

**Purpose**: Build the reusable UI building blocks that all user stories need

### Tests First

- [x] T006 [P] Write failing tests for `PlayerAvatar` in `tests/unit/components/PlayerAvatar.test.tsx` — renders img when avatarUrl provided; renders first-letter circle when no URL; md and sm size variants
- [x] T007 [P] Write failing tests for `TimerDisplay` in `tests/unit/components/TimerDisplay.test.tsx` — formats M:SS correctly; applies running/paused/expired background colors; applies urgency class when <30s; respects prefers-reduced-motion
- [x] T008 [P] Write failing tests for `PlayerPanel` full variant in `tests/unit/components/PlayerPanel.test.tsx` — renders avatar, display name (truncated at 20 chars), Elo rating, timer, score with player color, round indicator, submitted indicator, disconnection indicator, History/Resign buttons when controls provided

### Implementation

- [x] T009 [P] Create `PlayerAvatar` component in `components/match/PlayerAvatar.tsx` — accepts displayName, avatarUrl, playerColor, size ("sm"|"md"); renders img or colored circle with first letter
- [x] T010 [P] Create `TimerDisplay` component in `components/match/TimerDisplay.tsx` — accepts timerSeconds, isPaused, hasSubmitted, playerColor, size ("lg"|"sm"); renders M:SS in large font, colored rectangle background (vivid running, muted paused), urgency pulse when <30s
- [x] T011 Create `PlayerPanel` component in `components/match/PlayerPanel.tsx` — full variant: vertical layout with PlayerAvatar (md), display name + Elo, TimerDisplay (lg), score, round indicator, controls (ScoreDeltaPopup, History, Resign when provided), submitted/disconnected indicators

**Checkpoint**: All three new components pass their tests in isolation. No integration yet.

---

## Phase 3: User Story 1 — Three-Column Layout (Priority: P1) 🎯 MVP

**Goal**: Desktop three-column layout with player panels flanking the board; mobile compact bars above/below board.

**Independent Test**: Start a match on desktop (≥900px) and verify left panel shows current player info, center shows board, right panel shows opponent info. All key data visible.

### Tests for User Story 1

- [x] T012 [US1] Write failing test for PlayerPanel compact variant in `tests/unit/components/PlayerPanel.test.tsx` — horizontal layout with avatar (sm), name, TimerDisplay (sm), score in single row

### Implementation for User Story 1

- [x] T013 [US1] Implement compact variant in `PlayerPanel` in `components/match/PlayerPanel.tsx` — horizontal single-row layout with PlayerAvatar (sm), truncated name, TimerDisplay (sm), score
- [x] T014 [US1] Add three-column desktop layout CSS in `app/styles/board.css` — `.match-layout__panel` (14rem, flex column), `.match-layout__panel--left`, `.match-layout__panel--right`; update `.match-layout` to three-column flex at ≥900px; hide compact bars on desktop
- [x] T015 [US1] Add mobile responsive CSS in `app/styles/board.css` — hide `.match-layout__panel--left/right` at <900px; show `.match-layout__compact-top/bottom`; recalculate `--chrome-height` for desktop (no GameChrome bars)
- [x] T016 [US1] Update `MatchClient.tsx` layout structure — render PlayerPanel (full) in `.match-layout__panel--left` (player) and `.match-layout__panel--right` (opponent); render PlayerPanel (compact) as `.match-layout__compact-top` (opponent) and `.match-layout__compact-bottom` (player) inside board container; pass player/opponent profiles, gameState, and controls to appropriate panels
- [x] T017 [US1] Update `usernameMap` in `MatchClient.tsx` to use `playerProfiles.playerA.displayName` and `playerProfiles.playerB.displayName` instead of player IDs for round history

**Checkpoint**: Three-column layout visible on desktop, compact bars on mobile. Player names, avatars, scores, timers, round indicator all visible. Existing board interactions still work.

---

## Phase 4: User Story 2 — Prominent Timer Display (Priority: P1)

**Goal**: Timers are visually dominant with color-coded backgrounds (vivid=running, muted=paused) and urgency pulse when <30s.

**Independent Test**: During gameplay, verify the active timer has a vivid background, paused timer has muted background, and timer pulses red when below 30 seconds.

### Tests for User Story 2

- [x] T018 [US2] Write failing test for timer urgency pulse in `tests/unit/components/TimerDisplay.test.tsx` — verify `timer-display--urgent` class applied when timerSeconds < 30 and timer is running; NOT applied when ≥30s or paused
- [x] T019 [US2] Write failing test for submitted state in `tests/unit/components/TimerDisplay.test.tsx` — verify "Submitted" badge rendered when hasSubmitted is true

### Implementation for User Story 2

- [x] T020 [US2] Add timer urgency pulse CSS keyframe in `app/styles/board.css` — `@keyframes timer-urgency-pulse` (opacity 1→0.7→1, 1s period); `.timer-display--urgent` class with red background; `prefers-reduced-motion` fallback (static red border, no animation)
- [x] T021 [US2] Implement urgency logic in `TimerDisplay` in `components/match/TimerDisplay.tsx` — apply `timer-display--urgent` class when timerSeconds < 30 and status is running; render "Submitted" badge when hasSubmitted
- [x] T022 [US2] Style active vs paused timer backgrounds in `TimerDisplay` — running: vivid player-color background; paused: muted/desaturated version; expired: dark red/gray

**Checkpoint**: Timer visually distinguishes running/paused/expired/urgent states. Urgency pulse animates below 30s.

---

## Phase 5: User Story 3 — Player Identity Display (Priority: P2)

**Goal**: Display names (not UUIDs), avatar images or letter placeholders, and Elo ratings in each panel.

**Independent Test**: Start a match where one player has an avatar and one doesn't. Verify display names shown, avatar image rendered for one, letter placeholder for the other, and Elo ratings visible.

### Tests for User Story 3

- [x] T023 [US3] Write failing test for Elo display in `tests/unit/components/PlayerPanel.test.tsx` — renders Elo rating number; renders "Unrated" when eloRating is null/undefined

### Implementation for User Story 3

- [x] T024 [US3] Add Elo rating display to `PlayerPanel` in `components/match/PlayerPanel.tsx` — show rating number below display name; show "Unrated" or dash for null/undefined rating
- [x] T025 [US3] Handle edge cases in `PlayerPanel` — truncate display names >20 chars with ellipsis (CSS `text-overflow: ellipsis`); handle missing avatarUrl gracefully with letter placeholder

**Checkpoint**: Player identity fully displayed. Display names replace UUIDs throughout.

---

## Phase 6: User Story 4 — Responsive Layout (Priority: P2)

**Goal**: Graceful mobile/tablet layout with compact bars preserving all essential info.

**Independent Test**: Resize browser below 900px — verify compact bars show name, timer, score without scrolling. Resize back above 900px — verify three-column layout returns.

### Implementation for User Story 4

- [x] T026 [US4] Verify and refine compact bar layout in `app/styles/board.css` — ensure timer, score, and name fit in single row at 320px minimum width; adjust font sizes and spacing for mobile breakpoints (768px, 480px)
- [x] T027 [US4] Test viewport transition — verify no game state loss when crossing 900px threshold; verify both layouts render in DOM (CSS-only toggle, no hydration mismatch)

**Checkpoint**: Layout works across all viewport sizes. No information loss during resize.

---

## Phase 7: User Story 5 — Score Display with Round Context (Priority: P2)

**Goal**: Scores prominently displayed, round counter always visible, ScoreDeltaPopup integration preserved.

**Independent Test**: Play through multiple rounds — verify scores update, round counter advances, ScoreDeltaPopup still shows breakdowns.

### Tests for User Story 5

- [x] T028 [US5] Write failing test for round indicator in `tests/unit/components/PlayerPanel.test.tsx` — renders "Round X / 10" format with correct round number

### Implementation for User Story 5

- [x] T029 [US5] Implement round indicator in `PlayerPanel` in `components/match/PlayerPanel.tsx` — display "Round {currentRound} / {totalRounds}" prominently; update on each round advance
- [x] T030 [US5] Integrate ScoreDeltaPopup in player's `PlayerPanel` — pass scoreDelta and scoreDeltaRound from controls prop; render ScoreDeltaPopup relative to score display with key={scoreDeltaRound} for re-trigger

**Checkpoint**: Scores, round counter, and ScoreDeltaPopup all functioning in the new layout.

---

## Phase 8: RoundSummaryPanel Overlay (Cross-Cutting)

**Purpose**: Move RoundSummaryPanel from side column to board overlay

- [x] T031 Add board overlay CSS in `app/styles/board.css` — `.match-layout__overlay` with position absolute, inset 0, z-index 30, centered flex, semi-transparent black backdrop (rgba 0,0,0,0.5), border-radius
- [x] T032 Update `MatchClient.tsx` to render RoundSummaryPanel inside `.match-layout__overlay` div within the board container — remove `.match-layout__summary` side column; conditionally render overlay when `animationPhase === "showing-summary"` and summary exists

**Checkpoint**: RoundSummaryPanel overlays the board with dimmed backdrop. Three-column layout intact during summaries.

---

## Phase 9: Polish & Cleanup

**Purpose**: Remove deprecated code, update skeleton, verify regressions

- [x] T033 Update `MatchShell` loading skeleton in `components/match/MatchShell.tsx` to match new three-column layout structure (panel placeholders on sides, board skeleton in center)
- [x] T034 Remove `GameChrome` component (`components/match/GameChrome.tsx`) and its test file (`tests/unit/components/GameChrome.test.tsx`) — verify no remaining imports
- [x] T035 Run full test suite (`pnpm test && pnpm typecheck && pnpm lint`) to verify zero regressions
- [ ] T036 Manual visual QA — verify all 17 functional requirements (FR-001 through FR-017) against the spec in a live match between two players

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on T001 (types) — can start T006-T008 tests in parallel immediately
- **Phase 3 (US1)**: Depends on Phase 2 completion — core layout change
- **Phase 4 (US2)**: Depends on T010 (TimerDisplay exists) — can run in parallel with US1 integration
- **Phase 5 (US3)**: Depends on T009, T011 (PlayerAvatar, PlayerPanel exist) — can run in parallel with US1/US2
- **Phase 6 (US4)**: Depends on Phase 3 (layout must exist to test responsiveness)
- **Phase 7 (US5)**: Depends on T011 (PlayerPanel exists) — can run in parallel with US1 integration
- **Phase 8 (Overlay)**: Depends on Phase 3 (new layout structure must exist)
- **Phase 9 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (Three-Column Layout)**: Depends on Foundational — core deliverable
- **US2 (Timer Display)**: Independent of US1 at component level; integration requires US1 layout
- **US3 (Player Identity)**: Independent at component level; integration requires US1 layout
- **US4 (Responsive)**: Depends on US1 (tests the layout created in US1)
- **US5 (Score + Round)**: Independent at component level; integration requires US1 layout

### Parallel Opportunities

- T006, T007, T008 (all test files) — parallel
- T009, T010 (PlayerAvatar, TimerDisplay) — parallel
- T018, T019 (US2 tests) — parallel
- US2, US3, US5 component work — parallel with each other

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational components (T006–T011)
3. Complete Phase 3: US1 Three-Column Layout (T012–T017)
4. Complete Phase 4: US2 Timer Display (T018–T022)
5. **STOP and VALIDATE**: Three-column layout with prominent timers visible on desktop

### Incremental Delivery

1. Setup + Foundational → Components ready
2. US1 → Three-column layout works → Demo
3. US2 → Timers prominent and color-coded → Demo
4. US3 → Player names and avatars → Demo
5. US4 → Mobile responsive → Demo
6. US5 → Scores and round counter → Demo
7. Overlay + Polish → Feature complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD mandated: write failing test → implement → refactor
- CSS-only responsive switching to avoid hydration mismatches
- Commit after each passing test (Conventional Commits format)
- GameChrome is NOT removed until Phase 9 — safety net during development
