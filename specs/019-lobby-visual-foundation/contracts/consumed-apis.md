# Consumed APIs & Server Actions

**Feature**: 019-lobby-visual-foundation
**Date**: 2026-04-16

This feature introduces one new HTTP endpoint (a lightweight count aggregate) and consumes existing Server Actions / API routes without changing their contracts. This document enumerates each consumed surface so downstream reviewers can verify the feature does not drift the public contract.

## New Endpoint

### `GET /api/lobby/stats/matches-in-progress`

**Purpose**: Back the live stats strip's "matches in progress" counter (FR-008, FR-008b).

**Auth**: Session cookie optional. Count is a non-sensitive aggregate; unauthenticated readers receive the same response.

**Request**: No query parameters, no body.

**Response 200 (application/json)**:

```json
{
  "matchesInProgress": 4
}
```

**Type** (`lib/types/match.ts`):

```typescript
export interface LobbyMatchesStats {
  matchesInProgress: number;
}
```

**Rate limit**: Reuse existing `lobby:stats` scope (new scope added in the rate-limit config), 60 req/min per client.

**Caching**: `Cache-Control: no-store`. Client polls every 10 s (`LOBBY_STATS_POLL_MS`).

**Errors**:

- `429 Too Many Requests` — client must respect `Retry-After`. Stats strip shows the last-known value until the next successful poll.
- `500 Internal Server Error` — client treats as transient; stats strip shows "—" until next poll; no toast (non-critical failure).

## Consumed — Server Actions (unchanged)

### `loginAction(prevState, formData)`

File: `app/actions/auth/login.ts`. Used by: `LobbyLoginForm` (now rendered inside `PlayNowCard` when session absent).
**Contract unchanged**: same `LoginActionState` return type; same validation rules; same session cookie side effect.

### `startQueueAction()`

File: `app/actions/matchmaking/startQueue.ts`. Used by: `PlayNowCard` when the user activates Play Now.
**Contract unchanged**. Mode argument is NOT introduced in this iteration (see spec Assumptions and FR-006b — mode is held in local component state only; iteration 2 will wire it through).

### `sendInviteAction(targetId)`

File: `app/actions/matchmaking/sendInvite.ts`. Used by: `InviteDialog` (send variant).
**Contract unchanged**.

### `respondInviteAction(inviteId, decision)`

File: `app/actions/matchmaking/sendInvite.ts`. Used by: `InviteDialog` (receive variant).
**Contract unchanged**.

## Consumed — HTTP Routes (unchanged)

### `GET /api/lobby/players`

Used by: Zustand presence store's polling fallback; invoked on mount and on Realtime failure.
**Contract unchanged**.

### `DELETE /api/lobby/presence`

Used by: Zustand presence store's disconnect handler on page unload.
**Contract unchanged**.

### `GET /api/lobby/invite`

Used by: `InviteDialog` (receive variant) polls every 3 s for incoming invites (behaviour migrated from `MatchmakerControls`, unchanged).
**Contract unchanged**.

### `POST /api/lobby/invite/[inviteId]/respond`

Backing route for `respondInviteAction`. Not called directly by new components.
**Contract unchanged**.

### `GET /api/match/active`

Used by: `InviteDialog` / `PlayNowCard` to detect a match becoming active after accepting or a successful queue pairing (behaviour migrated from `MatchmakerControls`).
**Contract unchanged**.

## Realtime Channels (unchanged)

### `lobby-presence`

Used by: `useLobbyPresenceStore` (no code change). Consumed by `LobbyDirectory`, `LobbyStatsStrip` (online count), and `LobbyCard` status indicator.

## Regression Guards

For each consumed surface above, the following MUST hold after Phase I testing:

- All existing Server Action tests continue to pass (`app/actions/**/*.spec.ts`).
- All existing lobby E2E tests continue to pass (`tests/integration/ui/lobby-presence.spec.ts`, any invite specs).
- `grep -r "startQueueAction\|sendInviteAction\|respondInviteAction\|loginAction" components/ lib/` shows no call-site signature drift.
