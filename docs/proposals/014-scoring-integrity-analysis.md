# Scoring Integrity Analysis: Scored Character Sequence Invariant

**Date**: 2026-03-07
**Branch**: `014-move-playability-improvements`
**Invariant**: Every contiguous run of scored (frozen) tiles on any axis must spell a valid dictionary word.

## Scoring Pipeline

`processRoundScoring()` in `lib/game-engine/wordEngine.ts` processes players sequentially:

1. Sort moves by `submittedAt` (first submitter has precedence)
2. For each player: `applySwap()` → `scanFromSwapCoordinates()` → `selectOptimalCombination()` → `scoreBoardWords()` → `freezeTiles()`
3. Player B is processed with Player A's newly-frozen tiles visible

`deltaDetector.ts` is NOT used in the scoring pipeline — only for display/attribution. All validation happens in `selectOptimalCombination()`.

## Validation Layers (in `selectOptimalCombination`)

| Check | What it does | Scope |
|-------|-------------|-------|
| `hasCrossWordViolation` | Perpendicular cross-words with frozen/same-round tiles must be valid | Per-word viability + subset mutual validation |
| `violatesFrozenAdjacencyOnSameAxis` | Word adjacent to frozen run on same axis → combined must be valid; sandwich check validates full sequence when frozen on both sides | Per-word viability only |
| `hasNoSameAxisConflict` | No same-axis overlap or adjacency between words in subset | Subset validation |
| `isSubsetValid` | Mutual cross-word validation between all words in subset | Subset validation |

## Scenarios Analyzed

### PASS: Single scored word
A word is scored only if it's in the dictionary. Its frozen tiles spell a valid word by definition.

### PASS: Adjacent words, same player, same round
`hasNoSameAxisConflict` rejects subsets with adjacent same-axis words. Only the higher-scoring one survives.

### PASS: Adjacent words, cross-player, same round
Player B is processed after Player A. Player A's tiles are already frozen. `violatesFrozenAdjacencyOnSameAxis` checks combined sequence. If combined is invalid, Player B's word is rejected.

### PASS: Adjacent words, cross-round
When a word in round N+1 is adjacent to a frozen word from round N, `violatesFrozenAdjacencyOnSameAxis` traces the frozen run and validates the combined sequence.

### PASS: Perpendicular cross-words
`hasCrossWordViolation` validates perpendicular sequences against frozen tiles and same-round tiles.

### PASS: Non-frozen adjacent tiles
Non-frozen adjacent tiles do NOT affect scoring validation. Only frozen tile sequences (from previously scored words) trigger adjacency checks via `violatesFrozenAdjacencyOnSameAxis`.

### FIXED: Sandwich — word fills gap between two frozen runs
When frozen runs exist on BOTH sides of a word, the full combined sequence (frozen_before + word + frozen_after) is validated as a single unit. Previously only pairwise combinations were checked.

**Example**: Frozen "AB" at cols 0-1, frozen "EF" at cols 4-5. New word "CD" at cols 2-3. "ABCD" valid, "CDEF" valid, but "ABCDEF" not valid → "CD" rejected.

## Files Modified

- `lib/game-engine/crossValidator.ts` — refactored `violatesFrozenAdjacencyOnSameAxis()` with sandwich check (removed `violatesSameAxisBoundary()` — non-frozen boundaries are not validated)
- `tests/unit/lib/game-engine/crossValidator.test.ts` — tests T043-T048

## Test Coverage

| Test | Scenario | Expected |
|------|----------|----------|
| T043 | OPA+TÍS subset rejected via cross-word (OPAT invalid) | 1 word survives |
| T044 | Non-frozen adjacent tiles don't affect validation | Accepted |
| T046 | Interior word with non-frozen adjacent tiles | Accepted |
| T047 | Sandwich: pairwise valid but full sequence invalid | Rejected |
| T048 | Sandwich: full combined sequence valid | Accepted |
