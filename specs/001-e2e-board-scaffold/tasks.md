# Tasks: MVP E2E Board & Swaps

**Input**: Design documents from `/specs/001-e2e-board-scaffold/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Tests**: Tests required per constitution; follow TDD (write failing tests before implementation).
**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: User story label (e.g., [US1])
- Every task includes an explicit file path

## Path Conventions

- Single Next.js project at repo root (`app/`, `components/`, `lib/`, `scripts/`, `supabase/`)
- Tests live under `tests/` (unit, integration, contract)
- CI resides in `.github/workflows/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the Next.js + Supabase-ready project scaffold

- [x] T001 Initialize Next.js 16 + TypeScript project with PNPM scripts in `package.json`
- [x] T002 Scaffold App Router entry files (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`) for the base UI shell
- [x] T003 Add TypeScript config and Next env stubs in `tsconfig.json` and `next-env.d.ts`
- [x] T004 [P] Configure ESLint rules for React/Next in `.eslintrc.js`
- [x] T005 [P] Configure Prettier formatting standards in `.prettierrc`
- [x] T006 [P] Install Tailwind CSS baseline and generate `tailwind.config.ts` plus `postcss.config.cjs`
- [x] T007 Establish project structure directories (`app/actions/`, `components/game/`, `lib/`) with placeholder documentation in `app/actions/README.md`
- [x] T008 [P] Create CI workflow scaffold for lint/typecheck/test stages in `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required before any user story work

- [x] T009 Create environment templates isolating anon/service_role keys in `.env.example` and `.env.local.example`
- [x] T010 Add Supabase CLI configuration for local stack parity in `supabase/config.toml`
- [x] T011 Define boards/moves schema migration in `supabase/migrations/20251105001_init.sql`
- [x] T011a Add stable `board_id` primary key/unique constraint to `boards`; enforce single global board model.
- [x] T012 [P] Implement deterministic seed workflow populating the baseline grid in `scripts/supabase/seed.ts`
- [x] T012a Ensure seed preserves the stable `board_id` and does not create duplicates; idempotent upsert.
- [x] T013 [P] Implement database reset workflow clearing moves and restoring board in `scripts/supabase/reset.ts`
- [x] T014 Add Supabase service health verification wrapper in `scripts/supabase/verify.ts`
- [x] T014a [P] Instrument `scripts/supabase/verify.ts` to measure misconfiguration detection latency and emit duration in structured logs.
- [x] T014b [P] Add integration test asserting detection ≤10s in `tests/integration/verify/verify-timing.spec.ts`.
- [x] T015 [P] Add RLS policy snapshot diff script guarding drift in `scripts/supabase/policies/check.ts`
- [x] T016 Define shared domain types (BoardGrid, MoveRequest, MoveResult) in `lib/types/board.ts`
- [x] T017 [P] Implement board utility helpers (serialization, applySwap) in `lib/game-engine/board.ts`
- [x] T018 [P] Create server-side Supabase client factory enforcing service_role isolation in `lib/supabase/server.ts`
- [x] T019 Configure Vitest + Testing Library setup for React and server actions in `vitest.config.ts` and `tests/setup.ts`
- [x] T020 [P] Configure Playwright project for local e2e runs targeting `http://localhost:3000` in `playwright.config.ts`
- [x] T021a Add repository `.gitignore` rules for `.env*` and verify with a CI check
- [x] T021b Add static guardrail: forbid `service_role` usage in client bundles via lint/script in `scripts/guards/no-service-role-in-client.ts` and CI job
- [x] T021c Add `server-only` boundary module and enforce imports for any code accessing `service_role` in `lib/supabase/server.ts`

---

## Phase 3: User Story 1 - Launch local Supabase stack (Priority: P1) 🎯 MVP

**Goal**: Automate the quickstart so a developer can stand up Supabase locally with one command
**Independent Test**: Run `make quickstart`; Supabase services report healthy status and seed data loads without manual intervention

- [ ] T021 [P] [US1] [TDD-RED] Write failing integration test that executes `scripts/supabase/quickstart.sh` and expects healthy status in `tests/integration/quickstart/quickstart.spec.ts`
- [ ] T022 [P] [US1] [TDD-RED] Write failing unit test covering preflight validation branches in `tests/unit/scripts/quickstartPreflight.test.ts`
- [ ] T023 [US1] [TDD-GREEN] Implement TypeScript preflight module (Docker, Supabase login, port checks) in `scripts/supabase/preflight.ts`
- [ ] T024 [US1] [TDD-GREEN] Implement bash automation orchestrating preflight, `supabase start`, migrations, and seed in `scripts/supabase/quickstart.sh`
- [ ] T025 [US1] [TDD-GREEN] Add `quickstart` target and PNPM script delegating to the automation in `Makefile`
- [ ] T026 [US1] Update quickstart instructions to reference the automation and troubleshooting in `specs/001-e2e-board-scaffold/quickstart.md`
- [ ] T027 [US1] Update onboarding checklist with quickstart verification steps in `specs/001-e2e-board-scaffold/checklists/requirements.md`
- [ ] T027a [US1] Capture timings in quickstart: end-to-end startup and seed durations; assert startup ≤3m and seed ≤2m with warnings on breach; emit structured logs for CI artifacts

---

## Phase 4: User Story 2 - See board grid (Priority: P1)

**Goal**: Render a 16×16 board grid fetched from Supabase
**Independent Test**: With Supabase running, load `/` on desktop and mobile; a legible 16×16 grid appears

- [ ] T028 [P] [US2] [TDD-RED] Write unit test for `getBoard` server action returning the BoardGrid in `tests/unit/app/actions/getBoard.test.ts`
- [ ] T029 [P] [US2] [TDD-RED] Write component test verifying a 16×16 responsive grid in `tests/unit/components/game/BoardGrid.test.tsx`
- [ ] T030 [P] [US2] [TDD-RED] Write Playwright spec asserting grid visibility on desktop/mobile in `tests/integration/ui/board-grid.spec.ts`
- [ ] T031 [US2] [TDD-GREEN] Implement `getBoard` server action querying Supabase in `app/actions/getBoard.ts`
- [ ] T032 [US2] [TDD-GREEN] Implement GET `/api/board` route handler returning contract schema in `app/api/board/route.ts`
- [ ] T033 [US2] [TDD-GREEN] Implement `BoardGrid` component with Tailwind layout in `components/game/BoardGrid.tsx`
- [ ] T034 [US2] [TDD-GREEN] Fetch board via server action and render grid in `app/page.tsx`
- [ ] T035 [US2] [TDD-REFACTOR] Extract responsive grid styling helpers into `app/styles/board.css`
- [ ] T035a [US2] Add measurement: grid TTI ≤2s on cold load (local) using Playwright trace/timing; fail test on breach (local target)

---

## Phase 5: User Story 3 - Swap two tiles (Priority: P1)

**Goal**: Allow a player to swap two tiles with server-authoritative validation and board refresh
**Independent Test**: Select two tiles in the UI; valid swaps update the board, invalid swaps show an error and preserve state

- [ ] T036 [P] [US3] [TDD-RED] Write unit tests covering swap validation branches in `tests/unit/app/actions/swapTiles.test.ts`
- [ ] T037 [P] [US3] [TDD-RED] Write contract test for POST `/api/swap` success and error payloads in `tests/contract/post-swap.contract.test.ts`
- [ ] T038 [P] [US3] [TDD-RED] Write Playwright test simulating swap success and rejection in `tests/integration/ui/swap-flow.spec.ts`
- [ ] T038a [US3] Add Playwright test simulating network failure during swap and asserting error + board rollback in `tests/integration/ui/swap-network-failure.spec.ts`.
- [ ] T039 [US3] [TDD-GREEN] Implement `swapTiles` server action applying validation and returning `MoveResult` in `app/actions/swapTiles.ts`
- [ ] T040 [US3] [TDD-GREEN] Implement POST `/api/swap` route handler adhering to OpenAPI schema in `app/api/swap/route.ts`
- [ ] T041 [US3] [TDD-GREEN] Implement swap + audit helpers writing to Supabase boards/moves in `lib/game-engine/mutations.ts`
- [ ] T042 [US3] [TDD-GREEN] Wire `BoardGrid` interaction handlers to call `swapTiles` and refresh data in `components/game/BoardGrid.tsx`
- [ ] T043 [US3] [TDD-REFACTOR] Add structured logging and performance marks for swaps in `lib/observability/perf.ts`
- [ ] T043a [US3] Enforce edge runtime for perf-critical routes: `export const runtime = 'edge'` in `app/api/swap/route.ts` with justification if not possible
- [ ] T043b [US3] Add UI performance test for swap animation in `tests/perf/ui/swap-fps.spec.ts`; assert p95 frame time ≤16.7ms (60 FPS).

---

## Phase 6: User Story 4 - Basic move feedback (Priority: P2)

**Goal**: Provide clear confirmation/error feedback after swaps
**Independent Test**: After a swap, a confirmation (or error) toast appears and is announced to screen readers

- [ ] T044 [P] [US4] [TDD-RED] Write unit test for `MoveFeedback` feedback states in `tests/unit/components/game/MoveFeedback.test.tsx`
- [ ] T045 [P] [US4] [TDD-RED] Write Playwright spec verifying accessible feedback behavior in `tests/integration/ui/swap-feedback.spec.ts`
- [ ] T046 [US4] [TDD-GREEN] Implement `MoveFeedback` component with toast + live region in `components/game/MoveFeedback.tsx`
- [ ] T047 [US4] [TDD-GREEN] Integrate feedback into the swap workflow in `app/page.tsx`
- [ ] T048 [US4] [TDD-REFACTOR] Harden accessibility with aria-live and focus management in `components/game/MoveFeedback.tsx`

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, documentation, and CI coverage across stories

- [ ] T049 [P] Add Supabase quickstart, lint, typecheck, and Playwright jobs to the pipeline in `.github/workflows/ci.yml`
- [ ] T050 Record quickstart verification evidence and Supabase status outputs in `specs/001-e2e-board-scaffold/checklists/requirements.md`
- [ ] T051 [P] Add Artillery scenarios in `tests/perf/swap.yml` to measure p95 end-to-end move RTT; assert <200ms p95; export CI-friendly report
- [ ] T052 [P] Add CI perf gate job: run Artillery against local/preview env; fail pipeline if p95 ≥200ms or sample size <N
- [ ] T053 [P] Add server processing time metric and assert median/95th <200ms in logs, parsed by CI check

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → Foundational (Phase 2) → User Story 1 (Phase 3) → User Story 2 (Phase 4) → User Story 3 (Phase 5) → User Story 4 (Phase 6) → Polish (Final)
- Each phase depends on completion of the preceding phase to ensure environment stability and testability

### User Story Dependencies

- User Story 1 (P1): Depends on foundational scripts; unlocks automated local environment
- User Story 2 (P1): Depends on US1 automation for reliable data access; otherwise independent
- User Story 3 (P1): Depends on US2 rendering to surface swap results; adds mutations and logging
- User Story 4 (P2): Depends on US3 swap workflow to surface feedback states

### Within-Story Flow

- Tests (RED) precede implementation (GREEN) and refactor steps
- Shared utilities land before UI integrations within each story
- Contract routes follow server actions to reuse validation pipelines

### Parallel Opportunities

- Tasks marked [P] (e.g., T012, T015, T021, T029, T037) can run concurrently when prior dependencies are satisfied
- After Foundational completion, User Stories 2 and 3 can progress in parallel once US1 is complete and quickstart automation is validated
- Within each story, separate test files (unit vs integration vs contract) can be authored simultaneously

---

## Parallel Example: User Story 2

```bash
# Terminal 1
pnpm vitest run tests/unit/app/actions/getBoard.test.ts --runInBand

# Terminal 2
pnpm vitest run tests/unit/components/game/BoardGrid.test.tsx --runInBand

# Terminal 3
pnpm playwright test tests/integration/ui/board-grid.spec.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Deliver Phase 3 (US1) to automate local Supabase provisioning
3. Validate quickstart script end-to-end before moving forward

### Incremental Delivery

1. Add Phase 4 (US2) to render the board once automation is stable
2. Layer in Phase 5 (US3) for swaps and audit logging
3. Introduce Phase 6 (US4) feedback enhancements after swap path is proven
4. Use the Final Phase to harden CI and documentation

### Parallel Team Strategy

- Developer A: Owns quickstart automation and Supabase scripting (Phase 3 + Foundational)
- Developer B: Focuses on board rendering (Phase 4)
- Developer C: Builds swap mutations and feedback (Phase 5 & 6)
- Rotate polish/CI tasks once core stories are validated
