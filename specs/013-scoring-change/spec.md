# Feature Specification: Scoring Rules Overhaul

**Feature Branch**: `013-scoring-change`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "Overhaul scoring mechanics: 2-letter minimum words, orthogonal-only scanning from swap coordinates, time-based precedence with immediate tile freezing, exclusive tile ownership (no shared tiles), cross-opponent word scoring with zero-value opponent tiles, Scrabble-style cross-validation for all adjacent scored tiles, and coordinate-based duplicate allowance."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Orthogonal Word Discovery from Swap Coordinates (Priority: P1)

A player swaps two tiles and the system performs an exhaustive search in all four orthogonal directions (up, down, left, right) from each swapped tile's coordinates, enumerating ALL valid dictionary words (including overlapping subwords and superwords) that contain the swap coordinate. The system then selects the combination of words that maximizes the player's total score while satisfying cross-validation.

**Why this priority**: Word discovery is the foundation of scoring — without correct directional scanning from swap coordinates, no other scoring rule can function.

**Independent Test**: Swap two tiles on a board with known letter arrangements and verify that only orthogonal words containing the swap coordinates are found — no diagonal words, and no words that don't pass through a swap coordinate.

**Acceptance Scenarios**:

1. **Given** a board where swapping tile at (2,4) with tile at (7,3) creates a valid 3-letter horizontal word through (2,4), **When** the round resolves, **Then** that word is scored.
2. **Given** a board where swapping creates a valid 2-letter vertical word through (7,3), **When** the round resolves, **Then** that 2-letter word is scored.
3. **Given** a board where swapping creates a valid diagonal word through a swap coordinate, **When** the round resolves, **Then** that diagonal word is NOT scored.
4. **Given** a board where a valid word exists orthogonally but does NOT pass through either swap coordinate, **When** the round resolves, **Then** that word is NOT scored.
5. **Given** a swap that creates both a horizontal and a vertical valid word through the same swap coordinate, **When** the round resolves, **Then** both words are scored.
6. **Given** a swap where scanning up from (2,4) finds one word and scanning down from (2,4) finds a different word, **When** the round resolves, **Then** both words are scored independently.
7. **Given** a swap where "ANDI" and "ANDINN" are both valid words in the same direction through the swap coordinate, **When** the round resolves, **Then** "ANDINN" is selected because it yields a higher score.
8. **Given** a swap where two overlapping words exist in the same direction (e.g., "ÁS" at positions 3-4 and "ÁSTIN" at positions 3-7), **When** the round resolves, **Then** both are candidates and the highest-scoring valid combination is chosen.
9. **Given** a swap where the superword "ANDINN" fails cross-validation but the subword "ANDI" passes, **When** the round resolves, **Then** "ANDI" is scored as the best valid alternative.

---

### User Story 2 — Time-Based Scoring Precedence with Immediate Freezing (Priority: P1)

Within each round, the player who submits their move first has their words scored and tiles frozen before the second player's words are evaluated. The second player's word discovery treats the first player's newly frozen tiles as if they were frozen from a prior round.

**Why this priority**: This fundamentally changes the competitive dynamics — moving quickly grants a strategic advantage by freezing tiles before the opponent's words are evaluated.

**Independent Test**: In a round where both players submit moves, verify that the first submitter's words are scored and tiles frozen before the second submitter's words are evaluated, and the second player's scoring respects the first player's newly frozen tiles.

**Acceptance Scenarios**:

1. **Given** Player A submits before Player B, **When** the round resolves, **Then** Player A's words are discovered and scored first, and all of Player A's scored tiles are frozen before Player B's words are evaluated.
2. **Given** Player A's move creates a word that freezes tiles at positions also used by Player B's potential word, **When** Player B's words are evaluated, **Then** those tiles are treated as frozen (owned by Player A) and score zero letter points for Player B.
3. **Given** Player B submits first (despite being "player_b" in the match), **When** the round resolves, **Then** Player B has scoring precedence (precedence is by submission time, not by player slot).

