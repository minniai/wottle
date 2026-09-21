# Feature Specification: Ten moves each on one shared clock

**Feature Branch**: `050-async-moves`
**Created**: 2026-09-21
**Status**: Draft
**Design**: canvas https://claude.ai/artifact/SU3bj2nTT4tEyCiinoEAAB (eleven artboards: your move, picking, scoring, scored hold, opponent scores while you pick, refused pick, finished first, time is up, match over, end early, phone)
**Input**: User description: "Make the rules such that the players don't have to make moves in turn for each round, but rather each player must make 10 moves in 5 minutes without having to wait for the other player. There will be only a single timer of 5 minutes counting down for the game. Both players can make a move at any time during the 5 minutes; they can make moves simultaneously but the resolution mechanism must resolve the moves in the order moves are made to the millisecond. As soon as they make a move the score is revealed (they must wait for the reveal before making the next move) and the board is shown as frozen until the reveal. If a player does not make 10 moves within the 5 minutes they lose by default. If neither player makes all 10 moves before timeout, it's a draw. If a player submits their 10th move in the absolute last second, they are considered to have made the time limit even though the score reveal has not been completed; the reveal is shown and the game is complete."

## Background

Until this spec a match was ten synchronous rounds. Both players submitted one swap per round; the server resolved the round when both were in or a clock ran out; each player had a private 5:00 budget that stopped while they waited. Every table, type, beat and string in the room was indexed by the round.

The new rules remove the round. Each player makes **ten moves** whenever they like within **one shared 5:00 clock** that starts at match start and never pauses. The server resolves each move the moment it receives it, one at a time, in receipt order; a move is scored against the board and freeze map as the previous move left them. A player waits only for their own move's reveal. Not finishing ten moves is a default loss; neither finishing is a draw.

Two side decisions were taken with the change and are part of this spec. First, the shared clock is a fact about the match, so it is drawn once, in the ledger caption; the bars lose their clock and their lane counts that player's moves instead. Second, **the duplicate-word rule is withdrawn**: a word scores every time it is formed at a new location. (The rule was documented in the rules §3.7 and §5.4 but never implemented; `is_duplicate` was always written `false`.)

Decisions recorded 2026-09-21 (each was a question to the product owner; the answer is binding):

| Question | Decision |
| --- | --- |
| A move resolved against a letter an earlier move froze or moved | Rejected and **not consumed**; the player picks again |
| Does the shared clock ever pause | **Never**: not for a disconnect, not for a reveal |
| Ledger layout | Ten rows by move number: your Nth move in your column, theirs in theirs |
| Win rules | <10 moves at 5:00 loses even with the higher score; both <10 is a draw; both 10 → score → exclusive frozen tiles → draw. Every outcome is rated |
| What a player waits for | Their own full reveal (bands, count-up) and a **600ms** hold; the server also refuses a second in-flight move |
| Terminology | "move", never "round" |
| The opponent's activity on your field | Their letters change and their bands draw live while you pick; a pick on a letter they touched clears with a notice; no pending pins |
| Finished first | Watch, field locked, `10 of 10 played` over `waiting for Kári · 8 of 10 · 1:12 left` |
| Existing data | Hard cut: every match row is deleted and every rating reset |
| Opponent gone after you have finished | A narrowed end-early slip after 90s; normal rules apply |
| Where the clock is drawn | The ledger caption only; the bar lane counts moves 0–10 |
| Duplicate words | Score every time (rule withdrawn) |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move whenever you like (Priority: P1)

A player picks two letters and commits whenever they are ready. Their move resolves at once, the bands draw and the totals count up, the scored row holds briefly, and the next move opens. They never wait for the opponent.

**Why this priority**: This is the rule change. Without it nothing else in the spec exists.

**Independent Test**: One player plays three moves in a row on a fixture match while the opponent does nothing; each move resolves, the ledger fills rows 1–3 of the player's column, the rail advances to `move 4 of 10`, and the opponent's column stays empty.

**Acceptance Scenarios**:

1. **Given** a live match on move 4 with the field framed in the viewer's colour, **When** the player commits a swap, **Then** the frame returns to ink, the live row reads `move 4 · scoring`, the field takes no pick, and within the resolution budget the bands draw, the total counts up, the row reads `move 4 scored` over `you +13 · move 5 opens`, and 600ms later the live row reads `move 5 · your move` with the frame back in colour.
2. **Given** a committed move whose resolution has not arrived, **When** the player taps a letter, **Then** nothing is picked.
3. **Given** a committed move whose resolution has not arrived, **When** a second move for the same player reaches the server, **Then** it is refused with reason `in_flight` and is not counted.
4. **Given** a move that forms no word, **When** it resolves, **Then** the row writes `0`, the count advances, no band draws, and the next move opens after the hold.

---

### User Story 2 - Resolution in receipt order (Priority: P1)

Two moves that arrive close together are resolved strictly in the order the server received them. The later move sees the board and freezes the earlier one left; if it needs a letter the earlier move froze or moved, it is refused and the player picks again without losing a move.

**Why this priority**: The game is fair only if precedence is deterministic and server-owned.

**Independent Test**: Two clients submit swaps that share a letter within a few milliseconds of each other; exactly one resolves, the other is refused with `frozen` or `moved`, the refused player's move count is unchanged, and the order matches the server's receipt sequence regardless of which client sent first by its own clock.

**Acceptance Scenarios**:

1. **Given** Kári's move froze the letter at F6 at receipt sequence 12, **When** Birna's move touching F6 is received at sequence 13, **Then** Birna's move is refused with reason `frozen`, her count stays at 4, and her live row reads `move 5 · your move` over `frozen · Kári just froze it · pick another` for two seconds.
2. **Given** Kári's move exchanged the letters at B3 and H7 at sequence 12, **When** Birna's move naming B3 with the letter she saw before the exchange is received at sequence 13, **Then** it is refused with reason `moved` and her row reads `moved · Kári just moved it · pick another`.
3. **Given** two server instances each holding one pending move, **When** both try to resolve, **Then** the move with the lower receipt sequence resolves first and the other waits for it; no move is resolved twice and no move is skipped.
4. **Given** a resolver that crashed after claiming a move, **When** ten seconds pass, **Then** the next resolver reclaims and resolves it, and the result is the same as it would have been.

---

### User Story 3 - One shared clock and the ten-move rule (Priority: P1)

One 5:00 clock runs from match start, in the ledger caption. When it reaches 0:00 (or earlier, when both players have ten moves), the match is decided: a player short of ten moves loses; both short is a draw; otherwise the higher total wins, then the exclusive frozen-tile count, then a draw. Every result is rated.

**Why this priority**: The end conditions define winning; the clock is the only pressure in the game.

**Independent Test**: With the match clock shortened for the test, one player finishes ten moves and the other does not; at 0:00 the match completes with `incomplete`, the finisher wins whatever the totals, both rating rows are written once, and the match-over slip reads `Kári played 6 of 10`.

**Acceptance Scenarios**:

1. **Given** Birna has 10 moves and 88 points and Kári has 8 moves and 134 points, **When** the clock reaches 0:00, **Then** Birna wins, the reason is `incomplete`, and the detail line reads `Kári played 8 of 10`.
2. **Given** both players have fewer than 10 moves at 0:00, **Then** the match is a draw with reason `both_incomplete` and the detail line reads `neither finished`.
3. **Given** both players have 10 moves before 0:00, **Then** the match completes at once with reason `moves_complete`; the higher total wins, a tie goes to the exclusive frozen-tile count, and a full tie is a draw.
4. **Given** a 10th move received by the server 40ms before the deadline, **When** it resolves 300ms after the deadline, **Then** it counts, its reveal is shown, and only then does the match complete.
5. **Given** a move received after the deadline, **Then** it is refused with reason `deadline` and nothing is written.
6. **Given** three triggers race to complete the same match (the resolver, a state poll, the cron sweep), **Then** the match is completed once and the ratings are applied once.

---

### User Story 4 - Watching the opponent (Priority: P2)

While a player picks, the opponent's resolved moves land on their field: letters exchange, bands draw at 30% then settle to 14%, the opponent's total counts up, their bar reads their move count and whether they are scoring. If a picked letter was frozen or moved by the opponent, the pick clears with a notice. Nothing the opponent does locks the field.

**Why this priority**: Reading the opponent is the strategy; without it the shared field is a surprise generator.

