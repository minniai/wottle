# Tasks: Round History & Post-Game Recap

**Input**: Design documents from `/specs/012-round-history-and-game-recap/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Data Pipeline Foundation)

**Purpose**: Extend existing data queries to supply new fields needed by all user stories. No new tables or server actions — query-only changes.

**Warning**: T001 and T002 can run in parallel (different files). T003 depends on both.

- [x] T001 [P] Extend `WordHistoryRow` type in `components/match/FinalSummary.tsx` to add `coordinates: Coordinate[]` and `isDuplicate: boolean` fields (import `Coordinate` from `lib/types/board.ts`)
- [x] T002 [P] Extend `fetchMatchSummary()` in `app/match/[matchId]/summary/page.tsx` to (1) add `tiles, is_duplicate` to the `word_score_entries` select query and (2) fetch `board_snapshot_after` from the last completed `rounds` row; include both in the returned data shape
- [x] T003 Add `board: BoardGrid` prop to `FinalSummary` component interface in `components/match/FinalSummary.tsx` and pass from `app/match/[matchId]/summary/page.tsx` (depends on T001, T002)

**Checkpoint**: Summary page now receives extended word history (with coordinates + isDuplicate) and the final board state.

---

## Phase 2: Foundational (Derivation Utilities — TDD)

**Purpose**: Pure utility functions that US1 and US2 both depend on. Write failing tests first (Red → Green), then implement.

**Warning**: T004 and T005 can run in parallel (different test files). T006 depends on T004; T007 depends on T005.

- [x] T004 [P] Write failing unit tests for `deriveRoundHistory()` in `tests/unit/components/match/deriveRoundHistory.spec.ts` — cover: 2-round happy path with 2 players; round with no words shows empty word arrays; duplicate word has zero points and is marked; combo bonus line appears when player scores 2+ non-duplicate words
- [x] T005 [P] Write failing unit tests for `deriveBiggestSwing()` and `deriveHighestScoringWord()` in `tests/unit/components/match/deriveCallouts.spec.ts` — cover: correct round identified by max |deltaA - deltaB|; earlier-round tiebreaker for swing; highest word excludes duplicates; same-round tiebreaker by alphabetical username; zero-score match returns null for both
- [x] T006 Implement `deriveRoundHistory(words: WordHistoryRow[], scores: ScoreboardRow[], playerAId: string, playerBUsername: string, playerBId: string, playerBUsername: string): RoundHistoryEntry[]` in `components/match/deriveRoundHistory.ts` exporting types `RoundHistoryEntry` and `RoundPlayerSlice` — groups words by round then player, derives comboBonus via `calculateComboBonus(nonDuplicateCount)`, merges ScoreboardRow deltas/cumulative scores (pass T004)
- [x] T007 Implement `deriveBiggestSwing(scores: ScoreboardRow[]): BiggestSwingCallout | null` and `deriveHighestScoringWord(words: WordHistoryRow[], usernameMap: Record<string, string>): HighestScoringWordCallout | null` in `components/match/deriveCallouts.ts` exporting types `BiggestSwingCallout` and `HighestScoringWordCallout` — all tiebreaker rules applied; return null when no scoring data (pass T005)

**Checkpoint**: Both derivation utilities pass all unit tests. US1 and US2 can now proceed in parallel.

---

## Phase 3: User Story 1 - Post-Game Round-by-Round Review (Priority: P1) MVP

**Goal**: On the final summary screen, players can browse per-round score deltas and expand any round to see all scored words grouped by player.

**Independent Test**: Complete a match, navigate to summary, verify "Round History" tab appears, verify correct round count with accurate deltas and cumulative scores, expand a round to see words grouped by player name with correct point breakdowns.

- [x] T008 [US1] Add tabbed layout to `components/match/FinalSummary.tsx` — "Overview" tab renders existing content; "Round History" tab is a placeholder div; tab bar uses `<button role="tab">` with `aria-selected`; render read-only `BoardGrid` (no `onSwapComplete`) outside the tab area so it stays visible on both tabs; add `highlightPlayerColors` state initialized as `{}`
- [x] T009 [US1] Implement `RoundHistoryPanel.tsx` in `components/match/RoundHistoryPanel.tsx` — accepts `rounds: RoundHistoryEntry[]`, `playerAUsername: string`, `playerBUsername: string`, `onWordHover?: (word: WordHistoryRow | null) => void`; renders one expandable row per round; each row shows round number, per-player delta (+N), and cumulative score; expanded section shows player A's words then player B's words, each section labeled with `aria-label`; each word line shows text, letter count, letter points, bonus points, total; duplicate words rendered with `line-through` and `0 pts`; combo bonus renders as a separate "Combo +N" line below the player's word list when comboBonus > 0; empty round shows "No words" in expanded state (FR-002, FR-003, FR-004)
- [x] T010 [US1] Wire `RoundHistoryPanel` into "Round History" tab in `components/match/FinalSummary.tsx` — call `deriveRoundHistory()` with extended wordHistory and scoreboardRows, pass result to `RoundHistoryPanel`; pass `onWordHover` as a no-op for now (wired in Phase 5)
- [x] T011 [US1] Add keyboard navigation and ARIA to `components/match/RoundHistoryPanel.tsx` — expand/collapse with `<button aria-expanded aria-controls>`; word lists have `role="list"` with descriptive `aria-label` (e.g., "Words scored by PlayerA in round 3"); Tab moves between rounds, Enter/Space toggles expansion, Tab enters word list (FR-011, FR-012)

**Checkpoint**: User Story 1 is fully functional. Players can browse round history with accurate scoring data and full keyboard accessibility.

---

## Phase 4: User Story 2 - Summary Callouts (Priority: P1)

**Goal**: Callout cards at the top of the round history panel immediately surface the biggest swing round and highest-scoring word without requiring any interaction.

**Independent Test**: Complete a match, open "Round History" tab, verify "Biggest swing: Round N" callout identifies the correct round, verify "Highest-scoring word" callout shows the correct word, points, player, and round; verify "no data" messaging when all rounds scored zero.

- [x] T012 [US2] Implement `RoundHistoryCallouts.tsx` in `components/match/RoundHistoryCallouts.tsx` — accepts `biggestSwing: BiggestSwingCallout | null`, `highestWord: HighestScoringWordCallout | null`; renders two callout cards: "Biggest swing: Round N (±M pts)" showing favored player name; "Top word: WORD by Player, Round N, K pts"; when both props are null renders a single "No scoring this match" message (FR-005, FR-006, FR-016)
- [x] T013 [US2] Mount `RoundHistoryCallouts` at the top of `components/match/RoundHistoryPanel.tsx` — derive callouts by calling `deriveBiggestSwing(scores)` and `deriveHighestScoringWord(words, usernameMap)`; accept `scores: ScoreboardRow[]` and `wordHistory: WordHistoryRow[]` as additional props to `RoundHistoryPanel`; update `FinalSummary.tsx` to pass these props

**Checkpoint**: User Stories 1 and 2 are both functional. Round history panel shows callouts immediately on tab open.

---

## Phase 5: User Story 3 - Board-Word Highlight Linkage (Priority: P2)

**Goal**: Hovering or focusing a word entry in the expanded round details momentarily highlights the corresponding tile coordinates on the board in the scoring player's color.

**Independent Test**: Expand a round, hover a word entry, verify the tile coordinates on the read-only board receive a visible highlight in the player's color; move focus to a different word to verify previous highlight clears; verify reduced-motion users see a static outline with no animation.

- [x] T014 [US3] Add `persistentHighlight?: boolean` prop to `BoardGrid` in `components/game/BoardGrid.tsx` — when `true`, skip the auto-clear `setTimeout` for highlights so they persist until `highlightPlayerColors` is externally updated or cleared
- [x] T015 [US3] Add `.scored-tile-highlight--static` CSS rule to `app/styles/board.css` — static `2px solid var(--highlight-color)` outline with no keyframe animation; applied via `@media (prefers-reduced-motion: reduce)` override on the existing `.scored-tile-highlight` class so reduced-motion users always get the static treatment (FR-010)
- [x] T016 [US3] Add `onWordHover?: (word: WordHistoryRow | null) => void` prop handling to word entries in `components/match/RoundHistoryPanel.tsx` — call `onWordHover(word)` on `mouseenter` and `focus`; call `onWordHover(null)` on `mouseleave` and `blur`; skip if prop not provided
- [x] T017 [US3] Wire board highlight in `components/match/FinalSummary.tsx` — add `highlightedWord: WordHistoryRow | null` state; on word hover, call existing `deriveHighlightPlayerColors()` with the word's `coordinates` and the scoring player's color; set result as `highlightPlayerColors` on the read-only `BoardGrid` with `persistentHighlight={true}`; on null hover, set `highlightPlayerColors={}` to clear (FR-007, FR-008, FR-009)

**Checkpoint**: User Story 3 is functional. Word hover triggers visible board highlight; leaving a word clears it; reduced-motion users see static treatment.

---

## Phase 6: User Story 4 - In-Game Round History Access (Priority: P3 — Stretch)

**Goal**: Mid-match, players can open a read-only history panel showing completed rounds without leaving the game.

**Independent Test**: During a match with at least one completed round, click the history button, verify the panel opens showing completed rounds only, verify it updates when a new round completes, verify it dismisses via close button/Escape/outside click, verify button is hidden before any round completes.

- [x] T018 [US4] Add `roundHistory: RoundHistoryEntry[]` state to `components/match/MatchClient.tsx` — in the `onSummary` callback, call `deriveRoundHistory()` and append the new entry to `roundHistory` array
- [x] T019 [US4] Add history toggle button to `components/match/GameChrome.tsx` — hidden (`display: none`) when `roundHistory.length === 0`; renders an icon button with aria-label "Round history" and a badge showing the completed round count when visible
- [x] T020 [US4] Implement dismissible overlay in `components/match/MatchClient.tsx` — renders `RoundHistoryPanel` in a modal/drawer overlay when `historyOpen` state is true; close on close button click; close on Escape keydown; close on outside-click (`mousedown` outside the panel bounds); board remains interactive beneath the overlay (FR-013, FR-014)
- [x] T021 [US4] Verify live update behavior in `components/match/MatchClient.tsx` — `roundHistory` state is derived from accumulated `onSummary` entries so the overlay automatically reflects the latest data when open; no dismiss/reopen required (FR-014)

**Checkpoint**: User Story 4 is functional. In-game history panel opens, updates live, and dismisses cleanly.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: E2E coverage, reduced-motion validation, and edge-case handling across all stories.

- [ ] T022 [P] Write E2E test in `tests/integration/ui/round-history.spec.ts` — complete a 2-player match; navigate to summary page; verify "Round History" tab is present; click tab; verify round rows equal completed round count with correct deltas; expand a round; verify word list with correct player grouping; verify callout cards show correct round/word; hover a word and verify board highlight appears
- [ ] T023 [P] Validate `prefers-reduced-motion` treatment — in `app/styles/board.css`, confirm `.scored-tile-highlight` has a `@media (prefers-reduced-motion: reduce)` block that substitutes the static outline; in `components/match/RoundHistoryPanel.tsx`, confirm no CSS transitions on expand/collapse animations under reduced motion
- [ ] T024 Handle edge-case display in `components/match/RoundHistoryPanel.tsx` and `components/match/FinalSummary.tsx` — matches that ended with fewer than 10 rounds show only the completed round count with no empty rows (FR-015); verify with a match fixture that has 3 rounds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T003) — BLOCKS US1 and US2 utility calls
- **Phase 3 (US1)**: Depends on Phase 2 (T006) for `deriveRoundHistory`
- **Phase 4 (US2)**: Depends on Phase 2 (T007) for `deriveCallouts`; US2 can run in parallel with US1 after Phase 2
- **Phase 5 (US3)**: Depends on Phase 3 (US1 panel exists with `onWordHover`), Phase 1 (board in FinalSummary)
- **Phase 6 (US4)**: Depends on Phase 3 (RoundHistoryPanel component exists)
- **Phase 7 (Polish)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2
- **US2 (P1)**: Can start after Phase 2 — no dependency on US1 (mounts inside US1 panel, but panel can be stubbed)
- **US3 (P2)**: Depends on US1 (panel with word hover callback) and Phase 1 (board rendered in FinalSummary)
- **US4 (P3)**: Depends on US1 (RoundHistoryPanel component exists as a standalone)

### Parallel Opportunities

- T001 + T002 (Phase 1): Different files
- T004 + T005 (Phase 2 tests): Different test files
- T012 + T014 (US2 callouts + US3 BoardGrid extension): Different files, no dependencies
- T022 + T023 (Phase 7): Different concerns, different files

---

## Parallel Example: Phase 2

```bash
# Run both test-writing tasks together (different files):
Task: "Write failing unit tests for deriveRoundHistory() in tests/unit/components/match/deriveRoundHistory.spec.ts"
Task: "Write failing unit tests for deriveBiggestSwing() and deriveHighestScoringWord() in tests/unit/components/match/deriveCallouts.spec.ts"

