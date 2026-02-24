# Phase 0 Research: CI Pipeline Refactor

**Date**: 2026-02-23
**Branch**: `004-ci-pipeline-refactor`
**Spec**: [spec.md](./spec.md)

---

## Research Area 1: Docker Layer Caching in GitHub Actions

**Question**: What is the correct mechanism for caching Supabase Docker image layers between GitHub Actions runs? (FR-006)

### Decision

Use `docker save` / `docker load` combined with `actions/cache@v4`, keyed on the installed Supabase CLI version string.

### Step ordering (mandatory)

The Supabase CLI version cannot be captured until the CLI is installed. This reverses the typical "restore cache first" pattern:

```yaml
# 1. Install CLI first (required to get the version string)
- name: Setup Supabase CLI
  uses: supabase/setup-cli@v1
  with:
    version: latest   # Recommended: pin to a specific version (e.g. 2.15.0)

# 2. Capture version string — this IS the cache key
- name: Capture CLI version for cache key
  id: supabase-version
  run: echo "version=$(supabase --version)" >> $GITHUB_OUTPUT

# 3. Restore cache — exact match only, no restore-keys
- name: Restore Supabase Docker image cache
  id: docker-cache
  uses: actions/cache@v4
  with:
    path: /tmp/supabase-docker-cache.tar
    key: supabase-docker-${{ runner.os }}-${{ steps.supabase-version.outputs.version }}
    # No restore-keys — a partial image set causes supabase start to fail

# 4. Load images on cache hit (before supabase start)
- name: Load cached Docker images
  if: steps.docker-cache.outputs.cache-hit == 'true'
  run: docker load -i /tmp/supabase-docker-cache.tar

# 5. Start Supabase (pulls from registry on cache miss; uses loaded images on hit)
- name: Start Supabase
  run: pnpm quickstart   # or: supabase start

# 6. Export images to cache on miss (continue-on-error: true — export failure must not block the run)
- name: Export Docker images to cache
  if: steps.docker-cache.outputs.cache-hit != 'true'
  continue-on-error: true
  run: |
    docker save \
      $(docker images --format "{{.Repository}}:{{.Tag}}" \
        | grep -E 'supabase|postgres|kong|gotrue|postgrest') \
      -o /tmp/supabase-docker-cache.tar
```

### Rationale

- The Supabase CLI version string identifies the exact image set the CLI requires. Keying the cache on it ensures the cache invalidates whenever the CLI (and thus its required images) changes.
- **No `restore-keys` fallback** is intentional. A partial Supabase image set causes `supabase start` to fail with cryptic "image not found" errors rather than a clean "cache miss, pulling from registry." The cache must match exactly or not at all.
- `continue-on-error: true` on the export step only — a Docker save failure should not block the CI run; the next run will simply re-pull and retry.
- Compressed archive size: ~1.8 GB, within GitHub's 5 GB per-entry cache limit.

### Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| `satackey/action-docker-layer-caching` | Unmaintained (last commit 2021); 4–6 min restore time due to individual-layer approach; known reliability issues on modern runners |
| Cache `/var/lib/docker` directly via `actions/cache` | Docker daemon corruption on restore; explicitly unsupported pattern; daemon must be stopped to access the directory |
| `docker/build-push-action` with cache-from/cache-to | Designed for building images, not caching pre-pulled registry images |
| Accept the re-pull cost each run | ~1.5–2 GB per run on every push; `supabase start` taking 3–6 min on cold runs |

### Additional recommendation

**Pin the Supabase CLI version** (e.g., `version: 2.15.0`) instead of `latest`. Using `latest` means the cache key changes on every Supabase CLI release, causing an unexpected miss. Pinning gives a stable cache key and reproducible image versions across all runs.

---

## Research Area 2: Next.js Build Artifact Sharing

**Question**: What is the correct pattern for sharing the `.next/` directory from a `build` job to `playwright` and `perf-gate` consumer jobs within a single pipeline run? (FR-007, FR-008)

### Decision

Upload with `actions/upload-artifact@v4` in the `build` job; download with `actions/download-artifact@v4` in each consumer job.

### Configuration

| Parameter | Value | Rationale |
|---|---|---|
| `name` | `next-build-${{ github.run_id }}-${{ github.run_attempt }}` | Run-scoped; handles re-runs without collision; human-readable in UI |
| `retention-days` | `1` | Ephemeral build artifact; no value beyond this run; minimises storage quota impact |
| `path` (upload) | `.next/` excluding `.next/cache/` and `.next/trace` | The build cache is for incremental rebuilds only; excluding it can halve artifact size |
| `if-no-files-found` | `error` | Fail the `build` job loudly if `pnpm build` produced no output |
| `compression-level` | `6` (default) | Good balance of speed and ratio for JS bundles |
| `path` (download) | `.next/` | `download-artifact@v4` places files directly under `.next/`, no wrapper directory |

