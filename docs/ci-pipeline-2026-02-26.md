# CI Pipeline — Technical Documentation

> File: `.github/workflows/ci.yml`
> Last analysed: 2026-02-23

---

## Overview

The pipeline is a single GitHub Actions workflow that runs on every push to `main`, `develop`, or any `feature/**` branch, and on every pull request. It consists of **seven jobs** arranged in a strict **serial chain** — no two jobs run concurrently at any point:

```
lint → typecheck → test → integration → quickstart → playwright[baseline] → playwright[playtest] → perf-gate
```

> **Key observation:** The pipeline currently has zero job-level parallelism. Total wall-clock time equals the sum of every job's duration.

---

## Global Environment

| Variable | Value | Purpose |
|---|---|---|
| `NEXT_TELEMETRY_DISABLED` | `1` | Suppresses Next.js anonymous telemetry |
| `HUSKY` | `0` | Disables git hooks inside CI containers |
| `CI` | `true` | Activates CI-specific code paths (e.g. JUnit reporters, secure-cookie flag) |
| `PNPM_VERSION` | `10.28.0` | Pinned across all jobs for reproducibility |

---

## Job 1 — `lint`

**Runner:** `ubuntu-latest` inside a `node:lts` container
**Depends on:** nothing (entry point)

| Step | What happens |
|---|---|
| Checkout | `actions/checkout@v4` — shallow clone |
| Setup PNPM | `pnpm/action-setup@v4` — installs pnpm 10.28.0 |
| Setup Node | `actions/setup-node@v4` with `cache: "pnpm"` — restores pnpm store from cache |
| Install deps | `pnpm install --frozen-lockfile false` — installs node_modules |
| ESLint | `pnpm lint` — ESLint with zero-warnings policy across all `.ts`/`.tsx` files |
| Guard | `pnpm guard:no-service-role` — static analysis script (`scripts/guards/no-service-role-in-client.ts`) that asserts `SUPABASE_SERVICE_ROLE_KEY` is never imported in client-side code |

---

## Job 2 — `typecheck`

**Runner:** `ubuntu-latest` inside a `node:lts` container
**Depends on:** `lint`

| Step | What happens |
|---|---|
| Checkout | Fresh checkout — identical to lint job |
| Setup PNPM + Node | Identical setup, restores the same pnpm cache |
| Install deps | `pnpm install --frozen-lockfile false` again |
| Typecheck | `pnpm typecheck` → `tsc --pretty --noEmit` — full TypeScript strict-mode check, no emit |

---

## Job 3 — `test` (Unit Tests)

**Runner:** `ubuntu-latest` inside a `node:lts` container
**Depends on:** `typecheck`

| Step | What happens |
|---|---|
| Checkout + setup | Identical pattern: pnpm, node cache, install deps |
| Unit tests | `pnpm test:unit` → Vitest with `vitest.config.ts` |

**Vitest config details:**
- Environment: `jsdom` (DOM simulation for React component tests)
- Includes: `tests/unit/**` and `tests/contract/**`
- Excludes: `tests/integration/**`, `tests/perf/**`
- In CI: also emits a JUnit XML report to `reports/vitest.xml`

---

## Job 4 — `integration` (Integration Tests)

**Runner:** `ubuntu-latest` inside a `node:lts` container
**Depends on:** `test`

| Step | What happens |
|---|---|
| Checkout + setup | Identical pattern |
| Integration tests | `pnpm test:integration` → Vitest with `vitest.integration.config.ts` |

**Vitest config details:**
- Environment: `node` (no DOM, real Node.js runtime)
- Includes: `tests/integration/**` (excluding `tests/integration/ui/`)
- The `ui/` subdirectory is excluded — that is reserved for Playwright
- In CI: emits `reports/vitest-integration.xml`

> **Note:** This job runs inside a `node:lts` container with no Supabase instance. If any integration test makes a real database call, it will fail here. These tests are expected to mock or stub all Supabase interactions.

---

## Job 5 — `quickstart`

**Runner:** `ubuntu-latest` (no container — needs Docker socket access)
**Depends on:** `integration`
**Timeout:** 30 minutes
**Secret required:** `SUPABASE_ACCESS_TOKEN`

This job validates that the one-command developer setup (`pnpm quickstart`) works end-to-end.

### Steps

