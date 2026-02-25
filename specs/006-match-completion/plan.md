# Implementation Plan: Match Completion

**Branch**: `006-match-completion` | **Date**: 2026-02-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-match-completion/spec.md`

## Summary

Complete the core gameplay loop by: (1) verifying and hardening the existing 10-round limit enforcement, (2) replacing the client-only timer display with server-authoritative clock enforcement that rejects submissions after expiry, and (3) extending the already-existing game-over summary screen with frozen tile counts and per-player top-scoring words.

The round-limit mechanic is already in `roundEngine.ts`; the majority of new work is the clock enforcement pipeline and the timer deduction logic. The game-over screen route and component already exist; work there is additive display enhancements.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20
**Primary Dependencies**: Next.js 16 (App Router), React 19+, Supabase (PostgreSQL 15+, Realtime)
**Storage**: PostgreSQL via Supabase — one new column on `rounds` table; `matches.player_x_timer_ms` columns become mutable per-round
**Testing**: Vitest (unit + integration), Playwright (E2E), Artillery (performance)
**Target Platform**: Vercel (Next.js Server Actions) + Supabase Cloud
**Project Type**: Web application
**Performance Goals**: Move RTT <200ms p95 — clock check must add ≤ 5ms (single timestamp comparison, no extra DB round-trip beyond existing round fetch)
**Constraints**: Server-authoritative (constitution Principle I); TDD required (constitution Principle VII); zero new runtime dependencies
**Scale/Scope**: Single-match scoped changes; ~20 concurrent matches in playtest phase

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative Game Logic | ✅ PASS | Clock enforcement is server-side; client timer display remains non-authoritative. All match-end decisions made via Server Actions with DB transactions. |
| II. Real-Time Performance Standards | ✅ PASS | Clock check is a single timestamp subtraction on an already-fetched `rounds` row — adds ~0ms to submitMove RTT. No new DB queries on the hot path. |
| III. Type-Safe End-to-End | ✅ PASS | New `ClockCheckResult` type added; all Server Actions retain explicit return types; Zod validation unchanged. |
| IV. Progressive Enhancement & Mobile-First | ✅ PASS | No UI interaction changes. Game-over screen additions are display-only (frozen tile count, top words). |
| V. Observability & Resilience | ✅ PASS | Clock expiry events and match completion logged via existing structured logging. Reconnection to completed match handled by existing `/summary` route. |
| VI. Clean Code Principles | ✅ PASS | Clock logic extracted to a pure function module (`clockEnforcer.ts`, ≤20 lines per function). Timeout-pass synthesis is a single function in `roundEngine.ts`. |
| VII. TDD (NON-NEGOTIABLE) | ✅ PASS | All new logic (clockEnforcer, timeout synthesis, timer deduction) covered by failing tests before implementation. |
| VIII. External Context Providers | ✅ PASS | No new external libraries. Supabase and Next.js patterns follow prior specs. |
| IX. Commit Message Standards | ✅ PASS | Conventional Commits; test commits before implementation commits per TDD workflow. |

**Post-design re-check**: No constitution violations introduced by the data model (`rounds.started_at`, mutable timer columns). Single migration file. No new runtimes.

## Project Structure

### Documentation (this feature)

```text
specs/006-match-completion/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── submit-move.yaml      # Updated submitMove contract (clock gates)
│   └── match-summary.yaml    # Game-over screen data contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (affected paths)

```text
supabase/
└── migrations/
    └── 20260225001_match_completion.sql   # NEW: adds rounds.started_at

lib/
├── match/
│   ├── clockEnforcer.ts                   # NEW: pure clock-check functions
│   ├── roundEngine.ts                     # MODIFIED: set started_at, timeout-pass synthesis, timer deduction
│   └── stateLoader.ts                     # MODIFIED: compute mid-round remainingMs
├── types/
│   └── match.ts                           # MODIFIED: ClockCheckResult type, MatchEndedReason rename

app/
└── actions/
    └── match/
        └── submitMove.ts                  # MODIFIED: add clock expiry gate

components/
└── match/
    └── FinalSummary.tsx                   # MODIFIED: add frozenTileCount + topWords sections

app/
└── match/
    └── [matchId]/
        └── summary/
            └── page.tsx                   # MODIFIED: query frozen tile count + top words

tests/
├── unit/
│   └── match/
│       └── clockEnforcer.spec.ts          # NEW: pure function unit tests
├── integration/
│   └── match/
│       ├── clockEnforcement.spec.ts       # NEW: submitMove clock rejection integration tests
│       └── matchCompletion.spec.ts        # NEW/EXTENDED: 10-round and time-expiry paths
└── integration/ui/
    └── match-completion.spec.ts           # NEW: E2E full match completion scenario
```

