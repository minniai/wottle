# Feature Specification: Improve Scoring Resolution Visualization

**Feature Branch**: `043-scoring-resolution-viz`
**Created**: 2026-06-18
**Status**: Draft
**Input**: User description: "Improve scoring resolution visualization per docs/proposals/260617-word-scoring-resolution.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what scored this round, distinct from earlier rounds (Priority: P1)

As a player, while a round is resolving I want the tiles that formed words **this round** to stay
clearly highlighted — visually separate from tiles that scored in earlier rounds — so I can read
exactly what just happened before the next round begins.

**Why this priority**: This is the core complaint in the proposal. Without a current-vs-previous
distinction, players cannot tell which words drove the round's score. It is the highest-value slice
and is independently demonstrable.

**Independent Test**: Play a round where each player scores at least one word, with at least one
previously-frozen/scored word already on the board. Verify the current round's scored tiles carry a
distinct, player-colored highlight that persists until the round completes, while earlier-round
tiles show the calmer settled treatment. Confirm that when the round completes, the current-round
tiles settle into the previously-scored look.

**Acceptance Scenarios**:

1. **Given** a round in progress with tiles already frozen from earlier rounds, **When** the current
   round resolves with new scored words, **Then** the newly-scored tiles display a distinct
   player-colored highlight that is visually separable from the earlier-round tiles.
2. **Given** current-round scored tiles are highlighted, **When** the round has not yet completed
   (opponent still to move, or resolution in progress), **Then** the current-round highlight remains
   visible (it does not auto-clear after ~1 second as before).
3. **Given** the round completes (both players moved and resolution finished), **When** the next
   round begins, **Then** the just-scored tiles settle into the previously-scored/frozen treatment
   and are no longer marked as "current round."
4. **Given** both players scored words in the same round, **When** the round resolves, **Then** each
   player's scored tiles are highlighted in that player's attributed color.

---

### User Story 2 - Calm "waiting for opponent" state without greying the board (Priority: P1)

As a player who has submitted my move, I want a pleasant, clear indication that I'm waiting for my
opponent — without the entire board being greyed out and looking disabled — so the board stays
readable and the experience feels polished.

**Why this priority**: The grey-out is explicitly called out as unappealing and is the most visible
pain point. Removing it materially improves perceived quality and is independently testable.

**Independent Test**: Submit a move and observe the board. Verify tiles remain full-color and
legible (no heavy dim/desaturation), and that a clear non-destructive indicator (framed board border
plus waiting banner) communicates that the move is locked and the player is waiting.

**Acceptance Scenarios**:

1. **Given** I have submitted my move for the round, **When** I look at the board, **Then** the board
   tiles remain at full color and legibility (no whole-board grey-out / desaturation).
2. **Given** I have submitted my move and am waiting, **When** I look at the board, **Then** a clear
   visual indicator (a board frame/border treatment plus a "waiting for opponent" banner) tells me my
   move is locked and the round is awaiting my opponent.
3. **Given** I am in the waiting state, **When** I attempt to interact with the board, **Then** my
   input has no effect on the locked board (I cannot submit a second move), consistent with today's
   move-lock rules.
4. **Given** the opponent submits and the round resolves, **When** the next round begins, **Then**
   the waiting indicator is removed and the board returns to its normal interactive state.

---

### User Story 3 - Swapped tiles reveal, then fade if they don't score (Priority: P2)

As a player, when a swap is made I want to see the swapped tiles briefly, but if they don't form a
scored word I want that emphasis to fade away cleanly — so the board isn't cluttered with leftover
highlights on tiles that scored nothing.

**Why this priority**: Improves clarity and reduces visual noise, but depends on the scored-tile and
waiting-state work landing first to be coherent. Valuable polish rather than the core fix.

**Independent Test**: Make a swap that forms no word. Verify the swapped tiles animate into place
with a brief reveal highlight, then the highlight fades (after a few seconds, or as soon as scoring
resolves with no word), leaving the plain letters. Make a swap that does form a word and verify those
tiles instead transition into the current-round scored highlight.

**Acceptance Scenarios**:

1. **Given** a swap is submitted, **When** the tiles animate into place, **Then** the swapped tiles
   show a brief reveal highlight (preserving the existing swap-in animation).
2. **Given** a swap forms no scored word, **When** scoring resolution completes (or after a few
   seconds at most), **Then** the swapped tiles' reveal highlight fades out and the tiles return to
   their plain appearance with letters intact.
3. **Given** a swap forms a scored word, **When** scoring resolution completes, **Then** the relevant
   swapped tiles transition into the current-round scored highlight (User Story 1) rather than fading
   to plain.
4. **Given** only one of the two swapped tiles is part of a scored word, **When** scoring resolves,
   **Then** the scored tile shows the current-round scored highlight and the non-scoring tile's
   reveal highlight fades out.

---

### Edge Cases

- **Zero-score round / pass:** A round where neither player forms a word (or a timeout pass) must
  still cleanly clear all reveal highlights and present no spurious "current-round scored" marks.
- **Instant-scoring fast path (spec 042):** The first mover's words can reveal on both boards
  mid-round. The current-round highlight for those tiles must persist (not auto-clear after ~1.2s)
  and remain visually consistent when the full round summary later arrives — no double-flash or color
  change for the same tiles.
- **Both players score the same tile / overlapping coordinates:** Color attribution must remain
  deterministic and not flicker between players.
- **Reduced motion:** With `prefers-reduced-motion`, the framed-board indicator, reveal-fade, and
  current-round highlight must degrade to non-animated equivalents that still clearly convey state
  (consistent with existing reduced-motion handling).