| Step | What happens |
|---|---|
| Install Docker CLI | Conditional: checks if `docker` is present; installs `docker.io` + `lsof` via `apt-get` if not (acts as a compatibility shim for local `act` runner) |
| Checkout + PNPM + Node + Supabase CLI | Full setup; `supabase/setup-cli@v1` downloads the latest Supabase CLI binary |
| Install deps | `pnpm install --frozen-lockfile false` again |
| Run quickstart | `pnpm quickstart` piped through `tee quickstart-log.ndjson` |
| Upload log | `quickstart-log.ndjson` uploaded as a workflow artifact (always, even on failure) |

### What `quickstart.sh` does

The script (`scripts/supabase/quickstart.sh`) executes these stages, emitting NDJSON timing events throughout:

1. **Credential check:** If `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are all pre-set in the environment, Supabase startup is skipped entirely (fast-path for `act`).

2. **Preflight:** Runs `scripts/supabase/preflight.ts` — checks Docker is running and accessible.

3. **`supabase start`:** Pulls and starts the full Supabase local Docker stack. Uses an exponential-backoff retry loop (up to 3 attempts: 2s, 4s, 8s delays), falling back to a `supabase stop` + restart on total failure.

4. **Credential extraction:** Runs `supabase status --output json`, parses the JSON payload to extract `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY`.

5. **`.env.local` sync:** Writes/updates `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY` into `.env.local` (and `.env.production.local` if present).

6. **Migrations:** `pnpm supabase:migrate` → `supabase migration up`

7. **Seed + Verify:** `pnpm tsx scripts/supabase/seed.ts` then `pnpm tsx scripts/supabase/verify.ts`

8. **Supabase stop:** Shuts down the Docker stack (unless `QUICKSTART_DISABLE_STOP=1` is set).

---

## Job 6 — `playwright` (UI Tests)

**Runner:** `ubuntu-latest` (no container)
**Depends on:** `quickstart`
**Timeout:** 45 minutes
**Matrix:** `suite: [baseline, playtest]`
**`max-parallel: 1`** — suites run sequentially to avoid port 3000 collisions

This is the most complex job. It runs the full application stack (Supabase + built Next.js) and executes Playwright browser tests.

### Steps in detail

| Step | What happens |
|---|---|
| Install Docker CLI | Same conditional apt-get shim as quickstart |
| Checkout + PNPM + Node + Supabase CLI | Full setup again |
| Install deps | `pnpm install --frozen-lockfile false` |
| Install Playwright browsers | `pnpm exec playwright install --with-deps` — downloads Chromium + Firefox binaries and all OS-level dependencies (fonts, libs) |
| Start Supabase | Runs `pnpm quickstart` with `QUICKSTART_DISABLE_STOP=1` so Supabase keeps running. Verifies `.env.local` was created. |
| Build Next.js | Sources `.env.local`/`.env.production.local`, then runs `pnpm build` (full `next build`) |
| Start Next.js server | Complex port-clearance loop (tries `lsof`, `fuser`, `ss` in sequence, 10 retries × 2s sleep). Starts `pnpm start` with `setsid` to create a new process group, writes PID to `.next-pid`. Exports all Supabase env vars explicitly because `setsid bash -c` may not inherit them. |
| Ensure Supabase bootstrap | `supabase status` sanity-check; re-runs quickstart if the stack has gone down. |
| Wait for Next.js | Attempts `curl`/`wget` against 3 localhost variants, then calls `pnpm exec wait-on` with 60s timeout |
| Run Playwright tests | Branches on `PLAYWRIGHT_SUITE`: `baseline` → chromium, `--grep-invert "@two-player-playtest"` / `playtest` → firefox, `--grep "@two-player-playtest"` (skipped if no tagged tests exist yet) |
| Stop Next.js | Kills PID from `.next-pid`, kills by port via `lsof`, `pkill` |
| Stop Supabase | `supabase stop` |
| Upload log | `quickstart-playwright-{suite}-log` artifact |

### Playwright config

- `testDir`: `tests/integration/ui`
- Global timeout: 180s; playtest-firefox timeout: 300s
- In CI: `webServer` is `undefined` — the workflow manages the server itself
- Chromium flags in CI: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`

---

## Job 7 — `perf-gate` (Artillery Load Tests)

**Runner:** `ubuntu-latest` (no container)
**Depends on:** `playwright`
**Timeout:** 45 minutes
**Secret required:** `SUPABASE_ACCESS_TOKEN`

Repeats the full Supabase + Next.js stack startup and runs Artillery load tests to enforce latency SLAs.

### Steps

