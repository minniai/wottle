# Tasks: Rematch & Post-Game Loop

**Input**: Design documents from `/specs/016-rematch-post-game-loop/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/rematch-actions.md, quickstart.md

**Tests**: Tests are included per TDD mandate (Constitution Principle VII). Write failing tests FIRST.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Types, migration, and shared modules needed by all user stories

- [x] T001 Add RematchRequest, RematchRequestStatus, RematchEvent, RematchEventType, and SeriesContext types to `lib/types/match.ts`
- [x] T002 Create database migration for `rematch_requests` table and `matches.rematch_of` column in `supabase/migrations/20260316001_rematch.sql`
- [x] T003 [P] Extend `MatchBootstrapInput` with optional `rematchOf` field and pass `rematch_of` to DB payload in `lib/matchmaking/service.ts`
- [x] T004 [P] Add `onRematchEvent` callback to `MatchChannelCallbacks` and add `"rematch"` broadcast listener in `lib/realtime/matchChannel.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure business logic and DB access layer — MUST complete before Server Actions or UI

**CRITICAL**: No user story work can begin until this phase is complete

### Tests (TDD: write first, verify they fail)

- [x] T005 [P] Write unit tests for `detectSimultaneousRematch` in `tests/unit/lib/match/rematchService.test.ts` — pending request where caller is responder returns true; null/wrong-caller/non-pending returns false
- [x] T006 [P] Write unit tests for `validateRematchRequest` in `tests/unit/lib/match/rematchService.test.ts` — valid returns null; non-completed/non-participant/duplicate/already-processed return error messages; simultaneous (pending + caller is responder) returns null
- [x] T007 [P] Write unit tests for `walkRematchChain` in `tests/unit/lib/match/rematchService.test.ts` — single match, 3-match chain, circular reference protection
- [x] T008 [P] Write unit tests for `deriveSeriesContext` in `tests/unit/lib/match/rematchService.test.ts` — game 1 single match, game 3 with mixed wins, draws, opponent perspective

### Implementation

- [x] T009 Implement `detectSimultaneousRematch` and `validateRematchRequest` pure functions in `lib/match/rematchService.ts`
- [x] T010 Implement `walkRematchChain` and `deriveSeriesContext` pure functions in `lib/match/rematchService.ts`
- [x] T011 [P] Implement `fetchRematchRequest`, `insertRematchRequest`, `updateRematchRequestStatus` in `lib/match/rematchRepository.ts`
- [x] T012 [P] Implement `fetchMatchChainForSeries` backward chain walker in `lib/match/rematchRepository.ts`
- [x] T013 [P] Implement `broadcastRematchEvent` in `lib/match/rematchBroadcast.ts` following `statePublisher.ts` pattern

**Checkpoint**: Foundation ready — pure logic tested, DB access and broadcast modules available

---

## Phase 3: User Story 1 — Request and Accept Rematch (Priority: P1) MVP

**Goal**: Player clicks Rematch → opponent sees inline banner with Accept/Decline → accept creates new match → both redirect. Simultaneous detection auto-accepts.

**Independent Test**: Complete a match, click Rematch on Player A, accept on Player B, verify both land in new match with fresh board.

### Tests (TDD: write first, verify they fail)

- [x] T014 [P] [US1] Write unit test for `requestRematchAction` normal request path — returns `{ status: "pending" }`, inserts DB row, broadcasts event in `tests/unit/app/actions/requestRematch.test.ts`
- [x] T015 [P] [US1] Write unit test for `requestRematchAction` simultaneous detection — existing pending request where caller is responder → returns `{ status: "accepted", matchId }` in `tests/unit/app/actions/requestRematch.test.ts`
- [x] T016 [P] [US1] Write unit test for `respondToRematchAction` accept path — returns `{ status: "accepted", matchId }`, creates match with `rematch_of`, broadcasts in `tests/unit/app/actions/respondToRematch.test.ts`
- [x] T017 [P] [US1] Write unit test for `respondToRematchAction` wrong responder and already-processed errors in `tests/unit/app/actions/respondToRematch.test.ts`

### Implementation

