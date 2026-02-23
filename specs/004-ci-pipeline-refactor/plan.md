# Implementation Plan: CI Pipeline Refactor

**Branch**: `004-ci-pipeline-refactor` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-ci-pipeline-refactor/spec.md`

## Summary

Refactor `.github/workflows/ci.yml` to eliminate per-run gigabyte re-downloads and unnecessary serial job execution. The approach uses pnpm store caching, Playwright browser caching, and Docker image caching to eliminate redundant downloads; a shared Next.js build artifact to run `pnpm build` exactly once per pipeline; and job topology changes (parallel static analysis, decoupled `quickstart`, removed `max-parallel: 1`) to shorten the critical path. All changes are constrained to the single workflow YAML file. No TypeScript, schema, or runtime code changes.

Requirements are structured in three implementation tiers (FR-001–FR-010) matching the analysis in `docs/ci-pipeline-2026-02-26.md`.

## Technical Context

**Language/Version**: YAML (GitHub Actions workflow syntax); TypeScript 5.x / Node.js 20 (project language — unchanged)
**Primary Dependencies**: `actions/cache@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `supabase/setup-cli@v1`, `pnpm/action-setup@v4`, `actions/setup-node@v4`
**Storage**: N/A for application data. GitHub ephemeral artifact storage used within runs (`retention-days: 1` for build artifact). `actions/cache@v4` used for pnpm store, Playwright browsers, and Docker image archive across runs.
**Testing**: Manual pipeline inspection — trigger twice in succession; verify GitHub Actions UI shows overlapping job start times; check build logs for `Cache restored` messages and exactly one `next build` call; verify SC-007 on a branch with a stale lockfile.
**Target Platform**: GitHub-hosted `ubuntu-latest` runners (x86-64 Linux). No self-hosted or custom runner infrastructure.
**Project Type**: single (one file modification: `.github/workflows/ci.yml`)
**Performance Goals**: Eliminate ~1.5–2 GB Docker image re-pull per run; eliminate duplicate `pnpm build` (1–4 min per occurrence); reduce serial pipeline stages from 7 to 4; `lint` and `typecheck` overlap; both Playwright suites overlap.
**Constraints**: GitHub-hosted `ubuntu-latest` runners retained; `supabase/setup-cli@v1` action retained; no service containers; no self-hosted runners; 10 GB per-artifact upload limit (not a practical constraint — archive is ~1.8 GB).
**Scale/Scope**: Single workflow file (`.github/workflows/ci.yml`, currently 772 lines). No new source files, no schema migrations, no TypeScript changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| Server-Authoritative Game Logic | ✅ N/A | CI infrastructure — no game state code modified |
| Real-Time Performance Standards | ✅ N/A | No runtime code changes; no impact on RTT/latency SLAs |
| Type-Safe End-to-End | ✅ N/A | YAML workflow file only; no TypeScript changes |
| TDD Workflow (Red → Green → Refactor) | ✅ N/A | GitHub Actions YAML is configuration, not application code. No applicable test framework exists for workflow YAML. Acceptance is validated against the spec's acceptance scenarios via pipeline inspection. |
| Clean Code Principles | ✅ PASS | Single-responsibility jobs; clear naming; minimal duplication. Repeated checkout/install per job is unavoidable in GitHub Actions (no shared filesystem across jobs). |

**Result**: All gates pass. No violations to justify. No Complexity Tracking required.

**Post-design re-check** (after Phase 1): All gates remain clear. The topology changes in Phase 1 add no game logic or TypeScript; each job retains a single responsibility; no new abstraction layers introduced.

## Project Structure

### Documentation (this feature)

```text
specs/004-ci-pipeline-refactor/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # N/A — no data entities in this feature
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── ci.yml           # PRIMARY CHANGE TARGET — the only file modified
```

**Structure Decision**: This feature modifies exactly one file: `.github/workflows/ci.yml`. No new source directories, TypeScript files, tests, or schema migrations are introduced. The implementation is a YAML-only refactor.

---

## Implementation Design

### Current pipeline topology

```
lint → typecheck → test → integration → quickstart → playwright[baseline,playtest,max-parallel:1] → perf-gate
```