| Step | What happens |
|---|---|
| Install Docker CLI | Same conditional shim |
| Checkout + PNPM + Node + Supabase CLI | Full setup again |
| Install deps | `pnpm install --frozen-lockfile false` |
| Start Supabase | `pnpm quickstart` with `QUICKSTART_DISABLE_STOP=1` |
| Build Next.js | Sources `.env.local`, runs `pnpm build` |
| Start Next.js | Same complex port-clearance + `setsid` startup, writes PID to `.perf-next-pid` |
| Ensure Supabase bootstrap | Same sanity-check as playwright |
| Wait for Next.js | Same `wait-on` with 60s timeout |
| Run Artillery | `artillery run --target http://127.0.0.1:3000 --output artillery-swap.json tests/perf/swap.yml` |
| Assert thresholds | `pnpm exec tsx scripts/perf/assert-artillery-thresholds.ts artillery-swap.json` — fails the job if p95 latency exceeds threshold |
| Stop Next.js + Supabase | Cleanup |
| Upload artifacts | `quickstart-perf.ndjson`, `perf-next.log`, `artillery-swap.json` |

---

## Performance Analysis — Where Time Is Wasted

### 🔴 Critical: Zero Job-Level Parallelism

All jobs form a single linear chain. `lint` and `typecheck` are completely independent of each other and could run in parallel, saving the full wall-clock time of the faster one. `test` depends on source code only and could start alongside `typecheck` immediately after checkout.

**Impact:** The serial chain means the minimum total time is `Σ(all job durations)` when it could be much less with a dependency graph.

---

### 🔴 Critical: Supabase Docker Stack Started 3× on Fresh Runners

The Supabase local stack is started in `quickstart`, `playwright`, and `perf-gate` — each on a fresh `ubuntu-latest` runner with an empty Docker cache. The Supabase stack consists of ~10 Docker images:

| Image | Approximate size |
|---|---|
| `supabase/postgres` | ~800 MB |
| `supabase/gotrue` | ~50 MB |
| `supabase/realtime` | ~100 MB |
| `supabase/storage-api` | ~80 MB |
| `postgrest/postgrest` | ~30 MB |
| `kong` | ~80 MB |
| `supabase/studio` | ~200 MB |
| `supabase/imgproxy` | ~50 MB |
| `supabase/inbucket` | ~20 MB |
| `supabase/vector` | ~80 MB |

**Total: ~1.5–2 GB of Docker pull traffic per run, repeated 3×.** Each `supabase start` on a cold runner can take 3–8 minutes just pulling images over the network.

No Docker layer caching action (`docker/build-push-action`, `satackey/action-docker-layer-caching`, or `actions/cache` targeting `/var/lib/docker`) is used anywhere.

---

### 🔴 Critical: Playwright Browsers Downloaded Every Run

`pnpm exec playwright install --with-deps` downloads:
- Chromium: ~130 MB
- Firefox: ~80 MB
- OS-level system packages (`libx11`, `libatk`, `libnss`, etc.) via `apt-get`

There is no `actions/cache` step for `~/.cache/ms-playwright`. The Playwright cache is re-downloaded from scratch on every run.

---

### 🟠 High: `pnpm install` Runs 7 Times

Every job performs a full `pnpm install --frozen-lockfile false`. While `actions/setup-node` with `cache: "pnpm"` does cache the pnpm content-addressable store (`~/.local/share/pnpm/store`), each job still needs to:
1. Restore the cache (network transfer + decompression)
2. Run `pnpm install` to link packages into `node_modules`

This happens identically in all 7 jobs. Jobs that share the same `node:lts` container image could reuse a single install if consolidated.

---

### 🟠 High: Next.js Built Twice from Scratch

`pnpm build` (a full `next build`) runs in both `playwright` and `perf-gate`. These jobs run on separate runners, so no `.next/` output is shared. Each build takes 1–4 minutes depending on app size and can't be skipped.

No `actions/upload-artifact` / `actions/download-artifact` strategy is used to build once and reuse the output.

---

### 🟠 High: Playwright Matrix is Force-Sequential

```yaml
strategy:
  max-parallel: 1
```

This comment in the file explains it prevents port collisions on port 3000. However, since each matrix job runs on its own fresh runner (different machines), there would be no port collision if the constraint were removed. The `baseline` and `playtest` suites could run in parallel, cutting the combined Playwright time roughly in half.

---

### 🟡 Medium: `quickstart` Job Is a Throwaway

The `quickstart` job spins up Supabase (pulling ~2 GB of images), runs migrations and seeds, then shuts Supabase down again. None of this state is shared with the `playwright` job. The `playwright` job then starts Supabase again from scratch.

