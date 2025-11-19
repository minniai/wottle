# Playwright Test Failures - Investigation Summary

## Progress Timeline

### Issue 1: Missing Database Configuration ✅ FIXED
**Problem**: `lobby_presence` table not configured for Realtime replication  
**Fix**: Created migration `20251119001_enable_realtime.sql`  
**Verification**: ✅ All tables now in `supabase_realtime` publication with full replica identity  

### Issue 2: Missing Environment Variable ✅ FIXED
**Problem**: `.env.local` had `SUPABASE_ANON_KEY` instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
**Fix**: Renamed to `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
**Result**: "Presence unavailable" error disappeared from UI  

### Issue 3: Server-Side Cache Not Clearing ✅ FIXED
**Problem**: `fetchLobbySnapshot()` merges database results with cached players  
**Issue**: When player disconnects, they're deleted from DB but remain in cache for 30s  
**Fix**: Added `forgetPresence(playerId)` to DELETE endpoint  
**Code**:
```typescript
// app/api/lobby/presence/route.ts
await expireLobbyPresence(supabase, session.player.id);
forgetPresence(session.player.id); // ← Added
```

### Issue 4: Players Not Seeing Each Other ❌ CURRENT ISSUE

**Symptom**: Test now fails at line 31 - player B cannot see player A  
**Error**: `element(s) not found` for tester-alpha card in player B's view  
**Page shows**: "Waiting for testers to join the lobby…"

**Database State**:
- ✅ Both players exist in `players` table
- ❌ `lobby_presence` table is empty (no active presence records)

## Root Cause Analysis: Issue #4

### The Problem
Players are being created successfully, but their presence records are either:
1. Not being created at all
2. Expiring immediately  
3. Being deleted by something

### Evidence
```sql
SELECT * FROM players;
-- Returns: tester-alpha, tester-beta ✅

SELECT * FROM lobby_presence;
-- Returns: (0 rows) ❌
```

### Hypothesis 1: Realtime Presence vs Database Presence Mismatch

The application uses **two different presence systems**:

1. **Database Presence** (`lobby_presence` table)
   - Used by polling fallback via `/api/lobby/players`
   - Created in `performUsernameLogin()` → `createPresenceRecord()`
   - Should have 30-second TTL

2. **Realtime Presence** (Supabase in-memory presence)
   - Created via `channel.track(payload)` in `presenceChannel.ts`
   - Lives in-memory, not in database
   - The code tries to use this for real-time updates

**The Mismatch**:
- The app creates database presence records on login ✅
- The app tries to connect to Realtime Presence channels ⚠️
- Realtime Presence channels are failing (`CHANNEL_ERROR`) ⚠️
- App falls back to polling `/api/lobby/players` ⚠️
- Polling returns empty list because `lobby_presence` table is empty ❌

### Why Is `lobby_presence` Empty?

#### Theory A: Records Expire Too Fast
- Default TTL: 30 seconds
- If environment has `PLAYTEST_PRESENCE_TTL_SECONDS=0` or very small value
- Check: Not set in `.env.local`, should default to 30s

#### Theory B: Records Not Being Created
- `createPresenceRecord()` might be failing silently
- Database transaction might be rolling back
- Need to add error logging

#### Theory C: Wrong Database Connection
- Next.js might be using a different database instance
- Or connection pooling is causing issues

### Why Is Realtime Still Failing?

Even with all fixes applied, the UI still shows "Realtime disconnected". This means:

1. **The Supabase client IS initializing** (env vars are correct now)
2. **The channel subscription IS failing** (getting `CHANNEL_ERROR`)
3. **The reason is unknown** (no useful error logs)

Realtime Presence should work without database configuration because it's in-memory. The fact that it's failing suggests:
- JWT token validation issue?
- Realtime service configuration issue?
- Network/CORS issue in test environment?

## Immediate Next Steps

### Step 1: Add Logging to Login Flow
```typescript
// lib/matchmaking/profile.ts
export async function performUsernameLogin(usernameInput: string): Promise<LoginResult> {
  console.log("[performUsernameLogin] Starting login for:", usernameInput);
  
  const player = await upsertPlayerIdentity(supabase, {
    username: normalizedUsername,
    displayName,
    status: "available",
  });
  console.log("[performUsernameLogin] Player created:", player.id);
  
  const presence = await createPresenceRecord(supabase, player.id);
  console.log("[performUsernameLogin] Presence created:", presence);
  
  rememberPresence(player);
  console.log("[performUsernameLogin] Added to cache");
  
  return { player, sessionToken: crypto.randomUUID() };
}
```

### Step 2: Add Logging to Presence Channel
```typescript
// lib/realtime/presenceChannel.ts
channel.subscribe((status) => {
  console.log("[Realtime] Channel status:", status);
  if (status === "SUBSCRIBED") {
    console.log("[Realtime] Successfully subscribed!");
    isSubscribed = true;
    // ... rest of code
  } else if (status === "CHANNEL_ERROR") {
    console.error("[Realtime] CHANNEL_ERROR - presence feature not working");
    callbacks.onError?.(new Error("Realtime channel error (lobby-presence)"));
  } else if (status === "TIMED_OUT") {
    console.error("[Realtime] TIMED_OUT - connection never established");
  } else if (status === "CLOSED") {
    console.log("[Realtime] CLOSED - channel was closed");
  } else {
    console.log("[Realtime] Unknown status:", status);
  }
});
```

### Step 3: Verify Database Transaction Isolation
```typescript
// lib/matchmaking/profile.ts - add explicit commit
export async function performUsernameLogin(usernameInput: string): Promise<LoginResult> {
  const supabase = getServiceRoleClient();
  
  // ... existing code ...
  
  await createPresenceRecord(supabase, player.id);
  
  // Verify record was created
  const { data: verification, error: verifyError } = await supabase
    .from("lobby_presence")
    .select("*")
    .eq("player_id", player.id)
    .single();
  
  if (verifyError || !verification) {
    throw new Error(`Failed to verify presence record: ${verifyError?.message}`);
  }
  
  console.log("[performUsernameLogin] Presence verified:", verification);
  
  // ... rest of code ...
}
```

### Step 4: Check Realtime Service Logs During Test
```bash
# Terminal 1: Watch realtime logs
docker logs -f supabase_realtime_wottle-local 2>&1 | grep -E "(lobby-presence|subscribe|error|channel)"

