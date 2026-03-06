# Implementation Plan: Round History & Post-Game Recap

**Branch**: `012-round-history-and-game-recap` | **Date**: 2026-03-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-round-history-and-game-recap/spec.md`

## Summary

Add an interactive round history panel to the post-game summary screen. The panel displays per-round scoring breakdowns with expandable word details grouped by player, summary callouts (biggest swing round, highest-scoring word), and board-word highlight linkage that highlights tile coordinates when hovering words. Implementation extends existing data queries (no new tables), adds pure derivation utilities, and introduces a tabbed UI within FinalSummary alongside a read-only board view.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x, CSS Animations/Transforms (GPU-accelerated, no Framer Motion)
**Storage**: N/A — reads existing `word_score_entries`, `scoreboard_snapshots`, `rounds` tables via Supabase; no new tables or columns
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Board highlight on word hover: <200ms (SC-003); 60 FPS for highlight transitions
**Constraints**: No new persistence; no new server actions; all derivation is client-side pure functions
**Scale/Scope**: 2 new components, 2 new utility modules, 1 extended page query, 1 extended component (FinalSummary)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative Game Logic | PASS | No game state mutations — feature is read-only display of existing server-computed data |
| II. Real-Time Performance Standards | PASS | No impact on move RTT or word validation. Board highlight is client-side CSS only. SC-003 targets <200ms for highlight visibility |
| III. Type-Safe End-to-End | PASS | Extended WordHistoryRow type maintains compile-time guarantees. New types (RoundHistoryEntry, callout types) defined in components/match/ |
| IV. Progressive Enhancement & Mobile-First | PASS | Tabbed layout stacks naturally on mobile. Board highlight suppressed when board not in viewport (edge case documented) |
| V. Observability & Resilience | PASS | Read-only feature — no new failure modes. Graceful fallback for empty/zero-score rounds via FR-016 |
| VI. Clean Code | PASS | Pure derivation functions (<20 lines each), single-responsibility components |
| VII. TDD | PASS | Derivation utilities tested first (Red→Green→Refactor). Component rendering tested via Playwright |
| VIII. External Context Providers | N/A | No external libraries or APIs introduced |
| IX. Commit Message Standards | PASS | Standard `feat(012):` / `test(012):` format |

**Post-Phase 1 Re-check**: No violations introduced. All new code is client-side, read-only, and pure-functional.

## Project Structure

### Documentation (this feature)

```text
specs/012-round-history-and-game-recap/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Modified files
app/match/[matchId]/summary/page.tsx       # Extend queries: +tiles, +is_duplicate, +board_snapshot_after
components/match/FinalSummary.tsx           # Add tabbed layout, board prop, callout props
components/game/BoardGrid.tsx              # Minor: support persistent highlight mode (no auto-clear timer)
app/styles/board.css                       # Add static highlight class for hover-driven highlights

# New files
components/match/RoundHistoryPanel.tsx      # Main panel: expandable round list with player-grouped words
components/match/RoundHistoryCallouts.tsx   # Callout cards: biggest swing, highest word
components/match/deriveRoundHistory.ts      # Pure: WordHistoryRow[] + ScoreboardRow[] → RoundHistoryEntry[]
components/match/deriveCallouts.ts          # Pure: compute BiggestSwingCallout + HighestScoringWordCallout

# New test files
tests/unit/components/match/deriveRoundHistory.spec.ts
tests/unit/components/match/deriveCallouts.spec.ts
tests/integration/ui/round-history.spec.ts  # E2E: complete match → verify panel, callouts, highlights
```

**Structure Decision**: Follows existing Next.js App Router layout. New components and utilities placed in `components/match/` alongside existing match components (`FinalSummary.tsx`, `deriveScoreDelta.ts`, `deriveHighlightPlayerColors.ts`). No new directories needed.

## Design Decisions

### D1: Data Pipeline Extension (Not New Endpoints)

The summary page's inline `fetchMatchSummary()` function is extended to:
1. Add `tiles, is_duplicate` to the `word_score_entries` select query
2. Fetch the last round's `board_snapshot_after` for board rendering
3. Pass extended data to FinalSummary

No new server actions or API routes are needed. This aligns with the "no new persistence" scope boundary.

### D2: Client-Side Derivation

All data transformations happen in pure utility functions:
- `deriveRoundHistory()`: Groups `WordHistoryRow[]` by round and player, calculates combo bonus via existing `calculateComboBonus()`, merges with `ScoreboardRow[]` for deltas/cumulative scores
- `deriveBiggestSwing()`: Scans `ScoreboardRow[]` for max `|playerADelta - playerBDelta|`, tiebreaker by earlier round
- `deriveHighestScoringWord()`: Scans `WordHistoryRow[]` for max `totalPoints` (excluding duplicates), tiebreaker by earlier round then alphabetical username

### D3: Tabbed FinalSummary Layout

FinalSummary gains a tab bar with "Overview" and "Round History" tabs:
- **Overview tab**: Existing FinalSummary content (winner banner, player cards, scoreboard, word history)
- **Round History tab**: New RoundHistoryPanel with callouts at top, expandable round list below
- **Board**: Rendered outside the tab area (above or beside on desktop, above on mobile) so it's visible for both tabs. Board is read-only (no swap interaction).

### D4: Board Highlight on Word Hover

When hovering/clicking a word in RoundHistoryPanel:
1. Parent state holds `highlightedWord: WordHistoryRow | null`
2. `deriveHighlightPlayerColors()` (existing utility) maps the word's coordinates to the player's color
3. `highlightPlayerColors` prop passed to BoardGrid — same mechanism as spec 010's scored tile highlights
4. Highlight persists while hovered (no auto-clear timer) — BoardGrid needs a minor extension to support persistent mode
5. Highlight clears when hover/focus leaves the word entry

### D5: Accessibility

- Round rows use `<button>` or `<details>/<summary>` with `aria-expanded`, `aria-controls`
- Word lists have `role="list"` with descriptive `aria-label` (e.g., "Words scored by Player A in round 3")
- Keyboard: Tab navigates between rounds, Enter/Space expands, Tab moves into word list
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables glow animation on highlights; uses static 2px outline with player color instead

### D6: In-Game History (Stretch — P3)

Deferred implementation details:
- Add `roundHistory: RoundSummary[]` state to MatchClient
- Accumulate in `onSummary` callback (append to array)
- Render same RoundHistoryPanel in a dismissible overlay/drawer
- Board highlight reuses the same mechanism as post-game
- Button hidden until ≥1 round completed

## Complexity Tracking

> No constitution violations to justify. All changes are read-only client-side extensions of existing patterns.
