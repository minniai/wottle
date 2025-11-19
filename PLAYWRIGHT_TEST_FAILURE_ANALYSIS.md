# Playwright Test Failure Analysis

## Executive Summary

All 4 failing Playwright tests share a **root cause**: The Supabase Realtime channel for `lobby_presence` is failing to initialize, causing the presence system to fall back to polling mode. This prevents players from seeing each other in real-time and blocks the matchmaking flow.

## Failed Tests

1. **lobby-presence.spec.ts** - Players not visible to each other within 5 seconds
2. **rounds-flow.spec.ts** - Match shell not appearing after matchmaking
3. **matchmaking.spec.ts (auto queue)** - Test timeout after 60 seconds
4. **matchmaking.spec.ts (direct invite)** - Matchmaker controls not visible

## Root Cause

### The Problem

The `lobby_presence` table is **not configured for Supabase Realtime**. The browser logs clearly show:

```txt
Lobby presence channel error Error: Realtime channel error (lobby-presence)
Lobby presence channel error Error: Snapshot request failed with status 500
```

### Evidence from Error Context

From `test-results/lobby-presence-Lobby-prese-f4b60-econds-and-updates-on-leave/error-context.md`:

The page snapshot shows two error messages displayed to users:

- **"Realtime disconnected"** - "Showing snapshot data every few seconds until the realtime channel reconnects."
- **"Presence unavailable"** - "Realtime channel error (lobby-presence)"

Both player cards ARE present in the DOM (`tester-alpha` and `tester-beta`), but the test fails because:

1. The realtime channel fails to establish
2. The system falls back to polling
3. The 500ms polling interval is racing with the test's 5-second timeout
4. The test expectations aren't being met quickly enough

### Missing Database Configuration

**File**: `supabase/migrations/20251115001_playtest.sql`

The migration creates the `lobby_presence` table but **does not enable realtime replication**. For Supabase Realtime to work, you need:

```sql
-- MISSING: Enable realtime replication for lobby_presence
alter table public.lobby_presence replica identity full;

-- MISSING: Add table to realtime publication
alter publication supabase_realtime add table public.lobby_presence;
```

Without these SQL statements:

- The Realtime channel subscription will fail with `CHANNEL_ERROR`
- The `presenceChannel.ts` code triggers the `onError` callback
- The system falls back to polling via `/api/lobby/players`
- Race conditions occur between polling intervals and test expectations

## Technical Deep Dive

### How the Presence System Works

1. **Connection Flow** (`presenceStore.ts`):
   - Client calls `connect({ self: PlayerIdentity })`
   - Creates a Supabase Realtime channel: `channel("lobby-presence")`
   - Subscribes to presence events: `sync`, `join`, `leave`
   - Starts a 500ms polling fallback

2. **Realtime Channel** (`presenceChannel.ts`):
   - Subscribes to `presence` events on the `lobby-presence` channel
   - On `SUBSCRIBED` status: tracks presence via `channel.track(payload)`
   - On `CHANNEL_ERROR` status: calls `onError` callback
   - Falls back to polling via `fetchPollingSnapshot()` every 500ms

3. **Polling Fallback**:
   - Calls `/api/lobby/players` every 500ms
   - Fetches data from `lobby_presence` JOIN `players` table
   - Works as a safety net but introduces latency

### Why Tests Fail

#### Test 1: lobby-presence.spec.ts

```typescript
await expect(
  listA.getByTestId("lobby-card").filter({ hasText: /tester-beta/i }),
).toBeVisible({ timeout: 5_000 });
```

**Failure Mode**:

- Player B logs in and creates a `lobby_presence` record
- Player A's realtime channel is in error state
- Player A polls every 500ms but query might be failing (500 status)
- 5-second timeout expires before polling catches the new player

#### Test 2: rounds-flow.spec.ts

```typescript
await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 15000 });
```

**Failure Mode**:

- Players can't see each other in lobby (same as Test 1)
- Matchmaking flow depends on presence detection
- Queue never pairs players because presence system is broken
- Match never starts, so `match-shell` never appears

#### Test 3: matchmaking.spec.ts (auto queue)

```typescript
await Promise.all([waitForMatchShell(pageA), waitForMatchShell(pageB)]);
```

**Failure Mode**:

- Test times out after 60 seconds
- Browser logs show repeated channel errors
- Players are in the queue but can't discover each other
- Matchmaking logic likely depends on realtime presence events

#### Test 4: matchmaking.spec.ts (direct invite)

```typescript
await expect(page.getByTestId("matchmaker-controls")).toBeVisible({
  timeout: 10_000,
});
```

**Failure Mode**:

- After login, the page should show matchmaker controls
- Likely the lobby page is stuck in error state
- UI might be waiting for presence to be "ready" before showing controls
- 10-second timeout expires before state transitions

## Why the 500 Error?

From browser logs:

```
Lobby presence channel error Error: Snapshot request failed with status 500
```

This suggests `/api/lobby/players` is returning 500. Looking at the code:

**File**: `app/api/lobby/players/route.ts`

