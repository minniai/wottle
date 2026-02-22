# Specification Analysis Report: `003-word-engine-scoring`

**Artifacts analyzed**: `spec.md`, `plan.md`, `tasks.md`, `constitution.md`, `data-model.md`, `contracts/word-engine.ts`
**Codebase cross-referenced**: `lib/game-engine/`, `app/actions/match/publishRoundSummary.ts`, `lib/types/`, `lib/scoring/roundSummary.ts`
**Analysis date**: 2026-02-22
**Tool**: `/speckit.analyze`

---

## Findings Table

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| F-001 | Coverage Gap | **CRITICAL** | `spec.md` FR-001a, FR-006c/d/e, FR-013a, FR-026, FR-027 | 8 FRs added during checklist review have zero task coverage. FR-001a (dict load failure blocks match), FR-006d (zero-move round), FR-006e (short-circuit when board unchanged), FR-013a (un-score destroyed words), FR-026 (3-retry + match cancel), FR-027 (atomic frozen_tiles update) — none appear in `tasks.md`. | Add tasks T043–T048 covering each uncovered FR. |
| F-002 | Inconsistency | **CRITICAL** | `spec.md` FR-010, US3; `tasks.md` Phase 5 header, T011, T015, T030–T033; `lib/game-engine/wordEngine.ts` | CHK017 split spec and implementation. Spec says "all new positions always score" (no duplicate-zeroing). Tasks and implementation still implement duplicate-zeroing (same word text = 0 pts). Fundamentally different game behaviors. | Option A (recommended): Revert spec.md FR-010, US3, FR-009 to restore duplicate-zeroing — lower cost, implementation already works this way. Option B: Update tasks.md Phase 5, T011/T015/T030–T033, data-model.md, and `wordEngine.ts` implementation to remove duplicate-zeroing. |
| F-003 | Inconsistency | HIGH | `spec.md` FR-012; `data-model.md` §ComboBonus ("Not Persisted"); §ScoreboardSnapshot | FR-012 requires combo bonus persisted per round, but data-model.md explicitly marks it "Not Persisted" and ScoreboardSnapshot has no combo_bonus columns. CHK008 noted this conflict but the update was never made. | Update `data-model.md` §ComboBonus to "Persisted" and add `player_a_combo_bonus` / `player_b_combo_bonus` columns. Extend T004 or add a migration task. |
| F-004 | Inconsistency | HIGH | `spec.md` §Assumptions (1GB); `checklists/comprehensive.md` CHK040 (5GB) | Memory requirement is 1GB in spec but 5GB in checklist. | Decide on one authoritative figure (1GB is defensible given 330MB dictionary) and update the other artifact. |
| F-005 | Underspecification | HIGH | `spec.md` FR-016; `tasks.md` (all phases) | FR-016 requires player notification when partial freeze occurs, but `wasPartialFreeze` from `FreezeResult` is logged but never broadcast or shown in round summary UI. | Add a task to include `wasPartialFreeze` in round summary broadcast payload and surface it in `RoundSummaryPanel`. |
| F-006 | Underspecification | HIGH | `spec.md` FR-026; `tasks.md` (all phases) | FR-026 requires match cancellation + player notification after 3 failed retries — zero tasks cover this. No retry wrapper, no cancellation flow, no error broadcast. | Add a task implementing: retry wrapper around scoring pipeline, match cancellation after 3 failures, Realtime error broadcast to both players. |
| F-007 | Inconsistency | HIGH | `contracts/word-engine.ts` `BoardScannerContract` | `BoardScannerContract` omits `frozenTiles` from its signature (correctly, per R2 post-scan filtering), but this deliberate design choice is undocumented. A future implementor could misread it as an oversight. | Add a JSDoc comment to `BoardScannerContract` clarifying that FR-006a filtering is intentionally done post-scan in the delta detector. |
| F-008 | Underspecification | HIGH | `tasks.md` T020, T029 | T020 and T029 are marked `[x]` complete but their descriptions say "deferred to integration testing phase." This is either stale wording or false completion. | Audit `tests/integration/roundScoring.test.ts`. If tests exist and pass, remove the "deferred" note. If genuinely deferred, uncheck them. |
| F-009 | Underspecification | MEDIUM | `tasks.md` Phase 5 header | Phase 5 header says "Each word scores at most once per player per match" — the old pre-CHK017 semantics. If CHK017 stands, this title is wrong. | Update Phase 5 header to match whatever F-002 resolution decides. |
| F-010 | Underspecification | MEDIUM | `spec.md` FR-020; `tasks.md` T036 | T036 says "CSS transforms for animation" but FR-020 requires the highlight to "appear instantly." Could be misread as using a transition for both appearance and disappearance. | Clarify T036: opacity jumps to 1 instantly (no transition-in), then fades out via CSS/Framer Motion after 3 seconds. Add a test for both behaviors. |
| F-011 | Duplication | MEDIUM | `tasks.md` T038, T039 | T038 and T039 are near-duplicate — both target `wordEngine.ts`, both result in one log entry per pipeline run. The implementation already handles both in a single `logPlaytestInfo` call. | Merge T038 and T039 into one task covering all FR-024 and FR-025 log fields. |
| F-012 | Underspecification | MEDIUM | `spec.md` FR-019; `tasks.md` T037 | FR-019 requires broadcast payload <100KB, but no task adds a size check. T037 covers payload content but not the size constraint. | Add a test case to T037 verifying serialized payload stays under 100KB for a worst-case round. |
| F-013 | Underspecification | MEDIUM | `spec.md` FR-021; `contracts/word-engine.ts` | FR-021 defines two SLAs (<200ms full pipeline; <50ms pure compute), but `BoardScannerContract`'s `@performance` annotation still says `<10ms` without tying to either tier. | Update the annotation and ensure T021 validates both tiers separately. |
| F-014 | Terminology Drift | MEDIUM | `contracts/word-engine.ts` `lengthBonus`; `data-model.md` `bonusPoints`; `lib/types/match.ts` | Three different names for the same concept: `lengthBonus` (contracts), `bonusPoints` (types/DB), "length bonus" (spec). The mapping works but creates cognitive overhead. | Standardize on `lengthBonus` throughout, or document the intentional split with JSDoc. |
| F-015 | Underspecification | MEDIUM | `spec.md` FR-027; `publishRoundSummary.ts` lines 207–217 | FR-027 requires atomic conditional update for `frozen_tiles`, but implementation uses a plain `UPDATE matches SET frozen_tiles = ...` with no concurrency check. | Replace with a conditional update (`WHERE frozen_tiles = $previousMap`) or wrap in a Supabase transaction. Update T025. |
| F-016 | Inconsistency | MEDIUM | `data-model.md` §ComboBonus; `spec.md` FR-009 (post-CHK017) | §ComboBonus still says "Only non-duplicate words count" but FR-009 (after CHK017) counts ALL newly discovered words. Direct contradiction in the data model. | Align with whatever F-002 resolution decides. |
| F-017 | Underspecification | LOW | `tasks.md` T004; `data-model.md` | T004 creates the frozen_tiles migration but doesn't include combo bonus columns needed per F-003. | Extend T004 or add a task covering `player_a_combo_bonus`/`player_b_combo_bonus` in `scoreboard_snapshots`. |
| F-018 | Underspecification | LOW | `spec.md` §Assumptions | Spec says "MUST verify columns exist before writing scoring data" but no task implements this check. Stated with MUST language but has no task. | Add a note to T018/T019, or demote to a developer note since TypeScript compile-time safety already covers this. |
| F-019 | Underspecification | LOW | `tasks.md` T042 | T042 is a Polish phase task but is also a plan.md prerequisite. Migration already exists; the task doesn't verify FR-027 atomic updates or F-003 combo bonus schema. | Update T042 description to include validation of all new migrations including any combo bonus columns. |

