# Research: 006-match-completion

**Branch**: `006-match-completion` | **Date**: 2026-02-25

## Findings Summary

### Finding 1: 10-Round Limit Already Implemented in Round Engine

**Decision**: No new round-limit logic is required. The enforcement already exists.

**Evidence**: `roundEngine.ts` line 165 already has:
```
const isGameOver = nextRound > 10;
```
When true, it calls `completeMatchInternal(matchId, "round_limit")` which sets `matches.state = "completed"`, writes `winner_id`, and broadcasts state.

**Rationale**: P1 work is primarily verification (ensuring tests cover the existing path), ensuring move rejection on completed matches works, and ensuring the client navigates correctly on receiving `state: "completed"`.

**Alternatives considered**: Re-implementing from scratch — rejected (unnecessary duplication of working code).

---

### Finding 2: Client-Side Clock Is Fully Disconnected from Server Authority

**Decision**: Implement server-authoritative clocks by adding `started_at` to the `rounds` table, computing elapsed time on submission, and deducting per-round elapsed time from each player's stored timer value.

**Evidence**:
- `matches.player_a_timer_ms` and `matches.player_b_timer_ms` columns exist but are **never updated** after match creation.
- `TimerHud.tsx` runs a client-side `setInterval` that decrements display time locally — the server is never consulted.
- `submitMove.ts` performs no time check against the server clock.
- `MatchEndedReason` type already includes `"timeout"` as a variant — the system was designed for this but not implemented.
- The constitution (Principle I) explicitly states: "Clock management and turn order enforced server-side with database transactions."

**Rationale**: The simplest server-authoritative approach uses round timestamps:
1. Store `started_at` on each round when it transitions to `"collecting"`.
2. On `submitMove`, compute `elapsed = now() - round.started_at`. Reject if `player_remaining_ms - elapsed <= 0`.
3. After round resolves, deduct each player's elapsed time from their respective `player_x_timer_ms` column (updating it for the first time).
4. Broadcast the updated, server-computed `remainingMs` value in each `state` event.

**Alternatives considered**:
- **Cron / Edge Function to push timeout passes**: The constitution explicitly allows Edge Functions for scheduled time forfeits. However, for MVP, a simpler inline synthesis approach avoids the operational complexity. When `advanceRound()` runs after a single-player submission and the other player's computed remaining time is ≤ 0, a synthetic `"timeout"` submission is inserted for the expired player, allowing the round to resolve. This covers the spec's requirement without a background process.
- **Per-round timer table**: A separate `player_clock_state` table was considered but adds join complexity without benefit. The `matches` columns (`player_a_timer_ms`, `player_b_timer_ms`) are sufficient when updated per-round.

---

### Finding 3: Game-Over Screen Route Already Exists

**Decision**: The `/match/[matchId]/summary` route and `FinalSummary` component already exist. Work is scoped to verifying/completing the rich-summary content (frozen tile counts per player, top-scoring words per player) and ensuring the navigation trigger works reliably.

**Evidence**:
- `MatchClient.tsx` already navigates to `/match/[matchId]/summary` when `matchState.state === "completed"` is detected.
- `FinalSummary.tsx` already accepts `PlayerSummary[]`, `ScoreboardRow[]`, and `WordHistoryRow[]` props.
- `word_score_entries` table already stores per-word totals and `is_duplicate` flag.
- `scoreboard_snapshots` table stores per-round cumulative scores.
- `matches.frozen_tiles` (JSONB) stores the cumulative frozen tile map — frozen tile count per player can be derived by parsing this map.

**Gap**: The existing `FinalSummary` component shows per-round scoring and word history, but may not yet expose: (a) per-player frozen tile count, (b) top-scoring words per player as a highlighted sub-section. These are additive display enhancements, not new data infrastructure.

**Rationale**: Re-using the existing route and component minimises UI work. The data already exists in the DB; the gap is purely presentation.

---

### Finding 4: Timeout-Pass Synthesis Approach for One-Player-Expired Rounds

**Decision**: When `advanceRound()` is called after one submission and the missing player's clock has expired, synthesise a `"timeout"` submission inline.

**Evidence**:
- `move_submissions.status` already supports `"timeout"` as a valid value.
- `advanceRound()` currently returns `{ status: "waiting" }` when only one submission exists. The check can be extended: if one submission exists AND the absent player's computed remaining time ≤ 0, insert a synthetic timeout submission before proceeding.
- This satisfies FR-003: the round still resolves with the submitted player's move scored normally.

**Rationale**: Eliminates the need for a cron job while maintaining round-resolution consistency. The existing FCFS conflict-resolution logic treats a single submission as automatically accepted (no conflict possible).

---

### Finding 5: Timer State Broadcast Carries Stale Values

**Decision**: `publishMatchState()` must recompute `remainingMs` from the server clock before broadcasting, not read the static DB value.

**Evidence**: Currently, `stateLoader.ts` reads `player_a_timer_ms` directly from the DB (a static default of 300,000 ms) and puts it into the `MatchState.timers` payload. After implementing server-authoritative enforcement, `player_x_timer_ms` will hold the actual remaining time after each round, so broadcasting it after round resolution becomes correct. However, mid-round broadcasts (e.g., to a reconnecting client) must compute: `remaining = player_x_timer_ms - (now() - round.started_at)` to give the client an accurate starting point.

---

### Finding 6: Disconnect-Timer Interaction (Minor Cleanup)

**Decision**: Remove the existing `pauseMatchTimers()` / `isPaused` memory flag from the disconnect handler. Under the new model, the clock runs continuously from `round.started_at`; disconnecting does not pause the server clock (consistent with the spec).

**Evidence**: `handleDisconnect.ts` currently calls `pauseMatchTimers()` and broadcasts `status: "paused"`. The spec does not say the clock pauses on disconnect — only on move submission. The `"paused"` status is also used to suppress the client-side `setInterval` countdown. Under the new model, the client countdown can be replaced entirely by trust in the server-broadcast remaining time.

**Alternatives considered**: Keep the disconnect-pauses-clock behaviour as a goodwill UX gesture — rejected because it is inconsistent with the spec's clarity on what pauses the clock, and it introduces a server-untracked pause that would complicate elapsed time calculations.

---

## Key File References

| File | Relevance |
|------|-----------|
| `lib/match/roundEngine.ts` | 10-round limit check; add `started_at` write; add timeout-pass synthesis |
| `app/actions/match/submitMove.ts` | Add server-side clock expiry check |
| `lib/match/stateLoader.ts` | Compute mid-round `remainingMs` from `round.started_at` |
| `lib/match/statePublisher.ts` | Ensure updated timer values are broadcast after round resolution |
| `app/match/[matchId]/summary/page.tsx` | Verify/add frozen tile count + top-scoring words display |
| `components/match/FinalSummary.tsx` | Add frozen tile count and per-player top-word sections |
| `supabase/migrations/` | New migration: add `rounds.started_at` column |
| `lib/types/match.ts` | Update `TimerState` if needed; add `MatchCompletionPayload` type |
