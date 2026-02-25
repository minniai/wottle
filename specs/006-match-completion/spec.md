# Feature Specification: Match Completion

**Feature Branch**: `006-match-completion`
**Created**: 2026-02-25
**Status**: Draft
**Input**: User description: "analyse @docs/proposals/006-match-completion.md proposal and do a specification"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Match Ends After 10 Rounds (Priority: P1)

A player submits their 10th move. Once both players have submitted their 10th move (or one player is out of time), the match transitions to a completed state and no further moves can be submitted.

**Why this priority**: Without a defined end condition, Wottle is an infinite sandbox — it cannot be playtested as a complete game. The 10-round limit is the minimum requirement for a bounded match.

**Independent Test**: Can be fully tested by simulating two players submitting 10 moves each and verifying the match transitions to a completed state and rejects further move submissions.

**Acceptance Scenarios**:

1. **Given** a match where both players have submitted 9 moves each, **When** both players submit their 10th move, **Then** the match transitions to a completed state and neither player can submit further moves.
2. **Given** a match in a completed state, **When** a player attempts to submit a move, **Then** the submission is rejected with a clear error indicating the match has ended.
3. **Given** a match where Player A has submitted 10 moves but Player B has submitted only 8, **When** Player B submits their 9th move, **Then** the match remains active and Player B can still submit their 10th move.

---

### User Story 2 - Clock Enforcement & Timeout (Priority: P2)

Each player starts with 5:00 minutes on their clock. When a round opens, both players' clocks begin ticking simultaneously. As soon as a player submits their move, their clock stops. The other player's clock continues ticking until they submit. The round ends immediately when the second player submits. If a player's clock reaches zero before they submit, they can no longer submit moves for any remaining rounds; their opponent may continue submitting.

**Why this priority**: The "chess-clock tension" is a core design pillar from the PRD. Without time enforcement, one player can stall indefinitely. Clock enforcement completes the competitive structure of the match.

**Independent Test**: Can be fully tested by fast-forwarding a player's clock to zero and verifying their move submissions are rejected while their opponent can continue playing.

**Acceptance Scenarios**:

1. **Given** a round that has just opened, **When** both players are thinking, **Then** both players' clocks tick simultaneously.
2. **Given** a round in progress where Player A submits first, **When** Player A's submission is confirmed, **Then** Player A's clock stops ticking and Player B's clock continues until Player B submits.
3. **Given** a player whose clock has reached zero, **When** they attempt to submit a swap, **Then** the submission is rejected and a message indicates their time has expired.
4. **Given** Player A whose clock has expired but Player B still has time remaining and rounds remaining, **When** Player B submits a move, **Then** the move is accepted normally.
5. **Given** both players whose clocks have expired, **When** either player attempts to submit a move, **Then** the match is considered ended by time expiry and no further moves are accepted.

---

### User Story 3 - Post-Game Victory Screen (Priority: P3)

When a match ends (by round limit or time expiry), both players see a game-over screen showing final scores, the winner, and a button to return to the lobby.

**Why this priority**: The victory screen provides closure and enables the play-again cycle. Without it, a completed match has no meaningful exit, preventing the feedback loop needed for playtesting.

**Independent Test**: Can be fully tested by completing a match and verifying the game-over screen displays correct final scores, the correct winner, and that clicking "Return to Lobby" navigates to the lobby.

**Acceptance Scenarios**:

1. **Given** a match that has just ended, **When** the game-over screen appears, **Then** it displays both players' cumulative final scores, each player's top-scoring words, each player's frozen tile count, and declares the player with the higher score as the winner.
2. **Given** a match that has just ended with tied scores, **When** the game-over screen appears, **Then** the tiebreaker (player with more frozen tiles) determines the winner.
3. **Given** a match that has just ended with tied scores and equal frozen tiles, **When** the game-over screen appears, **Then** the result is declared a draw.
4. **Given** a player viewing the game-over screen, **When** they click "Return to Lobby", **Then** they are navigated back to the lobby.
5. **Given** a player who was disconnected when the match ended, **When** they reconnect, **Then** they see the game-over screen with the correct final result.

---

### Edge Cases