Seven serial stages. Every job waits for the previous before starting. The Playwright matrix runs its two entries one at a time (`max-parallel: 1`). The `quickstart` job gates all E2E work. Every job runs `pnpm install --frozen-lockfile false`. `playwright` and `perf-gate` each run `pnpm build` independently.

### Target pipeline topology

```
                            ┌─→ lint ─────────┐
                            │                 ├─→ test (unit+integration) ─→ build ─┬─→ playwright/baseline ┐
workflow trigger ───────────┤                 │                                      ├─→ playwright/playtest │ (parallel)
                            └─→ typecheck ────┘                                      └─→ perf-gate           ┘

workflow trigger ───────────→ quickstart  (independent — no needs, no downstream dependency)
```

Four serial stages on the critical path. `lint` and `typecheck` overlap on separate runners. Both Playwright suites run on separate runners. `quickstart` runs in parallel with everything else from the moment the workflow triggers.

---

### Tier 1: High Impact, Low Effort (FR-001–FR-005)

**FR-001 — pnpm store cache**

Replace the manual `--store-dir` flag workaround with `actions/setup-node@v4` built-in pnpm caching. Setting `cache: "pnpm"` on every `setup-node` step caches `~/.local/share/pnpm/store` automatically, keyed on `pnpm-lock.yaml`.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: "pnpm"
```

No additional `actions/cache` step is needed. The built-in support handles key generation, restore, and post-run save automatically.

---

**FR-002 — Playwright browser cache**

Add `actions/cache@v4` keyed on `hashFiles('package.json')` targeting `~/.cache/ms-playwright` before each `playwright install` step. `--with-deps` must still run on cache hits to install OS packages (not stored in the browser binary cache).

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package.json') }}
```

No `restore-keys` needed — a cache miss causes a full re-install, which is correct behaviour.

---

**FR-003 — Parallel lint and typecheck**

Remove all `needs:` entries from `lint` and `typecheck`. Both jobs start at workflow trigger and run concurrently on separate runners. Add `needs: [lint, typecheck]` to the consolidated `test` job.

```yaml
lint:
  # No needs: — runs immediately

typecheck:
  # No needs: — runs immediately, parallel to lint

test:
  needs: [lint, typecheck]   # Waits for both
```

---

**FR-004 — `--frozen-lockfile` enforcement**

All `pnpm install` calls currently use `--frozen-lockfile false` (an explicit opt-out of lockfile enforcement). Change all occurrences:

```yaml
# Before (in all 7 jobs):
run: pnpm install --frozen-lockfile false

# After:
run: pnpm install --frozen-lockfile
```

This causes the step to fail immediately with a lockfile-mismatch error when `pnpm-lock.yaml` is out of sync with `package.json`, satisfying SC-007.

---

**FR-005 — Remove `max-parallel: 1` from Playwright matrix**

Delete the `max-parallel: 1` line from the Playwright job `strategy:` block:

```yaml
strategy:
  fail-fast: false
  # max-parallel: 1  ← DELETE THIS LINE
  matrix:
    suite:
      - baseline
      - playtest
```

Each matrix entry will now start on its own runner as soon as the `build` job completes, satisfying SC-006.

---

### Tier 2: High Impact, Medium Effort (FR-006–FR-008)

**FR-006 — Supabase Docker layer cache**

Add the Docker image caching sequence before `pnpm quickstart` (or `supabase start`) in every job that starts Supabase: `playwright` (baseline and playtest), `perf-gate`, and the standalone `quickstart` job.

Step ordering is mandatory (CLI must be installed before its version can be captured):

```yaml
- name: Setup Supabase CLI
  uses: supabase/setup-cli@v1
  with:
    version: latest  # Pin to a specific version for stable cache keys (see research.md)

- name: Capture CLI version for Docker cache key
  id: supabase-version
  run: echo "version=$(supabase --version)" >> $GITHUB_OUTPUT

- name: Restore Supabase Docker image cache
  id: docker-cache
  uses: actions/cache@v4
  with:
    path: /tmp/supabase-docker-cache.tar
    key: supabase-docker-${{ runner.os }}-${{ steps.supabase-version.outputs.version }}
    # No restore-keys — partial image sets cause supabase start to fail

- name: Load cached Docker images
  if: steps.docker-cache.outputs.cache-hit == 'true'
  run: docker load -i /tmp/supabase-docker-cache.tar

- name: Start Supabase
  run: pnpm quickstart   # or: supabase start

- name: Export Docker images to cache
  if: steps.docker-cache.outputs.cache-hit != 'true'
  continue-on-error: true  # Export failure must not block the run
  run: |
    docker save \
      $(docker images --format "{{.Repository}}:{{.Tag}}" \
        | grep -E 'supabase|postgres|kong|gotrue|postgrest') \
      -o /tmp/supabase-docker-cache.tar
```