- [x] T018 [US1] Rewrite `requestRematchAction` with rate limiting, validation, simultaneous detection, DB insert, and broadcast in `app/actions/match/requestRematch.ts`
- [x] T019 [US1] Implement `respondToRematchAction` with accept path — create match, update request, set players in match, broadcast in `app/actions/match/respondToRematch.ts`
- [x] T020 [US1] Implement `useRematchNegotiation` hook — idle/requesting/waiting/incoming/accepted/interstitial phases, Realtime subscription, 500ms interstitial timer in `components/match/useRematchNegotiation.ts`
- [x] T021 [P] [US1] Create `RematchBanner` component — shows requester name, Accept and Decline buttons, data-testid="rematch-banner" in `components/match/RematchBanner.tsx`
- [x] T022 [P] [US1] Create `RematchInterstitial` component — fixed overlay with "Starting new game..." text, data-testid="rematch-interstitial" in `components/match/RematchInterstitial.tsx`
- [x] T023 [US1] Integrate `useRematchNegotiation` hook into FinalSummary — replace `useTransition` rematch logic with hook, render RematchBanner when phase=incoming, render RematchInterstitial when phase=interstitial, phase-driven button label in `components/match/FinalSummary.tsx`
- [x] T024 [US1] Update existing FinalSummary tests — add mocks for `respondToRematchAction`, `getBrowserSupabaseClient`, verify rematch button renders in `tests/unit/components/FinalSummary.test.tsx`

**Checkpoint**: US1 complete — Player A requests, Player B accepts, both redirect to new match. Simultaneous detection works.

---

## Phase 4: User Story 2 — Decline or Timeout on Rematch (Priority: P1)

**Goal**: Player can decline a rematch (button disabled, one-shot). 30s timeout auto-expires and redirects requester to lobby. Disconnected opponent treated as declined.

**Independent Test**: Request a rematch, decline on opponent side, verify requester sees "Opponent declined" with disabled button. Or wait 30s, verify timeout message and lobby redirect.

### Tests (TDD: write first, verify they fail)

- [x] T025 [P] [US2] Write unit test for `respondToRematchAction` decline path — returns `{ status: "declined" }`, updates DB, broadcasts `rematch-declined` in `tests/unit/app/actions/respondToRematch.test.ts`
- [x] T026 [P] [US2] Write unit test for `respondToRematchAction` expired path — request created_at >30s ago → returns `{ status: "expired" }`, updates DB in `tests/unit/app/actions/respondToRematch.test.ts`

### Implementation

- [x] T027 [US2] Add decline path to `respondToRematchAction` — update status to declined, write match log, broadcast `rematch-declined` in `app/actions/match/respondToRematch.ts`
- [x] T028 [US2] Add staleness check to `respondToRematchAction` — if elapsed >30s mark expired, broadcast `rematch-expired` in `app/actions/match/respondToRematch.ts`
- [x] T029 [US2] Add 30s client-side timeout to `useRematchNegotiation` — in `waiting` phase, start timer that transitions to `expired` and redirects to lobby after 2s in `components/match/useRematchNegotiation.ts`
- [x] T030 [US2] Add `declined` and `expired` phase rendering in FinalSummary — button shows "Opponent declined" or "No response — returning to lobby", disabled state in `components/match/FinalSummary.tsx`

**Checkpoint**: US2 complete — decline disables button (FR-006), timeout redirects to lobby (FR-008), one-shot enforced (FR-010)

---

## Phase 5: User Story 3 — Series Tracking Across Rematches (Priority: P2)

**Goal**: After a rematch, FinalSummary shows game number (e.g., "Game 2") and running series score (e.g., "You lead 1-0"). Display-only.

**Independent Test**: Complete two consecutive rematches, verify FinalSummary of Game 2 shows "Game 2 — You lead 1-0" (or correct score).

### Tests (TDD: write first, verify they fail)

- [ ] T031 [P] [US3] Write unit test for series badge rendering — when `seriesContext` prop has gameNumber>1, badge appears with correct text in `tests/unit/components/FinalSummary.test.tsx`
- [ ] T032 [P] [US3] Write unit test for series badge absence — when no `seriesContext` or gameNumber=1, no badge renders in `tests/unit/components/FinalSummary.test.tsx`

