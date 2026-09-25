# Tasks: Fix Lobby Empty State

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [contracts/lobby-empty-state.md](contracts/lobby-empty-state.md)

## Phase 1: Setup

- [x] T001 Verify the existing completed-match and no-history test fixtures in `tests/unit/components/page/lobby/Lobby.spec.tsx`

## Phase 2: Foundational

- [x] T002 Confirm that `lib/lobby/overview.ts` retains its nullable `lastMatch` contract and requires no data change

## Phase 3: User Story 1 - View an honest first-game lobby (Priority: P1)

**Goal**: A player without completed games sees a true no-prior-game state.

**Independent Test**: Render `Lobby` with `overview.lastMatch: null` and confirm the explanatory copy exists without a field or rules figure.

- [x] T003 [US1] Add a failing no-field/no-rules-figure assertion to `tests/unit/components/page/lobby/Lobby.spec.tsx`
- [x] T004 [US1] Replace the instructional `RulesFigure` in the no-prior-game branch of `components/page/lobby/Lobby.tsx` with a width-safe empty state
- [x] T005 [US1] Run the focused test in `tests/unit/components/page/lobby/Lobby.spec.tsx` and mark the regression covered

## Phase 4: User Story 2 - Retain a completed-game preview (Priority: P2)

**Goal**: Players with completed games retain their existing preview.

**Independent Test**: Render `Lobby` with a non-null last match and confirm the existing review link and band map remain.

- [x] T006 [US2] Run and retain the completed-match preview assertion in `tests/unit/components/page/lobby/Lobby.spec.tsx`

## Phase 5: User Story 3 - Use the lobby on a narrow screen (Priority: P2)

**Goal**: The last-game area has no fixed-width field that can exceed the sidebar.

**Independent Test**: Inspect the empty state at the intermediate layout band and confirm no 300px rules field is rendered.

- [x] T007 [US3] Verify the no-prior-game branch no longer imports or renders the fixed-size rules figure in `components/page/lobby/Lobby.tsx`

## Phase 6: Polish and validation

- [x] T008 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit` from the repository root
- [x] T009 Review the implementation and feature artifacts against `specs/073-fix-lobby-empty-state/spec.md`

## Dependencies & Execution Order

- T001–T002 establish the existing contract and fixture.
- T003 must fail before T004 changes the implementation.
- T004 enables T005 and T007.
- T006 guards the completed-preview path independently.
- T008–T009 complete only after all story tasks.

## Implementation Strategy

Deliver the P1 empty state first, then verify the preserved completed preview and the responsive consequence. The implementation is intentionally limited to the client presentation branch because history lookup already returns the correct nullable value.
