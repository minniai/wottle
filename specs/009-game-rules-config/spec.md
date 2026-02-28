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
2. **Given** the game configuration only enables `left-to-right` and `top-to-bottom` directions, **When** a player submits a valid word `bottom-to-top`, **Then** the engine rejects the submission.

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

### Edge Cases

- What happens when a player plays a single letter that is valid in both intersecting axes?
- How does the system handle "words" of length 1 created incidentally by placement? (Typically Scrabble requires words to be at least 2 letters, except for the first tile/board setup constraints)
- What happens when the configuration sets invalid or contradictory limits (e.g., word length exceeds board size)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a central code-based configuration module to define game parameters: maximum word length, number of rounds, time per round, and allowed reading directions.
- **FR-002**: System MUST restrict all tile placements to orthogonal directions (horizontal and vertical). Diagonal placements are strictly prohibited.
- **FR-003**: System MUST evaluate all continuous tile sequences formed by a new placement (the primary word AND any crossing words formed with adjacent tiles).
- **FR-004**: System MUST reject a move if ANY of the resulting adjacent sequences on the grid do not form a valid dictionary word.
- **FR-005**: System MUST treat letters adjacent in standard horizontal and vertical directions as continuous sequences. Adjacency validation strictly checks only orthogonal (horizontal/vertical) row and column intersections like traditional Scrabble. Words can touch diagonally without forming valid words.
- **FR-006**: System MUST maintain the current scoring mechanism exactly as it is currently implemented, with the exception that diagonal words are no longer scored, and for a letter to score, it must form a valid word in all intersecting orthogonal directions (horizontal and vertical).

### Key Entities

- **GameConfig**: Defines `maxWordLength`, `rounds`, `timePerRoundMs`, and `allowedDirections`.
- **GameEngine**: The core module validating moves against the `GameConfig` and Scrabble-style adjacency rules.
- **MoveEvaluation**: The resultant object indicating board validity, the array of distinct words formed, and the total computed score.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Engine rules configuration can be distinctly updated via a single standard configuration object, without modifying the core matching logic.
- **SC-002**: System 100% accurately blocks any tile placement that results in an invalid adjacent cross-word.
- **SC-003**: System validates fully crossed multi-word placements locally in under 50ms to ensure lag-free playability.
- **SC-004**: System correctly awards cumulative point values for moves that form multiple validated words simultaneously.
