# Quickstart: Two-Player Playtest

This guide bootstraps the local environment required to simulate two simultaneous playtesters, including Supabase services, schema migrations, seed data, and dual-browser Playwright scenarios.

## Prerequisites

- Node.js 20.x + PNPM 9.x
- Supabase CLI ≥1.190.0 with Docker running
- Two modern browsers (Chrome + Edge or Chrome profiles) for dual-session manual tests
- `jq`, `openssl`, and `bash` utilities available in PATH

## Steps

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Start Supabase & apply schema**
   ```bash
   make supabase-start   # wraps `supabase start`
   pnpm supabase:migrate # runs migrations including players/matches schema
   pnpm supabase:seed    # seeds baseline 10×10 board + sample usernames
   ```

3. **Verify observability hooks**
   ```bash
   pnpm supabase:verify  # reuses existing verify script, now checks new tables + RLS
   ```

4. **Run dev server and dual browsers**
   ```bash
   pnpm dev
   ```
   - Browser A: http://localhost:3000 → enter username `tester-a`
   - Browser B: http://localhost:3000 → enter username `tester-b`
   - Confirm both appear in lobby within 2 seconds.

5. **Trigger a playtest match**
   - Browser A clicks “Start Game” (auto queue).
   - Browser B accepts pairing prompt (or also clicks Start, whichever arrives first).
   - Verify the match view displays: round counter, timers (5:00), board seed.

6. **Simulate 10 rounds**
   - Perform swaps in both browsers until the round summary appears.
   - Ensure scoring panel lists words, deltas, totals.
   - Refresh Browser B mid-match to confirm reconnection state restore.

7. **Run automated suites**
   ```bash
   pnpm test:unit
   pnpm test:integration   # Supabase-backed
   pnpm test:playwright --headed tests/integration/ui/two-player-playtest.spec.ts
   pnpm test:perf          # Artillery scenario verifying <200 ms RTT
   ```

8. **Shut down services**
   ```bash
   supabase stop
   docker system prune -f   # optional cleanup
   ```

## Environment Variables

Copy `.env.example` → `.env.local` and set:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Local Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for server actions (never exposed client-side) |
| `PLAYTEST_INVITE_EXPIRY_SECONDS` | Defaults to 30; adjust for testing |
| `PLAYTEST_MAX_CONCURRENT_MATCHES` | Defaults to 20 |

## Troubleshooting

- **Invite not delivered**: ensure Supabase Realtime is running (`supabase status realtime`). If down, restart with `supabase restart realtime`.
- **Lobby list stuck**: check browser devtools for WebSocket errors; client will auto-fallback to polling and display a reconnect banner.
- **Timers freeze**: verify server clock streaming by tailing `logs/match_logs` table (`pnpm supabase:tail match_logs`).
- **Dual-session auth collision**: run browsers in separate profiles or use incognito + normal windows so Supabase auth cookies stay isolated.
