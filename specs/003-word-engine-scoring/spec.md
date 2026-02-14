# Feature Specification: Word Engine & Scoring

**Feature Branch**: `003-word-engine-scoring`
**Created**: 2026-02-14
**Status**: Draft
**Input**: Implement the core word-finding engine, PRD-compliant scoring formula, unique word tracking, and frozen tile mechanics that transform Wottle from a tile-swapping prototype into a playable competitive word game.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Words Are Found and Scored After a Swap (Priority: P1)

When both players submit their swaps for a round and the round resolves, the system scans the resulting board state to find all newly formed valid Icelandic words. Each new word earns points based on its letter values, length, and combo bonuses. Players see their scored words, point breakdowns, and updated totals in the round summary.

**Why this priority**: Without word detection and scoring, the entire game is non-functional. This is the core mechanic that gives meaning to every swap — it is the game itself.

**Independent Test**: Submit a swap that forms a known Icelandic word on the board. Verify the round summary shows the word with correct letter points, length bonus, and updated score totals.

**Acceptance Scenarios**:

1. **Given** a board where swapping tiles at (2,3) and (5,3) forms the word "HESTUR" horizontally, **When** the round resolves after both players submit, **Then** the round summary for that player lists "HESTUR" with correct letter values summed, a length bonus of (6-2)*5 = 20, and the player's cumulative score increases by the total.
2. **Given** a swap that forms two new words simultaneously (one horizontal, one vertical), **When** the round resolves, **Then** both words appear in the round summary with individual breakdowns plus a multi-word combo bonus of +2.
3. **Given** a swap that does not create any new valid words, **When** the round resolves, **Then** the round summary shows zero new words and zero points for that player's turn.
4. **Given** a swap that creates a 3-letter word "BÚR", **When** the round resolves, **Then** the word scores with letter points (B=4 + Ú=7 + R=1 = 12) plus length bonus (3-2)*5 = 5, totaling 17 points.

---

### User Story 2 - Frozen Tiles Create Strategic Territory (Priority: P1)

After a round resolves and new words are found, all tiles belonging to newly scored words freeze immediately. Frozen tiles cannot be swapped by either player for the rest of the match. The board visually marks frozen tiles with a colored overlay indicating which player claimed them. If both players' words share overlapping letters, those shared tiles display a dual-color pattern.

**Why this priority**: Tile freezing is the core strategic dimension of Wottle. It creates territory control, constrains future moves, and forces players to think ahead. Without freezing, the board never changes strategically.

**Independent Test**: Submit a swap that forms a valid word. After the round resolves, attempt to swap a tile that was part of the scored word. Verify the swap is rejected and the tile displays a frozen overlay.

**Acceptance Scenarios**:

1. **Given** a round resolves and Player A scores the word "LAND" at coordinates (0,0)→(3,0), **When** the board updates, **Then** tiles at (0,0), (1,0), (2,0), (3,0) are frozen and display Player A's color overlay at 40% opacity.
2. **Given** a tile at (2,0) is frozen from Player A's word, **When** Player B attempts to swap tile (2,0) in a later round, **Then** the swap is rejected with an error indicating the tile is frozen.
3. **Given** Player A scores "LAND" using tile (2,0) and Player B scores "LAUT" also using tile (2,0) in the same round, **When** the board updates, **Then** tile (2,0) displays a dual-color pattern combining both players' colors.
4. **Given** 77 tiles are currently frozen (leaving 23 unfrozen), **When** a swap would cause a word that freezes 2 more tiles (leaving 21 < 24), **Then** the word still scores but only enough tiles freeze to maintain the 24-unfrozen-tile minimum, and both players are notified the board is nearly full.

---

### User Story 3 - Unique Word Tracking Prevents Repeat Scoring (Priority: P1)

Each distinct word can only score once per player per match. If a player forms the same word again in a later round (even at different board positions), it is recognized but does not award points a second time. The round summary indicates the word was already claimed.

