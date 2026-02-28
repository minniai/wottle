# Feature Specification: Game Rules Configuration

**Feature Branch**: `009-game-rules-config`  
**Created**: 2026-02-27  
**Status**: Draft  
**Input**: User description: "Add config options to the game such as: the word length, the number of rounds, the time per round, left-to-right, right-to-left, top-to-bottom, bottom-to-top, etc. For the MVP the config options can be set in code, and are not required in a UI Change the scoring and word validation rules to be more in line with Scrabble. We will not use diagonal words, only horizontal and vertical words. Another key change is that words have to valid in every direction at every coordinate, meaning, if two letters adacent to each other are not part of a valid word in all four directions (horizontal, vertical, and the two diagonals), then the word is not valid."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configurable Game Parameters Engine (Priority: P1)

Developers and Game Designers need to be able to configure core game parameters (word length, number of rounds, time per round, and valid directions) in the codebase to iterate on gameplay balancing without requiring immediate UI support.

**Why this priority**: It is the foundation for adjusting the game's difficulty and pacing, fulfilling the prompt's request for game config options.

**Independent Test**: Can be fully tested by modifying the configuration file/object and verifying that the game engine enforces the new rules (e.g., fewer rounds, shorter time limits) via unit tests.

**Acceptance Scenarios**:

1. **Given** the game configuration sets `maxRounds` to 3, **When** the 3rd round ends, **Then** the game properly triggers the match end state.
2. **Given** the game configuration declares `allowedDirections: ["right", "down"]` _(MVP: reserved field, not enforced in engine)_, **When** the engine runs, **Then** it still scores words in all four orthogonal directions — enforcement of `allowedDirections` is out of scope for this MVP iteration and reserved for a future configuration pass.

---

### User Story 2 - Scrabble-style Word and Adjacency Validation (Priority: P1)

Players must place words purely in vertical or horizontal directions, and any new tile placement must only form valid words with all adjacent tiles, mimicking standard Scrabble crossing rules.

**Why this priority**: This radically changes the core validation loop, acting as the primary differentiator for the new gameplay iteration.

**Independent Test**: Can be fully tested via engine unit tests that place tiles adjacent to existing tiles and assert whether the engine correctly accepts or rejects the board state based on cross-word validity.

**Acceptance Scenarios**:

1. **Given** the word "CAT" exists horizontally on the board, **When** a user places "A" and "R" vertically to form "CAR" using the "C", **Then** the placement is accepted.
2. **Given** the word "CAT" exists horizontally, **When** a user places "Z" adjacent to "T" creating the non-word "TZ" vertically/horizontally, **Then** the entire move is rejected.
3. **Given** a user attempts to place a valid word diagonally, **When** they submit the move, **Then** the system rejects it, enforcing horizontal/vertical constraints.

---

### User Story 3 - Frozen Tile Word Extension Scoring (Priority: P1)

Players who extend an opponent's frozen word into a longer valid word receive letter points only for
the tiles they personally contributed, but receive the full length bonus calculated from the
complete extended word.

**Why this priority**: This rule prevents "free riding" on an opponent's frozen letters while still
rewarding the strategic value of forming longer words. It changes the scoring of any word that
spans opponent-owned frozen tiles.

**Independent Test**: Can be fully tested via unit tests that simulate a board where one player's
frozen tiles are partially included in another player's newly scored word, and verify that
`lettersPoints` only includes the new player's tile values while `lengthBonus` uses the full word
length.

**Acceptance Scenarios**:

1. **Given** Player A has frozen tiles spelling "TAÐI" at row 1 (columns 3–6), **When** Player B
   swaps tiles so that "RA" appears at columns 1–2 forming the valid 6-letter word "RATAÐI",
   **Then** Player B's `lettersPoints` equals the letter values of "RA" only, and `lengthBonus`
   equals `(6-2)*5 = 20`.
2. **Given** a tile is frozen as owned by "both" players, **When** either player forms a word
   containing it, **Then** that tile's letter is included in their `lettersPoints` (tiles owned by
   "both" are freely scoreable by either player).
