---
description: "Task list for Improve Scoring Resolution Visualization"
---

# Tasks: Improve Scoring Resolution Visualization

**Input**: Design documents from `/specs/043-scoring-resolution-viz/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/boardgrid-visual-contract.md, quickstart.md

**Tests**: REQUIRED — the project constitution mandates TDD (Principle VII). Each user story writes
failing tests first, then implements to green.

**Organization**: Tasks are grouped by user story so each can be implemented, tested, and demoed
independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (maps to spec.md user stories); omitted for Setup/Foundational/Polish

## Path Conventions

Single Next.js web app. Front-end presentation layer only. Key paths:
- `components/match/MatchClient.tsx` — match client (view-state machine)
- `components/game/BoardGrid.tsx` — tile grid + per-cell class wiring
- `app/styles/board.css` — all board CSS / keyframes
- `lib/match/currentRoundScored.ts` — NEW pure helper
- `tests/unit/...`, `tests/integration/ui/...` — Vitest + Playwright

> ⚠️ **Shared-file note**: US1, US2, and US3 all edit `app/styles/board.css`, `BoardGrid.tsx`, and
> `MatchClient.tsx`. Tasks touching the **same file** across stories are **not** `[P]` relative to
> each other — implement stories sequentially in priority order (US1 → US2 → US3) to avoid conflicts,
> even though the stories are independently testable.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm reuse points and scaffold the shared component surface.

- [X] T001 Verify reuse points exist and need no new dependencies: `deriveHighlightPlayerColors` (components/match/deriveHighlightPlayerColors.ts), `buildPartialRevealKey` / `deriveRevealHighlightsFromPartial` (lib/match/partialReveal.ts), player colors (lib/constants/playerColors.ts). Record any drift in research.md if signatures differ.
- [X] T002 [P] Add a stable module-level empty-map constant (e.g. `EMPTY_SCORED_MAP: Record<string, string> = {}`) near `EMPTY_HIGHLIGHTS` in components/game/BoardGrid.tsx for use as the default of the new prop (prevents effect re-run loops).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure current-round-scored helper + the BoardGrid prop surface that BOTH US1 and US3
depend on.

**⚠️ CRITICAL**: US1 and US3 cannot proceed until this phase is complete. (US2 is independent and may
proceed in parallel with this phase.)

- [X] T003 [P] Write failing unit tests for the current-round-scored helper in tests/unit/match/currentRoundScored.spec.ts: covers `buildCurrentRoundScoredFromSummary(summary, playerAId)` and `buildCurrentRoundScoredFromPartial(partial, playerAId)` — asserts canonical `"x,y"` keys, correct per-player color attribution, multi-word merges, and empty inputs → `{}`.
- [X] T004 Implement lib/match/currentRoundScored.ts with `buildCurrentRoundScoredFromSummary` and `buildCurrentRoundScoredFromPartial` (pure, reuse `deriveHighlightPlayerColors`, return `Record<"x,y", string>`); make T003 green.
- [X] T005 Add `currentRoundScoredTiles?: Record<string, string>` to `BoardGridProps` in components/game/BoardGrid.tsx with JSDoc and default `EMPTY_SCORED_MAP` (interface + default only; no rendering behavior yet).

**Checkpoint**: Helper unit-tested and green; BoardGrid accepts the new prop. US1/US3 can start.

---

## Phase 3: User Story 1 - Current-round scored, distinct from earlier rounds (Priority: P1) 🎯 MVP

**Goal**: Tiles scored this round keep a distinct, player-colored, persistent mark held until the
round completes; earlier-round tiles show the calmer frozen tint; on round advance the current marks
settle into the frozen look.

**Independent Test**: Play a round with at least one pre-existing frozen tile; score a word; verify
the new tiles show a distinct persistent player-colored ring that does NOT auto-clear after ~1s, that
earlier-round tiles look calmer, and that on round advance the marks clear into the frozen tint.

### Tests for User Story 1 (write FIRST, ensure they FAIL) ⚠️

- [X] T006 [P] [US1] Component test in tests/unit/components/BoardGrid.scored-current.spec.tsx: when `currentRoundScoredTiles` has an entry, that cell renders `board-grid__cell--scored-current` with `--highlight-color` set, persists with no auto-clear timer, and stacks with `board-grid__cell--frozen` when the tile is also frozen.
- [X] T007 [P] [US1] Playwright two-player test in tests/integration/ui/scoring-resolution-viz.spec.ts (US1 block): current-round scored tiles are visually distinct from previously-frozen tiles, persist until round completion, then settle into the frozen treatment on the next round.

### Implementation for User Story 1

- [X] T008 [US1] Add `.board-grid__cell--scored-current` to app/styles/board.css: persistent player-colored ring/glow (animate-in once via a `forwards` keyframe, then hold a steady `box-shadow` ring driven by `--highlight-color`), distinct from `.board-grid__cell--frozen` and from the one-shot `.board-grid__cell--scored`. Add a `@media (prefers-reduced-motion: reduce)` static-ring fallback.
- [X] T009 [US1] Wire the new class in components/game/BoardGrid.tsx cell render: a tile present in `currentRoundScoredTiles["x,y"]` gets `board-grid__cell--scored-current` and its `--highlight-color` CSS var (independent of and stacking with the frozen class); no auto-clear timer applies to this prop.
- [X] T010 [US1] In components/match/MatchClient.tsx add `currentRoundScored` state (`Record<string,string>`); in the `lastSummary` effect merge `buildCurrentRoundScoredFromSummary(summary, playerA.playerId)` into it (idempotent, additive).
- [X] T011 [US1] In components/match/MatchClient.tsx partial-reveal effect (spec 042) merge `buildCurrentRoundScoredFromPartial(partial, playerA.playerId)` into `currentRoundScored`, dedup-guarded via the existing `animatedPartialRevealsRef` so the same first-mover tiles are not re-added/recolored when `lastSummary` lands (FR-011).
- [X] T012 [US1] In components/match/MatchClient.tsx round-reset effect (keyed on `matchState.currentRound`) clear `currentRoundScored` to `{}` so scored tiles settle into the frozen tint on round advance (FR-009).
- [X] T013 [US1] Pass `currentRoundScoredTiles={currentRoundScored}` to `<BoardGrid>` in components/match/MatchClient.tsx; keep the existing transient `scoredTileHighlights` recap flash but ensure it no longer is the sole source of the scored mark (persistent mark now owns "until round completes").
- [X] T014 [US1] Verify zero-score round / timeout pass leaves `currentRoundScored` empty (no spurious marks) — add/extend a unit assertion in tests/unit/match/currentRoundScored.spec.ts and confirm MatchClient does not merge empty summaries (FR-012).

**Checkpoint**: US1 fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Calm "waiting for opponent" state without greying the board (Priority: P1)

**Goal**: After submitting, the board stays full-color; a board frame + waiting banner indicate the
locked/waiting state; clicks remain inert.

**Independent Test**: Submit a move; verify no whole-board dim/desaturation, that a frame + banner
communicate waiting, that a second move cannot be submitted, and that the indicator clears on round
advance.

### Tests for User Story 2 (write FIRST, ensure they FAIL) ⚠️

- [X] T015 [P] [US2] Component test in tests/unit/components/BoardGrid.waiting-state.spec.tsx: when `disabled` is true, no cell carries the dim styling and the lock banner renders when `showLockBanner` is true; clicks on tiles do not fire `onSwapComplete`.
- [X] T016 [P] [US2] Playwright two-player test in tests/integration/ui/scoring-resolution-viz.spec.ts (US2 block): after submitting, board tiles remain full-color (no `opacity:0.45`/`saturate(0.3)`), the waiting banner is visible, and a second submission is blocked.

### Implementation for User Story 2

- [X] T017 [US2] Rewrite `.board-grid--locked` in app/styles/board.css: remove the `opacity: 0.45` / `filter: saturate(0.3)` dim; instead apply a calm board frame/border on the grid container (optionally a soft pulsing border keyframe). Keep `cursor: not-allowed` on cells. Add a `@media (prefers-reduced-motion: reduce)` static-frame fallback (no pulse).
- [X] T018 [US2] Restyle `.board-grid__lock-banner` in app/styles/board.css to a subtler chip consistent with the Warm Editorial theme (keep the existing `aria-live="polite"` text "Move submitted — waiting for opponent" and the reduced-motion no-animation rule).
- [X] T019 [US2] In components/match/MatchClient.tsx change the BoardGrid prop from `showLockBanner={false}` to `showLockBanner={moveLocked}` so the banner surfaces while waiting; confirm `disabled={moveLocked}` continues to block clicks (FR-003) and that the banner clears when `moveLocked` resets on round advance.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Swapped tiles reveal, then fade if they don't score (Priority: P2)

**Goal**: Swapped tiles reveal with the existing animation, then their lift fades (after a short
window or on resolution) if unscored; scored swapped tiles instead promote to the current-round mark.

**Independent Test**: Make a swap forming no word → tiles reveal then fade to plain; make a swap
forming a word → those tiles transition into the current-round scored mark; a one-letter-scored swap
shows the scored tile marked and the other faded.

**Depends on**: Phase 2 + US1 (the current-round scored mark must exist to promote scored tiles).

### Tests for User Story 3 (write FIRST, ensure they FAIL) ⚠️

- [X] T020 [P] [US3] Component test in tests/unit/components/BoardGrid.swap-reveal.spec.tsx: a tile in `lockedTiles` not present in `currentRoundScoredTiles` receives the reveal-fade treatment, while a `lockedTiles` tile also in `currentRoundScoredTiles` renders the `scored-current` mark (promotion), not the fade.
- [X] T021 [P] [US3] Playwright two-player test in tests/integration/ui/scoring-resolution-viz.spec.ts (US3 block): an unscored swap's lift fades to plain with no leftover highlight into the next round; a scored swap's tiles persist as current-round marks.

### Implementation for User Story 3

- [X] T022 [US3] Add an own-swap reveal-then-fade keyframe in app/styles/board.css (analogous to `opponent-reveal-fade`) applied when a locked/revealed swap tile is NOT part of the current-round scored set; include a `@media (prefers-reduced-motion: reduce)` instant-removal fallback.
- [X] T023 [US3] In components/match/MatchClient.tsx decouple the swap-lift from `moveLocked`: keep `moveLocked` true until round resolves (waiting state owned by US2), but make `lockedSwapTiles` / `opponentSwapTiles` transient — clear them after a short reveal window via a timer (store the timer in a ref; clear on unmount/round change).
- [X] T024 [US3] In components/match/MatchClient.tsx promote scored swap tiles: when a swap tile appears in `currentRoundScored`, stop showing its transient lift (it is now a persistent current-round mark) so scored tiles never fade to plain (FR-006); unscored swap tiles fall through to the reveal-fade (FR-005).
- [X] T025 [US3] Verify no regression to the issue-#210 opponent mid-round reveal and the spec-042 instant reveal: the reveal-fade timer must not clear tiles that have become current-round marks, and must not double-fire across re-renders (reuse existing dedupe refs).

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, regression safety, and docs.

- [X] T026 [P] Run `pnpm lint` (zero-warnings) and `pnpm typecheck`; fix any issues in the touched files.
- [X] T027 [P] Run unit suite `pnpm test:unit` (incl. new helper + BoardGrid component specs) and confirm green; no regression in existing BoardGrid / MatchClient specs.
- [X] T028 Run `pnpm exec playwright test --grep "scoring resolution"` for the new E2E spec; run it individually to avoid Realtime contention (per project guidance).
- [X] T029 [P] Sanity-check performance: confirm new animations use only transform/opacity/box-shadow (no layout-triggering props) and run `pnpm perf:round-resolution` to confirm <200ms p95 round-resolution RTT is unaffected.
- [X] T030 Execute the manual verification steps in specs/043-scoring-resolution-viz/quickstart.md (US1/US2/US3 + spec-042 consistency + reduced-motion) in a two-player local match.
- [X] T031 [P] Update CLAUDE.md (component inventory / status table) to note the new `currentRoundScored` mark, the calm waiting frame, and `lib/match/currentRoundScored.ts`; reference spec 043.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS US1 and US3. (US2 does NOT depend on it.)
- **US1 (Phase 3)**: Depends on Foundational. MVP.
- **US2 (Phase 4)**: Independent — depends only on Setup; can run in parallel with Phase 2/3.
- **US3 (Phase 5)**: Depends on Foundational + US1 (needs the current-round mark to promote scored tiles).
- **Polish (Phase 6)**: Depends on all targeted stories complete.

### User Story Dependencies

- **US1 (P1)**: Foundational only. No dependency on US2/US3.
- **US2 (P1)**: Fully independent (board.css waiting-state + banner wiring).
- **US3 (P2)**: Builds on US1's current-round mark.

### Within Each User Story

- Tests written first and MUST fail before implementation.
- CSS class → BoardGrid wiring → MatchClient state/wiring.
- Shared-file edits (board.css, BoardGrid.tsx, MatchClient.tsx) across stories are sequential.

### Parallel Opportunities

- T002 (Setup) parallel with T003 (Foundational test).
- US2 (Phase 4) can be developed in parallel with Phase 2 + US1 by a second developer (it only shares
  board.css/MatchClient — coordinate merges on those files).
- Test-writing tasks within a story (e.g. T006/T007, T015/T016, T020/T021) are `[P]` (different files).
- Polish tasks T026/T027/T029/T031 are `[P]`.

---

## Parallel Example: User Story 1

```bash
# Write US1 tests together (different files):
Task: "Component test BoardGrid.scored-current in tests/unit/components/BoardGrid.scored-current.spec.tsx"
Task: "Playwright US1 block in tests/integration/ui/scoring-resolution-viz.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. **STOP and VALIDATE**: current-round scored tiles distinct + persistent until round end.
3. Demo MVP.

### Incremental Delivery

1. Setup + Foundational → ready.
2. US1 → test → demo (MVP: the core "what scored this round" clarity).
3. US2 → test → demo (calm waiting state — independent, can ship anytime).
4. US3 → test → demo (swap reveal-then-fade — completes the polish).

### Parallel Team Strategy

- Dev A: Foundational → US1 → US3.
- Dev B: US2 in parallel (coordinate board.css / MatchClient merges).

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Constitution TDD: verify each test fails before implementing; commit each passing test separately
  (`test(match): ...` before `feat(match): ...`).
- No server/schema/scoring-engine changes — do NOT touch `lib/game-engine/*`, `lib/scoring/*`,
  `lib/match/roundEngine.ts`, or `lib/constants/game-config.ts` (presentation-only).
- Keep behavior identical under Realtime and polling; all new state derives from existing `matchState`.
- Avoid: clearing current-round marks on a timer (must persist until round advance); re-flashing
  spec-042 first-mover tiles; layout-triggering CSS.