**Why this priority**: Without unique tracking, players could repeatedly form the same word for infinite points, breaking the scoring system and removing strategic depth.

**Independent Test**: Form a word in round 1, then form the same word again in round 3. Verify the second occurrence shows zero points with a "previously scored" indicator.

**Acceptance Scenarios**:

1. **Given** Player A scored "SKIP" in round 2, **When** Player A forms "SKIP" again in round 5 (different position), **Then** the round summary shows "SKIP" with a "previously scored" label and 0 points for that word.
2. **Given** Player A scored "SKIP" in round 2, **When** Player B forms "SKIP" in round 4, **Then** Player B receives full points because unique tracking is per-player.
3. **Given** Player A forms two new words in a round, one previously scored and one new, **When** the round resolves, **Then** the new word scores normally, the duplicate scores 0, and the multi-word combo bonus counts only the newly scoring words.

---

### User Story 4 - Round Summary Shows Word Breakdown (Priority: P2)

After each round resolves, both players see a detailed round summary showing every word found, the letter-by-letter point values, length bonuses, multi-word combo bonuses, per-player round delta, and updated cumulative totals. Scored tiles are highlighted on the board for at least 3 seconds.

**Why this priority**: Transparency in scoring builds player trust and understanding. Players need to see exactly how points are calculated to develop strategy.

**Independent Test**: Complete a round where one player scores two words. Verify the summary displays both words with per-letter values, length bonuses, combo bonus, round delta, and cumulative totals.

**Acceptance Scenarios**:

1. **Given** Player A's swap creates "HESTUR" (6 letters) and "HÚS" (3 letters), **When** the round summary displays, **Then** it shows: HESTUR with letter sum + length bonus (6-2)*5=20, HÚS with letter sum + length bonus (3-2)*5=5, and a multi-word combo bonus of +2.
2. **Given** Player A scores 25 points this round and had 40 previously, **When** the round summary displays, **Then** it shows delta "+25" and cumulative total "65" for Player A.
3. **Given** a round resolves with scored words, **When** the board updates, **Then** the tiles of each scored word are highlighted for at least 3 seconds before the highlight fades.

---

### User Story 5 - 8-Directional Word Discovery (Priority: P2)

The system finds valid words in all 8 directions on the board: left-to-right, right-to-left, top-to-bottom, bottom-to-top, and all four diagonals. Words must be contiguous sequences of 3 or more letters in a straight line with no gaps and no board-edge wrapping.

**Why this priority**: Supporting all 8 directions maximizes strategic options and aligns with the PRD's word formation rules. Players expect diagonal words to count.

**Independent Test**: Place a known word diagonally on a test board. Run the word scanner and verify it detects the diagonal word alongside horizontal and vertical ones.

**Acceptance Scenarios**:

1. **Given** the letters S-K-I-P appear at (0,0), (1,1), (2,2), (3,3) on the board, **When** the scanner runs, **Then** "SKIP" is found as a valid diagonal word.
2. **Given** the letters R-Ó-S appear at (5,2), (5,1), (5,0) (bottom-to-top), **When** the scanner runs, **Then** "RÓS" is found as a valid vertical word.
3. **Given** a 4-letter sequence with a gap at position 2 (e.g., H at (0,0), E at (1,0), blank tile at (2,0), T at (3,0)), **When** the scanner runs, **Then** no word is found spanning that gap.
4. **Given** the board edge, **When** a potential word would wrap from column 9 to column 0, **Then** that sequence is not considered a valid word.

### Edge Cases

- What happens when a swap forms the same word in two different directions simultaneously (e.g., a palindrome)?
  - Both instances are detected but only one contributes to scoring per the unique-per-player rule. The second instance in the same round shows as already scored.
- What happens when a swap creates a very long word (8+ letters)?
  - Scored normally with the standard formula. Length bonus scales linearly: (length-2)*5.
- What happens when a player's only available swap involves frozen tiles?
  - The swap is rejected. If no valid swaps exist (all adjacent unfrozen tiles exhausted), the player auto-passes that round with 0 points. The match continues normally through all 10 rounds.