---

## Coverage Summary

| Requirement | Task Coverage | Status |
|-------------|---------------|--------|
| FR-001 (dict load, NFC) | T005, T007, T008 | Covered |
| **FR-001a** (load failure → block match) | **None** | **UNCOVERED** |
| FR-002 (NFC normalization) | T005, T007 | Covered |
| FR-003 (3+ contiguous letters) | T009, T013 | Covered |
| FR-004 (8 directions) | T009, T013 | Covered |
| FR-005 (no edge-wrapping) | T009, T013 | Covered |
| FR-006 (delta detection) | T010, T014 | Covered |
| FR-006a (exclude opponent frozen tiles) | T010, T014, T022, T023 | Covered |
| FR-006b (absent moves = void) | T010, T014 | Covered |
| FR-006c (disconnection resilience) | None (implicit) | No explicit test |
| **FR-006d** (zero accepted moves → no points + advance) | **None** | **UNCOVERED** |
| **FR-006e** (short-circuit when board unchanged) | **None** | **UNCOVERED** |
| FR-007 (base score = letter values) | T011, T015 | Covered |
| FR-008 (length bonus formula) | T011, T015 | Covered |
| FR-009 (combo bonus formula) | T011, T015 | Covered |
| FR-010 (word identity + scoring rule) | T011, T015, T030–T033 | Covered (contradicted by F-002) |
| FR-011 (persist each scored word) | T018 | Covered |
| FR-012 (persist combo bonuses) | T018, T019 | Partial — combo in ScoreboardSnapshot missing |
| FR-013 (freeze tiles after resolution) | T022–T025 | Covered |
| **FR-013a** (un-score/unfreeze destroyed words) | **None** | **UNCOVERED** |
| FR-014 (reject swap on frozen tile) | T026, T029 | Covered |
| FR-015 (ownership tracking) | T022, T023 | Covered |
| FR-016 (24-tile minimum + notification) | T022, T023 | Partial — player notification uncovered |
| FR-017 (40% opacity overlay) | T028 | Covered |
| FR-018 (wire into round resolution) | T019 | Covered |
| FR-019 (broadcast payload <100KB) | T037 | Partial — size check missing |
| FR-020 (instant highlight / fade) | T036 | Covered (clarity concern) |
| FR-021 (<200ms / <50ms SLAs) | T021, T041 | Covered |
| FR-022 (dict load <1000ms) | T006, T041 | Covered |
| FR-023 (move RTT <200ms p95) | T041 | Covered |
| FR-024 (structured JSON log) | T038, T039 | Covered (near-duplicate tasks) |
| FR-025 (performance.mark()) | T038 | Covered |
| **FR-026** (3-retry + cancel + notify) | **None** | **UNCOVERED** |
| **FR-027** (atomic conditional DB update) | **None** | **UNCOVERED** |

