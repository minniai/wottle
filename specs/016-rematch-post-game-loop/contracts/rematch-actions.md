# API Contracts: Rematch Server Actions

**Feature**: 016-rematch-post-game-loop | **Date**: 2026-03-15

## `requestRematchAction`

**Path**: `app/actions/match/requestRematch.ts`
**Type**: Server Action (Next.js `"use server"`)

### Input

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| `matchId` | string (uuid) | Yes | Must reference a completed match where caller is participant |

### Output

```typescript
type RematchResult =
  | { status: "pending" }                    // Request created, waiting for opponent
  | { status: "accepted"; matchId: string }; // Simultaneous detection — match created
```

### Errors

| Error | Condition |
|-------|-----------|
| `"Authentication required."` | No valid session |
| `"Match is not finished yet. Rematch unavailable."` | Match state ≠ completed |
| `"Only participants in the finished match can request a rematch."` | Caller not player_a or player_b |
| `"You have already requested a rematch for this match."` | Pending request exists from this caller |
| `"A rematch has already been processed for this match."` | Request already accepted/declined/expired |
| `RateLimitExceededError` | >5 requests per 60s |

### Side Effects

1. Inserts `rematch_requests` row (status=pending) — OR accepts existing request if simultaneous
2. Broadcasts `RematchEvent` on `match:{matchId}` channel
3. Writes `match.rematch.requested` to match_logs
4. On simultaneous: creates new match, updates both players to "in_match", writes `match.rematch.created`

---

## `respondToRematchAction`

**Path**: `app/actions/match/respondToRematch.ts`
**Type**: Server Action (Next.js `"use server"`)

### Input

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| `matchId` | string (uuid) | Yes | Must have a pending rematch request |
| `accept` | boolean | Yes | true = accept, false = decline |

### Output

```typescript
type RespondToRematchResult =
  | { status: "accepted"; matchId: string } // New match created
  | { status: "declined" }                   // Request declined
  | { status: "expired" };                   // Request was stale (>30s)
```

### Errors

| Error | Condition |
|-------|-----------|
| `"Authentication required."` | No valid session |
| `"No rematch request found for this match."` | No request row exists |
| `"You are not the responder for this rematch request."` | Caller ≠ responder_id |
| `"This rematch request has already been processed."` | Status ≠ pending |
| `RateLimitExceededError` | >5 requests per 60s |

### Side Effects

**On accept:**
1. Creates new match via `bootstrapMatchRecord` (with `rematch_of` link)
2. Updates `rematch_requests` row (status=accepted, new_match_id set)
3. Sets both players to "in_match" status
4. Writes `match.rematch.created` to match_logs
5. Broadcasts `rematch-accepted` event

**On decline:**
1. Updates `rematch_requests` row (status=declined)
2. Writes `match.rematch.declined` to match_logs
3. Broadcasts `rematch-declined` event

**On expired (stale request):**
1. Updates `rematch_requests` row (status=expired)
2. Broadcasts `rematch-expired` event

---

## Realtime Event: `"rematch"`

**Channel**: `match:{matchId}` (existing)
**Event name**: `"rematch"`

### Payload

```typescript
interface RematchEvent {
  type: "rematch-request" | "rematch-accepted" | "rematch-declined" | "rematch-expired";
  matchId: string;
  requesterId: string;
  status: "pending" | "accepted" | "declined" | "expired";
  newMatchId?: string; // Present only when type = "rematch-accepted"
}
```

### Event Types

| Type | Trigger | Recipient Action |
|------|---------|-----------------|
| `rematch-request` | Player clicks Rematch | Opponent shows RematchBanner |
| `rematch-accepted` | Accept or simultaneous | Both players show interstitial → redirect |
| `rematch-declined` | Decline | Requester disables button, shows "Opponent declined" |
| `rematch-expired` | 30s timeout | Both players informed; requester redirected to lobby |