**Structure Decision**: Web application pattern. No new directories beyond `lib/match/clockEnforcer.ts`. Changes are concentrated in `lib/match/`, `app/actions/match/`, and `components/match/`.

## Implementation Phases

---

### Phase A — Database Migration

**Goal**: Add `rounds.started_at` column.

**Files**:
- `supabase/migrations/20260225001_match_completion.sql`

**Design**:
- `ALTER TABLE rounds ADD COLUMN started_at timestamptz;`
- Backfill with `created_at` for existing rows.
- Column is nullable for backfill compatibility; new code always sets it on round creation.

---

### Phase B — Clock Enforcer (Pure Functions)

**Goal**: A new, fully testable module `lib/match/clockEnforcer.ts` containing all clock arithmetic.

**Functions**:

```typescript
// Compute server-authoritative remaining time for a player mid-round.
// round.started_at is the server timestamp when the round entered collecting state.
// storedRemainingMs is the value of player_x_timer_ms from the matches row.
function computeRemainingMs(
  roundStartedAt: Date,
  storedRemainingMs: number,
  now?: Date,
): number

// Returns whether a player is allowed to submit at `now`.
function isClockExpired(
  roundStartedAt: Date,
  storedRemainingMs: number,
  now?: Date,
): boolean

// Compute how much to deduct from a player's remaining time after they submitted.
// submittedAt is from move_submissions.submitted_at.
function computeElapsedMs(roundStartedAt: Date, submittedAt: Date): number
```

**Why pure functions**: Injectable `now` parameter enables deterministic unit tests without mocking system time.

---

### Phase C — submitMove Clock Gate

**Goal**: Reject submissions from players whose clock has expired.

**File**: `app/actions/match/submitMove.ts`

**Insertion point**: After the existing frozen-tile check, before inserting into `move_submissions`.

**Logic**:
1. Load the current round (already fetched for frozen-tile check).
2. Ensure `round.started_at` is set (it will be for all rounds after migration).
3. Call `isClockExpired(round.started_at, player_timer_ms, new Date())`.
4. If expired → return `{ status: "rejected", error: "Your time has expired" }`.

**Performance**: No additional DB query. Uses the round row already fetched in this request.

---

### Phase D — Round Engine: started_at Write

**Goal**: Set `rounds.started_at` when a new round is created in the collecting state.

**File**: `lib/match/roundEngine.ts`

**Change**: In `createNextRound()`, set `started_at = new Date()` on the inserted `rounds` row.

---

### Phase E — Round Engine: Timeout-Pass Synthesis

**Goal**: When `advanceRound()` finds only one submission and the absent player's clock has expired, synthesise a `"timeout"` submission to unblock round resolution.

**File**: `lib/match/roundEngine.ts`

**Logic in `advanceRound()`**:
1. Fetch submissions (current behaviour: return `{ status: "waiting" }` if fewer than 2).
2. **New**: if exactly 1 submission and `started_at` is set, check the absent player's clock.
3. If absent player's clock is expired: insert a synthetic `move_submissions` row with `status = "timeout"` and sentinel coordinates `(-1, -1)`.
4. Continue to resolution with 2 submissions (the real one + the timeout pass).
5. The timeout submission is treated as a pass in conflict resolution (no tiles involved).

**Conflict resolver**: Update `conflictResolver.ts` to skip timeout submissions (they carry no tile coordinates, so no conflict is possible).

---

### Phase F — Timer Deduction After Round Resolves

