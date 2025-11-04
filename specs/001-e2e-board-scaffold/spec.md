# Feature Specification: MVP E2E Board & Swaps

**Feature Branch**: `001-e2e-board-scaffold`  
**Created**: 2025-11-04  
**Status**: Draft  
**Input**: User description: "Based on the @wottle_prd.md and @wottle_technical_architecture.md the first thing to do is to set up the development environment for implmenting the game, all base components, deployment pipeline, scaffolding, and local development environment. It should be an end-to-end implementation for to confirm the development architecture, with minimum functionality. It should only display the game board grid and be able send board moves, tile swaps end to end."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See board grid (Priority: P1)

A player opens the app and sees a 16×16 grid of letters representing the current board state.

**Why this priority**: Without a visible grid, nothing can be validated end-to-end.

**Independent Test**: Load the app and verify a 16×16 grid renders with legible letters; resizing and mobile viewport still display a complete grid.

**Acceptance Scenarios**:

1. **Given** the app loads, **When** the board state is retrieved, **Then** a 16×16 grid is displayed.
2. **Given** a mobile viewport, **When** the page is viewed, **Then** the grid remains readable and scrollable as needed.

---

### User Story 2 - Swap two tiles (Priority: P1)

A player selects two tiles (any positions) and triggers a swap; the system accepts the move if allowed and reflects the new grid state.

**Why this priority**: Confirms end-to-end mutation path and server authority for core gameplay action.

**Independent Test**: Select two tiles, submit the swap, and verify the board updates accordingly (success path) or shows a clear error (rejection path).

**Acceptance Scenarios**:

1. **Given** two valid, movable tiles, **When** the user swaps them, **Then** the grid updates to reflect their exchanged positions.
2. **Given** an invalid swap (e.g., out-of-bounds coordinates), **When** the user attempts it, **Then** the system rejects with a clear message and the board remains unchanged.

---

### User Story 3 - Basic move feedback (Priority: P2)

After a successful swap, the user receives basic confirmation that the move was processed (e.g., brief visual state change or message).

**Why this priority**: Helps verify that the action completed and supports usability during early testing.

**Independent Test**: Perform a valid swap and observe a confirmation signal distinct from the board change itself.

**Acceptance Scenarios**:

1. **Given** a valid swap, **When** it completes, **Then** a confirmation indicator appears briefly.

---

### Edge Cases

- What happens when the network round-trip fails during a swap submission? System should show an error and restore prior board state.
- How does the system handle concurrent initial moves? The second submission is rejected with a clear message and the client refreshes the board state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a 16×16 letter grid representing the current match board.
- **FR-002**: Users MUST be able to select any two tiles and submit a swap request.
- **FR-003**: System MUST validate swaps server-side and either accept (apply and return updated board) or reject with a reason.
- **FR-004**: On acceptance, System MUST return the updated grid and reflect it for the user within one interaction cycle.
- **FR-005**: On rejection or failure, System MUST preserve the previous grid and display an actionable error.
- **FR-006**: System MUST support basic responsiveness so the 16×16 grid is viewable on desktop and mobile.
- **FR-007**: System MUST provide a minimal confirmation indicator after a successful swap.
- **FR-008**: System MUST prevent wrap-around or out-of-bounds coordinates in swap requests.
- **FR-009**: System MUST support a basic local development workflow where a developer can run the app, view the grid, and test swaps against a running backend stub.

### Key Entities *(include if feature involves data)*

- **Board**: A 16×16 matrix of tiles, each with a letter and immutability flags reserved for future stages; for this feature, only letter and coordinates are required to visualize and swap.
- **Move**: A swap action with source and destination coordinates and a server-evaluated result (accepted/rejected) with updated board state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can load the app and see a 16×16 grid within 2 seconds on a typical broadband connection.
- **SC-002**: At least 95% of valid swap attempts update the board within 1 second during local development testing.
- **SC-003**: 100% of invalid swap attempts are rejected with a clear error message and no board change.
- **SC-004**: A developer can complete setup and run the project locally within 15 minutes using documented steps.

### Performance Requirements (if applicable)

- **PERF-001**: End-to-end swap action appears complete to the user within 1 second in local testing.
- **PERF-002**: Board render maintains smooth visual updates without stutter during a single swap interaction.
