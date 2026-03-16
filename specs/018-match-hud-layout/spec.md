# Feature Specification: Match HUD Three-Column Layout

**Feature Branch**: `018-match-hud-layout`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User description: "The playability of the game is bad because the UI is very incomplete. The players don't see the timers, the score, the round number or their user names or avatars while playing. The user interface during playing should be more informative and enhance the playing experience during play. In desktop browser, where there is room, the screen should be divided into three sections, left side should be the current player's info, middle should be the playing board, right side should be the opponent."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Three-Column Match Layout with Player Panels (Priority: P1)

During an active match on a desktop browser, each player sees a three-column layout: their own information panel on the left, the game board in the center, and their opponent's information panel on the right. Each panel displays the player's display name, avatar, current score, and chess-clock timer. The round number is displayed prominently so both players always know which round they are in (out of 10).

**Why this priority**: This is the core layout change that addresses the primary complaint — players cannot see essential game information during play. Without this, the game feels incomplete and disorienting.

**Independent Test**: Can be fully tested by starting a match between two players on desktop and verifying that both players see their own info on the left, opponent info on the right, the board in the center, and all key data (name, avatar, score, timer, round) is visible at a glance.

**Acceptance Scenarios**:

1. **Given** a match is in progress on a desktop browser (viewport ≥ 900px), **When** a player views the match page, **Then** they see a three-column layout with their own player panel on the left, the game board in the center, and the opponent's player panel on the right.
2. **Given** a match is in progress, **When** a player looks at either player panel, **Then** they see the player's display name, avatar (or placeholder), current score, and remaining timer displayed prominently.
3. **Given** a match is in progress, **When** a player looks at the layout, **Then** the current round number (e.g., "Round 3 of 10") is clearly visible.
4. **Given** a match is in progress, **When** the timer is running for a player, **Then** the active timer has a distinct colored background that visually distinguishes it from the paused timer, and the time is displayed in a large, easily readable font.

---

### User Story 2 - Prominent Timer Display (Priority: P1)

Each player's timer is the most visually dominant element in their panel. The timer is displayed in a large rectangle with a colored background — the active player's timer uses a vivid/warm color to convey urgency, while the waiting player's timer uses a muted/cool color. The timer counts down in real time with at least 1-second precision.

**Why this priority**: Time pressure is the core tension mechanic in Wottle. Players must instantly see how much time they and their opponent have remaining. A prominent, color-coded timer is essential for competitive play.

**Independent Test**: Can be tested by observing the timer display during gameplay — verify the active timer stands out visually, updates in real time, and the color scheme clearly indicates whose turn is ticking.

**Acceptance Scenarios**:

1. **Given** it is a player's turn (their timer is running), **When** they view their own panel, **Then** their timer is displayed in a large font inside a colored rectangle with a vivid/warm background color.
2. **Given** it is a player's turn, **When** they view the opponent's panel, **Then** the opponent's timer is displayed with a muted/cool background color indicating it is paused.
3. **Given** a player's timer is below 30 seconds, **When** they view the timer, **Then** the timer display shows a visual urgency indicator (e.g., pulsing, color shift to red/warning).
4. **Given** a player has submitted their move, **When** they view the timers, **Then** their own timer shows a "submitted" visual state and the display reflects that they are waiting for the opponent.

---

### User Story 3 - Player Identity Display (Priority: P2)

Each player panel shows the player's display name and avatar. If a player has set an avatar, it is displayed as a small image. If no avatar is set, a placeholder icon or initial-based avatar is shown. The player's Elo rating is displayed beneath their name.

**Why this priority**: Knowing who you are playing against personalizes the experience and makes matches feel competitive. Display names and avatars transform anonymous gameplay into a social experience.

**Independent Test**: Can be tested by starting a match where both players have display names and one has an avatar — verify names, avatars (or placeholders), and ratings appear in each panel.

**Acceptance Scenarios**:

1. **Given** a match is in progress, **When** a player views either panel, **Then** the player's display name is shown (not a truncated UUID).
2. **Given** a player has set an avatar, **When** viewing their panel, **Then** the avatar image is displayed.
3. **Given** a player has no avatar set, **When** viewing their panel, **Then** a placeholder avatar (first letter of display name in a colored circle) is shown.
4. **Given** a player has an Elo rating, **When** viewing their panel, **Then** the rating is displayed near their name.

---

### User Story 4 - Responsive Layout for Smaller Screens (Priority: P2)

On smaller screens (tablets and phones), the three-column layout gracefully adapts. The player panels collapse into compact horizontal bars above and below the board (opponent at top, current player at bottom), preserving all essential information (timer, score, name) in a space-efficient format.

**Why this priority**: Many playtest sessions happen on varied devices. The layout must degrade gracefully so the game remains playable on tablets and large phones without losing critical information.

**Independent Test**: Can be tested by resizing the browser window below the desktop breakpoint and verifying that player info, timers, and scores remain visible in a compact format above/below the board.

**Acceptance Scenarios**:

1. **Given** a match is viewed on a screen narrower than the desktop breakpoint, **When** the page renders, **Then** player panels appear as compact horizontal bars (opponent at top, player at bottom) rather than side columns.
2. **Given** the compact layout is active, **When** a player views the bars, **Then** timer, score, and player name are all visible without scrolling.
3. **Given** the viewport is resized from desktop to mobile width during a match, **When** the layout transitions, **Then** no game state or information is lost during the transition.

---

