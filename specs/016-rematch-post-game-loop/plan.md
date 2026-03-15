# Implementation Plan: Rematch & Post-Game Loop

**Branch**: `016-rematch-post-game-loop` | **Date**: 2026-03-15 | **Spec**: `specs/016-rematch-post-game-loop/spec.md`
**Input**: Feature specification from `/specs/016-rematch-post-game-loop/spec.md`

## Summary

Transform the instant-rematch button into a two-player negotiation flow. Add a `rematch_requests` table and `matches.rematch_of` column. Rewrite `requestRematchAction` to insert a pending request and broadcast via Realtime. Add `respondToRematchAction` for accept/decline. FinalSummary subscribes to match channel for rematch events via a `useRematchNegotiation` state machine hook. Series context is derived by walking the `rematch_of` chain at render time.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20, Next.js 16 (App Router)
**Primary Dependencies**: Supabase JS v2, React 19+, Tailwind CSS 4.x, Zod
**Storage**: Supabase PostgreSQL — new `rematch_requests` table, `matches.rematch_of` column
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web (desktop + mobile)
**Project Type**: Web application (Next.js fullstack)
**Performance Goals**: Rematch invitation visible <1s (SC-002), match creation <3s (SC-001)
**Constraints**: Server-authoritative, <200ms RTT, existing match Realtime channel reused (FR-011)
**Scale/Scope**: 2-player matches, series chains up to 10 rematches (SC-004)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative Game Logic | PASS | All rematch logic in Server Actions (`requestRematchAction`, `respondToRematchAction`); clients are view-only via hook |
| II. Real-Time Performance Standards | PASS | Rematch events on existing match channel; SC-001 <3s, SC-002 <1s; no new critical-path latency |
| III. Type-Safe End-to-End | PASS | Explicit return types (`RematchResult`, `RespondToRematchResult`), Zod-ready validation, shared types in `/lib/types/match.ts` |
| IV. Progressive Enhancement | PASS | Rematch works with polling fallback (existing matchChannel pattern); touch targets ≥44px |
| V. Observability & Resilience | PASS | Match log events for request/accept/decline via `writeMatchLog`; 30s timeout handles stale requests |
| VI. Clean Code | PASS | Hook extracts state machine; pure service functions (`rematchService.ts`); repository pattern for DB access |
| VII. TDD | PASS | Tests first at every layer; unit tests for pure functions, integration tests for flows |
| VIII. External Context Providers | N/A | No external library APIs or assets needed |
| IX. Commit Standards | PASS | Conventional commits per task (`feat(rematch):`, `test(rematch):`) |

## Project Structure

### Documentation (this feature)

```text
specs/016-rematch-post-game-loop/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research output
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
├── contracts/           # Phase 1 API contracts
│   └── rematch-actions.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20260316001_rematch.sql          # NEW: rematch_requests table, matches.rematch_of

lib/types/
└── match.ts                          # MODIFY: +RematchRequest, +RematchEvent, +SeriesContext

lib/match/
├── rematchService.ts                 # NEW: pure business logic (validate, detect simultaneous, series)
├── rematchRepository.ts              # NEW: DB access (insert/fetch/update rematch requests, chain query)
└── rematchBroadcast.ts               # NEW: broadcast rematch events on match channel

lib/realtime/
└── matchChannel.ts                   # MODIFY: +onRematchEvent callback, +"rematch" event listener

lib/matchmaking/
└── service.ts                        # MODIFY: bootstrapMatchRecord +rematchOf param

app/actions/match/
├── requestRematch.ts                 # REWRITE: request/accept flow with simultaneous detection
└── respondToRematch.ts               # NEW: accept/decline server action

components/match/
├── FinalSummary.tsx                  # MODIFY: integrate hook, phase-driven button/banner UI, series badge
├── useRematchNegotiation.ts          # NEW: hook managing rematch state machine + Realtime subscription
├── RematchBanner.tsx                 # NEW: incoming rematch invitation banner
└── RematchInterstitial.tsx           # NEW: 500ms "Starting new game..." overlay

app/match/[matchId]/summary/
└── page.tsx                          # MODIFY: fetch series context, pass to FinalSummary

tests/unit/lib/match/
└── rematchService.test.ts            # NEW: 14 unit tests for pure service functions
```

**Structure Decision**: Follows existing codebase patterns — Server Actions in `app/actions/match/`, business logic in `lib/match/`, DB access separated into repository, React hooks and components in `components/match/`.