- What happens when a player disconnects as the 10th round resolves?
- How does the system handle a round that is still resolving when both clocks expire simultaneously?
- What happens if a player's connection drops immediately after submitting their final move — does the match still end correctly?
- What happens if both players submit their 10th moves at the same instant — does round resolution still work correctly?
- Can a player whose time has expired still view the board and game state in read-only mode while the opponent finishes?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST limit each player to exactly 10 move submissions per match.
- **FR-002**: The system MUST reject any move submission from a player who has already submitted 10 moves, returning a clear error indicating the move limit is reached.
- **FR-003**: The system MUST transition a match to a completed state once both players have exhausted their moves or their time, whichever comes first. Any round that was in progress at the point of expiry MUST still resolve: submitted moves are processed and scored normally; the time-expired player's missing move is treated as a pass for conflict resolution purposes.
- **FR-004**: Each player MUST have a 5-minute clock that begins ticking simultaneously for both players when a round opens.
- **FR-005**: A player's clock MUST stop ticking the moment they submit their move for a round. The round ends immediately when the second player submits. Both clocks resume when the next round opens.
- **FR-006**: The system MUST reject move submissions from a player whose clock has reached zero, including any in-progress round they have not yet submitted for. There is no grace period — clock expiry takes effect immediately.
- **FR-007**: When one player's clock expires, the other player MUST be able to continue submitting moves for any remaining rounds they have.
- **FR-008**: The system MUST enforce clock state server-side; the client display of the clock is non-authoritative.
- **FR-009**: When a match completes, both players MUST be shown a game-over screen displaying: each player's cumulative final score, the match outcome (win, loss, or draw), each player's top-scoring words from the match, and each player's frozen tile count.
- **FR-010**: The winner MUST be determined by highest final score. In the event of a tie in score, the player with more frozen tiles wins. If both score and frozen tile count are equal, the result is a draw.
- **FR-011**: The game-over screen MUST include a control allowing each player to return to the lobby.
- **FR-012**: A player who reconnects after a match has ended MUST be shown the game-over screen rather than the active game board.
- **FR-013**: The game-over screen is transient — once a player returns to the lobby, the match result is no longer accessible. No persistent summary page or match history view is required.

### Key Entities

- **Match**: A bounded game session. Gains a `completed` state and a completion timestamp when it ends. Records the reason for completion (`round_limit` or `time_expiry`).
- **Player Clock**: The time remaining for a given player in a match. Authoritative value held server-side. Both players' clocks tick simultaneously when a round opens. A player's clock stops the moment they submit their move; the other player's clock continues ticking until they submit. Both clocks resume when the next round opens.
- **Match Result**: The outcome of a completed match — which player won (or draw), their respective final scores, each player's top-scoring words from the match, and each player's frozen tile count (used for tiebreaking and display).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A match consistently ends after exactly 10 submitted rounds per player, with no additional moves accepted under any network or timing condition.
- **SC-002**: A player whose clock reaches zero cannot submit any further moves; this is enforced regardless of client-side clock state.
- **SC-003**: The game-over screen is displayed to both players within 2 seconds of the final round resolving.
- **SC-004**: Both players see identical final score totals, top-scoring words, frozen tile counts, and an identical winner declaration on the game-over screen.
- **SC-005**: A player returning to the lobby after a completed match can successfully start or join a new match without errors.
- **SC-006**: The correct winner is determined in 100% of completed matches, including all tiebreaker scenarios.

## Clarifications

### Session 2026-02-25

- Q: How does the chess clock tick — simultaneously for both players, or only for the player yet to submit? → A: Both clocks tick simultaneously when a round opens. The first player to submit stops their own clock; the other player's clock keeps ticking until they submit. The round ends immediately when the second player submits.
- Q: If a player's clock expires mid-round before they have submitted, can they still submit that round's move? → A: No — clock expiry blocks immediately with no grace period. The player cannot submit for the current round or any future round.
- Q: If a round is in progress when a player's clock expires (the other player already submitted), does that round still resolve and score? → A: Yes — the round resolves with whatever was submitted. The submitted player's move is processed and scored normally; the time-expired player's missing move is treated as a pass.
- Q: Should the completed match result be accessible after the player returns to the lobby? → A: No — the game-over screen is transient. Once a player navigates to the lobby, the result is no longer accessible. No persistent summary page or match history is required.
- Q: What content should the game-over screen display beyond final scores? → A: Rich summary — cumulative final scores, match outcome (win/loss/draw), each player's top-scoring words from the match, and each player's frozen tile count.

## Assumptions

- The 10-round limit and 5-minute clock values are fixed per the PRD and are not configurable per match at this stage.
- "Rounds" means move submissions per player. Each player submits one swap per round; both submissions together constitute one resolved game round.
- The existing round engine's conflict resolution and word-scoring pipeline continues to operate unchanged for the final round.
- Reconnection handling (10-second window) from prior specs continues to apply; a player reconnecting within that window resumes the active game. If the match has since ended, they see the game-over screen instead.
- The lobby a player returns to after a match is the same lobby implemented in prior specs — no new lobby changes are required.
- A player whose clock has expired can still view the board in read-only mode while their opponent finishes remaining rounds.
