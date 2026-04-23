# Stale "In Match" Cleanup — Design

**Issue:** [#180](https://github.com/minniai/wottle/issues/180) — Players "in match" should abort and lose the match after 15 seconds if they disconnect.

**Status:** Approved design, ready for implementation plan.

**Date:** 2026-04-23

## Problem

`matches.state = 'in_progress'` records accumulate indefinitely in the database when both players leave without the match ever finalising. Symptoms:

- Lobby stats strip shows phantom "7 players in match" counts with no one actually online.
- Affected `players` rows stay stuck at `status = 'in_match'`, blocking matchmaking for those accounts on return.
- Existing recovery (`healStuckInMatchStatus`) only runs when the stuck player themselves reopens the lobby — it cannot resolve an unowned orphan.

The Phase 6 disconnect flow (`DisconnectionModal` + `claimWinAction`) handles the case where one player is *still present* to claim the win, but it depends on an in-memory `setTimeout` that does not survive serverless invocation boundaries, and it does nothing when both players are gone.

## Goals

- No more phantom "in match" records in the lobby count.
- Orphaned matches (neither player has a live presence) auto-finalise as abandoned without manual intervention.
- Keep the Phase 6 live-disconnect UX unchanged — the sweep is additive housekeeping.
- Reuse existing match-completion infrastructure (`completeMatchInternal`) so status resets, broadcasts, and rating rules stay single-sourced.

## Non-goals

- Lowering Phase 6's 90-second modal window. That UX is for a live opponent and is out of scope.
- Literal 15-second detection. The issue's "15 seconds" is treated as intent ("fast enough"), not a hard SLA. Effective sweep window equals the presence TTL (default 5 minutes) plus up to 30s pg_cron lag. This can be tightened later by lowering `PLAYTEST_PRESENCE_TTL_SECONDS`.
- Changes to `lobby_presence` stale-row retention — query-time filtering already hides them.

## Decisions locked during brainstorming

| # | Decision | Rationale |
|---|---|---|
| 1 | Phase 6 (90s, live) + sweep (orphans only) coexist as distinct flows. | Different failure modes — live opponent vs both gone. Shared threshold would compromise both. |
| 2 | Sweep runs on Supabase `pg_cron`. | Runs regardless of traffic. No new infra beyond enabling the extension. Project is on Supabase Cloud. |
| 3 | Orphan condition: `matches.state = 'in_progress'` AND neither player has `lobby_presence.expires_at > now()`. | Single source of truth, directly matches the reported symptom. |
| 4 | Sweep outcome: `state = 'completed'`, `ended_reason = 'abandoned'`, `winner_id = NULL`, no Elo write, both players' `status` reset to `available`. | Both players vanished — no reliable signal for "who should have won." Don't move ratings on ambiguous data. |
| 5 | Implementation: TypeScript route `app/api/cron/sweep-stale-matches` that reuses `completeMatchInternal`; pg_cron invokes it via `net.http_post` with a shared secret. | Keeps completion logic single-sourced. Latency isn't critical. Secret-gated HTTP mirrors existing Vercel-cron conventions. |

## Architecture

Two independent mechanisms cover distinct failure modes:

| Mechanism | Scope | Threshold | Status |
|---|---|---|---|
| Phase 6 `DisconnectionModal` + `claimWinAction` | Live match; one player present, one gone | 90s countdown (UX) | Already shipped |
| **Orphan-match sweep (this design)** | Both players have no live presence | ~5min effective (presence TTL + 30s cron) | New |

## Components

### SQL / migration

`supabase/migrations/20260423001_sweep_stale_matches.sql`:

1. `CREATE EXTENSION IF NOT EXISTS pg_cron;` and `pg_net;` (idempotent).
2. `CREATE OR REPLACE FUNCTION public.find_orphaned_matches() RETURNS SETOF uuid` — returns match ids where `state = 'in_progress'` AND no `lobby_presence` row exists for either player with `expires_at > now()`.
3. `SELECT cron.schedule('sweep-stale-matches', '*/30 * * * * *', $$ SELECT net.http_post(url := current_setting('app.app_url') || '/api/cron/sweep-stale-matches', headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'), 'Content-Type', 'application/json'), body := '{}'::jsonb) $$);` — schedule every 30 seconds.
4. `matches.ended_reason` CHECK constraint already accepts `'abandoned'` (verified against `20251115001_playtest.sql`); no schema change needed.

`app.app_url` and `app.cron_secret` are set via `ALTER DATABASE postgres SET app.app_url = '…';` in Supabase Cloud so the schedule body doesn't bake in environment-specific values.

### TypeScript — sweep route

`app/api/cron/sweep-stale-matches/route.ts`:

- `POST` handler.
- Compares `request.headers.get('authorization')` against `Bearer ${process.env.CRON_SECRET}`; returns 401 on mismatch.
- Calls `findOrphanedMatches()` → `string[]`.
- Runs `Promise.allSettled(ids.map(id => completeMatchInternal(id, 'abandoned', null)))`.
- Returns `200 { swept: string[], failed: Array<{ matchId: string; error: string }> }`.
- Structured log: `{ event: 'sweep_stale_matches', swept_count, failed_count, duration_ms }`.

### TypeScript — query helper

`lib/match/findOrphanedMatches.ts`:

```ts
export async function findOrphanedMatches(): Promise<string[]>
```

Implementation: `supabase.rpc('find_orphaned_matches')` → map rows to ids. Left-anti-join is cleanest in SQL; this avoids an N+1 from the TypeScript side.

### Reused, unchanged

- `completeMatchInternal(matchId, endedReason, forcedWinnerId)` — passing `'abandoned'` + `null` leaves `winner_id` null, skips the `match_ratings` write, triggers `resetPlayerStatuses(both)`, and broadcasts the match-completed event.
- `resetPlayerStatuses` — already called inside `completeMatchInternal`.

### Not changed

- `app/actions/match/handleDisconnect.ts`, `claimWin.ts`, `DisconnectionModal`, `useCountdown` — Phase 6 keeps its 90s live-disconnect flow.
- `app/api/lobby/stats/matches-in-progress/route.ts` and `fetchLobbySnapshot` — naturally return correct numbers once orphans flip to `'completed'`.

## Data Flow

```
pg_cron tick (every 30s)
   │
   └─► net.http_post → POST /api/cron/sweep-stale-matches
            │  Authorization: Bearer ${cron_secret}
            │
            ├─► verify secret → 401 on mismatch
            │
            ├─► supabase.rpc('find_orphaned_matches')
            │       │
            │       └─ SQL: SELECT m.id FROM matches m
            │               WHERE m.state = 'in_progress'
            │                 AND NOT EXISTS (
            │                   SELECT 1 FROM lobby_presence lp
            │                   WHERE lp.player_id IN (m.player_a_id, m.player_b_id)
            │                     AND lp.expires_at > now()
            │                 );
            │
            ├─► for each matchId (Promise.allSettled):
            │       completeMatchInternal(matchId, 'abandoned', null)
            │           ├─ matches.state = 'completed'
            │           ├─ matches.ended_reason = 'abandoned'
            │           ├─ matches.winner_id = NULL
            │           ├─ matches.completed_at = now()
            │           ├─ resetPlayerStatuses(both) → players.status = 'available'
            │           ├─ skip match_ratings write (no winner)
            │           └─ broadcast match-completed event (best-effort)
            │
            └─► 200 { swept: [ids], failed: [{matchId, error}] }
```

The Phase 6 path is unchanged and runs in parallel. If its in-memory `setTimeout` misses (e.g., serverless recycled the process), the sweep eventually catches the match once the remaining player's presence also expires.

## Error Handling

| Failure | Behaviour | Why |
|---|---|---|
| `find_orphaned_matches` RPC errors | Log + return 500; pg_cron retries on next tick (30s later). | Transient DB errors shouldn't poison the sweep. |
| `completeMatchInternal` throws for one match | `Promise.allSettled` captures it; sweep continues; failure reported in `failed[]`. | One bad match shouldn't block cleanup of the rest. |
| Same match swept twice (race with Phase 6) | `completeMatchInternal` guards on `state` — if not `'in_progress'`, it no-ops. Idempotent. | pg_cron + Phase 6 can fire concurrently. |
| Missing `CRON_SECRET` env var | Route returns 500 on first invocation; production deploy gate catches it. | Loud failure beats silent bypass. |
| `pg_net.http_post` fails (network blip) | pg_cron logs to `cron.job_run_details`; next tick fires 30s later. | No retry needed at our layer. |
| `pg_cron` / `pg_net` not available in target environment | Migration fails loudly during `pnpm supabase:migrate`. | Caught in CI / pre-deploy, not at runtime. |
| Local dev (no pg_cron in local image) | Migration creates the SQL function unconditionally; the `cron.schedule` call is wrapped in a `DO $$ BEGIN … EXCEPTION … $$` guard so absence of pg_cron does not break `pnpm quickstart`. Integration tests invoke the RPC and the route directly. | Local dev must stay frictionless. |

**Observability:**

- Sweep route: structured JSON log per invocation with counts and duration.
- Per-match completion: existing `completeMatchInternal` instrumentation.
- pg_cron: `cron.job_run_details` gives visibility on schedule ticks and `net.http_post` exit statuses.

## Testing

| Test | Type | Location | Verifies |
|---|---|---|---|
| `findOrphanedMatches` RPC result mapping | Unit (RPC mocked) | `tests/unit/lib/match/findOrphanedMatches.test.ts` | Returns ids when both presence rows are absent/expired; excludes matches with one live presence; excludes `completed`/`pending` matches. |
| Sweep route auths via `CRON_SECRET` | Integration | `tests/integration/api/sweepStaleMatches.spec.ts` | 401 without header / wrong header; 200 with valid header. |
| Sweep route finalises orphans | Integration | same file | Seed 1 orphan + 1 live + 1 completed → only the orphan transitions to `completed` / `abandoned` / `winner_id=null`. |
| Sweep route is idempotent and concurrent-safe | Integration | same file | Second call is a no-op; no `match_ratings` row inserted for abandoned matches. |
| Sweep continues past per-match failures | Unit | `tests/unit/api/sweepStaleMatches.test.ts` | Mock `completeMatchInternal` to throw for one id; others still finalise; response body lists `failed[]`. |
| `completeMatchInternal('abandoned', null)` resets statuses, skips Elo | Unit (extends existing) | `tests/unit/app/actions/completeMatch.test.ts` | `players.status='available'` for both; no `match_ratings` insert. |
| RPC SQL function behaves correctly against live DB | Integration (real DB) | `tests/integration/db/sweepRpc.spec.ts` | Direct `.rpc('find_orphaned_matches')` returns expected rows across seeded scenarios. |
| Lobby `matches-in-progress` count drops after sweep | Integration (extend) | `tests/integration/api/lobbyStats.spec.ts` | Insert orphan match → count = 1; run sweep → count = 0. |

**Not tested:**

- pg_cron schedule firing itself (Postgres-internal; `cron.job_run_details` covers it in production).
- Full Phase 6 ↔ sweep race in E2E — covered logically by the idempotency unit test.

## Rollout

1. Land migration + route + tests in one PR.
2. Set `CRON_SECRET` in Vercel env and `app.cron_secret` + `app.app_url` in Supabase Cloud (`ALTER DATABASE ...`). Document both in README under "Environment Variables".
3. After deploy, confirm `cron.job_run_details` shows 200 responses and `swept_count` matches expectations.
4. Follow-up (separate PR): consider lowering `PLAYTEST_PRESENCE_TTL_SECONDS` from 300 → 60 to tighten the effective sweep window closer to the issue's 15s intuition, with matching heartbeat-interval review.

## Open questions / follow-ups

- Should `healStuckInMatchStatus` be deprecated once the sweep is live? Current answer: keep it as a defensive fast-path on lobby load. Revisit after two weeks of sweep telemetry.
- Should we expose a dashboard metric on `swept_count` for regression tracking? Out of scope for this PR; add when observability work lands.
