# Feature Specification: Fix Lobby Empty State

**Feature Branch**: `073-fix-lobby-empty-state`  
**Created**: 2026-09-25  
**Status**: Draft  
**Input**: User description: "Fix the lobby so a new player with no completed games sees an empty last-game state rather than a random full board, and the lobby layout remains usable when the viewport narrows."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View an honest first-game lobby (Priority: P1)

As a newly registered player with no completed games, I can open the lobby without being shown a fictitious board as my last game.

**Why this priority**: A fabricated game record confuses new players about their game history and the state of the product.

**Independent Test**: Open the lobby as a player with zero completed games and confirm that the last-game area clearly communicates that no prior game is available and contains no letter board.

**Acceptance Scenarios**:

1. **Given** a player has zero completed games, **When** they open the lobby, **Then** the last-game area communicates that no prior game is available.
2. **Given** a player has zero completed games, **When** they open the lobby, **Then** no board of letter tiles is displayed as a previous game.

---

### User Story 2 - Retain a completed-game preview (Priority: P2)

As a player with a completed game, I can still see my most recent completed game in the lobby.

**Why this priority**: The correction must not remove the useful recent-game preview for established players.

**Independent Test**: Open the lobby as a player with a completed game and confirm that the most recent completed game preview remains available.

**Acceptance Scenarios**:

1. **Given** a player has at least one completed game, **When** they open the lobby, **Then** the last-game area represents their most recent completed game.

---

### User Story 3 - Use the lobby on a narrow screen (Priority: P2)

As a player on a narrow viewport, I can access all lobby information without the last-game content being clipped off the right edge.

**Why this priority**: A functional narrow layout is needed for phone and resized-browser use.

**Independent Test**: Reduce the viewport width and confirm the lobby reflows or scrolls as designed without clipping the last-game content.

**Acceptance Scenarios**:

1. **Given** a narrow viewport, **When** a player opens the lobby, **Then** the last-game area and its content remain fully reachable without horizontal clipping.

### Edge Cases

- A player with no completed games but an unfinished or abandoned match is still shown the no-prior-game state.
- A narrow viewport with a completed-game preview preserves access to the entire preview.
- Missing or unavailable completed-game data does not cause a generated board to appear.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The lobby MUST show a distinct no-prior-game state when the current player has no completed games.
- **FR-002**: The no-prior-game state MUST NOT display letter tiles or imply a played game.
- **FR-003**: The lobby MUST continue to show the most recent completed-game preview when one exists.
- **FR-004**: At narrow viewport widths, the lobby MUST keep all last-game information and preview content fully reachable.
- **FR-005**: The lobby MUST remain readable at the supported narrow layout without decorative or content elements extending beyond the visible page width.

### Key Entities

- **Player match history**: The player's set of completed and non-completed games, used to decide whether a recent-game preview exists.
- **Last-game preview**: The lobby representation of the player's most recent completed game, or its explicit empty state.

## Assumptions

- A game is eligible for the last-game preview only after it is completed.
- The existing visual language will be used for the empty state and responsive layout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested zero-completed-game cases, the lobby presents no letter board as a prior game.
- **SC-002**: In 100% of tested completed-game cases, the most recent completed-game preview remains available.
- **SC-003**: At each supported narrow viewport width, all last-game content can be reached without page-level horizontal clipping.
- **SC-004**: A new player can identify that they have no prior completed game from the lobby without opening another page.
