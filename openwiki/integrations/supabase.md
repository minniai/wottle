---
type: integration
title: Supabase Integration
description: How Wottle uses Supabase across Postgres persistence, Realtime channels, and client/session boundaries, including the two client factories (service-role vs anon) and local stack configuration.
tags: [supabase, postgres, realtime, persistence, client-configuration, rls, session]
verified:
  - by: openwiki/0.5.1
    at: 2026-09-10T18:17:19.733Z
sources:
  - id: openwiki-source-e4be9c2230d19dd6026c1bb4
    resource: repo://.env.local
  - id: openwiki-source-6525a6270ce1552b3b058856
    resource: repo://app/api/match/start/route.ts
  - id: openwiki-source-4b616c0ef70113c3a706cb70
    resource: repo://lib/match/findOrphanedMatches.ts
  - id: openwiki-source-8d2a1ab983bf096cda6e009a
    resource: repo://lib/match/rematchBroadcast.ts
  - id: openwiki-source-bbf678ad71133d3ee27cf64e
    resource: repo://lib/match/statePublisher.ts
  - id: openwiki-source-85f869d73f9954d8f0fb3034
    resource: repo://lib/matchmaking/presenceStore.ts
  - id: openwiki-source-c7c5a3afe0f9d3670c568ae5
    resource: repo://lib/matchmaking/profile.ts
  - id: openwiki-source-7349d9da1bc1f6181fd4e37e
    resource: repo://lib/matchmaking/service.ts
  - id: openwiki-source-d7ade0347ddc80277c082b70
    resource: repo://lib/realtime/matchChannel.ts
  - id: openwiki-source-71cbe62344d5a3b3d6e2810c
    resource: repo://lib/realtime/presenceChannel.polling.ts
  - id: openwiki-source-9cf6a369afd925dc74576693
    resource: repo://lib/realtime/presenceChannel.ts
  - id: openwiki-source-1aa386e03734e0fdc4afb4e1
    resource: repo://lib/supabase/browser.ts
  - id: openwiki-source-be9bb3e145587a35e19beaa2
    resource: repo://lib/supabase/server-only.ts
  - id: openwiki-source-e6f02f5d20be6272be761347
    resource: repo://lib/supabase/server.ts
  - id: openwiki-source-d81538d8891efe37053aeccb
    resource: repo://supabase/config.toml
  - id: openwiki-source-9376cfdf92c532e7fab98c8d
    resource: repo://supabase/migrations/20251119001_enable_realtime.sql
  - id: openwiki-source-8fd202009987c57c32527018
    resource: repo://supabase/migrations/20260325001_rls_playtest_tables.sql
generated: { by: "openwiki/0.5.1", at: "2026-09-10T18:17:19.733Z" }
---

# Supabase Integration

Supabase is Wottle's single backend platform. It provides the Postgres
database that stores every durable game record, the Realtime service that
carries live match state and lobby presence between clients, and the hosted API
gateway that both surfaces reach. This page consolidates how the application
talks to that platform: the two client factories and the boundary that keeps
them apart, the three usage surfaces (Postgres, Realtime, and session/auth), and
how the local stack in `supabase/config.toml` maps to the environment defaults
the code reads.

Related pages: [System Architecture Overview](../architecture/overview.md),
[Data Model & Persistence](../architecture/data-model.md),
[Realtime Channels & State Broadcasting](../architecture/realtime-and-presence.md),
[Matchmaking, Lobby & Presence](../architecture/matchmaking-lobby.md).

## Two client factories and the server-only boundary

Wottle constructs Supabase clients through two factories with deliberately
different privileges, keys, and execution contexts.

