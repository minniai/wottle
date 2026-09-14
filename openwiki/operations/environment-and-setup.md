---
type: operations-guide
title: Environment, Configuration & Local Setup
description: How to bring up a working local Wottle stack with pnpm quickstart, plus the environment variables, feature flags, game-config constants, and supabase:* operational scripts that configure the app and its Supabase backend.
tags: [environment, configuration, local-setup, supabase, feature-flags, quickstart, operations]
verified:
  - by: openwiki/0.5.1
    at: 2026-09-10T18:17:19.733Z
sources:
  - id: openwiki-source-119bc1d3af98868804e83f96
    resource: repo://app/api/cron/sweep-stale-matches/route.ts
  - id: openwiki-source-4eeca2e16b9397b8b131c42d
    resource: repo://lib/constants/featureFlags.ts
  - id: openwiki-source-92d702cc00f5d0b5a8b40861
    resource: repo://lib/constants/game-config.ts
  - id: openwiki-source-ed8b86192eb575363d2c638c
    resource: repo://lib/matchmaking/inviteService.ts
  - id: openwiki-source-c7c5a3afe0f9d3670c568ae5
    resource: repo://lib/matchmaking/profile.ts
  - id: openwiki-source-fcf9c59b3f4026470e5e8fad
    resource: repo://lib/rate-limiting/middleware.ts
  - id: openwiki-source-e6f02f5d20be6272be761347
    resource: repo://lib/supabase/server.ts
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-8c03498845e088b000ba6acf
    resource: repo://scripts/guards/no-service-role-in-client.ts
  - id: openwiki-source-1a442a8fa3545ecb9e2a0956
    resource: repo://scripts/supabase/policies/check.ts
  - id: openwiki-source-0aa2bd5e48c3210481184df1
    resource: repo://scripts/supabase/preflight.ts
  - id: openwiki-source-54aee54c6e9a8c93108f40d1
    resource: repo://scripts/supabase/quickstart.sh
  - id: openwiki-source-bf183f979ad01681441419d1
    resource: repo://scripts/supabase/verify.ts
  - id: openwiki-source-d81538d8891efe37053aeccb
    resource: repo://supabase/config.toml
generated: { by: "openwiki/0.5.1", at: "2026-09-10T18:17:19.733Z" }
---

# Environment, Configuration & Local Setup

Wottle is a Next.js (App Router) application backed by a local Supabase stack
(PostgreSQL, Realtime, Auth) run through Docker. This page documents the
supported path to a working local environment, the environment variables and
feature flags that configure the app, the default game-config constants, and the
`supabase:*` operational scripts.

## Quickstart is the supported setup path

There are **no committed `.env.example` files**. The supported way to reach a
working local environment is a single command:

```bash
pnpm quickstart
```

`quickstart` maps to `scripts/supabase/quickstart.sh`, which performs the whole
setup pipeline end to end:

1. **Preflight** — runs `scripts/supabase/preflight.ts`, which verifies the
   Docker daemon is reachable (`docker info`), the Supabase CLI is installed
   (`supabase --version`), and a `SUPABASE_ACCESS_TOKEN` is present. Any failing
   prerequisite aborts the run.
2. **Start the Docker stack** — starts Supabase (`supabase start`) with
   exponential-backoff retries, force-cleaning stale containers that hold the DB
   port (`54322`) between attempts.
3. **Read credentials** — parses `supabase status --output json` to extract the
   API URL, anon key, and service-role key.
