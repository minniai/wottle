# Wottle — Word Scoring Rules

**Document type:** Human-readable reference  
**Last analysed:** 2026-03-03  
**Sources:** `specs/003-word-engine-scoring/spec.md`, `specs/009-game-rules-config/spec.md`, `docs/prd_and_requirements/wottle_prd.md`, `lib/game-engine/scorer.ts`, `lib/game-engine/wordEngine.ts`, `lib/game-engine/deltaDetector.ts`, `lib/game-engine/boardScanner.ts`, `docs/wordlist/letter_scoring_values_is.ts`

---

## Overview

Scoring in Wottle happens **server-side, once per round**, after both players have submitted their tile swaps. The engine finds every *new* valid Icelandic word that was created by those swaps, scores each one, applies bonuses, and updates each player's total.

---

## Step 1 — Finding Words

### Which directions count?

Words are found in **four orthogonal directions only**:

| Direction | Description |
|-----------|-------------|
| → Right | Left-to-right across a row |
| ← Left | Right-to-left across a row |
| ↓ Down | Top-to-bottom down a column |
| ↑ Up | Bottom-to-top up a column |

> **Diagonals do not score.** This was changed from the original design (which allowed all 8 directions) to bring the game in line with Scrabble-style rules.

> **Both readings of the same tile run can score independently.** If a sequence of tiles reads as a valid word left-to-right *and* as a different valid word right-to-left, both words score separately.

### What makes a word valid?

A word must satisfy **all** of the following:

1. **Minimum length:** 3 or more letters.
2. **Contiguous:** Every letter must occupy adjacent tiles in a straight line with no gaps or blank tiles in between.
3. **No edge-wrapping:** A word cannot continue from one side of the board to the other.
4. **In the dictionary:** The letter sequence must appear in the full Icelandic inflected word list (~2.76 million entries). Matching is case-insensitive and Unicode NFC-normalised (so "Þ" and "þ" are the same letter, but "Þ" and "D" are not — Icelandic special characters are distinct).
5. **Valid cross-words (Scrabble rule):** When a new word is placed adjacent to existing frozen tiles, every perpendicular sequence formed at the junctions must *also* be a valid dictionary word of 3+ letters. A move is rejected entirely if any cross-sequence is invalid.
6. **Valid extensions:** If a new word is placed immediately beside frozen tiles *along the same direction*, the combined extended sequence must also be a valid dictionary word. Otherwise the shorter word is rejected.

---

## Step 2 — Only New Words Score (Delta Detection)

The engine does **not** score pre-existing words. It compares the board state before and after each round to find only newly formed words.

The attribution process works in two passes:

1. **Player A's words** — The engine applies Player A's swap to the pre-round board and finds all words that weren't there before. These are attributed to Player A.
2. **Player B's words** — Starting from the intermediate state, the engine applies Player B's swap and finds all additional new words. These are attributed to Player B.

Words already present before the round contribute nothing, regardless of how long they have existed.

### Frozen tile rules during detection

| Tile type | Can be part of a word? |
|-----------|------------------------|
| Player's own frozen tiles | ✅ Yes |
| Tiles frozen by "both" players | ✅ Yes (for either player) |
| Opponent's frozen tiles | ❌ No — any word candidate containing the opponent's frozen tiles is rejected |

---

## Step 3 — Scoring Each Word

Every word that passes the above checks is scored with two components:

### Letter Points

Each letter in the word has a point value. **Only letters contributed by the scoring player count.** If the word spans the opponent's frozen tiles, those tiles are excluded from the letter point total (but see Length Bonus below).

Tiles frozen by "both" players count as the scoring player's own — they are not excluded.

#### Icelandic Letter Values (Krafla Distribution)

| Points | Letters |
|--------|---------|
| 1 | A, R, I, N, S |
| 2 | T, U, L, Ð, K, M |
| 3 | E, F, G, Á, Ó |
| 4 | Æ, H, Í, Ú |
| 5 | B, D, O, P, V, Ý |
| 6 | J, Y |
| 7 | Ö, É, Þ |
| 10 | X |

> These are the official Krafla values, sanctioned by Iceland's Scrabble clubs and used by Netskrafl (netskrafl.is) since 2016.

### Length Bonus

Every valid word earns a length bonus regardless of tile ownership:

```
Length Bonus = (word_length − 2) × 5
```

| Word length | Length Bonus |
|-------------|-------------|
| 3 letters | 5 pts |
| 4 letters | 10 pts |
| 5 letters | 15 pts |
| 6 letters | 20 pts |
| 7 letters | 25 pts |
| 8 letters | 30 pts |

This bonus is always calculated on the **full word length**, even when some tiles belong to the opponent.

### Total per word

```
Word Total = Letter Points (own tiles only) + Length Bonus (full length)
```

---

## Step 4 — Combo Bonus (per round, per player)