---

## Constitution Alignment Issues

- **Principle I (Server-Authoritative) — MEDIUM**: `publishRoundSummary.ts` uses a plain `UPDATE` for `frozen_tiles` with no concurrency guard. Under concurrent round resolution, last-write-wins can corrupt frozen tile state. FR-027 directly addresses this but has no task coverage.
- **Principle VII (TDD — NON-NEGOTIABLE) — HIGH**: T020 and T029 are marked `[x]` complete but described as "deferred." If integration tests for the scoring pipeline and frozen tile swap rejection don't actually exist as passing tests, production code was shipped without required test coverage — a direct violation.
- **Principle V (Observability) — LOW**: FR-026's match cancellation failure path has no `performance.mark()` or structured log defined.

---

## Unmapped Tasks (No FR)

| Task | Note |
|------|------|
| T001 | Bug fix (broken import path) — maintenance, acceptable as prerequisite |
| T040 | Full test suite regression gate — operational, acceptable |
| T042 | Quickstart migration validation — operational, acceptable |

All three unmapped tasks are correctly placed maintenance/operational tasks.

---

## Metrics

| Metric | Value |
|--------|-------|
| Total formal functional requirements | 27 (including sub-FRs) |
| Total tasks | 42 |
| Fully covered requirements | 19 |
| Partially covered requirements | 4 |
| Zero-coverage requirements | 8 |
| Coverage % | ~70% |
| Critical issues | 2 |
| High severity | 6 |
| Medium severity | 8 |
| Low severity | 3 |
| Ambiguities | 3 |
| Duplications | 1 |
| Inconsistencies | 5 |

---

## Next Actions

**Resolve CRITICALs before any further implementation:**

1. **Resolve F-002 (CHK017 contradiction)** — The implementation already does duplicate-zeroing; reverting the spec (Option A) is the lower-cost fix.
2. **Add tasks for 8 uncovered FRs (F-001)** — Add T043–T048 to `tasks.md`.
3. **Audit T020/T029 completion (F-008)** — Read `tests/integration/roundScoring.test.ts` to verify tests actually exist.

**Short-term (before marking feature complete):**

4. Fix data-model.md §ComboBonus persistence gap (F-003)
5. Resolve memory budget conflict 1GB vs 5GB (F-004)
6. Add FR-016 partial-freeze player notification task (F-005)
7. Implement FR-027 atomic conditional DB update in `publishRoundSummary.ts` (F-015)
8. Merge T038/T039 into one task (F-011)

**Polish (before production sign-off):**

9. Add FR-019 payload size assertion to T037 (F-012)
10. Clarify T036 instant-on vs fade-out behavior (F-010)
11. Standardize `lengthBonus` vs `bonusPoints` naming (F-014)
12. Document `BoardScannerContract` post-scan filtering design decision (F-007)

