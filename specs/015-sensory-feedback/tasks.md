# Tasks: Sensory Feedback & Sequential Round Reveal

**Input**: Design documents from `specs/015-sensory-feedback/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: TDD is NON-NEGOTIABLE (Constitution Principle VII). All implementation tasks MUST be preceded by failing tests. Write the test, confirm it fails for the right reason, then implement.

**Organization**: Tasks are grouped by user story. Each story is independently implementable and testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to (US1–US5 maps to spec.md)

---

## Phase 1: Setup (Shared Type Foundation)

**Purpose**: Establish the type changes that multiple user stories depend on. No logic — types only.

- [x] T001 Add `submittedAt: string` field to `RoundMove` interface in `lib/types/match.ts`
- [x] T002 [P] Create `SensoryPreferences` interface, `SENSORY_PREFERENCES_DEFAULT`, and `SENSORY_PREFS_STORAGE_KEY` constant in `lib/types/preferences.ts`

**Checkpoint**: Type-safe contracts exist for all downstream modules. Run `pnpm typecheck` — must pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Two independent modules that multiple user stories consume. Both can be worked in parallel once their tests are written.

**⚠️ CRITICAL**: US1 requires T005. US3, US4, and US5 require T006. No user story work can begin until this phase is complete.

- [x] T003 [P] Write failing unit test: `aggregateRoundSummary()` returns `RoundMove` objects with `submittedAt` populated from `move_submissions.created_at` in `tests/unit/scoring/roundSummary.submittedAt.test.ts`
- [x] T004 [P] Write failing unit test: `useSensoryPreferences` reads defaults on first visit, persists changes to localStorage, and restores on remount in `tests/unit/preferences/useSensoryPreferences.test.ts`
- [x] T005 Update `aggregateRoundSummary()` in `lib/scoring/roundSummary.ts` to accept submission records with `created_at` and map each to `RoundMove.submittedAt` — makes T003 pass
- [x] T006 [P] Implement `useSensoryPreferences` hook in `lib/preferences/useSensoryPreferences.ts`: reads `SENSORY_PREFS_STORAGE_KEY` from localStorage on mount, writes on change, defaults to `SENSORY_PREFERENCES_DEFAULT`, SSR-safe — makes T004 pass

**Checkpoint**: `pnpm test:unit` green for T003 and T004. Foundational modules committed.

---

## Phase 3: User Story 2 — Round 1 Timer Parity (Priority: P1)

**Goal**: Remove the legacy special-case in round 1 where submitting a move did not pause the submitting player's clock. Round 1 must behave identically to rounds 2–10.

**Independent Test**: Start a match. Player A submits in round 1. Verify Player A's clock shows paused / stops counting down, while Player B's clock continues ticking. Confirm rounds 2–10 are unaffected.

### Tests — User Story 2

> **NOTE: Write these tests FIRST. Confirm they FAIL before implementing.**

- [x] T007 Write failing unit test: `stateLoader` creates round 1 with `started_at` set to a non-null ISO timestamp in `tests/unit/match/stateLoader.round1Timer.test.ts`
- [x] T008 [P] Write failing integration test: after submitting in round 1, the player's timer status is `"paused"` in the broadcast `MatchState` in `tests/integration/match/round1TimerParity.test.ts`

### Implementation — User Story 2

- [x] T009 Add `started_at: new Date().toISOString()` to the round 1 upsert call in `lib/match/stateLoader.ts` — makes T007 pass
- [x] T010 Verify integration test T008 passes against local Supabase (`pnpm test:integration`)

**Checkpoint**: Round 1 timer pause is now server-authoritative. Both unit and integration tests green.

---

## Phase 4: User Story 1 — Sequential Round Resolution Reveal (Priority: P1)

**Goal**: When a round resolves, show the first submitter's swap animation and word highlights, then the second submitter's — in submission order — before showing the final round summary panel. Total reveal ≤ 1.6 seconds.

**Independent Test**: Play a two-player round. Verify: (1) first submitter's swap tiles highlight first with their scored words and score delta, (2) second submitter's reveal follows after ≥600ms gap, (3) round summary appears only after both steps, (4) single-submission rounds show one step only, (5) `prefers-reduced-motion` suppresses CSS transitions but preserves data display sequence.

### Tests — User Story 1

> **NOTE: Write these tests FIRST. Confirm they FAIL before implementing.**

- [x] T011 Write failing unit tests for `deriveRevealSequence(summary)` in `tests/unit/match/revealSequence.test.ts`: sorts moves by `submittedAt` ascending; returns per-player highlight coordinates from `summary.words`; returns per-player score delta from `summary.words`; handles single-move summary

### Implementation — User Story 1

- [x] T012 Create `deriveRevealSequence()` pure function in `lib/match/revealSequence.ts` — makes T011 pass. Inputs: `RoundSummary`. Outputs: `{ orderedMoves: RoundMove[], highlightsFor: (playerId) => Coordinate[], deltaFor: (playerId) => number }`
- [x] T013 Update `AnimationPhase` union type from `"revealing-opponent-move" | "highlighting"` to `"revealing-player-one" | "revealing-player-two"` in `components/match/MatchClient.tsx`
- [x] T014 [US1] Rewrite `onSummary` callback to use `deriveRevealSequence()` and start `"revealing-player-one"` phase (700ms): apply first submitter's swap tiles and their word highlight coordinates to board state in `components/match/MatchClient.tsx`
- [x] T015 [US1] Implement `"revealing-player-two"` phase (700ms) after `"revealing-player-one"` completes: apply second submitter's swap tiles and their word highlights in `components/match/MatchClient.tsx`
- [x] T016 [US1] Display active player's per-step score delta (from `deriveRevealSequence`) in the board HUD during each reveal phase in `components/match/MatchClient.tsx`
- [x] T017 [US1] Add single-submission guard: when `summary.moves.length === 1` skip `"revealing-player-two"` phase and transition directly to `"showing-summary"` in `components/match/MatchClient.tsx`
- [x] T018 [US1] Add `prefers-reduced-motion` media query check; when active, suppress CSS animation class application during reveal phases while preserving phase timing and data display in `components/match/MatchClient.tsx`

**Checkpoint**: Sequential reveal is live. US1 independently testable. `pnpm test:unit` green for T011.

---

## Phase 5: User Story 5 — Sensory Feedback Settings (Priority: P2)

**Goal**: A gear icon in the global page header opens a settings panel with independent toggles for Sound Effects and Haptic Feedback. Preferences persist across browser sessions.

**Independent Test**: Open lobby page. Click gear icon in header — settings panel appears with two toggles. Toggle Sound Effects off. Navigate to match. Confirm gear icon is still visible. Close browser. Reopen — Sound Effects is still off. Toggle Haptic Feedback off. Confirm both preferences survive page reload.

### Tests — User Story 5

> **NOTE: Write these tests FIRST. Confirm they FAIL before implementing.**

- [x] T019 Write failing unit test for `SettingsPanel` component in `tests/unit/components/SettingsPanel.test.tsx`: renders two toggle controls labelled "Sound Effects" and "Haptic Feedback"; toggling Sound Effects calls `setSoundEnabled`; toggling Haptic Feedback calls `setHapticsEnabled`

### Implementation — User Story 5

- [x] T020 [US5] Create `SettingsPanel` component in `components/ui/SettingsPanel.tsx`: accepts `preferences`, `setSoundEnabled`, `setHapticsEnabled` props; renders two labelled toggle switches; accessible (keyboard navigable, aria labels) — makes T019 pass
- [x] T021 [US5] Add gear icon `<button>` to the global root layout header in `app/layout.tsx`: renders a cog SVG icon; onClick opens `SettingsPanel` as a modal overlay; `SettingsPanel` consumes `useSensoryPreferences` hook

**Checkpoint**: Settings panel accessible in 1 click from both lobby and match. Preferences persist via localStorage. T019 green.

---

## Phase 6: User Story 3 — Audio Feedback (Priority: P2)

**Goal**: Distinct synthesized sound effects play for tile selection, valid swap, word discovery, invalid move, match start, and match end — within 100ms of the triggering action. All sounds respect the Sound Effects toggle.

**Independent Test**: Enable sound effects. Tap a tile — hear a selection sound. Swap tiles — hear a swap sound. Wait for round resolution — hear a word-discovery sound on word highlights. Attempt to swap a frozen tile — hear an error sound. Disable sound effects in settings — perform same actions with no audio output.

### Tests — User Story 3

> **NOTE: Write these tests FIRST. Confirm they FAIL before implementing.**

- [x] T022 Write failing unit tests for `useSoundEffects` hook in `tests/unit/audio/useSoundEffects.test.ts`: when `enabled=true`, each `play*` function calls `AudioContext.createOscillator()` and `start()`; when `enabled=false`, no oscillator is created; when `AudioContext.state === "suspended"`, play calls are no-ops; hook cleans up AudioContext on unmount

### Implementation — User Story 3

- [x] T023 [US3] Implement `useSoundEffects(enabled: boolean)` hook in `lib/audio/useSoundEffects.ts`: creates a shared `AudioContext` lazily; resumes on first call if suspended; synthesizes 6 named sounds via oscillator+gain nodes (parameters per research.md § Decision 1); each `play*` function is a no-op when `enabled=false` or context suspended — makes T022 pass
- [x] T024 [US3] Wire `playTileSelect()` to tile click handler in `components/game/BoardGrid.tsx`: call on every tile selection click event
- [x] T025 [US3] Wire `playValidSwap()` and `playInvalidMove()` to swap response handlers in `components/game/BoardGrid.tsx`: call `playValidSwap` on `status === "accepted"`, `playInvalidMove` on `status === "rejected"`
- [x] T026 [US3] Wire `playWordDiscovery()` to `revealing-player-one` and `revealing-player-two` phase transitions in `components/match/MatchClient.tsx`: play once per reveal step if the active player scored at least one word
- [x] T027 [US3] Wire `playMatchStart()` on match component mount and `playMatchEnd()` on match completion state in `components/match/MatchClient.tsx`

**Checkpoint**: All 6 audio events fire correctly. Disabling sound effects silences all. T022 green.

---

## Phase 7: User Story 4 — Haptic Feedback (Priority: P3)

**Goal**: On supported mobile devices, tactile vibration patterns confirm valid swaps, flag invalid moves, and mark match start/end. All patterns respect the Haptic Feedback toggle. Devices without vibration support continue normally with no errors.

**Independent Test** (mobile device with vibration support): Enable haptics. Make a valid swap — feel a single short pulse. Attempt to swap a frozen tile — feel a double staccato pulse. Start a match — feel a distinct pulse. Disable haptic feedback — perform same actions with no vibration.

### Tests — User Story 4

> **NOTE: Write these tests FIRST. Confirm they FAIL before implementing.**

- [x] T028 Write failing unit tests for `useHapticFeedback` hook in `tests/unit/haptics/useHapticFeedback.test.ts`: when `enabled=true` and `navigator.vibrate` exists, each `vibrate*` function calls `navigator.vibrate` with correct pattern; when `enabled=false`, `navigator.vibrate` is not called; when `navigator.vibrate` is undefined, no error is thrown

### Implementation — User Story 4

- [x] T029 [US4] Implement `useHapticFeedback(enabled: boolean)` hook in `lib/haptics/useHapticFeedback.ts`: wraps `navigator.vibrate` with named pattern constants from research.md § Decision 5; guards on `enabled` and API existence; fails silently — makes T028 pass
- [x] T030 [US4] Wire `vibrateValidSwap()` and `vibrateInvalidMove()` to swap response handlers in `components/game/BoardGrid.tsx` (same trigger points as T025 audio)
- [x] T031 [US4] Wire `vibrateMatchStart()` and `vibrateMatchEnd()` to match lifecycle events in `components/match/MatchClient.tsx` (same trigger points as T027 audio)

**Checkpoint**: Haptic patterns fire on mobile with vibration support. Disabled haptics produce zero vibration calls. T028 green.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation, accessibility verification, and code quality pass.

- [x] T032 Write Playwright E2E test verifying: settings gear icon visible on lobby page, preferences persist after navigation, sequential reveal fires two steps before summary in `tests/integration/ui/sensoryFeedback.spec.ts`
- [x] T033 [P] Verify `prefers-reduced-motion` path in Playwright: use `page.emulateMedia({ reducedMotion: "reduce" })` and confirm reveal data appears without CSS transition classes in `tests/integration/ui/sensoryFeedback.spec.ts`
- [x] T034 [P] Run `pnpm lint && pnpm typecheck` and resolve any warnings or type errors introduced across all modified files
- [x] T035 Run full test suite `pnpm test:unit && pnpm test:integration` and confirm zero failures; verify 238+ tests still pass with no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup — types)
  └─▶ Phase 2 (Foundational — roundSummary, useSensoryPreferences) [runs after Phase 1]
        ├─▶ Phase 3 (US2 — Round 1 Timer) [independent of Phase 2; can start after Phase 1]
        ├─▶ Phase 4 (US1 — Sequential Reveal) [requires T005 from Phase 2]
        ├─▶ Phase 5 (US5 — Settings Panel) [requires T006 from Phase 2]
        ├─▶ Phase 6 (US3 — Audio) [requires T006 from Phase 2]
        └─▶ Phase 7 (US4 — Haptics) [requires T006 from Phase 2; runs after Phase 6 to avoid file conflicts in BoardGrid/MatchClient]
Phase 8 (Polish) [runs after all story phases complete]
```

