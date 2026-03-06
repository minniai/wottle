# Quickstart: Round History & Post-Game Recap

**Branch**: `012-round-history-and-game-recap` | **Date**: 2026-03-06

## Prerequisites

- Node.js 20+, pnpm
- Supabase running locally (`pnpm quickstart` if not set up)
- Feature branch checked out: `git checkout 012-round-history-and-game-recap`

## Setup

No additional setup required — this feature uses existing database tables and dependencies.

```bash
pnpm install       # Ensure dependencies are up to date
pnpm dev           # Start Next.js dev server
```

## Key Files to Modify

### Data Pipeline (extend existing queries)

| File | Change |
|------|--------|
| `app/match/[matchId]/summary/page.tsx` | Add `tiles`, `is_duplicate` to word_score_entries query; fetch last round's `board_snapshot_after` |
| `components/match/FinalSummary.tsx` | Extend `WordHistoryRow` type; add `board` and callout props; add tabbed layout |

### New Components

| File | Purpose |
|------|---------|
| `components/match/RoundHistoryPanel.tsx` | Main panel: round list with expandable word details |
| `components/match/RoundHistoryCallouts.tsx` | Summary callouts: biggest swing, highest word |

### New Utilities (pure functions)

| File | Purpose |
|------|---------|
| `components/match/deriveRoundHistory.ts` | Transform WordHistoryRow[] + ScoreboardRow[] → RoundHistoryEntry[] |
| `components/match/deriveCallouts.ts` | Compute BiggestSwingCallout and HighestScoringWordCallout |

### CSS

| File | Change |
|------|--------|
| `app/styles/board.css` | Add static highlight class for hover-driven word highlights (reuses `--highlight-color` variable) |

## Testing

```bash
# Unit tests for derivation utilities
pnpm test:unit -- tests/unit/components/match/deriveRoundHistory.spec.ts
pnpm test:unit -- tests/unit/components/match/deriveCallouts.spec.ts

# All unit tests
pnpm test

# E2E (after implementation)
pnpm exec playwright test --grep "round history"
```

## Verification Checklist

1. Complete a match → navigate to summary → verify "Round History" tab appears
2. Click tab → verify all rounds listed with correct deltas and cumulative scores
3. Expand a round → verify words grouped by player with combo bonus line
4. Hover a word → verify board tiles highlight in player color
5. Check callouts → verify biggest swing round and highest-scoring word are correct
6. Test keyboard: Tab to rounds, Enter to expand, Tab to words
7. Test with `prefers-reduced-motion: reduce` → verify no animation on highlights