---

## Remediation Plan

### F-001: Add Missing Tasks for 8 Uncovered FRs

Add a new **Phase 8: Resilience & Edge Cases** section to `tasks.md` after Phase 7:

```markdown
## Phase 8: Resilience & Edge Cases

**Purpose**: Cover FRs added during checklist review that have no task coverage.

### Tests

- [ ] T043 [P] Write failing tests for dictionary load failure handling in tests/unit/dictionary.test.ts (extend) —
  cover: loadDictionary throws on missing file, throws on empty file, throws on corrupt/partial file; and in
  tests/integration/matchCreation.test.ts: verify that when dictionary fails to load, match creation returns
  a clear error and does not create a match record (FR-001a)

- [ ] T044 [P] Write failing tests for zero-accepted-moves round in tests/unit/wordEngine.test.ts (extend) —
  cover: processRoundScoring with empty acceptedMoves returns RoundScoreResult with zero deltas, zero frozen tiles,
  and roundSummary indicating no words scored (FR-006d)

- [ ] T045 [P] Write failing tests for board-unchanged short-circuit in tests/unit/wordEngine.test.ts (extend) —
  cover: when boardAfter is identical to boardBefore, processRoundScoring returns immediately without calling
  scanBoard, detectNewWords, scoreWords, or freezeTiles; verify via spy/mock (FR-006e)

- [ ] T046 [P] Write failing tests for scoring pipeline retry in tests/unit/wordEngine.test.ts (extend) —
  cover: pipeline retries up to 3 times on DB write failure, succeeds on second attempt, fails all 3 retries and
  calls cancelMatch with correct matchId and error message (FR-026)

- [ ] T047 [P] Write failing tests for atomic frozen tile update in tests/integration/roundScoring.test.ts (extend) —
  cover: concurrent round resolution for same match does not overwrite frozen tile state; conditional UPDATE
  rejects when frozen_tiles has changed since last read (FR-027)

### Implementation

- [ ] T048 Handle dictionary load failure in lib/game-engine/dictionary.ts — throw a typed
  DictionaryLoadError on missing/empty/corrupt file; in lib/match/roundEngine.ts, catch DictionaryLoadError
  at match creation or first round invocation and call cancelMatch() with a clear error message (FR-001a)

- [ ] T049 Add zero-accepted-moves guard in lib/game-engine/wordEngine.ts — before scanning, check
  acceptedMoves.length === 0; if true, return a RoundScoreResult with empty arrays and zero deltas without
  running any pipeline stages (FR-006d)

- [ ] T050 Add board-unchanged short-circuit in lib/game-engine/wordEngine.ts — before scanning, deep-compare
  boardAfter to boardBefore (compare by JSON.stringify or tile-by-tile); if identical, skip scan/delta/scoring/
  freeze/persist and return zero-word result (FR-006e)

- [ ] T051 Add retry wrapper around scoring pipeline in lib/game-engine/wordEngine.ts or
  app/actions/match/publishRoundSummary.ts — wrap the full pipeline in a retry loop (up to 3 attempts with
  exponential backoff); on all-retries-exhausted, call cancelMatch(), broadcast error via Realtime to both
  players, and log full context (FR-026)

- [ ] T052 Implement atomic frozen tile update in app/actions/match/publishRoundSummary.ts — replace plain
  UPDATE with conditional: `UPDATE matches SET frozen_tiles = $new WHERE id = $matchId AND frozen_tiles =
  $previousMap::jsonb`; on conflict (stale value), reload current frozen_tiles and recompute the merge, retry
  once (FR-027)
```

---

### F-002: Resolve CHK017 Contradiction (Option A — Revert Spec to Match Implementation)

**Rationale**: The implementation already implements duplicate-zeroing. Option A requires only spec/doc edits with zero code changes and is immediately consistent.

#### Change 1 — `spec.md` User Story 3 title and description

