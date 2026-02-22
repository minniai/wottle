# Feature Specification: Word Engine & Scoring

**Feature Branch**: `003-word-engine-scoring`
**Created**: 2026-02-14
**Status**: Draft
**Input**: Implement the core word-finding engine, PRD-compliant scoring formula, unique word tracking, and frozen tile mechanics that transform Wottle from a tile-swapping prototype into a playable competitive word game.

## User Scenarios & Testing _(mandatory)_

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

### User Story 3 - All Discovered Words Score (Priority: P1)

Every word newly found on the board after a round resolves scores points, including the same word text found at a different board position. Word identity is determined by text + board position, not text alone. If the same word text appears at two different positions on the board, both instances are independent words and both score.

**Why this priority**: Scoring all discovered words regardless of prior occurrences rewards spatial play and board awareness. Finding the same word at a new position is a valid strategic achievement.

**Independent Test**: Form a word in round 1, then form the same word text at a different board position in round 3. Verify both occurrences score full points.

**Acceptance Scenarios**:

1. **Given** Player A scored "SKIP" at position (0,0)→(3,0) in round 2, **When** Player A forms "SKIP" again at position (5,5)→(8,5) in round 5, **Then** the round summary shows "SKIP" with full points for the new instance.
2. **Given** Player A scored "SKIP" in round 2, **When** Player B forms "SKIP" at any position in round 4, **Then** Player B receives full points.
3. **Given** Player A forms two new words in a round, both at new positions, **When** the round resolves, **Then** both words score normally and both count toward the multi-word combo bonus.

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
  - A palindrome covering the same set of tiles in both directions counts as a single word and scores once. Word identity for deduplication within a single round is determined by the canonical tile set (sorted coordinates), not by direction. If the same palindrome text appears at a completely different board location (different tiles), it is a distinct word and scores independently per FR-010.
- What happens when a swap creates a very long word (8+ letters)?
  - Scored normally with the standard formula. Length bonus scales linearly: (length-2)*5.
- What happens when a player's only available swap involves frozen tiles?
  - The swap is rejected. If no valid swaps exist (all adjacent unfrozen tiles exhausted), the player auto-passes that round with 0 points. The match continues normally through all 10 rounds.
- What happens when both players form the same word at the same position in the same round?
  - Both players score the word independently. The tiles freeze and show dual-color ownership.
- What happens during the transition from the placeholder scoring to the real scoring engine?
  - All existing matches in progress continue with the new scoring engine from the next round. Previously completed rounds retain their (zero) scores. No data migration is required for this feature shipment.
- How are Icelandic special characters (ð, þ, æ) handled?
  - Treated as distinct letters with their own point values. Dictionary lookups are case-insensitive and Unicode NFC-normalized. "Ð" and "D" are different letters.

## Clarifications

### Session 2026-02-14