- **Realtime vs polling:** The visual states must behave equivalently whether match updates arrive
  via Realtime broadcast or the polling fallback.
- **Match completion:** On the final round, current-round scored tiles should remain visible long
  enough to be read before navigation to the post-game summary.
- **Opponent reveal mid-round:** The opponent's swap reveal (existing behavior) must coexist with the
  new waiting indicator and current-round highlight without visual conflict.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST indicate the "move submitted, waiting for opponent" state **without**
  greying out / desaturating the whole board; board tiles MUST remain at full color and legibility.
- **FR-002**: The system MUST present a clear, non-destructive waiting indicator while a player's
  move is locked — a board frame/border treatment together with a "waiting for opponent" banner.
- **FR-003**: While locked and waiting, the system MUST continue to prevent the player from
  submitting a second move for that round (existing move-lock behavior preserved).
- **FR-004**: When a swap is submitted, the system MUST animate the swapped tiles into place and show
  a brief reveal highlight on them (existing swap-in animation preserved).
- **FR-005**: When swapped tiles are **not** part of any scored word, the system MUST fade out their
  reveal highlight — after a short delay or as soon as scoring resolution completes with no word —
  leaving the plain tiles with letters intact.
- **FR-006**: When swapped tiles **are** part of a scored word, the system MUST transition those
  tiles into the current-round scored highlight rather than fading them to plain.
- **FR-007**: The system MUST visually distinguish tiles scored in the **current** round from tiles
  scored in **previous** rounds.
- **FR-008**: The system MUST keep the current-round scored highlight visible until the round
  **completes** (both players' moves resolved), rather than auto-clearing after a fixed short
  interval.
- **FR-009**: When a round completes, the system MUST settle the current-round scored tiles into the
  previously-scored / frozen treatment so the next round's current-round highlight is unambiguous.
- **FR-010**: The system MUST attribute each scored tile's current-round highlight to the player who
  formed the word, using that player's color.
- **FR-011**: The current-round highlight MUST be consistent with the instant-scoring fast path
  (spec 042): tiles revealed for the first mover mid-round MUST adopt the persistent current-round
  highlight and MUST NOT re-flash or change attribution when the full round summary arrives.
- **FR-012**: The system MUST handle zero-score rounds and timeout passes by clearing all reveal
  highlights and showing no current-round scored marks.
- **FR-013**: All new visual states (framed waiting indicator, reveal-fade, current-round highlight)
  MUST honor `prefers-reduced-motion` by degrading to clear, non-animated equivalents.
- **FR-014**: The new visual states MUST render equivalently under both Realtime and polling update
  modes.
- **FR-015**: Animated visual states MUST use GPU-accelerated transforms/opacity (per project
  performance standards) and MUST NOT regress move round-trip or render performance.

### Key Entities *(include if feature involves data)*

This feature is presentation-only and introduces **no new persisted data**. It consumes existing
match state already broadcast to clients:

- **Round scored tiles (current round)**: The set of board coordinates that formed scored words in
  the round currently resolving, with the attributed player — derived from the existing round summary
  / partial summary highlights. Needs a notion of "belongs to the current round" vs "belongs to a
  prior round."
- **Previously scored / frozen tiles**: The existing frozen-tile map (per-owner) representing tiles
  locked from earlier rounds.
- **Swap reveal tiles**: The just-swapped coordinates for a submission, used to drive the reveal /
  reveal-fade lifecycle.
- **Move-lock / waiting state**: The existing per-player "has submitted, awaiting opponent" flag that
  drives the waiting indicator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After submitting a move, 0% of the board area is greyed-out/desaturated, while 100% of
  players can still identify they are in a waiting state from the on-screen indicator.
- **SC-002**: In a round where both players score, a player can correctly identify which tiles scored
  **this round** (vs earlier rounds) within 3 seconds of resolution, in usability checks.
- **SC-003**: Current-round scored highlights remain visible for the entire duration between
  resolution and round completion (no premature auto-clear), verified across rounds of varying
  lengths.
- **SC-004**: Swapped tiles that score no word return to plain appearance within a few seconds (or
  immediately on resolution), with no leftover highlight persisting into the next round — 100% of
  unscored swaps.
- **SC-005**: The instant-scoring mid-round reveal shows no double-flash or color change for the same
  tiles when the full summary arrives — 0 visual regressions in two-player playtests.
- **SC-006**: Move round-trip and render performance stay within existing SLAs (move RTT < 200ms p95;
  animations GPU-accelerated) with no measurable regression versus the current baseline.
- **SC-007**: All new visual states have non-animated equivalents under `prefers-reduced-motion` that
  still convey waiting, reveal-fade, and current-round-scored states.

## Assumptions

- "Disappear" for unscored swapped tiles means the **reveal highlight** fades; letters remain on the
  board (the 10×10 grid is always full). Confirmed with the user.
- The waiting indicator is a **board frame/border + existing banner**, not a full overlay or modal.
  Confirmed with the user.
- Current-round scored tiles use a **persistent player-colored glow/ring** held until round
  completion, then settle into the existing frozen look. Confirmed with the user.
- "Round completes" means both players' moves have been resolved for the round (the existing
  state-machine `resolving → completed`/next-round transition), not merely the first mover's
  instant-score reveal.
- No backend/schema/Server Action changes are required; this is a client presentation change driven
  by existing match state (round summary, partial summary, frozen-tile map, move-lock flags).
- Existing accessibility affordances (aria-live announcements on freeze, focus handling) are
  preserved and extended where the new states warrant.
