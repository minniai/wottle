# Feature Specification: Two-Player Playtest

**Feature Branch**: `002-two-player-playtest`  
**Created**: 2025-11-15  
**Status**: Draft  
**Input**: User description: "Next milestone is to achive a playtest between two users. Two users need to be able to login, play game with the following use cases: Start a game, play 10 rounds, show scoring after each round, show words scored and complete the game."

## Clarifications

### Session 2025-01-16

- Q: When a playtester submits a username that already exists in the system (case-insensitive match), what should happen? → A: Reuse existing profile (auto-login) - The system finds the existing player record and logs them in, showing their previous status/lobby state.
- Q: Should the system enforce rate limiting, and if so, what limits should apply? → A: Rate limit both: 5 auth attempts/min per IP, 30 moves/min per player - Prevent abuse while allowing normal gameplay.
- Q: When a player clicks "Start Game" (auto-pairing) but no other available player is in the lobby, what should happen? → A: Queue indefinitely with status update - Place player in matchmaking queue, show "Waiting for opponent..." status, allow manual cancel button.
- Q: How should the rematch feature work after a match ends? → A: Rematch creates new match with same players - If both players click "Rematch" (or "Accept Rematch" after receiving request), system creates a new match with the same two players and new board seed.
- Q: When a player disconnects during an active match, how long should the system wait before declaring them unrecoverable and finalizing the match? → A: 10 seconds (constitution aligned) - Matches constitution's ≤10s reconnection window; pauses timers during this period.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticate and Enter Lobby (Priority: P1)

A prospective playtester enters a username, authenticates, and lands in the lobby with visibility into other active testers.

**Why this priority**: Without a frictionless login and lobby presence, no coordinated playtest can occur.

**Independent Test**: From a clean browser session, enter a username and confirm the lobby view loads within 5 seconds, showing at least the tester’s own status card.

**Acceptance Scenarios**:

1. **Given** the landing page, **When** a tester submits a username, **Then** the system finds the existing player record if the username already exists (case-insensitive) and logs them in, or creates a new profile if the username is new, then displays the lobby with their status marked "Available."
2. **Given** multiple authenticated testers, **When** one user joins or leaves, **Then** the lobby list updates for all connected clients within 2 seconds.

---

### User Story 2 - Start a Direct Playtest Match (Priority: P1)

Two authenticated users create a head-to-head match via “Start Game” or direct invite, then transition into the shared game board.

**Why this priority**: Starting a match is the core bridge between lobby presence and the 10-round experience.

**Independent Test**: Using two browser sessions, have User A click “Start Game” and User B accept the pairing. Verify both are routed to the same match with synchronized round and timer states.

**Acceptance Scenarios**:

1. **Given** two "Available" users, **When** either presses "Start Game," **Then** the system pairs them immediately (or issues an invite) and both see a "Match Found" confirmation before the board loads. If no other available player exists, **Then** the system places the player in the matchmaking queue with a "Waiting for opponent..." status and provides a manual cancel option.
2. **Given** a user receives an invite, **When** they accept, **Then** both clients receive the same match identifier and see the seeded 10×10 board plus round 1 instructions.

---

### User Story 3 - Submit Rounds and Resolve Moves (Priority: P1)

Each round, both players select one swap, submit, and wait for simultaneous resolution of the two moves with authoritative validation.

**Why this priority**: Completing 10 rounds of simultaneous submissions is the fundamental playtest objective.

**Independent Test**: With Supabase running, simulate 10 consecutive rounds where both players submit swaps; confirm the server enforces “one swap per player per round,” rejects late submissions, and advances rounds automatically.

**Acceptance Scenarios**:

1. **Given** both players are on round n, **When** Player A submits a swap, **Then** their timer pauses and the UI shows “Waiting for opponent” while Player B’s timer continues.
2. **Given** both swaps for round n are received, **When** the server resolves them, **Then** both clients receive the updated board, frozen tiles, round number increment, and timers reset for round n+1.

---

### User Story 4 - View Round Scoring and Word Breakdown (Priority: P1)

After each round, both players see the points earned, contributing words, and cumulative totals before proceeding.

**Why this priority**: Real-time scoring feedback is required to evaluate balance and comprehension during the playtest.

**Independent Test**: Trigger moves that yield words; verify each round summary lists (a) per-player round score, (b) total score, (c) word list with lengths and point values, and (d) tile highlights for newly claimed words.

**Acceptance Scenarios**:

1. **Given** words were formed in round n, **When** the round summary appears, **Then** the UI lists each word, its point calculation (letters + bonuses), and visually highlights those tiles for 3 seconds.
2. **Given** a round produced zero points, **When** the summary shows, **Then** it explicitly states “No new words scored” while still advancing cumulative totals.

---

### User Story 5 - Complete Match and Review Results (Priority: P2)

Upon finishing 10 rounds (or hitting an end condition), both players see the final scoreboard, word history, and options to rematch or return to lobby.