### User Story Dependencies

| Story | Depends On | Can Start After |
| ----- | ---------- | --------------- |
| US2 (P1) — Timer Parity | Phase 1 only | T002 complete |
| US1 (P1) — Sequential Reveal | T005 (roundSummary) | T005 complete |
| US5 (P2) — Settings Panel | T006 (useSensoryPreferences) | T006 complete |
| US3 (P2) — Audio | T006 (useSensoryPreferences) | T006 complete |
| US4 (P3) — Haptics | T006 + US3 complete | T031 complete (avoids file conflicts) |

### Within Each Phase

- Tests MUST be written and confirmed FAILING before implementation tasks begin
- Commit each passing test before starting the next implementation task
- `pnpm typecheck` after every file change in modified existing files

### Parallel Opportunities

- **T001 + T002**: Both are type files with no dependency on each other
- **T003 + T004**: Both are test-writing tasks in different files
- **T005 + T006**: Both are implementation tasks in different files (after respective tests written)
- **US2 + Phase 2**: US2 (`stateLoader.ts`) has no dependency on T005 or T006 — can run concurrently
- **US5 + US3**: Different files (SettingsPanel/layout.tsx vs useSoundEffects/BoardGrid) — can run concurrently after T006

---

## Parallel Execution Examples

### Phase 2 — Parallel test writing

