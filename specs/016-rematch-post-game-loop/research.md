# Research: Rematch & Post-Game Loop

**Feature**: 016-rematch-post-game-loop | **Date**: 2026-03-15

## R1: Rematch Negotiation Pattern

**Decision**: Two-action Server Action pattern (request + respond) with DB-backed state, mirroring the existing `sendDirectInvite`/`respondToInvite` pattern in `lib/matchmaking/inviteService.ts`.

**Rationale**: The invite pattern is already proven in the codebase. A dedicated `rematch_requests` table with UNIQUE(match_id) enforces FR-010 (one-shot) at the database level. Server Actions provide type-safe request/response with rate limiting.

**Alternatives considered**:
- Stateless broadcast-only (no DB): Rejected — cannot enforce one-shot semantics or handle reconnection; server can't validate request state after disconnect.
- Single action with `action: "request" | "accept" | "decline"` param: Rejected — boolean params violate Clean Code Principle VI; separate actions are clearer and more testable.

## R2: Simultaneous Rematch Detection

**Decision**: Detect at request time by checking if a pending request already exists where the caller is the responder. If so, auto-accept.

**Rationale**: Simple and race-condition safe. The UNIQUE(match_id) constraint means only one request row exists. The second requester's action finds the existing pending request, sees themselves as the responder, and accepts. No special locking needed — the DB constraint prevents duplicate rows.

**Alternatives considered**:
- Client-side coordination (both send, server merges): Rejected — requires distributed locking or optimistic concurrency; more complex than the DB-level approach.
- Polling for "both requested" state: Rejected — adds latency and complexity.

## R3: Realtime Event Delivery

**Decision**: Reuse existing `match:{matchId}` Realtime channel with a new `"rematch"` broadcast event type.

**Rationale**: FR-011 mandates using the existing channel. The FinalSummary page already has access to the match channel (via Supabase browser client). Adding one more `.on("broadcast", { event: "rematch" })` listener is minimal change. The payload follows the same pattern as `"state"` and `"round-summary"` events.

**Alternatives considered**:
- New `rematch:{matchId}` channel: Rejected — violates FR-011; adds connection overhead.
- Supabase Postgres Changes (database triggers): Rejected — more complex setup, not needed for simple broadcast.

## R4: Series Chain Storage

**Decision**: Add `matches.rematch_of` nullable FK column pointing to the previous match. Walk the chain at display time to compute game number and series score.

**Rationale**: Minimal schema change (one column). Series is a derived concept — storing it as a denormalized entity would duplicate match-level data. Walking a chain of ≤10 matches is fast (sequential queries, each hitting a PK index).

**Alternatives considered**:
- Dedicated `series` table: Rejected — over-engineering for a display-only feature; adds join complexity and migration surface.
- Storing series_id on matches: Rejected — requires generating series IDs and deciding when to break series; `rematch_of` is self-describing.

## R5: Timeout Handling

**Decision**: Client-side 30s timer in the `useRematchNegotiation` hook. Server-side staleness check in `respondToRematchAction` (compares `created_at` against current time).

**Rationale**: The client timer provides immediate UX feedback (redirect to lobby after 30s). The server staleness check prevents accepting a stale request if the client timer is bypassed or delayed. Dual enforcement (client + server) follows the server-authoritative principle.

**Alternatives considered**:
- Server-side cron/scheduled function for expiry: Rejected — adds infrastructure complexity for a 30s window; client timer + server validation is sufficient.
- Database TTL/expiry trigger: Rejected — Supabase doesn't support row-level TTL natively; would require pg_cron setup.

## R6: Navigate-Away / Disconnect Handling

**Decision**: FR-018 (requester navigates away → cancel) is handled by the hook's cleanup on unmount. FR-009 (opponent disconnects → treat as declined) relies on the existing 10s reconnection window; if the opponent doesn't respond within 30s, the request expires regardless.

**Rationale**: The 30s timeout subsumes most disconnect scenarios. The hook's useEffect cleanup unsubscribes from the channel. For the requester navigating away, the request remains pending in DB but expires naturally.

**Alternatives considered**:
- `navigator.sendBeacon` on unmount to fire-and-forget cancel: Considered but deferred — adds complexity for an edge case that the 30s timeout already handles.
- Server-side heartbeat monitoring: Rejected — the existing reconnection mechanism handles this.

## R7: State Machine Design

**Decision**: Client-side state machine in `useRematchNegotiation` hook with phases: `idle | requesting | waiting | incoming | accepted | declined | expired | interstitial`.

**Rationale**: Keeps all rematch UI state in one place. The hook manages Realtime subscription, timeout timers, and interstitial delay. FinalSummary stays simple — it reads phase and calls action callbacks.

**Alternatives considered**:
- XState/state machine library: Rejected — adds dependency for a simple 8-state machine; plain React state is sufficient.
- State in FinalSummary directly: Rejected — violates Clean Code (FinalSummary is already 400+ lines); extracting to a hook follows composition pattern.
