# Tasks: CI Pipeline Refactor

**Input**: Design documents from `/specs/004-ci-pipeline-refactor/`
**Branch**: `004-ci-pipeline-refactor`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.
**Tests**: Not applicable — this feature modifies GitHub Actions YAML only. Acceptance is validated via pipeline inspection (see quickstart.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (edits non-overlapping sections of `.github/workflows/ci.yml` or completely separate concerns)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File path for all implementation tasks: `.github/workflows/ci.yml`

---

## Phase 1: Setup (Baseline Audit)

**Purpose**: Establish a clear pre-change baseline before touching the workflow file.

- [x] T001 Audit `.github/workflows/ci.yml` — record every job name, its `needs:` chain, every `pnpm install` call with flags, and both `pnpm build` invocations; confirm the 7-stage serial topology matches the documented pre-change baseline in plan.md (read-only, no changes)

---

## Phase 2: Foundational (FR-004 — Lockfile Enforcement)

**Purpose**: Fix the global `--frozen-lockfile false` bug before any other change. All subsequent pipeline runs must succeed with the corrected flag.

**⚠️ CRITICAL**: This change must pass CI before US1 work begins — it validates that all existing tests and jobs pass under strict lockfile enforcement.

- [x] T002 In `.github/workflows/ci.yml`, replace every occurrence of `pnpm install --frozen-lockfile false` with `pnpm install --frozen-lockfile` (remove the ` false` suffix) across all 7 jobs (`lint`, `typecheck`, `test`, `integration`, `quickstart`, `playwright`, `perf-gate`); push to the feature branch and confirm the pipeline passes (FR-004, SC-007 baseline)

**Checkpoint**: All jobs pass with strict lockfile enforcement. Foundation ready.

---

## Phase 3: User Story 1 — Fast Feedback with Caching and Parallel Static Analysis (Priority: P1) 🎯 MVP

**Goal**: Eliminate redundant dependency downloads and serial static-analysis execution. Deliver faster pipeline runs via pnpm store caching, Playwright browser caching, and parallel `lint`/`typecheck` execution.

**Independent Test**: Push twice to the feature branch with no changes to `pnpm-lock.yaml` or `package.json`. Second run shows `Cache restored` in the pnpm step and `Cache hit` in the Playwright browser step. `lint` and `typecheck` both appear as "In progress" simultaneously in the GitHub Actions UI.

### Implementation for User Story 1

- [x] T003 [US1] In `.github/workflows/ci.yml`, add `cache: "pnpm"` to the `with:` block of every `actions/setup-node@v4` step across all 7 jobs (`lint`, `typecheck`, `test`, `integration`, `quickstart`, `playwright`, `perf-gate`) in `.github/workflows/ci.yml` (FR-001) — **ALREADY PRESENT** (confirmed by T001 audit: lines 33, 57, 79, 101, 146, 217, 536)
- [x] T004 [P] [US1] In the `playwright` job in `.github/workflows/ci.yml`, add an `actions/cache@v4` step immediately before the `pnpm exec playwright install --with-deps` step with `path: ~/.cache/ms-playwright` and `key: playwright-${{ runner.os }}-${{ hashFiles('package.json') }}` (no `restore-keys`) (FR-002)
- [x] T005 [P] [US1] In `.github/workflows/ci.yml`, remove all `needs:` entries from the `lint` job; remove all `needs:` entries from the `typecheck` job; change the `test` job `needs:` from `[typecheck]` to `[lint, typecheck]` (FR-003)
- [x] T006 [US1] In the `playwright` job `strategy:` block in `.github/workflows/ci.yml`, delete the `max-parallel: 1` line (FR-005)

**Checkpoint**: Push and verify SC-001 (pnpm cache hit on second run), SC-002 (Playwright cache hit), SC-005 (lint+typecheck overlap in UI). User Story 1 fully functional.

---

## Phase 4: User Story 2 — Single Application Build Shared Across All Downstream Jobs (Priority: P2)

**Goal**: Eliminate duplicate `pnpm build` calls. A dedicated `build` job compiles the application once and uploads `.next/` as a workflow artifact. `playwright` and `perf-gate` download and reuse it.

**Independent Test**: Inspect the pipeline graph — exactly one job named `Build Next.js` runs `pnpm build`. No `pnpm build` step appears in the `playwright` or `perf-gate` job logs. `.next/BUILD_ID` integrity check passes in both consumer jobs.

### Implementation for User Story 2

- [x] T007 [P] [US2] In the `playwright` job in `.github/workflows/ci.yml`, insert the Supabase Docker layer caching sequence after `supabase/setup-cli@v1` and before `pnpm quickstart`: (a) step to capture `supabase --version` output into `steps.supabase-version.outputs.version`, (b) `actions/cache@v4` restore step targeting `/tmp/supabase-docker-cache.tar` with key `supabase-docker-${{ runner.os }}-${{ steps.supabase-version.outputs.version }}` and no `restore-keys`, (c) `docker load` step gated on `cache-hit == 'true'`, (d) after `pnpm quickstart`: `docker save` export step gated on `cache-hit != 'true'` with `continue-on-error: true` (FR-006)
- [x] T008 [P] [US2] In the `perf-gate` job in `.github/workflows/ci.yml`, insert the identical Supabase Docker layer caching sequence (same 4-step pattern as T007) after `supabase/setup-cli@v1` and before `pnpm quickstart` (FR-006)
- [x] T009 [P] [US2] In the `quickstart` job in `.github/workflows/ci.yml`, insert the identical Supabase Docker layer caching sequence (same 4-step pattern as T007) after `supabase/setup-cli@v1` and before `pnpm quickstart` (FR-006)
- [x] T010 [US2] In `.github/workflows/ci.yml`, add a new `build:` job after the `integration:` job with: `needs: integration`; standard checkout + pnpm + node (with `cache: "pnpm"`) setup; `pnpm install --frozen-lockfile`; `pnpm build` (with `NEXT_TELEMETRY_DISABLED: 1`); and an `actions/upload-artifact@v4` step uploading `name: next-build-${{ github.run_id }}-${{ github.run_attempt }}`, `path: .next/ !.next/cache/ !.next/trace`, `if-no-files-found: error`, `retention-days: 1` (FR-007)
- [x] T011 [US2] In the `playwright` job in `.github/workflows/ci.yml`: (a) change `needs:` from `[quickstart]` to `[build]`, (b) remove the `pnpm build` step and its associated env-sourcing step, (c) add an `actions/download-artifact@v4` step downloading `next-build-${{ github.run_id }}-${{ github.run_attempt }}` to `path: .next/`, (d) add a BUILD_ID integrity check step: `if [ ! -f .next/BUILD_ID ]; then echo "ERROR: build artifact missing"; exit 1; fi` (FR-008)
- [x] T012 [P] [US2] In the `perf-gate` job in `.github/workflows/ci.yml`: (a) change `needs:` from `[playwright]` to `[build]`, (b) remove the `pnpm build` step, (c) add `actions/download-artifact@v4` step for `next-build-${{ github.run_id }}-${{ github.run_attempt }}` to `path: .next/`, (d) add BUILD_ID integrity check step matching T011 (FR-008)

**Checkpoint**: Push and verify SC-003 (Docker cache hit), SC-004 (single `pnpm build` in pipeline graph). `playwright` and `perf-gate` both download and use the same `.next/` artifact. User Story 2 fully functional.

---

## Phase 5: User Story 3 — Parallel E2E Suites and Decoupled Quickstart Validation (Priority: P3)

**Goal**: The `quickstart` validation job runs independently with no `needs:` relationship. `test` and `integration` are merged into a single job to eliminate a redundant checkout+install cycle.

**Independent Test**: Trigger a run where `quickstart` fails (e.g., by introducing a deliberate error in the quickstart script). Observe that `playwright` and `perf-gate` start and complete normally. Observe that the overall workflow is marked FAILED (red). Neither `playwright` nor `perf-gate` is skipped or cancelled.

### Implementation for User Story 3

- [ ] T013 [P] [US3] In `.github/workflows/ci.yml`, remove the entire `needs: integration` line from the `quickstart` job so that `quickstart` has no `needs:` entry and starts at workflow trigger in parallel with `lint` and `typecheck` — no other changes to the job (FR-009, SC-008)
- [ ] T014 [P] [US3] In `.github/workflows/ci.yml`: (a) in the `test` job, add `- run: pnpm test:integration` step immediately after `- run: pnpm test` (or `pnpm test:unit`); (b) delete the entire `integration:` job block; (c) update the `build` job `needs:` from `integration` to `test`; (d) verify `quickstart` still has no `needs:` after the `integration` job is removed (FR-010)

**Checkpoint**: Pipeline topology matches the final target graph in plan.md. Push and verify SC-008 (quickstart decoupled, its failure marks workflow FAILED but does not block playwright/perf-gate). All 8 success criteria now verifiable.

---

## Phase 6: Polish & End-to-End Verification

**Purpose**: Final validation that all acceptance scenarios from spec.md pass.

- [ ] T015 In `.github/workflows/ci.yml`, verify the final job topology matches the target graph: `lint` (no needs), `typecheck` (no needs), `quickstart` (no needs), `test` (needs: [lint, typecheck]), `build` (needs: test), `playwright` (needs: build, matrix with no max-parallel), `perf-gate` (needs: build) — correct any discrepancies found
- [ ] T016 [P] Run `actionlint .github/workflows/ci.yml` from repo root to validate YAML syntax and GitHub Actions schema compliance; fix any reported issues
- [ ] T017 Run the pipeline twice on the `004-ci-pipeline-refactor` branch with no changes to dependency files between runs; verify all cache-related success criteria: SC-001 (pnpm cache hit), SC-002 (Playwright browser cache hit), SC-003 (Docker image cache hit), SC-004 (single `pnpm build` per run), SC-005 (lint and typecheck overlap), SC-006 (Playwright matrix suites overlap)
- [ ] T018 Verify SC-007: on a temporary test commit, manually corrupt `pnpm-lock.yaml` by adding an extra line; push and confirm the pipeline fails at `pnpm install --frozen-lockfile` with a lockfile-mismatch error visible in the job log; revert the commit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Audit)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS all user story work
- **Phase 3 (US1)**: Depends on Phase 2 (pipeline passes with frozen-lockfile)
- **Phase 4 (US2)**: Depends on Phase 3 completion — Docker cache tasks and build job work on the same file sections as US1
- **Phase 5 (US3)**: Depends on Phase 4 completion — merging `test`+`integration` requires the `build` job from US2 to already exist
- **Phase 6 (Polish)**: Depends on Phase 5 completion

