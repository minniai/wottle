# Research: Game Rules Configuration

**Date**: 2026-02-27
**Context**: "Add config options to the game such as: the word length, the number of rounds, the time per round, left-to-right, right-to-left, top-to-bottom, bottom-to-top, etc."

## Decision: Configuration Implementation

Based on the constitution principle "I. Server-Authoritative Game Logic", the configuration MUST be managed server-side and propagated to the client.

- **Storage**: For MVP, configuration will be hardcoded in a central shared constants file (e.g., `lib/constants/game-config.ts`), as the prompt stated "For the MVP the config options can be set in code, and are not required in a UI".
- **Structure**: A `GameConfig` object/interface containing:
  - `maxRounds`: number
  - `timePerRoundMs`: number
  - `minimumWordLength`: number
  - `maxWordLength`: number (optional, constrained by board size)
  - `boardSize`: number
  - `allowedDirections`: `Array<'horizontal' | 'vertical'>` (Note: MVP explicitly removed diagonal directions, and only permits left-to-right/top-to-bottom reading technically via standard Scrabble rules, but we can structure this to allow future flags).

## Decision: Scrabble Adjacency & Validation

Based on user clarifications, the adjacency validation strictly checks only orthogonal (horizontal/vertical) row and column intersections like traditional Scrabble. Words can touch diagonally without forming valid words.

- **Implementation**: The move validation logic (e.g., in `lib/game-engine/board.ts` or `validator.ts`) must be overhauled.
- **Current vs New**: The current sliding window or single-line validation must be replaced by a recursive/cross-checking algorithm that:
  1. Identifies the primary placed word (must be purely horizontal or purely vertical).
  2. For _each_ newly placed tile, checks adjacent orthogonal squares.
  3. If adjacent tiles exist, scans the full contiguous orthogonal sequence to form the cross-word.
  4. Validates _every_ generated word against the dictionary.
  5. Rejects the move if _any_ sequence is invalid.

## Decision: Scoring Mechanism

Based on the user's explicit directive: "Don't change the scoring in any way from what is implemented now, other than diagonals are not used and for a letter to score, it must be a part of a valid word in all 4 orthogonal directions."

- **Implementation**: We must review the existing scorer (e.g., `lib/game-engine/scorer.ts`).
- **Required Changes**:
  - Remove all logic pertaining to scoring diagonal words.
  - Ensure that a letter's score is only counted if it successfully forms a valid word in the intersecting orthogonal directions (if it touches other tiles).
  - The actual point values per letter/word length remain identical to the existing implementation.

## Alternatives Considered

- _Database-backed configuration_: Rejected for the MVP phase as the spec explicitly says "can be set in code". This introduces unnecessary complexity at this stage.
- _Strict "all 4 directions" validity_: The user clarified this meant standard Scrabble adjacency—so diagonal touching is allowed and ignored. We do NOT need to implement complex diagonal adjacency checks, which simplifies the engine overhaul.