**Independent Test**: With Birna holding one picked letter, Kári's move resolves touching that letter; Birna's pick clears and the live row reads `pick cleared · Kári moved that letter`; a second Kári move touching nothing of hers draws its band without changing her pick.

**Acceptance Scenarios**:

1. **Given** Birna is picking, **When** Kári's move resolves, **Then** Kári's bar reads `7 of 10 · playing`, his band draws, his total counts up, and Birna's frame stays in her colour with her pick intact.
2. **Given** Birna has picked the letter at A10, **When** Kári's resolved move exchanged A10, **Then** her pick clears and the live row's second line reads `pick cleared · Kári moved that letter`.
3. **Given** Kári's move is in flight, **Then** his bar reads `6 of 10 · scoring`; nothing is pinned on Birna's field.

---

### User Story 5 - Finished first (Priority: P2)

A player who has made ten moves watches the rest of the match with the field locked. If the opponent has been gone for the reconnection window, the player may end the match early; the normal rules apply.

**Why this priority**: Without it the finisher stares at a locked field for up to five minutes with no explanation and no exit.

**Independent Test**: Birna makes ten moves; her live row reads `10 of 10 played` over `waiting for Kári · 8 of 10 · 1:12 left`, the field takes no pick, and when Kári has been gone 90s the slip `Kári is gone` offers `end the match ▸`, which completes the match with `incomplete`.

**Acceptance Scenarios**:

1. **Given** Birna's tenth move has resolved and held, **Then** the rail is all ink, her bar reads `10 of 10 · done`, the field has no frame and takes no pick, and the live row reads `10 of 10 played` over `waiting for Kári · 8 of 10 · 1:12 left`.
2. **Given** Birna is done and Kári has been gone 90s, **When** the slip lands, **Then** it reads `Kári is gone` · `Kári 8 of 10 · 0:00 left to reconnect` · `end the match ▸` · `keep waiting ▸`, and `end the match ▸` completes the match under the normal rules.
3. **Given** Birna is not done and Kári is gone, **Then** no slip is offered; the clock runs and Kári simply fails to finish.

---

### User Story 6 - Reading the match (Priority: P3)

The ledger's ten rows are indexed by move number; each column fills at its own pace. The caption carries the clock; the rail counts the viewer's moves; each bar's sub-line carries that player's count.

**Why this priority**: Legibility; the rules work without it, but a match is unreadable without it.

**Independent Test**: The `/dev/room` fixtures for every new phase render at three viewports and match their baselines.

**Acceptance Scenarios**:

1. **Given** Birna has 3 moves and Kári 6, **Then** rows 1–3 hold both columns, rows 4–6 hold only Kári's, row 4 is the live row in Birna's column, the caption reads `move 4 of 10 · 3:12`, the rail shows three ink cells and the fourth framed.
2. **Given** the clock is under 1:00, **Then** the caption numeral is weight 600 and blinks in colour only; under `prefers-reduced-motion` it holds solid.
3. **Given** the match is over, **Then** the caption reads `final · 4:52`, the rail is all ink, and the verdict block reads `Birna wins 134–88` over `Kári played 8 of 10`.

### Edge Cases

- A move's two letters are identical: the exchange changes nothing, the move resolves normally and counts.
- The tenth moves of both players are received in the same millisecond: both resolve in receipt sequence, then the match completes with `moves_complete`.
- The deadline passes while a resolver is mid-move: the move was received before the deadline, so it resolves and counts; settlement runs after the queue is drained.
- A player disconnects with a move in flight: it resolves; on reconnect the room hydrates the resolution from state.
- A resolver crashes three times on the same move: the match completes with reason `error`, as the scoring-retry path does today.
- Both players finish with equal totals and equal exclusive frozen tiles: draw, reason `moves_complete`.
- The rate limit: ten moves plus refused picks stay under the 30 per minute limit; a refusal does not consume the limit differently from an acceptance.

## Requirements *(mandatory)*

### Functional Requirements

**Moves (US1, US2)**

