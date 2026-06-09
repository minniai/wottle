Here's a map of the Wottle codebase.

## What it is

Wottle is a competitive 2-player real-time word duel. Players swap tiles on a 10×10 board to form words (originally Icelandic, now multi-language: `is`, `en`, `se`, `no`, `dk`), with a chess-clock timer and tile-freezing strategy. It's a **Next.js 16 (App Router) + React 19 + Supabase** app, written in **TypeScript**, package-managed with pnpm.

The single most important architectural principle: **game logic is server-authoritative**. All state mutations happen server-side; the client only renders and submits intents.

## Main entry points

**App bootstrapping**
- `app/layout.tsx` — root layout (fonts, providers, global CSS)
- `instrumentation.ts` — Next.js instrumentation hook (observability bootstrap)
- `next.config.ts` — security headers + build config

**The four user-facing routes**
- `app/(landing)/page.tsx` — unauthenticated `/` landing screen
- `app/(lobby)/lobby/page.tsx` — lobby (presence, directory, invites)
- `app/matchmaking/page.tsx` — matchmaking (searching → found → starting)
- `app/match/[matchId]/page.tsx` — **the match itself** (read this first)
- `app/profile/page.tsx` + `app/profile/[handle]/page.tsx` — profiles

The match page (`app/match/[matchId]/page.tsx`) is the canonical example of the data flow: a Server Component reads the session, calls `loadMatchState()` for server-side hydration, then hands off to the `MatchClient` Client Component which subscribes to Realtime.

**Server Actions** (`app/actions/*` — the primary frontend→backend interface). Grouped by domain: `auth/`, `match/`, `matchmaking/`, `player/`. Each is a `"use server"` function with an explicit return type and Zod-validated inputs. `app/actions/match/submitMove.ts` is the key one for gameplay.

**HTTP API routes** (`app/api/*`) — backup/polling endpoints and cron. Notably `app/api/match/[matchId]/state/route.ts` (polling fallback + heartbeat) and `app/api/cron/sweep-stale-matches/route.ts`.

## Key modules (`/lib`)

This is where the real logic lives. The two cores:

**`lib/match/` — match orchestration**
- `roundEngine.ts` — **the central orchestrator.** Runs the full round cycle: resolve conflicts → apply swaps → run word engine → publish summary → advance or complete. Start here to understand gameplay flow.
- `stateMachine.ts` — match phases (`pending → collecting → resolving → completed`)
- `conflictResolver.ts` — first-come-first-served when players target the same tile
- `stateLoader.ts` / `statePublisher.ts` — hydration & Realtime broadcast
- `clockEnforcer.ts` — server-authoritative timer (driven by `rounds.started_at`)
- `disconnectStore.ts` / `heartbeatRepository.ts` / `findOrphanedMatches.ts` — disconnect/reconnect handling (the recent work area)

**`lib/game-engine/` — board mechanics + word engine (pure functions)**
- `wordEngine.ts` — orchestrates the per-round pipeline (scan → validate → score → freeze)
- `board.ts` — `BoardGrid`, immutable `applySwap`
- `boardScanner.ts` — multi-directional word scanning from swap coords
- `crossValidator.ts` — `selectOptimalCombination`, per-letter coverage rule
- `scorer.ts` — letter points + length/combo bonuses
- `dictionary.ts` — Set-based dictionary (~millions of inflected forms, loaded at runtime, ~2s first load)
- `frozenTiles.ts` — tile freezing with a ≥24-unfrozen safeguard

**Supporting libs:** `lib/supabase/` (server.ts = service-role/server-only, browser.ts = anon/RLS), `lib/realtime/` (WebSocket channels + 2s polling fallback), `lib/scoring/`, `lib/rating/` (Elo), `lib/matchmaking/`, `lib/types/` (shared types + Zod schemas), `lib/constants/` (board dims, feature flags).

## Components (`/components`)

Client components organized by feature: `match/` (largest — `MatchClient`, `MatchShell`, HUD, panels, post-game), `game/` (`Board`, `BoardGrid`, `TimerHud`), `lobby/`, `landing/`, `matchmaking/`, `profile/`, `player/`, and `ui/` (shared primitives: `Button`, `Card`, `Dialog`, `Toast`, `TopBar`, etc.).

## Database

Supabase Postgres. Migrations in `supabase/migrations/` (chronological). Core tables: `players`, `lobby_presence`, `matches`, `rounds`, `move_submissions`, `word_scores`, plus `match_ratings`, `rematch_requests`, `match_heartbeats`. RLS is enforced on all of them.

## Read before making changes

1. **`CLAUDE.md`** (repo root) — the authoritative, detailed guide. Architecture, conventions, current status, known gaps. It's thorough and current.
2. **`docs/prd_and_requirements/wottle_game_rules.md`** — **MANDATORY** before touching any scoring/game-engine code (`lib/game-engine/*`, `lib/match/roundEngine.ts`, `lib/match/stateMachine.ts`, `lib/scoring/*`, `lib/constants/game-config.ts`). It's the normative spec for the coverage rule, scoring formula, validation algorithm, and includes a regression log (§10) of prior scoring bugs — the most frequent regression class here.
3. **`AGENTS.md`** — how to actually run the stack (Docker + Supabase + dev server) and the gotchas.
4. **`.specify/memory/constitution.md`** — the non-negotiable principles. This project uses the **Speckit** spec-driven workflow (specify → clarify → plan → tasks → implement) with mandatory TDD.

## Conventions that will bite you if ignored

- **TDD is mandatory** — write the failing test first; never commit code without a passing test.
- **Server-authoritative** — never move game-state mutation to the client.
- **`pnpm guard:no-service-role`** — the service-role key must never reach client code.
- **Zero-warnings lint** (`pnpm lint`) + strict typecheck (`pnpm typecheck`), explicit return types on Server Actions, Zod on all inputs.
- **Clean Code limits** — functions <20 lines, ≤3 params, no boolean params.
- **Performance SLAs** — move RTT <200ms, validation <50ms, broadcast <100ms; CSS transforms only for animation (no Framer Motion).
- **Conventional Commits**, branch naming `###-feature-name`.

Two small doc-vs-reality drifts I noticed while exploring: `package.json` now requires **Node ≥22** (CLAUDE.md/AGENTS.md still say Node 20), and the word engine is now **multi-language** (docs describe it as Icelandic-only). Worth verifying against `.nvmrc` before assuming.

A good first reading path: `app/match/[matchId]/page.tsx` → `components/match/MatchClient.tsx` → `app/actions/match/submitMove.ts` → `lib/match/roundEngine.ts` → `lib/game-engine/wordEngine.ts`. That traces a single move from click to score.

Want me to go deeper on any one area — e.g., walk through the full move-submission flow in detail, or the disconnect/reconnect system (which seems to be the current focus based on the open plan file)?