The **service-role server client** lives in `lib/supabase/server.ts`.
`getServiceRoleClient()` returns a process-wide cached client built from
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; `requireEnv()`
throws immediately if either variable is missing, and `createServiceRoleClient()`
can build a fresh (uncached) instance when needed. Both entry points call
`ensureServerContext()`, which throws `"Supabase service_role client must never
run in the browser"` when `window` is defined. The module's very first line is
`import "./server-only"`, and `lib/supabase/server-only.ts` in turn imports the
`server-only` package, so any client-side bundle that transitively imports this
module fails the build rather than shipping the service-role key to browsers.

The **anon browser client** lives in `lib/supabase/browser.ts`, marked
`"use client"`. `getBrowserSupabaseClient()` lazily creates and memoizes a
single client from the public `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, throwing a descriptive error when either is
absent. It disables all Supabase Auth session machinery
(`persistSession: false`, `detectSessionInUrl: false`,
`autoRefreshToken: false`) because Wottle does not use Supabase Auth for user
identity — the anon client exists only to open Realtime WebSocket channels from
the browser.

```mermaid
flowchart TD
  subgraph Browser
    BC["getBrowserSupabaseClient (anon key)"]
  end
  subgraph Server
    SO["server-only import guard"]
    SC["getServiceRoleClient (service_role key)"]
  end
  BC -->|Realtime subscribe and presence| RT["Supabase Realtime"]
  SC -->|SQL reads and writes| PG["Supabase Postgres"]
  SC -->|broadcast publish| RT
  SO -.->|blocks browser bundles| SC
