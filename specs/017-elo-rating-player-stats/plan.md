# Implementation Plan: Elo Rating & Player Stats

**Branch**: `017-elo-rating-player-stats` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-elo-rating-player-stats/spec.md`

## Summary

Add Elo rating calculation and player statistics to Wottle. After each match completion, the system calculates rating changes using the standard Elo formula (variable K-factor: 32 for new players, 16 for established), updates both players atomically, and persists per-match rating snapshots. Ratings display in the lobby, on the final summary screen, and in a player profile modal with career stats and 5-game trend.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20, Next.js 16 (App Router)
**Primary Dependencies**: Supabase JS v2, React 19+, Tailwind CSS 4.x, Zod
**Storage**: Supabase PostgreSQL — existing `players` table (modified), new `match_ratings` table
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web (desktop + mobile browsers)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Rating update <2s after match completion; lobby rating refresh <3s; profile query <200ms
**Constraints**: Server-authoritative calculation (FR-016); atomic updates (FR-004); rating floor 100 (FR-005)
**Scale/Scope**: ~4 new/modified files in `/lib/rating/`, ~2 new Server Actions, ~3 modified components, 1 new component, 1 migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative Game Logic | PASS | Elo calculation runs in `completeMatchInternal()` server-side; clients are display-only |
| II. Real-Time Performance Standards | PASS | Rating calc is O(1) math (<1ms); DB writes add <50ms to match completion; no impact on move RTT |
| III. Type-Safe End-to-End | PASS | New types in `/lib/types/match.ts`; Zod validation on Server Action inputs; explicit return types |
| IV. Progressive Enhancement & Mobile-First | PASS | Profile modal is responsive; lobby rating display uses existing responsive grid; no new touch interactions |
| V. Observability & Resilience | PASS | Rating failures logged with structured JSON; graceful degradation ("Rating update pending") on failure |
| VI. Clean Code Principles | PASS | `calculateElo()` is a pure function; `persistRatingChanges()` has single responsibility; <20 lines each |
| VII. TDD (NON-NEGOTIABLE) | PASS | Pure Elo function is highly testable; integration tests for atomic persistence; component tests for display |
| VIII. External Context Providers | N/A | No external library APIs needed; standard Elo formula is domain knowledge |
| IX. Commit Message Standards | PASS | Will follow `test(rating): ...` and `feat(rating): ...` conventions |

**Post-design re-check**: All gates remain PASS. No new runtime, no performance impact on critical paths, no RLS changes to existing tables.

## Project Structure

### Documentation (this feature)

```text
specs/017-elo-rating-player-stats/
├── plan.md              # This file
├── research.md          # Phase 0: integration research
├── data-model.md        # Phase 1: schema + types
├── quickstart.md        # Phase 1: setup instructions
├── contracts/           # Phase 1: Server Action contracts
│   └── server-actions.md
└── tasks.md             # Phase 2: task breakdown (via /speckit.tasks)
```

### Source Code (repository root)

```text
lib/
├── rating/
│   ├── calculateElo.ts          # Pure Elo formula + K-factor
│   └── persistRatingChanges.ts  # Atomic DB write (match_ratings + players)
└── types/
    └── match.ts                 # Extended with rating types

app/
├── actions/
│   ├── match/
│   │   ├── completeMatch.ts     # Modified: call Elo calc after winner determination
│   │   └── getMatchRatings.ts   # New: fetch rating deltas for FinalSummary
│   └── player/
│       └── getPlayerProfile.ts  # New: fetch profile + stats + trend
└── styles/
    └── board.css                # Rating delta animation (if needed)

components/
├── lobby/
│   └── LobbyCard.tsx            # Modified: render Elo rating + difference
├── match/
│   └── FinalSummary.tsx         # Modified: render rating delta per player
└── player/
    └── PlayerProfileModal.tsx   # New: stats + trend modal

supabase/
└── migrations/
    └── 20260315001_elo_rating.sql  # Schema: players columns + match_ratings table

tests/
├── unit/
│   ├── lib/rating/
│   │   └── calculateElo.spec.ts      # Pure function tests
│   └── components/player/
│       └── PlayerProfileModal.spec.ts # Component render tests
└── integration/
    └── rating/
        ├── persistRatingChanges.spec.ts  # DB transaction tests
        └── getPlayerProfile.spec.ts      # Server Action tests
```

**Structure Decision**: Follows existing Wottle convention — domain logic in `/lib/rating/`, Server Actions in `/app/actions/`, components in `/components/player/`. New `rating` domain module parallels existing `game-engine`, `match`, `scoring` modules.

## Complexity Tracking

> No violations. All gates pass without justification needed.
