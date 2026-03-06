# Feature Specification: Board UI Polish

**Feature Branch**: `011-board-ui-polish`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "Specify the following 3 featuers: Invalid Swap Feedback & Shake Animation, Move Counters & HUD Polish, Responsive Mobile Board & Pinch-to-Zoom"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Invalid Swap Feedback (Priority: P1)

As a player, when I attempt an invalid swap, I want immediate visual feedback so I know my move was rejected without confusion.

**Why this priority**: Crucial for game feel and clarity in a fast-paced 5-minute timed game. Without feedback, silent failures leave players confused about game state.

**Independent Test**: Can be tested by attempting to swap a frozen tile or creating an invalid state and observing the client-side visual rejection without a successful server update.

**Acceptance Scenarios**:

1. **Given** two selected tiles where the swap violates rules (e.g., one is frozen), **When** the swap is attempted, **Then** the selected tiles shake with 3-4 oscillations over 300-400ms.
2. **Given** two selected tiles where the swap violates rules, **When** the swap is attempted, **Then** a brief red border flashes (200ms duration) around the selected tiles.
3. **Given** an invalid swap attempt, **When** the animation concludes, **Then** the tile selection is cleared so the player can try another move.

---

### User Story 2 - Move Counters & HUD Polish (Priority: P2)

As a player, I want to see my exact move count during the game so I know how many of my 10 moves are remaining.

**Why this priority**: The 10-move limit is enforced, but not communicated in the HUD. Displaying the move count is essential for players to strategize effectively within the limit.

**Independent Test**: Can be tested by making valid moves and verifying the HUD updates accurately from M0 to M10.

**Acceptance Scenarios**:

1. **Given** an ongoing match, **When** examining the HUD, **Then** the current move count is displayed for each player formatted as `M{num}` (e.g., You [04:47] | Score 385 | M7).
2. **Given** a player successfully completes a valid move, **When** the move is accepted, **Then** their printed move count updates immediately.

---

### User Story 3 - Responsive Mobile Board & Pinch-to-Zoom (Priority: P1)

As a mobile player, I want the game board to be readable and interactive on small screens without breaking layout.

**Why this priority**: Necessary to transition the game from a desktop-only prototype to a playable mobile web app.

**Independent Test**: Open the game on a mobile viewport simulator; verify vertical scrolling works, and pinch-to-zoom functions within bounds without interface breakage.

**Acceptance Scenarios**:

1. **Given** a player on a mobile device, **When** viewing the game board, **Then** the board is vertically scrollable if it exceeds screen bounds.
2. **Given** a player on a touch device, **When** performing a pinch gesture, **Then** the board scales smoothly within the bounds of 50% minimum to 150% maximum zoom.
3. **Given** the board on any screen size, **When** attempting to select a tile, **Then** tap targets maintain a minimum size of 44x44px.

### Edge Cases

- What happens when a player attempts an invalid swap right as the 10th move is completed or time expires? -> The swap should be rejected and game-end state takes precedence without triggering swap animations if the UI is locked.
- How does the system handle rapid repeated invalid swaps? -> Animation should either refresh seamlessly or lock further inputs safely until the error state presentation clears.
- What if the user zooms out excessively? -> Bounded minimum zoom of 50% ensures the board remains safely interactable.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST animate an invalid swap with a shake effect of 3-4 oscillations lasting 300-400ms on the affected tiles.
- **FR-002**: System MUST flash a red border around the tiles involved in an invalid swap for exactly 200ms.
- **FR-003**: System MUST display the exact move progress of both players in the TimerHud UI, replacing the placeholder "Round X" with a dynamic `M{num}` representation.
- **FR-004**: System MUST allow vertical scrolling for the board layout when viewed on a mobile viewport.
- **FR-005**: System MUST implement pinch-to-zoom capabilities for the game board, bounded between 50% and 150% scaling.
- **FR-006**: System MUST ensure that touch targets (tiles and UI elements) are never smaller than 44x44px for accessibility on all zoom levels and devices.

### Assumptions

- **A-001**: Optional audio error cues for invalid swaps are deferred for now unless a sound system is already established; we assume visual feedback is the priority MVP requirement.
- **A-002**: Zooming the board preserves the center focus of the current user's view and doesn't scroll them away from the action.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Invalid swap animations (shake and red border) execute and complete in under 450ms combined.
- **SC-002**: The HUD accurately updates the move count within 100ms of a confirmed successful turn execution.
- **SC-003**: The game board renders correctly on a standard 390px width mobile viewport (e.g. iPhone 12/13/14 format) with functioning vertical scrolling.
- **SC-004**: All interactive tiles maintain a bounding box of at least 44x44 pixels across the entire zoom range (50% to 150%).
