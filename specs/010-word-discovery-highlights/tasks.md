# Tasks: Word Discovery Highlights

**Input**: Design documents from `/specs/010-word-discovery-highlights/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: TDD is NON-NEGOTIABLE per constitution. Test tasks are included and MUST be written (failing) before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project infrastructure required. All shared constants, CSS classes, and component props exist. This phase is a verification-only checkpoint.

- [x] T001 Confirm shared infrastructure in place — verify `PLAYER_A_HIGHLIGHT` and `PLAYER_B_HIGHLIGHT` are exported from `lib/constants/playerColors.ts`, `board-grid__cell--scored` CSS class exists in `app/styles/board.css`, and `scoredTileHighlights` prop exists in `components/game/BoardGrid.tsx`; read and confirm before proceeding

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No blocking foundational work needed. The feature modifies three existing files only. No new files, schema changes, or Server Actions.

**Checkpoint**: All existing tests pass before any changes (`pnpm test:unit`). Confirm baseline.

---

## Phase 3: User Story 1 — Scored Tile Glow After Round (Priority: P1) — MVP

**Goal**: After each round resolves, tiles belonging to scored words glow with the scoring player's color (Player A = blue `rgba(59,130,246,0.6)`, Player B = red `rgba(239,68,68,0.6)`) for 600–800ms before returning to their default appearance.

**Independent Test**: Open a match, complete a round where at least one word is scored. Observe that the scored tiles glow with the correct player color for ~700ms immediately after the round resolves, with no glow on unscored tiles.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T002 [P] [US1] Write failing test in `tests/unit/components/BoardGrid.test.tsx` — test that a tile whose `tileKey` appears in both `scoredTileHighlights` coordinates AND `highlightPlayerColors` receives the `board-grid__cell--scored` class AND has its inline `style['--highlight-color']` set to the matching color from `highlightPlayerColors`; test that a tile in `scoredTileHighlights` but absent from `highlightPlayerColors` receives `board-grid__cell--scored` class only (no `--highlight-color`); test that tiles not in `scoredTileHighlights` receive neither the class nor the CSS variable; test that multiple word groups all highlight simultaneously in one render; test that after `highlightDurationMs` ms (via `vi.advanceTimersByTime(800)` with fake timers), the `board-grid__cell--scored` class is removed from all tiles

### Implementation for User Story 1

- [x] T003 [P] [US1] Update `@keyframes scored-tile-highlight` in `app/styles/board.css` — replace the existing 3s keyframe and `.board-grid__cell--scored` animation declaration with: duration `700ms ease-out forwards`; keyframe stops at 0% (box-shadow spread 0, opacity 1), 28% (box-shadow outer spread 6px using `var(--highlight-color, transparent)`, opacity 1), 71% (same as 28%), 100% (box-shadow spread 0, opacity 0.8); remove `transform: scale(1)` from the keyframe to avoid conflicts with FLIP swap transforms; the glow MUST use `box-shadow` outer spread (not `border-color` or `background`) to be visually distinct from frozen overlays and selected state; update `highlightDurationMs` default value from `3000` to `800` in `components/game/BoardGrid.tsx`

- [x] T004 [US1] Add `highlightPlayerColors` prop to `BoardGrid` in `components/game/BoardGrid.tsx` — add optional prop `highlightPlayerColors?: Record<string, string>` to `BoardGridProps` interface; in `BoardGridActive` function signature and default prop list, default to empty object `{}`; in the tile render loop, after computing `tileKey = \`${colIndex},${rowIndex}\``, derive `highlightColor = highlightPlayerColors[tileKey]`; when `isScoredHighlight` is true AND `highlightColor` is truthy, add `{ '--highlight-color': highlightColor } as CSSProperties` to the tile button's `style` prop (merged with existing `frozenStyle` if present); verify T002 tests now pass

**Checkpoint**: After T002–T004, scored tiles glow with correct player color for 700ms. T002 tests pass. US1 acceptance scenarios 1 and 3 satisfied independently.

---

## Phase 4: User Story 2 — Sequenced Post-Round Narrative (Priority: P2)

**Goal**: The post-round visual sequence plays in order — scored tiles glow → (frozen overlays already visible) → round summary panel opens — so players can read what happened during the round.

**Independent Test**: Complete a round where words are scored. Verify the summary panel does NOT appear during the 700ms glow, and DOES appear immediately after the glow fades. Confirm frozen tile overlays are visible throughout (they are already applied from the simultaneous state broadcast).

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T005 [P] [US2] Write failing test in `tests/unit/components/MatchClient.test.tsx` — test that `deriveHighlightPlayerColors(words, playerAId)` pure function: maps every coordinate of words whose `playerId === playerAId` to `PLAYER_A_HIGHLIGHT` color, maps every coordinate of words whose `playerId !== playerAId` to `PLAYER_B_HIGHLIGHT` color, handles multiple words per player correctly, handles the same coordinate appearing in two words (last-write wins is acceptable); test that when a `roundSummary` event is received by MatchClient, the `RoundSummaryPanel` is NOT rendered immediately (animationPhase is `"highlighting"`); test that after `vi.advanceTimersByTime(800)`, the `RoundSummaryPanel` IS rendered (animationPhase transitions to `"showing-summary"`); test that the `scoredTileHighlights` prop passed to `BoardGrid` is populated from `pendingSummary.highlights` during `"highlighting"` phase and is empty after the timer fires