```
*The anon client only reaches Realtime from the browser; the service-role client owns all Postgres access and server-side broadcast, and the server-only guard keeps it out of client bundles.*

## Surface 1: Postgres persistence, SQL functions, and RLS

All database reads and writes flow through the service-role client, which is
passed explicitly into repository-style functions rather than imported inside
them. `lib/matchmaking/service.ts` centralizes the lobby and match persistence
primitives: `upsertPlayerIdentity` (upsert on `players` keyed by `username`),
`upsertLobbyPresence` / `clearLobbyPresence` / `expireLobbyPresence` (the
`lobby_presence` table), `bootstrapMatchRecord` and `findActiveMatchForPlayer`
(the `matches` table), `recordScoreSnapshot` (`scoreboard_snapshots`), and
`fetchMatchState`. Each function unwraps the `{ data, error }` result and
rethrows a descriptive `Error` on failure, so callers never see a raw Supabase
error object. `lib/matchmaking/profile.ts` builds on the same client for login
(`performUsernameLogin`), the deduplicated `fetchLobbySnapshot`, and repair
routines like `healStuckInMatchStatus`. Match-runtime writes go through the same
service-role client from the `lib/match/*` modules.

Beyond table access, the integration uses a **SQL function** invoked via RPC:
`lib/match/findOrphanedMatches.ts` calls `supabase.rpc("find_orphaned_matches")`,
delegating orphan detection to server-side SQL rather than reconstructing it in
TypeScript.

**Row Level Security** is enabled on the playtest tables by
`supabase/migrations/20260325001_rls_playtest_tables.sql`. The policy design is
important to understand operationally: read policies are written against
`auth.uid()` and `auth.role() = 'authenticated'`, and all inserts/updates/deletes
are "handled by service_role only." Because Supabase's `service_role` key
**bypasses RLS**, and Wottle performs every write through the service-role
client, those policies protect direct client access rather than the application's
own server paths. Anonymous/unauthenticated clients get nothing. See
[Data Model & Persistence](../architecture/data-model.md) for the full schema.

## Surface 2: Realtime channels (match, presence, rematch)

Realtime is used two ways: **broadcast** channels for match state and rematch
events, and **presence** channels for the lobby roster and opponent-disconnect
detection.

Channel *subscription* on the client is centralized in `lib/realtime/`.
`subscribeToMatchChannel` (`lib/realtime/matchChannel.ts`) joins
`match:<matchId>` and wires broadcast events `state`, `round-summary`, and
`rematch` to callbacks. When a `presenceKey` is supplied it also joins Supabase
presence under that key, tracks the local player on `SUBSCRIBED`, and filters
presence `leave` events so consumers only see *opponent* disconnects — an
explicitly best-effort signal that complements the `sendBeacon` and polling
fallbacks. `subscribeToLobbyPresence` (`lib/realtime/presenceChannel.ts`) owns
the `lobby-presence` channel and its resilience machinery: an exponential
reconnect back-off (5s→10s→20s→40s, capped at 60s), a polling fallback that runs
only while Realtime is unavailable, and re-tracking of the pending presence
payload after each reconnect. `subscribeToLobbyPresencePollingOnly`
(`lib/realtime/presenceChannel.polling.ts`) is a Realtime-free variant selected
when `NEXT_PUBLIC_DISABLE_REALTIME=true`; it returns a mock channel and drives
the UI purely from the poller.

Channel *publishing* happens on the server through the service-role client.
`lib/match/statePublisher.ts` (`publishMatchState`) and
`lib/match/rematchBroadcast.ts` (`broadcastRematchEvent`) each open
`supabase.channel("match:<matchId>")`, wait for `SUBSCRIBED`, then `send` a
`broadcast` event and remove the channel. `publishMatchState` treats delivery as
best-effort: it caps the subscribe wait with `BROADCAST_SUBSCRIBE_TIMEOUT_MS`
(2s) and resolves anyway on timeout, because the round-advancement pipeline
awaits it and clients recover through the 2-second safety poll. The disconnect
action in `app/actions/match/handleDisconnect.ts` publishes state the same way.

The tables carried over Realtime are declared in
`supabase/migrations/20251119001_enable_realtime.sql`, which adds
`lobby_presence`, `matches`, `rounds`, `move_submissions`, and
`match_invitations` to the `supabase_realtime` publication and sets
`replica identity full` so non-primary-key column changes (status, timers) are
broadcast. See
[Realtime Channels & State Broadcasting](../architecture/realtime-and-presence.md)
for the end-to-end flow and
[Matchmaking, Lobby & Presence](../architecture/matchmaking-lobby.md) for the
presence lifecycle.

## Surface 3: Session and auth

Wottle does **not** use Supabase Auth for player identity. The anon browser
client explicitly disables session persistence and token refresh, and no code
path calls `supabase.auth`. Instead, `lib/matchmaking/profile.ts` implements a
lightweight, cookie-based lobby session: `performUsernameLogin` validates a
username and upserts a `players` row via the service-role client, and
`persistLobbySession` writes an encoded, `httpOnly`, `sameSite: "lax"` cookie
named `wottle-playtest-session` with a four-hour TTL. `readLobbySession` decodes
and Zod-validates that cookie, returning `null` on any failure. API routes such
as `app/api/match/start/route.ts` gate on `readLobbySession()` and then act with
the service-role client, so the session cookie authorizes the request while
Postgres access runs with full privilege. This is why the RLS policies keyed on
`auth.uid()` do not govern the application's own server traffic.

## Configuration and the local stack

`supabase/config.toml` defines the local Supabase stack used in development and
CI under `project_id = "wottle-local"`. It fixes the API gateway to port
`54321`, Postgres to `54322` (with shadow DB on `54320`, `major_version = 17`),
and Studio to `54323`, and enables the `public` and `graphql_public` schemas
with `max_rows = 1000`. Analytics and the Edge Runtime are disabled on purpose:
the project ships no `supabase/functions/`, and the Edge Runtime's flaky health
check was aborting the Artillery perf gate, so leaving it off only saves startup
time.

These ports map directly to the environment defaults the clients read. The
local env files set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` — the
`[api]` port from `config.toml` — alongside the demo `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` JWTs consumed by the browser and server
factories respectively. `NEXT_PUBLIC_DISABLE_REALTIME=true` selects the
polling-only presence path. The URL is shared by both clients; only the key (and
therefore the privilege level) differs between them.
