# Wottle Game Rules

> **Authoritative specification of Wottle's gameplay, scoring rules, and the algorithm that enforces them.**
>
> This is a normative document, not a narrative. Any code change that touches the scoring pipeline (`lib/game-engine/*`, `lib/match/moveResolver.ts`, `lib/match/matchSettlement.ts`) or that changes scoring-adjacent constants (`lib/constants/game-config.ts`) MUST be checked against every rule in §1–§6 below. If a rule here is ambiguous or contradicts the implementation, treat that as a bug report: resolve the contradiction *in this document* before merging the code change, and add a regression test that pins the outcome.
>
> Regressions in scoring are the single most common class of bug in this codebase. The Change Log in §10 lists each past regression and names the rule that would have caught it; when reading this document, treat that log as warnings, not history.

---

## Table of Contents

1. [Board and tile state](#1-board-and-tile-state)
2. [Moves](#2-moves) · [2a. Time control](#2a-time-control-clock-model)
3. [What counts as a scored word](#3-what-counts-as-a-scored-word)
4. [The per-letter coverage rule](#4-the-per-letter-coverage-rule-critical)
5. [Scoring formula](#5-scoring-formula)
6. [After scoring: freezing](#6-after-scoring-freezing)
7. [Algorithm: how §3–§6 are enforced](#7-algorithm-how-the-rules-are-enforced)
8. [Invariants that must hold after every scoring event](#8-invariants-that-must-hold-after-every-scoring-event)
9. [Testing discipline](#9-testing-discipline)
10. [Change log of scoring regressions](#10-change-log-of-scoring-regressions)
11. [Code references](#11-code-references)
12. [What the player sees](#12-what-the-player-sees)

> **Two rules, two axes — both physical**. The cross-axis uses whole-run validation (§4): every connected scored run through a new tile must itself be a dictionary word of length ≥ min (a single isolated tile on that axis is exempt). The same-axis uses the standalone invariant (§3.5a, §7.4): if the new word physically abuts a frozen tile on its axis, the maximal combined same-axis scored run must itself be a dict word. Both rules consult only the physical frozen state — `scoredAxes` is audit-only (§4.4). Most past regressions came from gating validation on `scoredAxes`; do not reintroduce that.

---

## 1. Board and tile state

- The board is a **10×10 grid** (`BOARD_SIZE = 10`, `BOARD_TILE_COUNT = 100`), fully filled with letters at all times. A "cell" is never empty.
- Each cell has one letter from the active language (default: Icelandic, `language = "is"`).
- Each cell is either **frozen** or **unfrozen**:
  - **Frozen** — the tile has been part of at least one scored word in an earlier move and is locked. The tile's letter cannot change for the rest of the match.
  - **Unfrozen** — the tile can be moved by a swap.
- A frozen tile carries metadata:
  - `owner` — `player_a`, `player_b`, or `both` (if both players scored words that used it).
  - `scoredAxes` — the set of axes (`"horizontal"`, `"vertical"`) the tile participated in when it was scored.

> **Important**: `scoredAxes` is **informational / audit data only**. It MUST NOT be used to gate validation decisions. The physical letter is on the board regardless of which axis it was originally scored on, and any validation rule that consults `scoredAxes` will leak bugs of the `#195` family. See §10 for the history.

---

## 2. Moves

- Each player makes **exactly ten moves** in a match (`matches.move_limit`, default 10), **whenever they like**. There are no rounds and no turns: a player never waits for the opponent, and both may move at the same moment.
- A move is **one swap**: a pair of coordinates `(fromX, fromY)` and `(toX, toY)` plus the two letters the player saw there (`fromLetter`, `toLetter`). A swap exchanges the two letters. A swap may NOT target a frozen tile on either end.
- **Receipt.** The server receives a move under a per-match lock and gives it a gap-free **receipt sequence** (`match_moves.global_seq`) and a server timestamp (`received_at`). Client timestamps are never read. Receipt refuses a move — without recording it — when the match is over, the clock has passed 0:00 (§2a), the player already has ten resolved moves, or the player has a move still unresolved (**one move in flight per player**).
- **Resolution in receipt order.** Moves resolve **one at a time, in receipt-sequence order**, each against the board and freeze map as the previous sequence left them (`lib/match/moveResolver.ts`, spec 050). The sequence is the ordering authority; `received_at` is informational, because a database clock is not guaranteed monotone across a restart. Two moves received a millisecond apart resolve in that order even when two server instances race; the later one sees the earlier one's swap and freezes.
- **Refusal at resolution.** If, by the time a move resolves, either of its letters is frozen (`frozen`) or is no longer the letter the player saw (`moved` — an earlier move exchanged it), the move is **refused and not counted**: it does not consume one of the ten, and the player picks again. This is the whole of conflict resolution; there is no "same swap" rule and no `player_a` tie-break, because no two moves ever resolve together.
- **Scoring on resolution.** A resolved move is scored at once (§3–§6) and its freezes are written before the next sequence is claimed. Both players see the result the moment it is broadcast (`move-resolved`); the mover's field takes no further pick until their own reveal has drawn and held (600ms), the opponent's field is never locked by it.
- **The board changes only by resolved moves.** Scoring is a pure function of the board after the move's swap and the freeze map as it stood when the move was claimed.

### 2a. Time control (clock model)

- A match has **one clock**, shared by both players: **5:00 (300 000 ms)** from the moment the match starts (`matches.started_at`, `matches.deadline_at = started_at + 5:00`). It **never pauses** — not for a reveal, not for a disconnection — and it never stops early except by the match ending. The Field & Ledger design draws it once, in the ledger caption (§12).
- **The deadline is decided at receipt.** A move received at or before `deadline_at` is resolved and counted even if its resolution completes after the deadline; the reveal is shown and only then does the match complete. A move received after the deadline is refused (`deadline`). The comparison is made by the database clock inside the receipt function, never by a serverless instance's clock.
- **The match ends** when both players have ten resolved moves, or when the deadline has passed and every move received before it has resolved. It is decided in this order (`lib/match/resultCalculator.ts`, spec 050):
  1. one player has fewer than ten moves → **the other wins** (`incomplete`), whatever the totals;
  2. both have fewer than ten → **draw** (`both_incomplete`), whatever the totals;
  3. both have ten → higher total wins; a tie goes to the player with more **exclusively owned frozen tiles**; still tied → **draw** (`moves_complete`).
  Every outcome is rated.
- A player who has made ten moves watches the rest of the match with the field locked. If the opponent has been unreachable for the 90-second reconnection window, that player may end the match early (`end the match ▸`); the ordinary rules above decide it. A disconnection by itself changes nothing else: the clock runs, and a player who does not come back simply fails to finish.
- Resigning ends the match at once as a forfeit (`forfeit`, the other player wins).

---

## 3. What counts as a scored word

A *word* is a contiguous sequence of letters on the board. For a word to be **scored** by a move, **all** of the following must hold:

### 3.1 Direction

The word must be read along one of **four orthogonal reading directions**: left-to-right, right-to-left, top-to-bottom, bottom-to-top. **No other direction is read.** The scanner may find matches along other lines as a side effect; they are filtered out before scoring.

**One record per run.** A run is scored **once** even when it is a valid word in **both** directions. The scanner builds a forward and a reversed `BoardWord` for every run, but two readings of the same tiles overlap on the same axis (§3.5, `hasNoSameAxisConflict`), so `selectOptimalCombination` keeps exactly one: the **forward** reading (left-to-right or top-to-bottom) when both are words, the reversed reading only when it alone is a word. `FÁR`/`RÁF` therefore yields one record, `fár`, read left-to-right. The kept record's tile order is its reading direction, which the UI uses to place a single chevron (§12). Pinned by `tests/unit/lib/game-engine/doubleReading.test.ts`.

### 3.2 Length

The word length must be at least **`minimumWordLength`**, currently **3** (set in `lib/constants/game-config.ts`). A 2-letter sequence is never a word, regardless of dictionary contents.

### 3.3 Dictionary membership

The word, normalized to NFC and lowercased, must be present in the active language's dictionary. For Icelandic, this is the full inflected BÍN word list (~3.74M entries), loaded once at runtime from `data/wordlists/word_list_is.txt`. **The dictionary accepts BÍN entries and nothing else** — there is no additions mechanism; if a real word is missing (e.g. the *kóla* paradigm, Linear O-70), the fix is regenerating the wordlist from BÍN upstream, never an in-repo addition. A small exclusions file, `word_list_is_exclusions.txt`, is subtracted at load time to remove BÍN entries rejected as playable words (e.g. *sýs*, Linear O-81); it accepts one word per line with `#` comments, NFC-normalized and lowercased on load. Accented and unaccented vowels are distinct letters: *ílæti* is a valid BÍN word while *ilæti*/*itæli* are not, and lookups never conflate them (O-69).

### 3.4 Triggered by this move's swap

Only words that pass through at least one of the move's two swap coordinates are candidates. A word that already existed on the board before the move and is untouched by the swap does not re-score.

### 3.5 Same-axis conflict between new words

Two new words scored by the same move on the same axis (both horizontal or both vertical) must not overlap and must not be physically adjacent (one ending where the other begins). This preserves the standalone invariant: each scored word ends at an unscored tile or the board edge.

Perpendicular new words (one horizontal, one vertical) may share exactly one tile — the crossing — and that is valid and expected.

### 3.5a Same-axis conflict with prior-round scored tiles

The standalone invariant (§3.5) also applies **across moves**, and the rule is purely physical: a new word *W* on axis *a* must not be physically adjacent — at either endpoint along *a* — to a **frozen** tile, unless the maximal contiguous same-axis scored run containing *W*'s tiles is itself a dict word.

Formal statement: let *E_before* be the maximal contiguous run of **frozen** tiles preceding *W*'s first tile along axis *a*, read outward from *W* (possibly empty — empty when *W*'s first tile is at the board edge or its predecessor is unfrozen). Let *E_after* be the analogous run following *W*'s last tile. If *E_before* and *E_after* are both empty, the rule is trivially satisfied. Otherwise, *W* is valid only if the concatenation `E_before ⧺ W ⧺ E_after` — NFC-normalized, lowercased, read forward or reversed — is in the dictionary.

"Frozen" here means frozen **before this move was claimed**. Tiles of other candidate words in the same move's subset are handled separately by §3.5 (`hasNoSameAxisConflict`) and §4 (cross-axis per-letter coverage, which treats same-move candidates as "extra established" tiles). `scoredAxes` is **not** consulted. Physical frozen state is the only signal that matters. This works because in a real game a frozen tile cannot exist in isolation on its axis: if a tile is frozen, it was part of a prior ≥ `minimumWordLength` scored word, so the other tiles of that prior word are also frozen and contiguous on the axis of that prior word.

**Accepts** (real #136, preserved): Player swaps `B` into `(2,2)` to form horizontal `BÆN`. The adjacent `Þ` at `(1,2)` is **unfrozen** (plain letter, never scored). *E_before* and *E_after* are both empty → rule satisfied → `BÆN` scores.

**Rejects** (issue #200, `ÖRLTEL`): Frozen `Ö`, `R`, `L` at column 1 rows 1–3 (from a prior vertical `ÖRL`). Player scores vertical `TEL` at rows 4–6. *E_before* = `ÖRL`, *E_after* = empty. Combined run `ÖRLTEL` is not a dict word → `TEL` is rejected.

**Rejects** (issue #200, `NMÚL`): Frozen `N` at `(5,3)` (from any prior scoring — horizontal or vertical, does not matter). Player scores vertical `MÚL` at `(5,4)`–`(5,6)`. *E_before* = `N`, *E_after* = empty. Combined run `NMÚL` is not a dict word → `MÚL` is rejected.

**Rejects** (design example, `BORÐA + GILT`): Frozen horizontal `BORÐA` at columns 1–5 of a row. Player forms `GILT` at columns 6–9 of the same row. *E_before* = `BORÐA`, *E_after* = empty. Combined run `BORÐAGILT` is not a dict word → `GILT` is rejected, even though `GILT` alone is. This is why, on the field, two bands of the same axis never touch end to end: a new word may only extend a frozen run if the whole run is itself a word, in which case it is one word and one band. Regression test to pin: `BORÐA + GILT`.

### 3.6 Per-letter coverage

The word must not create an **uncovered scored letter** in any reading direction. This is the single most important and most often-misunderstood rule. It has its own section: §4.

### 3.7 Repeated words score

A word scores **every time it is formed at a new location**, by either player, however often it has been scored before in the match. There is no duplicate suppression (withdrawn 2026-09-21, spec 050; the earlier rule was documented but never implemented). The same word at the same location cannot re-score: its letters are frozen, and a move must pass through an unfrozen letter (§3.4, §6).

---

## 4. The per-letter coverage rule (CRITICAL)

> **Plain English**: After a word is scored, each horizontal and vertical scored run created or extended by the scoring must itself be a valid dictionary word of length ≥ `minimumWordLength`, read in either direction. A single scored tile with no scored neighbor on an axis is exempt on that axis. Valid substrings do not make an invalid full run legal.

### 4.1 Formal statement

Let *S* denote the set of scored (frozen) tiles on the board after a candidate scoring event.

For every reading direction *d* ∈ {horizontal, vertical}, and for every maximal contiguous run *R* of tiles from *S* along *d*, and for every tile *t* in *R* that was scored by the candidate event:

> Either *R* has length 1, or `|R| >= minimumWordLength` and the **entire run R** (read forward or reversed, NFC-normalized and lowercased) is in the dictionary.

This checks all four reading directions: left-to-right / right-to-left and top-to-bottom / bottom-to-top. Each affected axis must pass; a word need not be valid in both directions on the same axis.

A candidate scoring event that violates this condition for any tile of the new word(s) MUST be rejected.

### 4.2 Consequences

- A contiguous scored run of length 2 (below `minimumWordLength`) is always a violation: no sub-run of length ≥ 3 can fit inside 2 tiles. Rejection is unconditional.
- A contiguous scored run of length ≥ `minimumWordLength` must itself be a dictionary word. A valid prefix, suffix, or interior substring is insufficient.
- Already-frozen tiles from earlier moves do **not** need to be re-covered by the new scoring — they were covered when they were placed. The rule is only evaluated for tiles introduced by the candidate event.

### 4.3 Canonical examples

**Accepts** (real #136): Player swaps `B` into `(2,2)`, forming `BÆN` at cols 2–4 row 2. The adjacent `Þ` at `(1,2)` is unfrozen (just a plain letter on the board). The cross-axis check for each of `B`/`Æ`/`N` sees no frozen neighbors → per-letter coverage trivially holds. **`BÆN` scores.** (The same-axis standalone check — §3.5a — also sees no frozen neighbor on the horizontal axis and does not fire.)

**Rejects** (issue #195, "ML" at `(7,0)`): Frozen `M` at `(7,0)` (physical state; `scoredAxes` is irrelevant to this check). Player attempts a vertical scoring through `L` at `(8,0)`. After the hypothetical freeze, row 0 would have the scored run `M L` (length 2). No sub-run of length ≥ 3 fits. Per-letter coverage fails for the new tile `L`. **The candidate is rejected.**

**Rejects** (`HAUSL`, screenshot regression 2026-09-21): Frozen horizontal `HAUS` is extended by the `L` of a new vertical word. Although `USL` is in the Icelandic dictionary and covers the new `L`, the entire horizontal scored run `HAUSL` is not a word in either direction. **The vertical candidate is rejected**, earns no points, and freezes no tiles. The same rule applies when `HAUS` is another candidate in the same scoring event.

### 4.4 Why `scoredAxes` doesn't gate validation

A frozen tile's `scoredAxes` records which axes it was scored on in the past. It is tempting — and wrong — to skip a frozen neighbor in validation when its `scoredAxes` doesn't include the relevant axis. PR #185 did this for the cross-axis check and produced #195.

Both the cross-axis rule (§4) and the same-axis rule (§3.5a) are about **physical scored state**, not scoring history. A frozen letter is physically on the board regardless of which axis it was originally scored on; any validation rule that skips it based on `scoredAxes` leaks bugs of the #195 / #200 family.

`scoredAxes` is audit/telemetry data only. Do not reintroduce a `scoredAxes`-gated check. See §10 for receipts.

---

## 5. Scoring formula

Formula per candidate word, computed server-side only:

```
total = letter_points + length_bonus
```

### 5.1 Letter points

- Sum of the per-letter values from the language's scoring table (`lib/game-engine/letter-values/letter_scoring_values_<lang>.ts`). Icelandic: Krafla distribution (A=1, Á=3, Ð=2, Æ=4, X=10, etc. — 32 letters, no C/Q/W/Z). Unknown characters default to 1.
- **Opponent-frozen tiles do not contribute** to letter points. A word that spans opponent-frozen tiles still scores (the word is valid), but only the player's own tiles (and unfrozen tiles the word freezes) contribute their letter values.

### 5.2 Length bonus

- `length_bonus = (word_length − 2) × 5`.
- Uses the *full* word length, including any opponent-frozen tiles in the run. Length bonus is not reduced by opponent-frozen participation.

### 5.3 Multi-word combo bonus

If a player scores *n* words with a single move:

| *n* | Combo bonus |
|---|---|
| 1 | +0 |
| 2 | +2 |
| 3 | +5 |
| ≥ 4 | +7 + (*n* − 4) |

Every scored word counts toward *n* (§3.7).

### 5.4 Repeated words

Withdrawn 2026-09-21 (spec 050): a repeated word scores in full and counts toward the combo bonus. See §3.7.

### 5.5 Move delta and match total

- **Move delta** for a player = sum of per-word totals + combo bonus.
- **Match total** = cumulative sum of move deltas across the player's moves (`matches.player_a_score` / `player_b_score`, written by every resolved move).

Ratings (Elo) are computed from match totals after the match ends; they are not part of scoring.

---

## 6. After scoring: freezing

When a word is accepted and scored:

- Every tile of the word is **frozen**.
- The frozen tile records its `owner` (the scoring player's slot; a tile keeps the owner that froze it first, so `both` no longer arises in play and is kept in the type for old data only) and its `scoredAxes` (the set of axes it was scored on; can be `["horizontal"]`, `["vertical"]`, or `["horizontal", "vertical"]`).
- The board MUST maintain at least **24 unfrozen tiles** at all times (`MIN_UNFROZEN_TILES = 24`). If freezing all tiles of newly-scored words would breach this floor, freezing is partial: tiles are frozen in reading order (row first, then column) until the floor would be breached, then the remainder are left unfrozen. The words still score their full points — partial freeze only affects freezing, not scoring. `wasPartialFreeze` is set to `true` in the move result.

---

## 7. Algorithm: how the rules are enforced

The scoring pipeline runs server-side in `resolveOne` (`lib/match/moveResolver.ts`), which the move resolver calls for **one move at a time**; it composes the word engine's steps (`applySwap`, `scanFromSwapCoordinates`, `selectOptimalCombination`, `scoreBoardWords`, `freezeTiles`). It is a pure function of the board and freeze map as the previous receipt sequence left them and of the one move.

### 7.1 Pipeline

For each match, the resolver **claims** the move whose receipt sequence is `matches.resolved_seq + 1` (a compare-and-set; only one instance can hold it), resolves it, and **finishes** it with a second compare-and-set that advances `resolved_seq` by one. Then it claims the next. The sequence, not the timestamp, is the order (§2).

For the claimed move:

1. **Refuse** with `frozen` if either endpoint is frozen, or with `moved` if either letter differs from the one the player sent (§2). A refused move is recorded as `rejected`, is not counted, and writes nothing else.
2. Otherwise:
   1. **Apply swap** (`applySwap`, immutable, `lib/game-engine/board.ts`).
   3. **Scan** for dictionary-valid words passing through the swap coordinates (`scanFromSwapCoordinates`, `lib/game-engine/boardScanner.ts`). Returns a list of `BoardWord` candidates, each one already ≥ `minimumWordLength` and in the dictionary.
   4. **Cross-validate** and select the best subset (`selectOptimalCombination`, `lib/game-engine/crossValidator.ts`). See §7.2.
   5. **Score** the selected words (letter points + length bonus, excluding opponent-frozen letters from letter points).
   6. **Freeze** the scored tiles, respecting the 24-tile floor (`freezeTiles`, `lib/game-engine/frozenTiles.ts`). Updates `owner` and `scoredAxes`.
3. Aggregate the words, the combo bonus and the delta into the move's result; the finish writes the board, the freeze map, the player's total and move count, and the `word_score_entries` rows in one transaction.
4. Emit structured logs (`word-engine.scoring`, `move.resolved`) with duration, words found, words scored, tiles frozen, `wasPartialFreeze`.

### 7.2 Cross-validation (`selectOptimalCombination`)

Given the list of candidate words for the move:

1. **Enumerate all non-empty subsets** of candidates (2^*n* − 1). *n* is small in practice (a handful of candidates per swap).
2. For each subset, **prune same-axis conflicts** between candidates (`hasNoSameAxisConflict`, §3.5).
3. For each surviving subset, **check per-letter coverage** and **same-axis standalone invariant** (`isSubsetValid`): for each candidate word in the subset, treat *all other subset candidates' tiles* as "extra established" tiles, then apply both `hasCrossWordViolation` (§7.3, cross-axis) and `violatesFrozenAdjacencyOnSameAxis` (§7.4, same-axis).
4. Among subsets that pass, pick the one with the **maximum total score** (letter points + length bonus per word, summed).

There is **no individual pre-filter** before subset enumeration. A candidate's coverage can depend on another candidate from the same move (BÁS in #136 only reaches a length-3 horizontal scored run if BÆN is also in the subset), so pruning a candidate before mutual validation is unsound.

### 7.3 The per-letter check (`hasCrossWordViolation`, cross-axis)

For each tile *t* of a candidate word *W*, in the cross-axis (perpendicular to *W*):

1. Trace backward and forward from *t* through the set `frozenTileSet ∪ extraTileSet` (i.e., existing frozen tiles plus tiles of other candidates in the current subset). `scoredAxes` is **not** consulted.
2. Let *runChars* be the resulting contiguous cross-axis run through *t*. Already-frozen tiles with no new cross-axis adjacency may be skipped because that run is unchanged.
3. Reject if:
   - `runLen == 1` → OK, no constraint.
   - `runLen < minimumWordLength` → **violation** (2-letter runs are always invalid).
   - `runLen ≥ minimumWordLength` and `isWholeRunValid(runChars, dict) == false` → **violation** (the entire scored run is not a dictionary word in either direction).

### 7.4 The same-axis standalone check (`violatesFrozenAdjacencyOnSameAxis`)

A candidate is already a dictionary word, but the **standalone invariant** (§3.5a) must also validate any frozen extensions along its own axis: the candidate must not concatenate with a prior scored word into an invalid combined run.

For a candidate *W* on axis *a*:

1. From *W*'s first tile, step backward along *a* and collect `beforeChars` of contiguous frozen tiles until the trace hits an unfrozen tile or the board edge.
2. Symmetrically collect `afterChars` from *W*'s last tile forward.
3. If both extensions are empty → no adjacency, return OK.
4. Otherwise, build the full run `beforeChars ⧺ W ⧺ afterChars` and accept only if the resulting string (or its reverse), NFC-normalized and lowercased, is in the dictionary.

The check is purely physical — `scoredAxes` is not consulted. The check also uses only `frozenTileSet` (the freeze map as claimed); **same-move candidate tiles are not treated as frozen extensions**. Cross-word interactions between candidates in the same subset are handled by `hasNoSameAxisConflict` (§3.5, same-axis pairs) and by `hasCrossWordViolation` (§7.3, which receives the other candidates' tiles as `extraTileSet`).

In a real game a frozen tile cannot be an "isolated perpendicular scored neighbor" on its axis: a frozen tile was part of a prior ≥ `minimumWordLength` scored word, and the other tiles of that word are also frozen, contiguous, on the same axis as that prior word. An unfrozen adjacent letter (like `Þ` in the real #136) never triggers the check.

### 7.5 The whole-run helper (`isWholeRunValid`)

Returns `true` iff the entire run, NFC-normalized and lowercased, is in the dictionary forward or reversed. At most two dictionary lookups per run; length validation belongs to the caller. Shared by the cross-axis and same-axis checks.

---

## 8. Invariants that must hold after every scoring event

These are board-global post-conditions. A scoring event that would break any of them MUST be rejected *at validation time*. They are also valid assertions to add to tests and observability.

| # | Invariant | Where enforced |
|---|---|---|
| I1 | Every scored letter is part of a dict word of length ≥ `minimumWordLength` in at least one reading direction. | §4, `hasCrossWordViolation` |
| I2 | No contiguous scored run of length 2..(min−1) exists on the board. | §4.2, `hasCrossWordViolation` (below-min branch) |
| I3 | Every maximal contiguous scored run of length ≥ min that contains a newly-frozen tile is itself a dictionary word, read forward or reversed. Valid substrings cannot excuse an invalid full run. | §4.1, `isWholeRunValid` |
| I4 | Every frozen tile's `owner` is one of `player_a`, `player_b`, `both`; never undefined. | `freezeTiles` |
| I5 | The board always has ≥ `MIN_UNFROZEN_TILES` (24) unfrozen tiles. | `freezeTiles` partial-freeze logic |
| I6 | No resolved move ever targets a frozen tile, or a letter that an earlier receipt sequence exchanged; such a move is refused and not counted. | `moveResolver.resolveOne` refusal branch |
| I7 | No two scored words from the same move on the same axis overlap or are physically adjacent. | `hasNoSameAxisConflict` |
| I7a | No newly-scored word is physically adjacent on its own axis to any frozen tile, unless the combined maximal same-axis scored run (new word + frozen extensions on both sides) is itself a dict word. | §3.5a, `violatesFrozenAdjacencyOnSameAxis` |
| I8 | A move is scored against the board and freeze map written by the previous receipt sequence (`match_moves.board_before` / `frozen_before` equal the previous move's `_after`). There is one scoring pass per move. | `claim_next_move` returns the match's live board and map; pinned by `moveResolver.spec.ts` |
| I9 | `matches.resolved_seq` is gap-free and never decreases; `global_seq` is the ordering authority and `received_at` is informational. A finished move is never finished twice. | `finish_move` compare-and-set; `moveResolver.race.test.ts` |
| I10 | `player_x_moves` equals the count of that player's `resolved` rows; a `rejected` row has no per-player sequence. | `finish_move` |

If you add a new scoring-related feature, state which invariant(s) your change affects and which it must continue to uphold. If you find an invariant is missing from this list, add it here and write a test that pins it.

---

## 9. Testing discipline

Tests that exercise scoring live primarily in:

- `tests/unit/lib/game-engine/crossValidator.test.ts`
- `tests/unit/lib/game-engine/wordEngine.test.ts` and `doubleReading.test.ts` (moves resolved in receipt order through `resolveOne`, via `tests/helpers/scoreMoves.ts`)
- `tests/unit/lib/match/moveResolver.spec.ts` (refusal, determinism, repeated words)
- `tests/unit/lib/game-engine/boardScanner.test.ts`
- `tests/unit/lib/game-engine/deltaDetector.test.ts`
- `tests/unit/lib/game-engine/scorer.test.ts`
- `tests/unit/lib/game-engine/frozenTiles.test.ts`
- `tests/integration/moveScoring.test.ts` (per-move scoring against the full dictionary)

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
| 2026-04-24 | #201 | #200 | Deleting `violatesFrozenAdjacencyOnSameAxis` in #198 lost the cross-round enforcement of the standalone invariant. The per-letter rule is trivially satisfied on the candidate's own axis (the candidate *is* a covering sub-run), so a new dict word could be placed physically adjacent to a frozen tile — producing invalid visual runs like `ÖRLTEL` (`ÖRL` + `TEL`), `NMÚL` (`N` + `MÚL`), `ÞESSINÓK` (`ÞESSI` + `NÓK`), `NEFÞEMA` (`NEF` + `ÞEMA`), and `SMÁD` (`SMÁ` + `D`). Fixed by restoring the same-axis check as a sibling to `hasCrossWordViolation`, purely physical: any frozen tile abutting the candidate on its axis triggers the check; the maximal combined same-axis scored run must itself be a dict word. Real #136 is preserved because the adjacent `Þ` in that screenshot is **unfrozen** — an unfrozen neighbor never triggers the rule. (Earlier formulations of the spec's #136 example claimed `Þ` was frozen with `scoredAxes = ["vertical"]`; that was incorrect and has been removed.) | §3.5a and I7a — the cross-round standalone invariant, enforced by `violatesFrozenAdjacencyOnSameAxis`. |
| 2026-04-25 | TBD | #210 | Not a scoring regression — a flow change. Inverted the prior submission-visibility rule (§2): the opponent's swap now broadcasts immediately on submit and animates on the other player's board (FLIP movement). Server-side state and FCFS conflict resolution are unchanged; the locally-applied swap may be reverted at round-end via `applySnapshot` if the server drops it as a conflict. | §2 — submission visibility paragraph. |
| 2026-06-09 | TBD | O-57 (spec 042) | Not a scoring regression — a scoring-pipeline extension. Added the `instantScoreFirstSubmission` fast path that runs in `submitMove`'s `after()` hook: when the first submission scores words it persists `word_score_entries` + `matches.frozen_tiles` and broadcasts a `partialSummary` before `advanceRound` ever fires. The combined-path delete-then-insert in `executeScoringPipeline` is now load-bearing for a second invariant (idempotency between fast-path and combined-path word counts); see the comment in `app/actions/match/publishRoundSummary.ts` and data-model.md § 4.7 before weakening it. The race-window guard (two pending submissions ⇒ defer to combined) and the zero-score branch (silently return without broadcast) keep the fast path safe under contention and zero-cost for the most common round outcome. | §2 — submission visibility paragraph (instant scoring reveal). |
| 2026-06-09 | TBD | spec 042 follow-up | The fast path merged the first mover's freezes into `matches.frozen_tiles` mid-`collecting`, and `advanceRound`'s combined pass then fed that polluted map back into `processRoundScoring` as the scoring baseline. The frozen-coordinate guard rejected the first mover's *own* swap, the delete-then-insert wiped their `word_score_entries` rows without re-creating them, and the swap was dropped from `finalBoard` — violating data-model.md § 4.7. Fixed by snapshotting the round-start freeze map in `rounds.frozen_tiles_before` (mirroring `board_snapshot_before`); both scoring passes now score against that baseline, while `submitMove`'s frozen-tile rejection gate still reads the live `matches.frozen_tiles` (FR-014). Regression tests: `tests/unit/lib/match/roundEngine.frozenTilesBaseline.test.ts`, `tests/unit/match/instantScoring.frozenBaseline.spec.ts`. | §8 invariant: both scoring passes for a round share the round-start freeze baseline (`rounds.frozen_tiles_before`). |

| 2026-06-10 | TBD | O-71 (O-58/O-70 related) | The fast path's 500 ms `Promise.race` budget was below a cold serverless dictionary load (1.3–4 s; "once per process lifetime" is every lambda instance on Vercel), so in production the race always timed out and the instant scoring reveal never fired. Worse, `Promise.race` does not cancel the losing branch: the timed-out run kept executing detached, froze at instance suspend, and on thaw could run `executeScoringPipeline`'s delete-then-insert against a round the combined path had already resolved — wiping both players' canonical `word_score_entries` and re-inserting only the first mover's. Fixed by raising the budget to 5 s, warming the dictionary before scoring, and re-reading `rounds.state` immediately before `computeWordScoresForRound` (defer unless still `collecting`). Regression tests: `tests/unit/match/instantScoring.coldStartBudget.spec.ts`. | §8 invariant: only the combined path may write a resolved round's `word_score_entries`; the fast path writes only while the round is `collecting`. |
| 2026-09-20 | spec 049 | — | Not a scoring regression — a serving bug. Once a match completed, `matches.current_round` was 11, no round 11 existed, and `loadMatchState`'s `ensureBoardSnapshot` silently regenerated the board from the seed, so every finished match showed its **starting** letters under ten rounds of correct bands and freezes (seen live 2026-09-20 as `ÞKHL`, `GÁAAT`, `DUT`, `ÝGRR`). Fixed by serving a completed match from its last played round and never regenerating a board for a match that has rounds. Regression test: `tests/unit/lib/match/stateLoader.lastPlayed.spec.ts`. | Invariant: the room shows the last played round's board; a missing round row is a fault, never a fresh board. |
| 2026-09-20 | spec 049 | — | `advanceRound` step 14 updated the match row by id alone, so a thawed `after()` hook from round 5 landed two minutes after the match completed and wrote round-5 values over it (`current_round` 6, stale clocks). Fixed with a compare-and-set on the round the writer read and on the match not being completed. Regression test: `tests/unit/lib/match/roundEngine.staleWrite.spec.ts`. | Invariant: the round pointer, clocks, state, winner and reason never move backwards. |
| 2026-09-21 | spec 050 | — | Not a regression — a rules change. Rounds are gone: each player makes ten moves whenever they like on one shared 5:00 clock; moves resolve one at a time in server receipt order; a move landing on a letter an earlier move froze or exchanged is refused and not counted. §2, §2a, §7.1 and I6/I8 rewritten; I9/I10 added. Duplicate suppression (§3.7, §5.4) withdrawn — it had never been implemented (`is_duplicate` was written `false` unconditionally). The instant-scoring fast path, the combined pass, the timeout pass and the round-start baseline (`rounds.frozen_tiles_before`) no longer exist; their regression rows above are history. | §2 (receipt order, refusal), §2a (one clock, deadline at receipt), I8–I10. | <!-- retired-name -->
| 2026-09-14 | spec 044 | — | Not a regression: pinned the §3.5a design example `BORÐA + GILT` (rejected when `borðagilt` is not a word; accepted when it is) and §3.1 one-record-per-run (`FÁR`/`RÁF` → one record, forward reading) so the Field & Ledger UI's "bands never touch end to end" and "one chevron per band" renderings have named tests. | §3.5a, §3.1 (`tests/unit/lib/game-engine/wholeRun.bordaGilt.test.ts`, `doubleReading.test.ts`). |
| 2026-09-21 | — | HAUSL screenshot | Cross-axis substring coverage accepted the L of a vertical word beside frozen HAUS because USL is in the dictionary, leaving the invalid scored run HAUSL; require the entire affected cross-run to be a word in either direction. Tests cover all four orientations, same-event candidates, and scoring/freezing with the real dictionary (`wholeRun.hausl.test.ts`). | §4, §7.3, I3 — whole-run validity on both axes. |

When you land a scoring-related fix, append a row here with: date, PR number, issue number, one-sentence description of what went wrong, and the rule section that now prevents it. If the fix exposes a rule that was not previously documented, document it in this file *in the same PR*.

---

## 11. Code references

- **Rules surface** — this document is the source of truth; `lib/constants/game-config.ts` holds the numeric constants (`minimumWordLength`, `boardSize`, `language`); the move limit and the clock are `matches.move_limit` and `matches.deadline_at`.
- **Pipeline entry point** — `lib/match/moveResolver.ts::resolveOne` (one move, pure); `resolvePendingMoves` claims and finishes moves in receipt order; the per-word formula is `lib/game-engine/wordEngine.ts::scoreBoardWords`.
- **Scanner** — `lib/game-engine/boardScanner.ts::scanFromSwapCoordinates`.
- **Reading direction (§3.1, §12)** — `lib/game-engine/readingDirection.ts::deriveReadingDirection` derives ltr / rtl / ttb / btt from the stored tile order of a word record; `lib/match/wordScoreRow.ts` maps `word_score_entries` rows to `WordScore` (with `direction`) for the ledger and the field bands.
- **Board generation** — `lib/game-engine/boardGenerator.ts::generateBoard` (seeded; also the lobby's warm-up field and the queue's placeholder field).
- **Preview pricing (§12, pick → preview → commit)** — `app/actions/match/previewSwap.ts` runs the same pipeline read-only for one hypothetical swap (`kind: "match" | "warmup"`, session required, no state change); the dictionary never leaves the server.
- **Cross-validator** — `lib/game-engine/crossValidator.ts::selectOptimalCombination`, `hasCrossWordViolation` (cross-axis, §7.3), `violatesFrozenAdjacencyOnSameAxis` (same-axis standalone, §7.4), `isWholeRunValid`.
- **Scorer** — `lib/game-engine/scorer.ts::calculateLetterPoints`, `calculateLengthBonus`.
- **Freezer** — `lib/game-engine/frozenTiles.ts::freezeTiles`.
- **Dictionary** — `lib/game-engine/dictionary.ts::loadDictionary`; wordlist at `data/wordlists/word_list_is.txt`.
- **Letter values** — `lib/game-engine/letter-values/letter_scoring_values_<lang>.ts`.
- **Move orchestration** — `lib/match/moveResolver.ts::resolvePendingMoves` (claim → `resolveOne` → finish), `lib/match/matchSettlement.ts::settleMatchIfDue`, `lib/match/resultCalculator.ts::determineMatchWinner`; the Postgres functions `receive_move`, `claim_next_move`, `finish_move` (`supabase/migrations/20260921001_async_moves.sql`).
- **Older narrative (superseded)** — `docs/archive/notes/260303-word-scoring-rules.md`. Kept for history; always prefer this document.

---

## 12. What the player sees

The Field & Ledger design (`docs/design_documentation/README.md`) renders each rule above as exactly one mark. This table is the contract between the rules and the UI; a rendering that needs a second mark for the same fact is a design bug.

| Rule | Rendering |
| --- | --- |
| A scored word (§3, §6) | A **band** along its tiles on the field: a 14% tint of the scorer's seat colour (teal = you, coral = the opponent), square ends aligned to the cell grid, with the letters inside drawn in the scorer's colour. |
| Reading direction (§3.1) | A small **chevron** in the scorer's colour at the end of the band where reading **begins**: left edge pointing right (left-to-right), right edge pointing left (right-to-left), top edge pointing down (top-to-bottom), bottom edge pointing up (bottom-to-top). |
| Run valid both ways (§3.1) | One record, one band, **one chevron** at the kept reading's start (forward reading wins); one word in the ledger row. |
| A tile in two words / crossing (§3.5, §4) | Both words are recorded; the crossing letter keeps the colour of the player who froze it first; each word's band shades the whole word, so the later word's band runs under that letter too (spec 049, amended 2026-09-21). |
| Standalone / whole-run rule (§3.5a) | Two bands of the same seat on the same axis **never touch end to end**; a legal extension of a frozen run is a single longer word and a single band. |
| Frozen tile (§6) | The letter sits inside a settled band and cannot be picked; tapping it shakes the letter 300ms in its own colour and the ledger's live row reads `frozen · <name> M<n> · pick another`. |
| Territory (§6) | A 4px bar in the ledger — you / free / opponent — with the three counts beneath it. Territory is stored per tile but shown as words. |
| A move, committed and resolved (§2) | Nothing is pinned: a committed move resolves at once. Your two letters exchange in place on commit; the opponent's exchange on your field the moment their resolution lands. The field's frame returns to ink from commit until your own reveal has held. |
| A move refused (§2) | The two letters return; the live row reads `frozen · Kári just froze it · pick another` or `moved · Kári just moved it · pick another` for two seconds; the move count is unchanged. |
| The opponent's move on your field (§2) | Their letters exchange and their bands draw at 30% while you pick; nothing locks. A pick on a letter they exchanged or froze clears with `pick cleared · Kári moved that letter`. |
| Clock (§2a) | Once, as the ledger clock at the head of the ledger: a boxed `3:12` over a bar that drains. Under 1:00 it takes the tint and a heavier numeral; in the last 15 seconds it flashes inverted once a second and reads `last 12s`; at 0:00 it holds inverted and reads `time`. The bars carry no clock. |
| Moves and progression (§2) | In the ledger: the caption `move 4 of 10` (the viewer's next move), the **move rail** (ten cells under the caption counting the viewer's moves: played filled ink, the next tinted and framed, the rest outlined), and ten rows indexed by move number — your Nth move in your column, theirs in theirs — with your next open move as the tinted **live row** whose first line names the beat (`move 4 · your move`, `move 4 · scoring`, `move 4 scored`, `10 of 10 played`, `time · scoring`). Each bar's lane is that player's moves 0–10 in the seat colour and its sub-line carries the count (`move 4 of 10`, `6 of 10 · playing`, `6 of 10 · scoring`, `10 of 10 · done`). |
| Whose move it is (§2) | The field's frame is a 3px outline in the viewer's seat colour while a move is theirs to make; it is ink while their move is in flight, revealing or holding, and once they have ten. |
| A move closes (§2, §5) | After your reveal the scored row holds 600ms (`move 4 scored` over `you +13 · move 5 opens`) before the next live row opens; the field takes no pick meanwhile. The opponent's reveal never holds your field. |
| Scoring (§5) | Written into the row as each band lands (`word · points`), the move's points pinned top right of its cell, match totals counting up in the bars. A resolved move with no word writes `0`. |
| Repeated word (§3.7) | Scored and drawn like any other; nothing marks it. |
| Reconnection window | The disconnected player's lane becomes a dashed pattern; their sub-line counts `reconnecting · 0:42 left`. The clock keeps running. When the window is spent and the viewer has ten moves, a **slip** offers `Kári is gone` · `Kári 8 of 10 · 0:00 left to reconnect` · `end the match ▸` · `keep waiting ▸`; otherwise nothing is offered. |
| Match over (§2a, §5.5) | A slip over the field, 600ms after the final reveal has held: `Kári wins` in the winner's ink (`draw` in ink), both totals, the detail line, both rating lines, then `rematch ▸` · `new opponent ▸` · `review the field ▸` · `lobby`. The label counts the match: `match over · 4:52`. The ledger keeps the verdict beneath it. |
| Why it ended (§2a) | The detail line says what decided it, once: `by 46 points · 10 words to 8 · territory 27–21` (both finished), `Kári played 8 of 10` (`incomplete`), `neither finished` (`both_incomplete`), `Kári resigned`, `Kári left`. |
| Resigning | A slip: `Resign the match?` with the viewer's move count and the clock (`move 4 of 10 · 3:12 left`), `yes, resign ▸` · `keep playing ▸`; the clock keeps running. |
| Every match is rated | No caption or state says otherwise; a rating line reads `rating pending` until the row is written. |
| Which board the room shows | `matches.board`, the live board written by every resolved move; a finished match keeps the board its last resolved move left. The starting board is generated once, at match start (spec 049's regeneration fault cannot recur: there is no round to look up). |