### Task Dependencies Within Phases

**Phase 3 (US1)**:
- T003 first (global setup-node cache change affecting all jobs)
- T004 [P] and T005 [P] after T003 — they touch non-overlapping sections (playwright job vs. lint/typecheck/test job headers)
- T006 after T004 (both edit the playwright job; run sequentially to avoid conflicts)

**Phase 4 (US2)**:
- T007 [P], T008 [P], T009 [P] — all parallel (separate jobs: playwright, perf-gate, quickstart)
- T010 must complete before T011 and T012 (creates the `build` job that T011/T012 reference in `needs:`)
- T011 [P] and T012 [P] — parallel after T010 (separate jobs: playwright, perf-gate)

**Phase 5 (US3)**:
- T013 [P] and T014 [P] — parallel (separate jobs: quickstart vs. test/integration/build)

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 (foundational) — no dependency on other stories
- **User Story 2 (P2)**: Can start after US1 — Docker cache sequence builds on top of existing job structures; build job references `integration` which must still exist
- **User Story 3 (P3)**: Can start after US2 — merging test+integration requires the `build` job (created in US2) to be present so its `needs:` can be updated

---

## Parallel Opportunities

```bash
# Phase 3 — after T003 completes:
# These two tasks touch non-overlapping sections and can be batched:
T004  # playwright job: add browser cache step
T005  # lint/typecheck/test: restructure needs

# Phase 4 — Docker cache (all three are independent jobs):
T007  # playwright job Docker cache
T008  # perf-gate job Docker cache
T009  # quickstart job Docker cache

# Phase 4 — artifact consumers (after T010 build job is created):
T011  # playwright: switch to artifact download
T012  # perf-gate: switch to artifact download

# Phase 5 — both US3 changes are independent:
T013  # quickstart: remove needs: integration
T014  # test+integration merge + build needs update

# Phase 6 — validation tasks can overlap:
T016  # actionlint syntax check
T017  # two-run cache verification
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Audit
2. Complete Phase 2: Frozen lockfile fix (CRITICAL — must pass CI)
3. Complete Phase 3: US1 (caching + parallel static analysis)
4. **STOP and VALIDATE**: Verify SC-001, SC-002, SC-005, SC-007 pass
5. Merge or continue to US2

### Incremental Delivery

1. Phase 1 + Phase 2 → Pipeline passes with frozen-lockfile enforcement
2. Phase 3 (US1) → Cache hits on second run; lint/typecheck overlap (SC-001, SC-002, SC-005, SC-006, SC-007)
3. Phase 4 (US2) → Docker cache; single build artifact (SC-003, SC-004)
4. Phase 5 (US3) → Quickstart decoupled; test+integration merged (SC-008)
5. Phase 6 (Polish) → All 8 success criteria verified

### Notes on Single-File Context

All implementation tasks edit `.github/workflows/ci.yml`. When implementing in parallel (T004/T005 or T007/T008/T009), ensure edits are to non-overlapping job sections to avoid merge conflicts. The `[P]` marker identifies tasks that edit separate job blocks; serial tasks within the same job block should be completed sequentially.

---

## Notes

- `[P]` tasks touch non-overlapping sections of `.github/workflows/ci.yml` and can be batched or done concurrently
- `[Story]` label maps each task to the user story it delivers (US1=P1, US2=P2, US3=P3)
- Each user story phase ends with a pipeline verification before proceeding to the next
- No test files are written — acceptance is validated by pipeline inspection per quickstart.md
- Commit after completing each phase (T002, T006, T012+T009, T014) to maintain a clean rollback point
- The `actionlint` check (T016) can be run locally at any point during implementation: `brew install actionlint && actionlint .github/workflows/ci.yml`