---

**FR-007 — Dedicated `build` job**

Add a new `build:` job with `needs: test`. It runs `pnpm build` once and uploads the `.next/` directory as a workflow artifact (excluding the incremental build cache, which is not needed at runtime):

```yaml
build:
  name: Build Next.js
  runs-on: ubuntu-latest
  needs: test
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: ${{ env.PNPM_VERSION }}
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
      env:
        NEXT_TELEMETRY_DISABLED: 1
    - name: Upload Next.js build artifact
      uses: actions/upload-artifact@v4
      with:
        name: next-build-${{ github.run_id }}-${{ github.run_attempt }}
        path: |
          .next/
          !.next/cache/
          !.next/trace
        if-no-files-found: error
        retention-days: 1
```

Note: The `build` job does not need a running Supabase instance. It uses placeholder env values at build time (`http://localhost:54321`). Real values are injected at server start by the consumer jobs via the existing `setsid` pattern.

---

**FR-008 — Download artifact in consumer jobs**

In `playwright` and `perf-gate`, replace the `pnpm build` step with:

```yaml
- name: Download Next.js build artifact
  uses: actions/download-artifact@v4
  with:
    name: next-build-${{ github.run_id }}-${{ github.run_attempt }}
    path: .next/

- name: Verify build artifact integrity
  run: |
    if [ ! -f .next/BUILD_ID ]; then
      echo "ERROR: .next/BUILD_ID not found — artifact incomplete or download failed"
      ls -la .next/ || echo ".next/ is empty"
      exit 1
    fi
    echo "Build artifact OK. BUILD_ID: $(cat .next/BUILD_ID)"
```

Also update `needs:` on both consumer jobs: remove `quickstart` / `integration` and replace with `build`.

---

### Tier 3: Medium Impact, Higher Effort (FR-009–FR-010)

**FR-009 — Decouple `quickstart` job**

Two line changes:

1. Remove `needs: integration` from the `quickstart` job definition.
2. Remove `needs: quickstart` from the `playwright` job definition (already replaced with `needs: build` in FR-008).

No `continue-on-error`, no `always()` check job, no `if:` conditions. GitHub fails the workflow automatically when any job fails — the non-blocking + pipeline-failing semantics are native to GitHub Actions (see research.md Area 3).

---

**FR-010 — Merge `test` and `integration` into one job**

Create a single `test` job replacing both the current `test` (unit) and `integration` jobs. Delete the `integration` job entirely.

```yaml
test:
  name: Unit + Integration Tests
  runs-on: ubuntu-latest
  needs: [lint, typecheck]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: ${{ env.PNPM_VERSION }}
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm test:unit
    - run: pnpm test:integration
```

Both Vitest suites run sequentially in one job. This eliminates one round of checkout and dependency installation per run. The `build` job `needs: test` (singular). `lint` and `typecheck` remain separate parallel jobs, preserving independent failure attribution in the GitHub Actions UI.

Confirmed viable: `vitest.integration.config.ts` uses `environment: node` and `tests/integration/**` (excluding `tests/integration/ui/**`). Integration tests do not require a running Supabase instance — all database calls are mocked.

---

## Final Job Dependency Graph

```
Jobs with no `needs:`:
  lint          → starts at trigger
  typecheck     → starts at trigger
  quickstart    → starts at trigger (independent; failure marks workflow FAILED)

Jobs gated on [lint, typecheck]:
  test (unit+integration) → needs: [lint, typecheck]

Jobs gated on test:
  build → needs: test

Jobs gated on build:
  playwright/baseline  → needs: build
  playwright/playtest  → needs: build
  perf-gate            → needs: build
```

Total jobs: 8 (was 7; added `build`, merged `test`+`integration`, removed `integration`).
Critical path stages: 4 (was 7).
