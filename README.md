# Wottle

## Overview

Wottle is a competitive two-player real-time word duel. Players swap tiles on a 10×10 board to form
Icelandic words, under a per-round clock and with spatial tile-freezing strategy. The core gameplay
loop — swap → find words → score → freeze — is functional and covered by tests.

Default match configuration (`lib/constants/game-config.ts`):

| Setting             | Value                |
| ------------------- | -------------------- |
| Board size          | 10×10                |
| Rounds per match    | 5                    |
| Time per round      | 60s                  |
| Minimum word length | 3 letters            |
| Scoring directions  | horizontal, vertical |
| Language            | Icelandic (`is`)     |

Word validity is decided against the BÍN-derived Icelandic word list in `data/wordlists/`
(`word_list_is.txt`, with `word_list_is_exclusions.txt` as the curation overlay).

## Technology Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database/Backend**: Supabase (PostgreSQL, Realtime, Auth)
- **Package manager**: pnpm
- **Testing**:
  - **E2E**: Playwright
  - **Unit / integration / contract**: Vitest
  - **Performance**: Artillery

## Project Structure

- **`app/`**: Next.js application routes, pages, and Server Actions.
- **`components/`**: React components (`game/`, `match/`, and shared UI).
- **`lib/`**: Domain logic and backend services — game engine, scoring, match state machine, types.
- **`data/wordlists/`**: Dictionaries. Icelandic is the live language; the other lists are unused holdovers.
- **`specs/`**: Speckit feature specifications (see below).
- **`docs/`**: Requirements, architecture, design docs, and proposals.
- **`scripts/`**: Supabase setup/seed/verify utilities, perf assertions, and guards.
- **`tests/`**: Test suites (`unit/`, `integration/`, `contract/`, `perf/`).

## Development Status

