# Feature Specification: Server-Authoritative Timer and Frozen-Tile Tiebreaker

**Feature Branch**: `007-server-authoritative-timer`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Do a feature spec based on proposal docs/proposals/007-next-feature-after-board-ui.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Server Deducts Time on Round Resolution (Priority: P1)

When a round ends, the system deducts from each player's remaining time the amount of time that elapsed for that player during the round (e.g. from round start until they submitted). The updated remaining time is stored and used for all subsequent decisions. Players see their clocks reflect the authoritative values after each round.

**Why this priority**: Without server-side time deduction, the game cannot enforce fair time limits. This is the foundation for all time-based behaviour.

**Independent Test**: Can be fully tested by submitting moves in a round, resolving the round, and verifying that each player's stored remaining time has decreased by the correct elapsed amount for that player.

**Acceptance Scenarios**:

1. **Given** a round that has just started, **When** Player A submits after 30 seconds and Player B submits after 45 seconds, **Then** after round resolution Player A's remaining time is reduced by 30 seconds and Player B's by 45 seconds.
2. **Given** a match with stored remaining times for both players, **When** a round resolves, **Then** the updated remaining times are persisted and visible to both players on the next round.
3. **Given** round boundaries are defined by existing round timestamps (e.g. previous round completion or round start), **When** elapsed time is computed, **Then** the calculation is deterministic and based only on server-authoritative timestamps.

---

### User Story 2 - Move Rejected When Player Has No Time Left (Priority: P2)

When a player's remaining time has reached zero, any attempt by that player to submit a move is rejected. The player receives a clear message that their time has expired. The opponent can continue to submit moves for any remaining rounds.

**Why this priority**: Prevents players from making moves after time expiry and completes the "chess-clock" enforcement.

**Independent Test**: Can be fully tested by setting a player's remaining time to zero (or simulating round resolution until it reaches zero) and verifying that their next move submission is rejected with a clear error.

**Acceptance Scenarios**:

1. **Given** a player whose remaining time is zero, **When** they attempt to submit a swap, **Then** the submission is rejected and they see a clear message that their time has expired.
2. **Given** a player whose remaining time is greater than zero, **When** they submit a move, **Then** the move is accepted and processed normally.
3. **Given** Player A has no time left and Player B has time and rounds remaining, **When** Player B submits a move, **Then** the move is accepted and the round can resolve.

---

### User Story 3 - Match Ends on Time Expiry with Correct Winner (Priority: P3)

When a player's clock reaches zero, they cannot submit further moves. The match continues until the round limit is reached or the other player's time also expires. When the match ends (by round limit or by time), it is completed with a recorded reason (e.g. round limit or timeout). The winner is determined by score; if scores are tied, the player with more frozen tiles wins; if still tied, the result is a draw.

**Why this priority**: Delivers a complete, fair game end and correct outcome for time-based and score-based finishes, including tiebreaker.

**Independent Test**: Can be fully tested by playing a match until one or both players run out of time or rounds, and verifying the match completes with the correct ended reason and winner (or draw).

**Acceptance Scenarios**:

1. **Given** Player A's clock has reached zero and the match has more rounds left, **When** the match eventually ends (round limit or Player B's time expiry), **Then** the match is marked completed with an ended reason (e.g. timeout or round limit) and the winner is the player with the higher score.
2. **Given** a match that ends with both players having equal final score, **When** the winner is determined, **Then** the player with more frozen tiles is declared the winner; if frozen tile counts are also equal, the result is a draw.
3. **Given** a match that has ended (by time or round limit), **When** either player views the result, **Then** they see the same outcome (winner or draw), final scores, and frozen tile counts.

---

### User Story 4 - Frozen-Tile Tiebreaker at Match End (Priority: P4)

When a match completes, the system counts each player's frozen tiles (tiles that were frozen in their favour during the match). If the final scores are equal, the player with more frozen tiles wins. If both score and frozen tile count are equal, the result is a draw. The game-over screen shows the correct winner or draw and displays frozen tile counts.

**Why this priority**: Makes tied games and close finishes feel fair and aligns with the stated game rules.

**Independent Test**: Can be fully tested by completing a match with equal scores and verifying the tiebreaker (frozen tile count) is applied and the correct winner or draw is shown.

**Acceptance Scenarios**:

1. **Given** a completed match where both players have the same final score and Player A has more frozen tiles, **When** the result is calculated, **Then** Player A is declared the winner.
2. **Given** a completed match where both players have the same final score and the same frozen tile count, **When** the result is calculated, **Then** the result is a draw.
3. **Given** a completed match, **When** the game-over screen is displayed, **Then** it shows each player's frozen tile count and the correct winner or draw.

---

### Edge Cases