```
Parallel Group A:
  T003: Write failing test for roundSummary.submittedAt in tests/unit/scoring/roundSummary.submittedAt.test.ts
  T004: Write failing test for useSensoryPreferences in tests/unit/preferences/useSensoryPreferences.test.ts

Sequential after Group A:
  T005: Implement roundSummary change (makes T003 pass)
  T006: Implement useSensoryPreferences (makes T004 pass) [can run parallel with T005]
```

### Phase 2 + US2 — Parallel independent streams

```
Stream A (Phase 2): T003 → T005 → T006 [foundational for US1, US3, US4, US5]
Stream B (US2):     T007 → T008 → T009 → T010 [completely independent]
```

### US5 + US3 — Post-Phase-2 parallel streams

```
Stream A (US5): T019 → T020 → T021
Stream B (US3): T022 → T023 → T024 → T025 → T026 → T027
```

---

## Implementation Strategy

### MVP: US2 + US1 only (P1 stories)

1. Complete Phase 1 (Setup) — 2 tasks
2. Complete Phase 2, T005 only (roundSummary submittedAt) — 2 tasks (test + impl)
3. Complete Phase 3 (US2 — Round 1 Timer) — 4 tasks
4. Complete Phase 4 (US1 — Sequential Reveal) — 8 tasks
5. **STOP and VALIDATE**: Both P1 stories independently testable. No audio or haptics yet.