- **FR-001**: Each player MUST be allowed exactly ten resolved moves per match; an eleventh is refused with reason `cap`.
- **FR-002**: A move MUST be received server-side under a per-match lock that assigns it a gap-free receipt sequence and a server timestamp; client timestamps MUST NOT be read.
- **FR-003**: Moves MUST resolve one at a time in receipt-sequence order; a move MUST be scored against the board and freeze map as written by the previous sequence.
- **FR-004**: A player MUST have at most one unresolved move; a second is refused with reason `in_flight`.
- **FR-005**: A move whose letters were frozen or exchanged since the player saw them MUST be refused (`frozen`, `moved`) and MUST NOT count toward ten.
- **FR-006**: Resolution MUST be idempotent and recoverable: a claimed move not finished within 10s MUST be reclaimable, and a finished move MUST never be finished twice.
- **FR-007**: A word MUST score every time it is formed at a new location; no duplicate suppression.

**Clock and end (US3, US5)**

- **FR-008**: One match clock of 5:00 MUST start when the match starts and MUST NOT pause for any reason.
- **FR-009**: A move received at or before the deadline MUST be resolved and counted even if resolution completes after the deadline; a move received after the deadline MUST be refused with reason `deadline`.
- **FR-010**: The match MUST complete when both players have ten moves or the deadline has passed and the queue is drained; the winner MUST be decided by move count first (`incomplete`, `both_incomplete`), then score, then exclusive frozen tiles, then draw (`moves_complete`).
- **FR-011**: Completion MUST be a compare-and-set so that racing triggers apply ratings once.
- **FR-012**: A player with ten moves whose opponent has been unreachable for 90s MUST be offered `end the match ▸`, which completes the match under FR-010.

**Room (US1, US4, US5, US6)**

- **FR-013**: The field MUST take no pick while the viewer's own move is unresolved, revealing or holding (600ms); the opponent's reveal MUST NOT lock it.
- **FR-014**: A pick on a letter the opponent's resolved move exchanged or froze MUST clear with a notice.
- **FR-015**: The shared clock MUST be drawn in the ledger caption only; each bar's lane MUST show that player's moves 0–10 in the seat colour and its sub-line MUST carry the count.
- **FR-016**: Ledger rows MUST be indexed by move number with each seat's column independent; the live row MUST be the viewer's next open move.
- **FR-017**: Every room string MUST say "move", never "round"; the fixed strings are listed in the design system §8.
- **FR-018**: `/dev/room` MUST render every new phase from static fixtures and the visual suite MUST cover them.

### Key Entities

- **Match**: the live board, the clock (`started_at`, `deadline_at`), the receipt counter and the resolution cursor, each player's move count and score, the frozen map, the result.
- **Move**: one player's swap with its receipt sequence and timestamp, its status (`pending`, `resolving`, `resolved`, `rejected`), its per-player sequence when resolved, the board and freeze map before and after, its delta and the totals after it.
- **Word score entry**: a scored word belonging to one move.
- **Move resolution (event)**: what the server broadcasts when a move finishes: the move, its status, the board after, the words, the delta, the totals, the freeze map and both counts.

## Assumptions

- The combo bonus (rules §5.3) applies per player per move.
- A refused move returns the player to `your move` with a two-second notice and no hold.
- "Moved" is detected from the two letters the client sends with the swap; a mismatch with the live board is a refusal. Identical letters pass.
- The receipt sequence is the ordering authority; the receipt timestamp is informational (a database clock is not guaranteed monotone across a restart).
- Resolution runs after the response (`after()`), not inline, so a cold dictionary never sits on the move request; the dictionary is warmed at match start.
- The reconnection window stays 90s and the opponent's bar still shows `reconnecting · 0:42 left` with a dashed lane; nothing else holds.
- No live users: the migration deletes all match data and resets ratings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Move receipt round trip under 200ms at p95 on a warm instance; resolution latency (receipt to broadcast) under 200ms at p95 warm, measured server-side.
- **SC-002**: 200 concurrent submission pairs against one match produce a gap-free receipt sequence, a monotone resolution cursor and zero double-finishes.
- **SC-003**: A match whose resolver is killed mid-claim completes within 15s of the last move.
- **SC-004**: A move received one millisecond before the deadline is counted; one received one millisecond after is refused.
- **SC-005**: A two-player Playwright match completes with both ledgers identical and every result rated exactly once.
- **SC-006**: The visual suite is green at three viewports over every fixture phase, and no retired string appears in the tree.