### Upload step

```yaml
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

### Download step + mandatory integrity check

```yaml
- name: Download Next.js build artifact
  uses: actions/download-artifact@v4
  with:
    name: next-build-${{ github.run_id }}-${{ github.run_attempt }}
    path: .next/

- name: Verify build artifact integrity
  run: |
    if [ ! -f .next/BUILD_ID ]; then
      echo "ERROR: .next/BUILD_ID not found — artifact is incomplete or download failed"
      ls -la .next/ || echo ".next/ is empty"
      exit 1
    fi
    echo "Build artifact OK. BUILD_ID: $(cat .next/BUILD_ID)"
```

### Build-time vs. runtime env var handling

The project uses App Router with no static export. `NEXT_PUBLIC_SUPABASE_URL` and related variables are read at server startup, not statically inlined into the bundle at build time. The `build` job can run with placeholder values (`http://localhost:54321`). Real values are injected at server start via the existing `setsid bash -c "export NEXT_PUBLIC_SUPABASE_URL=..."` pattern already present in the workflow.

### Timing expectations

- Upload: 15–60 seconds (80–150 MB compressed after excluding `.next/cache/`)
- Download: 10–40 seconds
- Net saving per run: 1–3 minutes (one full `pnpm build` eliminated, 2 download operations added)

### Rationale

- `upload-artifact@v4` (Nov 2023, Artifact API v2) streams directly to Azure Blob Storage — significantly faster than v3 for large directories.
- Excluding `.next/cache/` is critical: the incremental build cache can be larger than the rest of `.next/` combined. Excluding it reduces wire transfer and storage without affecting `pnpm start`.
- `if-no-files-found: error` prevents a silent `pnpm build` failure from allowing downstream jobs to attempt to start a server with no build output.

### Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| `actions/cache` for within-run data sharing | Cache is designed for cross-run reuse with eviction semantics; artifact has deterministic 1-day TTL and is scoped to the exact run |
| Pre-compress with `tar.gz` before upload | Double-compression (tar.gz + action's internal zip) is counterproductive; complicates download step (must un-tar after) |
| Each job runs `pnpm build` independently (current) | 2 duplicate builds per run; no guarantee of identical binary under test (env vars may differ) |
| Self-hosted runner with shared filesystem | Out of scope per spec assumptions (GitHub-hosted runners retained) |

---

## Research Area 3: Quickstart Job Failure Semantics

**Question**: How do you make the `quickstart` job run independently (not gating downstream jobs) while still marking the overall workflow as FAILED when it fails? (FR-009, SC-008)

### Decision

**No special mechanism required.** Remove `quickstart` from all `needs:` chains. GitHub Actions automatically marks the workflow run as `failure` when any job fails, regardless of that job's position in the dependency graph.

### Implementation (two line changes)

```yaml
# BEFORE:
quickstart:
  needs: integration   # ← remove this
  ...
playwright:
  needs: quickstart    # ← change to: needs: build

# AFTER:
quickstart:
  # No needs: entry — starts immediately at workflow trigger
  ...
playwright:
  needs: build          # Gates on build only; quickstart runs in parallel
```

That is the complete change. No `continue-on-error`, no `always()` check job, no extra YAML.

### Failure propagation mechanics

GitHub Actions computes the workflow result as the aggregate of all job results. A job that exits with a non-zero status — regardless of its dependency topology — turns the workflow run status to `failure`. This status is published to the GitHub Checks API and blocks PR merges when the workflow is configured as a required status check.

The key distinction: "non-blocking" in FR-009 means `quickstart` does not prevent `playwright` or `perf-gate` from starting. It does **not** mean `quickstart` failures are ignored. Both things are true simultaneously with no extra YAML.

### What NOT to use

| Mechanism | Effect | Why wrong for this use case |
|---|---|---|
| `continue-on-error: true` on `quickstart` | Marks the job as **succeeded** regardless of exit code | Hides failures; pipeline appears green when quickstart fails — directly violates SC-008 |
| `always()` + `toJSON(needs)` check job | Creates a single named required status check | Unnecessary complexity; only needed if branch protection lists a single job name rather than the workflow |
| `if: always()` on downstream jobs | Downstream jobs run even if their `needs:` failed | Not applicable after removing `needs: quickstart` from downstream jobs |

### Branch protection compatibility

If branch protection requires the workflow by name (e.g., "CI"), a failed `quickstart` blocks merges automatically. The `always()` check job pattern is only needed if branch protection is configured to require a single named job (e.g., `CI / ci-status`) rather than the workflow itself.
