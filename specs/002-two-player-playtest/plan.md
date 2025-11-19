# Implementation Plan: Two-Player Playtest

**Branch**: `002-two-player-playtest` | **Date**: 2025-11-15 | **Spec**: /Users/arividar/git/wottle/specs/002-two-player-playtest/spec.md
**Input**: Feature specification from `/specs/002-two-player-playtest/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Goal: enable an end-to-end two-player playtest where authenticated testers can meet in a lobby, pair into a head-to-head match, play 10 synchronized rounds with simultaneous swaps, and see per-round plus final scoring summaries. The milestone layers multiplayer orchestration, matchmaking, and scoring visibility on top of the existing 10×10 board scaffold while keeping the experience constrained to a controlled playtest cohort.

Technical approach:

- Reuse the Next.js 16 + React 19 + TypeScript 5.x stack with Server Actions for every state mutation (auth, matchmaking, submissions, scoring).
- Extend Supabase PostgreSQL schema with `players`, `lobby_presence`, `matches`, `rounds`, `move_submissions`, `word_scores`, and `match_logs` tables plus materialized views for fast scoreboard lookups.
- Use Supabase Realtime channels for lobby presence and match event fan-out; fall back to server polling if WebSocket drops.
- Implement deterministic 10-round state machine where the server enforces one swap per player per round, resolves conflicts, computes word scoring, and broadcasts summaries within 400 ms p95.
- Instrument lobby, matchmaking, submission, and round-resolution paths with performance marks and structured logs so we can certify readiness before inviting external testers.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x, Node.js 20.x, Next.js 16 (App Router), React 19  
**Primary Dependencies**: `@supabase/supabase-js` (auth + Realtime), Supabase Auth helpers, Supabase Edge Functions (invites timeout cron), Zod, Zustand (client state), Tailwind CSS 4.x, Playwright test harness  
**Storage**: Supabase PostgreSQL 15+ with RLS-enabled tables for players, lobby presence, matches, rounds, submissions, word_scores, match_logs; Supabase Realtime channels for lobby + match topics  
**Testing**: Vitest (unit), Testing Library (components), Playwright (dual-session e2e), Artillery (perf on round resolution), contract tests for REST endpoints and Server Actions  
**Target Platform**: Web (Next.js on Vercel + Supabase Cloud); local dev via `pnpm dev` + `supabase start`  
**Project Type**: Single Next.js application hosting UI + Server Actions + Route Handlers  
**Performance Goals**: Move submission acknowledgment <200 ms p95, round summary broadcast <400 ms p95, lobby presence propagation <2 s p95, UI animation 60 FPS for swap/word highlight  
**Constraints**: Server-authoritative moves, 10-round limit, username-only auth, 5+0 clocks, simultaneous swap secrecy, offline-safe reconnect within 10 s, TDD + Clean Code, no PII storage beyond usernames  
**Scale/Scope**: Target 20–50 concurrent internal testers, thousands of historical matches for analytics, single global region (Icelandic dictionary) during playtests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Server-Authoritative**: PASS — All matchmaking, submissions, scoring, and timer transitions are enforced in Server Actions backed by Supabase transactions; clients only render snapshots and optimistic placeholders.

**Performance SLA**: PASS — Move RTT <200 ms, round broadcast <400 ms, presence <2 s targets recorded in Success Criteria and will be instrumented via `performance.mark()` + structured logs consumed by CI perf tests.

**Type Safety**: PASS — New shared types (`MatchState`, `RoundSummary`, `WordScoreEntry`) will live in `lib/types/` and be consumed by both Server Actions and UI; Zod schemas enforce inputs.

**Mobile-First**: PASS — Lobby cards, timers, and swap controls will keep ≥44×44 px hit targets; board grid already responsive from scaffold; new overlays will be touch-accessible.

**Observability**: PASS — Logging pipeline extended with `matchId`, `round`, `submissionLatencyMs`, `broadcastLatencyMs`, and disconnect reasons; hooks feed Sentry + Supabase logs.

**Clean Code**: PASS — Plan decomposes features into domain modules (`lib/matchmaking`, `lib/rounds`, `lib/scoreboard`) with focused responsibilities; lint + review enforce Clean Code rules.

**TDD**: PASS — Every story includes RED tests (Playwright dual-session, Vitest reducers, integration tests) before implementation; CI ensures Red→Green order.

**External Context**: PASS — Supabase Realtime presence + broadcast best practices sourced from official docs (Context7) and summarized in `research.md`; provenance noted.

Post-Design Re-check: PASS — Research decisions, data model, API contracts, and quickstart instructions satisfy every constitutional gate with no waivers required.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# Single Next.js application (UI + Server Actions + Route Handlers)
app/
├── actions/                 # Server Actions (auth, matchmaking, rounds, scoring)
├── api/                     # Route Handlers for contracts/tests
├── (lobby|match) UI routes  # Lobby, match board, summary screens
├── layout.tsx / page.tsx
└── styles/

components/
├── game/                    # BoardGrid, MoveFeedback, timers
└── lobby/                   # Presence list, invitations, match cards

lib/
├── types/                   # MatchState, RoundSummary, WordScoreEntry, Invitation
├── matchmaking/             # pairing heuristics, invitation helpers
├── realtime/                # channel subscriptions, reconnect helpers
└── scoring/                 # word scoring utilities, summary builders
    ├── roundSummary.ts      # aggregates word scores per round, computes deltas
    └── highlights.ts        # extracts tile coordinates for word highlighting

scripts/
└── supabase/                # migrations, policies, seeding, quickstart, match log tooling

supabase/
├── migrations/              # schema updates for players/matches/rounds
└── policies/                # RLS snapshots & verification

tests/
├── unit/                    # Domain logic (matchmaking, timers, scoring)
├── integration/             # API + server action flows (login → lobby → match)
├── contract/                # OpenAPI-backed tests for REST surfaces
└── perf/                    # Artillery/Playwright perf scenarios for RTT + broadcast SLAs

.github/
└── workflows/               # CI (lint, typecheck, unit, integration, perf, Supabase)
```

**Structure Decision**: Continue with single Next.js project rooted at repo root, expanding domain-focused subfolders (`lib/matchmaking`, `components/lobby`) while keeping Server Actions in `app/actions/` and Supabase artifacts under `supabase/` and `scripts/supabase/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