- What happens when both players' clocks reach zero in the same round → **Resolved**: ended_reason = "timeout"; the normal tiebreaker (score → frozen tiles → draw) applies — no special case for simultaneous timeout.
- What happens when a player submits a move that arrives after their clock has already been decremented to zero in a concurrent resolution → **Resolved**: rejection is based on stored `remaining_time ≤ 0` at submission time (pre-deduction); a move submitted before deduction completes is accepted and deducted during resolution.
- How is elapsed time computed when the "round start" is defined → **Resolved**: use `rounds.started_at` (server timestamp set when round enters collecting state; column already exists).
- If a tile is frozen for "both" players (if such a state exists), how is it counted for the tiebreaker → **Resolved**: `"both"` tiles count for neither player; only exclusively-owned tiles (`"player_a"` or `"player_b"`) are included in each player's tiebreaker total.

## Clarifications

### Session 2026-02-26

- Q: When a timed-out player hasn't submitted for the current round, what triggers round advancement? → A: The round auto-resolves immediately when the opponent submits (timed-out player treated as automatic pass).
- Q: How should tiles with owner "both" be counted for the frozen-tile tiebreaker? → A: Count for neither player (excluded from both totals; only exclusively-owned tiles count).
- Q: Should move rejection (FR-002) check remaining time before or after this round's deduction? → A: Reject based on stored remaining_time ≤ 0 at submission time (pre-deduction check); deduction happens during resolution.
- Q: What should the client timer display do during an active round? → A: Count down continuously from last server-synced value; re-sync on each round resolution broadcast.
- Q: When both players' clocks reach zero in the same round, what is the ended_reason and how is the winner determined? → A: ended_reason = "timeout"; apply the normal tiebreaker (score → frozen tiles → draw) — no special case needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On each round resolution, the system MUST compute the time elapsed per player (from round start to that player's submission time) and subtract that amount from that player's remaining time, then persist the updated remaining times.
- **FR-002**: The system MUST reject any move submission from a player whose stored remaining time is zero or less at the moment of submission (pre-deduction check), and MUST return a clear error indicating that their time has expired.
- **FR-003**: When a player's remaining time reaches zero, that player MUST not be able to submit any further moves for the current or future rounds; the opponent MAY continue to submit moves for remaining rounds. If the timed-out player has not yet submitted for the current round, that round MUST auto-resolve immediately when the opponent submits (timed-out player is treated as an automatic pass with no move applied).
- **FR-004**: When the match ends (round limit or time expiry, including simultaneous timeout of both players), the system MUST record `ended_reason` as `"round_limit"` or `"timeout"` and MUST determine the winner by: (1) higher final score; (2) if scores are equal, more exclusively-owned frozen tiles; (3) if still equal, `winner_id = null` (draw). No special case applies for simultaneous timeout.
- **FR-005**: The system MUST use only server-authoritative timestamps (e.g. round start and submission times) to compute elapsed time; client-reported times MUST NOT be used for deduction.
- **FR-006**: At match completion, the system MUST count each player's exclusively-owned frozen tiles (owner = `"player_a"` or `"player_b"` respectively; tiles with owner `"both"` are excluded from both counts) and MUST use these counts for the tiebreaker when scores are equal.
- **FR-007**: The game-over screen MUST display the correct winner or draw and each player's frozen tile count, consistent with the tiebreaker rules.

### Key Entities

- **Player remaining time**: The time left for a player in the match. Stored and updated server-side on each round resolution. Used to allow or reject move submissions and to determine match end by timeout.
- **Round timing**: The notion of when a round "starts" and when each player "submitted" for that round, used to compute elapsed time per player. Must be defined from existing or added server-authoritative timestamps.
- **Frozen tile count**: A per-player count of tiles frozen in that player's favour during the match, used at match end to break score ties.
- **Match completion reason**: The recorded reason the match ended (e.g. round limit, timeout), shown or used for analytics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After every round resolution, each player's remaining time is reduced by the correct elapsed amount for that player, and no move is accepted after a player's remaining time has reached zero.
- **SC-002**: When scores are tied at match end, the winner is correctly determined by frozen tile count in 100% of cases; when both score and frozen tile count are tied, the result is a draw.
- **SC-003**: Players see consistent match outcomes (winner or draw, scores, frozen tile counts) on the game-over screen regardless of when they load it.
- **SC-004**: A full match can be played to completion with time limits enforced and the correct winner or draw declared, suitable for playtesting and tuning.

## Assumptions

- The 10-round limit and initial clock duration (e.g. 5 minutes per player) are already defined and in use; this spec does not change those values.
- Round boundaries and submission timestamps already exist or can be derived (e.g. from previous round completion or a dedicated round start field); the spec assumes a deterministic way to compute "round start" per player for elapsed-time calculation.
- Frozen tile data is already stored in `matches.frozen_tiles` (JSONB, `FrozenTileOwner = "player_a" | "player_b" | "both"`). For the tiebreaker, only exclusively-owned tiles are counted per player; `"both"` tiles are excluded from both counts.
- The existing game-over screen and navigation (return to lobby, rematch) remain unchanged; only the winner determination and display of frozen tile counts are in scope.
- The client timer counts down continuously from the last server-synced remaining time (received on each round resolution broadcast). Periodic mid-round clock-sync to correct drift is out of scope and may be a follow-up.