- What happens when both players form the same word at the same position in the same round?
  - Both players score the word independently. The tiles freeze and show dual-color ownership.
- What happens during the transition from the placeholder scoring to the real scoring engine?
  - All existing matches in progress continue with the new scoring engine from the next round. Previously completed rounds retain their (zero) scores.
- How are Icelandic special characters (ð, þ, æ) handled?
  - Treated as distinct letters with their own point values. Dictionary lookups are case-insensitive and Unicode NFC-normalized. "Ð" and "D" are different letters.

## Clarifications

### Session 2026-02-14

- Q: The spec states ~18,000 nominative singular forms, but the actual wordlist has ~2.76M inflected entries. Which set does the engine use? → A: Use the full ~2.76M inflected word list. Icelandic inflections are distinct valid words.
- Q: FR-006 says "before and after the swap" but each round has two player swaps. What is the baseline for delta detection? → A: Compare the final board (after both swaps applied) against the pre-round board (before either swap). Both players' words measured against the same starting state.
- Q: When the 24-unfrozen-tile minimum prevents full word freezing (FR-016), which tiles are prioritized? → A: Freeze tiles left-to-right in reading order (row first, then column). Deterministic and easy for players to reason about.
- Q: When a player has no valid (non-frozen) swaps available, does the player pass or does the match end early? → A: Player auto-passes (scores 0 for that round), match continues normally through all 10 rounds.
- Q: The assumption about own-frozen-tile word formation impacts the scanner significantly. Should it be a formal FR? → A: Yes, promote to formal FR. Scanner MUST allow words through own frozen tiles and MUST exclude opponent's frozen tiles.

## Requirements *(mandatory)*

### Functional Requirements

**Dictionary & Validation**

- **FR-001**: System MUST load the Icelandic word dictionary into memory at application startup and make it available for word lookups with case-insensitive matching.
- **FR-002**: System MUST validate words using Unicode NFC normalization, treating Icelandic characters (ð, þ, æ, á, é, í, ó, ú, ý, ö) as distinct letters separate from their ASCII counterparts.
- **FR-003**: System MUST recognize valid words as contiguous sequences of 3 or more letters in a single straight-line direction on the board.

**Board Scanning**