### Implementation for User Story 2

- [x] T006 [US2] Add `animationPhase` state machine to `components/match/MatchClient.tsx` — add `type AnimationPhase = "idle" | "highlighting" | "showing-summary"`; add state `animationPhase: AnimationPhase` (initial `"idle"`), `pendingSummary: RoundSummary | null` (initial `null`), `highlightPlayerColors: Record<string, string>` (initial `{}`); add pure utility `deriveHighlightPlayerColors(words: WordScore[], playerAId: string): Record<string, string>` that maps each word's coordinates to `PLAYER_A_HIGHLIGHT` or `PLAYER_B_HIGHLIGHT` from `lib/constants/playerColors.ts`; modify `onSummary` callback to: call `deriveHighlightPlayerColors`, set `pendingSummary`, set `animationPhase = "highlighting"`, update `matchState.scores` and `matchState.lastSummary` as before, start a `setTimeout(800)` that sets `animationPhase = "showing-summary"` and calls `setSummary(pendingSummary)`; add guard to the existing `lastSummary` sync `useEffect` so it does NOT call `setSummary` while `animationPhase === "highlighting"`; update `RoundSummaryPanel` render condition from `summary !== null` to `summary !== null && animationPhase !== "highlighting"`; update `BoardGrid` props: pass `scoredTileHighlights={animationPhase === "highlighting" ? (pendingSummary?.highlights ?? []) : []}`, `highlightPlayerColors={animationPhase === "highlighting" ? highlightPlayerColors : {}}`, and `highlightDurationMs={800}`; verify T005 tests now pass

**Checkpoint**: After T005–T006, summary panel is deferred until after the glow. Frozen overlays are visible throughout (applied via state broadcast). US2 acceptance scenarios 1 and 2 satisfied.

---

## Phase 5: User Story 3 — Accessible Animation for Reduced-Motion Users (Priority: P3)

**Goal**: Players who have enabled "reduce motion" in their OS see the correct final board state and summary panel instantly — no glow animation, no 800ms delay.

**Independent Test**: Enable OS "Reduce Motion" setting (macOS: System Settings → Accessibility → Reduce Motion). Complete a scored round. The summary panel must appear immediately with no visible glow on scored tiles.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T007 [P] [US3] Extend failing tests in `tests/unit/components/MatchClient.test.tsx` — mock `window.matchMedia("(prefers-reduced-motion: reduce)").matches` to return `true`; test that when a `roundSummary` event arrives, `RoundSummaryPanel` renders immediately without any timer delay (i.e., `vi.advanceTimersByTime(0)` is sufficient — no 800ms wait); test that `animationPhase` transitions directly from `"idle"` to `"showing-summary"` skipping `"highlighting"` when reduced motion is active

### Implementation for User Story 3

- [ ] T008 [P] [US3] Add `@media (prefers-reduced-motion: reduce)` override for scored tile highlight in `app/styles/board.css` — after the existing `@keyframes scored-tile-highlight` block, add a `@media (prefers-reduced-motion: reduce)` block containing `.board-grid__cell--scored { animation-duration: 0ms; }` so the glow animation completes instantaneously; verify this is consistent with the existing reduced-motion overrides for `.board-grid__cell` (swap), `.board-grid__cell--invalid` (shake), and `.score-delta-popup` already present in `board.css`

- [ ] T009 [US3] Add `prefersReducedMotion` bypass to `components/match/MatchClient.tsx` — on component mount, capture `prefersReducedMotionRef = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)`; in the `onSummary` handler (added in T006), after setting `pendingSummary` and `highlightPlayerColors`, check `prefersReducedMotionRef.current`: if `true`, skip the `setTimeout(800)` and immediately set `animationPhase = "showing-summary"` and call `setSummary(pendingSummary)`; verify T007 tests now pass

**Checkpoint**: After T007–T009, reduced-motion users see summary panel instantly. All three US acceptance scenarios satisfied. US3 complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify zero regressions, confirm zero-warnings policy, add E2E coverage.

- [ ] T010 [P] Run `pnpm lint && pnpm typecheck && pnpm test:unit` from repo root — fix any TypeScript errors (e.g., `CSSProperties` type for `--highlight-color` custom property), lint warnings (zero-warnings policy), or unit test regressions introduced by the `BoardGrid` prop changes or `MatchClient` state additions; confirm all 330+ existing tests still pass