- Q: The spec states ~18,000 nominative singular forms, but the actual wordlist has ~2.76M inflected entries. Which set does the engine use? → A: Use the full ~2.76M inflected word list. Icelandic inflections are distinct valid words.
- Q: FR-006 says "before and after the swap" but each round has two player swaps. What is the baseline for delta detection? → A: Compare the final board (after both swaps applied) against the pre-round board (before either swap). Both players' words measured against the same starting state.
- Q: When the 24-unfrozen-tile minimum prevents full word freezing (FR-016), which tiles are prioritized? → A: Freeze tiles left-to-right in reading order (row first, then column). Deterministic and easy for players to reason about.
- Q: When a player has no valid (non-frozen) swaps available, does the player pass or does the match end early? → A: Player auto-passes (scores 0 for that round), match continues normally through all 10 rounds.
- Q: When only one player submits a move before timeout, does the word engine still run? → A: Yes. The non-submitting player is treated as having made a void move (a tile swapped with itself), leaving the board unchanged for their turn. The engine runs on the resulting single-swap board state and attributes any new words solely to the player who moved.
- Q: When a player's swap is rejected during conflict resolution (e.g. both players target the same tile and only one wins), does delta detection still run? → A: Yes. Delta detection runs on whatever accepted moves were applied. The rejected player's move is treated the same as a void — the board reflects only the accepted swap(s).
- Q: When both players target the exact same two tiles (same from/to coordinates), which player wins and what happens to scoring? → A: The player who submitted first (by server-received timestamp, per the existing FCFS conflict resolution rule) wins the swap. Their move is applied; the other player's move is rejected and treated as a void per FR-006b. Only the winning player can score new words from that swap. The losing player scores 0 for that round.
- Q: What happens when a round has zero accepted moves (both moves rejected or no submissions at all)? → A: No points are awarded to either player. The round summary is still displayed to both players indicating that no words were scored and no points were earned that round. The match advances to the next round normally.
- Q: If a player disconnects mid-round, does round resolution (including scoring) still execute? → A: Yes. Disconnection does not halt the round. Resolution and scoring run to completion for all submitted moves. FR-006b applies — if the disconnected player had not yet submitted, their move is treated as a void.
- Q: FR-017 references "the owning player's color" — where are player colors defined? → A: Colors are a player-level attribute assigned elsewhere in the system. "Owning player" is the player whose scored word caused a tile to freeze. The frozen tile inherits that player's assigned color. This spec does not define the colors themselves; it only requires that the overlay uses them.
- Q: What happens if the board has zero valid words before any swaps? → A: The game proceeds normally. FR-006 delta detection finds all words present after swaps since the pre-round baseline is empty. Any words formed by player swaps score as normal.
- Q: What happens if a previously scored word is destroyed by a swap? → A: The word un-scores — its points are removed from the player's cumulative total — and all tiles that belonged exclusively to that word become unfrozen and available for swapping again. At all times, every frozen (colored) tile on the board must be part of at least one valid, readable word. In practice this situation cannot arise under the current rules because all tiles of a scored word are frozen and therefore cannot be swapped; this requirement exists as a formal invariant guarantee.
- Q: Is the combo bonus persisted or computed on-the-fly for display? → A: Persisted. The combo bonus for each player is stored as part of the round record so that scoring history is fully reproducible from stored data without recomputation.
- Q: Should the system validate the dictionary word count at load time (e.g. reject a truncated file)? → A: No minimum word count threshold. The dictionary loads completely or not at all. Any load failure — including a truncated or partially read file — is a critical error per FR-001a and the game does not continue.
- Q: What characters can appear on board tiles — is there a guarantee that only valid Icelandic letters appear? → A: Yes. The tile alphabet is the Icelandic alphabet. All board tiles are guaranteed to contain only valid Icelandic characters. This is a property of the game language (Icelandic for this MVP), not something the word engine needs to validate at runtime.
- Q: The assumption about own-frozen-tile word formation impacts the scanner significantly. Should it be a formal FR? → A: Yes, promote to formal FR. Scanner MUST allow words through own frozen tiles and MUST exclude opponent's frozen tiles.
- Q: When frozen tile ownership refers to "Player A" vs "Player B", what is that distinction based on? → A: Ownership is determined by submission order within the round (FCFS). The player whose accepted move caused the word to form owns the resulting frozen tiles. "Player A" and "Player B" in the FrozenTileMap context refer to the two match participants by their persistent player IDs, not by round submission order.
- Q: Does the word engine run when a player auto-passes (no valid swaps available)? → A: The engine SHOULD short-circuit and skip the full pipeline when it can determine ahead of time that no scoring change is possible — for example, when both players have void moves (board is unchanged from board_before). If board_after is identical to board_before, delta detection is guaranteed to return zero new words and the pipeline MUST skip the scan, freeze, and persist steps. This is a mandatory optimization to avoid unnecessary computation.

## Requirements _(mandatory)_

### Functional Requirements

#### Dictionary & Validation