---

### User Story 3 — Exclusive Tile Ownership (Priority: P1)

All scored tiles are permanently owned by exactly one player. Once a tile is scored by a player, it displays in that player's color and never changes ownership. There are no shared/common tiles.

**Why this priority**: Exclusive ownership simplifies the visual board state and creates clearer territorial strategy — players compete for board real estate.

**Independent Test**: Score words for both players across multiple rounds and verify every frozen tile has exactly one owner that never changes.

**Acceptance Scenarios**:

1. **Given** Player A scores a word that freezes tile at (3,4), **When** Player B later scores a word that also passes through (3,4), **Then** tile (3,4) remains owned by Player A.
2. **Given** a tile is owned by Player A, **When** any subsequent round resolves, **Then** the tile's ownership never changes to Player B or to "shared."
3. **Given** the board is displayed, **When** a tile is frozen, **Then** it shows exactly one player's color — never a mixed or shared indicator.

---

### User Story 4 — Cross-Opponent Word Scoring (Priority: P2)

Words can span tiles owned by the opponent. The word is valid and scored, but opponent-owned tiles contribute zero letter points. The full word length still counts for the length bonus.

**Why this priority**: Allows strategic play through opponent territory — players can still form words using opponent tiles, receiving length bonus but not letter points for opponent-owned positions.

**Independent Test**: Create a word that spans both the player's own tiles and opponent-frozen tiles, and verify that letter points exclude opponent tiles while length bonus uses the full word length.

**Acceptance Scenarios**:

1. **Given** Player A swaps letter P into (2,4) creating word "PÆLA" where Æ, L, A at (3,4), (4,4), (5,4) are owned by Player B, **When** the round resolves, **Then** Player A scores letter points for P only, but the length bonus is based on word length 4.
2. **Given** a word where ALL tiles are owned by the opponent, **When** the round resolves, **Then** the word scores zero letter points but still earns the length bonus.
3. **Given** a word where no tiles are owned by the opponent, **When** the round resolves, **Then** all tiles contribute full letter points plus length bonus.

---

### User Story 5 — Board-Wide Cross-Validation Invariant (Priority: P2)

Every scored tile on the board must be part of a valid word in all orthogonal directions where it is adjacent to other scored tiles. This is a global board invariant — not a per-word check. When a player's swap produces multiple candidate words, the system selects the combination of words that all satisfy cross-validation together. If some candidate words would violate the invariant, they are excluded while the valid combination is scored.

**Why this priority**: This rule ensures board-wide word consistency at all times, adding strategic depth — players must consider how new words interact with all existing scored tiles.

**Independent Test**: Attempt to score multiple candidate words where only a subset satisfies cross-validation together — verify only the valid combination is scored.

**Acceptance Scenarios**:

1. **Given** word "PÆLA" at (2,4)→(5,4) and letter X is a scored tile at (3,5) adjacent to Æ at (3,4), **When** cross-validation checks the horizontal sequence at row 3, **Then** "PÆLA" is NOT scored because "ÆX" is not a valid word.
2. **Given** word "PÆLA" at (2,4)→(5,4) and letter É is a scored tile at (3,5) adjacent to Æ at (3,4), **When** cross-validation checks the horizontal sequence at row 3, **Then** "PÆLA" IS scored because "ÆÉ" (or the full cross-word containing both) is a valid word.
3. **Given** a word where none of its tiles are adjacent to any scored tiles, **When** cross-validation runs, **Then** the word is scored without cross-word checks.
4. **Given** a word where multiple tiles are each adjacent to scored tiles, **When** cross-validation runs, **Then** ALL cross-words must be valid for the word to be scored.
5. **Given** a swap that produces 3 candidate words but only 2 of them can coexist with valid cross-words, **When** the system resolves scoring, **Then** only the 2 mutually-valid words are scored and the third is excluded.
6. **Given** candidate word A and candidate word B from the same swap, where word A individually passes cross-validation but word B's tiles would create an invalid cross-word with word A's tiles, **When** the system resolves scoring, **Then** the system selects the combination that maximizes total points scored.