3. **Given** Player B forms a valid word entirely from their own tiles (no opponent-frozen tiles
   in the word), **When** the score is computed, **Then** `lettersPoints` includes all tile values
   normally.

---

### Edge Cases

- What happens when a player plays a single letter that is valid in both intersecting axes?
- How does the system handle "words" of length 1 created incidentally by placement? (Typically Scrabble requires words to be at least 2 letters, except for the first tile/board setup constraints)
- What happens when the configuration sets invalid or contradictory limits (e.g., word length exceeds board size)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a central code-based configuration module to define game parameters: maximum word length, number of rounds, time per round, and allowed reading directions. For MVP, `allowedDirections` is a declared config field but is not enforced by the engine — all four orthogonal directions (right, left, down, up) are always scored. Engine enforcement of `allowedDirections` is deferred to a future iteration.
- **FR-002**: System MUST restrict all tile placements to orthogonal directions (right, left, down, up). Diagonal placements are strictly prohibited. Words are scored in all four orthogonal directions independently — a "left" direction word (read right-to-left) and a "right" direction word (read left-to-right) over the same tiles are distinct scored words.
- **FR-003**: System MUST evaluate all continuous tile sequences formed by a new placement (the primary word AND any crossing words formed with adjacent tiles).
- **FR-004**: System MUST reject a move if ANY of the resulting adjacent sequences on the grid do not form a valid dictionary word in at least one reading direction (OR semantics: a sequence is valid if it is a dictionary word read either forwards or backwards along its axis).
- **FR-005**: System MUST treat letters adjacent in standard horizontal and vertical directions as continuous sequences. Adjacency validation strictly checks only orthogonal (right, left, down, up) row and column intersections like traditional Scrabble. Words can touch diagonally without forming valid words.
- **FR-006**: System MUST maintain the existing per-letter and length-bonus scoring formula, with the following three changes from the prior implementation: (1) diagonal words are no longer scored; (2) words in all four orthogonal directions (right, left, down, up) are scored independently — the same tile run may yield both a "right" and a "left" scored word if both readings are valid dictionary words; (3) letter points (`lettersPoints`) for a word that spans opponent-frozen tiles are restricted to the scoring player's own tiles (see FR-007), while the length bonus uses the full word length.
- **FR-007**: System MUST allow players to score words that contain tiles frozen by the opponent. Letter points (`lettersPoints`) are awarded only for tiles the scoring player contributed; tiles owned by the opponent are excluded from letter point calculation. The length bonus (`lengthBonus`) is calculated using the full word length regardless of tile ownership. Tiles owned by "both" players are treated as the scoring player's own tiles for letter point purposes.

### Key Entities

- **GameConfig** (`lib/constants/game-config.ts`): Defines `boardSize`, `maxRounds`, `timePerRoundMs`, `minimumWordLength`, and `allowedDirections`. Consumed as a default parameter throughout `lib/game-engine/`.
- **GameEngine**: The collection of server-side modules (`deltaDetector.ts`, `word-finder.ts`, `wordEngine.ts`, `boardScanner.ts`) that validate moves and score words against `GameConfig` and Scrabble-style adjacency rules.
- **ExtractCrossWordsResult** (`lib/game-engine/word-finder.ts`): Result of move validation — `{ isValid: boolean, words: AttributedWord[], error?: string }`.
- **AttributedWord** (`lib/game-engine/deltaDetector.ts`): A scored word extended with `playerId` (owning player) and `opponentFrozenKeys: ReadonlySet<string>` (positions of opponent-frozen tiles within the word, for partial letter scoring).
- **WordScoreBreakdown** (`lib/types/match.ts`): Per-word score breakdown — `{ word, length, lettersPoints, lengthBonus, totalPoints, isDuplicate, tiles, playerId }`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Engine rules configuration can be distinctly updated via a single standard configuration object, without modifying the core matching logic.
- **SC-002**: System 100% accurately blocks any tile placement that results in an invalid adjacent cross-word.
- **SC-003**: System validates fully crossed multi-word placements locally in under 50ms to ensure lag-free playability.
- **SC-004**: System correctly awards cumulative point values for moves that form multiple validated words simultaneously.
