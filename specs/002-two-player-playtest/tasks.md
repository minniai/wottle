# Tasks: Two-Player Playtest

**Input**: Design artifacts from `/specs/002-two-player-playtest/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Tests**: TDD required per constitution; RED tests precede implementation within each story.
**Organization**: Tasks grouped by user story to preserve independent increments.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Task can run in parallel (different files, no unmet dependencies)
- **[US*]**: User story label (e.g., [US1])
- All task descriptions include concrete file paths

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Update playtest environment variables (`.env.example`, `.env.local.example`) with `PLAYTEST_INVITE_EXPIRY_SECONDS`, `PLAYTEST_MAX_CONCURRENT_MATCHES`, and document defaults in `README.md#Environment`
- [ ] T002 Add playtest CI matrix entry that runs dual-session Playwright suite in `.github/workflows/ci.yml`
- [ ] T003 Create feature flag scaffolding for lobby/match views (`app/layout.tsx`, `lib/constants/featureFlags.ts`)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T004 Author Supabase migration for players, lobby_presence, match_invitations, matches, rounds, move_submissions, word_score_entries, scoreboard_snapshots, match_logs (`supabase/migrations/20251115001_playtest.sql`)
- [ ] T005 Add RLS policies + verification script updates for new tables (`scripts/supabase/policies/check.ts`, `scripts/supabase/verify.ts`)
- [ ] T006 Implement shared match domain types (`lib/types/match.ts`) covering `MatchState`, `RoundSummary`, `WordScoreEntry`, `TimerState`
- [ ] T007 Build Supabase service helpers for lobby/match operations (`lib/matchmaking/service.ts`, `lib/match/stateMachine.ts`)
- [ ] T008 Create Realtime channel utilities with polling fallback (`lib/realtime/presenceChannel.ts`, `lib/realtime/matchChannel.ts`)
- [ ] T009 Extend observability helpers with playtest metrics + structured logs (`lib/observability/perf.ts`, `lib/observability/log.ts`)
- [ ] T010 Seed baseline test data (sample usernames + single open match) in `scripts/supabase/seed.ts`
- [ ] T011 [P] Add Vitest unit tests for state machine + conflict resolution rules (`tests/unit/lib/match/stateMachine.test.ts`)

---

## Phase 3: User Story 1 – Authenticate & Enter Lobby (Priority P1)

**Goal**: Username-only login creates/updates player profile and renders real-time lobby list.
**Independent Test**: Playwright script logs in two browsers, verifies both appear in lobby within 5 seconds and statuses update on join/leave.

- [ ] T012 [US1] [TDD-RED] Add Playwright spec for dual-login lobby visibility (`tests/integration/ui/lobby-presence.spec.ts`)
- [ ] T013 [US1] Implement username login Server Action + validation (`app/actions/auth/login.ts`, `lib/matchmaking/profile.ts`)
- [ ] T014 [US1] Wire REST handler `/api/auth/login` to server action for contract tests (`app/api/auth/login/route.ts`)
- [ ] T015 [US1] Build lobby presence store + Zustand hooks (`lib/matchmaking/presenceStore.ts`)
- [ ] T016 [US1] Create lobby UI components (`components/lobby/LobbyList.tsx`, `components/lobby/LobbyCard.tsx`) with realtime + polling fallback messaging
- [ ] T017 [US1] Integrate lobby list + login flow into `app/(lobby)/page.tsx`, including reconnect banner handling
- [ ] T018 [US1] [P] Add Vitest tests for presence store reducers (`tests/unit/lib/matchmaking/presenceStore.test.ts`)
- [ ] T019 [US1] [P] Add contract test for `/api/auth/login` happy/error paths (`tests/contract/post-login.contract.test.ts`)

---

## Phase 4: User Story 2 – Start a Direct Playtest Match (Priority P1)

**Goal**: Available testers can auto-queue or send direct invites, then transition into a shared match view.
**Independent Test**: Integration flow clicks “Start Game” in two browsers, verifies invite acceptance generates shared match ID + round 1 view.

