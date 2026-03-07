# Feature Specification: Move Playability Improvements

**Feature Branch**: `014-move-playability-improvements`
**Created**: 2026-03-07
**Status**: Draft
**Input**: User description: "Multiple playability improvements needed before playtest — move locking, visual move feedback, prominent timers, dual-timeout game end, frozen tile colors on final summary, tile score values, and always-visible round summary table."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move Lock and Swap Visibility (Priority: P1)

After a player submits their move (tile swap), the swapped tiles remain in their new positions on the board — visually highlighted in orange — and the player is prevented from making further moves until the next round begins. The opponent sees only that the first player's timer has paused, not which tiles were swapped.

**Why this priority**: Core gameplay clarity. Without move locking and visible swap persistence, players are confused about whether their move was accepted and may attempt additional swaps. This is the most fundamental playability gap.

**Independent Test**: A player submits a swap, sees tiles stay in place with orange highlight, and cannot interact with the board until the opponent submits.

**Acceptance Scenarios**:

1. **Given** a player's turn is active, **When** they submit a valid tile swap, **Then** the two swapped tiles remain in their new positions (not reversed) and are highlighted with an orange background until the next round begins.
2. **Given** a player has submitted their move this round, **When** they attempt to select or swap another tile, **Then** the board does not respond to tile interactions (clicks/taps are ignored).
3. **Given** Player A has submitted their move, **When** Player B views the board, **Then** Player B sees Player A's timer change to paused state but does NOT see which tiles Player A swapped.

---

### User Story 2 - Opponent Move Reveal on Round Completion (Priority: P1)

When a round completes (both players have submitted), each player is briefly shown the opponent's swapped tiles highlighted in orange, which then fades out to the tile's correct color (frozen owner color or default).

**Why this priority**: Players need to understand what their opponent did each round to develop counter-strategies. Without this, the game feels opaque.

**Independent Test**: Both players submit moves; each player sees the opponent's swapped tiles flash orange and fade to final color.

**Acceptance Scenarios**:

1. **Given** both players have submitted their moves and the round resolves, **When** the new board state is received, **Then** the tiles that the opponent swapped are briefly highlighted in orange (opponent move reveal plays first, before scored-tile-highlight).
2. **Given** opponent's swapped tiles are highlighted in orange, **When** approximately 1 second elapses, **Then** the orange highlight fades out smoothly to the tile's final color (frozen color or default tile color), and only then does the scored-tile-highlight animation begin.
3. **Given** a player views the round completion, **When** the opponent move reveal plays, **Then** only the opponent's two swapped tiles are highlighted — the player's own swapped tiles are not re-highlighted.

---

### User Story 3 - Prominent Timer with Status Colors (Priority: P1)

Both players' timers are displayed prominently as colored panels/tiles. The timer background color indicates status: green when actively ticking, orange when paused (move submitted, waiting for opponent), and red when time has expired.

**Why this priority**: Timer awareness is critical for competitive play. The current small text timers with subtle color changes are easily overlooked, leading to accidental timeouts.

**Independent Test**: Timer panels are clearly visible with distinct green/orange/red backgrounds matching the player's current status.

**Acceptance Scenarios**:

1. **Given** a player's timer is actively counting down, **When** the player views the game screen, **Then** their timer is displayed in a prominent panel with a green background.
2. **Given** a player has submitted their move and is waiting for the opponent, **When** the player views the game screen, **Then** their timer panel has an orange background indicating paused state.
3. **Given** a player's time has fully expired (0:00), **When** either player views the game screen, **Then** the expired timer panel has a red background.
4. **Given** both players are in a game, **When** they view the screen, **Then** both the current player's and the opponent's timer panels are visible with appropriate status colors.

---

### User Story 4 - Dual Timeout Game End (Priority: P2)

When both players' timers reach zero during a round, the game immediately ends with a timeout indication and navigates directly to the final summary screen.

**Why this priority**: Without this, a game can stall indefinitely when both players time out. Important for a functional playtest but slightly lower priority than visual clarity improvements.

**Independent Test**: Both timers expire; game ends immediately and displays the summary screen with a timeout reason.

**Acceptance Scenarios**:

1. **Given** both players' timers have reached zero, **When** the system detects dual timeout, **Then** the match is immediately marked as completed with a "dual_timeout" end reason.
2. **Given** a dual timeout has been detected, **When** the game ends, **Then** players are navigated directly to the final summary screen without waiting for move submissions.
3. **Given** a dual timeout game ends, **When** the final summary is displayed, **Then** it clearly indicates the game ended due to both players running out of time.

---

### User Story 5 - Frozen Tile Colors on Final Summary Board (Priority: P2)

The final game summary screen displays the board with frozen tile colors, showing which tiles were scored by each player (using player-specific overlay colors).

**Why this priority**: Gives players a visual sense of territorial control at game end. Enhances the debrief experience.

**Independent Test**: After a completed game, the summary screen board shows tiles colored by owning player.

**Acceptance Scenarios**:

1. **Given** a completed game with scored/frozen tiles, **When** the final summary board is displayed, **Then** frozen tiles show their owner's color (player A color vs player B color).
2. **Given** a completed game, **When** the player views the final summary board, **Then** unfrozen tiles appear in the default tile color, clearly distinguishable from frozen tiles.

---

### User Story 6 - Tile Score Values (Priority: P2)