### Implementation

- [ ] T033 [US3] Add `seriesContext` optional prop to `FinalSummaryProps` and `seriesBadgeText()` helper function in `components/match/FinalSummary.tsx`
- [ ] T034 [US3] Render series badge in FinalSummary overview — sky-colored rounded pill with game number and score text, data-testid="series-badge" in `components/match/FinalSummary.tsx`
- [ ] T035 [US3] Fetch series context in summary page — call `fetchMatchChainForSeries`, `walkRematchChain`, `deriveSeriesContext`, pass as prop to FinalSummary in `app/match/[matchId]/summary/page.tsx`

**Checkpoint**: US3 complete — series badge displays on FinalSummary for Game 2+, correct score tracking up to 10 rematches (SC-004)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Integration validation, E2E tests, verification

- [ ] T036 Run `pnpm typecheck` and fix any type errors across all modified files
- [ ] T037 Run `pnpm lint` and fix any lint warnings across all modified files
- [ ] T038 Run `pnpm test` and verify all unit tests pass (including new rematchService tests)
- [ ] T039 Apply migration with `pnpm supabase:migrate` and verify schema with `pnpm supabase:verify`
- [ ] T040 Run quickstart.md manual validation — complete full rematch flow (request → accept → new match → series badge)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types + migration) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core rematch flow
- **US2 (Phase 4)**: Depends on Phase 3 (T019 respondToRematch must exist) — decline/timeout paths
- **US3 (Phase 5)**: Depends on Phase 2 only — series tracking is independent of US1/US2 negotiation flow
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **US2 (P1)**: Depends on US1 (decline/timeout extend the respond action from US1)
- **US3 (P2)**: Can start after Foundational (Phase 2) — independent of US1/US2 (display-only)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Pure functions before Server Actions
- Server Actions before UI hooks
- Hooks before component integration

### Parallel Opportunities

- T003 + T004 (Setup): different files, no dependencies
- T005 + T006 + T007 + T008 (Foundation tests): all in same test file but independent test blocks
- T011 + T012 + T013 (Foundation impl): three different files
- T014 + T015 + T016 + T017 (US1 tests): different test files
- T021 + T022 (US1 components): independent components
- T025 + T026 (US2 tests): same test file, independent blocks
- T031 + T032 (US3 tests): same test file, independent blocks
- US1 and US3 can proceed in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch US1 tests in parallel:
Task T014: "Unit test for requestRematchAction normal path"
Task T015: "Unit test for requestRematchAction simultaneous detection"
Task T016: "Unit test for respondToRematchAction accept path"
Task T017: "Unit test for respondToRematchAction errors"

# Then Server Actions (sequential — T018 before T019):
Task T018: "Rewrite requestRematchAction"
Task T019: "Implement respondToRematchAction accept path"

# Then UI components in parallel:
Task T021: "Create RematchBanner component"
Task T022: "Create RematchInterstitial component"

# Then hook + integration (sequential):
Task T020: "Implement useRematchNegotiation hook"
Task T023: "Integrate hook into FinalSummary"
Task T024: "Update FinalSummary tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T013)
3. Complete Phase 3: US1 — Request and Accept Rematch (T014–T024)
4. **STOP and VALIDATE**: Complete match → Rematch → Accept → new match
5. Deploy/demo if ready — core retention loop works

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 → Test request/accept flow → Deploy (MVP!)
3. Add US2 → Test decline/timeout → Deploy (complete P1)
4. Add US3 → Test series badge → Deploy (P2 polish)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers after Phase 2:
- Developer A: US1 (request/accept flow)
- Developer B: US3 (series tracking — independent of US1)
- Then: US2 (extends US1's respond action)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution Principle VII mandates TDD — all test tasks must FAIL before implementation
- Commit after each task: `test(rematch): ...` or `feat(rematch): ...`
- FR-010 enforced by UNIQUE(match_id) DB constraint — no application-level dedup needed
- FR-011 satisfied by reusing existing `match:{matchId}` channel — no new subscriptions