4. **Write `.env.local`** — `sync_env_values` writes/updates
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_ANON_KEY` in `.env.local`
   (and `.env.production.local` when present), then exports them for the rest of
   the run.
5. **Migrate** — `pnpm supabase:migrate` applies pending migrations.
6. **Seed & verify** — runs `scripts/supabase/seed.ts` then
   `scripts/supabase/verify.ts`.
7. **Stop** — stops the stack unless `QUICKSTART_DISABLE_STOP` is set.

The script emits structured JSON events (`supabase.quickstart.success` /
`supabase.quickstart.error`) with per-phase durations. Setting
`QUICKSTART_DRY_RUN` skips the migrate/seed/verify steps, and the
`QUICKSTART_ENV_FILE` / `SUPABASE_BIN` / `PNPM_BIN` overrides adjust the target
file and binaries.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart TD
  A[pnpm quickstart] --> B[preflight.ts<br/>docker + supabase CLI + token]
  B --> C[supabase start<br/>Docker stack, retry/backoff]
  C --> D[supabase status --output json<br/>read URL + anon + service-role]
  D --> E[write .env.local<br/>sync_env_values]
  E --> F[pnpm supabase:migrate]
  F --> G[seed.ts + verify.ts]
  G --> H[supabase stop unless DISABLE_STOP]
```

Once `.env.local` exists, `pnpm dev` runs the Next.js dev server against the
local stack.

The `.secrets.example` file is unrelated to app configuration: it is a template
for the `act` local GitHub Actions runner (`GITHUB_TOKEN`,
`SUPABASE_ACCESS_TOKEN`), copied to a gitignored `.secrets`.

## Environment variables

The README table enumerates the configuration variables. The ones that are
actually read by application code are noted below.