**Why this priority**: A conclusive summary enables qualitative feedback and prepares testers for repeated sessions.

**Independent Test**: Run a full 10-round match; confirm the final screen shows winner, tie-handling, total words scored per player, timers used, and offers “Rematch” (optional) plus “Back to Lobby.”

**Acceptance Scenarios**:

1. **Given** both players finish all 10 rounds, **When** the match ends, **Then** the final summary clearly states winner/loser (or tie) with final scores and total words per player. **When** both players click "Rematch," **Then** the system creates a new match with a new match ID, new board seed, same players, and both are routed to round 1 of the new match.
2. **Given** a player disconnects or times out before 10 rounds, **When** the end condition triggers, **Then** the system records the last completed round, awards remaining rounds per rules, and still presents a final summary citing the reason for early termination.

---

### Edge Cases

- One player disconnects mid-round: both players' timers pause, and the system waits up to 10 seconds for reconnection. If the disconnected player returns within 10 seconds, timers resume and gameplay continues. If they fail to return, the match is finalized with disconnect end condition, and remaining rounds are not played solo.
- Simultaneous identical swaps: the earlier valid submission wins; the later submission is rejected with a neutral message and the player can resubmit within the same round if time remains.
- Invitation conflicts: if a player accepts two invites nearly simultaneously, only the first accepted invite becomes a match; other invites auto-expire with a “player busy” notice.
- Lobby desync: if a client loses lobby connection, the UI must show a reconnect banner instead of stale player statuses.
- Resume after refresh: when a player refreshes mid-match, they rejoin the current round with the latest board, timer, and score state.
- Word scoring disputes: if the server rejects a client-reported word (e.g., due to invalid dictionary entry), the UI surfaces the rejection reason in the round summary.
- Tie scores after 10 rounds: declare a draw, highlight equal totals, and skip rematch prompts that assume a winner.
- Rate limiting exceeded: if a player exceeds the 30 moves/min limit, subsequent move submissions are rejected with a "429 Too Many Requests" response until the rate limit window resets; if an IP exceeds 5 auth attempts/min, authentication requests are rejected with the same error code.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide username-only authentication (per PRD §3.1) that creates or reuses a player profile and establishes a secure session tied to that identity. When a username already exists (case-insensitive match), the system MUST automatically log in the existing profile rather than rejecting or creating a duplicate; usernames are unique and stored in lowercased form.
- **FR-001a**: System MUST enforce rate limiting: authentication attempts limited to 5 per minute per IP address, and move submissions limited to 30 per minute per player. When rate limits are exceeded, the system MUST return appropriate error responses (429 Too Many Requests) without processing the request.
- **FR-002**: Lobby MUST display all authenticated testers with real-time status (available, matchmaking, in-match) and update within 2 seconds p95 of any status change (per PERF-003).
- **FR-003**: Users MUST be able to initiate matchmaking via "Start Game" (auto-pairing) or direct invite from the lobby list; invites must expire after 30 seconds if unanswered. When "Start Game" is pressed with no available opponent, the system MUST place the player in a matchmaking queue, update their status to "matchmaking," display "Waiting for opponent..." in the UI, and provide a manual cancel button to exit the queue; the queue persists indefinitely until a match is found or manually cancelled.
- **FR-004**: Match creation MUST ensure exactly two distinct, available players and assign them a shared match identifier, board seed, and initial timers before entering round 1.
- **FR-005**: Each match MUST enforce exactly 10 rounds per player unless a timeout/disconnect end condition triggers earlier; rounds cannot start until the prior round is resolved.
- **FR-006**: During each round, clients MUST allow precisely one swap submission per player, hide the move until both submissions are received, and reject late swaps once round resolution begins.
- **FR-007**: Server MUST validate swaps (coordinates in bounds, tiles movable, dictionary checks enabled per PRD §2) and compute word scoring, freezing claimed tiles according to PRD §2.1. Dictionary word validation MUST complete in <50ms server-side (constitution SLA II.2) to maintain overall move submission <200ms p95 target.
- **FR-008**: After every round, both clients MUST see a scoring panel that includes per-player round points, cumulative totals, and deltas versus the previous round.
- **FR-009**: Round summaries MUST list every new word scored that round with letter sequence, length, base points, combo bonuses, and attribution to the scoring player.
- **FR-010**: UI MUST highlight (or otherwise surface) scored word tiles for at least 3 seconds after each round so playtesters can visually confirm outcomes.
- **FR-011**: Match timers MUST follow the 5+0 format (PRD §3.2) where submitting a swap pauses the player’s timer until the next round begins; timeouts prevent further submissions for that player.
- **FR-012**: System MUST handle disconnects gracefully by marking the player "Reconnecting," pausing both players' timers, and waiting up to 10 seconds (per constitution V) for reconnection. The 10-second reconnection window is a fixed constant (not environment-configurable) to ensure consistent behavior across all playtest sessions. If the disconnected player returns within 10 seconds, their state MUST be restored and timers resumed. If they fail to return within 10 seconds, the match MUST be finalized with an appropriate end condition (disconnect) and remaining player declared winner (or match abandoned if both disconnect).
- **FR-013**: Final summary MUST present winner (or draw), final scores, total words scored, remaining time per player, and buttons for "Rematch" and "Return to Lobby." Rematch flow: (a) If both players click "Rematch" simultaneously or within 30 seconds, the system MUST create a new match with a new match ID, new board seed, same two players, and reset all timers to initial 5+0 state; (b) If one player clicks "Rematch" first, the system MUST send a rematch invitation to the other player, show "Rematch Requested" status to the initiator, and display "Accept Rematch" / "Decline" buttons to the recipient; (c) If the recipient accepts within 30 seconds, a new match is created as in (a); (d) If the recipient declines or 30 seconds elapse without acceptance, the invitation expires and both players return to lobby; (e) Each rematch generates a separate match record for audit purposes.
- **FR-014**: Match logs MUST persist player IDs, board seed, per-round swaps, scoring events, and match outcome so QA can audit any playtest session after the fact.
- **FR-015**: Observability MUST capture per-round latency (submission to scoreboard), authentication success/failure counts, and disconnect occurrences to inform playtest readiness.

