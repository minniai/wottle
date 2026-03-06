# Feature Specification: Round History & Post-Game Recap

**Feature Branch**: `012-round-history-and-game-recap`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "Round History & Post-Game Recap — an interactive panel showing per-round scoring breakdown with expandable word details, board-word highlight linkage, and summary callouts for biggest swing round and highest-scoring word."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Post-Game Round-by-Round Review (Priority: P1)

After a match ends, a player wants to review how the game unfolded round by round. They open the round history panel on the final summary screen and see a compact timeline: one row per round showing each player's score change and running total. They expand a round to see which words were found, their lengths, and point breakdowns.

**Why this priority**: The core value of this feature — understanding what happened each round — is meaningless without the ability to browse round-by-round scoring. This is the foundational data display that all other stories build on.

**Independent Test**: Can be fully tested by completing a match and verifying the panel displays the correct number of rounds with accurate per-round and cumulative scores. Delivers immediate analytical value.

**Acceptance Scenarios**:

1. **Given** a completed match, **When** the player views the final summary screen, **Then** a round history panel is visible showing one row per round (1 through the total number of completed rounds) with each player's score delta and cumulative score for that round.
2. **Given** a round row in the history panel, **When** the player expands it, **Then** a list of all words scored in that round is shown, each displaying the word text, letter count, letter points, bonus points, and total points.
3. **Given** a round where neither player scored any words, **When** viewing that round's row, **Then** the row clearly indicates no words were scored (e.g., a dash or "No words" label) and expanding it shows an empty word list.
4. **Given** a round where a duplicate word was played, **When** viewing that round's expanded details, **Then** the duplicate word is listed but visually distinguished (e.g., strikethrough or dimmed) with zero points shown.

---

### User Story 2 - Summary Callouts (Priority: P1)

After a match, the player wants quick highlights: which round had the biggest scoring swing between the two players, and what the single highest-scoring word of the entire match was. These callouts appear at the top of the round history panel without needing to dig into individual rounds.

**Why this priority**: These callouts surface the most interesting moments instantly — they are the "headline stats" that make the recap feel insightful rather than just a data dump. Tied with P1 because they are low-effort given the data already exists and dramatically improve perceived value.

**Independent Test**: Can be tested by completing a match and verifying the callout section correctly identifies the round with the largest inter-player score difference and the single word with the highest total points.

**Acceptance Scenarios**:

1. **Given** a completed match, **When** viewing the round history panel, **Then** a callout displays "Biggest swing: Round N" where N is the round with the largest absolute difference between the two players' score deltas for that round.
2. **Given** a completed match, **When** viewing the round history panel, **Then** a callout displays the highest-scoring word, its point value, the player who scored it, and the round number it occurred in.
3. **Given** a match where two rounds tie for the biggest swing, **When** viewing the callout, **Then** the earlier round is shown.
4. **Given** a match where two words tie for the highest score, **When** viewing the callout, **Then** the word from the earlier round is shown (and if same round, the first player alphabetically by username).

---

### User Story 3 - Board-Word Highlight Linkage (Priority: P2)

While reviewing round history, a player clicks or hovers on a word entry and the board momentarily highlights the tiles where that word was formed. This helps the player visualize the spatial dimension of the game — where on the board each word appeared.

**Why this priority**: This is the interactive "wow" feature that connects abstract scoring data back to the physical board. Deprioritized slightly because the panel is useful even without it, and it depends on the board being visible alongside the history.

**Independent Test**: Can be tested by expanding a round, hovering/clicking a word, and verifying the corresponding tile coordinates on the board receive a visible highlight.

**Acceptance Scenarios**:

1. **Given** the round history panel is open alongside the board on the final summary screen, **When** the player clicks or hovers on a word in the expanded round details, **Then** the tiles at that word's coordinates are highlighted on the board using the scoring player's color.
2. **Given** a word is being highlighted on the board, **When** the player moves focus to a different word or away from the word list, **Then** the previous highlight is removed and the new word's tiles are highlighted (or no highlight if focus left the list).
3. **Given** a word whose tiles overlap with frozen tiles, **When** that word is highlighted, **Then** the highlight is visible on top of or alongside the frozen-tile visual treatment without obscuring either indicator.
4. **Given** reduced-motion preferences are active, **When** a word is highlighted on the board, **Then** the highlight uses a static outline or tint with no animation (no glow pulse or fade transition).

---

### User Story 4 - In-Game Round History Access (Priority: P3)

During a match, a player wants to review scoring from previously completed rounds without leaving the game. A small icon or button opens the round history panel in a read-only overlay or drawer showing only rounds that have already resolved.

**Why this priority**: This is a stretch goal. The primary use case is post-game review. In-game access is a convenience feature that adds complexity (overlay management, ensuring it doesn't interfere with gameplay) for a secondary need.

**Independent Test**: Can be tested mid-match by clicking the history button after at least one round completes, verifying the panel opens showing only completed rounds, and confirming it can be dismissed to return to active gameplay.

**Acceptance Scenarios**:

1. **Given** a match in progress with at least one completed round, **When** the player activates the history button, **Then** a read-only panel opens showing round history for completed rounds only.
2. **Given** the in-game history panel is open, **When** a new round completes, **Then** the panel updates to include the newly completed round.
3. **Given** the in-game history panel is open, **When** the player dismisses it (close button, Escape key, or clicking outside), **Then** the panel closes and full gameplay controls are restored.
4. **Given** a match where no rounds have completed yet, **When** looking at the game UI, **Then** the history button is either hidden or disabled with an appropriate tooltip.

---

### Edge Cases

- What happens when a match ends early (timeout, disconnect) with fewer than 10 rounds? The panel shows only the rounds that were actually completed.
- What happens when a word's tile coordinates reference positions that have since been swapped? The highlight is applied to those coordinates on the final board as-is. The letters at those positions may differ from the original word — this is acceptable since storing per-round board snapshots would require new persistence. The word text in the history panel provides the context.
- What happens when the board is not visible (e.g., on a narrow mobile screen where the history panel takes full width)? Word highlighting is suppressed or deferred — the highlight only activates when the board is in the viewport.
- What happens when both players scored zero in every round? The callout section shows "No scored words" instead of a highest-scoring word, and the biggest swing callout shows "No scoring swings" or equivalent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a round history panel on the final summary screen as a tabbed view, where tabs (e.g., "Overview" / "Round History") switch between the existing summary content and the round history panel. The panel shows one entry per completed round.
- **FR-002**: Each round entry MUST show the round number, each player's score delta for that round, and each player's cumulative score after that round.
- **FR-003**: Each round entry MUST be expandable to reveal words grouped by player (Player A's words then Player B's words, each section labeled with the player's name). Each word displays: word text, letter count, letter points, bonus points, and total points. When a combo bonus was awarded to a player in that round, it MUST appear as a separate line item below that player's words (e.g., "Combo +15").
- **FR-004**: Duplicate words MUST be visually distinguished from scoring words (e.g., dimmed or struck through) and shown with zero points.
- **FR-005**: The panel MUST display a "Biggest swing round" callout identifying the round with the largest absolute difference between the two players' round deltas, with ties broken by earlier round.
- **FR-006**: The panel MUST display a "Highest-scoring word" callout showing the word, its points, the scoring player, and the round it occurred in, with ties broken by earlier round.
- **FR-007**: Clicking or hovering a word in the expanded round details MUST highlight the corresponding tile coordinates on the board using the scoring player's color.
- **FR-008**: Board highlights MUST be removed when focus/hover leaves the word entry.
- **FR-009**: Board highlights MUST coexist visually with frozen-tile indicators without obscuring either.
- **FR-010**: Under reduced-motion preferences, board highlights MUST use a static visual treatment (outline or tint) with no animation.
- **FR-011**: The round history panel MUST be keyboard-navigable with proper focus management (tab through rounds, Enter/Space to expand, arrow keys within word lists).
- **FR-012**: Expandable round sections MUST have appropriate ARIA attributes (aria-expanded, aria-controls) and word lists MUST be labeled for screen readers.
- **FR-013**: (Stretch) During a match, a button MUST be available to open a read-only history panel showing only completed rounds.
- **FR-014**: (Stretch) The in-game history panel MUST update when new rounds complete and MUST be dismissible via close button, Escape key, or outside click.
- **FR-015**: The panel MUST handle matches that ended with fewer than 10 rounds, showing only rounds that were completed.
- **FR-016**: When both players scored zero across all rounds, callout sections MUST display appropriate "no data" messaging instead of empty or broken displays.

### Key Entities

- **Round Entry**: A single round's scoring snapshot — round number, per-player score delta, per-player cumulative score, and a list of words scored.
- **Word Entry**: A single scored word within a round — the word text, its length, point breakdown (letter points, bonus points, total), the scoring player, and the tile coordinates where it appeared.
- **Summary Callout**: A computed highlight derived from the full match history — biggest swing round (max inter-player delta difference) and highest-scoring individual word.

## Clarifications

### Session 2026-03-06

- Q: How should the round history panel be presented on the final summary screen — side drawer, tabbed view, or inline below? → A: Tabbed view — tabs at the top of the summary area (e.g., "Overview" / "Round History") switch between FinalSummary content and the round history panel.
- Q: Should combo bonus be visible in the expanded round details, or folded silently into the total? → A: Show as a separate line item below the player's word list when present (e.g., "Combo +15").
- Q: Should words in expanded round details be grouped by player or shown as a single mixed list? → A: Grouped by player — Player A's words (+ combo), then Player B's words (+ combo), each section labeled with the player's name.
- Q: Board shows final state but highlighted coordinates may point to different letters than the original word — is this acceptable? → A: Yes, highlight on the final board as-is. Tiles may have moved; the word text in the panel provides context. No per-round board snapshots needed.

## Scope Boundaries

- **No new persistence**: All data comes from existing in-memory match state and real-time payloads. No new database tables, storage, or server endpoints are added.
- **No new matchmaking flows**: Rematch buttons, Elo ratings, and ranked modes are out of scope.
- **No rules changes**: The word engine, scoring formula, and frozen-tile mechanics remain unchanged.
- **No replay functionality**: This feature shows static historical data, not a re-playable animation of moves.

## Assumptions

- The final summary screen already receives per-round scoring data (scoreboard rows) and a flat word history list with per-word point breakdowns. The round history panel restructures this data for display without requiring new data fetching.
- Word coordinate data (tile positions) is available in the word history entries passed to the summary screen. If coordinates are not currently included in the summary data flow, they will need to be added to the existing data pipeline.
- The board component on the final summary screen can accept an external set of tile coordinates to highlight, similar to how scored-tile highlights work during gameplay.
- During in-game access (stretch goal), completed round summaries can be accumulated client-side as they arrive via real-time broadcasts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can identify the highest-scoring word and biggest swing round within 5 seconds of opening the round history panel (callouts are immediately visible without scrolling or interaction).
- **SC-002**: Players can expand any round and see its full word breakdown within a single click/tap interaction.
- **SC-003**: Clicking a word in the history causes a visible board highlight within 200ms, providing instant spatial feedback.
- **SC-004**: The round history panel correctly displays data for 100% of completed rounds, including edge cases of early termination and zero-score rounds.
- **SC-005**: All interactive elements (expand/collapse, word hover, dismiss) are operable via keyboard alone, meeting WCAG 2.1 Level A criteria.
- **SC-006**: Reduced-motion users see static highlight treatments with no animated transitions for board-word linkage.
