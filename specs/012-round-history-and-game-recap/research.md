# Research: Round History & Post-Game Recap

**Branch**: `012-round-history-and-game-recap` | **Date**: 2026-03-06

## R1: Data Availability for Round History

### Decision
All data needed for the round history panel exists in the database but the summary page's queries need to be extended.

### Rationale
- `word_score_entries` table has `tiles` (jsonb coordinates) and `is_duplicate` columns — both needed but **not currently fetched** by the summary page query
- `scoreboard_snapshots` table already stores `player_a_delta`, `player_b_delta`, `player_a_score`, `player_b_score` per round — fully sufficient for FR-002
- `rounds` table stores `board_snapshot_after` (jsonb) — needed to render the board on the summary page for highlight linkage (FR-007)

### Alternatives Considered
- Storing round summaries client-side during the match: Rejected — not available for matches already completed; DB is the source of truth
- Adding a dedicated match_history table: Rejected — the spec explicitly excludes new persistence

## R2: Combo Bonus Reconstruction

### Decision
Derive combo bonus on the summary page by counting non-duplicate words per player per round and calling the existing `calculateComboBonus()` function.

### Rationale
- Combo bonus is **not stored in the database**; it's computed during round resolution and included in the Realtime broadcast only
- The formula is deterministic: `calculateComboBonus(nonDuplicateWordCount)` → 0 for ≤1 word, 2 for 2, 5 for 3, 7+(n-4) for 4+
- All inputs (word entries with `is_duplicate` flag, grouped by round and player) are available once the query is extended

### Alternatives Considered
- Adding a `combo_bonus` column to `scoreboard_snapshots`: Rejected — new persistence violates scope boundary
- Omitting combo bonus from the panel: Rejected — clarification Q2 explicitly requires it

## R3: Board Rendering on Summary Page

### Decision
Load the final board state from the last round's `board_snapshot_after` column and render a read-only BoardGrid alongside the round history panel.

### Rationale
- The summary page currently does **not** render the board at all
- FR-007 (board-word highlight linkage) requires a visible board to highlight word coordinates
- `rounds.board_snapshot_after` stores the board state as jsonb — available without new persistence
- BoardGrid component already accepts `highlightPlayerColors` prop for external highlight control (spec 010)

### Alternatives Considered
- Omitting the board and disabling highlight linkage: Rejected — FR-007 is a P2 requirement, not stretch
- Rendering a mini-board without interaction: Could work but adds complexity; full BoardGrid in read-only mode is simpler

## R4: Highlight Mechanism Reuse

### Decision
Reuse the `highlightPlayerColors` prop on BoardGrid with a new "static" highlight mode that persists while a word is hovered (no auto-clear timer).

### Rationale
- BoardGrid already supports `highlightPlayerColors: Record<string, string>` which maps `"x,y"` keys to CSS color strings
- Current implementation auto-clears highlights after `highlightDurationMs` (800ms) — for word hover, highlights should persist until hover/focus leaves
- The existing `deriveHighlightPlayerColors()` utility maps WordScore coordinates to player colors — can be reused with individual WordHistoryRow entries
- CSS `scored-tile-highlight` keyframe provides the glow animation; for reduced motion, a static outline via `prefers-reduced-motion` media query is already partially implemented

### Alternatives Considered
- Building a separate highlight system: Rejected — duplicates existing functionality
- Using CSS classes instead of inline `--highlight-color` variable: Rejected — existing pattern works well and is already GPU-accelerated

## R5: FinalSummary Tabbed View Architecture

### Decision
Add a tab control within FinalSummary that switches between "Overview" (existing content) and "Round History" (new RoundHistoryPanel). The board renders outside the tab area so both tabs can share it.

### Rationale
- Clarification Q1 decided on tabbed view
- Board must remain visible when the "Round History" tab is active (for highlight linkage)
- Layout: board on one side (or above on mobile), tabbed content area on the other
- FinalSummary component is the natural parent since it already receives all scoring data

### Alternatives Considered
- Separate route for round history: Rejected — adds navigation complexity for a single panel
- Rendering tabs outside FinalSummary: Rejected — FinalSummary already owns the data

## R6: In-Game Round History (Stretch)

### Decision
Accumulate RoundSummary entries in a client-side array within MatchClient as they arrive via Realtime broadcasts.

### Rationale
- MatchClient currently only stores `lastSummary` — a simple `roundHistory: RoundSummary[]` array can accumulate summaries in the `onSummary` callback
- RoundSummary already contains all data needed: `words[]` (with coordinates), `deltas`, `totals`, `comboBonus`
- The same RoundHistoryPanel component can render this array in a modal/drawer overlay

### Alternatives Considered
- Fetching completed rounds from DB on demand: Adds server round-trip and new endpoint — violates "no new server actions" spirit
- Not implementing: Acceptable since it's P3 stretch, but accumulation is trivially cheap
