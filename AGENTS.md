# AGENTS.md

## Cursor Cloud specific instructions

### Service Overview

Wottle is a competitive 2-player real-time word duel (Next.js 16 + Supabase). Two services must run for development:

1. **Supabase local stack** (Docker containers: Postgres, PostgREST, Realtime, Auth, etc.)
2. **Next.js dev server** (`pnpm dev`, port 3000)

See `CLAUDE.md` for full command reference (setup, testing, Supabase operations).

### Starting Services

```bash
# 1. Start Docker daemon (if not already running)
sudo dockerd &>/tmp/dockerd.log &
sleep 3
sudo chmod 666 /var/run/docker.sock

# 2. Start Supabase local stack
cd /workspace && supabase start

# 3. Write local credentials to .env.local (quickstart does this, or manually):
QUICKSTART_DISABLE_STOP=1 pnpm quickstart
# NOTE: If environment secrets (NEXT_PUBLIC_SUPABASE_URL, etc.) are pre-set,
# the quickstart script skips local Supabase start and uses those values.
# Override with local values when running against local Supabase:

# 4. Seed and verify
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  SUPABASE_SERVICE_ROLE_KEY=<from supabase status> \
  pnpm supabase:seed && pnpm supabase:verify

# 5. Start dev server (override env vars if pre-set secrets conflict)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  SUPABASE_SERVICE_ROLE_KEY=<from supabase status> \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status> \
  SUPABASE_ANON_KEY=<from supabase status> \
  pnpm dev
```

### Critical Gotchas

- **Pre-set Supabase secrets conflict**: If `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are pre-set as environment secrets, the quickstart script will skip starting local Supabase and skip migrations/seeding. When using local Supabase, override these env vars on the command line for `pnpm supabase:seed`, `pnpm supabase:verify`, and `pnpm dev`.
- **Docker permissions**: After starting `dockerd`, run `sudo chmod 666 /var/run/docker.sock` so the `supabase` CLI can connect without sudo.
- **Node.js version**: The project targets Node.js 20.x. Use `nvm use 20` before running commands. Node 22 is the default on the VM but some dependencies may behave differently.
- **Supabase CLI**: Installed as a system binary via `.deb` package (not npm global). Version 2.76.14.
- **Wordlist loading**: The Icelandic dictionary (~2.76M entries) takes ~2s to load on first use. This is normal and expected in tests and at runtime.
- **Realtime channel**: Local Supabase Realtime may show as "disconnected" in the lobby UI; the app automatically falls back to HTTP polling (2s interval). This is expected behavior in development.
