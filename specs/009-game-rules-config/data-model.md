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

### `ExtractCrossWordsResult` (move validation result)

The result of validating all orthogonal words formed by a swap, as returned by
`extractValidCrossWords` in `lib/game-engine/word-finder.ts`.

**Fields**:

- `isValid` (boolean): True if the move is legal (valid orthogonal words, no invalid adjacencies).
- `words` (Array<`AttributedWord`>): The complete list of distinct valid words formed by the swap,
  including all horizontal and vertical sequences. Each word carries its `start` coordinate,
  `direction`, `length`, `tiles`, and `playerId`.
- `error` (string, optional): The reason for rejection if `isValid` is false (e.g., `"Invalid
  horizontal word: tz"`).

### `AttributedWord` (scored word with ownership info)

Defined in `lib/game-engine/deltaDetector.ts`. Extends `BoardWord` with player attribution and
opponent-frozen tile tracking (FR-007).

**Fields (additions to `BoardWord`)**:

- `playerId` (string): The ID of the player who scored this word.
- `opponentFrozenKeys` (ReadonlySet\<string\>): Set of `"x,y"` keys for tiles in this word frozen
  by the opponent. Used by `scoreAttributedWords` to exclude those tiles from `lettersPoints`.
  Tiles owned by "both" are NOT included — they are freely scoreable.

### `WordScoreBreakdown` (round scoring result)

Defined in `lib/types/match.ts`. The per-word breakdown produced by `scoreAttributedWords` in
`lib/game-engine/wordEngine.ts`.

**Fields**:

- `word` (string): The word text.
- `length` (number): Full word length (used for length bonus regardless of tile ownership).
- `lettersPoints` (number): Sum of letter values for tiles contributed by this player only
  (opponent-frozen tiles excluded per FR-007).
- `lengthBonus` (number): `(length - 2) * 5` — always uses full word length.
- `totalPoints` (number): `lettersPoints + lengthBonus` (0 if `isDuplicate`).
- `isDuplicate` (boolean): True if this player already scored this word in a prior round.
- `tiles` (Coordinate[]): All tile positions in the word.
- `playerId` (string): Owning player ID.

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
