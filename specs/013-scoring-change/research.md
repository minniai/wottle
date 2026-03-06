# Research: Scoring Rules Overhaul

**Feature**: 013-scoring-change | **Date**: 2026-03-06 | **Phase**: 0

## R1: Targeted Orthogonal Scanning from Swap Coordinates

**Decision**: Replace the full-board `scanBoard()` approach with a new `scanFromCoordinates()` function that performs exhaustive directional scanning from specific swap coordinates only.

**Rationale**: The current `boardScanner.ts` scans every line on the board in 8 directions (including diagonals), extracting all subsequences of length ≥3. The new spec requires:
- Only 4 orthogonal directions (up, down, left, right) — no diagonals (FR-001, FR-002)
- Scanning originates only from swap coordinates (FR-003)
- Minimum word length of 2 (FR-004, currently 3)
- Exhaustive enumeration of ALL valid words including overlapping subwords (FR-020, FR-021)

**Approach**: Create a new function `scanFromSwapCoordinates(board, swapCoords, dictionary)` that:
1. For each swap coordinate, trace in 4 orthogonal directions
2. Extract the full line through the coordinate
3. Enumerate all subsequences of length ≥2 that include the swap coordinate
4. Check each against the dictionary
5. Return all valid words as `BoardWord[]` candidates

This replaces the three-scan delta-detection pattern (baseline → intermediate → final) with a single targeted scan per player.

**Alternatives considered**:
- **Modify existing `scanBoard()`**: Too intertwined with the 8-direction + full-board logic; a clean new function is simpler and more testable.
- **Filter `scanBoard()` output**: Would still scan the entire board unnecessarily and then discard most results. Wasteful and harder to verify correctness for the "must contain swap coordinate" constraint.

**Performance note**: Targeted scanning from 2 coordinates × 4 directions = 8 line scans (vs. 38 line scans in the current approach). This is a significant performance improvement, well within the <50ms SLA.

---

## R2: Cross-Validation as Global Board Invariant with Combination Optimization

**Decision**: Implement cross-validation as a post-discovery filter that selects the highest-scoring subset of candidate words where all words satisfy the global board invariant simultaneously.

**Rationale**: FR-013 requires that every scored tile on the board is part of a valid dictionary word in all orthogonal directions where it is adjacent to other scored tiles. FR-014/FR-014a requires selecting the combination of candidate words that maximizes the player's total score while satisfying cross-validation.

