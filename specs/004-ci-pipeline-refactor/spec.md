# Feature Specification: CI Pipeline Refactor

**Feature Branch**: `004-ci-pipeline-refactor`
**Created**: 2026-02-23
**Status**: Complete
**Input**: User description: "refactor the ci pipeline as proposed in the document docs/ci-pipeline-2026-02-26.md"

## Clarifications

### Session 2026-02-23

- Q: When `quickstart` is decoupled, should its failure block the overall pipeline? → A: Yes — blocking failure. It runs in parallel (not gating `playwright`/`perf-gate`), but the pipeline is marked FAILED if `quickstart` fails.
- Q: Is FR-010 (job consolidation) in scope? → A: Partial consolidation — merge `test` and `integration` into one job; keep `lint` and `typecheck` as separate parallel jobs.
- Q: How should SC-001 (40% faster) baseline be defined? → A: Drop the percentage target; replace with a per-optimisation, individually verifiable criterion covering pnpm cache (FR-001).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fast Feedback with Caching and Parallel Static Analysis (Priority: P1)

An engineer pushes a branch. The pipeline restores pnpm dependencies, Playwright browsers, and Supabase Docker images from cache rather than re-downloading them. Static-analysis jobs (lint and typecheck) run simultaneously instead of sequentially, so the engineer sees both results within the same time window as the slower of the two.

**Why this priority**: This is the highest-frequency pain point — it affects every single push. Caching eliminates gigabytes of redundant downloads per run. Parallelising lint and typecheck removes one full serial stage from the critical path with zero risk to correctness.

**Independent Test**: Can be fully tested by triggering the pipeline twice in succession without changing `package.json` or `pnpm-lock.yaml`, then verifying that the second run restores from cache and that lint and typecheck job start-times overlap.

**Acceptance Scenarios**:

1. **Given** a pipeline run has completed successfully, **When** a new run is triggered with no changes to dependency files, **Then** the pnpm store, Playwright browsers, and Supabase Docker layers are all restored from cache with no network download.
2. **Given** a new pipeline run starts, **When** the static-analysis stage begins, **Then** the `lint` job and the `typecheck` job both appear as "in progress" simultaneously in the GitHub Actions UI.
3. **Given** `pnpm-lock.yaml` has been modified without a corresponding `package.json` change, **When** the install step runs, **Then** the pipeline fails immediately with a clear lockfile-mismatch error rather than silently updating the lockfile.

---

### User Story 2 — Single Application Build Shared Across All Downstream Jobs (Priority: P2)

An engineer merges a PR. The Next.js application is compiled exactly once. The E2E test runner and the performance test runner both receive the same pre-built output rather than each rebuilding the application independently.

**Why this priority**: `next build` is one of the most time-consuming steps in the pipeline and currently runs twice per commit. Eliminating the duplicate build removes several minutes of wall-clock time and ensures the binary under test is identical in both E2E and perf scenarios.

**Independent Test**: Can be fully tested by inspecting the pipeline graph for a single `build` job and confirming that no `build` step appears in the `playwright` or `perf-gate` jobs; delivering the value of consistent, single-source build artefacts.

**Acceptance Scenarios**:

1. **Given** a commit triggers the pipeline, **When** the build stage completes, **Then** exactly one `pnpm build` execution is recorded across all jobs in that pipeline run.
2. **Given** the application has been built by the dedicated `build` job, **When** the `playwright` job runs, **Then** it downloads the pre-built output from artefact storage and starts the server without rebuilding.
3. **Given** the application has been built by the dedicated `build` job, **When** the `perf-gate` job runs, **Then** it uses the same downloaded artefact to start the server without rebuilding.

---

### User Story 3 — Parallel E2E Suites and Decoupled Quickstart Validation (Priority: P3)

An engineer waits for full E2E coverage. The `baseline` (Chromium) and `playtest` (Firefox) Playwright suites run on separate machines simultaneously rather than sequentially. The `quickstart` developer-setup validation runs independently without blocking E2E results.

**Why this priority**: Removing the sequential Playwright constraint and the `quickstart` gate from the critical path cuts the tail of the pipeline significantly, but requires more structural changes and carries slightly more implementation risk than Tier 1/2 changes.

**Independent Test**: Can be fully tested by observing the pipeline graph: both Playwright matrix entries should show overlapping execution windows, and `quickstart` should complete independently without its result affecting E2E job status.

**Acceptance Scenarios**:

1. **Given** the pipeline reaches the E2E stage, **When** Playwright tests begin, **Then** the `baseline` and `playtest` jobs both appear as "in progress" simultaneously on separate runners.
2. **Given** the `quickstart` job fails (e.g., due to a Docker connectivity issue in the test environment), **When** the pipeline continues, **Then** the `playwright` and `perf-gate` jobs are not blocked and proceed normally.
3. **Given** both Playwright suites complete, **When** the pipeline finishes, **Then** the total E2E wall time is no greater than the duration of the longer of the two suites (not the sum of both).