### Full Delivery

1. MVP above → foundation + both P1 stories
2. Phase 2, T006 (useSensoryPreferences) → unlock US5, US3, US4
3. Phase 5 (US5 — Settings Panel) → settings persistence live
4. Phase 6 (US3 — Audio) → audio feedback live
5. Phase 7 (US4 — Haptics) → haptics live
6. Phase 8 (Polish) → E2E test, lint, full suite

### Parallel Team Strategy (if two developers)

After Phase 1 and Phase 2 are complete:
- **Dev A**: Phase 3 (US2) then Phase 4 (US1) — server fix and sequential reveal
- **Dev B**: Phase 5 (US5) then Phase 6 (US3) then Phase 7 (US4) — audio/haptics/settings

---

## Notes

- [P] tasks can run in parallel (different files, no incomplete dependencies)
- TDD cycle per task: write failing test → commit → implement to pass → commit → refactor → commit
- Each `components/match/MatchClient.tsx` task (T013–T018, T026–T027, T031) must be sequential — single file
- Each `components/game/BoardGrid.tsx` task (T024–T025, T030) must be sequential — single file
- `pnpm typecheck` MUST pass after T001 and T002 before any Phase 2 work begins
- Haptic and audio integrations into BoardGrid/MatchClient (US4) MUST follow US3 wire-ups to avoid merge conflicts on the same lines