| Variable | Role | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase REST URL used by the browser (and by server/service-role clients). | `http://localhost:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser calls. | anon key from Supabase CLI |
| `SUPABASE_ANON_KEY` | Server-side anon key used by quickstart and tests. | matches the public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** key used by Server Actions and scripts. | service-role key from Supabase CLI |
| `SUPABASE_DB_PASSWORD` | Optional Postgres password for CLI scripts (e.g. policy snapshot). | `postgres` |
| `PLAYTEST_INVITE_EXPIRY_SECONDS` | TTL for direct lobby invites before they expire. | `30` |
| `PLAYTEST_MAX_CONCURRENT_MATCHES` | Documented guardrail for simultaneous matches per stack. | `20` |
| `NEXT_PUBLIC_ENABLE_PLAYTEST_LOBBY` | Feature flag: surface lobby preview UI. | unset (false) |
| `NEXT_PUBLIC_ENABLE_PLAYTEST_MATCH` | Feature flag: surface match-summary preview UI. | unset (false) |
| `PLAYTEST_SESSION_SECURE` | Force secure session cookies (`true`/`false`); overridden for local Playwright. | auto (`true` in production) |
| `RATE_LIMIT_DISABLED_SCOPES` | Comma-separated scopes to bypass in rate limiting (e.g. `auth:login`). | unset |
| `CRON_SECRET` | Shared secret required by `/api/cron/*` routes. | unset (required in prod) |

Notable behaviors backed by code:

- **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** `lib/supabase/server.ts`
  imports `server-only`, throws if instantiated in a browser context
  (`typeof window !== "undefined"`), and is the single place the service-role
  client is constructed. The seed, reset, verify, and log-export scripts require
  this key together with `NEXT_PUBLIC_SUPABASE_URL`.
- **`PLAYTEST_INVITE_EXPIRY_SECONDS`** is read by
  `lib/matchmaking/inviteService.ts` as the default invite TTL (`30`s if unset).
- **`PLAYTEST_SESSION_SECURE`** is read by `lib/matchmaking/profile.ts`
  (`shouldUseSecureCookies`): an explicit truthy/falsy value wins, otherwise CI
  disables secure cookies and production enables them.
- **`RATE_LIMIT_DISABLED_SCOPES`** is parsed once by
  `lib/rate-limiting/middleware.ts` into a `Set` of scopes to bypass (alongside
  a blanket `RATE_LIMIT_DISABLE_ALL` / `RATE_LIMIT_BYPASS` switch).
- **`CRON_SECRET`** gates `app/api/cron/sweep-stale-matches/route.ts`: a missing
  secret returns HTTP 500, and requests must send `Authorization: Bearer
  <CRON_SECRET>` or receive 401. In production it must equal the Postgres
  `app.cron_secret` setting used by the pg_cron sweep job.
- **`PLAYTEST_MAX_CONCURRENT_MATCHES`** is documented as a guardrail but has no
  reader in application code; treat it as advisory rather than enforced.

## Feature flags

`lib/constants/featureFlags.ts` centralizes the playtest UI flags. `readFlag`
treats `1`, `true`, `on`, `yes`, and `enabled` (case-insensitive) as true and
defaults everything else to `false`:

- `NEXT_PUBLIC_ENABLE_PLAYTEST_LOBBY` → `featureFlags.playtestLobby`
- `NEXT_PUBLIC_ENABLE_PLAYTEST_MATCH` → `featureFlags.playtestMatchView`

`isPlaytestUiEnabled()` returns true when either flag is on. Because both use the
`NEXT_PUBLIC_` prefix, they are inlined into the client bundle at build time.

## Game-config constants

`lib/constants/game-config.ts` exports `DEFAULT_GAME_CONFIG`, the default match
configuration consumed across the scoring pipeline:

| Setting | Constant | Value |
| --- | --- | --- |
| Board size | `boardSize` | `10` (10×10) |
| Rounds per match | `maxRounds` | `10` |
| Time per round | `timePerRoundMs` | `60000` (60s) |
| Minimum word length | `minimumWordLength` | `3` |
| Scoring directions | `allowedDirections` | `['horizontal', 'vertical']` |
| Language | `language` | `'is'` (Icelandic) |

`minimumWordLength` is read by the entire scoring pipeline (scanner,
cross-validator, delta detector); the source comment notes that lowering it to
`2` re-enables 2-letter scoring end to end.

> **Discrepancy to be aware of:** the README "Default match configuration" table
> lists *Rounds per match = 5*, but `DEFAULT_GAME_CONFIG.maxRounds` is `10` in
> code. The constant is authoritative.

## Supabase & guard scripts

The `supabase:*` scripts (defined in `package.json`) are the operational surface
for the local database:

| Command | What it does |
| --- | --- |
| `pnpm supabase:migrate` | `supabase migration up` — apply pending migrations. |
| `pnpm supabase:seed` | Run `scripts/supabase/seed.ts` — generate and upsert the primary board (and related seed data) via the service-role client. |
| `pnpm supabase:reset` | Run `scripts/supabase/reset.ts` — regenerate the primary board grid and clear its moves (falls back to seeding if the board is missing). |
| `pnpm supabase:verify` | Run `scripts/supabase/verify.ts` — probe core tables (`boards`, `players`, `matches`, `rounds`, `move_submissions`, `match_logs`, `match_heartbeats`) and report `healthy`/`error`. |
| `pnpm supabase:policies` | Run `scripts/supabase/policies/check.ts` — snapshot `pg_policies` for the tracked tables into `supabase/policies/policies.snapshot.json` (connects directly to Postgres via `SUPABASE_DB_*`). |
| `pnpm supabase:logs` | Run `scripts/supabase/log-export.ts <matchId>` — export a match's `match_logs` events as JSON. |
| `pnpm guard:no-service-role` | Run `scripts/guards/no-service-role-in-client.ts` — fail if `SUPABASE_SERVICE_ROLE_KEY` or `service_role` appears under `app/` or `components/`. |

The `guard:no-service-role` check enforces the server-only invariant on the
service-role key at the bundle level: any match under `app/` or `components/` is
reported as an offense, with remediation to move usage into server-only modules
such as `lib/supabase/server.ts`.

## Local stack ports

`supabase/config.toml` (project `wottle-local`) pins the local service ports:
API/REST on `54321` (matching the `NEXT_PUBLIC_SUPABASE_URL` default), Postgres
on `54322` (shadow DB on `54320`), and Studio on `54323`. Analytics and the Edge
Runtime are disabled — the project ships no Edge Functions, and leaving the Edge
Runtime on has caused flaky `502`s that aborted `pnpm quickstart` on CI perf
runs.

## Related pages

- Data model — the tables the seed/verify/policy scripts operate on.
- Security & rate limiting — how `RATE_LIMIT_DISABLED_SCOPES`, the service-role
  guard, and `CRON_SECRET` fit the security model.
- Migrations — the migration set applied by `pnpm supabase:migrate`, including
  the pg_cron stale-match sweep.
