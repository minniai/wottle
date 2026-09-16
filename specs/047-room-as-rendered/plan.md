# Implementation Plan: Field & Ledger — as rendered

**Branch**: `047-phone-field-full-width` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/047-room-as-rendered/spec.md`

## Summary

Close the nine findings of the 16 September rendered review and bind the four amendments. R1 first, because a data bug makes every screenshot a lie; R5 last, because it is the check the others are measured by.

- **R1 Data integrity** — three verified defects. (1) The frozen-tiles CAS rpc has no migration, so `persistFrozenTilesAtomically` always takes its blind-update fallback: a stale baseline erases earlier rounds' freezes, the letters become swappable, and `bandsFromWords` falls back to the full run over new letters. Fix: the migration, no fallback, one retry onto the fresh map, a verify probe. (2) `recoverStuckRound` seeds the next round from a pre-scoring freeze map and treats one partial row as "scored". Fix: `board_snapshot_after` as the marker, `rounds.frozen_tiles_before` as the baseline, a fresh read for the next round. (3) The client accumulator never resets on rematch, never hydrates on reload, keeps deleted partials. Fix: `GET /api/match/[matchId]/words` + a reducer keyed by `matchId`; store guards on `matchId`. Plus the settled-band rule (S4) and the dev-only spelling invariant.
- **R2 Geometry** — `.room__ledger` bound to the stack's height instead of stretched to the viewport.
- **R3 Ledger** — the row is the grid item and owns its rule; the live row is two lines from a `{ line1, line2 }` `liveText`; the hint collapses; the `frozen` notice becomes a timed live state.
- **R4 Field marks** — one CSS rule for shared numerals; S8 verified.
- **R5 Fixtures & baselines** — eight new phases from literals; baselines at three viewports; human checklist.
- **R6 Documents** — DS amendments, the docs move, `CLAUDE.md`, the corrected bundle copy.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x, zustand, Supabase JS v2, Zod. No new dependency.
**Storage**: Supabase PostgreSQL. One additive migration: the function `update_frozen_tiles_if_unchanged`. No table or column change.
**Testing**: Vitest (JSDOM + static stylesheet assertions), Playwright visual projects against `/dev/room`, `@axe-core/playwright`.
**Target Platform**: browsers at 1440×900, 1280×800, 390×844.
**Performance Goals**: unchanged SLAs. The history route is fetched once per mount, rematch or missed broadcast — never on the move path or the 2s poll.
**Constraints**: nothing over the field; geometry does not animate; eight colours; one `aria-live` region for the live row.
**Scale/Scope**: about 30 files edited, 10 created; 16 phases × 3 viewports × 2 platforms of baselines. Estimated 4½ days.

## Constitution Check

| Principle | Assessment | Verdict |
| --- | --- | --- |
| I. Server-Authoritative | The freeze CAS moves the "unchanged" check into the database; the client's history is read-only; the invariant only logs. | PASS |
| II. Real-Time Performance | No new query on the move or broadcast path; the CAS is one indexed update. | PASS |
| III. Type-Safe End-to-End | `HistoryWord` typed from `WordScore`; route input validated with Zod; `LiveState` extended as a discriminated union. | PASS |
| IV. Mobile-First | The phone ledger keeps `height: auto`; the trigger holds two lines within 44px. | PASS |
| V. Observability | `frozen-tiles.stale-retry` kept; `frozen-tiles.fallback-update` removed with the branch it logged. | PASS |
| VI. Clean Code | `settledCells`, `retryWithFreshBaseline`, `liveStateFor` are extracted single-purpose functions. | PASS |
| VII. TDD | Every task in `tasks.md` is a `[test]` before its `[impl]`. | PASS |
| VIII. External Context | Supabase Postgres best practices loaded before writing the function (security definer, empty search_path, grants). | PASS |
| IX. Commits | Conventional Commits, one per passing test. | PASS |

## Project Structure

- `supabase/migrations/20260916001_update_frozen_tiles_if_unchanged.sql`
- `app/actions/match/publishRoundSummary.ts`, `lib/match/recoverStuckRound.ts`, `scripts/supabase/verify.ts`
- `lib/match/wordHistory.ts`, `app/api/match/[matchId]/words/route.ts`
- `components/room/hooks/{useWordHistory,useAccumulatedRounds}.ts`, `lib/room/{roomStore,bandGeometry,wordIntegrity,ledgerRows}.ts`, `lib/constants/copy.ts`
- `components/room/{Ledger,MatchRoomController,MatchRoomView}.tsx`, `components/room/hooks/useFieldInteraction.ts`
- `app/styles/room.css`, `app/dev/room/{fixtures.ts,RoomFixture.tsx,page.tsx}`
- tests under `tests/unit/**`, `tests/contract/**`, `tests/integration/ui/**`
- docs per R6

## Phase 0 — research

See `research.md`: root-cause model for S5 with the diagnostic and its readings; the handoff corrections.

## Phase 1 — design

No new persistence beyond the function. Contracts: `GET /api/match/[matchId]/words` → `{ matchId, words: HistoryWord[] }` (401 no session, 403 not a participant of a live match, 404 unknown match).