- **FR-001**: System MUST load the Icelandic word dictionary into memory at application startup and make it available for word lookups with Unicode case-insensitive matching appropriate for the Icelandic alphabet (e.g. "ÞJÓNN" and "þjónn" match; "Þ" and "þ" match). Case folding MUST be language-aware, not ASCII-only.
- **FR-002**: System MUST validate words using Unicode NFC normalization, treating Icelandic characters (ð, þ, æ, á, é, í, ó, ú, ý, ö) as distinct letters separate from their ASCII counterparts.
- **FR-003**: System MUST recognize valid words as contiguous sequences of 3 or more letters in a single straight-line direction on the board. A sequence is contiguous only if every position in the sequence contains a letter tile; blank tiles break contiguity and a word candidate MUST NOT span across or include a blank tile.

- **FR-001a**: System MUST handle dictionary load failures (file missing, file corrupt, or empty file) gracefully by preventing match creation and displaying a clear message to the user that the game cannot be played. This applies to all critical initialization errors that would make the game non-functional.

#### Board Scanning

- **FR-004**: System MUST scan the board in all 8 directions (horizontal L→R and R→L, vertical T→D and D→T, and all 4 diagonals) to find valid words.
- **FR-005**: System MUST NOT recognize words that wrap around board edges.
- **FR-006**: System MUST detect only **newly formed words** by comparing the final board state (after both players' swaps are applied) against the pre-round board state (before either swap). Pre-existing words that were already present before the round do not score.
- **FR-006a**: When scanning for a player's words, the system MUST include that player's own frozen tiles as valid letters in word candidates, but MUST exclude tiles frozen by the opponent. A word candidate containing any opponent-frozen tile is not valid for that player and does not score — even if the sequence also passes through the player's own frozen tiles.
- **FR-006b**: The word engine MUST run against whatever accepted moves were applied in the round, regardless of how many. When a player's move is absent (timeout) or rejected (conflict resolution), it is treated as a void — the board is unchanged for that player's turn. Only players whose moves were accepted can score words that round.
- **FR-006c**: Player disconnection MUST NOT halt round resolution or scoring. If a disconnected player had already submitted their move, it is included normally. If they had not, FR-006b applies (void move).
- **FR-006d**: When a round resolves with zero accepted moves (all moves rejected or no submissions received), the system MUST award no points to either player, display the round summary to both players indicating zero words scored and zero points earned, and advance the match to the next round normally.

- **FR-006e**: The word engine MUST short-circuit and skip all pipeline stages (scan, delta detection, scoring, freeze, persistence) when the final board state is identical to the pre-round board state (i.e. no accepted moves changed any tiles). This condition arises when all moves are void and guarantees zero new words; running the full pipeline in this case is unnecessary and prohibited.

#### Scoring

- **FR-007**: System MUST calculate the base word score as the sum of individual letter point values for all letters in the word, using the Icelandic letter scoring table.
- **FR-008**: System MUST apply a length bonus of (word_length - 2) * 5 points to every scored word.
- **FR-009**: System MUST apply a multi-word combo bonus when a player scores multiple new words in a single round: 1 word = +0, 2 words = +2, 3 words = +5, 4+ words = +7 + (n-4). `n` counts all newly discovered words that round; there is no exclusion for previously seen word texts.
- **FR-010**: System MUST award points for every newly discovered word regardless of whether the same word text has been scored before. Word identity is defined by text + canonical tile set (sorted tile coordinates). The same word text at a different set of tiles is a distinct word and scores independently. A palindrome that reads in two directions across the same tiles counts as one word and scores once.
- **FR-011**: System MUST persist each scored word with its letter points, bonus points, total points, tile coordinates, and player attribution.
- **FR-012**: System MUST compute and store per-round score deltas, combo bonuses, and cumulative totals for both players after each round resolves. The combo bonus for each player MUST be persisted as part of the round record so that scoring history is fully reproducible from stored data.

#### Frozen Tiles

- **FR-013**: System MUST freeze all tiles belonging to newly scored words immediately after round resolution. Frozen tiles cannot be swapped by either player.
- **FR-013a**: System MUST maintain the invariant that every frozen (colored) tile on the board is part of at least one valid, readable word at all times. If a scored word is ever destroyed, the system MUST un-score it (remove its points from the player's cumulative total) and unfreeze any tiles that belonged exclusively to that word, making them available for swapping again. Tiles shared with another still-valid scored word retain their frozen state.
- **FR-014**: System MUST reject any swap attempt that involves a frozen tile, with a clear error message indicating the tile is frozen.
- **FR-015**: System MUST track frozen tile ownership (which player's word caused the freeze). Ownership is attributed to the player whose accepted move caused the word to form, identified by their persistent player ID. When both players score words that share one or more tiles in the same round, each shared tile MUST be assigned "both" ownership regardless of submission order. Both players score their words independently and in full; shared ownership does not reduce either player's score.
- **FR-016**: System MUST enforce a minimum of 24 unfrozen tiles on the board at all times. If freezing all tiles of a scored word would violate this minimum, the word MUST still score its full points — only the tile freezing is partial. The system freezes tiles in ascending reading order (row 0→9 first, then column 0→9 within each row) up to the limit and notifies both players. If the minimum is already exactly reached (exactly 24 unfrozen tiles remain), no new tiles are frozen for that round's scored words, but those words still score normally.
- **FR-017**: System MUST display frozen tiles with a colored overlay at 40% opacity derived from the owning player's assigned color — the player whose scored word caused the tile to freeze. Shared tiles (owned by both players) MUST display a split-diagonal pattern, with each player's color occupying one triangle of the tile. Player color assignment is an external dependency; this requirement only governs how those colors are applied to frozen tiles.

#### Integration

- **FR-018**: System MUST integrate word finding and scoring into the existing round resolution flow, replacing the current placeholder that returns empty results.
- **FR-019**: System MUST include scored words, point breakdowns, and tile highlights in the round summary broadcast to both players via the existing Realtime channel. The total serialized payload MUST remain under 100KB per broadcast message (well within Supabase Realtime's 1MB channel limit). Given the 10×10 board constraint and typical word counts per round, this limit is not expected to be reached in normal play.
- **FR-020**: System MUST highlight scored tiles on the board for at least 3 seconds after the round summary is displayed. The highlight MUST appear instantly and fade out at the end of the duration.

#### Resilience

- **FR-027**: System MUST update the `frozen_tiles` JSONB column atomically using a conditional database update (e.g. checking the previous value or using a transaction) to prevent concurrent round resolutions for the same match from overwriting each other's frozen tile changes.

- **FR-026**: If the word engine pipeline fails mid-round (e.g. a database write fails or an unexpected error occurs), the system MUST automatically retry the full pipeline up to 3 times before giving up. If all 3 retries fail, the system MUST cancel the match, notify both players with a clear error message, and log the failure with full context for diagnosis.

#### Observability

- **FR-024**: System MUST emit structured JSON log entries at the completion of each word engine pipeline run, including: `matchId`, `roundNumber`, `wordsFound` (total candidates), `wordsScored` (new words this round), `tilesFrozen` (count of newly frozen tiles), `comboBonusPlayerA`, `comboBonusPlayerB`, `pipelineDurationMs` (total), `computeDurationMs` (scan + delta + scoring only), and `wasPartialFreeze` (boolean).
- **FR-025**: System MUST record `performance.mark()` instrumentation at the start and end of each major pipeline stage: dictionary load, board scan, delta detection, scoring, freeze computation, and DB persistence. Stage durations MUST be logged as part of the FR-024 structured log entry.

#### Performance

- **FR-021**: System MUST complete the full word engine pipeline — including board scan, delta detection, scoring calculation, duplicate checking, and persistence — in under 200ms server-side, verified by E2E tests. The pure computation phase (scan + delta + scoring, excluding DB operations) MUST complete in under 50ms.
- **FR-022**: System MUST load the dictionary into memory in under 1000ms at startup.
- **FR-023**: System MUST NOT increase the overall move round-trip time beyond the existing 200ms p95 SLA.

### Key Entities

- **Dictionary**: The in-memory word lookup structure built from the full Icelandic inflected word list (~2.76M entries including all grammatical forms). Supports case-insensitive, NFC-normalized lookups. Loaded once at startup, shared across all matches.
- **BoardWord**: A valid word found on the board, with its text, direction, starting coordinate, length, and tile coordinates. Represents a candidate before scoring rules are applied.
- **WordScoreEntry**: A scored word attributed to a player for a specific round. Contains letter points, bonus points, total points, tile coordinates, and whether it was a duplicate (previously scored by this player).
- **FrozenTileMap**: A per-match record of which tiles are frozen and by which player(s). Updated after each round resolution. Used for swap validation and visual rendering.
- **ScoreboardSnapshot**: A per-round materialized record of cumulative scores and deltas for both players. Used for fast retrieval of scoring history.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The scanner correctly detects valid words in all 8 directions (L→R, R→L, T→D, D→T, and all 4 diagonals), verified by automated tests with one known board state per direction. Exhaustive enumeration of all possible boards is not required.
- **SC-002**: Word validation and scoring complete within 50ms server-side for a full 10x10 board scan, measured at p95 across 1,000 randomly generated test boards.
- **SC-003**: Scoring formula matches the PRD exactly: letter values + (length-2)*5 length bonus + multi-word combo, verified by unit tests covering each bonus tier.
- **SC-004**: The same word text found at a different board position scores independently and receives full points, verified by integration tests forming the same word text at two distinct positions across separate rounds. The same word text at the same position does not score a second time (it is pre-existing per FR-006 and not detected as new).
- **SC-005**: Frozen tiles are never swappable after being claimed, verified by attempting swaps on frozen tiles across 100 randomly sampled board states with frozen words, with zero false accepts.
- **SC-006**: Round summaries display complete word breakdowns (letters, bonuses, combos, deltas, totals) to both players, verified by E2E tests confirming that each player's summary is correct for that player's perspective.
- **SC-007**: The dictionary loads in under 1000ms at startup for the full 2.76M-entry wordlist, measured across 10 cold-start benchmarks (relaxed from 200ms target; see FR-022 note).

### Assumptions

- The existing Icelandic word list at `docs/wordlist/word_list_is.txt` (~2.76M inflected forms) is the authoritative dictionary source. No new words will be added for this milestone.
- The wordlist file at `docs/wordlist/word_list_is.txt` is assumed to be pre-normalized: all entries are already Unicode NFC-normalized and lowercased. The dictionary loader does not need to re-normalize entries at load time beyond what the file already provides.
- The letter scoring values at `docs/wordlist/letter_scoring_values_is.ts` are final and will not change during this milestone.
- The existing `word_score_entries` table is assumed to contain the following columns: `id` (uuid), `match_id` (uuid), `round_id` (uuid), `player_id` (uuid), `word` (text), `length` (integer), `letters_points` (integer), `bonus_points` (integer), `total_points` (integer), `tiles` (jsonb). The `is_duplicate` column will be added via migration (see above). Implementation MUST verify these columns exist before writing scoring data.
- Schema migrations are required for this feature: (1) add `frozen_tiles jsonb NOT NULL DEFAULT '{}'` to the `matches` table, and (2) add `is_duplicate boolean NOT NULL DEFAULT false` to the `word_score_entries` table. See data-model.md §Migrations for the full SQL.
- A migration will be needed to add frozen tile tracking to the rounds or matches table (frozen tile map per round).
- The existing round engine, realtime broadcast, and round summary UI components will be extended, not replaced.
- "Player's own frozen tiles may be part of a new word" (PRD 1.2) means: a player CAN form a new word that passes through their own frozen tiles, but CANNOT form words using the opponent's frozen tiles. (Formalized as FR-006a.)
- All board tiles contain valid Icelandic letters. The tile alphabet is the Icelandic alphabet for this MVP. The word engine does not need to validate tile characters at runtime.
- The dictionary singleton is read-only after initial load. Concurrent `lookupWord()` calls from multiple simultaneous matches are safe without locking in the Node.js single-threaded event loop model.
- The target deployment environment MUST have a minimum of 1GB available memory. The in-memory dictionary singleton requires approximately 330MB; the remaining headroom is required for the application runtime, Supabase connection pool, and concurrent request handling.
