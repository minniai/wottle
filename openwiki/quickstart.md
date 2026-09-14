---
type: orientation-and-navigation-hub
title: Wottle Wiki Quickstart
description: Orientation and task-routing hub for Wottle, a real-time two-player Icelandic word-duel game on Next.js and Supabase, linking a coding agent to the architecture, concept, workflow, operations, integration, and testing pages by task.
tags: [wottle, quickstart, navigation, architecture, nextjs, supabase, game-engine, onboarding]
verified:
  - by: openwiki/0.5.1
    at: 2026-09-10T18:17:19.733Z
sources:
  - id: openwiki-source-bff475d8fa855e3592cfedc2
    resource: repo://.specify/memory/constitution.md
  - id: openwiki-source-a2371d6362e5db4bc834ad03
    resource: repo://CLAUDE.md
  - id: openwiki-source-15372424da8dcfd79551bda0
    resource: repo://docs/prd_and_requirements/wottle_game_rules.md
  - id: openwiki-source-92d702cc00f5d0b5a8b40861
    resource: repo://lib/constants/game-config.ts
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.5.1", at: "2026-09-10T18:17:19.733Z" }
---

# Wottle Wiki Quickstart

This is the orientation and routing hub for the Wottle wiki. It tells a coding
agent what Wottle is, the guardrails that must not be violated, how to get a
local environment, and which page to open for the task at hand. Deep detail
lives on the linked pages; this page deliberately does not duplicate it.

## What Wottle is

Wottle is a competitive **two-player, real-time word duel**. Players swap tiles
on a **10×10 board** (`BOARD_SIZE = 10`, `boardSize: 10`) to form Icelandic
words under a per-round clock, using a spatial **tile-freezing** strategy. The
default match runs **10 rounds of 60 seconds each** (`maxRounds: 10`,
`timePerRoundMs: 60000`), with a **3-letter minimum word length**
(`minimumWordLength: 3`) scored along horizontal and vertical directions
(`allowedDirections: ['horizontal', 'vertical']`, `language: 'is'`). Word
validity is decided server-side against the BÍN-derived Icelandic word list in
`data/wordlists/` (`word_list_is.txt`, with `word_list_is_exclusions.txt` as the
curation overlay); the dictionary is never exposed to the client.

> Note on round count: some prose descriptions say "5 rounds," but the shipped
> default configuration in `lib/constants/game-config.ts` sets `maxRounds: 10`,
> which the game-rules spec also states ("A match is exactly 10 rounds"). Treat
> the config constant as authoritative.

The core loop — **swap → find words → score → freeze** — is functional and
well covered by tests.

### Tech stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- **Server logic**: Next.js Server Actions in `app/actions/` are the authoritative mutation path.
- **Backend**: Supabase — PostgreSQL (game state + RLS), Realtime (WebSocket broadcasting), Auth (JWT/HttpOnly cookies).
- **Client state**: Zustand.
- **Validation / contracts**: Zod schemas on all Server Action inputs; shared types in `lib/types/`.
- **Testing**: Vitest (unit / integration / contract), Playwright (E2E), Artillery (performance).
- **Package manager**: pnpm.

## The one guardrail you cannot skip

**Any change to `lib/game-engine/*`, `lib/match/roundEngine.ts`,
`lib/match/stateMachine.ts`, `lib/scoring/*`, or `lib/constants/game-config.ts`
MUST be validated against `docs/prd_and_requirements/wottle_game_rules.md` and
add a regression test.** That document is the authoritative specification of the
per-letter coverage rule (§4), the scoring formula (§5), the validation
algorithm (§7), the board invariants (§8), and the regression change log (§10).
Scoring bugs are the single most common class of regression in this codebase; if
the implementation and the spec disagree, correct the spec in the same change
and pin the outcome with a test.

## Non-negotiable constitution principles

`.specify/memory/constitution.md` defines principles that override ad-hoc
decisions. The ones that shape almost every change:

- **Server-authoritative game logic (NON-NEGOTIABLE)** — all state mutation, move validation, scoring, clock, and word validation execute server-side via Server Actions; the client is a view layer with optimistic-only local state.
- **Real-time performance SLAs (NON-NEGOTIABLE)** — move RTT (client → server → client) **< 200 ms p95**, word validation **< 50 ms** server-side, realtime broadcast **< 100 ms** between players, board generation **< 200 ms**.
- **Type-safe end-to-end** — explicit Server Action return types, shared types in `lib/types/`, Zod validation on all inputs.
- **Test-Driven Development (NON-NEGOTIABLE)** — Red → Green → Refactor; production code ships with a corresponding test.

## Get a local environment

Run:

```bash
pnpm quickstart
```

