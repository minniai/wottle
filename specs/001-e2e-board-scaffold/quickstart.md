# Quickstart: MVP E2E Board Scaffold

 Follow these steps to run the local Supabase-backed environment and the app scaffold.

## Prerequisites

- Docker Desktop (running)
- Supabase CLI (v2+)
- Node.js 20.x and PNPM 9+
- macOS/Linux/WSL2 environment with Git

## 1) Clone and install

 ```bash
 cd /Users/arividar/git/wottle
 pnpm install
 ```

## 2) Environment setup

- Copy templates and set local keys (anon for client, service_role for server-only):

 ```bash
 cp .env.example .env.local
 # Edit .env.local with values from `supabase status` after start (below)
 ```

## 3) Run automated quickstart

```bash
# One command to run preflight, start Supabase, apply migrations, seed, and verify
pnpm quickstart
# or, equivalently
make quickstart
```

What the automation does:

- Runs preflight checks for Docker + Supabase CLI + access token
- Starts the Supabase stack (using the Supabase CLI)
- Writes the local `NEXT_PUBLIC_SUPABASE_URL`, anon key, and service-role key into `.env.local`
- Applies migrations, seeds the weighted board grid, clears stale moves, and runs the verification script
- Emits structured JSON logs including startup/seed durations and the board match id

> **Note:** The script expects `SUPABASE_ACCESS_TOKEN` to be present in the environment (for `supabase status --json`). The automation aborts early with actionable messaging if any prerequisite fails.

## 4) Run the app

 ```bash
pnpm dev
# Open http://localhost:3000
 ```

 Expected:

- Home page renders a 16×16 grid
- Swap two tiles triggers a server-authoritative update

## 5) Troubleshooting

- Missing Docker or CLI: Install per Supabase documentation, then rerun `pnpm quickstart`
- Port conflicts: `supabase stop && supabase start` or adjust ports in `supabase/config.toml`
- Wrong keys in client: rerun `pnpm quickstart` to regenerate `.env.local`; ensure anon key is used client-side while `SUPABASE_SERVICE_ROLE_KEY` stays server-only
- Already running Supabase: `supabase stop` before invoking quickstart again
- Need a dry run (e.g., CI smoke test): set `QUICKSTART_DRY_RUN=1` before running the script to skip seeding while still performing env updates

## 6) CI pipeline (overview)

- GitHub Actions workflow installs Node, caches deps, runs typecheck/lint/tests
- Optional integration job spins up Supabase CLI on the runner for DB-backed tests

## 7) Clean up

 ```bash
 supabase stop
 ```