- **FR-004**: System MUST scan the board in all 8 directions (horizontal L→R and R→L, vertical T→D and D→T, and all 4 diagonals) to find valid words.
- **FR-005**: System MUST NOT recognize words that wrap around board edges.
- **FR-006**: System MUST detect only **newly formed words** by comparing the final board state (after both players' swaps are applied) against the pre-round board state (before either swap). Pre-existing words that were already present before the round do not score.
- **FR-006a**: When scanning for a player's words, the system MUST include that player's own frozen tiles as valid letters in word candidates, but MUST exclude tiles frozen by the opponent. A word candidate containing any opponent-frozen tile is not valid for that player.

**Scoring**

- **FR-007**: System MUST calculate the base word score as the sum of individual letter point values for all letters in the word, using the Icelandic letter scoring table.
- **FR-008**: System MUST apply a length bonus of (word_length - 2) * 5 points to every scored word.
- **FR-009**: System MUST apply a multi-word combo bonus when a player scores multiple new words in a single round: 1 word = +0, 2 words = +2, 3 words = +5, 4+ words = +7 + (n-4).
- **FR-010**: System MUST track which words each player has scored across the entire match and award zero points for any word a player has already scored in a previous round.
- **FR-011**: System MUST persist each scored word with its letter points, bonus points, total points, tile coordinates, and player attribution.
- **FR-012**: System MUST compute and store per-round score deltas and cumulative totals for both players after each round resolves.

**Frozen Tiles**

- **FR-013**: System MUST freeze all tiles belonging to newly scored words immediately after round resolution. Frozen tiles cannot be swapped by either player.
- **FR-014**: System MUST reject any swap attempt that involves a frozen tile, with a clear error message indicating the tile is frozen.
- **FR-015**: System MUST track frozen tile ownership (which player's word caused the freeze) and support dual ownership when both players' words share a tile.
- **FR-016**: System MUST enforce a minimum of 24 unfrozen tiles on the board at all times. If freezing all tiles of a scored word would violate this minimum, the system freezes tiles in reading order (row first, then column) up to the limit and notifies both players.
- **FR-017**: System MUST display frozen tiles with a colored overlay at 40% opacity matching the owning player's color. Shared tiles MUST display a dual-color pattern.

**Integration**

- **FR-018**: System MUST integrate word finding and scoring into the existing round resolution flow, replacing the current placeholder that returns empty results.
- **FR-019**: System MUST include scored words, point breakdowns, and tile highlights in the round summary broadcast to both players via the existing Realtime channel.
- **FR-020**: System MUST highlight scored tiles on the board for at least 3 seconds after the round summary is displayed.

**Performance**

- **FR-021**: System MUST complete word validation (full board scan, delta detection, and scoring calculation) in under 50ms server-side.
- **FR-022**: System MUST load the dictionary into memory in under 200ms at startup.
- **FR-023**: System MUST NOT increase the overall move round-trip time beyond the existing 200ms p95 SLA.

### Key Entities

- **Dictionary**: The in-memory word lookup structure built from the full Icelandic inflected word list (~2.76M entries including all grammatical forms). Supports case-insensitive, NFC-normalized lookups. Loaded once at startup, shared across all matches.
- **BoardWord**: A valid word found on the board, with its text, direction, starting coordinate, length, and tile coordinates. Represents a candidate before scoring rules are applied.
- **WordScoreEntry**: A scored word attributed to a player for a specific round. Contains letter points, bonus points, total points, tile coordinates, and whether it was a duplicate (previously scored by this player).
- **FrozenTileMap**: A per-match record of which tiles are frozen and by which player(s). Updated after each round resolution. Used for swap validation and visual rendering.
- **ScoreboardSnapshot**: A per-round materialized record of cumulative scores and deltas for both players. Used for fast retrieval of scoring history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid Icelandic words (3+ letters, contiguous, straight-line) on the board are detected by the scanner across all 8 directions, verified by automated tests with known board states.
- **SC-002**: Word validation and scoring complete within 50ms server-side for a full 10x10 board scan, measured at p95 across 1,000 test rounds.
- **SC-003**: Scoring formula matches the PRD exactly: letter values + (length-2)*5 length bonus + multi-word combo, verified by unit tests covering each bonus tier.
- **SC-004**: Duplicate words by the same player in the same match award zero points 100% of the time, verified by integration tests spanning multiple rounds.
- **SC-005**: Frozen tiles are never swappable after being claimed, verified by attempting swaps on frozen tiles across 100 test scenarios with zero false accepts.
- **SC-006**: Round summaries display complete word breakdowns (letters, bonuses, combos, deltas, totals) to both players, verified by E2E tests confirming identical data on both clients.
- **SC-007**: The dictionary loads in under 200ms at startup, measured across 10 cold-start benchmarks.

### Assumptions

- The existing Icelandic word list at `docs/wordlist/word_list_is.txt` (~2.76M inflected forms) is the authoritative dictionary source. No new words will be added for this milestone.
- The letter scoring values at `docs/wordlist/letter_scoring_values_is.ts` are final and will not change during this milestone.
- The existing database schema (word_score_entries, scoreboard_snapshots tables) is sufficient; no schema migrations are needed for core scoring.
- A migration will be needed to add frozen tile tracking to the rounds or matches table (frozen tile map per round).
- The existing round engine, realtime broadcast, and round summary UI components will be extended, not replaced.
- "Player's own frozen tiles may be part of a new word" (PRD 1.2) means: a player CAN form a new word that passes through their own frozen tiles, but CANNOT form words using the opponent's frozen tiles. (Formalized as FR-006a.)
