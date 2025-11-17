# Lobby Presence Test Fix

## Problem
The Playwright test `lobby-presence.spec.ts` was failing because when a player (tester-beta) disconnected by closing their browser context, their presence card remained visible in the lobby list for the other player (tester-alpha).

**Expected behavior**: After pageB/contextB closes, tester-beta should disappear from tester-alpha's lobby list within 5 seconds.

**Actual behavior**: tester-beta's presence card remained visible, causing the test assertion to fail (expected 0 cards, got 1).

## Root Cause
The issue had multiple contributing factors:

1. **No expiration filtering**: The `fetchLobbySnapshot()` function queried all `lobby_presence` records without filtering out expired ones
2. **Stale database records**: When a browser context closed, the presence record in the database remained with a 30-second TTL
3. **No cleanup mechanism**: There was no server-side cleanup to remove/expire presence records when clients disconnected
4. **Realtime limitations**: When a browser context closes abruptly, the Supabase Realtime "leave" event may not propagate reliably

## Solution
Implemented a multi-layered fix to ensure reliable presence cleanup:

### 1. Added Expiration Filter (`lib/matchmaking/profile.ts`)
```typescript
.gt("expires_at", new Date().toISOString())
```
The `fetchLobbySnapshot()` function now filters out expired presence records, ensuring the polling API only returns active players.

### 2. Created Cleanup API Endpoint (`app/api/lobby/presence/route.ts`)
Added a new `DELETE /api/lobby/presence` endpoint that immediately expires the authenticated user's presence record.

### 3. Added `expireLobbyPresence` Function (`lib/matchmaking/service.ts`)
```typescript
export async function expireLobbyPresence(
  client: AnyClient,
  playerId: string
): Promise<void>
```
Instead of deleting records, this updates `expires_at` to the current timestamp, making them immediately filtered out by the query.

### 4. Updated Disconnect Logic (`lib/matchmaking/presenceStore.ts`)
```typescript
fetch("/api/lobby/presence", {
  method: "DELETE",
  keepalive: true,
})
```
The `disconnect()` function now calls the cleanup endpoint with `keepalive: true` to ensure the request completes even during page unload.

## How It Works
When a user disconnects (e.g., closes their browser tab/context):

1. React cleanup effect triggers `disconnect()`
2. `disconnect()` sends a DELETE request with `keepalive` to expire the presence record
3. The server updates `expires_at` to the current time
4. Other clients' polling queries filter out the expired record via the `.gt("expires_at")` filter
5. The UI updates to remove the disconnected player

## Fallback Mechanisms
The fix includes multiple layers of defense:

- **Primary**: API cleanup call immediately expires the record
- **Realtime**: Supabase Realtime "leave" events update the UI
- **Polling**: 500ms polling interval with expiration filter catches any missed updates
- **Natural expiry**: Records expire after TTL (configurable via `PLAYTEST_PRESENCE_TTL_SECONDS`)

## Testing
The test should now pass reliably because:
- The cleanup API call completes within ~100-500ms
- The polling cycle runs every 500ms
- The test has a 5-second timeout, providing ample time for cleanup
- The expiration filter ensures stale records are never returned

## Environment Variables
- `PLAYTEST_PRESENCE_TTL_SECONDS`: Controls how long presence records remain valid (default: 30 seconds)

