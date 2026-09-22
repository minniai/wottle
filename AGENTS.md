# AGENTS.md

## Cursor Cloud specific instructions

### Service Overview

Wottle is a competitive 2-player real-time word duel (Next.js 16 + Supabase). Two services must run for development:

1. **Supabase local stack** (Docker containers: Postgres, PostgREST, Realtime, Auth, etc.)
2. **Next.js dev server** (`pnpm dev`, port 3000)

See `CLAUDE.md` for the full command reference (setup, testing, Supabase operations), the architecture overview, the Speckit workflow, and the mandatory design and game-rules constraints. In short:

- **Runtime**: Node.js 22 (`.nvmrc`, `engines`), pnpm 11.7 (`packageManager`; settings in `pnpm-workspace.yaml`).
- **Verify a change**: `pnpm lint` (zero warnings), `pnpm typecheck`, `pnpm test:unit`; `pnpm test:integration` and `pnpm exec playwright test` need the Supabase stack (and, for Playwright, the dev server) running.
- **UI work** must follow `docs/design_documentation/README.md` → `WOTTLE_DESIGN_SYSTEM.md` (Field & Ledger, spec `specs/044-field-ledger-redesign/`).
- **Scoring / round-engine work** must be checked against `docs/prd_and_requirements/wottle_game_rules.md` (§10 regression log first).
- **Feature work** follows Speckit: `/speckit.specify` → `clarify` → `plan` → `tasks` → `implement`, TDD throughout.

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
- **Node.js version**: The project pins Node.js 22 (`.nvmrc`, `engines.node >=22`). Run `nvm use` in the repo root before running commands.
- **Supabase CLI**: Installed as a system binary via `.deb` package (not npm global). Version 2.76.14.
- **Wordlist loading**: The game loads the board wordlist `data/wordlists/word_list_3_10_is.txt` (~1.16M forms: the ~3.71M BÍN inflected forms in `word_list_is.txt` stripped of words shorter than the 3-letter minimum or longer than the 10-letter board, minus `word_list_is_exclusions.txt`). Rebuild it with `pnpm wordlists:build` after changing `BOARD_SIZE` or `minimumWordLength`, or regenerating a source list; the loader throws if it is missing. It takes ~0.3s to load on first use and logs `dictionary.loaded`. This is normal in tests and at runtime; do not add words to the list (BÍN-only policy — curation is via the exclusions file).
- **Match clock**: one 5:00 budget per player for the whole match (`matches.player_a/b_timer_ms`, fallback `300_000` in `lib/match/roundEngine.ts`), 10 rounds. `timePerRoundMs` in `lib/constants/game-config.ts` is not read by the live clock.
- **Two-player Playwright specs**: files tagged `@two-player-playtest` run in CI on the `playtest-firefox` project with `--workers=1`; locally run them one spec file at a time to avoid Realtime contention.
- **Realtime channel**: Local Supabase Realtime may show as "disconnected" in the lobby UI; the app automatically falls back to HTTP polling (2s interval). This is expected behavior in development.