# Then implement utilities sequentially (each depends on its own tests):
Task: "Implement deriveRoundHistory() in components/match/deriveRoundHistory.ts"
Task: "Implement deriveBiggestSwing() and deriveHighestScoringWord() in components/match/deriveCallouts.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete Phase 1: Data pipeline extension
2. Complete Phase 2: Derivation utilities (TDD)
3. Complete Phase 3: US1 round-by-round review
4. Complete Phase 4: US2 callouts
5. **STOP and VALIDATE**: Tab switch, round expansion, callouts, keyboard nav
6. Demo — full post-game recap is usable

### Incremental Delivery

1. Phase 1 + 2 → Data and utilities ready
2. Phase 3 → US1: Browse round history (MVP usable)
3. Phase 4 → US2: Callouts (enhances US1 value)
4. Phase 5 → US3: Board highlight linkage (spatial "wow" feature)
5. Phase 6 → US4: In-game access (stretch goal)
6. Phase 7 → Polish and E2E coverage

---

## Notes

- [P] tasks = different files, no dependencies — safe to run in parallel
- TDD is mandatory: T004, T005 must fail before T006, T007 are implemented
- No new server actions, database tables, or API routes — all derivation is client-side
- `calculateComboBonus()` already exists in scoring library — reuse in `deriveRoundHistory()`
- `deriveHighlightPlayerColors()` already exists — reuse in FinalSummary for word hover highlights
- BoardGrid already accepts `highlightPlayerColors: Record<string, string>` — only a `persistentHighlight` prop extension needed
- Commit after each passing task: `feat(012): ...` or `test(012): ...`