**Approach**:
1. **Candidate enumeration**: Exhaustive scan produces all valid words through swap coordinates
2. **Independent validation**: Each candidate word is checked for cross-word validity against existing frozen tiles (invariant from prior rounds)
3. **Combination selection**: When multiple candidates remain, check all subsets for mutual consistency (each candidate's tiles must not create invalid cross-words with tiles from other candidates in the set)
4. **Optimization**: Select the valid combination with the highest total score

**Complexity analysis**: The number of candidate words per swap is bounded by the board geometry. With a 10×10 board and 2 swap coordinates × 4 directions, the maximum number of candidates is approximately 4 × 2 × 9 = 72 (in practice much fewer — typically 0–6 words). For such small candidate sets, brute-force subset enumeration is feasible within the <50ms SLA. Worst case: 2^6 = 64 subsets, each requiring O(k) cross-validation checks where k is the number of tiles. This is negligible.

**Alternatives considered**:
- **Greedy selection** (pick highest-scoring word first, then add compatible words): Simpler but may miss globally optimal combinations. Rejected because the candidate set is small enough for brute-force.
- **Per-word independent validation** (current approach): Does not satisfy the global invariant requirement — two individually valid words may create invalid cross-words with each other.

---

## R3: Time-Based Scoring Precedence with Intermediate Freezing

**Decision**: Restructure `processRoundScoring()` to process players sequentially by submission timestamp. The first submitter's words are scored and tiles frozen before the second submitter's words are evaluated.

**Rationale**: FR-005/FR-006/FR-007 require that scoring precedence is determined by move submission timestamp, not by player slot. The first player's tiles freeze before the second player's word discovery runs.

**Approach**:
1. Sort accepted moves by submission timestamp (requires adding `submittedAt` to `AcceptedMove` interface)
2. Process first submitter: scan from their swap coords → cross-validate → score → freeze tiles
3. Update frozen tile map with first submitter's newly frozen tiles
4. Process second submitter: scan from their swap coords using updated frozen tiles → cross-validate → score → freeze tiles
5. Merge results into final `RoundScoreResult`

This replaces the current three-scan approach (`detectNewWords()`) which applies both players' swaps first and then attributes words by board diffing.

**Key change**: The second player's word discovery sees the first player's frozen tiles as opponent-owned. Words can still cross these tiles but get zero letter points for them (FR-010, FR-011).

**Alternatives considered**:
- **Keep three-scan and post-process**: Would still discover words that should have been blocked by the first player's freezing. Fundamentally incompatible with the precedence requirement.
- **Parallel scoring with conflict resolution**: Would require complex rollback logic. Sequential processing is simpler and correct by construction.

---

## R4: Exclusive Tile Ownership — Remove "both"

**Decision**: Remove the `"both"` variant from `FrozenTileOwner` type. First player to freeze a tile owns it permanently.

**Rationale**: FR-008 requires exactly one owner per tile. FR-009 prevents ownership changes. The current system allows `"both"` ownership when both players claim the same tile in the same round.

**Approach**:
1. Change `FrozenTileOwner` type from `"player_a" | "player_b" | "both"` to `"player_a" | "player_b"`
2. Update `resolveOwnership()` to return the existing owner when a second player claims an already-frozen tile (first-owner-wins)
3. With sequential processing (R3), this is naturally enforced: the first submitter's tiles are frozen before the second submitter's scoring runs
4. Update `isFrozenByOpponent()` — remove the `"both"` special case
5. Update `getOpponentFrozenKeys()` — tiles owned by the other player are always opponent-frozen (no "both" exception)

**Database migration**: The `matches.frozen_tiles` JSONB column currently stores `{ owner: "player_a" | "player_b" | "both" }`. A migration must:
- Update existing `"both"` entries to the first claimant (or split arbitrarily for in-progress matches, though this is a playtest environment)
- Add a CHECK constraint or application-level validation preventing `"both"`

**Alternatives considered**:
- **Keep "both" in DB, filter at application level**: Creates inconsistency between DB and application model. Rejected for clarity.

---

## R5: Combo Bonus Removal

**Decision**: Remove all combo bonus calculation and display.

**Rationale**: Per user clarification, the combo bonus is entirely removed. Scoring is letter points + length bonus only (FR-017).

**Approach**:
1. Delete `calculateComboBonus()` from `scorer.ts` (or deprecate/remove exports)
2. Remove combo bonus calculation from `wordEngine.ts` (`processRoundScoring`)
3. Remove combo bonus from `aggregateRoundSummary()` in `roundSummary.ts`
4. Remove `comboBonus` field from `RoundScoreResult` type
5. Remove `comboBonus` field from `RoundSummary` type
6. Update client components:
   - `RoundSummaryPanel` — remove combo bonus display
   - `ScoreDeltaPopup` / `deriveScoreDelta.ts` — remove `combo` field
   - `deriveRoundHistory.ts` — remove combo derivation
   - `FinalSummary` — remove combo from per-round breakdowns

**Impact**: ~6 source files + ~15 test files need updates to remove combo bonus references.

---

## R6: Duplicate Detection — Coordinate-Based Instead of Text-Based

**Decision**: Replace text-based duplicate detection with coordinate-based uniqueness. The same word text can score multiple times at different coordinates.

**Rationale**: FR-015/FR-016 require coordinate-based uniqueness. A word is only a "duplicate" if it occupies the exact same coordinate set as a previously scored instance.

**Approach**:
1. Remove `getPriorScoredWordsByPlayer()` text-based query from `publishRoundSummary.ts`
2. Remove `priorScoredWordsByPlayer` parameter from `processRoundScoring()`
3. Remove text-based `isDuplicate` logic from `scoreAttributedWords()`
4. Coordinate-based deduplication is naturally enforced by the frozen tile system: tiles that are already frozen cannot form new words for the same player (they're already frozen in that player's color). So the existing frozen-tile check already prevents coordinate duplicates.
5. The `isDuplicate` field can be removed from `WordScoreBreakdown` and `WordScore` types, or kept as always-false for backward compatibility during transition.

**Key insight**: With exclusive tile ownership and frozen tiles, coordinate-based deduplication is automatic. Once tiles are frozen by a player, they can't be re-claimed. A word at the same coordinates would require those tiles to be unfrozen (impossible). So no explicit duplicate tracking is needed.

**Alternatives considered**:
- **Store coordinate sets and compare**: Unnecessary given frozen tile enforcement.
- **Keep isDuplicate field as always-false**: Simpler migration path but adds dead code. Prefer clean removal.

---

## R7: Cross-Opponent Tile Scoring

**Decision**: Preserve and simplify existing opponent-frozen-tile scoring. Words spanning opponent tiles score zero letter points for those positions but full length bonus.

**Rationale**: FR-010/FR-011/FR-012 codify the existing behavior, but with exclusive ownership ("both" removed), the logic simplifies.

**Approach**: The existing `opponentFrozenKeys` mechanism in `scoreAttributedWords()` already handles this correctly:
- Letters at opponent-frozen positions contribute `""` to the scoring string
- Length bonus uses `word.length` (full word length)
- With "both" removed, any tile frozen by the other player is always opponent-frozen

No significant changes needed — just ensure the "both" case is removed from `getOpponentFrozenKeys()`.

---

## R8: Board Scanner Direction Filter

**Decision**: Reduce `Direction` type for scoring purposes to `"right" | "left" | "down" | "up"` only. Remove diagonal directions from the scoring pipeline.

**Rationale**: FR-001/FR-002 require orthogonal-only scanning. The existing `Direction` type includes 8 directions (`"down-right"`, `"down-left"`, `"up-right"`, `"up-left"`).

**Approach**:
- The new `scanFromSwapCoordinates()` function only uses orthogonal vectors
- The `Direction` type remains unchanged (other code may use it) but the scoring pipeline filters to orthogonal only
- The existing `deltaDetector.ts` filter (lines 449–455) already excludes diagonals — the new implementation inherits this by construction

---

## R9: Minimum Word Length — 2 Letters

**Decision**: Change `minimumWordLength` from 3 to 2 in `DEFAULT_GAME_CONFIG`.

**Rationale**: FR-004 requires 2-letter minimum. A 2-letter word gets length bonus of (2-2)×5 = 0, so only letter points apply.

**Approach**:
1. Update `DEFAULT_GAME_CONFIG.minimumWordLength` from 3 to 2
2. Update `scanBoard()` / new `scanFromSwapCoordinates()` to enumerate subsequences of length ≥2
3. Update `hasCrossWordViolation()` cross-word minimum check (line 111) — already uses `minimumWordLength`
4. Update `BoardWord.length` JSDoc comment from "≥3" to "≥2"

**Impact**: More words will be found per scan. Performance testing needed to verify <50ms SLA still holds.

---

## R10: Client-Side Impact Assessment

**Components requiring changes**:

| Component | Change | Reason |
|-----------|--------|--------|
| `RoundSummaryPanel` | Remove combo bonus display | FR-017 |
| `ScoreDeltaPopup` | Remove combo line from breakdown | FR-017 |
| `deriveScoreDelta.ts` | Remove `combo` field derivation | FR-017 |
| `deriveRoundHistory.ts` | Remove combo from history entries | FR-017 |
| `FinalSummary` | Remove `isDuplicate` badges, combo totals | FR-015/017 |
| `GameChrome` | No change (receives ScoreDelta) | — |
| `MatchClient` | No change (receives RoundSummary) | — |

**Types requiring changes**:

| Type | Change |
|------|--------|
| `FrozenTileOwner` | Remove `"both"` |
| `RoundScoreResult` | Remove `comboBonus` field |
| `RoundSummary` | Remove `comboBonus` field |
| `WordScoreBreakdown` | Remove `isDuplicate` field |
| `WordScore` | Remove `isDuplicate` field |
| `BoardWord.length` | Update JSDoc from "≥3" to "≥2" |
| `GameConfig.minimumWordLength` | Change default from 3 to 2 |

---

## R11: Database Migration Requirements

**Schema changes**:
1. `matches.frozen_tiles` — existing `"both"` values must be migrated to single-owner values
2. `word_score_entries.is_duplicate` — column can be dropped (or left for backward compatibility and always set to false)

**No new tables or columns** are needed. The existing schema supports the new scoring model.

**Migration strategy**:
- Reversible migration script
- For `frozen_tiles`: UPDATE all entries where owner = 'both' → assign to first claimant (deterministic rule: choose `player_a`)
- For `is_duplicate`: ALTER TABLE to drop column OR leave in place with default false

---

## R12: Test Impact Assessment

**Tests requiring significant rewrites** (~50% of scoring pipeline tests):
- `boardScanner.test.ts` — min length 3→2, diagonal tests become irrelevant for scoring
- `deltaDetector.test.ts` — entire three-scan logic replaced; tests need complete rewrite for new scanning approach
- `wordEngine.test.ts` — combo bonus removal, duplicate detection removal, sequential processing
- `frozenTiles.test.ts` — "both" ownership tests must change to first-owner-wins
- `scorer.test.ts` — combo bonus tests removed, 2-letter word scoring tests added
- `roundSummary.test.ts` — combo bonus removal
- `roundScoring.test.ts` (integration) — full pipeline changes

**Tests requiring minor updates** (~30%):
- `roundEngine.test.ts` — mock return types change (no comboBonus)
- Client component tests — combo bonus display removed

**New tests needed**:
- Exhaustive word enumeration from swap coordinates
- Cross-validation combination optimization
- Time-based precedence (first submitter freezes before second evaluates)
- 2-letter word scoring
- Exclusive ownership (no "both")
- Coordinate-based duplicate allowance
