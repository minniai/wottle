# Comprehensive Checklist: Word Engine & Scoring

**Purpose**: Identify gaps, ambiguities, and missing edge cases across the full spec to improve requirement quality before closing this feature
**Created**: 2026-02-21
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

## Requirement Completeness

- [x] CHK001 Are error handling requirements defined for dictionary load failure (file missing, corrupt, empty)? [Gap]
  - **Resolved**: Added FR-001a — system must handle all dictionary load failures gracefully, prevent match creation, and display a message that the game cannot be played. Covers the general case of critical initialization failures.
- [x] CHK002 Are requirements specified for what happens when only one player submits a move before timeout — does the word engine still run on a single-swap board state? [Gap]
  - **Resolved**: Added FR-006b — engine runs on single-swap state; non-submitting player's move treated as void. Added corresponding clarification to the Clarifications section.
- [x] CHK003 Are requirements defined for what board state is used when a player's swap is rejected during conflict resolution — does delta detection run with only one accepted move? [Gap, Spec §FR-006]
  - **Resolved**: FR-006b broadened to cover both timeout and conflict-rejection cases — engine runs on accepted moves only; rejected move treated as void.
- [x] CHK004 Is the behavior specified for when a player disconnects mid-round — does round resolution (including scoring) still execute? [Gap]
  - **Resolved**: Added FR-006c — disconnection does not halt resolution or scoring. Submitted moves included normally; unsubmitted moves treated as void per FR-006b.
- [x] CHK005 Are player color assignments documented as a dependency of frozen tile rendering? FR-017 references "the owning player's color" without defining where colors originate. [Completeness, Spec §FR-017]
  - **Resolved**: FR-017 updated to clarify that frozen tile color derives from the owning player's assigned color (player who scored the freezing word). Color assignment is an external dependency; this spec governs only how colors are applied to tiles.
- [x] CHK006 Are requirements defined for what happens when the board starts with zero valid words (no pre-existing words before any swaps)? [Gap]
  - **Resolved**: No new requirement needed. FR-006 covers this naturally — delta detection with an empty baseline scores all words found after swaps. Clarification added to the Clarifications section.
- [x] CHK007 Is the behavior specified when a word is destroyed by a swap (existed before, no longer exists after)? Does it un-score? Does it affect the other player's word detection? [Gap, Spec §FR-006]
  - **Resolved**: Added FR-013a — destroyed words un-score (points removed from cumulative total) and exclusively-owned tiles unfreeze. Shared tiles with other valid words stay frozen. Invariant: every frozen tile is always part of a valid readable word. In practice unreachable under current rules (all word tiles are frozen), but specified as a formal guarantee.
- [x] CHK008 Are requirements defined for the combo bonus field in persistence — is it stored per-round or computed on-the-fly for display? The data model shows ComboBonus as "not persisted" but round summaries need it. [Completeness, data-model.md §ComboBonus]
  - **Resolved**: FR-012 updated to require combo bonus persisted per round alongside deltas and cumulative totals. Note: data-model.md §ComboBonus ("not persisted") now conflicts with FR-012 and should be updated to add combo bonus columns to the ScoreboardSnapshot schema.
- [x] CHK009 Is there a requirement for dictionary word count validation at load time (e.g., minimum threshold to detect a truncated or corrupt file)? [Gap]
  - **Resolved**: No minimum threshold. All-or-nothing: dictionary loads completely or the load is treated as a critical failure per FR-001a and the game does not continue. Clarification added.
- [x] CHK010 Are requirements specified for the board tile alphabet — what characters can appear on tiles, and is there a guarantee that only valid Icelandic letters appear? [Gap]
  - **Resolved**: Documented as an assumption — tile alphabet is the Icelandic alphabet for this MVP; all tiles are guaranteed valid Icelandic characters. Word engine does not need runtime tile validation.

## Requirement Clarity