## Architecture

### Database

**`rematch_requests` table:**
- `id` uuid PK, `match_id` uuid FK UNIQUE (FR-010 one-shot), `requester_id` uuid FK, `responder_id` uuid FK, `status` text CHECK (pending/accepted/declined/expired), `new_match_id` uuid FK (set on accept), `created_at` timestamptz, `responded_at` timestamptz

**`matches.rematch_of`** — nullable uuid FK to matches.id. Partial index on non-null values. Enables series chain walking.

### Server Actions

**`requestRematchAction(matchId)`** → `{ status: "pending" } | { status: "accepted", matchId }`
1. Auth + rate limit (`match:rematch`, 5/60s)
2. Validate match completed, caller is participant
3. Check existing request: if pending request where responder = caller → simultaneous → accept immediately
4. Insert `rematch_requests` row (status=pending)
5. Broadcast `rematch-request` event

**`respondToRematchAction(matchId, accept)`** → `{ status: "accepted", matchId } | { status: "declined" } | { status: "expired" }`
1. Auth + rate limit
2. Fetch request, validate caller is responder, request is pending
3. Check staleness: if `created_at` > 30s ago → mark expired
4. Accept: create match (with `rematch_of`), update request, broadcast
5. Decline: update request status, broadcast

### Realtime

Single new event type `"rematch"` on existing `match:{matchId}` channel. Payload: `RematchEvent { type, matchId, requesterId, status, newMatchId? }`.

### UI State Machine (useRematchNegotiation hook)

```
idle → requesting → waiting → [accepted → interstitial → redirect]
                             → [declined (final)]
                             → [expired → redirect to lobby]

idle → incoming (opponent requested) → [accept → accepted → interstitial → redirect]
                                     → [decline → idle (button disabled)]
```

### Series Tracking

Pure functions in `rematchService.ts`: `walkRematchChain()` walks backward through `rematch_of`; `deriveSeriesContext()` computes game number + series score. Summary page fetches chain and passes `SeriesContext` to FinalSummary.

## Key Reuse

| Existing code | Reused for |
|---------------|------------|
| `bootstrapMatchRecord` (`lib/matchmaking/service.ts`) | Creating rematch matches (extended with `rematchOf`) |
| `assertRematchAllowed` (`lib/match/resultCalculator.ts`) | Validation pattern (replaced by `validateRematchRequest`) |
| `writeMatchLog` (`lib/match/logWriter.ts`) | Logging rematch events |
| `subscribeToMatchChannel` (`lib/realtime/matchChannel.ts`) | Rematch event subscription (extended) |
| `statePublisher.ts` broadcast pattern | `rematchBroadcast.ts` |

## Implementation Sequence

1. Types — `RematchRequest`, `RematchEvent`, `SeriesContext`
2. Migration — `rematch_requests` table, `matches.rematch_of`
3. Pure service functions — `rematchService.ts` + unit tests
4. Repository — `rematchRepository.ts`
5. Extend `bootstrapMatchRecord` — add `rematchOf` param
6. Broadcast — `rematchBroadcast.ts`
7. Extend `matchChannel.ts` — add rematch event listener
8. `requestRematchAction` rewrite — with simultaneous detection
9. `respondToRematchAction` — accept/decline
10. `useRematchNegotiation` hook — state machine
11. `RematchBanner` + `RematchInterstitial` components
12. FinalSummary modifications — integrate hook, phase-driven UI
13. Series context — summary page fetch + FinalSummary badge
14. Integration tests
15. E2E tests

## Testing Strategy

**Unit tests (TDD):**
- `rematchService.test.ts`: validateRematchRequest, detectSimultaneousRematch, deriveSeriesContext, walkRematchChain (14 tests)
- FinalSummary.test.tsx: existing tests updated with new mocks

**Integration tests (planned):**
- Full request→accept flow: verify new match created with `rematch_of` link
- Simultaneous detection: both request, single match created
- Decline flow: verify button disabled, no re-request

**E2E tests (planned):**
- Two-player rematch: P1 requests, P2 accepts, both land in new match
- Decline flow: P1 requests, P2 declines, P1 sees disabled button

## Verification

1. `pnpm typecheck` — no type errors ✅
2. `pnpm lint` — zero warnings ✅
3. `pnpm test` — all 498 tests pass ✅
4. `pnpm supabase:migrate` — migration applies cleanly
5. Manual: complete match → Rematch → accept → new match → series badge