### Non-Functional Requirements

- **NFR-001**: UI MUST meet WCAG 2.1 Level A minimum standards: (a) all interactive elements (buttons, tiles, modals) accessible via keyboard navigation; (b) focus traps in modals and match summary overlays; (c) aria-live regions for round summaries and match status updates; (d) sufficient color contrast (4.5:1 minimum for text, 3:1 for UI components); (e) screen reader announcements for score changes and word highlights.

### Key Entities *(include if feature involves data)*

- **PlayerIdentity**: Username, session token, Elo (optional), current status, reconnect token.
- **LobbyPresence**: Real-time record tying PlayerIdentity to lobby channel, availability flag, and invitation queue.
- **Match**: Match ID, board seed, player assignments, current round, timers, and overall status (in-progress, completed, abandoned).
- **Round**: Round number, board snapshot before/after resolution, submissions, resolution timestamp, and scoring summary.
- **MoveSubmission**: Player reference, from/to coordinates, submission time, validation result, and applied word outcomes.
- **WordScoreEntry**: Word text, length, point components (letters, bonuses), owning player, round number.
- **ScoreboardSnapshot**: Per-player cumulative score, round delta, tie/win indicator, and timestamp used for UI and audit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of authenticated players reach the lobby view within 5 seconds of entering a username during playtest dry runs.
- **SC-002**: At least 90% of initiated playtest matches successfully pair two users and enter round 1 within 15 seconds of the first “Start Game” click.
- **SC-003**: 85% of playtest matches complete all 10 rounds without manual intervention; remaining matches must log a clear end condition (timeout/disconnect).
- **SC-004**: 100% of round summaries display identical scoring totals on both clients within the same match.
- **SC-005**: Playtesters report (via survey or feedback form) ≥80% confidence that they understood how points were awarded after each round.

### Performance Requirements (if applicable)

- **PERF-001**: Move submission to server acknowledgment MUST remain <200 ms p95 (constitution SLA) so players can progress through rounds without perceived lag.
- **PERF-002**: Round resolution broadcast (both swaps resolved, scoreboard + word list delivered) MUST complete <400 ms p95 after the second swap is received. The realtime broadcast portion (delivering payload to subscribed clients) MUST complete <100ms p95 per constitution SLA II.4; the <400ms target includes scoring computation time which may take 200-300ms for complex board states.
- **PERF-003**: Lobby and match presence updates MUST propagate to subscribed clients within 2 seconds p95 to avoid stale opponent status during matchmaking.

## Assumptions

- Playtest authentication continues to use username-only flow with implicit profile creation (PRD §3.1); no email or password is introduced in this milestone.
- Matching scope is limited to direct invitations and immediate pairing between online testers; ranked ladders and Elo adjustments remain out of scope.
- The existing 10×10 weighted board generator (PRD §4) and Icelandic dictionary remain authoritative; no new languages or board variants are introduced.
- Observability from the MVP scaffold (structured logs, performance marks) is reused; this feature adds new events but does not change the logging stack.

## PRD Alignment

- **PRD §3.1–3.3**: Login, lobby, matchmaking, and round-based gameplay requirements are fully represented in User Stories 1–3 and FR-001 through FR-011.
- **PRD §2 (Scoring & Word Rules)**: Round summaries and word breakdowns (FR-007 to FR-010) mirror the scoring formulas outlined in the PRD.
- **PRD §3.4**: Final summary flow (User Story 5, FR-013) reflects the post-game deliverables needed for playtests (final scores, word highlights, rematch option).
- **PRD §1.1 & §4**: Board size, seed generation, and simultaneous move constraints are preserved in Match/Round requirements to ensure the playtest mimics intended gameplay.
