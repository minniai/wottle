# Research: Word Engine & Scoring

**Feature Branch**: `003-word-engine-scoring`
**Date**: 2026-02-14

## R1: Dictionary Data Structure

### Decision: `Set<string>` with NFC-normalized lowercase keys

### Rationale

The dictionary (~2.76M entries) needs two operations: **exact match** ("is this a valid word?") and **prefix check** ("could this sequence start a valid word?"). A Trie provides both natively but has significant memory overhead for 2.76M entries in JavaScript (estimated 1-4GB due to per-node object overhead). A `Set<string>` provides O(1) exact match with lower memory (~300-400MB).

For a 10×10 board, the total number of candidate sequences to check is bounded:

- Per direction: at most 10 lines × 36 subsequences (lengths 3-10) = 360
- 8 directions = ~2,880 lookups maximum per scan
- At ~0.001ms per Set lookup, total scan: **~3ms** (well within 50ms SLA)

Prefix pruning would reduce unnecessary lookups but isn't required given the small board size. The optimization headroom is large enough that a Set-based approach is safe for the playtest milestone.

### Alternatives Considered

| Option                       | Pros                                         | Cons                                               | Verdict                                           |
| ---------------------------- | -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| **Set\<string\>**            | Simple, O(1) lookup, low implementation risk | No prefix pruning, ~300-400MB memory               | **Selected** — meets SLAs with margin             |
| **Trie (Map children)**      | Natural prefix pruning, elegant API          | ~1-4GB memory in JS, complex build, slow load      | Rejected — memory risk too high for 2.76M entries |
| **Trie (array children)**    | Fixed-size nodes, cache-friendly             | 32-element arrays × millions of nodes → still >1GB | Rejected — same memory concern                    |
| **DAWG (packed)**            | Minimal memory (shares suffixes)             | Complex to build, no off-the-shelf JS impl         | Rejected — over-engineering for playtest          |
| **Pre-compiled binary Trie** | Fast load from binary, small memory          | Custom binary format, two-step build process       | Deferred — optimization path if Set too slow      |

### Performance Estimates

- **Load time**: Streaming ~2.76M lines → NFC normalize → lowercase → Set.add = estimated 100-180ms (within 200ms SLA)
- **Memory**: 2.76M strings × ~120 bytes avg (string + Set overhead) ≈ 330MB
- **Lookup**: O(1) amortized per call, ~0.001ms per lookup
- **Total scan**: ~2,880 lookups × 0.001ms = ~3ms

### Mitigation: If Set Load Exceeds 200ms

1. **Pre-process**: Convert `word_list_is.txt` to a pre-normalized, pre-lowercased file at build time
2. **Streaming load**: Use `readline` with `createReadStream` to avoid loading entire file into memory as a single string
3. **Lazy init**: Load dictionary on first request rather than server startup; cache for subsequent requests
4. **Last resort**: Switch to packed Trie or binary format

## R2: Board Scanning Algorithm

### Decision: Directional ray-casting from every cell, 4 canonical directions

### Rationale

A 10×10 board has 100 cells. For each cell, we cast rays in 4 canonical directions (right, down, down-right diagonal, down-left diagonal). Each ray extracts all subsequences of length 3+ along that direction. The reverse directions (left, up, etc.) are handled by reading extracted sequences in reverse.

This approach:

- Processes each cell exactly once per direction
- Naturally handles all 8 directions via forward + reverse reading
- Produces a complete set of `BoardWord` candidates for dictionary validation
- Respects board boundaries (no wrapping per FR-005)

### Algorithm

```txt
For each of 4 canonical directions (→, ↓, ↘, ↙):
  For each starting position along the direction's origin edge:
    Extract the full line of characters
    For each subsequence of length 3 to line_length:
      Forward: check dictionary(subsequence)
      Reverse: check dictionary(reverse(subsequence))
      If valid → create BoardWord with coordinates
```

### Frozen Tile Awareness (FR-006a)

The scanner runs once on the full board (frozen and unfrozen tiles included). After scanning, word candidates are filtered per-player:

- Player A's candidates: exclude any word containing tiles frozen by Player B
- Player B's candidates: exclude any word containing tiles frozen by Player A
- Tiles frozen by both players are valid for both

This post-scan filtering is simpler and more testable than ownership-aware scanning.

### Complexity

- Lines to extract: ~10 per direction × 4 directions = ~40 lines
- Subsequences per line: O(n²) where n ≤ 10, so ≤ 36 per line
- Total candidates: ~40 × 36 = ~1,440 forward + 1,440 reverse = ~2,880
- Dictionary lookups: 2,880 × O(1) = ~3ms
- Coordinate mapping: O(1) per candidate (computed from start + direction + length)

**Total estimated scan time: <5ms** (10× margin on 50ms SLA)

## R3: Delta Detection Strategy

### Decision: Full-scan diff — scan board_before and board_after, compute set difference

### Rationale

Delta detection identifies words that are **new** after the round's swaps. The cleanest approach is:

1. Scan `board_before` → `Set<string>` of existing words (by text + coordinates key)
2. Scan `board_after` → `Set<string>` of all words
3. New words = words in `board_after` not in `board_before`

Using a composite key of `word_text + direction + start_coordinate` uniquely identifies each word instance. This prevents a word at position A from masking a different instance of the same text at position B.

### Why Not Swap-Locality Optimization?

An optimization would scan only sequences that pass through the swapped tile positions. This reduces work but:

- Misses words created by the _combination_ of both players' swaps when tiles are non-adjacent
- Adds complexity to coordinate intersection logic
- The full scan is already ~5ms, so optimization isn't needed

### Word Attribution

After delta detection produces the set of new words on the final board, each word must be attributed to the player whose swap created it:

1. Scan intermediate board (after Player A's swap only) for words
2. Words in intermediate scan but not in board_before → attributed to Player A
3. Words in board_after but not in intermediate scan (and not in board_before) → attributed to Player B
4. Words in both intermediate and final (and not in board_before) → attributed to Player A (created by their swap, survived Player B's swap)

This requires 3 scans total: board_before, board_after_A, board_after_AB. At ~5ms per scan, total = ~15ms. Still within 50ms SLA.

### Alternative: Per-move scanning

Scan after each individual swap application:

- Scan board_before → words_before
- Apply Player A's swap → scan → words_after_A → new_words_A = diff
- Apply Player B's swap → scan → words_after_AB → new_words_B = diff(words_after_AB, words_after_A) ∪ diff if not in words_before

This is equivalent to the 3-scan approach above but with different framing. The implementation is identical.

## R4: Scoring Formula Alignment

### Decision: Replace existing `calculateWordScore()` with PRD-compliant formula

### Current Implementation (BROKEN)

```typescript
// lib/scoring/roundSummary.ts — current formula
if (length < 4) bonus = 0;
else if (length <= 5) bonus = length - 3;
else bonus = (length - 5) * 2;
```

### PRD-Compliant Formula

```typescript
base_score = sum(letter_values[char] for char in word)
length_bonus = (word_length - 2) * 5
combo_bonus = { 1: 0, 2: 2, 3: 5, 4+: 7 + (n - 4) }
total_word_score = base_score + length_bonus
round_score = sum(total_word_score for each new word) + combo_bonus
```

### Scoring Examples

| Word       | Letters                      | Letter Sum | Length Bonus | Word Total |
| ---------- | ---------------------------- | ---------- | ------------ | ---------- |
| BÚR (3)    | B=4, Ú=7, R=1                | 12         | (3-2)×5 = 5  | 17         |
| LAND (4)   | L=1, A=1, N=1, D=3           | 6          | (4-2)×5 = 10 | 16         |
| HESTUR (6) | H=3, E=2, S=1, T=1, U=1, R=1 | 9          | (6-2)×5 = 20 | 29         |

| Combo   | Words | Bonus |
| ------- | ----- | ----- |
| 1 word  | —     | +0    |
| 2 words | —     | +2    |
| 3 words | —     | +5    |
| 4 words | —     | +7    |
| 5 words | —     | +8    |
| 6 words | —     | +9    |

### Duplicate Handling

Per FR-010, a word already scored by the same player in a previous round:

- Is listed in the round summary with "previously scored" label
- Awards 0 points (letter + length bonus zeroed)
- Does NOT count toward the combo bonus word count

## R5: Frozen Tile Storage

### Decision: JSONB column `frozen_tiles` on `matches` table

### Rationale

Frozen tiles are a match-level persistent state that grows monotonically (tiles only get added, never unfrozen). Storing on `matches` as JSONB:

- Avoids a separate table and JOIN overhead
- Naturally scoped to match lifecycle
- Updated atomically with match state
- JSONB supports efficient read/write in PostgreSQL

### Schema

```json
{
  "3,5": { "owner": "player_a" },
  "4,5": { "owner": "player_b" },
  "2,0": { "owner": "both" }
}
```

Key format: `"x,y"` string for fast lookup. Value: ownership enum.

### Why Not on `rounds` Table?

The frozen tile map is cumulative across the match. Storing per-round would require reconstruction from all previous rounds. The matches table already tracks persistent match-level state (scores, timers, player assignments).

### Migration

```sql
ALTER TABLE public.matches
ADD COLUMN frozen_tiles jsonb NOT NULL DEFAULT '{}';
```

### Read/Write Pattern

- **Read**: `SELECT frozen_tiles FROM matches WHERE id = $1`
- **Write**: `UPDATE matches SET frozen_tiles = $1, updated_at = now() WHERE id = $2`
- **In-memory**: Parsed to `Map<string, FrozenTileOwner>` for fast coordinate lookups during scan

## R6: Dictionary Load Strategy

### Decision: Streaming readline with module-level singleton cache

### Rationale

The dictionary file is 2.76M lines (~30-40MB on disk). Loading strategies:

1. **`fs.readFileSync` + split**: Simple but blocks event loop during parse. Risk: >200ms for large files.
2. **Streaming `readline`**: Non-blocking, memory-efficient, processes line-by-line. Best for large files.
3. **Worker thread**: Offloads to separate thread. Adds complexity for minimal gain since load is one-time.

Streaming readline is the best balance: non-blocking, predictable memory, and should meet the 200ms SLA.

### Implementation Pattern

```typescript
// Module-level singleton
let cachedDictionary: Set<string> | null = null;

export async function loadDictionary(): Promise<Set<string>> {
  if (cachedDictionary) return cachedDictionary;

  const words = new Set<string>();
  // Stream file, NFC-normalize, lowercase, add to Set
  // Log timing via performance.mark()

  cachedDictionary = words;
  return words;
}
```

### Cold Start Budget

| Operation                 | Estimated Time | Budget    |
| ------------------------- | -------------- | --------- |
| File open + stream setup  | 1-2ms          | —         |
| Read 2.76M lines          | 50-80ms        | —         |
| NFC normalize + lowercase | 30-50ms        | —         |
| Set.add × 2.76M           | 30-50ms        | —         |
| **Total**                 | **110-180ms**  | **200ms** |

## R7: Word Attribution to Players

### Decision: Three-scan approach with intermediate board state

### Rationale

After conflict resolution, moves are applied sequentially (Player A first if their submission was earlier, per FCFS). To attribute newly formed words to the correct player:

1. **Scan board_before** → `wordsBefore` (baseline)
2. **Apply Player A's swap** → intermediate board → **scan** → `wordsAfterA`
3. **Apply Player B's swap** → final board → **scan** → `wordsAfterAB` (same as board_after)

Attribution:

- Player A's new words: `wordsAfterA \ wordsBefore`
- Player B's new words: `wordsAfterAB \ wordsAfterA` (minus any also in wordsBefore)

This correctly handles:

- Words created by Player A's swap that survive Player B's swap
- Words created by Player B's swap
- Words destroyed by Player B's swap (don't score for anyone)
- Pre-existing words (never score)

### Performance

3 scans × ~5ms each = ~15ms. Plus scoring/persistence overhead (~5-10ms). Total: **~20-25ms** (within 50ms SLA).