`pnpm quickstart` is the **only supported path** to a working local stack: it
runs the Supabase CLI preflight, starts the Docker stack, applies migrations,
seeds data, and writes `.env.local` for you. There is no committed
`.env.example` — do not invent one. Then start the app with `pnpm dev`
(requires `.env.local`). For the full environment-variable reference and
feature flags, see the operations setup page below.

## Task-routing map

Use this to jump to the page that owns the detail you need.

### Understand the system

- **[System Architecture Overview](/openwiki/architecture/overview.md)** — how the Next.js client, Server Actions, `lib/` domain libraries, and Supabase persistence/realtime fit together across the server-authoritative boundary. Start here.
- **[Supabase Integration](/openwiki/integrations/supabase.md)** — how Postgres, Realtime, and Auth are used and configured.

### Game rules and pure logic (concepts)

- **[Game Engine: Board, Swaps & Word Finding](/openwiki/concepts/game-engine.md)** — the pure logic that turns a tile swap into found words.
- **[Scoring & Cross-Validation](/openwiki/concepts/scoring.md)** — the scoring formula, per-letter coverage rule, cross-word validation, and round aggregation.
- **[Frozen Tiles Mechanic](/openwiki/concepts/frozen-tiles.md)** — how tiles freeze, ownership, cross-round merge, and their effect on scoring and swaps.
- **[Elo Rating & Match Results](/openwiki/concepts/rating-and-results.md)** — how winners are decided and how Elo is computed and persisted.

> Changes to any of these concept areas touch the guardrail files above — validate against the game-rules spec and add a regression test.

### Runtime and connectivity (architecture)

- **[Match & Round Runtime](/openwiki/architecture/match-runtime.md)** — the server-authoritative match lifecycle: round phases, submission collection, conflict resolution, clock enforcement, resolution, and completion.
- **[Matchmaking, Lobby & Presence](/openwiki/architecture/matchmaking-lobby.md)** — connecting, appearing in the lobby, queueing or inviting, and being bootstrapped into a match.
- **[Realtime Channels & State Broadcasting](/openwiki/architecture/realtime-and-presence.md)** — Supabase Realtime for match state, presence, rematch signaling, and the 2s polling fallback.
- **[Data Model & Persistence](/openwiki/architecture/data-model.md)** — the Supabase Postgres schema, key tables, invariants, and RLS backing game state.
- **[Frontend & Client State](/openwiki/architecture/frontend-ui.md)** — match/lobby UI components, client-side state, and how the client renders server-authoritative state.

### End-to-end workflows

- **[Workflow: End-to-End Match](/openwiki/workflows/play-a-match.md)** — a full match from lobby entry through matchmaking, rounds, scoring reveal, and completion.
- **[Workflow: Round Submission & Resolution](/openwiki/workflows/round-resolution.md)** — submit-move → resolve → reveal, including conflicts, timeouts, instant scoring, and stuck-round recovery.
- **[Workflow: Authentication & Sessions](/openwiki/workflows/authentication.md)** — login/logout and how session identity flows into Server Actions.
- **[Workflow: Rematch, Disconnect & Resignation](/openwiki/workflows/rematch-and-disconnect.md)** — post-game rematch negotiation and mid-game disconnect/resign/claim-win handling.

### Operate the system

- **[Environment, Configuration & Local Setup](/openwiki/operations/environment-and-setup.md)** — environment variables, feature flags, and the quickstart setup path.
- **[Database Migrations & Scheduled Jobs](/openwiki/operations/migrations-and-cron.md)** — the migration workflow and the pg_cron stale-match sweep.
- **[Security, RLS & Rate Limiting](/openwiki/operations/security-and-rate-limiting.md)** — service-role isolation, RLS, and the in-process rate limiter used by Server Actions.
- **[Observability & Logging](/openwiki/operations/observability.md)** — structured logging, performance instrumentation, and match/round event tracking.

### Test the system

- **[Testing Strategy & Suites](/openwiki/testing/overview.md)** — the test pyramid (unit, integration, contract, E2E, performance), how to run each, and TDD expectations.
- **[Performance Testing & Latency Budgets](/openwiki/testing/performance-testing.md)** — the Artillery suites and the latency thresholds they enforce.

## Where the code lives

A quick orientation to the top-level layout so you know which page maps to which
directory:

- `app/` — Next.js routes, pages, and Server Actions (`app/actions/`).
- `components/` — React components (`game/`, `match/`, lobby, shared UI).
- `lib/` — domain logic: `game-engine/`, `scoring/`, `match/` (round engine, state machine, runtime), `matchmaking/`, `lobby/`, `realtime/`, `rating/`, `rate-limiting/`, `observability/`, `supabase/`, `types/`, `constants/`.
- `data/wordlists/` — the Icelandic dictionary and exclusions overlay.
- `tests/` — `unit/`, `integration/`, `contract/`, `perf/`.
- `scripts/` — Supabase setup/seed/verify utilities, perf assertions, and guards.