- [ ] T020 [US2] [TDD-RED] Expand Playwright spec (`tests/integration/ui/matchmaking.spec.ts`) covering auto queue + invite accept
- [ ] T021 [US2] Implement invite creation + expiration logic (`lib/matchmaking/inviteService.ts`, `scripts/supabase/edge/inviteTimeout.ts`)
- [ ] T022 [US2] Create Server Action + REST handler for invitations (`app/actions/matchmaking/sendInvite.ts`, `app/api/lobby/invite/route.ts`)
- [ ] T023 [US2] Implement auto-matchmaking queue handler + pairing logic (`app/actions/matchmaking/startQueue.ts`)
- [ ] T024 [US2] Build lobby UI affordances (Start button, invite modal, toast states) in `components/lobby/MatchmakerControls.tsx`
- [ ] T025 [US2] Add match bootstrap route + loading screen (`app/match/[matchId]/loading.tsx`, `components/match/MatchShell.tsx`)
- [ ] T026 [US2] Update presence broadcast to mark players “matchmaking”/“in_match” (`lib/realtime/presenceChannel.ts`)
- [ ] T027 [US2] [P] Add contract tests for invite + queue endpoints (`tests/contract/post-invite.contract.test.ts`, `tests/contract/post-match-start.contract.test.ts`)
- [ ] T028 [US2] [P] Add Vitest unit tests for invite expirations + queue arbitration (`tests/unit/lib/matchmaking/inviteService.test.ts`)

---

## Phase 5: User Story 3 – Submit Rounds & Resolve Moves (Priority P1)

**Goal**: Players submit simultaneous swaps each round; server enforces 10-round state machine, validates moves, and advances rounds.
**Independent Test**: Dual-browser scenario completes 10 rounds, verifying timers pause/resume correctly and late swaps rejected after resolution starts.

- [ ] T029 [US3] [TDD-RED] Author Playwright spec for 10-round loop + timeout edge cases (`tests/integration/ui/rounds-flow.spec.ts`)
- [ ] T030 [US3] Implement backend round state machine with transaction locks (`lib/match/roundEngine.ts`, `lib/match/conflictResolver.ts`)
- [ ] T031 [US3] Add Server Action for submitting moves (`app/actions/match/submitMove.ts`) enforcing bounds + dictionary validation flags
- [ ] T032 [US3] Create REST route `/api/match/[matchId]/move` for contract coverage (`app/api/match/[matchId]/move/route.ts`)
- [ ] T033 [US3] Build match board interaction handlers (tile selection, submission, disabled states) in `components/game/BoardGrid.tsx`
- [ ] T034 [US3] Implement timer HUD + pause/expire states (`components/game/TimerHud.tsx`, `lib/match/timerStore.ts`)
- [ ] T035 [US3] Add reconnect flow restoring match + round state in `app/match/[matchId]/page.tsx`
- [ ] T036 [US3] [P] Add unit tests for `roundEngine` transitions + conflict rules (`tests/unit/lib/match/roundEngine.test.ts`)
- [ ] T037 [US3] [P] Add contract tests covering move submission accept/reject cases (`tests/contract/post-move.contract.test.ts`)
- [ ] T038 [US3] [P] Extend observability perf tests (Artillery) to assert submission RTT <200 ms (`tests/perf/round-resolution.yml`)

---

## Phase 6: User Story 4 – Round Scoring & Word Breakdown (Priority P1)

**Goal**: After each round, both players see per-word scoring details, deltas, highlights, and cumulative totals.
**Independent Test**: Scenario forms words each round and asserts scoreboard + highlight overlays match server data.