# Terminal 2: Run test
pnpm playwright test tests/integration/ui/lobby-presence.spec.ts
```

### Step 5: Test Direct Channel Connection
Create a minimal test to isolate the Realtime issue:

```typescript
// tests/debug/realtime-test.ts
import { test, expect } from "@playwright/test";

test("debug realtime connection", async ({ page }) => {
  await page.goto("/");
  
  const result = await page.evaluate(async () => {
    // @ts-ignore
    const { createClient } = window.SupabaseClient;
    
    const client = createClient(
      "http://127.0.0.1:54321",
      "eyJhbGc..."  // anon key
    );
    
    return new Promise((resolve) => {
      const logs: string[] = [];
      const channel = client.channel("test-debug");
      
      channel.subscribe((status) => {
        logs.push(`Status: ${status}`);
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") {
          resolve({ status, logs });
        }
      });
      
      setTimeout(() => resolve({ status: "TIMEOUT", logs }), 10000);
    });
  });
  
  console.log("Realtime test result:", result);
  expect(result.status).toBe("SUBSCRIBED");
});
```

## Alternative Approach: Disable Realtime, Use Polling Only

If Realtime continues to fail, we could simplify by using only polling:

```typescript
// lib/realtime/presenceChannel.ts
export function subscribeToLobbyPresence(/*...*/) {
  // Skip creating realtime channel entirely
  // Just use polling
  
  const pollInterval = options.pollIntervalMs ?? 500;
  let pollHandle: NodeJS.Timeout | null = null;
  
  if (options.poller) {
    const poller = async () => {
      try {
        const result = await options.poller!();
        callbacks.onSync?.(result, "poller");
      } catch (error) {
        callbacks.onError?.(error);
      }
    };
    poller(); // Start immediately
    pollHandle = setInterval(poller, pollInterval);
  }
  
  return {
    channel: null as any, // Mock
    stopPolling() {
      if (pollHandle) clearInterval(pollHandle);
    },
    updatePresence() {
      // No-op for polling-only mode
    },
  };
}
```

This would make tests pass but lose real-time updates. Not ideal for production but acceptable for MVP.

## Summary

**Fixed**:
1. ✅ Database realtime configuration
2. ✅ Environment variable naming
3. ✅ Cache cleanup on disconnect

**Still Broken**:
1. ❌ Realtime Presence channels failing with `CHANNEL_ERROR`
2. ❌ `lobby_presence` table empty (records not persisting)
3. ❌ Players cannot see each other in lobby

**Root Cause**: Unknown - needs more investigation with logging

**Workaround**: Could use polling-only mode to unblock tests

**Recommendation**: Add comprehensive logging to all presence-related code paths and run tests with detailed monitoring to understand why:
- Presence records aren't persisting in database
- Realtime channels are failing to connect

---

**Last Updated**: 2025-11-19 11:30 AM  
**Status**: Partial progress, investigation ongoing