The `quickstart` job's purpose is validating the developer setup script works — which is a valid concern — but it currently does no work that downstream jobs can reuse.

---

### 🟡 Medium: `--frozen-lockfile false` Undermines Reproducibility

All seven `pnpm install` calls use `--frozen-lockfile false`. The correct flag for CI is `--frozen-lockfile` (without `false`), which fails if the lockfile is out of sync with `package.json`. The current flag silently updates the lockfile during CI, meaning a stale lockfile would never be caught, and different runs could install different dependency trees.

---

### 🟡 Medium: Integration Tests Have No Database

The `integration` job runs inside a `node:lts` container with no Supabase. If any test in `tests/integration/` makes a real Supabase call, it will silently fail or connect to nothing. Any tests that require the database are likely either mocked (reducing test fidelity) or will time out unexpectedly.

---

## Optimisation Roadmap

### Tier 1 — High Impact, Low Effort

**1. Cache Playwright browsers**

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package.json') }}
```
Saves ~200 MB + apt-get time on every run after the first.

**2. Fix `--frozen-lockfile`**

Change all `pnpm install --frozen-lockfile false` to `pnpm install --frozen-lockfile`. This catches lockfile drift in CI and doesn't change install time.

**3. Parallelize `lint` and `typecheck`**

Remove `needs: lint` from the `typecheck` job. Both only need source code. Start `test` once both pass. This removes one full serial step from the critical path.

---

### Tier 2 — High Impact, Medium Effort

**4. Cache Docker layers for Supabase**

```yaml
- name: Cache Docker layers
  uses: satackey/action-docker-layer-caching@v0.0.11
  continue-on-error: true
```
Or use `actions/cache` targeting `/tmp/.buildx-cache`. After the first run, `supabase start` would use cached layers and complete in seconds instead of minutes.

**5. Build Next.js once, share as artifact**

Add a dedicated `build` job after `test`:
```yaml
build:
  needs: [lint, typecheck, test]
  steps:
    - ... setup ...
    - run: pnpm build
    - uses: actions/upload-artifact@v4
      with:
        name: next-build
        path: .next/
```
Both `playwright` and `perf-gate` download the artifact instead of rebuilding. Saves 2–8 minutes per run.

**6. Remove `max-parallel: 1` from Playwright matrix**

Since each matrix job runs on its own runner, there are no shared ports. The `baseline` (chromium) and `playtest` (firefox) suites can run in parallel, halving the Playwright wall time.

---

### Tier 3 — Medium Impact, Higher Effort

**7. Merge the first four serial jobs**

`lint`, `typecheck`, `test`, and `integration` all run in a `node:lts` container and install the same dependencies. Consolidating them into a single job with sequential steps eliminates 3 rounds of checkout + cache restore + `pnpm install`, saving several minutes of overhead.

**8. Use Supabase as a reusable service**

Replace `supabase start` with a shared `supabase-stack` job that outputs the running service URL and credentials via job outputs or a shared artifact. `playwright` and `perf-gate` then download the credentials rather than re-bootstrapping. This reduces Supabase startups from 3 to 1 per pipeline run.

Alternatively, explore using `supabase/postgres` as a GitHub Actions service container directly (bypassing the full local stack overhead for jobs that only need a database).

**9. Decouple `quickstart` validation from the critical path**

Move the `quickstart` job to run in parallel with (or after) `playwright`, since it only validates the developer setup script and its output is never consumed by another job. It should not gate the E2E tests.

---

## Proposed Job Graph (After Optimisations)

```
              ┌──────────┐  ┌────────────┐
              │   lint   │  │ typecheck  │  ← parallel
              └────┬─────┘  └─────┬──────┘
                   └──────┬───────┘
                      ┌───▼────┐
                      │  test  │  (unit + integration, merged)
                      └───┬────┘
                      ┌───▼────┐
                      │ build  │  (next build, upload artifact)
                      └───┬────┘
          ┌───────────────┼───────────────┐
     ┌────▼─────┐   ┌─────▼──────┐  ┌────▼──────┐
     │playwright│   │ playwright │  │ perf-gate │  ← all parallel
     │ baseline │   │  playtest  │  │           │
     └──────────┘   └────────────┘  └───────────┘
                           │
                    ┌──────▼──────┐
                    │  quickstart │  ← runs last, not gating
                    │ (validation)│
                    └─────────────┘
```

This graph reduces the critical path from **7 serial jobs** to **4 serial stages**, with the expensive E2E and perf jobs running in parallel.