- [ ] T039 [US4] [TDD-RED] Add Playwright spec verifying round summary panel and tile highlights (`tests/integration/ui/round-summary.spec.ts`)
- [ ] T040 [US4] Implement scoring aggregator + word extraction utilities (`lib/scoring/roundSummary.ts`, `lib/scoring/highlights.ts`)
- [ ] T041 [US4] Add Server Action that assembles `RoundSummary` payload + publishes via Realtime (`app/actions/match/publishRoundSummary.ts`)
- [ ] T042 [US4] Build UI components for summary drawer + word list (`components/match/RoundSummaryPanel.tsx`, `components/match/WordHighlightOverlay.tsx`)
- [ ] T043 [US4] Persist scoreboard snapshots + expose GET `/api/match/[matchId]/rounds/[round]/summary` (`app/api/match/[matchId]/rounds/[round]/summary/route.ts`)
- [ ] T044 [US4] [P] Add Vitest tests for scoring calculations + highlight coordinates (`tests/unit/lib/scoring/roundSummary.test.ts`)
- [ ] T045 [US4] [P] Add contract tests asserting round summary schema (`tests/contract/get-round-summary.contract.test.ts`)

---

## Phase 7: User Story 5 – Complete Match & Review Results (Priority P2)

**Goal**: Display final scoreboard, word history, timers used, and rematch/lobby controls once 10 rounds or an end condition triggers.
**Independent Test**: Playwright flow finishes a match (both normal + timeout) and confirms final screen content plus rematch routing.

- [ ] T046 [US5] [TDD-RED] Playwright spec for final summary + rematch prompt (`tests/integration/ui/final-summary.spec.ts`)
- [ ] T047 [US5] Implement match completion Server Action (winner calculation, ended_reason) (`app/actions/match/completeMatch.ts`)
- [ ] T048 [US5] Render final summary view (`app/match/[matchId]/summary/page.tsx`, `components/match/FinalSummary.tsx`) with word history + timers
- [ ] T049 [US5] Add rematch + back-to-lobby flows (Server Action `app/actions/match/requestRematch.ts`, lobby redirect handling)
- [ ] T050 [US5] Persist match logs & expose admin query for QA review (`lib/match/logWriter.ts`, `scripts/supabase/log-export.ts`)
- [ ] T051 [US5] [P] Add unit tests for winner/draw calculation + rematch safeguards (`tests/unit/lib/match/resultCalculator.test.ts`)

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T052 Add accessibility review (focus traps for modals, aria-live for summaries) in `components/lobby` + `components/match`
- [ ] T053 Add analytics hooks to capture invite accept, round completion, match result events (`lib/observability/log.ts`)
- [ ] T054 Update `specs/002-two-player-playtest/quickstart.md` with final CLI commands + troubleshooting uncovered during implementation
- [ ] T055 Run full regression matrix (unit, integration, Playwright, perf) and upload artifacts (`.github/workflows/ci.yml`, `README.md#Testing`)

---

## Dependencies & Execution Order

1. **Setup** → establishes env + CI prerequisites
2. **Foundational** → schema, RLS, domain types, realtime helpers, observability
3. **US1 (Login/Lobby)** → requires foundational supabase + realtime utilities
4. **US2 (Matchmaking)** → depends on lobby presence + invites infrastructure
5. **US3 (Rounds Engine)** → depends on matches + submissions schema + matchmaking entry point
6. **US4 (Round Summary)** → depends on rounds + scoring engine
7. **US5 (Final Summary)** → depends on prior stories completing
8. **Polish** → last, after functional stories validated

## Parallel Execution Examples

- **US1**: Run `tests/contract/post-login.contract.test.ts` while building `components/lobby/LobbyList.tsx` because contract tests only rely on server action stubs.
- **US2**: Implement invite REST route (`app/api/lobby/invite/route.ts`) in parallel with queue heuristics (`app/actions/matchmaking/startQueue.ts`).
- **US3**: Develop UI interactions (`components/game/BoardGrid.tsx`) concurrently with backend `roundEngine` tests since they share only typed contracts.
- **US4**: `RoundSummaryPanel` styling can proceed while backend scoring utilities undergo unit testing.
- **US5**: Rematch Server Action and final summary UI can be built in parallel after match completion metadata schema lands.

## Implementation Strategy

1. **MVP Slice**: Deliver US1 (login + lobby) end-to-end to validate Realtime presence and session handling.
2. **Incremental Build**: Layer matchmaking (US2), rounds engine (US3), round summaries (US4), then final recap (US5).
3. **Hardening**: Execute Final Phase polish tasks, update quickstart, and run full regression suite before inviting external testers.

