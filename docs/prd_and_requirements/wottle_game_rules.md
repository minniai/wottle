# Wottle Game Rules

> **Authoritative specification of Wottle's gameplay, scoring rules, and the algorithm that enforces them.**
>
> This is a normative document, not a narrative. Any code change that touches the scoring pipeline (`lib/game-engine/*`, `lib/match/roundEngine.ts`, `lib/match/stateMachine.ts`) or that changes scoring-adjacent constants (`lib/constants/game-config.ts`) MUST be checked against every rule in §1–§6 below. If a rule here is ambiguous or contradicts the implementation, treat that as a bug report: resolve the contradiction *in this document* before merging the code change, and add a regression test that pins the outcome.
>
> Regressions in scoring are the single most common class of bug in this codebase. The Change Log in §10 lists each past regression and names the rule that would have caught it; when reading this document, treat that log as warnings, not history.

---

## Table of Contents

1. [Board and tile state](#1-board-and-tile-state)
2. [Rounds and moves](#2-rounds-and-moves)
3. [What counts as a scored word](#3-what-counts-as-a-scored-word)
4. [The per-letter coverage rule](#4-the-per-letter-coverage-rule-critical)
5. [Scoring formula](#5-scoring-formula)
6. [After scoring: freezing](#6-after-scoring-freezing)
7. [Algorithm: how §3–§6 are enforced](#7-algorithm-how-the-rules-are-enforced)
8. [Invariants that must hold after every scoring event](#8-invariants-that-must-hold-after-every-scoring-event)
9. [Testing discipline](#9-testing-discipline)
10. [Change log of scoring regressions](#10-change-log-of-scoring-regressions)
11. [Code references](#11-code-references)

> **Two rules, two axes**. The cross-axis uses per-letter coverage (§4) and is **physical** (ignores `scoredAxes`). The same-axis uses the standalone invariant (§3.5a, §7.4) and *does* consult `scoredAxes` to decide whether a frozen neighbor extends a prior scored word on this axis. Do not conflate the two. Most past regressions came from applying one rule where the other belonged.

---

## 1. Board and tile state

- The board is a **10×10 grid** (`BOARD_SIZE = 10`, `BOARD_TILE_COUNT = 100`), fully filled with letters at all times. A "cell" is never empty.
- Each cell has one letter from the active language (default: Icelandic, `language = "is"`).
- Each cell is either **frozen** or **unfrozen**:
  - **Frozen** — the tile has been part of at least one scored word in a prior round and is locked. The tile's letter cannot change for the rest of the match.
  - **Unfrozen** — the tile can be moved by a swap.
- A frozen tile carries metadata:
  - `owner` — `player_a`, `player_b`, or `both` (if both players scored words that used it).
  - `scoredAxes` — the set of axes (`"horizontal"`, `"vertical"`) the tile participated in when it was scored.

> **Important**: `scoredAxes` is **informational / audit data only**. It MUST NOT be used to gate validation decisions. The physical letter is on the board regardless of which axis it was originally scored on, and any validation rule that consults `scoredAxes` will leak bugs of the `#195` family. See §10 for the history.

---

## 2. Rounds and moves

- A match is **exactly 10 rounds**. Each round has a clock and a simultaneous-submission phase.
- In each round, each player submits **exactly one swap**: a pair of coordinates `(fromX, fromY)` and `(toX, toY)`. A swap exchanges the two letters. A swap may NOT target a frozen tile on either end.
- Submissions are independent — neither player sees the other's swap until both have submitted (or the clock forces a resolution).
- **Conflict resolution**: if both swaps target the same coordinate, the earlier-submitted swap applies and the later one is dropped (first-come-first-served, `submittedAt` ascending; `player_a` wins exact ties).
- Once both swaps are resolved, the round enters the **scoring phase** (§3–§6).

The swap mechanic is the *only* way to mutate the board. Scoring is a pure function of the board state after both swaps have been applied and the prior round's frozen state.

---

## 3. What counts as a scored word

A *word* is a contiguous sequence of letters on the board. For a word to be **scored** in a given round, **all** of the following must hold:

### 3.1 Direction

The word must be read along one of **four orthogonal reading directions**: left-to-right, right-to-left, top-to-bottom, bottom-to-top. **Diagonals are not scored.** The scanner may find diagonal matches as a side effect, but they are filtered out before scoring.

### 3.2 Length

The word length must be at least **`minimumWordLength`**, currently **3** (set in `lib/constants/game-config.ts`). A 2-letter sequence is never a word, regardless of dictionary contents.

### 3.3 Dictionary membership

The word, normalized to NFC and lowercased, must be present in the active language's dictionary. For Icelandic, this is the full inflected BÍN word list (~3.74M entries), loaded once at runtime from `data/wordlists/word_list_is.txt`.

### 3.4 Triggered by this round's swap

Only words that pass through at least one of the round's swap coordinates are candidates. A word that already existed on the board before the round's swaps and is untouched by the swaps does not re-score.

### 3.5 Same-axis conflict between new words

Two new words scored in the same round on the same axis (both horizontal or both vertical) must not overlap and must not be physically adjacent (one ending where the other begins). This preserves the standalone invariant: each scored word ends at an unscored tile or the board edge.

Perpendicular new words (one horizontal, one vertical) may share exactly one tile — the crossing — and that is valid and expected.

### 3.5a Same-axis conflict with prior-round scored words

The standalone invariant (§3.5) also applies **across rounds**: a new word *W* on axis *a* must not be physically adjacent to a frozen tile that was itself scored on axis *a* in an earlier round, **unless** the maximal combined same-axis scored run is itself a dict word.

Formal statement: let *t* be a frozen tile immediately adjacent to *W*'s first or last tile along axis *a*. *t* counts as a **same-axis extension** iff *a* ∈ *t*.scoredAxes (legacy tiles without `scoredAxes` are treated as same-axis when the contiguous frozen run they belong to is itself a dict word — i.e., was almost certainly scored on this axis). If any same-axis extension exists, the sequence formed by `(before extension) + W + (after extension)` — using maximal contiguous same-axis extensions on both sides — MUST be a dict word. Otherwise *W* is rejected.

This is the *only* place in the spec where `scoredAxes` **is** consulted: the question "did this tile previously end a scored word on *this* axis?" is a scoring-history question, not a physical-coverage question, and §4.4's argument against `scoredAxes` does not apply. The cross-axis check (§4) remains purely physical.

**Accepts** (issue #136, preserved): Frozen `Þ` at `(1,2)` with `scoredAxes = ["vertical"]`. Player swaps `B` into `(2,2)` to form horizontal `BÆN`. Horizontal is not in Þ's scoredAxes → no same-axis extension → no concatenation check → `BÆN` scores.

**Rejects** (issue #200, `ÖRLTEL`): Frozen `Ö`, `R`, `L` at column 1 rows 1–3, all with `scoredAxes = ["vertical"]` (prior vertical `ÖRL`). Player scores vertical `TEL` at rows 4–6. Vertical IS in the frozen tiles' scoredAxes → the same-axis extension is `ÖRL`. Combined run `ÖRLTEL` is not a dict word → `TEL` is rejected.

### 3.6 Per-letter coverage

The word must not create an **uncovered scored letter** in any reading direction. This is the single most important and most often-misunderstood rule. It has its own section: §4.

### 3.7 Duplicate word suppression

If the same word text (case-insensitive, NFC-normalized) has already been scored by the same player in an earlier round of the same match, the word is marked **duplicate** and scores **0 points**. It does not count toward the multi-word combo bonus. Duplicate tracking is per-player — each player independently accumulates their own scored-word history.

---

## 4. The per-letter coverage rule (CRITICAL)

> **Plain English**: After a word is scored, every scored letter on the board — old or new — must be part of a valid dictionary word of length ≥ `minimumWordLength` in at least one reading direction. No scored letter may sit in a contiguous scored run that has no valid word covering it.

### 4.1 Formal statement

Let *S* denote the set of scored (frozen) tiles on the board after a candidate scoring event.

For every reading direction *d* ∈ {horizontal, vertical}, and for every maximal contiguous run *R* of tiles from *S* along *d*, and for every tile *t* in *R* that was scored by the candidate event:

> Either *R* has length 1, or there exists a contiguous sub-run *W* of *R* such that:
> - `|W| >= minimumWordLength`,
> - *t* ∈ *W*,
> - *W* (read forward or reversed, NFC-normalized and lowercased) is in the dictionary.

A candidate scoring event that violates this condition for any tile of the new word(s) MUST be rejected.

### 4.2 Consequences

- A contiguous scored run of length 2 (below `minimumWordLength`) is always a violation: no sub-run of length ≥ 3 can fit inside 2 tiles. Rejection is unconditional.
- A contiguous scored run of length ≥ `minimumWordLength` is OK as long as the new tiles are *covered* by some valid dict sub-run. The full maximal run need **not** itself be a dictionary word.
- Already-frozen tiles from prior rounds do **not** need to be re-covered by the new scoring — they were covered when they were placed. The rule is only evaluated for tiles introduced by the candidate event.

### 4.3 Two canonical examples

**Accepts** (issue #136): Frozen `Þ` at `(1,2)`, scored earlier on a vertical word. Player swaps `B` into `(2,2)`, forming `BÆN` at cols 2–4 row 2. The horizontal scored run at row 2 is `Þ B Æ N` (length 4). The sub-run `BÆN` (length 3) is in the dictionary and contains B, Æ, and N (every new letter). Per-letter coverage holds. **`BÆN` scores.**

**Rejects** (issue #195, "ML" at `(7,0)`): Frozen `M` at `(7,0)`, scored earlier on a vertical word. Player attempts a vertical scoring through `L` at `(8,0)`. After the hypothetical freeze, row 0 would have the scored run `M L` (length 2). No sub-run of length ≥ 3 fits. Per-letter coverage fails for the new tile `L`. **The candidate is rejected.**

### 4.4 Why `scoredAxes` doesn't gate the **cross-axis** check

A frozen tile's `scoredAxes` records which axes it was scored on in the past. It is tempting — and wrong — to skip a frozen neighbor in the **cross-axis** check when its `scoredAxes` doesn't include the cross-axis. PR #185 did this and produced #195.

The cross-axis rule is about **physical scored state**, not scoring history. The letter `M` is physically on the board adjacent to `L`; after `L` freezes, row 0 physically contains a two-letter scored run. That run either has a valid covering dictionary word or it doesn't, and the tile's `scoredAxes` metadata is irrelevant to that question.

Do not reintroduce a `scoredAxes`-gated check **for the cross-axis**. See §10 for receipts.

> **Note**: The §3.5a / §7.4 same-axis standalone check is a different rule and *does* consult `scoredAxes`. That check asks a scoring-history question — "did this tile previously end a scored word on *this* axis?" — which `scoredAxes` is the authoritative answer to. §4.4's prohibition applies only to cross-axis per-letter coverage.

---

## 5. Scoring formula

Formula per candidate word, computed server-side only:

```
total = letter_points + length_bonus
```

### 5.1 Letter points

- Sum of the per-letter values from the language's scoring table (`lib/game-engine/letter-values/letter_scoring_values_<lang>.ts`). Icelandic: A=1, Á=4, Ð=2, X=10, etc. Unknown characters default to 1.
- **Opponent-frozen tiles do not contribute** to letter points. A word that spans opponent-frozen tiles still scores (the word is valid), but only the player's own tiles (and unfrozen tiles the word freezes) contribute their letter values.

### 5.2 Length bonus

- `length_bonus = (word_length − 2) × 5`.
- Uses the *full* word length, including any opponent-frozen tiles in the run. Length bonus is not reduced by opponent-frozen participation.

### 5.3 Multi-word combo bonus

If a player scores *n* non-duplicate words in a single round:

| *n* | Combo bonus |
|---|---|
| 1 | +0 |
| 2 | +2 |
| 3 | +5 |
| ≥ 4 | +7 + (*n* − 4) |

Duplicate words (§3.7) do **not** count toward *n*.

### 5.4 Duplicates

A word the same player has already scored in this match scores 0 and does not count toward the combo bonus. It is still reported in the round summary with a "previously scored" label so the player sees the result of their swap.

### 5.5 Round delta and match total

- **Round delta** for a player = sum of per-word totals (excluding duplicates) + combo bonus.
- **Match total** = cumulative sum of round deltas across all 10 rounds.

Ratings (Elo) are computed from match totals after the match ends; they are not part of scoring.

---

## 6. After scoring: freezing

When a word is accepted and scored:

- Every tile of the word is **frozen**.
- The frozen tile records its `owner` (the scoring player's slot; `both` if both players scored overlapping words that include this tile in the same round) and its `scoredAxes` (the set of axes it was scored on; can be `["horizontal"]`, `["vertical"]`, or `["horizontal", "vertical"]`).
- The board MUST maintain at least **24 unfrozen tiles** at all times (`MIN_UNFROZEN_TILES = 24`). If freezing all tiles of newly-scored words would breach this floor, freezing is partial: tiles are frozen in reading order (row first, then column) until the floor would be breached, then the remainder are left unfrozen. The words still score their full points — partial freeze only affects freezing, not scoring. `wasPartialFreeze` is set to `true` in the round result.

---

## 7. Algorithm: how the rules are enforced

The scoring pipeline runs server-side in `processRoundScoring` (`lib/game-engine/wordEngine.ts`). It is a pure function of the pre-round board and the accepted moves.

### 7.1 Pipeline

For each round:

1. **Sort** accepted moves by `submittedAt` ascending; ties broken by `player_a` first (`sortByPrecedence`).
2. For each move in order:
   1. **Reject swap** if either endpoint is already frozen (including frozen earlier in *this* round by a prior move). Skip to the next move.
   2. **Apply swap** (`applySwap`, immutable, `lib/game-engine/board.ts`).
   3. **Scan** for dictionary-valid words passing through the swap coordinates (`scanFromSwapCoordinates`, `lib/game-engine/boardScanner.ts`). Returns a list of `BoardWord` candidates, each one already ≥ `minimumWordLength` and in the dictionary.
   4. **Cross-validate** and select the best subset (`selectOptimalCombination`, `lib/game-engine/crossValidator.ts`). See §7.2.
   5. **Score** the selected words (letter points + length bonus, excluding opponent-frozen letters from letter points).
   6. **Freeze** the scored tiles, respecting the 24-tile floor (`freezeTiles`, `lib/game-engine/frozenTiles.ts`). Updates `owner` and `scoredAxes`.
3. Aggregate per-player deltas, combo bonuses, and duplicates into a `RoundScoreResult`.
4. Emit structured log (`word-engine.scoring`) with duration, words found, words scored, tiles frozen, `wasPartialFreeze`.

### 7.2 Cross-validation (`selectOptimalCombination`)

Given the list of candidate words for one player's move:

1. **Enumerate all non-empty subsets** of candidates (2^*n* − 1). *n* is small in practice (a handful of candidates per swap).
2. For each subset, **prune same-axis conflicts** between candidates (`hasNoSameAxisConflict`, §3.5).
3. For each surviving subset, **check per-letter coverage** and **same-axis standalone invariant** (`isSubsetValid`): for each candidate word in the subset, treat *all other subset candidates' tiles* as "extra established" tiles, then apply both `hasCrossWordViolation` (§7.3, cross-axis) and `violatesFrozenAdjacencyOnSameAxis` (§7.4, same-axis).
4. Among subsets that pass, pick the one with the **maximum total score** (letter points + length bonus per word, summed).

There is **no individual pre-filter** before subset enumeration. A candidate's coverage can depend on another candidate in the same round (BÁS in #136 only reaches a length-3 horizontal scored run if BÆN is also in the subset), so pruning a candidate before mutual validation is unsound.

### 7.3 The per-letter check (`hasCrossWordViolation`, cross-axis)

For each tile *t* of a candidate word *W*, in the cross-axis (perpendicular to *W*):

1. Trace backward and forward from *t* through the set `frozenTileSet ∪ extraTileSet` (i.e., existing frozen tiles plus tiles of other candidates in the current subset). `scoredAxes` is **not** consulted.
2. Let *runChars* be the resulting contiguous cross-axis run, with *t* at index `tileIdx`.
3. Reject if:
   - `runLen == 1` → OK, no constraint.
   - `runLen < minimumWordLength` → **violation** (2-letter runs are always invalid).
   - `runLen ≥ minimumWordLength` and `runContainsValidSubRunCoveringIndex(runChars, tileIdx, dict, min) == false` → **violation** (no dict sub-run covers *t*).

### 7.4 The same-axis standalone check (`violatesFrozenAdjacencyOnSameAxis`)

Per-letter coverage is trivially satisfied on the candidate's own axis (the candidate itself is a dict sub-run of length ≥ min covering its own tiles). The rule that bites here is the **standalone invariant** (§3.5a): the candidate must not concatenate with a prior same-axis scored word into an invalid combined run.

For a candidate *W* on axis *a* (with `wordAxis = "horizontal"` if *W* reads L/R else `"vertical"`):

1. From *W*'s first tile, step backward along axis *a* and collect a `beforeRun` of contiguous frozen tiles that satisfy:
   - With `scoredAxes` metadata: `wordAxis ∈ t.scoredAxes`.
   - Legacy (no `scoredAxes`): always collect, but gate the invariance check on the collected run itself being a dict word (single letters and non-word pairs never trigger).
2. Symmetrically collect `afterRun` from *W*'s last tile forward.
3. If `beforeRun` exists, reject when `[reverse(beforeRun), W]` is not a dict word (modulo the legacy dict-gate).
4. If `afterRun` exists, reject when `[W, afterRun]` is not a dict word (modulo the legacy dict-gate).
5. If both exist (sandwich), reject when the full `[reverse(beforeRun), W, afterRun]` is not a dict word.

This is the **only** place `scoredAxes` is consulted (§4.4 notwithstanding): whether a frozen tile extends a prior scored word *on this axis* is a scoring-history question that `scoredAxes` is the authoritative answer to. The cross-axis check in §7.3 remains purely physical.

### 7.5 The coverage helper (`runContainsValidSubRunCoveringIndex`)

Returns `true` iff there exists `start ≤ tileIdx < end`, `end − start ≥ min`, such that the sub-run from `start` to `end` (or its reverse), NFC-normalized and lowercased, is in the dictionary. *O(runLen²)* dict lookups; runs are bounded by `BOARD_SIZE = 10`, so ≤ 45 lookups per tile per axis.

---

## 8. Invariants that must hold after every scoring event

These are board-global post-conditions. A scoring event that would break any of them MUST be rejected *at validation time*. They are also valid assertions to add to tests and observability.

| # | Invariant | Where enforced |
|---|---|---|
| I1 | Every scored letter is part of a dict word of length ≥ `minimumWordLength` in at least one reading direction. | §4, `hasCrossWordViolation` |
| I2 | No contiguous scored run of length 2..(min−1) exists on the board. | §4.2, `hasCrossWordViolation` (below-min branch) |
| I3 | For every maximal contiguous scored run of length ≥ min, every newly-frozen tile is covered by some dict sub-run of length ≥ min that includes it. | §4.1, `runContainsValidSubRunCoveringIndex` |
| I4 | Every frozen tile's `owner` is one of `player_a`, `player_b`, `both`; never undefined. | `freezeTiles` |
| I5 | The board always has ≥ `MIN_UNFROZEN_TILES` (24) unfrozen tiles. | `freezeTiles` partial-freeze logic |
| I6 | No swap ever targets a frozen tile (including tiles frozen earlier in the same round). | `processPlayerMove` rejection branch |
| I7 | No two scored words in the same round on the same axis overlap or are physically adjacent. | `hasNoSameAxisConflict` |
| I7a | No newly-scored word is physically adjacent on its own axis to a frozen tile that was previously scored on the same axis, unless the combined maximal same-axis scored run is itself a dict word. | §3.5a, `violatesFrozenAdjacencyOnSameAxis` |

If you add a new scoring-related feature, state which invariant(s) your change affects and which it must continue to uphold. If you find an invariant is missing from this list, add it here and write a test that pins it.

---

## 9. Testing discipline

Tests that exercise scoring live primarily in:

- `tests/unit/lib/game-engine/crossValidator.test.ts`
- `tests/unit/lib/game-engine/wordEngine.test.ts`
- `tests/unit/lib/game-engine/boardScanner.test.ts`
- `tests/unit/lib/game-engine/deltaDetector.test.ts`
- `tests/unit/lib/game-engine/scorer.test.ts`
- `tests/unit/lib/game-engine/frozenTiles.test.ts`
- `tests/integration/roundScoring.test.ts`

For any new or modified scoring behavior, a test MUST:

1. Name the invariant it tests (e.g. "I3: …") or the rule section (e.g. "§4.2: below-min cross-run is rejected").
2. Assert against the rule stated in this document, not the current implementation behavior. If they diverge, fix the implementation.
3. Include both a **positive** case (the rule is satisfied → accept) and a **negative** case (the rule is violated → reject) when the rule admits both.

When fixing a scoring bug, add a test that encodes the *rule* the bug violated, not merely the specific scenario. A test like `"rejects 'nös' next to frozen 'x' with scoredAxes=['vertical']"` is narrower than `"I3: rejects any candidate whose new tile creates a below-min cross-axis scored run with a frozen neighbor"` — prefer the latter.

---

## 10. Change log of scoring regressions

Read this section before editing anything in `lib/game-engine/crossValidator.ts`.

| Date | PR | Issue | What went wrong | Rule that catches it now |
|---|---|---|---|---|
| 2026-04-23 | #182 | #130 | Next round's `board_snapshot_before` was seeded from the raw sequential swap result instead of the word engine's `scoringFinalBoard`, so the next round could start on a board that contradicted the prior round's scoring. | N/A (out of scope for this doc — it was a board-seeding bug, not a rule bug). |
| 2026-04-23 | #185 | #136 | Over-correction: `hasCrossWordViolation` and `violatesFrozenAdjacencyOnSameAxis` were modified to skip frozen tiles whose `scoredAxes` didn't include the current axis. This fixed the false rejection of `BÆN`/`BÁS` but opened §1's hole: a frozen tile physically on the board could be ignored during validation if it had been scored on a perpendicular axis, letting below-min and uncovered scored runs slip through. | §4.4 — `scoredAxes` must not gate validation. |
| 2026-04-24 | #198 | #195 | The `scoredAxes`-based skip from #185 allowed invalid scored runs like `ML`, `NÐ`, `US` (length 2, below min) and `TKH`, `RNÝ`, `ÆLÁGA` (≥ 3 letters, not in dict, no covering sub-run) to be created at scoring time. Fixed by adopting the per-letter coverage rule: every frozen tile counts physically, and every new tile must be covered by a dict sub-run in every direction where its maximal scored run has length ≥ 2. `violatesFrozenAdjacencyOnSameAxis` was deleted; the new word itself is a same-axis covering sub-run for its tiles. | §4 (entire section) — the per-letter coverage rule. |
| 2026-04-24 | #201 | #200 | Deleting `violatesFrozenAdjacencyOnSameAxis` in #198 lost the cross-round enforcement of the standalone invariant. The per-letter rule is trivially satisfied on the candidate's own axis (the candidate *is* a covering sub-run), so a new dict word could be placed physically adjacent to a prior same-axis scored dict word — producing invalid visual runs like `ÖRLTEL` (`ÖRL` + `TEL`), `ÞESSINÓK` (`ÞESSI` + `NÓK`), and `NEFÞEMA` (`NEF` + `ÞEMA`). Fixed by restoring the same-axis check as a sibling to `hasCrossWordViolation`: if a frozen same-axis extension exists (gated by `scoredAxes` when present, or by the run being a dict word in the legacy case), the combined sequence must itself be a dict word. `#136` is preserved because `Þ.scoredAxes = ["vertical"]` does not count as a horizontal extension for `BÆN`. | §3.5a and I7a — the cross-round standalone invariant, enforced by `violatesFrozenAdjacencyOnSameAxis`. |

When you land a scoring-related fix, append a row here with: date, PR number, issue number, one-sentence description of what went wrong, and the rule section that now prevents it. If the fix exposes a rule that was not previously documented, document it in this file *in the same PR*.

---

## 11. Code references

- **Rules surface** — this document is the source of truth; `lib/constants/game-config.ts` holds the numeric constants (`minimumWordLength`, `maxRounds`, `timePerRoundMs`, `boardSize`, `language`).
- **Pipeline entry point** — `lib/game-engine/wordEngine.ts::processRoundScoring`.
- **Scanner** — `lib/game-engine/boardScanner.ts::scanFromSwapCoordinates`.
- **Cross-validator** — `lib/game-engine/crossValidator.ts::selectOptimalCombination`, `hasCrossWordViolation` (cross-axis, §7.3), `violatesFrozenAdjacencyOnSameAxis` (same-axis standalone, §7.4), `runContainsValidSubRunCoveringIndex`.
- **Scorer** — `lib/game-engine/scorer.ts::calculateLetterPoints`, `calculateLengthBonus`.
- **Freezer** — `lib/game-engine/frozenTiles.ts::freezeTiles`.
- **Dictionary** — `lib/game-engine/dictionary.ts::loadDictionary`; wordlist at `data/wordlists/word_list_is.txt`.
- **Letter values** — `lib/game-engine/letter-values/letter_scoring_values_<lang>.ts`.
- **Round orchestration** — `lib/match/roundEngine.ts::advanceRound`, `lib/match/stateMachine.ts`.
- **Older narrative (superseded)** — `docs/notes/260303-word-scoring-rules.md`. Kept for history; always prefer this document.
