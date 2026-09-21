# Implementation Plan: Ten moves each on one shared clock

**Branch**: `050-async-moves` | **Date**: 2026-09-21 | **Spec**: `specs/050-async-moves/spec.md`
**Input**: Feature specification from `/specs/050-async-moves/spec.md`

## Summary

Replace the ten synchronous rounds with ten independent moves per player on one shared 5:00 clock. Server: a `match_moves` table, a locked `receive_move` RPC that assigns a gap-free receipt sequence, a resolver that claims and finishes moves in that order under compare-and-set, and a settlement path that completes the match once both have ten or the deadline has passed. Client: six move beats replace the six round beats, the clock moves to the ledger caption, the bar lane counts moves, ledger rows are indexed by move, the opponent's reveal never locks the field, and the hold after a scored move is 600ms. Duplicate words score. Docs, rules page, fixtures and baselines follow.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router)
**Primary Dependencies**: Supabase JS v2 (Postgres + Realtime), Zod, zustand. No new dependency.
**Storage**: Supabase PostgreSQL. One destructive migration (`data-model.md`).
**Testing**: Vitest (unit, contract, integration), Playwright (two-player, visual), Artillery (perf)
**Target Platform**: Vercel serverless (`after()` for post-response work); Chrome/Firefox/Safari, phone first
**Project Type**: web app
**Performance Goals**: receipt RTT <200ms p95; resolution latency <200ms p95 warm; broadcast <100ms p95
**Constraints**: server-authoritative; strictly receipt-ordered resolution across racing lambdas; no clock pause; eight colour tokens, two faces, the slip is the only overlay
**Scale/Scope**: two players per match, ~20 concurrent matches

## Constitution Check

- **I Server-authoritative**: receipt, ordering, scoring, freezing, the deadline and the result are all decided in Postgres functions and the Node resolver; the client sends coordinates and the letters it saw. ✅
- **II Performance**: receipt is one RPC; resolution runs in `after()` so the cold dictionary never sits on the request; the dictionary is warmed at match start. ✅
- **III Type-safe**: `MoveResolution` and the new `MatchState` have Zod schemas; the server action has an explicit return type. ✅
- **IV Mobile-first**: the caption clock stays visible in the collapsed phone ledger; nothing new is placed over the field. ✅
- **V Observability**: `move.received`, `move.resolved` (with duration), `move.rejected`, `move.reclaimed`, `match.settled` structured logs; `performance.mark` on the client for own-reveal latency. ✅
- **VII TDD**: every new module lands with its failing test first. ✅
- **Realtime critical path**: the safety poll converges on `resolvedSeq`; reconnection hydrates `lastResolution`. ✅

## Project Structure

### Documentation (this feature)

```
specs/050-async-moves/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── receive-move.md
│   ├── move-resolver.md
│   ├── move-resolved-event.md
│   ├── match-state.md
│   ├── move-state.md
│   └── settlement.md
└── tasks.md
```

### Source Code (repository root)

```
supabase/migrations/20260921001_async_moves.sql
app/actions/match/submitMove.ts            (rewrite)
app/actions/match/completeMatch.ts         (CAS; scores from matches)
app/actions/match/settleMatch.ts           (new; replaces triggerTimeoutCheck)
app/actions/match/claimWin.ts              (narrowed gate)
app/actions/match/previewSwap.ts           (reads matches.board)
app/api/cron/sweep-stale-matches/route.ts  (+ find_due_matches)
app/api/match/[matchId]/words/route.ts     (moveSeq + playerId per word)
lib/match/moveResolver.ts                  (new)
lib/match/matchSettlement.ts               (new)
lib/match/movePublisher.ts                 (new)
lib/match/resultCalculator.ts              (moves first)
lib/match/stateLoader.ts                   (new MatchState; start sets board/clock)
lib/match/schemas.ts                       (moveRequestSchema, moveResolutionSchema)
lib/match/wordHistory.ts, integrityCheck.ts
lib/realtime/matchChannel.ts               (move-resolved)
lib/types/match.ts, lib/types/board.ts
lib/room/moveState.ts                      (new; replaces roundState.ts)
lib/room/fieldInteraction.ts, roomStore.ts, safetySnapshot.ts, revealSequence.ts
lib/room/ledgerRows.ts, accumulatedWords.ts, moveRail.ts (replaces roundRail.ts), clock.ts
lib/constants/copy.ts
components/room/MatchRoomController.tsx, MatchRoomView.tsx, PlayerBar.tsx, BarLane.tsx (replaces ClockLane.tsx), Ledger.tsx, Slip.tsx
components/room/hooks/useMatchTransport.ts, useFieldInteraction.ts, useMoveHold.ts (replaces useSettleHold.ts), useDeadlineTick.ts (replaces useClockTick.ts), useMatchOverSlip.ts
app/dev/room/fixtures.ts, RoomFixture.tsx
app/styles/room.css
app/rules/page.tsx
docs/prd_and_requirements/wottle_game_rules.md, wottle_prd.md
docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md
scripts/supabase/{verify,verify-realtime,seed}.ts, scripts/supabase/policies/check.ts, scripts/docs/consistency-grep.sh
```

Deleted: `lib/match/{roundEngine,instantScoring,conflictResolver,recoverStuckRound,stateMachine,roundEndWrite,clockEnforcer,frozenTilePersistence,frozenTileMerge,partialReveal,timerStore}.ts`, `app/actions/match/{publishRoundSummary,triggerTimeoutCheck}.ts`, `lib/observability/instantScoring.ts`, `app/api/match/[matchId]/rounds/`, `lib/room/roundState.ts`, `lib/room/roundRail.ts`, `components/room/ClockLane.tsx`, `components/room/hooks/{useSettleHold,useClockTick}.ts`, and their tests.

**Structure Decision**: existing layout; no new top-level folder.

## Phases

- **P0** (this PR): design canvas, spec directory, rules doc, PRD, design system, rules page, CLAUDE.md, consistency grep. No code.
- **P1**: migration + RPCs, types, resolver, settlement, publisher, `submitMove`, `stateLoader`, `completeMatch`, `resultCalculator`, routes, scripts, and the client core (`moveState`, store, field interaction, controller, transport) so the branch is playable. Deletions in the same PR.
- **P2**: bars, caption clock, ledger rows and rail, copy, fixtures, visual baselines, Playwright specs, perf scripts.
- **P3**: acceptance greps, docs check, CLAUDE.md status tables.

## Complexity Tracking

| Item | Why it is needed | Simpler alternative rejected because |
| --- | --- | --- |
| Three Postgres functions (receive, claim, finish) | receipt order across racing lambdas needs a row lock at receipt and CAS at claim and finish | a Node-held advisory lock needs a raw `pg` connection from Vercel; inline resolution ties one player's RTT to the other's queue |
| Two reveals in the controller (own, opponent) | the opponent's reveal must draw without locking the field | one reveal keyed on "latest resolution" would lock the field for the opponent's moves |
