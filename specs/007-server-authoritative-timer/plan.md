# Implementation Plan: Server-Authoritative Timer and Frozen-Tile Tiebreaker

**Branch**: `007-server-authoritative-timer` | **Date**: 2026-02-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-server-authoritative-timer/spec.md`

## Summary

The server-authoritative timer infrastructure (clock gate in `submitMove`, timeout synthesis and timer deduction in `roundEngine`, `clockEnforcer` pure functions, `stateLoader` server-hydration, client countdown in `GameChrome`) was implemented in spec 006 and is complete. This spec closes three remaining gaps:

1. **`ended_reason` type mismatch**: TypeScript type uses `"time_expiry"` but the DB constraint and spec require `"timeout"`. Fix the type and all call sites.
2. **`computeFrozenTileCountByPlayer` includes `"both"` tiles**: Per Q2 clarification, `"both"` tiles count for neither player. The function must exclude them.
3. **No frozen-tile tiebreaker**: `determineMatchWinner()` uses score only. Add frozen-tile tiebreaker (score → exclusive frozen tiles → draw) per FR-004.

All changes are confined to type definitions, two business-logic functions, and their tests. No migrations, no new files beyond tests.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20
**Primary Dependencies**: Next.js 16 (App Router), Supabase JS v2, Zod
**Storage**: Supabase PostgreSQL — `matches`, `rounds`, `move_submissions` (all in place)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (Next.js), Supabase Cloud
**Performance Goals**: Timer check in `submitMove` adds one DB field read (already fetched in match query); tiebreaker is a pure in-memory comparison — negligible overhead, well within <200ms RTT SLA
**Constraints**: Must not break existing passing tests (48 files, 310 tests)
**Scale/Scope**: 3 files modified, ~4 new test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative | ✅ PASS | All timer logic and winner determination execute server-side in Server Actions and `roundEngine`. No client involvement in game-state decisions. |
| II. Performance Standards | ✅ PASS | Frozen-tile count is a pure loop over `matches.frozen_tiles` (max 76 entries). Tiebreaker is two integer comparisons. No additional DB queries in critical path. |
| III. Type-Safe End-to-End | ✅ PASS | Fixing `MatchEndedReason` type eliminates a runtime DB error. Compiler will flag all stale `"time_expiry"` usages. |
| IV. Progressive Enhancement | ✅ PASS | No UI changes beyond FinalSummary display (already renders `frozenTileCount`). |
| V. Observability | ✅ PASS | Existing structured logging in `completeMatchInternal` captures `ended_reason` and `winnerId`. No new logging needed. |
| VI. Clean Code | ✅ PASS | `determineMatchWinner` stays <20 lines; `computeFrozenTileCountByPlayer` stays <10 lines. |
| VII. TDD | ✅ REQUIRED | Each fix preceded by a failing test. See task order below. |
| VIII. External Context | N/A | No external libraries or APIs introduced. |
| IX. Commit Messages | ✅ REQUIRED | Conventional Commits: `test(match): ...` before `fix(match): ...` commits. |

**No violations. No complexity justification required.**

## Project Structure

### Documentation (this feature)

```text
specs/007-server-authoritative-timer/
├── plan.md              # This file
├── research.md          # Phase 0 — gap analysis and decision log
├── data-model.md        # Phase 1 — type changes and function contracts
├── quickstart.md        # Phase 1 — dev setup and test commands
├── contracts/
│   └── function-contracts.md   # Modified signatures and tiebreaker table
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (affected files only)

```text
lib/
└── types/
    └── match.ts                       # MatchEndedReason: "time_expiry" → "timeout", remove "error"

lib/
└── match/
    └── matchSummary.ts                # computeFrozenTileCountByPlayer: exclude "both" tiles

app/
└── actions/
    └── match/
        ├── completeMatch.ts           # determineMatchWinner: add frozenCounts param + tiebreaker logic
        └── submitMove.ts              # "time_expiry" → "timeout" in completeMatchInternal call

tests/
└── unit/
    └── lib/
        └── match/
            ├── matchSummary.test.ts   # NEW: tests for fixed computeFrozenTileCountByPlayer
            └── resultCalculator.test.ts  # NEW or UPDATED: tests for tiebreaker in determineMatchWinner
tests/
└── integration/
    └── match/
        ├── timedOutPlayerAutoPass.spec.ts  # NEW: round auto-resolves when timed-out player absent
        └── frozenTileTiebreaker.spec.ts    # NEW: match completion uses tiebreaker correctly
```

**Structure Decision**: Existing Next.js App Router layout. No new directories.

## Task Execution Order (for `/speckit.tasks`)

Tasks follow TDD: each failing test is committed before its implementation.

### Group A — Type Alignment (unblocks everything)

| # | Task | Type |
|---|------|------|
| A1 | Write failing test: `MatchEndedReason` does not include `"time_expiry"` | test |
| A2 | Fix `MatchEndedReason`: rename `"time_expiry"` → `"timeout"`, remove `"error"` | fix |
| A3 | Update `submitMove.ts`: `"time_expiry"` → `"timeout"` in `completeMatchInternal` call | fix |
| A4 | Scan and fix any remaining `"time_expiry"` string literals in codebase | fix |

### Group B — Frozen Tile Count Fix

| # | Task | Type |
|---|------|------|
| B1 | Write failing tests: `computeFrozenTileCountByPlayer` excludes `"both"` tiles | test |
| B2 | Fix `computeFrozenTileCountByPlayer`: remove `|| tile.owner === "both"` from both branches | fix |
| B3 | Verify `app/match/[matchId]/summary/page.tsx` passes corrected counts to `FinalSummary` | verify |

### Group C — Frozen Tile Tiebreaker

| # | Task | Type |
|---|------|------|
| C1 | Write failing unit tests: `determineMatchWinner` applies tiebreaker on equal scores | test |
| C2 | Update `determineMatchWinner` signature to accept `frozenCounts` | feat |
| C3 | Implement tiebreaker logic: score → frozen tiles → draw | feat |
| C4 | Update `completeMatchInternal`: compute `frozenCounts`, pass to `determineMatchWinner` | feat |
| C5 | Write integration test: match completed with equal scores uses frozen tile tiebreaker | test |

### Group D — `ended_reason = "timeout"` Integration

| # | Task | Type |
|---|------|------|
| D1 | Write integration test: match ends with `ended_reason = "timeout"` on time expiry | test |
| D2 | Verify `completeMatchInternal` called with `"timeout"` (not `"time_expiry"`) in all paths | verify |
| D3 | Verify `reasonLabel` in `FinalSummary` handles `"timeout"` display string | verify |

### Group E — Final Validation

| # | Task | Type |
|---|------|------|
| E1 | Run full test suite; ensure 0 failures and 0 regressions | verify |
| E2 | Run `pnpm typecheck` and `pnpm lint`; fix any issues | verify |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `"time_expiry"` used in test fixtures/snapshots | Medium | Low | TypeScript compile errors will surface all usages immediately after type fix |
| `computeFrozenTileCountByPlayer` used in other display logic with different semantics | Low | Medium | Grep all callsites before changing; currently only 1 callsite identified |
| `determineMatchWinner` is a private function in completeMatch.ts — hard to unit test | Low | Low | Extract to separate pure function in `lib/match/resultCalculator.ts` if needed for testability |
| Integration tests for tiebreaker require a fully played match with equal scores | Medium | Medium | Use direct DB seeding in test setup to set scores and frozen tiles without playing 10 rounds |