- [ ] T011 [P] Write E2E test in `tests/integration/ui/board-ui.spec.ts` — add a test that completes a round where Player A scores a word; assert that within 200ms of round resolution, at least one tile has the `board-grid__cell--scored` class and its computed `--highlight-color` CSS variable is set to the Player A highlight color; assert that the `RoundSummaryPanel` (`data-testid="round-summary-panel"` or equivalent) is NOT visible during the 700ms highlight window; assert that the `RoundSummaryPanel` IS visible within 1200ms of round resolution (after highlight clears)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify baseline and start immediately
- **Foundational (Phase 2)**: Confirm existing tests pass before any edits
- **US1 (Phase 3)**: No upstream dependencies — T002 and T003 can start immediately after Phase 2
- **US2 (Phase 4)**: Depends on US1 complete (T003 BoardGrid prop must exist before T006 wires it)
- **US3 (Phase 5)**: Depends on US2 complete (T006 MatchClient handler must exist before T009 adds the bypass)
- **Polish (Phase 6)**: Depends on all three user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after setup — no upstream story dependency
- **US2 (P2)**: Depends on US1 (T004 test can be written in parallel with US1, but T006 implementation requires T004 to be done and T003 to be done)
- **US3 (P3)**: Depends on US2 (T007 test can be written in parallel with US2, but T009 implementation requires T006 to be done)

### Within Each User Story

- Test task MUST be written and confirmed FAILING before implementation task
- T003 (CSS + BoardGrid default) can be written in parallel with T002 (test) since they modify different files; T004 (BoardGrid prop) depends on both T002 (test exists) and T003 (animation timing correct)
- T005 (MatchClient test) can be written in parallel with T002, T003, T004
- T008 (CSS reduced-motion) can be written in parallel with T005, T006 since it modifies `board.css` which T006 does not touch
- T007 (reduced-motion MatchClient test) can be written in parallel with T008

### Parallel Opportunities

```
Phase 3 US1:
  T002 [BoardGrid.test.tsx]  ─┐
  T003 [board.css + default]  ├─→ T004 [BoardGrid.tsx prop]
                              ┘

Phase 4 US2 (after T004):
  T005 [MatchClient.test.tsx] ─→ T006 [MatchClient.tsx phase machine]

Phase 5 US3 (after T006):
  T007 [MatchClient.test.tsx] ─┐
  T008 [board.css media query]  ├─→ T009 [MatchClient.tsx bypass]
                               ┘

Phase 6 Polish (after T009):
  T010 [lint+typecheck+unit]   [P]
  T011 [E2E test]              [P]
```

---

## Parallel Example: User Story 1

```bash
# These two tasks touch different files and can run simultaneously:
# T002: tests/unit/components/BoardGrid.test.tsx
# T003: app/styles/board.css + components/game/BoardGrid.tsx (default only)

# T004 (BoardGrid prop) waits for both:
# pnpm test:unit -- BoardGrid  → should FAIL on T004 behavior until T004 done
```

---

## Parallel Example: User Story 3

```bash
# These two tasks touch different files and can run simultaneously:
# T007: tests/unit/components/MatchClient.test.tsx (reduced-motion assertions)
# T008: app/styles/board.css (@media prefers-reduced-motion block)

# T009 (MatchClient bypass) waits for both:
# pnpm test:unit -- MatchClient  → should FAIL on T009 behavior until T009 done
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (verify baseline)
2. Complete Phase 3: US1 (T002 → T003 → T004)
3. **STOP and VALIDATE**: scored tiles glow with player colors for 700ms
4. Demo or deploy MVP — summary panel still appears immediately (US2 not yet done)

### Incremental Delivery

1. US1 complete → Scored tile glow works, summary appears immediately (no sequencing)
2. US2 complete → Summary panel deferred until after glow (full sequence)
3. US3 complete → Reduced-motion users get instant state; accessibility requirement met
4. Polish complete → Zero regressions, E2E coverage

---

## Notes

- `[P]` tasks modify different files and have no incomplete-task dependencies
- Each user story is independently testable at its checkpoint
- `PLAYER_A_HIGHLIGHT` and `PLAYER_B_HIGHLIGHT` from `lib/constants/playerColors.ts` are the canonical color values — do not hardcode hex values in components
- The `--highlight-color` CSS custom property must use the fallback `transparent` so tiles without a highlight color render without a visible glow: `var(--highlight-color, transparent)`
- Do not use `transform: scale()` in the scored-tile-highlight keyframe — it conflicts with the FLIP swap animation transforms applied in `useLayoutEffect`
- The `animationPhase` timer cleanup (`clearTimeout`) must be handled in a `useEffect` cleanup or via a `useRef` to avoid memory leaks on unmount