After all words are scored, a multi-word combo bonus is added to each player's round total based on how many *new* (non-duplicate) words they scored that round:

| New words scored | Combo Bonus |
|-----------------|-------------|
| 1 | +0 |
| 2 | +2 |
| 3 | +5 |
| 4 | +7 |
| 5 | +8 |
| 6 | +9 |
| n (n ≥ 4) | +7 + (n − 4) |

Previously-scored duplicate words (see below) do **not** count toward the combo.

---

## Step 5 — Duplicate Words

Each unique word text can score **at most once per player per match**.

- If a player forms a word they've already scored in an earlier round, it is marked **"previously scored"** and awards **0 points** for that player.
- Duplicate words also **do not count** toward the combo bonus.
- Each player tracks their own history independently — if Player B forms a word that Player A has already scored, Player B still receives full points.

---

## Step 6 — Round Total

```
Round Score (Player) = Σ(word totals, non-duplicates) + Combo Bonus
```

The combo bonus and per-word breakdowns are persisted as part of the round record, so scoring history is always reproducible from stored data.

---

## Worked Examples

### Example A — Single 6-letter word: "HESTUR" (horse)

| Letter | Value |
|--------|-------|
| H | 4 |
| E | 3 |
| S | 1 |
| T | 2 |
| U | 2 |
| R | 1 |
| **Letter Points** | **13** |

Length Bonus: (6 − 2) × 5 = **20**  
Word Total: 13 + 20 = **33 pts**  
Combo (1 word): +0  
**Round Score: 33 pts**

---

### Example B — Two words in one round: "HÚS" (house) + "LAND" (land)

**HÚS** (3 letters): H=4, Ú=4, S=1 → Letter Points = 9 · Length Bonus = (3−2)×5 = 5 · Total = **14 pts**

**LAND** (4 letters): L=2, A=1, N=1, D=5 → Letter Points = 9 · Length Bonus = (4−2)×5 = 10 · Total = **19 pts**

Combo (2 new words): +**2**  
**Round Score: 14 + 19 + 2 = 35 pts**

---

### Example C — Extending an opponent's frozen word

Player A has the frozen word "TAÐI" at row 1, columns 3–6.  
Player B swaps tiles so that "RA" appears at columns 1–2, forming the 6-letter word **"RATAÐI"**.

| Tiles | Owner | Count toward B's letter points? |
|-------|-------|----------------------------------|
| R, A | Player B | ✅ Yes |
| T, A, Ð, I | Player A (frozen) | ❌ No |

Letter Points for B: R=1 + A=1 = **2**  
Length Bonus: (6 − 2) × 5 = **20** (full word length)  
Word Total: 2 + 20 = **22 pts**

---

## Discrepancies Found Between Spec and Current Implementation

The following issues were identified during analysis. They are documented here as known gaps:

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | `minimumWordLength` is set to **2** in `game-config.ts` but the spec and board scanner both enforce **3**. The scanner hardcodes 3, but cross-word validation in `deltaDetector.ts` uses the config value (2), meaning a 2-letter cross-sequence would not trigger a violation when it should. | `lib/constants/game-config.ts` | Cross-word validation could accept invalid 2-letter adjacencies |
| 2 | `maxRounds` is set to **5** in `game-config.ts` but the spec and PRD both specify **10 rounds** per player. | `lib/constants/game-config.ts` | Matches end after 5 rounds instead of 10 |
| 3 | `calculateMoveScore()` in `scorer.ts` does not exclude opponent-frozen tile letters and does not apply the combo bonus. If used anywhere for scoring display, it will report inflated letter points and a missing combo bonus. | `lib/game-engine/scorer.ts` | Incorrect score previews if this function is used for display |
| 4 | `allowedDirections` in `game-config.ts` is set to `['horizontal', 'vertical']` — 2 values, when the engine actually scores 4 orthogonal directions (right, left, down, up). The field is not enforced (per spec 009 FR-001), so there is no runtime effect, but the value is misleading. | `lib/constants/game-config.ts` | No runtime impact; documentation/config confusion only |
| 5 | The sub-word suppression rule ("only the longest word in a tile run scores") is correctly implemented in `deltaDetector.ts`, but is **not documented** in the PRD or spec 003. Players have no way to know that "BAT" won't score if it's contained within the larger word "BATINN". | Docs gap | Player confusion |

---

## Summary of the Full Scoring Formula

```
Round Score =
  Σ over all new, non-duplicate words {
    [sum of letter values for own tiles only]
    + [(word_length − 2) × 5]
  }
  + combo_bonus(count of non-duplicate words)
```

Where:
- **own tiles** = all tiles in the word except those frozen exclusively by the opponent
- **word_length** = total letters in the word, including opponent-frozen tiles
- **combo_bonus** = 0 / 2 / 5 / 7+(n−4) for 1 / 2 / 3 / 4+ words