Each tile on the board displays a small number in the bottom-right corner showing its letter's point value (Scrabble-style), helping players make strategic swap decisions.

**Why this priority**: Strategic depth — players need to see letter values to make informed decisions about which tiles to swap. Important for gameplay quality but the game functions without it.

**Independent Test**: Every tile on the board shows a small point value number matching the Icelandic letter scoring system.

**Acceptance Scenarios**:

1. **Given** a board with Icelandic letter tiles, **When** the player views the board, **Then** each tile displays its point value as a small number in the bottom-right corner.
2. **Given** tiles with different point values (e.g., A=1, X=10), **When** the player views the board, **Then** the displayed values correctly match the Icelandic Krafla scoring system.
3. **Given** any board view (active game, round summary highlight, final summary), **When** tiles are displayed, **Then** the point value is visible and does not interfere with the primary letter display.

---

### User Story 7 - Always-Visible Round Summary Table (Priority: P3)

The round summary table/panel is visible from the start of the game (first round), even when empty, so that its appearance after round 1 does not cause a jarring layout shift.

**Why this priority**: Layout stability improves user experience but is cosmetic. The game is fully playable without it; the shift is just distracting.

**Independent Test**: Start a new game; the round summary area is visible (possibly empty) from round 1 without layout changes when it populates.

**Acceptance Scenarios**:

1. **Given** a new game has just started (round 1, no completed rounds), **When** the player views the game screen, **Then** the round summary table area is visible in its designated position (right panel on wide screens, below board on narrow screens) as blank reserved space with no placeholder text or headers.
2. **Given** the round summary table area is blank in round 1, **When** round 1 completes and summary data arrives, **Then** the table populates without causing any layout shift or screen reshaping.
3. **Given** rounds have completed, **When** the player views the round summary table, **Then** it shows cumulative round-by-round scoring data.

---

### Edge Cases

- What happens if a player disconnects after submitting their move? The move lock and orange highlight should persist; on reconnection, the player should see their submitted move still highlighted.
- What happens if the round resolves during the opponent-move-reveal animation? The animation should complete (or be cut short gracefully) before proceeding to the next round state.
- What happens if a tile swap involves a frozen tile? Frozen tiles already block swaps — the move lock state should not activate for rejected swaps.
- What happens on very small screens where the round summary table might not fit? The table should appear below the board (existing responsive behavior) but still be present from round 1.

## Clarifications

### Session 2026-03-07

- Q: What is the animation sequence on round completion — opponent move reveal vs scored-tile-highlight? → A: Opponent move reveal first (~1s fade), then scored-tile-highlight (~700ms glow), then summary panel.
- Q: What should the empty round summary table display before any rounds complete? → A: Table area visible but completely blank (reserved space only, no placeholder text or headers).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST prevent a player from making additional tile swaps after they have submitted a move for the current round, until the next round begins.
- **FR-002**: System MUST keep swapped tiles in their new (post-swap) positions after submission — tiles MUST NOT animate back to their original positions.
- **FR-003**: System MUST highlight the two swapped tiles with an orange background after the submitting player's move is accepted, persisting until the next round begins.
- **FR-004**: System MUST NOT reveal a player's swapped tile positions to the opponent before round resolution.
- **FR-005**: System MUST briefly highlight the opponent's swapped tiles in orange at round completion, then fade to the tile's final color over approximately 1 second. This opponent-move-reveal animation MUST play before the scored-tile-highlight animation begins.
- **FR-006**: System MUST display both players' timers as prominent panels with colored backgrounds: green (running), orange (paused), red (expired/zero).
- **FR-007**: System MUST immediately end the match when both players' timers reach zero, marking the match as completed with a dual-timeout reason.
- **FR-008**: System MUST navigate players directly to the final summary screen on dual timeout without waiting for move submissions.
- **FR-009**: System MUST display frozen tile owner colors on the board in the final game summary screen.
- **FR-010**: System MUST display each tile's letter point value as a small number in the bottom-right corner of the tile (Scrabble-style).
- **FR-011**: System MUST show the round summary table area from the beginning of the game (round 1), even when no rounds have completed yet.
- **FR-012**: System MUST NOT cause layout shifts when the round summary table first populates with data after round 1.

### Key Entities

- **Move Lock State**: Per-player, per-round flag indicating whether the player has submitted their move and is locked from further interactions. Includes the coordinates of the two swapped tiles for visual highlighting.
- **Timer Status**: Enum of running/paused/expired states driving the visual timer panel color.
- **Opponent Move Reveal**: Transient UI state carrying the coordinates of the opponent's swapped tiles for the fade-out animation at round completion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After submitting a move, players can clearly identify which tiles they swapped (orange highlight visible) and cannot interact with the board until the next round — verified by 100% of playtesters understanding their move was accepted.
- **SC-002**: Players can identify at a glance whether each timer is running, paused, or expired based on the colored panel — no player confuses timer states during playtest.
- **SC-003**: Players can see their opponent's move at round completion via the orange fade-out animation — improving strategic awareness.
- **SC-004**: Games where both players time out end immediately rather than stalling — no stuck games during playtest.
- **SC-005**: Final summary board shows tile ownership colors — players can visually assess territorial control at game end.
- **SC-006**: Tile point values are visible and legible on all supported screen sizes without obscuring the primary letter.
- **SC-007**: No layout shift occurs when the round summary table populates after round 1 — measured as zero Cumulative Layout Shift (CLS) contribution from the summary panel.
