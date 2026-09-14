# Files

- [Frozen Tiles Mechanic](frozen-tiles.md) - How Wottle freezes scored tiles, assigns per-player ownership, persists the frozen-tile map across rounds, and how freezing constrains swaps and scoring to create spatial strategy.
- [Game Engine: Board, Swaps & Word Finding](game-engine.md) - The pure, persistence-free game-engine logic that turns a tile swap into found, validated, and scored words — board representation, swap semantics, the swap→scan→validate pipeline, and dictionary loading.
- [Elo Rating & Match Results](rating-and-results.md) - How a completed match's winner, loser, or draw is determined from round scores, how Elo rating changes are computed and clamped, and how those changes are persisted to match_ratings and player stats and surfaced to callers.
- [Scoring & Cross-Validation](scoring.md) - How Wottle scores each round — the per-word formula, the per-letter coverage and same-axis standalone invariants that cross-validate overlapping words, the optimal-combination selection, and how round deltas and UI highlights are aggregated.