```typescript
export async function GET() {
  try {
    const players = await fetchLobbySnapshot();
    return NextResponse.json({ players }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: ... }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
```

**File**: `lib/matchmaking/profile.ts` (`fetchLobbySnapshot`)

```typescript
const { data, error } = await supabase
  .from("lobby_presence")
  .select(
    `
    player:player_id (
      id,
      username,
      display_name,
      avatar_url,
      status,
      last_seen_at,
      elo_rating
    )
  `,
  )
  .gt("expires_at", new Date().toISOString())
  .order("updated_at", { ascending: false });
```

**Possible cause of 500**:

- The join query `player:player_id (...)` might be failing if RLS policies are misconfigured
- Or there's a database connection issue during tests
- Or the foreign key reference is failing in some edge case

But even if polling works, **the tests expect realtime behavior**, not 500ms polling intervals.

## Impact on CI/CD

All lobby and matchmaking tests are **completely blocked**:

- Can't test presence detection
- Can't test matchmaking queue
- Can't test invite flows
- Can't test round-based gameplay

This is a **P0 critical blocker** for the playtest milestone.

## Solution

### Fix #1: Enable Realtime Replication (Required)

Create a new migration file:

**File**: `supabase/migrations/20251119001_enable_realtime.sql`

```sql
-- Enable realtime replication for lobby_presence
alter table public.lobby_presence replica identity full;

-- Add lobby_presence to realtime publication
alter publication supabase_realtime add table public.lobby_presence;

-- Optional: Also enable for matches and rounds if needed for match flow
alter table public.matches replica identity full;
alter publication supabase_realtime add table public.matches;

alter table public.rounds replica identity full;
alter publication supabase_realtime add table public.rounds;
```

### Fix #2: Verify RLS Policies

Check if RLS is blocking the polling fallback. The tests might need:

```sql
-- Allow anonymous/service role access to lobby_presence for testing
create policy "Public read access for testing"
  on public.lobby_presence
  for select
  to anon, authenticated
  using (true);
```

### Fix #3: Update Test Strategy

If realtime is still flaky in CI, update tests to be more resilient:

```typescript
// Wait for connection to be ready, not just visible
await expect
  .poll(
    async () => {
      const status = await pageA.evaluate(() => {
        return window.useLobbyPresenceStore?.getState().status;
      });
      return status;
    },
    { timeout: 10_000 },
  )
  .toBe("ready");
```

## Verification Steps

1. **Apply the migration**:

   ```bash
   supabase db reset
   # or
   supabase migration up
   ```

2. **Run quickstart script**:

   ```bash
   ./scripts/supabase/quickstart.sh
   ```

3. **Check realtime status in Supabase Studio**:
   - Navigate to Database → Replication
   - Verify `lobby_presence` has replication enabled

4. **Run tests locally**:

   ```bash
   pnpm playwright test tests/integration/ui/lobby-presence.spec.ts
   ```

5. **Check browser logs** - should NOT see:
   - "Realtime channel error (lobby-presence)"
   - "Snapshot request failed with status 500"

## Additional Recommendations

### 1. Add Realtime Monitoring

Add debug logging to confirm channel status:

```typescript
// In presenceChannel.ts
.subscribe((status) => {
  console.log("[Realtime] Channel status:", status);
  if (status === "SUBSCRIBED") {
    console.log("[Realtime] Successfully subscribed to lobby-presence");
    // ... existing code
  } else if (status === "CHANNEL_ERROR") {
    console.error("[Realtime] Channel error - realtime is not configured correctly");
    // ... existing code
  }
});
```

### 2. Add Test Fixtures

Create a test utility to verify realtime is working before running tests:

```typescript
// tests/helpers/realtime-check.ts
export async function verifyRealtimeChannel(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const client = window.supabase;
      const channel = client.channel("test-channel");

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resolve(true);
        } else if (status === "CHANNEL_ERROR") {
          resolve(false);
        }
      });

      setTimeout(() => resolve(false), 5000);
    });
  });
}
```

### 3. Update Quickstart Script

Add a verification step to `scripts/supabase/quickstart.sh`:

```bash
echo "Verifying realtime configuration..."
psql "$DATABASE_URL" -c "SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'lobby_presence';"
```

## Timeline

- **Immediate**: Apply Fix #1 (migration)
- **Short-term**: Verify RLS policies (Fix #2)
- **Medium-term**: Add monitoring and test improvements
- **Long-term**: Consider moving to presence-only realtime (no DB persistence)

## Conclusion

The tests are failing because **Supabase Realtime is not configured for the `lobby_presence` table**. This is a straightforward fix requiring a single SQL migration. Once realtime is enabled, all 4 tests should pass as the presence system will work as designed.

The polling fallback is working as a safety net, but the tests expect sub-second realtime updates, not 500ms polling intervals. Additionally, the polling endpoint appears to be returning 500 errors intermittently, making the fallback unreliable.

**Priority**: P0 - Blocks all playtest functionality
**Effort**: Low - Single migration file
**Risk**: Low - Standard Supabase configuration
