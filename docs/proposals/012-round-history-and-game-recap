## 012: Round History & Post-Game Recap (Next Feature After 011)

### Current State (from PRD + specs)

- **Core loop**: Swap → server validates words → scores → freezes tiles → broadcasts round summary is implemented (specs 002, 003, 006).
- **Visual feedback**: Score delta popup (008) and planned/ongoing board animations & word highlights (004, 010, 011) make individual rounds feel good but focus on the _moment_, not the _arc_ of a match.
- **Post-game**: `FinalSummary` already shows winner, frozen tile count, and top-scoring words (per `CLAUDE.md`), but there is no full, navigable history of rounds and discovered words.

### Why this is the right next feature

- **High impact, small scope**: Uses existing `RoundSummary` and `WordScoreBreakdown` data — no new tables, no new server actions, minimal schema risk.
- **Aligns with PRD**: PRD §3.4 calls for “final scores, word highlights, and winner”; this feature deepens that with a per-round narrative, moving the game closer to a polished, replayable word duel.
- **Supports learning & mastery**: Players can review which swaps and words mattered most, making Wottle feel like a serious word game rather than just a fleeting arcade experience.

### Proposed Feature: Round History & Recap Experience

- **New panel**: A `RoundHistoryPanel` visible post-game (and optionally togglable in-game) that shows:
  - One row per round (1–10) with each player’s **score delta**, **cumulative score**, and an indicator if they scored any words.
  - Expandable details per round: list of words found, their lengths, and per-word points using existing `WordScoreBreakdown`.
- **Board-word linkage**:
  - Clicking a word in the history briefly highlights its tiles on the board using the same highlight mechanism as spec 010 (reuse the glow/focus state but without replaying full animations).
  - For reduced-motion users, highlight uses a static outline/tint only.
- **Summary callouts** (at top of panel):
  - “Biggest swing round” (max score delta differential).
  - “Highest scoring word” and which round it occurred in (uses data already added by spec 006).
- **Access points**:
  - Always visible on the final summary screen via a tab or side drawer alongside the existing `FinalSummary` component.
  - (Optional stretch) A compact icon/button during the match that opens the same panel in read-only form for completed rounds only.

### Scope Boundaries (to keep it small)

- **No new persistence**: All data comes from existing in-memory match state and Realtime payloads; we do not add match-history tables or external storage.
- **No new matchmaking flows**: Rematch buttons and Elo/ranked modes remain out of scope; this feature is purely informational and visual.
- **No rules changes**: Specs like 009-game-rules-config (Scrabble-style validation) are explicitly _not_ part of this; we work with the existing word engine.

### High-Level Implementation Plan

- **1. Data plumbing**
  - Confirm where complete per-round summaries are accumulated (likely in `MatchClient` and `lib/match/stateLoader.ts`). If only the latest round is kept, introduce a client-side array of `RoundSummary` entries for the current match.
  - Derive per-round per-player score deltas and cumulative scores using existing scoring types from `/lib/types/match.ts`.
- **2. New UI component(s)**
  - Add `RoundHistoryPanel` under `components/match/` with props like `{ rounds, players, onWordHover }`.
  - Implement a stacked list UI: round header row (round number, small score summary) plus an expandable section listing that round’s words (word text, length, letters vs bonus points, total).
  - Integrate with the existing final match view (likely `FinalSummary` container) so that the board and history are visible together on desktop and sensibly stacked on mobile.
- **3. Board highlight integration**
  - Define a small, pure function in `/lib/game-engine/` or `/lib/match/` that maps a word’s tile coordinates from `WordScoreBreakdown.tiles` into a set of board positions.
  - Extend the match board component (in `components/game/`) with a lightweight "external highlight" prop (set of coordinates + player color) that adds an outline/tint without affecting frozen-tile visuals.
  - Wire `RoundHistoryPanel` to call an `onWordHover`/`onWordFocus` callback that sets this external highlight state for a short duration or while hovered/expanded.
- **4. Accessibility & reduced motion**
  - Ensure the history panel is keyboard-navigable (tab order, ARIA labels on expand/collapse and words list).
  - Respect `prefers-reduced-motion`: highlights change color/outline only, without additional animation beyond what spec 010 already guards.
- **5. Testing strategy**
  - Add unit tests around the score timeline derivation (round deltas, cumulative totals, biggest swing, highest word) in `tests/unit/` using mock `RoundSummary` fixtures.
  - Add a lightweight integration/UI test (Playwright) that plays through a short match script and asserts that the history panel shows the correct number of rounds and top word text once the match ends.