---

### User Story 6 — Coordinate-Based Duplicate Allowance (Priority: P3)

The same word text can be scored multiple times as long as it occupies different board coordinates. Uniqueness is determined by the coordinate set, not the word text.

**Why this priority**: Removing text-based duplicate penalties rewards players for finding the same word in multiple board locations, simplifying rules and increasing scoring opportunities.

**Independent Test**: Score the same word text at two different coordinate sets and verify both score full points.

**Acceptance Scenarios**:

1. **Given** Player A scores "HÚS" at coordinates {(1,1),(1,2),(1,3)} in round 1, **When** Player A scores "HÚS" at coordinates {(5,5),(5,6),(5,7)} in round 3, **Then** both instances score full points.
2. **Given** Player A scores "HÚS" at coordinates {(1,1),(1,2),(1,3)} in round 1, **When** Player A attempts to score "HÚS" at the same coordinates {(1,1),(1,2),(1,3)} in a later round, **Then** this cannot happen because those tiles are already frozen.
3. **Given** Player A and Player B each score the word "ÁS" at different coordinates in the same round, **When** points are tallied, **Then** both players receive full points for their respective instances.

---

### Edge Cases

- **Both players swap the same tile pair**: Conflict resolution (first-come-first-served by timestamp) applies — only the first submitter's swap is accepted.
- **A word is exactly 2 letters**: It is valid and scored. Letter points for both letters plus length bonus of (2−2)×5 = 0.
- **All tiles in a word are opponent-owned**: The word scores zero letter points but still earns the length bonus based on full word length.
- **Cross-validation combination selection**: A swap produces multiple candidate words but only a subset satisfies cross-validation together — the system selects the highest-scoring valid combination.
- **First player's scored tiles block second player's word via cross-validation**: The second player's candidate word fails cross-validation because the first player's newly frozen tiles create an invalid cross-word.
- **No valid words found after swap**: Round resolves normally with zero points for that player.
- **Simultaneous submission (identical timestamps)**: If both players' `submittedAt` timestamps are identical to the millisecond, player_a receives precedence as a deterministic tiebreaker.
- **Subword vs superword**: If "ANDI" (4 letters) and "ANDINN" (6 letters) are both valid through the same swap coordinate, ANDINN is preferred as it gives a higher score. However, if cross-validation makes ANDINN invalid but ANDI valid, ANDI is scored instead.
- **Unfrozen tile safeguard**: The existing ≥24 unfrozen tile safeguard still applies — freezing stops once the minimum unfrozen threshold is reached.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST find words in exactly four orthogonal directions (up, down, left, right) from each swapped tile's coordinates.
- **FR-002**: System MUST NOT find or score words in diagonal directions.
- **FR-003**: System MUST only score words that contain at least one of the two swapped tile coordinates.
- **FR-004**: System MUST accept words with a minimum length of 2 letters.
- **FR-005**: System MUST determine scoring precedence within a round by move submission timestamp — the earlier submitter has precedence.
- **FR-006**: System MUST score the first-to-submit player's words and freeze their scored tiles before evaluating the second-to-submit player's words.
- **FR-007**: When evaluating the second player's words, the system MUST treat the first player's newly frozen tiles identically to tiles frozen in prior rounds.
- **FR-008**: System MUST assign tile ownership to exactly one player — no shared or common tile ownership.
- **FR-009**: Once a tile is owned by a player, the system MUST NOT change that tile's ownership for the remainder of the match.
- **FR-010**: System MUST allow words to span tiles owned by the opponent.
- **FR-011**: When scoring a word containing opponent-owned tiles, the system MUST assign zero letter points for opponent-owned tile positions.
- **FR-012**: When scoring a word containing opponent-owned tiles, the system MUST calculate the length bonus using the full word length (including opponent-owned positions).
- **FR-013**: Every scored tile on the board MUST be part of a valid dictionary word in all orthogonal directions where it is adjacent to other scored tiles (global board invariant).
- **FR-014**: When a player's swap produces multiple candidate words, the system MUST select the combination of words that all satisfy the cross-validation invariant together — excluding any words that would violate it.
- **FR-014a**: When multiple valid combinations exist, the system MUST select the combination that maximizes the player's total points scored.
- **FR-015**: System MUST allow the same word text to be scored multiple times if it appears at different board coordinates.
- **FR-016**: System MUST determine word uniqueness by its coordinate set (the set of board positions the word occupies), not by word text.
- **FR-017**: System MUST NOT apply any combo bonus — per-word scoring is letter points + length bonus only.
- **FR-018**: System MUST maintain the existing ≥24 unfrozen tiles safeguard — tile freezing stops if it would reduce unfrozen tiles below 24.
- **FR-019**: System MUST display frozen tiles in the owning player's color with no shared-color indicator.
- **FR-020**: System MUST perform an exhaustive search in all orthogonal directions from each swap coordinate, enumerating ALL valid dictionary words (of length ≥2) that contain the swap coordinate — including overlapping words and subwords.
- **FR-021**: When multiple valid words overlap in the same direction through the same swap coordinate (e.g., "ANDI" and "ANDINN"), the system MUST include all of them as candidates for combination selection (FR-014/FR-014a).

