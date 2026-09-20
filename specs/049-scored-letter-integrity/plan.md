# Implementation Plan: Scored-letter integrity and ownership

**Branch**: `049-scored-letter-integrity` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/049-scored-letter-integrity/spec.md`
**Diagnosis**: [research.md §1](./research.md) — done against production before this plan; it overturned the spec's first hypothesis, and the spec was amended.

## Summary

Two slices, in priority order.

- **I · Integrity (US1, P0)** — four small changes on the server and one on the client. (1) `loadMatchState` serves a completed or abandoned match from the highest round that was played, and never regenerates a board from the seed for a match that already has rounds; a missing round row is an error that triggers recovery, not a fresh board. (2) `advanceRound` step 14 and recovery's equivalent write guard the match row against a stale writer with a compare-and-set on the round they read. (3) A server-side integrity check after every resolution: every record spells on the persisted board, no frozen letter has changed; a failure logs at error and routes to recovery. (4) `bandCells` on the client requires a settled band's letters to spell its word, and the dev-only integrity report becomes a once-per-match warn in every environment.
- **II · Ownership (US2, P1)** — a scored letter takes its colour from its frozen tile's owner; the `shared` state, `sharedCells` and the ink-700 rule go; a band covers only the cells its word froze first; hover lights the whole word from the record. Design system §2/§5.1/§5.2, rules §12, the `LEK`-over-`GILT` fixtures and the baselines follow.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router)
**Primary Dependencies**: Supabase JS v2, Zod, zustand. No new dependency.
**Storage**: Supabase PostgreSQL. **No schema change.** No data repair: the loader change renders the affected matches correctly from the rows they have.
**Testing**: Vitest (loader, round engine, band geometry, Field), Playwright (a completed match's final field on two clients; the three fixture crossings), the visual suite over the changed baselines.
**Target Platform**: unchanged.
**Performance Goals**: unchanged SLAs. The integrity check is one board read and ≤ 40 string comparisons per resolution, inside the resolution that already took the board in hand. The loader gains one `max(round_number)` read for completed matches only.
**Constraints**: the constitution's server authority (all fixes are server-side truths; the client only refuses to draw); eight colours, no ink on a scored letter; no new column.
**Scale/Scope**: about 14 files edited, 2 created (`lib/match/matchIntegrity.ts`, its test). Estimated 2 days.

## Constitution Check

| Principle | Assessment | Verdict |
| --- | --- | --- |
| I. Server-Authoritative | Every correction is to what the server persists or serves; the client's only new behaviour is refusing to draw a band it cannot verify. | PASS |
| II. Real-Time Performance | Nothing on the move path. The integrity check runs after scoring, inside the resolution `after()` hook, bounded by the board it already holds. | PASS |
| III. Type-Safe End-to-End | `MatchState` unchanged; the guard changes a query, not a type. `bandCells` gains a board argument, typed. | PASS |
| IV. Mobile-First | Presentation change only in II; cell sizes and targets untouched. | PASS |
| V. Observability | Three new structured events: `match.integrity.failed` (error), `match.write.stale` (warn), `bands.record-mismatch` (warn, once per match). | PASS |
| VI. Clean Code | `lastPlayedRound`, `verifyMatchIntegrity`, `ownerSeatOf` are small pure functions; the guard is one `.eq` clause. | PASS |
| VII. TDD | Every task is `[test]` before `[impl]`; the diagnosis's SQL becomes a fixture for the loader test. | PASS |
| VIII. External Context | Supabase Postgres practices loaded for the conditional update (no new SQL objects). | PASS |
| IX. Commits | Conventional Commits, one per passing test. | PASS |

**Rules gate** (CLAUDE.md "Game Rules Spec"): the round engine changes (step 14 guard, integrity check) do not alter scoring, freezing or validation; rules §12's crossing row changes with slice II and is amended in the same change. §10's regression log gains one row for the seed-regeneration defect.

## Project Structure

### Documentation (this feature)

```text
specs/049-scored-letter-integrity/
├── plan.md
├── research.md          # Phase 0: the diagnosis, decisions R1–R6, the reusable SQL
├── data-model.md        # invariants on existing entities; no schema change
├── quickstart.md
├── contracts/
│   ├── state-loader.md  # which round a match state is served from
│   ├── round-end-write.md
│   ├── integrity-check.md
│   └── ownership-rendering.md
└── tasks.md             # /speckit.tasks output
```

### Source Code (repository root)

```text
lib/match/
├── stateLoader.ts           # lastPlayedRound; ensureBoardSnapshot no longer regenerates for a match with rounds; isRoundMissing → recovery
├── roundEngine.ts           # step 14 guarded update; integrity check after step 9c
├── recoverStuckRound.ts     # guarded match-row write
└── matchIntegrity.ts        # NEW verifyMatchIntegrity(board, records, frozenTiles, frozenLetters)
lib/observability/           # three event helpers
lib/room/
├── bandGeometry.ts          # bandCells(word, board, frozenTiles, ownerSeat): spells + first-owner cells; sharedCells removed; ownerSeatOf
└── wordIntegrity.ts         # warn once per match in every environment
components/room/
├── Field.tsx                # seat from frozenTiles owner; `shared` state removed; hover from record coordinates
├── FieldCell.tsx            # CellState −"shared"
└── FieldBands.tsx           # unchanged geometry over fewer cells
app/styles/room.css          # .field__cell[data-state="shared"] rules removed
app/dev/room/fixtures.ts     # LEK/GILT crossing fixture: the L is Kári's
tests/unit/lib/match/{stateLoader.lastPlayed,roundEngine.staleWrite,matchIntegrity}.spec.ts
tests/unit/lib/room/{bandGeometry,wordIntegrity}.spec.ts
tests/unit/components/room/Field.spec.tsx
tests/integration/ui/{match-completion,room-fixtures}.spec.ts
docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md   # §2, §5.1, §5.2
docs/prd_and_requirements/wottle_game_rules.md                               # §12 crossing row; §10 regression row
CLAUDE.md
```

**Structure Decision**: no new module boundary; one new pure file for the integrity check so the round engine and recovery share it. Branched from `main`; rebase after PR #263 (spec 048) merges, since both touch `RoomFixture.tsx` and the baselines.

## Phase 0 — research

Done: [research.md](./research.md). The diagnosis replaced the fast-path hypothesis with two confirmed defects (seed regeneration on a missing round row; an unguarded round-end write landing after completion) and one design rule to change.

## Phase 1 — design

No persistence change. No new Server Action or route. Contracts under [contracts/](./contracts/); invariants in [data-model.md](./data-model.md); verification steps in [quickstart.md](./quickstart.md).

Post-design constitution re-check: unchanged, all PASS.

## Complexity Tracking

None. No principle is violated; no new abstraction is introduced beyond one pure verification module.