---

### Edge Cases

- What happens when the Docker layer cache is stale (Supabase CLI version bumped)? Cache must be invalidated by the Supabase CLI version or image digest, not just by time.
- What happens when the `.next/` build artefact upload fails mid-pipeline? Downstream jobs must detect the missing artefact and fail with a clear error rather than attempting to rebuild silently.
- What happens when lint passes but typecheck fails (or vice versa)? Each job must report its own failure independently without one masking the other.
- What happens when the pnpm cache key changes (lockfile updated)? The install step must fall through to a full install and prime a new cache entry.
- What happens if Playwright browser cache is corrupted? The pipeline must detect the corruption (Playwright's built-in validation) and fall back to a full re-install for that run only.

---

## Requirements *(mandatory)*

### Functional Requirements

**Tier 1 — High Impact, Low Effort**

- **FR-001**: The pipeline MUST cache the pnpm content-addressable store between runs, keyed on the hash of `pnpm-lock.yaml`, so that dependency installation on cache-hit runs requires no network downloads.
- **FR-002**: The pipeline MUST cache Playwright browser binaries between runs, keyed on the hash of `package.json`; browsers MUST only be re-downloaded when the key changes.
- **FR-003**: The `lint` and `typecheck` jobs MUST have no dependency relationship and MUST be eligible to start simultaneously at the beginning of every pipeline run.
- **FR-004**: Every `pnpm install` call in the pipeline MUST use the `--frozen-lockfile` flag, causing the step to fail if `pnpm-lock.yaml` is out of sync with `package.json`.
- **FR-005**: The Playwright strategy MUST remove the `max-parallel: 1` constraint so both matrix suites (`baseline` and `playtest`) can run on separate runners simultaneously.

**Tier 2 — High Impact, Medium Effort**

- **FR-006**: The pipeline MUST cache Docker image layers used by the Supabase local stack between runs, so that `supabase start` on a cache-hit run completes without pulling images from the registry.
- **FR-007**: A dedicated `build` job MUST compile the Next.js application once per pipeline run and upload the resulting `.next/` directory as a downloadable workflow artefact.
- **FR-008**: The `playwright` and `perf-gate` jobs MUST download the pre-built application artefact from the `build` job instead of executing `pnpm build` themselves.

**Tier 3 — Medium Impact, Higher Effort**

- **FR-009**: The `quickstart` job MUST be removed from the job-dependency chain that gates the `playwright` and `perf-gate` jobs; it MUST run as an independent job that does not delay downstream jobs. A failure in `quickstart` MUST still mark the overall pipeline as failed — "non-blocking" means it does not prevent other jobs from starting, not that its failures are silently ignored.
- **FR-010**: The `test` (unit) and `integration` jobs MUST be consolidated into a single job that runs both Vitest suites sequentially, reducing one round of checkout and dependency installation. The `lint` and `typecheck` jobs MUST remain as separate parallel jobs to preserve independent failure attribution in the CI UI.

### Assumptions

- GitHub-hosted `ubuntu-latest` runners are retained; no self-hosted or custom runner infrastructure is introduced.
- The `supabase/setup-cli@v1` GitHub Action and Supabase CLI invocation pattern are retained; migration to Supabase service containers is out of scope.
- The `integration` Vitest tests do not require a running Supabase instance (they stub/mock all database calls); this assumption is not changed by this refactor.
- The Docker layer caching mechanism (specific action or cache key strategy) is an implementation detail resolved during the planning phase.
- FR-010 scope is fixed: `test` and `integration` are merged into one job; `lint` and `typecheck` remain separate. No further consolidation is in scope.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No pipeline run re-downloads pnpm packages when `pnpm-lock.yaml` has not changed since the previous successful run on the same branch (the pnpm content-addressable store is restored entirely from cache).
- **SC-002**: No pipeline run re-downloads Playwright browser binaries when `package.json` has not changed since the previous successful run on the same branch.
- **SC-003**: No pipeline run re-pulls Supabase Docker images when the Supabase CLI version and image digests have not changed since the previous successful run.
- **SC-004**: Exactly one `next build` execution is recorded per pipeline run, regardless of how many downstream jobs consume the compiled output.
- **SC-005**: The `lint` and `typecheck` jobs consistently show overlapping execution start times in the GitHub Actions UI on every pipeline run.
- **SC-006**: The `baseline` and `playtest` Playwright suites consistently show overlapping execution start times in the GitHub Actions UI on every pipeline run.
- **SC-007**: A pipeline run where `pnpm-lock.yaml` does not match `package.json` fails at the dependency-install step with a lockfile-mismatch error visible in the job log.
- **SC-008**: A failure in the `quickstart` validation job does not cause the `playwright` or `perf-gate` jobs to be skipped or cancelled, but DOES mark the overall pipeline as failed. The pipeline cannot report success while `quickstart` is failing.
