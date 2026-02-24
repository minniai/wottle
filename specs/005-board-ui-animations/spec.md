# Feature Specification: Board UI and Animations

**Feature Branch**: `005-board-ui-animations`
**Created**: 2026-02-23
**Status**: Draft
**Input**: Implement the PRD match layout (opponent bar, grid, player bar), responsive board sizing, frozen tile visual overlays, core interaction animations (swap, shake, word highlight), and game chrome (scores, move counter, timer state colors) to transform the match screen from a backend test harness into a playable game view.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - PRD Match Layout Structure (Priority: P1)

When a player enters a match, the screen displays the PRD-defined layout: an opponent bar at the top (showing opponent name, timer, and score), the 10x10 game board in the center, and a player bar at the bottom (showing the player's name, timer, score, and move counter). This replaces the current developer-oriented layout with test metadata.

**Why this priority**: The PRD layout is the foundational container for every other visual feature. Without the correct structure, responsive sizing, frozen tile overlays, and animations have no proper home. This is the frame that makes the game recognizable as a game.

**Independent Test**: Navigate to an active match. Verify the screen shows three distinct regions stacked vertically: opponent bar, board grid, player bar, with no debug metadata (match ID, status text, round limit) visible in the default view.

**Acceptance Scenarios**:

1. **Given** a player navigates to an active match, **When** the match page loads, **Then** the screen displays an opponent bar at the top, a 10x10 grid in the center, and a player bar at the bottom, matching the PRD Section 7.1 desktop layout diagram.
2. **Given** a match is in progress on a mobile viewport (width < 768px), **When** the player views the match, **Then** the layout stacks vertically with the opponent info bar, scrollable board, and player info bar per the PRD mobile layout diagram.
3. **Given** the match page loads, **When** the player scans the screen, **Then** no debug metadata (match ID, "Round limit", "Status", "Board Loading" placeholders) is visible in the default play view.

---

### User Story 2 - Board Fits Viewport on All Devices (Priority: P1)

The 10x10 game board scales to fit the available viewport space without overflowing or requiring horizontal scrolling. Tiles remain perfectly square and readable at all supported viewport sizes. The board uses the space between the opponent bar and player bar, never extending beyond the visible area on desktop.

**Why this priority**: The board currently overflows the screen, making the game unplayable. Fixing viewport fit is a prerequisite for all other visual features and is the single highest-impact change for playability.

**Independent Test**: Open a match on three viewport sizes (1280x800 desktop, 768x1024 tablet, 375x667 phone). Verify the board is fully visible, tiles are square, and no horizontal scrollbar appears.

**Acceptance Scenarios**:

1. **Given** a desktop viewport of 1280x800, **When** the match page loads, **Then** the full 10x10 grid is visible without scrolling and each tile is a square with readable text.
2. **Given** a tablet viewport of 768x1024, **When** the match page loads, **Then** the board fits within the space between opponent and player bars, tiles are square, and no horizontal scroll is present.
3. **Given** a phone viewport of 375x667, **When** the match page loads, **Then** the board scales down to fit the screen width, tiles remain square and readable, and vertical scrolling of the board is available if needed.
4. **Given** any supported viewport, **When** the browser window is resized, **Then** the board re-scales dynamically to fit the new dimensions without a page reload.

---

### User Story 3 - Scores and Move Counter in Game Chrome (Priority: P1)

Both players' current scores are displayed in their respective bars (opponent score in the opponent bar, player score in the player bar). A move counter formatted as "M{n}" is visible in the player bar, where n represents the current round number. Timers show the remaining time for each player.

**Why this priority**: Players need to see scores, timers, and round progress at a glance to make strategic decisions. This is core game information that the PRD requires in the chrome.

**Independent Test**: Start a match and complete two rounds. Verify that both players' scores update after each round, the move counter increments, and timers display remaining time.

**Acceptance Scenarios**:

1. **Given** a match where Player A has 45 points and Player B has 30 points, **When** the board displays for Player A, **Then** the opponent bar shows "30" and the player bar shows "45".
2. **Given** a match in round 3, **When** the player views the match, **Then** the player bar displays "M3" as the move counter.
3. **Given** both players' timers are running, **When** the match is in progress, **Then** each bar displays the respective player's remaining time.

---

### User Story 4 - Frozen Tiles Display Player Ownership (Priority: P1)

After a round resolves and words are scored, frozen tiles display a colored overlay at 40% opacity indicating which player claimed them. The player's own frozen tiles use their assigned color, the opponent's frozen tiles use the opponent's color, and tiles claimed by both players display a split-diagonal pattern combining both colors. Players can visually distinguish frozen tiles from unfrozen tiles at a glance.

**Why this priority**: Frozen tiles are the core strategic mechanic of Wottle. Without visual indication of territory ownership, players cannot plan moves around the constraint that frozen tiles cannot be swapped.

**Independent Test**: Complete a round that scores a word. Verify the tiles of the scored word display a colored overlay at 40% opacity using the scoring player's color.

**Acceptance Scenarios**:

1. **Given** a round resolves and Player A scores a word using tiles at (0,0) through (4,0), **When** the board updates, **Then** those tiles display Player A's color as a 40% opacity overlay.
2. **Given** tiles frozen by the opponent, **When** the player views the board, **Then** opponent-frozen tiles display the opponent's color at 40% opacity, visually distinct from the player's own frozen tiles.
3. **Given** a tile at (2,0) is claimed by both players, **When** the board displays, **Then** that tile shows a split-diagonal pattern with each player's color occupying one triangle.
4. **Given** frozen tiles with colored overlays, **When** measured for accessibility, **Then** the tile letter text maintains a minimum contrast ratio of 4.5:1 against the overlay background per WCAG 2.1 AA.

---

### User Story 5 - Tile Swap Animates Smoothly (Priority: P1)

When a player selects two tiles and confirms a swap, the tiles animate smoothly to their new positions over 150-250ms with easing. During the animation, further tile interactions are blocked to prevent conflicting inputs. The animation is GPU-accelerated and runs at 60 FPS.

**Why this priority**: Swap animation is the primary interaction in the game. Without it, moves feel instant and disorienting. The animation confirms to the player that their action was registered and shows exactly what changed.

**Independent Test**: Select two tiles and trigger a swap. Verify the tiles visually slide to each other's positions over 150-250ms, and that clicking other tiles during the animation does nothing.

**Acceptance Scenarios**:

1. **Given** a player selects tile A at (2,3) and tile B at (5,3), **When** the swap is confirmed, **Then** tile A animates to position (5,3) and tile B animates to position (2,3) simultaneously over 150-250ms with smooth easing.
2. **Given** a swap animation is in progress, **When** the player attempts to select or interact with other tiles, **Then** the interaction is ignored until the current animation completes.
3. **Given** the swap animation completes, **When** the tiles reach their final positions, **Then** the board state updates to reflect the new tile positions with no visual glitch or snap.

---

### User Story 6 - Invalid Swap Shows Rejection Feedback (Priority: P2)

When a player attempts an invalid swap (e.g., selecting a frozen tile), the selected tiles shake with 3-4 oscillations over 300-400ms and briefly flash with a red border for 200ms. The player immediately understands their move was rejected without needing to read an error message.

**Why this priority**: Clear rejection feedback prevents confusion and frustration. Without it, players may not realize their swap was rejected and may think the game is broken.

**Independent Test**: Attempt to swap a frozen tile. Verify the tiles shake visibly and a red border flashes, then tiles return to their original positions.

**Acceptance Scenarios**:

1. **Given** a player selects a frozen tile for swapping, **When** the swap is attempted, **Then** the selected tiles shake with 3-4 oscillations over 300-400ms.
2. **Given** an invalid swap attempt, **When** the shake animation plays, **Then** a red border flash of 200ms duration appears around the selected tiles simultaneously.
3. **Given** the shake animation completes, **When** the tiles settle, **Then** they return to their original positions and the board is ready for a new selection.

---

### User Story 7 - Word Discovery Highlights Scored Tiles (Priority: P2)

After a round resolves and new words are scored, the tiles belonging to each scored word briefly highlight with a pulsing glow using the scoring player's color. The highlight lasts 600-800ms total (200ms fade in, 200-400ms hold, 200ms fade out). Multiple words discovered in the same round highlight simultaneously.

**Why this priority**: Word highlights connect the abstract scoring event to the physical board, helping players understand which tiles formed words and building excitement. This is a key "game feel" feature.

**Independent Test**: Complete a round that scores two words. Verify both sets of tiles highlight simultaneously with a pulsing glow for 600-800ms.

**Acceptance Scenarios**:

1. **Given** a round resolves and Player A scores the word "LAND" at tiles (0,0)-(3,0), **When** the round summary appears, **Then** tiles (0,0), (1,0), (2,0), (3,0) highlight with Player A's color in a pulsing glow lasting 600-800ms.
2. **Given** a round resolves with two scored words, **When** the highlights trigger, **Then** both words' tiles highlight simultaneously (not sequentially).
3. **Given** the highlight animation, **When** timed, **Then** it follows the pattern: 200ms fade in, 200-400ms hold at full intensity, 200ms fade out.

---

### User Story 8 - Score Delta Popup Shows Breakdown (Priority: P3)

After a round resolves, a transient popup appears near the player's score showing a breakdown of points earned that round (e.g., "+18 letters, +3 length, +2 combo"). The popup fades in over 200ms, holds for 2-2.8s, and fades out over 200ms, then auto-dismisses.

**Why this priority**: The score delta popup is a polish feature that enhances scoring transparency. The round summary panel already provides detailed breakdowns, so this is supplementary. Deferring this to a later pass is acceptable.

**Independent Test**: Complete a round that scores a word. Verify a popup appears near the score showing the point breakdown and auto-dismisses after 2-3 seconds.

**Acceptance Scenarios**:

1. **Given** a round resolves and the player earns 23 points (18 letters + 5 length + 0 combo), **When** the round summary appears, **Then** a popup near the player's score shows "+18 letters, +5 length".
2. **Given** a score delta popup is displayed, **When** 2-3 seconds elapse, **Then** the popup fades out over 200ms and disappears without user interaction.
3. **Given** a score delta popup, **When** the player starts a new swap, **Then** the popup dismisses immediately.

---

### Edge Cases

- What happens when the viewport is extremely narrow (< 320px width)?
  - The board scales down but may become unreadable. A minimum tile size of 28px is enforced; if the viewport cannot accommodate 10 tiles at 28px plus padding, the board overflows horizontally with scroll enabled. This is an edge case for very small devices that are below the practical minimum for gameplay.
- What happens when a swap animation is interrupted by a round resolution broadcast?
  - The swap animation completes before the round resolution state is applied. Animation completion is a prerequisite for applying incoming state updates.
- What happens when many words are highlighted simultaneously (e.g., 4+ words from a combo)?
  - All word highlights play simultaneously. If tiles overlap between words, the tile shows the brightest/most recent highlight. Performance remains at 60 FPS due to GPU-accelerated transforms.
- What happens when the user has `prefers-reduced-motion` enabled?
  - All animations (swap, shake, highlight, popup) are replaced with instant state changes (no motion). Frozen tile overlays, layout, and score updates are unaffected.
- What happens when timer state changes (submitted vs. active) mid-round?
  - The timer display color updates immediately: green while the player has not submitted, neutral once submitted. No animation is needed for this transition.
- What happens to debug metadata (match ID, status) in development?
  - Debug metadata is hidden by default in the play view but can be toggled visible via a dev-only mechanism (e.g., URL parameter or keyboard shortcut). This is not exposed in production builds.

## Requirements _(mandatory)_

### Functional Requirements

#### PRD Layout Structure

- **FR-001**: System MUST display the match screen in three vertically stacked regions: opponent bar (top), 10x10 game board (center), player bar (bottom), matching the PRD Section 7.1 layout diagram.
- **FR-002**: The opponent bar MUST display the opponent's name/label, remaining timer, and current score.
- **FR-003**: The player bar MUST display the player's name/label, remaining timer, current score, and move counter formatted as "M{n}".
- **FR-004**: On mobile viewports (width < 768px), the layout MUST stack vertically with opponent info, board, and player info per the PRD mobile layout diagram. Timer and move counter MAY wrap to separate lines.
- **FR-005**: The layout MUST identify which bar belongs to which player by using the `playerSlot` assignment from the match state.

#### Responsive Board Sizing

- **FR-006**: The 10x10 game board MUST scale to fit the available space between the opponent bar and player bar without causing horizontal overflow on viewports >= 320px wide.
- **FR-007**: Board tiles MUST remain square (1:1 aspect ratio) at all viewport sizes.
- **FR-008**: The board MUST dynamically re-scale when the viewport is resized without requiring a page reload.
- **FR-009**: The board MUST enforce a minimum tile size of 28px to maintain readability. If the viewport cannot accommodate the board at this minimum size, horizontal scrolling is permitted.
- **FR-010**: On desktop viewports, the full 10x10 grid MUST be visible without any scrolling.

#### Game Chrome

- **FR-011**: The opponent bar MUST display the opponent's current cumulative score, sourced from `matchState.scores` using the opponent's player slot.
- **FR-012**: The player bar MUST display the player's current cumulative score, sourced from `matchState.scores` using the player's own slot.
- **FR-013**: The player bar MUST display a move counter formatted as "M{n}" where n is the current round number, derived from `matchState.currentRound`.
- **FR-014**: The timer display MUST show green when the respective player has not yet submitted their swap for the current round, and switch to a neutral color once they have submitted (their clock is paused), per PRD Section 7.2.

#### Declutter

- **FR-015**: The default match play view MUST NOT display debug metadata including: match ID, "Round limit" text, "Status" text, "Board Loading" placeholder, or "Players" section.
- **FR-016**: Debug metadata MUST remain accessible via a dev-only toggle mechanism (e.g., URL parameter or keyboard shortcut) that is not available in production builds.
- **FR-017**: Reconnect/polling banners, swap error messages, and the round summary panel MUST remain visible in the play view (these are gameplay-relevant, not debug information).
- **FR-017a**: While match state is loading (before initial data arrives), the board area MUST display a skeleton 10x10 grid with gray placeholder tiles (no letters). The skeleton MUST be replaced with the actual board once the match state is received, with no layout shift.

#### Frozen Tile Overlays

- **FR-018**: Frozen tiles MUST display a colored overlay at 40% opacity using the owning player's color: Blue (#3B82F6) for Player 1, Red (#EF4444) for Player 2.
- **FR-019**: Tiles frozen by the opponent MUST display the opponent's color at 40% opacity, visually distinct from the current player's frozen tiles.
- **FR-020**: Tiles claimed by both players MUST display a split-diagonal pattern where each player's color occupies one triangle of the tile.
- **FR-021**: The tile letter text on frozen tiles MUST maintain a minimum contrast ratio of 4.5:1 against the overlay background per WCAG 2.1 AA.
- **FR-022**: Frozen tile overlays MUST update immediately when a round resolves and new tiles are frozen, without requiring a page reload or manual refresh.

#### Swap Animation

- **FR-023**: When a valid swap is confirmed, the two tiles MUST animate to each other's positions simultaneously over 150-250ms with smooth easing.
- **FR-024**: During a swap animation, all tile interactions (selection, swapping) MUST be blocked until the animation completes.
- **FR-025**: Swap animations MUST use GPU-accelerated properties (transforms, opacity) to maintain 60 FPS.
- **FR-026**: After the swap animation completes, the board state MUST update to reflect the new tile positions with no visual discontinuity (snap or flicker).
- **FR-027**: The swap animation MUST complete before the move submission is sent to the server (animation is visual feedback for the local state change, not dependent on server response).

#### Invalid Swap Feedback

- **FR-028**: When a swap is rejected (frozen tile, invalid selection, etc.), the selected tiles MUST shake with 3-4 horizontal oscillations over 300-400ms.
- **FR-029**: Simultaneously with the shake, a red border MUST flash around the selected tiles for 200ms duration.
- **FR-030**: After the shake animation completes, tiles MUST return to their exact original positions.
- **FR-031**: Shake and red border animations MUST use GPU-accelerated properties to maintain 60 FPS.

#### Word Discovery Highlights

- **FR-032**: After a round resolves, tiles belonging to each newly scored word MUST highlight with a pulsing glow effect using the scoring player's assigned color.
- **FR-033**: The highlight timing MUST follow: 200ms fade in, 200-400ms hold at full intensity, 200ms fade out (600-800ms total).
- **FR-034**: Multiple words discovered in the same round MUST highlight simultaneously (not sequentially).
- **FR-035**: Word highlights MUST be visually distinct from frozen tile overlays (highlight is a temporary glow; overlay is a persistent tint).
- **FR-036**: The highlight coordinates MUST be sourced from the scored word data in the round summary broadcast.
- **FR-036a**: Round resolution visual events MUST play in this sequence: (1) word discovery highlights play on scored tiles (600-800ms), (2) frozen tile overlays appear on newly frozen tiles, (3) round summary panel displays. Each step begins only after the previous step completes.

#### Score Delta Popup (P3 - Deferrable)

- **FR-037**: After a round resolves, a transient popup MUST appear adjacent to the player's score display showing the point breakdown for that round.
- **FR-038**: The popup content MUST show individual components (e.g., "+18 letters, +5 length, +2 combo") with zero-value components omitted.
- **FR-039**: The popup MUST fade in over 200ms, hold for 2-2.8s, and fade out over 200ms, then auto-dismiss.
- **FR-040**: If the player begins a new interaction (tile selection) before the popup auto-dismisses, the popup MUST dismiss immediately.

#### Animation Performance

- **FR-041**: All animations (swap, shake, highlight, popup) MUST run at a sustained 60 FPS, verified by absence of dropped frames in browser performance profiling.
- **FR-042**: All animations MUST use GPU-accelerated CSS properties (transform, opacity) rather than layout-triggering properties (top, left, width, height).

#### Accessibility

- **FR-043**: All interactive elements (tiles, buttons) MUST meet the minimum 44x44px touch target size on mobile viewports per WCAG 2.5.5.
- **FR-044**: When `prefers-reduced-motion` media query is active, all animations (swap, shake, highlight, popup) MUST be replaced with instant state changes (no motion). Layout, overlays, and data updates remain functional.
- **FR-045**: Score updates, round transitions, and error states MUST be announced to screen readers via appropriate ARIA live regions.

## Clarifications

### Session 2026-02-23

- Q: What are the two player colors used for frozen tile overlays and word highlights? → A: Blue (#3B82F6) and Red (#EF4444) — standard competitive duel colors.
- Q: What is the visual sequence for round resolution events (highlights, overlays, summary panel)? → A: Sequential — word highlights play first (600-800ms), then frozen tile overlays appear, then the round summary panel shows.
- Q: What should the board display while match state is loading? → A: Skeleton 10x10 grid with gray placeholder tiles (no letters) that fills in when data arrives.

### Key Entities

- **GameChrome**: The non-board UI elements surrounding the game grid (opponent bar, player bar) that display scores, timers, move counter, and player identity.
- **FrozenTileOverlay**: The visual representation of a frozen tile's ownership state, rendered as a 40% opacity colored layer over the tile with letter text on top. Supports single-owner and dual-owner (split-diagonal) variants.
- **SwapAnimation**: The visual transition when two tiles exchange positions, parameterized by duration (150-250ms), easing function, and the two tile coordinates involved.
- **WordHighlight**: A temporary visual effect applied to tiles of a scored word after round resolution, parameterized by player color, timing (600-800ms), and tile coordinates.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The match layout conforms to the PRD Section 7.1 diagram on desktop (1280x800): opponent bar with timer + score at top, 10x10 grid centered, player bar with timer + score + M{n} at bottom.
- **SC-002**: The board fits entirely within the viewport on desktop (1280x800), tablet (768x1024), and phone (375x667) without horizontal scrolling, verified by visual inspection at each resolution.
- **SC-003**: No debug metadata (match ID, status, round limit) is visible in the default play view on production builds.
- **SC-004**: Frozen tiles display distinct ownership overlays: own-color, opponent-color, and split-diagonal for shared tiles, verified visually with all three ownership states present on a single board.
- **SC-005**: Tile swap animation duration is between 150ms and 250ms, measured via browser performance timeline or programmatic timing assertions.
- **SC-006**: Invalid swap shake animation shows 3-4 visible oscillations over 300-400ms with a concurrent red border flash, verified visually on a frozen tile swap attempt.
- **SC-007**: Word discovery highlight lasts 600-800ms with visible fade in and fade out phases, verified after a round that scores at least one word.
- **SC-008**: All animations run at 60 FPS with no visible jank, verified by Chrome DevTools Performance tab showing no dropped frames during swap and highlight sequences.
- **SC-009**: Touch targets for tiles measure at least 44x44px on mobile viewports, verified by element inspection on a 375px-wide viewport.
- **SC-010**: When `prefers-reduced-motion` is enabled in browser/OS settings, all animations are replaced with instant state changes (no visible motion), verified by toggling the preference and repeating the swap and highlight flows.
- **SC-011**: Frozen tile letter text maintains 4.5:1 contrast ratio against the overlay background, verified with a contrast checking tool for each player color at 40% opacity.

### Assumptions

- No server-side changes or database schema modifications are required for this feature. All data needed (scores, timers, frozen tiles, player slot, current round, word scores) is already available in the match state broadcast from spec 003.
- Player colors are Blue (#3B82F6) and Red (#EF4444). Player 1 (first slot) is Blue; Player 2 (second slot) is Red. These colors are used for frozen tile overlays, word highlights, and split-diagonal shared tiles.
- The existing `matchState.scores`, `matchState.currentRound`, `matchState.timers`, and `matchState.frozenTiles` fields provide all data needed for game chrome and frozen tile overlays.
- The `playerSlot` assignment (which player is "you" vs "opponent") is already determined at match join time and available in the client state.
- The round summary broadcast already includes scored word data with tile coordinates, which is sufficient for word highlight positioning.
- FR-037 through FR-040 (Score Delta Popup) are P3 and deferrable to a later spec if implementation time is constrained. The round summary panel already provides detailed scoring breakdowns.
- The move counter M{n} can be derived from `matchState.currentRound` without additional server-side state.
- The existing `MoveFeedback` component and round summary panel continue to function as-is; this spec adds new visual features alongside them, not as replacements.