The project follows a spec-driven workflow using [Speckit](#speckit-workflow).

**Shipped Speckit specs** (`specs/`): `001-e2e-board-scaffold` through `019-lobby-visual-foundation`,
plus `042-instant-scoring-reveal` and `043-scoring-resolution-viz`. The `020`–`041` range was used for
the Warm Editorial visual redesign, which was tracked as phase branches and plans under
`docs/superpowers/plans/` rather than as `specs/` directories — that is why the `specs/` numbering has
a gap.

> **Note on spec status headers**: individual `spec.md` files often still read `**Status**: Draft` even
> after the feature has shipped. Treat git merge history, not the spec header, as the record of what is
> done.

## Key Documents

| Document                                                     | Why it matters                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/prd_and_requirements/wottle_game_rules.md`             | **Authoritative** rules spec: per-letter coverage rule, scoring formula, validation algorithm, board invariants, and the regression log. Mandatory reading before touching `lib/game-engine/*`, `lib/match/roundEngine.ts`, `lib/match/stateMachine.ts`, `lib/scoring/*`, or `lib/constants/game-config.ts`. |
| `docs/prd_and_requirements/wottle_prd.md`                    | Product requirements.                                                                                                                                                                                                                                                                                        |
| `docs/prd_and_requirements/wottle_technical_architecture.md` | System architecture.                                                                                                                                                                                                                                                                                         |
| `.specify/memory/constitution.md`                            | Non-negotiable engineering principles (server-authoritative game logic, latency budgets, TDD).                                                                                                                                                                                                               |
| `CLAUDE.md`                                                  | Working guidance for AI agents in this repo.                                                                                                                                                                                                                                                                 |

## Key Entities

- **PlayerIdentity**: User profile and session.
- **LobbyPresence**: Real-time status of players in the lobby.
- **MatchState**: Game session state, including board seed and rounds.
- **MoveSubmission**: A player's move for a round.

## Speckit Workflow

All feature work follows spec-driven development:

1. **Specify**: Define requirements in `specs/`.
2. **Clarify**: Resolve ambiguities.
3. **Plan**: Create an implementation plan with technical context.
4. **Tasks**: Generate ordered, actionable tasks.
5. **Implement**: Execute with TDD — RED tests before implementation.
6. **Verify**: Run automated tests and manual verification.

## Environment

Run `pnpm quickstart`. It validates Supabase CLI prerequisites, starts the Docker stack, applies
migrations, seeds data, and writes `.env.local` for you. There are no committed `.env.example` files —
`quickstart` is the supported path to a working local environment.

| Variable                            | Description                                                                           | Default                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`          | Supabase REST URL used by the browser                                                 | `http://localhost:54321`                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Public anon key for browser calls                                                     | `anon-key-from-supabase-cli`            |
| `SUPABASE_ANON_KEY`                 | Server-side anon key (used by quickstart + tests)                                     | matches `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY`         | Server-only key for Server Actions                                                    | `service-role-key-from-supabase-cli`    |
| `SUPABASE_DB_PASSWORD`              | Optional Postgres password for CLI scripts                                            | `postgres-password`                     |
| `PLAYTEST_INVITE_EXPIRY_SECONDS`    | How long direct invites remain valid before expiring                                  | `30`                                    |
| `PLAYTEST_MAX_CONCURRENT_MATCHES`   | Guardrail limiting simultaneous matches on a single Supabase stack                    | `20`                                    |
| `NEXT_PUBLIC_ENABLE_PLAYTEST_LOBBY` | Set to `true` to surface lobby preview UI                                             | _unset_ (false)                         |
| `NEXT_PUBLIC_ENABLE_PLAYTEST_MATCH` | Set to `true` to surface match summary preview UI                                     | _unset_ (false)                         |
| `PLAYTEST_SESSION_SECURE`           | Force secure cookies (`true`/`false`); override for local Playwright                  | auto (`true` in production)             |
| `RATE_LIMIT_DISABLED_SCOPES`        | Comma-separated list of scopes to bypass (e.g., `auth:login`)                         | _unset_                                 |
| `CRON_SECRET`                       | Shared secret for `/api/cron/*` routes; must match Postgres `app.cron_secret` setting | _unset_ (required in prod)              |

Tweak the playtest-related values when simulating heavier loads; e.g., increase
`PLAYTEST_MAX_CONCURRENT_MATCHES` when running soak tests on a beefier Supabase instance, or lower
`PLAYTEST_INVITE_EXPIRY_SECONDS` to keep the lobby tidy during short feedback sessions.

### pg_cron sweep (production / Supabase Cloud)

Migration `20260424001_sweep_stale_matches.sql` registers a 30-second pg_cron job that POSTs
`/api/cron/sweep-stale-matches` to auto-finalise matches stuck `in_progress` with no live presence on
either side (issue #180). After deploying:

1. Set `CRON_SECRET` in the Vercel project env (any random value).
2. In the Supabase SQL editor, configure the matching Postgres settings:
   ```sql
   alter database postgres set app.app_url = 'https://wottle.example.com';
   alter database postgres set app.cron_secret = 'same-value-as-CRON_SECRET';
   ```
3. Verify the job is firing:
   ```sql
   select start_time, status, return_message
   from cron.job_run_details
   where jobname = 'sweep-stale-matches'
   order by start_time desc
   limit 5;
   ```

The local Supabase Docker image keeps pg_cron loaded, but the schedule body uses
`current_setting(..., true)` so missing `app.app_url` / `app.cron_secret` resolve to NULL and
`net.http_post` no-ops harmlessly. The `find_orphaned_matches()` SQL function is portable and is safe
to invoke directly for ad-hoc cleanup.

## Scripts

### Development

| Command           | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `pnpm quickstart` | One-command setup: Supabase preflight, Docker stack, migrations, seed, and `.env.local`. |
| `pnpm dev`        | Starts the Next.js dev server (requires `.env.local`).                                   |
| `pnpm build`      | Production build.                                                                        |
| `pnpm start`      | Serves the production build.                                                             |
| `pnpm lint`       | ESLint, zero-warnings policy.                                                            |
| `pnpm typecheck`  | TypeScript compilation check (`tsc --noEmit`).                                           |

### Testing

| Command                     | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `pnpm test`                 | Alias for `test:unit`.                                                |
| `pnpm test:unit`            | Vitest unit + contract suite.                                         |
| `pnpm test:integration`     | Vitest integration/regression suite (Supabase-backed).                |
| `pnpm exec playwright test` | Browser automation suite (CI starts Supabase + server automatically). |

### Performance

| Command                      | Assertion                                  |
| ---------------------------- | ------------------------------------------ |
| `pnpm perf:lobby-presence`   | Lobby broadcast < 2s p95.                  |
| `pnpm perf:round-resolution` | Round resolution RTT < 200ms p95.          |
| `pnpm perf:instant-scoring`  | Instant scoring reveal RTT < 200ms p95.    |
| `pnpm perf:swap`             | Legacy swap latency (regression baseline). |

### Supabase & guards

| Command                      | Description                                             |
| ---------------------------- | ------------------------------------------------------- |
| `pnpm supabase:migrate`      | Apply pending migrations.                               |
| `pnpm supabase:seed`         | Seed test data.                                         |
| `pnpm supabase:reset`        | Drop data and reapply migrations.                       |
| `pnpm supabase:verify`       | Check schema, RLS, and observability hooks.             |
| `pnpm supabase:policies`     | Verify RLS policy coverage.                             |
| `pnpm supabase:logs`         | Export Supabase logs.                                   |
| `pnpm guard:no-service-role` | Fail if the service-role key leaks into client bundles. |

## Testing

The project follows Test-Driven Development. All code changes must have corresponding tests.

### Test Suites

- **Unit Tests** (`tests/unit/`): Vitest tests for domain logic, utilities, and components
- **Integration Tests** (`tests/integration/`): Vitest tests for API endpoints and server actions
- **Contract Tests** (`tests/contract/`): OpenAPI-backed tests for REST endpoints
- **E2E Tests** (`tests/integration/ui/`): Playwright browser automation for full user flows
- **Performance Tests** (`tests/perf/`): Artillery load tests for latency SLAs

### Running Tests

```bash
# Unit tests only
pnpm test:unit

# Integration tests (requires Supabase running)
pnpm test:integration

# Playwright E2E tests (requires Supabase + Next.js server)
pnpm exec playwright test

# Performance tests (requires Supabase + Next.js server)
pnpm perf:swap
pnpm perf:lobby-presence
pnpm perf:round-resolution
pnpm perf:instant-scoring
```

Single-test execution:

```bash
pnpm test:unit -- path/to/test.spec.ts
pnpm test:integration -- path/to/integration-test.spec.ts
pnpm exec playwright test --grep "test name"
```

### CI Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs these jobs:

1. **lint**: ESLint with zero warnings policy
2. **typecheck**: TypeScript compilation check
3. **test**: Vitest unit + contract suite
4. **build**: Next.js production build
5. **quickstart**: Supabase stack validation
6. **playwright**: Dual-session E2E tests (baseline + playtest suites)
7. **perf-gate**: Artillery latency assertions

### Test Helpers

Playwright tests use retry helpers (`tests/integration/ui/helpers/matchmaking.ts`) to handle race
conditions in matchmaking operations. These helpers implement exponential backoff and polling to
ensure reliable test execution when two players click "Start Game" simultaneously.

### Test Artifacts

CI uploads test artifacts:

- `quickstart-log.ndjson`: Supabase startup logs
- `quickstart-playwright-{suite}-log.ndjson`: Playwright test execution logs
- `perf-artifacts`: Artillery performance reports and server logs

See `specs/002-two-player-playtest/quickstart.md` for a detailed flow covering dual-browser playtests.