### User Story 5 - Score Display with Round Context (Priority: P2)

Each player's current total score is prominently displayed in their panel, with clear visual hierarchy. The round number is shown in a shared location (e.g., above the board or in both panels). After each round resolves, the score updates visibly, and the existing ScoreDeltaPopup integration continues to work.

**Why this priority**: Score awareness drives strategic play. Players need to know the score differential to decide whether to play safe or take risks in remaining rounds.

**Independent Test**: Can be tested by playing through multiple rounds and verifying scores update after each round, the round counter advances, and the score delta popup still appears.

**Acceptance Scenarios**:

1. **Given** a round has just resolved, **When** the player views the panels, **Then** both scores reflect the updated totals.
2. **Given** a match is at round 5 of 10, **When** the player views the layout, **Then** the round indicator clearly shows "Round 5 of 10" (or equivalent).
3. **Given** a round resolves with a score change, **When** the scores update, **Then** the ScoreDeltaPopup continues to display the breakdown as it does today.

---

### Edge Cases

- What happens when a player's display name is very long (>20 characters)? Truncate with ellipsis to prevent layout overflow.
- What happens when both players have the same display name? Display names are shown as-is (no disambiguation required — players know which side is theirs).
- What happens when a player disconnects mid-match? The disconnected player's panel shows a "Disconnected" indicator; their timer behavior follows existing reconnection logic.
- What happens when the board takes up too much space on narrow desktop viewports (900px-1100px)? The side panels narrow proportionally, prioritizing timer and score visibility; avatar and name may shrink.
- What happens when a player has no Elo rating yet (new player)? Show a default indicator (e.g., "Unrated" or a dash).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The match page MUST display a three-column layout on desktop viewports (≥ 900px wide): left player panel, center board, right player panel.
- **FR-002**: The left panel MUST always show the current player's information; the right panel MUST always show the opponent's information.
- **FR-003**: Each player panel MUST display: display name, avatar (or placeholder), current total score, and remaining timer.
- **FR-004**: The timer MUST be the most visually prominent element in each player panel, displayed in a large font inside a colored rectangle.
- **FR-005**: The active player's timer MUST have a visually distinct background color (vivid/warm) compared to the paused player's timer (muted/cool).
- **FR-006**: When a player's remaining time drops below 30 seconds, their timer MUST display a visual urgency indicator.
- **FR-007**: The current round number and total rounds (e.g., "Round 3 / 10") MUST be visible at all times during gameplay.
- **FR-008**: On viewports narrower than 900px, the layout MUST adapt to show player information in compact horizontal bars (opponent at top, player at bottom) with the board between them.
- **FR-009**: Player display names MUST be fetched and shown (not player UUIDs).
- **FR-010**: If a player has no avatar, the system MUST show a placeholder avatar derived from the first letter of their display name.
- **FR-011**: Player Elo ratings MUST be displayed in each player panel.
- **FR-012**: Display names longer than 20 characters MUST be truncated with an ellipsis.
- **FR-013**: The existing ScoreDeltaPopup, scored-tile highlights, and animation phase state machine MUST continue to function correctly with the new layout.
- **FR-014**: A "Submitted" visual indicator MUST appear on a player's panel when they have submitted their move for the current round.
- **FR-015**: When a player is disconnected, their panel MUST show a disconnection indicator.
- **FR-016**: The RoundSummaryPanel MUST overlay the board as a modal/overlay card (board dimmed behind it) without disrupting the three-column layout.
- **FR-017**: The History button and Resign button MUST be placed in the current player's panel, below the score/timer section.

### Key Entities

- **Player Panel**: Visual container for one player's match information — contains display name, avatar, timer, score, submission status, and connection status.
- **Player Identity**: Existing entity (players table) providing display name, avatar URL, and Elo rating — must be loaded and available to the match UI.
- **Timer Display**: Visual representation of a player's remaining time — includes colored background, large font, urgency state, and active/paused distinction.

## Clarifications

### Session 2026-03-16

- Q: Where should the RoundSummaryPanel appear in the new three-column layout? → A: Overlays the board as a modal/overlay card (board visible but dimmed behind it); the three-column structure remains intact during round summaries.
- Q: Where should the History and Resign buttons go in the new layout? → A: In the current player's panel (left side), below the score/timer section.

## Assumptions

- Player display names and avatar URLs are already stored in the `players` table and accessible via `getPlayerProfile()` or can be included in the initial match state load.
- Elo ratings are stored in the `players` table (added by spec 017).
- The existing `GameChrome` component can be replaced or significantly refactored — backward compatibility with its current API is not required.
- The 900px breakpoint for desktop/mobile transition is consistent with existing responsive design.
- Timer precision remains at 1-second updates (matching current behavior).
- The board's container-query-based responsive sizing continues to work within the center column.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During an active match on desktop, players can identify all five key pieces of information (own name, opponent name, both timers, both scores, round number) within 2 seconds of glancing at the screen.
- **SC-002**: The active player's timer is visually distinguishable from the paused timer at arm's length (high contrast color difference).
- **SC-003**: The layout correctly transitions between three-column (desktop) and stacked (mobile) without any information loss when the viewport crosses the 900px threshold.
- **SC-004**: All existing match functionality (move submission, score popups, round summaries, resign, reconnection) continues to work without regression.
- **SC-005**: Player display names (not UUIDs) are shown for 100% of active matches.
- **SC-006**: The timer urgency indicator activates consistently when remaining time drops below 30 seconds.
