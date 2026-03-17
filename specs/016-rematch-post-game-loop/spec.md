# Feature Specification: Rematch & Post-Game Loop

**Feature Branch**: `016-rematch-post-game-loop`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "Rematch and post-game loop — after match completion, players can request rematches, accept/decline invitations, and track series context across consecutive games"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request and Accept Rematch (Priority: P1)

After a match ends and the final summary is displayed, a player clicks "Rematch" to challenge their opponent to another game. The opponent sees the rematch invitation inline on their own final summary screen and accepts. A new match is created immediately and both players are redirected to it without returning to the lobby.

**Why this priority**: This is the core retention mechanism. The frictionless transition from "game over" to "play again" is the single highest-leverage feature for keeping players engaged. Without it, every session ends after one match.

**Independent Test**: Can be fully tested by completing a match, clicking Rematch, accepting on the other side, and verifying both players land in a new match with a fresh board.

**Acceptance Scenarios**:

1. **Given** a completed match with both players on the final summary screen, **When** Player A clicks "Rematch", **Then** Player A's button changes to "Waiting for opponent..." (disabled) and Player B sees an inline banner: "[Player A] wants a rematch!" with Accept and Decline buttons.
2. **Given** Player B has received a rematch invitation, **When** Player B clicks "Accept", **Then** a new match is created and both players are redirected to the new match screen.
3. **Given** both players click "Rematch" simultaneously (before either sees the other's request), **When** the system processes both requests, **Then** a new match is created immediately without showing an invitation step.

---

### User Story 2 - Decline or Timeout on Rematch (Priority: P1)

A player receives a rematch request but decides not to play again — either by explicitly declining or by navigating away. The requesting player is informed and can return to the lobby.

**Why this priority**: Decline and timeout handling is essential for the rematch flow to be complete. Without it, a requesting player could be stuck waiting indefinitely.

**Independent Test**: Can be tested by requesting a rematch and then declining (or waiting for timeout) on the opponent's side, verifying the requester sees appropriate feedback.

**Acceptance Scenarios**:

1. **Given** Player B has received a rematch invitation, **When** Player B clicks "Decline", **Then** Player A sees "Opponent declined." and the Rematch button is disabled (no re-request possible).
2. **Given** Player B has received a rematch invitation, **When** Player B navigates away (returns to lobby or closes tab), **Then** Player A sees "Opponent declined." and the Rematch button is disabled.
3. **Given** Player A has sent a rematch request, **When** 30 seconds pass with no response from Player B, **Then** Player A sees "No response — returning to lobby." and is redirected to the lobby.
4. **Given** Player B has disconnected, **When** the reconnection window (10 seconds) expires without Player B reconnecting, **Then** the rematch request is treated as declined.

---

### User Story 3 - Series Tracking Across Rematches (Priority: P2)

When players rematch, the system tracks consecutive games as a series. Players see which game number they are on and the running series score, adding narrative and competitive tension.

**Why this priority**: Series tracking is a lightweight addition that significantly enhances the rematch experience by creating a sense of progression and rivalry. However, it is display-only and not essential for the core rematch functionality.

**Independent Test**: Can be tested by completing two consecutive rematches and verifying the game counter increments and series score displays correctly on the final summary screen.

**Acceptance Scenarios**:

1. **Given** a rematch has been created from a previous match, **When** the final summary is displayed, **Then** it shows the game number (e.g., "Game 2") and the series score (e.g., "You lead 1-0" or "Tied 1-1").
2. **Given** a series of 3 games where Player A won 2 and Player B won 1, **When** the final summary of Game 3 is displayed, **Then** it shows "Game 3" and "Player A leads 2-1".
3. **Given** a player declines a rematch and later re-invites the same opponent from the lobby, **When** the new match starts, **Then** it is treated as a new series (Game 1), not a continuation.

---

### Edge Cases

- What happens when a player sends a rematch request and then navigates away before receiving a response? The request is cancelled (treated as if the requester withdrew).
- What happens if both players disconnect during the rematch negotiation? The rematch request expires; neither player is redirected.
- What happens if a rematch is requested for a match that ended by resignation? Rematch is still offered — the resigning player may want to try again.
- What happens if a player clicks Rematch multiple times rapidly? The system deduplicates — only one active rematch request exists per completed match.
- What happens if a rematch request is sent but the opponent's connection is unstable (intermittent)? The 30-second timeout applies regardless of connection stability; if the opponent reconnects within 30 seconds they can still respond.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Rematch" button on the final summary screen for both players after a match completes.
- **FR-002**: System MUST display a "Return to Lobby" option alongside the Rematch button (preserving existing behavior).
- **FR-003**: When a player clicks Rematch, the system MUST change the button to a disabled "Waiting for opponent..." state.
- **FR-004**: When a rematch request is sent, the opponent MUST see an inline invitation banner on their final summary screen with the requester's name and Accept/Decline buttons.
- **FR-005**: When the opponent accepts a rematch, the system MUST create a new match with a fresh board and redirect both players to the new match.
- **FR-006**: When the opponent declines a rematch (explicitly or by navigating away), the system MUST notify the requester with "Opponent declined." and disable the Rematch button. Declining is final — no re-requests allowed for the same match.
- **FR-007**: When both players click Rematch simultaneously, the system MUST create a new match immediately without showing an invitation step to either player.
- **FR-008**: Rematch requests MUST expire after 30 seconds of no response, with the requester seeing "No response — returning to lobby." and being redirected to the lobby.
- **FR-009**: If the opponent disconnects and does not reconnect within the reconnection window (10 seconds), the system MUST treat the rematch request as declined.
- **FR-010**: The system MUST allow only one rematch request per completed match. Once declined, expired, or cancelled, no further rematch requests can be made for that match.
- **FR-011**: Rematch requests MUST be delivered via the existing match communication channel (no additional channels needed).
- **FR-012**: Rematch MUST be offered even for matches that ended by resignation.
- **FR-013**: When a rematch creates a new match, the system MUST link the new match to the previous match for series tracking.
- **FR-014**: The final summary screen MUST display the game number in the series (e.g., "Game 2", "Game 3").
- **FR-015**: The final summary screen MUST display the running series score (e.g., "You lead 2-1", "Tied 1-1").
- **FR-016**: Series tracking MUST be display-only with no effect on gameplay, scoring, or matchmaking.
- **FR-017**: If either player declines a rematch and later re-invites from the lobby, the new match MUST start a new series (no chain link to previous matches).
- **FR-018**: When a player sends a rematch request and then navigates away, the system MUST cancel the pending request.
- **FR-019**: When a rematch is accepted, both players MUST see a brief "Starting new game..." interstitial (~500ms) before being redirected to the new match.

### Key Entities

- **Rematch Request**: A request from one player to another to play again after a completed match. Has a lifecycle: pending, accepted, declined, or expired. Scoped to a single completed match.
- **Series**: A chain of consecutive rematches between the same two players. Derived from the rematch links between matches — not a standalone entity. Breaks when either player declines and re-invites from the lobby.
- **Match (extended)**: An existing match entity extended with an optional link to the previous match it was rematched from, enabling series chain traversal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can initiate and complete a rematch within 3 seconds of both players agreeing (from accept click to new match screen).
- **SC-002**: Rematch invitation appears on the opponent's screen within 1 second of the requester clicking Rematch.
- **SC-003**: 100% of rematch requests that go unanswered are automatically expired and cleaned up after 30 seconds.
- **SC-004**: Series game number and score are accurately displayed for chains of up to 10 consecutive rematches.
- **SC-005**: The rematch flow works correctly when either or both players have unstable connections (graceful degradation to timeout behavior).
- **SC-006**: No lobby round-trip is required for rematches — players transition directly from one match to the next.

## Clarifications

### Session 2026-03-15
- Q: After a rematch is declined, can the requester re-request, or is it one shot per match? → A: One shot — declining is final. Rematch button is disabled after decline/timeout. Players must use the lobby to play again.
- Q: Should series info (game number, score) display only on FinalSummary or also in the match header during gameplay? → A: FinalSummary only. No changes to GameChrome.
- Q: What transition UX should appear between accepting a rematch and the new match loading? → A: Brief interstitial — show "Starting new game..." for ~500ms before redirecting to the new match.

## Assumptions

- The existing match communication channel remains open on the final summary screen, so rematch events can be broadcast without new subscriptions.
- The existing match creation logic can be reused for rematch-created matches with minimal modification (adding the rematch link).
- The 10-second reconnection window referenced in edge cases is the existing disconnection handling already implemented in the system.
- Series tracking is purely cosmetic — no leaderboards, achievements, or statistical tracking of series records is in scope.
- The "Return to Lobby" link behavior remains unchanged; this feature only adds the Rematch option alongside it.

## Scope Boundaries

### In Scope
- Rematch request/accept/decline flow on the final summary screen
- Real-time delivery of rematch events via existing match channel
- Series chain tracking (game number, running score)
- Timeout and disconnection handling for rematch requests
- Simultaneous rematch detection (both players click at once)

### Out of Scope
- Matchmaking changes (lobby behavior unchanged)
- Rematch from mid-game (only after match completion)
- Series leaderboards or historical series records
- Notifications outside the final summary screen (no push notifications, no email)
- Changes to the game engine, scoring, or round resolution
- Spectator mode or third-party observation of rematch flows