### Key Entities

- **ScoredWord**: A valid dictionary word found at specific board coordinates, associated with the player who formed it, along with its letter points and length bonus.
- **FrozenTile**: A board position permanently owned by one player, displayed in that player's color. Cannot be re-owned.
- **SwapCoordinate**: The two board positions involved in a tile swap — word scanning originates from these coordinates.
- **CrossWord**: A perpendicular word sequence formed at a tile adjacent to scored tiles, used for cross-validation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All words scored in a match originate from orthogonal scanning of swap coordinates only — zero diagonal words appear in scoring results.
- **SC-002**: 2-letter valid words are discovered and scored when formed at swap coordinates.
- **SC-003**: Within each round, the first player to submit always has their tiles frozen before the second player's words are evaluated — no race conditions affect precedence.
- **SC-004**: Every frozen tile on the board is owned by exactly one player — zero tiles have shared or ambiguous ownership at any point during the match.
- **SC-005**: Players can form and score words that span opponent tiles, receiving correct partial letter points and full-length bonuses.
- **SC-006**: No word is scored that creates an invalid cross-word at any adjacent scored tile position.
- **SC-007**: The same word text scored at different coordinate sets receives full points each time — no text-based duplicate penalty is applied.
- **SC-008**: Round resolution completes within the existing performance budget (round resolution under 200ms, word validation under 50ms).

## Clarifications

### Session 2026-03-06

- Q: With text-based duplicates removed, should the combo bonus count all scored words, or be removed entirely? → A: Remove combo bonus entirely.
- Q: When a swap produces multiple candidate words, should they be validated independently or as a combination? → A: Cross-validation is a global board invariant — all scored tiles must be part of valid words in all directions. The system selects the combination of candidate words that satisfies this invariant, maximizing points when multiple valid combinations exist.
- Q: Should the system find only the longest word per direction, or all valid words? → A: Exhaustive search — all valid words including subwords. The highest-scoring combination is selected.

## Assumptions

- The existing conflict resolution mechanism (first-come-first-served by timestamp for overlapping swap targets) remains unchanged.
- The scoring formula is simplified to letter points + length bonus only (combo bonus is removed).
- The ≥24 unfrozen tiles safeguard remains unchanged.
- The 10-round match structure remains unchanged.
- "Adjacent" in the context of cross-validation means orthogonally adjacent (sharing an edge), not diagonally adjacent.
- Cross-validation considers the full contiguous sequence of letters in the perpendicular direction, not just the immediate neighbor pair.
