# Tasks: Board UI Polish

**Input**: Design documents from `/specs/011-board-ui-polish/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

There is no project-level setup required; all infrastructure and dependencies are already active and installed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

There are no foundational or blocking changes required across all stories. The stories touch independent components (BoardGrid and TimerHud) or non-overlapping logic within BoardGrid.

---

## Phase 3: User Story 1 - Invalid Swap Feedback (Priority: P1) 🎯 MVP

**Goal**: Provide immediate visual feedback (shake + red border) when an invalid swap is attempted on the board.

**Independent Test**: Attempt to swap a frozen tile during a match; verify the tiles shake and flash red without the move being accepted.

### Implementation for User Story 1

- [x] T001 [US1] Extract static CSS invalid shake variables and durations into a reusable constant or verify existing `.board-grid__cell--invalid` usage in `app/styles/board.css`.
- [x] T002 [US1] Update `BoardGrid.tsx` to explicitly catch invalid local swap attempts (e.g. frozen tile checks before submitting to the server if applicable, or purely relying on the catch block of `handleSwap`).
- [x] T003 [US1] Ensure the transient `invalidTiles` state correctly applies the `.board-grid__cell--invalid` class to both the `from` and `to` tiles of the rejected swap.
- [x] T004 [US1] Implement a 400ms timeout clearing mechanism in `BoardGrid.tsx` that seamlessly resets the `invalidTiles` state to allow immediate subsequent move attempts.
- [x] T005 [US1] Update `vitest` unit tests for `BoardGrid.test.tsx` (if available) to ensure `invalidTiles` state manages the DOM classes correctly upon simulated rejection.

---

## Phase 4: User Story 2 - Move Counters & HUD Polish (Priority: P2)

**Goal**: Display exact move progress as "M{n}" in the HUD for both players.

**Independent Test**: Load a match and view the TimerHud above the board. Verify move counter tracks from M0 to M10 instead of "Round X".

### Implementation for User Story 2

- [x] T006 [P] [US2] Update `GameChrome.tsx` (which replaced TimerHud) to accept or extract the current `moveCount` for Player A and Player B.
- [x] T007 [P] [US2] Modify the rendering logic in `GameChrome.tsx` to remove "Round {X}" and render `M{moveCount}` formatting for both the opponent and player positions.
- [x] T008 [US2] Verify the parent container (`MatchClient.tsx`) passes the correct, real-time move counts down to `GameChrome.tsx`.
- [x] T009 [US2] Update unit tests for `GameChrome` to verify the new move counter display logic.

---

## Phase 5: User Story 3 - Responsive Mobile Board & Pinch-to-Zoom (Priority: P1)

**Goal**: Make the game board vertically scrollable and pinch-to-zoomable (50%-150%) on mobile viewports.

**Independent Test**: Open the application in a mobile responsive view, pinch grid to zoom in/out, and verify touch targets do not fall below 44x44px.

### Implementation for User Story 3

- [x] T010 [P] [US3] Create a new `usePinchZoom.ts` hook in `components/game/` to handle `onTouchStart`, `onTouchMove`, and `onTouchEnd` events, calculating derived scale bounded between 0.5 and 1.5.
- [x] T011 [US3] Update `BoardGrid.tsx` wrapper `div` to attach the touch event handlers from `usePinchZoom`.
- [x] T012 [US3] Map the derived scale value to a CSS variable (e.g. `--board-scale`) on the `BoardGrid` container.
- [x] T013 [US3] Update `app/styles/board.css` to apply `transform: scale(var(--board-scale, 1))` to the grid while ensuring `transform-origin` behaves predictably during zoom.
- [x] T014 [US3] Verify tap targets (Tiles) within `BoardGrid.tsx` maintain a minimum 44px hit box (`min-width`, `min-height`, or padding) regardless of scale, updating CSS if necessary to enforce this limit conditionally based on viewport.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T015 Run full `pnpm exec playwright test board-ui` to verify no regressions in the UI test suite.
- [x] T016 Run `pnpm lint && pnpm typecheck` to ensure all new hooks and prop changes are type-safe.
- [x] T017 Execute `quickstart.md` manual testing steps to verify all 3 features work harmoniously in the browser.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Foundational**: N/A for this spec.
- **User Stories (Phase 3-5)**: All stories can proceed in **parallel**. They modify distinct domains of the UI (HUD vs Grid vs Interaction Hook).
- **Polish (Final Phase)**: Depends on all user stories being complete.

### Within Each User Story

- Test and UI modifications should be matched. Hook creation (`usePinchZoom`) must precede its attachment in `BoardGrid.tsx`.

### Parallel Opportunities

- **Story 1** and **Story 3** both touch `BoardGrid.tsx` and `board.css`, so they can be parallelized but should be merged carefully or executed sequentially to avoid basic merge conflicts in the same file.
- **Story 2** is fully isolated to `TimerHud.tsx` and its parent, and can be executed entirely in parallel with the other two stories.

---

## Implementation Strategy

### Incremental Delivery

1. Complete User Story 1 (Invalid Swap) → Test Rejections independently → Deploy/Demo
2. Complete User Story 2 (HUD Move Counters) → Test isolated HUD → Deploy/Demo
3. Complete User Story 3 (Pinch to Zoom) → Test Mobile interaction → Deploy/Demo