**Before** (lines 44–56):
```
### User Story 3 - All Discovered Words Score (Priority: P1)

Every word newly found on the board after a round resolves scores points, including the same word text found at a
different board position. Word identity is determined by text + board position, not text alone. If the same word
text appears at two different positions on the board, both instances are independent words and both score.

**Why this priority**: Scoring all discovered words regardless of prior occurrences rewards spatial play and board
awareness. Finding the same word at a new position is a valid strategic achievement.

**Independent Test**: Form a word in round 1, then form the same word text at a different board position in round
3. Verify both occurrences score full points.

**Acceptance Scenarios**:

1. **Given** Player A scored "SKIP" at position (0,0)→(3,0) in round 2, **When** Player A forms "SKIP" again at
   position (5,5)→(8,5) in round 5, **Then** the round summary shows "SKIP" with full points for the new instance.
2. **Given** Player A scored "SKIP" in round 2, **When** Player B forms "SKIP" at any position in round 4, **Then**
   Player B receives full points.
3. **Given** Player A forms two new words in a round, both at new positions, **When** the round resolves, **Then**
   both words score normally and both count toward the multi-word combo bonus.
```

**After**:
```
### User Story 3 - Each Word Scores At Most Once Per Player Per Match (Priority: P1)

Each unique word text scores points at most once per player per match. If a player forms a word they have already
scored in a prior round, the word is recognized ("previously scored") but awards 0 points for that player.
Different players track word history independently — if Player B forms a word that Player A already scored, Player
B receives full points. Combo bonuses count only non-duplicate (new) words scored in the round.

**Why this priority**: Preventing repeat scoring stops a degenerate strategy where a player exploits the same
high-value word indefinitely. It ensures both players must continually discover new words to accumulate points.

**Independent Test**: Score a word in round 1, then form the same word text again in round 3. Verify 0 points are
awarded with a "previously scored" indicator in the round summary.

**Acceptance Scenarios**:

1. **Given** Player A scored "SKIP" in round 2, **When** Player A forms "SKIP" again in round 5, **Then** the round
   summary shows "SKIP" with 0 points and a "previously scored" label.
2. **Given** Player A scored "SKIP" in round 2, **When** Player B forms "SKIP" at any position in round 4, **Then**
   Player B receives full points (per-player tracking).
3. **Given** Player A forms 1 new word and 1 previously-scored word in a round, **When** the round resolves, **Then**
   the combo bonus counts only 1 new word (= +0 bonus) and the duplicate shows "previously scored" with 0 points.
```

#### Change 2 — `spec.md` FR-009

**Before**:
```
- **FR-009**: System MUST apply a multi-word combo bonus when a player scores multiple new words in a single round:
  1 word = +0, 2 words = +2, 3 words = +5, 4+ words = +7 + (n-4). `n` counts all newly discovered words that
  round; there is no exclusion for previously seen word texts.
```

**After**:
```
- **FR-009**: System MUST apply a multi-word combo bonus when a player scores multiple new words in a single round:
  1 word = +0, 2 words = +2, 3 words = +5, 4+ words = +7 + (n-4). `n` counts only non-duplicate words (words
  that are new to this player this match and receive full points); previously-scored duplicate words do not
  contribute to the combo count.
```

#### Change 3 — `spec.md` FR-010

**Before**:
```
- **FR-010**: System MUST award points for every newly discovered word regardless of whether the same word text
  has been scored before. Word identity is defined by text + canonical tile set (sorted tile coordinates). The
  same word text at a different set of tiles is a distinct word and scores independently. A palindrome that reads
  in two directions across the same tiles counts as one word and scores once.
```

**After**:
```
- **FR-010**: Each unique word text scores at most once per player per match. If a player discovers a word they
  have already scored in a prior round of the same match, the word is marked as a duplicate (`is_duplicate=true`),
  displayed with a "previously scored" label, and awards 0 points for that player. Different players' word
  histories are tracked independently. A palindrome that reads in two directions across the same tiles counts
  as one word and scores once.
```

#### Change 4 — `spec.md` SC-004

**Before**:
```
- **SC-004**: The same word text found at a different board position scores independently and receives full points,
  verified by integration tests forming the same word text at two distinct positions across separate rounds.
  The same word text at the same position does not score a second time (it is pre-existing per FR-006 and not
  detected as new).
```

**After**:
```
- **SC-004**: The same word text formed a second time by the same player in a later round is recognized as a
  duplicate, awards 0 points, and displays a "previously scored" label — verified by integration tests. A different
  player forming the same word text always receives full points (per-player tracking), also verified by
  integration tests.
```

#### Change 5 — `tasks.md` Phase 5 header — no change needed

The Phase 5 header already says "Each word scores at most once per player per match" — which matches Option A exactly. **No edit required.**

#### Change 6 — `data-model.md` §ComboBonus — restore "non-duplicate only" language

Find the §ComboBonus section and change any language updated by CHK017 back to: "Only non-duplicate words count toward the combo word count `n`."
