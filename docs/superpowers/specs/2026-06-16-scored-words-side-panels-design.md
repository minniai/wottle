# Scored-word side panels (O-71)

**Date:** 2026-06-16
**Linear:** [O-71 — Regression: scoring after each move has disappeared from view](https://linear.app/minni/issue/O-71/regression-the-scoring-after-each-move-has-disappeared-from)
**Status:** Design approved → implementation

## Problem

As players make moves, scored words used to be displayed inline beside the board
(left and right rails). That display is gone; the only way to see scored words now is
a "History" button that opens a modal.

### Regression archaeology

The side display changed in two steps:

1. **`b471cff` (2026-03-16)** `feat(match): replace round summary overlay with inline
   player panel history` — removed the original `RoundSummaryPanel` mount and replaced
   it with `RoundHistoryInline`, rendered inside the full `PlayerPanel` variant on both
   rails. `RoundSummaryPanel` became dead code here (still is).
2. **`3d28ad0` (2026-04-22)** `chore: collapse PlayerPanel to compact-only + drop
   RoundHistoryInline` — **the regression.** Deleted `RoundHistoryInline` and the unused
   full `PlayerPanel` variant, leaving the `RoundHistoryPanel` modal (the "History"
   button) as the only path to per-round scored words.

PR #234 (merged 2026-06-10, marked O-71 Done) fixed a *separate* backend race — the
instant-scoring fast path losing to a cold-start dictionary load on Vercel. That
restored the on-board instant reveal (popup + tile glow), not the side-rail word list,
which is why the issue was reopened.

## Goal

Restore an always-visible, per-player scored-word log on both sides of the board:
**current player's words on the left, opponent's words on the right**, updating as
rounds resolve.

## Design

### Layout

**Desktop (≥900px):**
- **Left rail** (`match-layout__rail--left`): existing instruction cards
  (`HowToPlayCard`, `LegendCard`, `YourMoveCard`) **+** a new **"Your words"** card —
  the current player's scored words grouped by round, newest on top, scrollable.
- **Right rail** (`match-layout__rail--right`): existing `TilesClaimedCard` **+** a new
  **"Opponent's words"** card. Resign button stays.
- **History button removed from the desktop rail.** The rails replace it. Desktop loses
  the modal's "biggest swing / top word" callouts — an accepted trade.

**Mobile (<900px):** rails are `display:none` (already). A new **mobile-only History
button** near the compact player bars opens the existing `RoundHistoryPanel` modal,
unchanged. The modal and its callouts are kept, just gated to narrow screens. (Today's
History button lives in the desktop-only right rail, so mobile currently has *no* path
to scored words — this fixes that too.)

### Components

- **`ScoredWordsCard`** (new — `components/match/ScoredWordsCard.tsx`)
  - Props: `{ playerId, accumulatedWords, completedRounds, title, playerColor }`.
  - Exports a pure `buildScoredWordRounds(words, playerId, completedRounds)` helper
    (revived from the deleted `RoundHistoryInline.buildRounds`): filter to `playerId`,
    group by `roundNumber`, include all `completedRounds` (empty rounds show "no words"),
    sort round number descending.
  - Renders a Warm-Editorial card (`rounded-xl border border-hair bg-paper p-4
    shadow-wottle-sm`) with a `font-mono` uppercase title. Per round: `Round N` then each
    `WORD +pts`. No words at all → muted "No words yet" placeholder so the card is
    present from round 1.
  - `playerColor` tints the title accent.
- **`MatchClient.tsx`**
  - Derive `currentPlayerId` / `opponentPlayerId` from `playerSlot` + `timers`.
  - Mount `ScoredWordsCard` in each rail (left = current, right = opponent).
  - Remove the right-rail History button; add a mobile-only History trigger.

### Data flow

No new state, no backend, no DB. `accumulatedWords` (`WordHistoryRow[]`:
`roundNumber`, `playerId`, `word`, `totalPoints`, …) and `completedRounds` already exist
in `MatchClient` and populate on every round resolution (via `onSummary` / `onState` /
poller). Player colors from `getPlayerColors(slot)`.

### Out of scope (optional follow-up)

The first mover's **mid-round** instant reveal (spec 042 `partialSummary`) already shows
as the on-board popup + tile glow. Wiring it into the rail card so a word appears
*before* the round fully resolves is deferred to avoid partial/full dedup complexity.
Core behavior updates the logs on round resolution — faithful to the pre-`3d28ad0` UX.

## Testing

- **Unit** (`tests/unit/...`): `buildScoredWordRounds` — per-player filter, completed-round
  inclusion (empty rounds present), descending sort, ignores other player's words.
- **Component** (`tests/unit/components/ScoredWordsCard.test.tsx`): renders rounds, words,
  and points; empty-round "no words"; no-words "No words yet" placeholder; title.
- **Playwright** (revives the test `3d28ad0` deleted): two players — after a round scores,
  the current player's word shows in the left rail and the opponent's in the right rail;
  desktop has no History button; mobile shows the History trigger.

## Regression guard

This restores behavior removed by `3d28ad0`. The component + Playwright tests pin the
always-visible side display so a future rail refactor can't silently drop it again.
