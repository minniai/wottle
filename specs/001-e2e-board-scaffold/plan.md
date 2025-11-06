# Implementation Plan: MVP E2E Board & Swaps

**Branch**: `001-e2e-board-scaffold` | **Date**: 2025-11-05 | **Spec**: /Users/arividar/git/wottle/specs/001-e2e-board-scaffold/spec.md
**Input**: Feature specification from `/specs/001-e2e-board-scaffold/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Goal: deliver an iterative end-to-end development scaffold that stands up a local Supabase-backed environment and a Next.js app rendering a 16×16 board with a server-authoritative swap path. The MVP confirms the development architecture (local dev, CI/CD via GitHub Actions, typed contracts, and RLS-aligned data model) without full game logic or word checks.

Technical approach:

- Next.js 16 (App Router) + React 19 + TypeScript 5.x
- Server Actions for mutations (swap) with service_role usage restricted to server-only contexts; anon key for client reads
- Supabase PostgreSQL 15+ with minimal schema: `boards` (JSONB grid) and `moves` (audit log)
- Contracts documented as REST Route Handlers for testability; Server Action remains the primary app path; route handlers for perf-critical paths export `runtime = 'edge'`
- GitHub Actions pipeline: install, type-check, lint, unit + integration tests, optional Supabase CLI spin-up for DB-backed tests; artifact and cache strategy

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x, Node.js 20.x, Next.js 16 (App Router), React 19  
**Primary Dependencies**: Next.js, React, `@supabase/supabase-js`, Zod, Tailwind CSS 4.x, ESLint, Prettier  
**Storage**: Supabase PostgreSQL 15+ (local via Supabase CLI `supabase start`), JSONB grid model (`boards`), audit log (`moves`)  
**Testing**: Vitest (unit), Playwright (e2e), Testing Library (components); contract tests against Route Handlers; Artillery (performance) with CI gate on p95 move RTT <200ms  
**Target Platform**: Web (local dev; deploy target Vercel per constitution)
**Project Type**: web (single Next.js app hosting UI + Server Actions)  
**Performance Goals**: Local MVP: swaps appear <1s end-to-end; production SLA alignment: <200ms RTT on critical server path with instrumentation  
**Constraints**: Server-authoritative mutations, RLS parity with production, anon vs service_role key separation, mobile-first grid readability, edge runtime for performance-critical routes (e.g., `/api/swap`) unless explicitly justified  
**Scale/Scope**: MVP scope limited to single board render and swap mutation; no dictionary checks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Server-Authoritative**: PASS — Swap executes via Next.js Server Action on server, using Supabase service_role only in server runtime.

**Performance SLA**: PASS — Instrument swap path with `performance.mark()` and log timings; production SLA p95 end-to-end move RTT <200ms validated by automated performance tests; local perceived RTT ≤1s is a non-binding developer target.

**Type Safety**: PASS — Shared types in `/lib/types/`; Zod validates inputs; Server Actions return explicit typed payloads.

**Mobile-First**: PASS — Grid cells sized to ≥44×44px touch targets; responsive container with scroll/zoom as needed.

**Observability**: PASS — Structured JSON logs on server actions; Sentry hook stubbed for later enablement.

**Clean Code**: PASS — Single-responsibility modules; meaningful names; low parameter counts; domain-oriented organization.

**TDD**: PASS — Tests precede implementation for grid rendering, swap happy-path, invalid swap rejection.

**External Context**: PASS — Official docs (Next.js, Supabase) cited in research; provenance recorded.

Post-Design Re-check: All gates remain PASS based on Phase 1 design outputs (`research.md`, `data-model.md`, contracts, quickstart). No waivers required.

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
# Single Next.js application (UI + Server Actions)
app/
├── actions/              # Server Actions (e.g., board.ts: getBoard, swapTiles)
├── (routes)/             # App Router routes
└── api/health/route.ts   # Optional health endpoint for CI checks

components/
└── game/                 # BoardGrid, Tile, controls

lib/
├── types/                # Shared types (BoardGrid, MoveRequest, MoveResult)
└── game-engine/          # Board utilities; future: word lists, scoring

scripts/
└── supabase/             # seed/reset scripts, policy snapshots

supabase/
└── migrations/           # SQL migrations for boards/moves

tests/
├── unit/
├── integration/
├── contract/
└── perf/                 # Artillery scenarios and thresholds for p95 RTT gating

.github/
└── workflows/            # CI pipeline (lint, typecheck, tests, optional Supabase)

# Existing repository assets
prd/wordlist/             # Current word list modules (to be referenced by lib/ later)
```

**Structure Decision**: Single Next.js project that hosts both UI and server logic via Server Actions, aligned with the constitution’s "Primary Stack". Existing `prd/wordlist/` remains in place and can be referenced or migrated under `lib/game-engine/` as needed during later features.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