- [ ] CHK011 Is "newly formed words" in FR-006 precisely defined? Specifically: if a word existed, was broken by one player's swap, and reformed by the other player's swap, is it "new"? [Ambiguity, Spec §FR-006]
- [ ] CHK012 Is "reading order" for partial freeze (FR-016) explicitly defined as row 0 ascending, then column 0 ascending within each row? The clarification says "row first, then column" but does not specify ascending/descending. [Clarity, Spec §FR-016]
- [ ] CHK013 Is "dual-color pattern" for shared frozen tiles (FR-017) specified with sufficient detail for implementation — gradient, split diagonal, stripes, or other? [Ambiguity, Spec §FR-017]
- [ ] CHK014 Is "at least 3 seconds" highlight duration (FR-020) specified with transition/animation behavior — instant on/fade off, fade in/fade out, or other? [Clarity, Spec §FR-020]
- [ ] CHK015 Is the term "contiguous sequence" in FR-003 defined clearly enough to exclude blank/empty tiles? Are blank tiles possible on the board? [Clarity, Spec §FR-003]
- [ ] CHK016 Is "case-insensitive matching" (FR-001) defined in terms of which Unicode case-folding algorithm is used? Standard `toLowerCase()` vs full Unicode case folding can differ for some characters. [Clarity, Spec §FR-001, FR-002]
- [ ] CHK017 Does FR-009's combo bonus formula clearly state that `n` counts only non-duplicate new words? The spec text says "multiple new words" but the explicit exclusion of duplicates from combo count is only in the Edge Cases and data model, not in FR-009 itself. [Clarity, Spec §FR-009]

## Requirement Consistency

- [ ] CHK018 Do FR-022 (<200ms dictionary load) and SC-007 (<1000ms dictionary load) consistently express the same SLA? Both exist in the spec with a parenthetical note, but having two conflicting numbers in the requirements section creates ambiguity about which is authoritative. [Conflict, Spec §FR-022, §SC-007]
- [ ] CHK019 Does the plan's dictionary implementation (T007: readFileSync) align with research decision R6 (streaming readline)? The spec doesn't prescribe an approach, but the plan and research contradict each other. [Conflict, plan.md §T007, research.md §R6]
- [ ] CHK020 Are the ScanResult type definitions consistent between data-model.md (has `scannedAt` field) and contracts/word-engine.ts (omits `scannedAt`)? [Conflict, data-model.md §ScanResult, contracts §ScanResult]
- [ ] CHK021 Are RoundScoreResult shapes consistent between data-model.md (`newFrozenTiles: FrozenTileMap`) and contracts/word-engine.ts (`newlyFrozenTiles: Coordinate[]`)? Different field names and types for the same concept. [Conflict, data-model.md §RoundScoreResult, contracts §RoundScoreResult]
- [ ] CHK022 Does the DictionaryContract's `@performance` JSDoc (<200ms) align with the relaxed SC-007 target (<1000ms)? [Conflict, contracts §DictionaryContract, Spec §SC-007]
- [ ] CHK023 Are the acceptance scenario examples consistent with the scoring formula? Verify US4 scenario 1 uses the correct formula notation — it shows `(6-2)*5=20` and `(3-2)*5=5` without escaping, while the requirements section uses `\*`. [Consistency, Spec §US4]

## Acceptance Criteria Quality

- [ ] CHK024 Is SC-001 ("100% of valid words detected") testable without enumerating all possible boards? Does the spec define the representative board states that constitute "verified"? [Measurability, Spec §SC-001]
- [ ] CHK025 Is SC-002 measurable as written — "p95 across 1,000 test rounds"? Are these 1,000 rounds defined (random boards, worst-case boards, typical boards)? [Measurability, Spec §SC-002]
- [ ] CHK026 Is SC-005 ("100 test scenarios with zero false accepts") sufficient? Are the 100 scenarios enumerated or described categorically? [Measurability, Spec §SC-005]
- [ ] CHK027 Is SC-006 ("E2E tests confirming identical data on both clients") testable given current Playwright infrastructure? Does the spec reference the dual-session testing pattern from 002? [Measurability, Spec §SC-006]
- [ ] CHK028 Can FR-021 (<50ms for "full board scan, delta detection, and scoring calculation") be objectively measured? Is it clear whether this includes or excludes database operations (duplicate checking, persistence)? [Measurability, Spec §FR-021]

## Scenario Coverage

- [ ] CHK029 Are requirements defined for the case where both players' swaps target the exact same two tiles (same from/to coordinates)? After conflict resolution only one succeeds — is the scoring pipeline aware of this single-move scenario? [Coverage, Gap]
- [ ] CHK030 Are requirements defined for what happens when a round has zero accepted moves (both rejected due to frozen tiles or timeout with no submissions)? [Coverage, Gap]
- [ ] CHK031 Are requirements defined for the transition behavior of in-progress matches when this feature deploys? The edge case section mentions continuing with the new engine, but are migration requirements for existing match data specified? [Coverage, Spec §Edge Cases]
- [ ] CHK032 Are requirements defined for observability of the word engine — structured logging events, metrics to emit, alerting thresholds? The plan mentions logging but the spec has no formal observability FR. [Gap]
- [ ] CHK033 Are recovery requirements defined for a scoring pipeline failure mid-round (e.g., dictionary singleton evicted, database write fails)? Does the round retry, fail open, or fail closed? [Gap, Exception Flow]

## Edge Case Coverage

