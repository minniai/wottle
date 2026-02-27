# Data Model: Game Rules Configuration

## Entities

### `GameConfig`

A code-level configuration object/interface defining the rules for a match.

**Fields**:

- `maxRounds` (number): The maximum number of rounds before the match ends.
- `timePerRoundMs` (number): The time limit for a single round in milliseconds.
- `minimumWordLength` (number): The minimum allowed length for a submitted word.
- `maxWordLength` (number, optional): The maximum allowed length for a submitted word. If omitted, it is constrained by the board dimensions.
- `boardSize` (number): The dimensions of the square game board (e.g., 15 for a 15x15 board).
- `allowedDirections` (Array<'horizontal' | 'vertical'>): The explicitly permitted directions for reading a primary word. (For MVP: `['horizontal', 'vertical']`).

**State Transitions**:

- Static per match. In the future, this could be passed into the `Match` creation payload. For MVP, this is a globally imported constant or a static default parameter in the game engine.

### `MoveEvaluation`

The result of validating a proposed tile placement against the `GameConfig` and Scrabble rules.

**Fields**:

- `isValid` (boolean): True if the move is legal (orthogonal, valid words, adjacent).
- `words` (Array<{ word: string, startIndex: number, direction: 'horizontal' | 'vertical' }>): The complete list of distinct words formed by the move, including the primary word and all orthogonal cross-words.
- `score` (number): The computed score for the move, maintaining the existing scoring logic but applying it specifically to the `words` array.
- `error` (string, optional): The reason for rejection if `isValid` is false (e.g., "Invalid word 'TZ'").

## Validation Rules (Engine Logic)

1. **Orthogonal Constraint**: A move must be either perfectly horizontal or perfectly vertical. No diagonal placements allowed.
2. **Adjacency Constraint**: If the board has existing tiles, the new placement must touch at least one existing tile (orthogonally).
3. **Cross-Word Validation**:
   - Every newly placed tile must be checked for adjacent tiles in the perpendicular direction.
   - If adjacent tiles exist, the entire contiguous sequence of tiles in that perpendicular direction must form a valid dictionary word.
   - If any generated cross-word is invalid, the entire move is rejected.
4. **Scoring Constraint**:
   - Diagonal words are never scored or validated.
   - The total score is the sum of the scores of all valid words formed (primary + cross-words), using the pre-existing scoring values per letter.
