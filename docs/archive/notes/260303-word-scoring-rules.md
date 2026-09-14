***

> **⚠️ SUPERSEDED — March 2026 narrative, kept for history.**
>
> The authoritative scoring specification is now **[`docs/prd_and_requirements/wottle_game_rules.md`](../prd_and_requirements/wottle_game_rules.md)**. That document includes the per-letter coverage rule (§4, introduced in PR #198 / issue #195), the enforcement algorithm (§7), the board invariants (§8), and the regression log (§10).
>
> This note predates the per-letter coverage rule and the PR #185/#195 sequence. Do not use it as a reference for code changes; use the spec. Details below are retained only so the reasoning in old issues still makes sense.

---

# Word Scoring Rules (As Implemented, circa 2026-03-03)

This document describes **how words are scored in Wottle** based on the implementation as of March 2026. It is aimed at humans who need to understand the rules and verify behavior. For the formal specification, see `specs/003-word-engine-scoring/spec.md`.

---

## 1. When Does Scoring Happen?

Scoring runs **once per round**, after both players’ swaps have been applied (or after timeouts/void moves). The system compares the **final board** (after all accepted swaps) to the **board at the start of the round**. Only words that are **new** in that comparison are considered for scoring. Words that were already on the board before any swap in the round do not score.

- If **no moves were accepted** in the round, no words are scored and both players get 0 for the round.
- If the **board did not change** (e.g. both moves were void or rejected), the scoring pipeline is skipped and both players get 0.

---

## 2. Which Words Count?

A word is eligible to be scored only if it meets all of the following:

- **New this round**: It appears on the board after the round’s swaps but did not appear in the same form on the pre-round board (delta detection).
- **Direction**: It is read in one of the **four orthogonal directions**: left-to-right, right-to-left, top-to-bottom, or bottom-to-top. **Diagonal words are not scored** (they are found by the scanner but filtered out before scoring).
- **Length**: At least **3 letters**, in a single contiguous line (no gaps, no wrapping at board edges).
- **Dictionary**: The sequence is in the game’s Icelandic dictionary (case-insensitive, NFC-normalized). The dictionary is the full inflected word list (~2.76M entries).
- **Attribution**: The word is attributed to a player whose move was **accepted** this round. Player A’s words are those that appear after Player A’s swap(s) but not on the pre-round board; Player B’s words are those that appear after both swaps but not after only Player A’s swap(s).
- **Cross-word rules**: At every tile where the word meets other “established” tiles (same-round opponent words or previously frozen tiles), the perpendicular sequence must also be a valid dictionary word of length ≥ 3 (or the word is rejected). If the word extends in its own direction through established tiles, that longer sequence must be a valid dictionary word (or the word is rejected).
- **Longest word in a run**: If the same tile run contains a shorter and a longer valid word (e.g. "ABC" and "ABCD"), only the **longest** word scores.
- **Suffix/overlap**: If two overlapping words share tiles and their union span is not a valid dictionary word, only the word that starts earlier in reading order scores; the other is suppressed.

Words that pass these checks are **attributed** to one player and passed to the scoring step.

---

## 3. How Is a Single Word Scored?

For each attributed word, the game computes:

### 3.1 Letter points

- Each letter has a point value from the **Icelandic letter table** (e.g. A=1, Á=4, Ð=2, X=10). The table is in `docs/wordlist/letter_scoring_values_is.ts`.
- **Letter points for the word** = sum of the values of the letters in the word.
- **Important**: If the word includes tiles that are **frozen by the opponent** (from a previous round), those letters **do not** count toward the sum. Only the letters on tiles that are either unfrozen or frozen by the scoring player (or “both”) are summed. So a word that spans your tiles and the opponent’s frozen tiles gets **partial letter points** (only your letters), but the word still scores.

### 3.2 Length bonus

- **Length bonus** = (word length − 2) × 5.
- Word length is the **full** number of letters in the word (including any opponent-frozen tiles in the run). So a 6-letter word always gets (6−2)×5 = 20 length bonus, even if some of those letters did not count for letter points.

### 3.3 Duplicates (same word text again)

- Each **word text** (same spelling, normalized lowercase) may score **at most once per player per match**. If this player has already scored that word text in an earlier round of the same match, the word is marked as a **duplicate** and:
  - **Total points for that word = 0.**
  - The word still appears in the round summary with a “previously scored” style label.
  - It **does not** count toward the multi-word combo bonus (see below).
- Duplicate tracking is **per player**: if Player A has already scored "HESTUR", Player B can still score "HESTUR" in a later round for full points.

### 3.4 Per-word total

- **Total for the word** = letter points + length bonus, **or** 0 if the word is a duplicate for that player.

---

## 4. Multi-Word Combo Bonus

In a single round, if a player scores **more than one non-duplicate word**, they get an extra **combo bonus** added once per round (not per word):

| Non-duplicate words this round | Combo bonus   |
|--------------------------------|---------------|
| 1                              | +0            |
| 2                              | +2            |
| 3                              | +5            |
| 4 or more                      | +7 + (n − 4)  |

Here **n** = number of **non-duplicate** words the player scored this round. Duplicate words (same word text already scored by that player in a prior round) do **not** count toward n.

---

## 5. Round Score (Delta) and Totals

- **Round score (delta) for a player** = sum of **total points** of all their **non-duplicate** words this round **plus** their combo bonus.
- **Cumulative match total** = previous total + this round’s delta.

Duplicate words contribute 0 to the delta and do not affect the combo count.

---

## 6. After Scoring: Frozen Tiles

- All tiles that belong to any scored word are **frozen** (cannot be swapped in later rounds).
- Each frozen tile is marked as owned by the player who scored the word that used it. If both players scored words that use the same tile in the same round, that tile is marked as **both**.
- There is a **minimum of 24 unfrozen tiles** on the board. If freezing all tiles of the new words would leave fewer than 24 unfrozen, only some of the new word tiles are frozen (in a deterministic order); the words still score their full points.

---

## 7. Summary of the Rules (Quick Reference)

1. Only **new** words (present after the round’s swaps, not before) score.
2. Only **orthogonal** directions (horizontal and vertical, both reading directions); **no diagonals**.
3. **Letter points** = sum of Icelandic letter values for the word; letters on **opponent-frozen** tiles in that word do **not** count.
4. **Length bonus** = (length − 2) × 5, using the full word length.
5. **Duplicate** = same word text already scored by that player earlier in the match → 0 points, no combo count.
6. **Combo bonus** = +0 / +2 / +5 / +7+(n−4) for 1 / 2 / 3 / 4+ **non-duplicate** words in the round.
7. **Round delta** = sum of per-word totals (excluding duplicates) + combo bonus.
8. Tiles of scored words are **frozen**, with a 24-unfrozen minimum.

---

## 8. Divergences from Spec (003-word-engine-scoring)

These are the main differences between the **current implementation** and the **written specification** in `specs/003-word-engine-scoring/spec.md`. They are listed for remediation, not as part of the “rules” above.

| Spec reference | Spec intent | Current behavior |
| --- | --- | --- |
| **FR-004** (8 directions) | Words in **all 8 directions** (including 4 diagonals) should be found and scored. | Scanner finds 8 directions; delta step keeps only 4 orthogonal. **Diagonal words are never scored.** |
| **FR-006a** (opponent-frozen tiles) | A word that **contains any opponent-frozen tile** is **not valid** for that player and **does not score**. | The implementation **allows** the word to score but gives **partial letter points** (only the player’s own tiles count). Length bonus still uses the full word length. So words spanning opponent-frozen tiles **do** score, with reduced letter points. |
| **FR-010** (palindrome) | Same tiles in two directions = **one word**, score once. | No tile-set deduplication; same tiles in two directions may be scored separately (**double-count**). |
| **Letter table / unknown chars** | Spec references “Icelandic letter scoring table” only. | Any character **not** in the letter table is assigned **1 point** (see `scorer.ts`: `LETTER_SCORING_VALUES_IS[upper] ?? 1`). Spec does not define behavior for unknown characters. |

Fixing these would require code and/or spec changes and should be done in line with product intent (see also `specs/003-word-engine-scoring/analysis-report.md` for historical notes and option A/B on duplicate semantics).
