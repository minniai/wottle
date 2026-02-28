# Feature Specification: Word Discovery Highlights

**Feature Branch**: `010-word-discovery-highlights`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "Word Discovery Highlights (005 Phase 9) — scored tiles glow with the player's color for 600–800ms after round resolution, then frozen overlays are applied, then the round summary is shown. PRD §7.2 compliance. prefers-reduced-motion support."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scored Tile Glow After Round (Priority: P1)

After each round resolves, both players immediately see which tiles on the board were part of newly discovered words. Those tiles briefly glow in the scoring player's color (blue for one player, red for the other) for 600–800ms before returning to their normal appearance.

**Why this priority**: This is the core feature. It closes the feedback loop between a player's swap decision and the words it creates — making word discovery visible and spatially grounded rather than abstract. Without it, scoring feels disconnected from the board.

**Independent Test**: Open a match, complete a round in which at least one word is scored, and verify that the relevant tiles glow in the scoring player's color for approximately 700ms immediately after the round resolves.

**Acceptance Scenarios**:

1. **Given** a round resolves with Player A scoring a 4-letter word using tiles at positions (2,3), (2,4), (2,5), (2,6), **When** the round summary is received, **Then** those four tiles glow blue for 600–800ms before returning to their default appearance.
2. **Given** a round resolves with both players scoring words in the same round, **When** the round summary is received, **Then** Player A's scored tiles glow blue and Player B's scored tiles glow red simultaneously, with both colors visually distinct.
3. **Given** a round resolves with no words scored by either player, **When** the round summary is received, **Then** no tile glow is displayed and the board remains unchanged.

---

### User Story 2 - Sequenced Post-Round Narrative (Priority: P2)

After the tile glow animation completes, the board transitions through a clear visual sequence: scored tiles glow → newly frozen tile overlays appear → round summary panel opens. This sequence plays out in order so players can follow what happened during the round.

**Why this priority**: The ordered sequence turns round resolution into a readable story. Each phase communicates something distinct: "these tiles scored," "these tiles are now locked," "here's what it all meant." Skipping or merging phases makes round resolution feel chaotic.

**Independent Test**: Complete a round that both scores a word and creates newly frozen tiles. Verify that the glow animation ends before frozen overlays appear, and that the summary panel opens only after the overlays are visible.

**Acceptance Scenarios**:

1. **Given** a round creates newly frozen tiles, **When** the highlight phase ends, **Then** frozen tile overlays appear on all newly frozen tiles before the summary panel is shown.
2. **Given** a round produces scored tiles and frozen tiles, **When** the full post-round sequence completes, **Then** the round summary panel is displayed and the board correctly shows frozen overlays.
3. **Given** a round with no new frozen tiles, **When** the highlight phase ends, **Then** the summary panel opens immediately (no frozen-overlay delay).

---

### User Story 3 - Accessible Animation for Reduced-Motion Users (Priority: P3)

Players who have enabled a system-level "reduce motion" preference see the correct final board state instantly — scored tile glow is skipped, frozen overlays appear immediately, and the round summary opens without animation delay.

**Why this priority**: Motion sensitivity is a real accessibility need. Skipping animation must not deprive reduced-motion users of information; the same game state must be conveyed, just without the visual transitions.

**Independent Test**: Enable the operating system's "reduce motion" accessibility setting, complete a scored round, and verify that the board and summary update immediately without any glow or transition animation.

**Acceptance Scenarios**:

1. **Given** a user has reduced motion enabled and a round resolves with scored tiles, **When** the round summary is received, **Then** scored tiles do not glow — the board transitions directly to the post-highlight state.
2. **Given** reduced motion is enabled and a round creates frozen tiles, **When** the round summary is received, **Then** frozen overlays appear immediately without animation, and the summary panel opens without a timed delay.

---

### Edge Cases

- What happens when a round resolves but the player has navigated away or disconnected mid-animation? The animation phase is abandoned; the player sees current game state on return.
- What happens if multiple round summaries arrive in rapid succession (e.g., due to reconnection catchup)? Only the latest round's tiles are highlighted; intermediate highlights are skipped.
- What happens when both players' scored words share a tile? The tile is highlighted; either player's color is acceptable as long as the tile is visually marked.
- What happens when a round resolves with no new frozen tiles after a scored word? The highlight phase runs, then the summary panel opens immediately without a freeze-overlay phase.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After a round resolves with scored words, the board MUST display a color glow on each scored tile lasting 600–800ms before returning to its default appearance.
- **FR-002**: The glow color MUST correspond to the player who scored the word: Player A uses blue; Player B uses red.
- **FR-003**: If both players score words in the same round, both players' scored tiles MUST be highlighted simultaneously with their respective colors.
- **FR-004**: After the highlight animation ends, newly frozen tile overlays MUST become visible before the round summary panel is displayed.
- **FR-005**: The round summary panel MUST NOT appear until the highlight phase and frozen-overlay phase are both complete.
- **FR-006**: Users with a system-level reduced motion preference MUST bypass the glow animation entirely; the board and summary MUST reach their final state immediately without timed delays.
- **FR-007**: Tiles that are not part of any scored word in the current round MUST NOT display a glow.
- **FR-008**: The highlight sequence MUST be driven entirely by round summary data already available in the existing match state; no additional server requests are required.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can visually identify which tiles contributed to word scores within 1 second of round resolution, as confirmed by the glow appearing immediately after the summary is received.
- **SC-002**: In any round where both players score, both players' scored tile sets are simultaneously distinguishable by color — a reviewer can correctly assign each glowing tile to its scoring player without additional information.
- **SC-003**: The complete post-round sequence (glow → frozen overlays → summary panel) finishes within 2 seconds of round resolution under normal conditions.
- **SC-004**: Users with reduced motion preferences experience zero animation duration — board and summary reach final state in under 100ms of round resolution.
- **SC-005**: 100% of tiles belonging to scored words in a round are highlighted; no scored tile is omitted from the glow phase.
- **SC-006**: Zero tiles that did not contribute to a scored word receive a glow highlight in any round.

## Assumptions

- Round summary data delivered via existing Realtime broadcasts already identifies which tiles belong to scored words and which player scored them — no schema or server changes are needed.
- Player A is consistently identified as "blue" and Player B as "red" throughout the match; this color assignment is already established in the existing UI.
- The 700ms midpoint of the 600–800ms range is used as the animation target duration.
- Frozen tile overlay logic already exists and only needs to be sequenced after the highlight phase rather than applied immediately on summary receipt.
- The round summary panel already exists and only needs its display trigger deferred until the highlight and freeze phases complete.
- Both players watching the same board see the same tile glow colors — the glow is board-centric, not viewer-centric (Player A's tiles always glow blue regardless of which player is viewing).