**Goal**: After each round resolves, update `matches.player_a_timer_ms` and `matches.player_b_timer_ms` with the actual elapsed time deducted.

**File**: `lib/match/roundEngine.ts` (within `advanceRound()`, after resolution)

**Logic**:
1. For each accepted/timeout submission, call `computeElapsedMs(round.started_at, submission.submitted_at)`.
2. Compute `newRemainingMs = stored_timer_ms - elapsed_ms`.
3. Clamp to 0 (never go negative).
4. Update `matches` row: `player_a_timer_ms = newRemainingMs` (or player_b).
5. This update is part of the existing `matches` UPDATE at end of `advanceRound()` (no extra round-trip).

---

### Phase G — stateLoader: Mid-Round Remaining Computation

**Goal**: When broadcasting match state mid-round (e.g. to a reconnecting player), compute the accurate `remainingMs` from the server clock rather than returning the stale stored value.

**File**: `lib/match/stateLoader.ts`

**Logic**:
```typescript
// If round is in "collecting" state and started_at is set:
remainingMs = computeRemainingMs(round.started_at, player_x_timer_ms, new Date())
// If round is resolved or started_at not set, use stored value directly.
```

---

### Phase H — Match Completion via Time Expiry

**Goal**: Handle the edge case where both players' clocks have expired without a natural round submission trigger.

**File**: `lib/match/stateLoader.ts` (checked on load) + `app/actions/match/submitMove.ts` (checked on attempt)

**Logic**:
When loading match state or processing any submission:
1. If `match.state = "in_progress"` and both computed remaining times ≤ 0, call `completeMatch(matchId, "time_expiry")`.
2. This mirrors the existing `completeMatchInternal()` call used for `"round_limit"`.

---

### Phase I — Game-Over Screen: Frozen Tile Count + Top Words

**Goal**: Extend the existing `FinalSummary` component and summary page to display frozen tile counts and per-player top-scoring words.

**Files**:
- `app/match/[matchId]/summary/page.tsx`
- `components/match/FinalSummary.tsx`

**Data queries** (see `contracts/match-summary.yaml`):

```sql
-- Frozen tile count per player (from matches.frozen_tiles JSONB)
-- Parsed in TypeScript: count entries by owner field

-- Top 5 words per player (non-duplicate, by total_points DESC)
SELECT player_id, word, letters_points, bonus_points, total_points
FROM word_score_entries
WHERE match_id = $1 AND is_duplicate = false
ORDER BY player_id, total_points DESC;
-- Then slice top 5 per player in TypeScript
```

**Component additions to `FinalSummary`**:
1. **Frozen tile count**: A row in each player's score card showing tile count and a brief label.
2. **Top words**: A sub-section per player listing up to 5 highest-scoring words with point breakdown.
3. Both are additive — no existing props changed; new optional props with sensible defaults.

---

### Phase J — Integration & E2E Tests

**Goal**: Full coverage of the new paths, including:
- `submitMove` rejected on clock expiry
- `advanceRound` synthesises timeout pass correctly
- Timer deduction correct after each round
- Match completes after round 10 (regression: existing path confirmed by new test)
- Match completes on time expiry (new path)
- Summary page shows correct frozen tile count and top words
- E2E: Two-player match played to completion; game-over screen displayed

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Single `rounds.started_at` column (not a separate timer table) | Minimal schema change; elapsed time is a derived value, not a stored entity |
| Timeout-pass synthesis in `advanceRound()` (not a cron job) | Avoids operational complexity for MVP; handles the common case inline; spec does not require real-time timeout notification |
| `player_x_timer_ms` updated in-place per round (not a new `time_used` column) | Maintains existing broadcast/load path; the stored value always represents "remaining" time after last round |
| `MatchEndedReason` value changed from `"timeout"` to `"time_expiry"` | Matches spec terminology; `"timeout"` is ambiguous (connection timeout vs clock timeout) |
| No cron / Edge Function for MVP | Constitution permits Edge Functions for scheduled time forfeits; deferred to post-MVP when real-time expiry notification is needed |
| FinalSummary additions are additive (no prop renames) | Backward-compatible; existing summary page continues working while new props are added |
