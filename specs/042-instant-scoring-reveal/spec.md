# Feature Specification: Instant Scoring Reveal for First Player

**Feature Branch**: `042-instant-scoring-reveal`
**Created**: 2026-06-09
**Status**: Draft
**Linear Issue**: [O-57 — Reveal scored words immediately when first player makes a move](https://linear.app/minni/issue/O-57/reveal-scored-words-immediately-when-first-player-makes-a-move)
**Input**: User description: "Reveal scored words immediately when first player makes a move (Linear O-57). After the first player submits a swap, calculate scoring and freeze scored tiles on both boards before the second player submits, instead of waiting until the round completes."

## Overview

Today, each Wottle round runs to completion before either player learns what scored. Player A submits a swap (animated on both boards via the existing opponent-move reveal), then both players wait for Player B to submit, then scoring runs on the combined post-swap board and both players see all scored words and freezes together. This means the second mover plays "blind" against the first mover's intent — they can see the new board but not the words that were formed or the tiles that are about to lock.

This feature inverts that for the first submission in each round: as soon as the first player submits, the server scores that swap in isolation, freezes the resulting scored tiles, and broadcasts the result to both boards while the second player is still choosing their swap. The second player now plays *against* a board that already shows what the first player scored, with those tiles locked, and may have to re-pick if a tile they had selected just froze.

The change makes turn order strategically meaningful inside a round — first movers commit early and trade information; late movers wait longer but get to react. It does not change the 10-round structure, the scoring formula, the dictionary, or the chess-clock model. It is a change to *when* scoring runs and *what state the second player's board is in when they submit*.

## Clarifications

### Session 2026-06-09

- Q: A second player has already submitted a valid swap when the first player's instant-scoring runs and freezes a tile that their submitted swap targets. What happens? → A: Defer instant scoring. When the server begins processing the first player's submission, it first checks whether the second player's submission has already arrived; if so, it skips the instant-scoring path entirely and resolves the round through the existing combined-scoring pipeline. A submission is never retroactively rejected or marked as a timeout-pass because of instant-scoring freezes.
- Q: While the server is computing the first player's instant score and broadcasting frozen tiles, does the second player's clock keep ticking? → A: Keep the clock running. The existing chess-clock model already absorbs network latency and the opponent-move animation on the second player's clock; the instant-scoring window is bounded by the same <200 ms p95 SLA. No new clock-pause primitive is introduced.
- Q: What feedback does the second player see when a tile they had selected (but not yet confirmed as a swap pair) is auto-deselected because the first player's reveal just froze it? → A: Silent deselection. The combined visual of the selection ring disappearing plus the tile rendering in the opponent's colour using the existing frozen-tile treatment (from spec 011) is the entire sighted feedback. An aria-live announcement covers screen-reader users (e.g. "Opponent claimed your selected tile — pick another"). No toast, no dedicated lock animation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — First mover learns their score immediately (Priority: P1)

A player submits the first swap of a round. The tiles animate into place on both boards (already shipped). Within a moment, that player sees their scored words highlight, their score delta increment, and the scored tiles freeze in their player colour — all without waiting for the opponent.

**Why this priority**: This is the core change in the issue. Without it, the feature does not exist. It also delivers the most-asked-for first-mover moment — committing early and being rewarded immediately rather than waiting on the opponent's clock.

**Independent Test**: Open a two-browser match. From browser A submit any swap that forms at least one scored word. Observe that browser A shows the word highlight, score increment, and frozen tiles before browser B has submitted anything. Browser B remains on the swap-selection screen but its board reflects the same highlight and freeze.

**Acceptance Scenarios**:

1. **Given** a round is in the collecting phase with no submissions, **When** the first player submits a swap that produces at least one scored word, **Then** that player's scored words are highlighted on both players' boards and the corresponding tiles become frozen on both boards before the second player submits.
2. **Given** the same first submission, **When** the first player's reveal completes, **Then** the first player's running score increases by the exact total of those words, and that score is reflected on both players' HUDs.
3. **Given** the first player has submitted, **When** the second player views their board, **Then** the second player sees the swap animation, the word highlight, the frozen tiles in the first player's colour, and an updated opponent score — without taking any action themselves.

---

### User Story 2 — Second mover plays against revealed state (Priority: P1)

After the first player's reveal lands, the second player chooses their swap on a board where the first player's scored tiles are already frozen. The second player cannot select any of those tiles and chooses from the unfrozen remainder. When they submit, the round completes as it does today.

**Why this priority**: The whole point of revealing scoring early is that the second mover *uses* the information. If the second mover could still target tiles that the first mover scored, the reveal would be cosmetic and the strategic dimension would be lost.

**Independent Test**: In a two-browser match, have browser A submit a swap that scores a word covering coordinates X. Wait for the reveal on browser B. Attempt to tap tile X on browser B. The tap is rejected (the tile is frozen). Pick a different unfrozen tile, complete the swap, observe the round resolves normally with both scores displayed.

**Acceptance Scenarios**:

1. **Given** the first player's instant reveal has frozen one or more tiles, **When** the second player taps a frozen tile, **Then** the tile cannot be selected (same affordance the game uses for any frozen tile today).
2. **Given** the second player completes a valid swap on the post-reveal board, **When** they submit, **Then** the round resolves end-to-end and both players' final scores for the round are displayed in the existing round-summary surface.
3. **Given** the second player completes a swap that itself forms a scored word, **When** the round resolves, **Then** their word and freezes appear as today, on top of (not replacing) the first player's already-revealed freezes.

---

### User Story 3 — Second mover had a tile selected that just got frozen (Priority: P1)

The second player has tapped one tile and is choosing the second tile of their pair when the first player's reveal arrives and freezes the tile they had selected. The pending selection clears, the tile shows as frozen in the first player's colour, and the second player must start their selection over on an unfrozen tile.

**Why this priority**: This is the contention case the issue explicitly calls out. Failing this gracefully is the difference between the feature feeling intentional and the second player feeling that their input was eaten by a bug.

**Independent Test**: Coordinate two browsers: on browser B, tap tile X but do not tap the second tile yet. On browser A, submit a swap that scores a word covering tile X. Observe on browser B that tile X loses its selection ring, displays as frozen in player A's colour, and that the next tap on any unfrozen tile starts a new selection (no leftover state from the previous selection).

**Acceptance Scenarios**:

1. **Given** the second player has selected exactly one tile of a swap pair, **When** the first player's reveal freezes that selected tile, **Then** the selection is cleared and the tile renders as frozen.
2. **Given** the selection is cleared by a reveal, **When** the second player taps any unfrozen tile, **Then** that tap is treated as the first tile of a new swap selection (not as the completion of the cleared one).
3. **Given** the second player had selected one tile that was *not* frozen by the reveal, **When** the reveal arrives, **Then** their selection is preserved and they can complete it normally.

---

### User Story 4 — Both players had submitted before instant reveal could fire (Priority: P2)

The two submissions arrive at the server within milliseconds of each other. The first one wins the "first submitter" race, but by the time instant scoring would have started, the second submission is already on the server. The round resolves through the existing combined-scoring path and both players see all scored words together in the round summary, exactly as it works today.

**Why this priority**: This is the existing-behaviour fallback. It is critical that this path keeps working — otherwise simultaneous submissions, which are common at high play levels, would behave noticeably worse than today. It is P2 only because no new UI is needed; it is "make sure we did not break what already works".

**Independent Test**: Use the existing dual-session Playwright harness that submits both moves with no artificial delay. Run a 10-round match. Verify every round either (a) reveals the first player's score early *and then* the second player's score, or (b) reveals both together at round end. Never produces a half-revealed state or a duplicate score entry.

**Acceptance Scenarios**:

1. **Given** the first submission arrives at the server, **When** the second submission has already arrived (or arrives during the same scoring transaction), **Then** the round runs the existing combined-scoring path and produces a single, consistent round summary with both scores.
2. **Given** the combined-scoring path runs because of the race above, **When** the round summary publishes, **Then** the first player's score is NOT counted twice (no double-publish from a fired-but-unused instant-scoring path).
3. **Given** the combined-scoring path runs, **When** the second player views the round summary, **Then** there is no UI evidence of the abandoned instant-reveal path (no orphaned highlights, no stale freezes that get removed mid-summary).

---

### User Story 5 — First swap scores nothing (Priority: P3)

The first player submits a swap that forms no scored words (the most common case, especially in early rounds). The existing swap animation plays on both boards, the second player continues choosing their swap, and nothing else happens until the second player submits.

**Why this priority**: This is the by-far-most-common round outcome. It must be a no-op above the existing opponent-move reveal — no spurious highlight, no false "score = 0" pulse, no needless server round-trip that delays the second player.

**Independent Test**: Submit a swap that touches no dict words (e.g. an early-game move between two non-adjacent random tiles). Observe that the only visual change on both boards is the existing swap animation; no highlight, no freeze, no score delta pops, no opponent-score change on the HUD.

**Acceptance Scenarios**:

1. **Given** the first player submits a swap that produces zero scored words, **When** the broadcast lands on both clients, **Then** neither board shows a highlight, a freeze, or a score-delta animation for that submission.
2. **Given** the same zero-score submission, **When** the second player continues playing, **Then** they may target any tile that was unfrozen before the first submission (the first swap did not freeze anything).

---

### Edge Cases

- **First player disconnects between submitting and the reveal landing**: the server has the submission and must still publish the instant reveal to the still-connected second player so the freezes are visible. The first player rejoins to a board that already shows their score.
- **Server scoring fails or times out for the first submission** (e.g. dictionary loader stalled): the round must not deadlock. The system must fall back to the existing combined-scoring path at round end and surface the failure in observability logs, without showing the second player a "phantom" reveal that never resolved.
- **Round clock expires after the first player submits but before the second player does**: the second player's timeout-pass synthesis runs as it does today; the round resolves with the first player's already-published instant reveal plus a synthetic empty submission for the second player.
- **Second player is mid-tap when the reveal arrives** (e.g. the tap event is already in the browser's event queue): the tap MUST be evaluated against the post-reveal frozen state, not the pre-reveal state — i.e. a tap on a tile that has just been frozen by the reveal must be treated as a tap on a frozen tile.
- **First player's swap scores a word whose tiles overlap a frozen tile from a prior round**: the existing same-axis standalone invariant (game rules §3.5a, §7.4) still applies. Instant scoring runs the same algorithm as combined scoring; no new validation rules are introduced.
- **Realtime channel drops between the first submission and the reveal**: the polling fallback (existing 2 s interval) must surface the same instant-reveal state on its next poll, so a player on polling sees the freezes appear within one poll cycle of when the reveal happened.
- **First player's reveal would freeze the board below the 24-unfrozen safeguard** (game rules §6, FR-016 of spec 003): the existing safeguard must veto the freezes on the first player's pass, not on the combined pass. This means the safeguard now runs twice per round in the worst case (once after the first submission, once after the second).
- **The second player submits within the same network turn as receiving the reveal** (i.e. their click event was queued before the reveal and dispatches after): if their swap targets a now-frozen tile, the existing client-side guard must reject it before submission so the server never sees an illegal swap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST run the scoring pipeline on the first submission of each round as soon as it arrives, against the board state produced by applying only that swap to the round's starting board.
- **FR-002**: The server MUST broadcast the resulting first-mover scored words, score delta, and frozen tiles to both players over the existing realtime channel, with a polling-fallback path that surfaces the same state within one poll interval.
- **FR-003**: The instant reveal MUST become the new authoritative state for the second player's board: the second player MUST NOT be able to select any tile that the instant reveal froze.
- **FR-004**: If the second player has tapped exactly one tile of a swap pair when the reveal arrives, and that tile is frozen by the reveal, the system MUST clear that selection; the second player's next tap MUST start a fresh selection.
- **FR-005**: If the second player has tapped exactly one tile of a swap pair when the reveal arrives, and that tile is NOT frozen by the reveal, the system MUST preserve that selection.
- **FR-006**: When the first submission produces zero scored words, the system MUST NOT broadcast a reveal beyond the existing opponent-move swap animation (no score-zero highlight, no freeze, no opponent-score-delta animation).
- **FR-007**: When the server begins processing the first player's submission, it MUST first check whether the second player's submission has already arrived. If it has, the server MUST skip the instant-scoring path entirely and resolve the round through the existing combined-scoring pipeline. This guarantees that (a) no submission is ever retroactively rejected or downgraded to a timeout-pass because of instant-reveal freezes, and (b) scored words and word-score entries are never double-counted or double-published from a fired-but-unused instant-scoring path.
- **FR-008**: When the first player's instant reveal has already published and the second player then submits, the system MUST resolve the round as the existing pipeline does today: the first player's already-published scores are reused; only the second player's scoring is computed at round end; the round summary surface MUST show both players' words together.
- **FR-009**: The first player's already-published frozen tiles MUST persist across the round-end pipeline — they MUST NOT be unfrozen, re-frozen, or lose their owner attribution when the second player's submission resolves.
- **FR-010**: The instant reveal MUST run the same word-discovery, cross-validation, scoring, and freezing rules as the existing round-end pipeline, including the per-letter coverage rule, the same-axis standalone invariant, length bonus, combo bonus, unique-word deduplication, and the ≥24-unfrozen-tiles safeguard.
- **FR-011**: If instant scoring fails or times out on the server side, the system MUST fall back to the existing combined-scoring path at round end and MUST log the failure in observability so it is detectable, without leaving the clients in a "half-revealed" state.
- **FR-012**: The reveal MUST identify the first-submitter authoritatively via the server-side `submittedAt` timestamp on the submission row (same comparator that the existing conflict resolver uses); the client-side perception of who "submitted first" MUST NOT influence the outcome.
- **FR-013**: All scoring computation MUST remain server-authoritative; the client MUST NOT compute scores or freezes locally — it only renders the broadcast.
- **FR-014**: Round-completion observability (existing `round_completed` log event with score totals, word counts, etc.) MUST account for instant-reveal rounds correctly: the totals reported at round end MUST equal first-mover-score (from the instant reveal) plus second-mover-score (computed at round end).
- **FR-015**: The match HUD and timer behaviour MUST remain unchanged in all other respects — the existing per-player chess clock, round counter, and round-summary popup all continue to work; only the *timing* of when first-mover score and freezes appear is changed.
- **FR-016**: The second player's clock MUST continue to run while the server is computing the first player's instant score and broadcasting the reveal. No clock-pause primitive is introduced. The instant-scoring window is treated as ordinary server-compute latency by the existing server-authoritative timer (spec 007), and is bounded by SC-005's 200 ms p95 reveal SLA.
- **FR-017**: Auto-deselection of the second player's pending tile (FR-004) MUST be silent for sighted users — the only visual signals are the existing selection-ring removal and the existing frozen-tile treatment in the first player's colour (spec 011). No toast, banner, or dedicated lock animation MUST be added. Screen-reader users MUST receive a single aria-live announcement (e.g. "Opponent claimed your selected tile — pick another") so the event is perceivable without sight.

### Key Entities *(no new tables; existing entities used in a new sequence)*

- **MoveSubmission** (existing): the row written when a player submits a swap. The instant-reveal path is triggered off the *first* MoveSubmission of a round.
- **RoundSummary / WordScoreEntry / ScoreboardSnapshot** (existing): the instant reveal publishes a partial RoundSummary containing only the first player's words; the round-end pipeline appends the second player's words to produce the canonical final summary.
- **FrozenTileMap** (existing): the first player's instant reveal mutates this map with the first-mover's freezes; the second player's swap is validated and resolved against this *updated* map, not the round-start map.
- **MatchState.pendingMoves** (existing, shipped with #210 opponent-move reveal): continues to carry the first player's swap to the second player's client; this feature adds an analogous broadcast for the resulting scored words and freezes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When the first player submits a scoring swap, the second player sees the resulting scored-word highlight and frozen tiles within 1 second on a realtime connection and within one polling interval (~2 s) on the polling fallback.
- **SC-002**: In matches where both players play to round 10, the second mover's submission rate against tiles that were frozen *by the first mover in the same round* is zero (currently it is non-zero because the second mover plays blind to first-mover freezes).
- **SC-003**: Over 100 dual-session Playwright rounds spanning the race window (both submit within 100 ms of each other), zero rounds produce duplicated, missing, or mis-attributed word-score entries.
- **SC-004**: Over the same 100 rounds, every round either (a) shows the first player's score before the second player submits OR (b) shows both scores together at round end — no round shows a partial state that fails to resolve.
- **SC-005**: The 95th-percentile time between the first submission landing on the server and the first-mover reveal landing on the second player's client is under 200 ms (matching the existing move-RTT SLA in the constitution).
- **SC-006**: After this ships, the median round duration in two-player matches drops measurably (the second mover stops spending part of their think time on tiles that are about to freeze), to be confirmed via match-log analysis on the first week of post-ship matches.
- **SC-007**: No regression in the existing `tests/integration/ui` two-player Playwright suites — all currently-passing dual-session matches continue to pass.

## Assumptions

- The existing opponent-move reveal (PR #210 / game rules §2) is in place, so the second player's board already animates the first player's swap before this feature runs. This feature layers scoring/freezing on top of that and does not change the swap-animation path.
- The dictionary, scoring formula, length bonus, combo bonus, per-letter coverage rule, same-axis standalone invariant, and ≥24-unfrozen safeguard from `docs/prd_and_requirements/wottle_game_rules.md` are not changed. Instant scoring runs the same algorithm; only the trigger and the partial-publish are new.
- The 90 s reconnection window and `DisconnectionModal` from Phase 6 already handle "first player disconnected after submitting"; this feature does not introduce new disconnect semantics.
- The existing realtime+polling fallback is the only delivery mechanism; no new channel topic is introduced (a new event *type* on the existing match channel is acceptable).
- The chess-clock semantics from spec 007 (server-authoritative timer driven by `rounds.started_at`) remain the source of truth and are unchanged. The second player's clock keeps ticking during the instant-scoring window (Clarifications Q2 / FR-016); no pause primitive is added.

## Out of Scope

- Changing the scoring formula, dictionary, or per-letter coverage rule.
- Showing the first player a preview of *potential* scoring before they submit ("what if" mode). This feature reveals scoring *after* the first player has committed.
- Allowing the first player to cancel or amend their swap after submitting. Submission remains final; instant reveal only changes when its consequences become visible.
- Any change to matchmaking, rematch, Elo, lobby, profile, or post-game surfaces.
- Animations or audio polish for the instant reveal beyond reusing the existing scored-tile highlight / freeze / score-delta animations.
- Multi-player (>2) generalisation. Wottle is strictly 2-player and this feature inherits that.