- [ ] CHK034 Are requirements defined for a word that spans through both a player's own frozen tile AND an opponent's frozen tile in the same sequence? FR-006a says opponent tiles invalidate the candidate, but is this stated clearly enough for a word like A-B-C where B is own-frozen and C is opponent-frozen? [Edge Case, Spec §FR-006a]
- [ ] CHK035 Are requirements defined for the maximum possible score in a single round? With the combo bonus formula for 4+ words being `7 + (n-4)`, are integer overflow concerns addressed for the `smallint` column type in `word_score_entries`? [Edge Case, data-model.md §WordScoreEntry]
- [ ] CHK036 Are requirements defined for simultaneous palindromes — when the same letters read as a valid word in both forward and reverse directions? The edge case section addresses this but does the unique-per-player rule use word text only, or text + position + direction? [Edge Case, Spec §Edge Cases]
- [ ] CHK037 Is the 24-unfrozen-tile minimum behavior defined for the case where a single word's tiles would cross the threshold? Does the partial freeze still score the full word but only freeze some tiles? [Edge Case, Spec §FR-016]
- [ ] CHK038 Are requirements defined for the case where Player A and Player B both form the same word using overlapping tiles in the same round? The edge case says "both players score independently" but is the frozen tile ownership for ALL shared tiles set to "both"? [Edge Case, Spec §Edge Cases]
- [ ] CHK039 Is behavior defined when the 24-unfrozen-tile minimum is already reached (exactly 24 unfrozen) and a new round produces scored words? Are new word tiles simply not frozen while the words still score? [Edge Case, Spec §FR-016]

## Non-Functional Requirements

- [ ] CHK040 Is there a memory budget requirement for the dictionary? Research estimates ~330MB. Is this acceptable for the target deployment environment? [Gap, NFR]
- [ ] CHK041 Are accessibility requirements specified for the frozen tile overlay? Screen readers need to convey tile ownership; 40% opacity colored overlay may not meet WCAG contrast requirements. [Gap, NFR, Spec §FR-017]
- [ ] CHK042 Are requirements specified for concurrent match isolation — does the dictionary singleton handle multiple simultaneous matches safely, and are frozen tile updates atomic per match? [Gap, NFR]
- [ ] CHK043 Is there a graceful degradation requirement if the dictionary fails to load? Should the game refuse to start, fall back to a reduced wordlist, or allow matches without scoring? [Gap, NFR]
- [ ] CHK044 Are requirements defined for the round summary broadcast payload size? With per-letter point breakdowns for multiple words, could the Realtime payload exceed channel limits? [Gap, NFR, Spec §FR-019]

## Dependencies & Assumptions

- [ ] CHK045 Is the assumption that "no schema migrations are needed for core scoring" (Assumptions §3) consistent with the data model requiring two schema changes (frozen_tiles column, is_duplicate column)? [Conflict, Spec §Assumptions, data-model.md §Migrations]
- [ ] CHK046 Is the assumption that the wordlist is "NFC-normalized" validated? If the source file contains non-NFC text, the dictionary load behavior differs from the spec's assumption. [Assumption, Spec §FR-002]
- [ ] CHK047 Is the dependency on the existing `word_score_entries` table schema documented with the required columns? The data model assumes certain columns exist — is this verified? [Dependency, data-model.md §WordScoreEntry]
- [ ] CHK048 Is there a documented dependency on `LETTER_SCORING_VALUES_IS` and its exact location (`docs/wordlist/letter_scoring_values_is.ts`)? The broken import path was the root cause of 3 failing tests — is this path stable? [Dependency, Spec §FR-007]

## Ambiguities & Conflicts

- [ ] CHK049 Does the spec define whether the same word at the same position but in a different direction (e.g., "ABA" read left-to-right vs right-to-left from same start) counts as one word or two for unique tracking purposes? [Ambiguity, Spec §FR-010]
- [ ] CHK050 Is it clear whether FR-010's unique tracking uses word text only, or word text + position + direction? The data model uses `text:direction:start` as identity key, but FR-010 just says "which words each player has scored." [Ambiguity, Spec §FR-010, data-model.md §BoardWord]
- [ ] CHK051 Does the spec clearly define which player is "Player A" vs "Player B" in the context of frozen tile ownership? Is it based on match seating, submission order, or player ID? [Ambiguity, Spec §FR-015]
- [ ] CHK052 Is it specified whether the word engine runs when a player auto-passes (no valid swaps)? If the board doesn't change, the delta detector should find zero new words, but is this explicitly required? [Ambiguity, Spec §Edge Cases]

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
- Link to relevant resources or documentation
- Items are numbered sequentially for easy reference
