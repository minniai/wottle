# Implementation Plan: Scoring Rules Overhaul

**Branch**: `013-scoring-change` | **Date**: 2026-03-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-scoring-change/spec.md`

## Summary

Overhaul the scoring pipeline to replace full-board 8-directional scanning with targeted orthogonal-only scanning from swap coordinates, add exhaustive word enumeration with cross-validation combination optimization, implement time-based scoring precedence with intermediate tile freezing, enforce exclusive tile ownership (no shared tiles), remove combo bonus, switch to coordinate-based word uniqueness, and lower the minimum word length to 2.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20, Next.js 16 (App Router)
**Primary Dependencies**: Supabase JS v2, Zod, Vitest, Playwright
**Storage**: Supabase PostgreSQL — `matches` (frozen_tiles JSONB), `word_score_entries`, `scoreboard_snapshots`
**Testing**: Vitest (unit/contract), Playwright (E2E), Artillery (performance)
**Target Platform**: Web (server-side scoring via Server Actions)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Word validation <50ms, round resolution RTT <200ms, broadcast <100ms
**Constraints**: Server-authoritative game logic (Constitution Principle I), TDD mandatory (Principle VII)
**Scale/Scope**: 2-player matches, 10×10 board, ~2.76M dictionary entries, 10 rounds per match

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative (NON-NEGOTIABLE) | ✅ PASS | All scoring changes are server-side. No game logic moves to client. |
| II. Real-Time Performance (NON-NEGOTIABLE) | ✅ PASS | Targeted scanning (8 lines vs 38) improves performance. Combination optimization is O(2^n) but n≤6 in practice. Must verify <50ms with perf tests. |
| III. Type-Safe End-to-End | ✅ PASS | Type changes (remove "both", remove isDuplicate, remove comboBonus) propagate through shared types in /lib/types/. |
| IV. Progressive Enhancement | ✅ PASS | No UI interaction changes. Score display changes only. |
| V. Observability | ✅ PASS | Existing structured logging and performance marks preserved. |
| VI. Clean Code | ✅ PASS | New crossValidator.ts follows SRP. Functions <20 lines. |
| VII. TDD (NON-NEGOTIABLE) | ✅ PASS | All changes follow Red→Green→Refactor. ~50% of existing tests need rewrite. |
| VIII. External Context Providers | ✅ PASS | No new external dependencies. |
| IX. Commit Message Standards | ✅ PASS | Conventional commits format. |

**Post-Phase 1 re-check**: All gates still pass. The combination optimization algorithm (R2) was the main performance concern — analysis confirms candidate sets are small enough (≤6 words typically) for brute-force within <50ms.

## Project Structure

### Documentation (this feature)

```text
specs/013-scoring-change/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technical research and decisions
├── data-model.md        # Phase 1: entity changes and migrations
├── quickstart.md        # Phase 1: implementation guide
├── contracts/           # Phase 1: module contracts
│   └── scoring-pipeline.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
lib/
├── game-engine/
│   ├── boardScanner.ts      # Modified: new scanFromSwapCoordinates()
│   ├── crossValidator.ts    # NEW: cross-validation invariant + combination optimization
│   ├── deltaDetector.ts     # Major rewrite: per-player targeted scanning
│   ├── wordEngine.ts        # Modified: sequential processing, no combo/duplicates
│   ├── frozenTiles.ts       # Modified: remove "both", first-owner-wins
│   └── scorer.ts            # Modified: remove calculateComboBonus()
├── types/
│   ├── match.ts             # Modified: FrozenTileOwner, WordScoreBreakdown, RoundScoreResult, RoundSummary
│   └── board.ts             # Modified: BoardWord JSDoc
├── constants/
│   └── game-config.ts       # Modified: minimumWordLength 3→2
├── scoring/
│   └── roundSummary.ts      # Modified: remove combo bonus aggregation
└── ...

app/
└── actions/match/
    └── publishRoundSummary.ts  # Modified: remove text-based duplicate query

components/match/
├── RoundSummaryPanel.tsx    # Modified: remove combo bonus display
├── ScoreDeltaPopup.tsx      # Modified: remove combo line
├── deriveScoreDelta.ts      # Modified: remove combo derivation
├── deriveRoundHistory.ts    # Modified: remove combo from history
└── FinalSummary.tsx         # Modified: remove isDuplicate badges

tests/
├── unit/lib/game-engine/    # Major rewrites for new scanning + validation logic
├── unit/lib/scoring/        # Updates for combo removal
├── integration/             # Round scoring integration tests
└── perf/                    # Performance validation
```

**Structure Decision**: Existing Next.js web application structure. One new file (`crossValidator.ts`) added to `lib/game-engine/`. All other changes modify existing files in place.

## Complexity Tracking

No constitution violations to justify. All changes align with existing patterns and principles.
