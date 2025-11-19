# Playwright Test Failures - Final Status Report

## Summary

After extensive investigation and implementing multiple fixes, the Playwright tests are still failing, but we've made significant progress in understanding and addressing the issues.

## ✅ Completed Fixes

### 1. Database Realtime Configuration
**Status**: ✅ FIXED  
**File**: `supabase/migrations/20251119001_enable_realtime.sql`  
**Verification**: All tables properly configured with full replica identity and added to `supabase_realtime` publication

### 2. Environment Variable Configuration  
**Status**: ✅ FIXED  
**Issue**: `.env.local` had `SUPABASE_ANON_KEY` instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
**Fix**: Renamed to proper Next.js public variable name  
**Result**: "Presence unavailable" error disappeared from UI

### 3. Server-Side Cache Cleanup
**Status**: ✅ FIXED  
**File**: `app/api/lobby/presence/route.ts`  
**Fix**: Added `forgetPresence(session.player.id)` to DELETE endpoint  
**Purpose**: Ensures disconnected players are removed from cache immediately

### 4. Comprehensive Logging
**Status**: ✅ IMPLEMENTED  
**Files Modified**:
- `lib/matchmaking/profile.ts` - Login flow logging
- `lib/realtime/presenceChannel.ts` - Channel subscription logging  
- `lib/matchmaking/presenceStore.ts` - Store operation logging

**Logging Added**:
- Player identity creation
- Presence record creation and verification
- Realtime channel status changes
- Polling snapshot fetching
- Store state transitions

### 5. Debug Test Suite
**Status**: ✅ CREATED  
**File**: `tests/integration/ui/debug-realtime.spec.ts`  
**Purpose**: Isolate Realtime connection issues from application logic  
**Tests**:
- Direct Realtime service connection test
- Realtime Presence feature test

### 6. Polling-Only Workaround
**Status**: ✅ IMPLEMENTED  
**Files Created**:
- `lib/realtime/presenceChannel.polling.ts` - Polling-only implementation  
**Files Modified**:
- `lib/matchmaking/presenceStore.ts` - Feature flag support  
- `.env.local` - Added `NEXT_PUBLIC_DISABLE_REALTIME=true`

**How It Works**:
- Set `NEXT_PUBLIC_DISABLE_REALTIME=true` to bypass Realtime entirely
- Uses only polling at 500ms intervals
- Simplified codebase for debugging

## ❌ Remaining Issues

### Primary Issue: Players Not Visible to Each Other

**Test Failing**: Line 31 of `lobby-presence.spec.ts`  
**Error**: Player B cannot see Player A after both login  
**Expected**: Both players should appear in each other's lobby lists  
**Actual**: Empty lobby / "Waiting for testers to join the lobby…"

### Observable Symptoms

1. **Login succeeds** - Both players created in `players` table
2. **Presence records missing** - `lobby_presence` table empty after login
3. **Polling returns empty** - `/api/lobby/players` returns no players
4. **Cache also empty** - Server-side cache has no players

### Investigation Results

From the comprehensive logging (not yet captured because tests need to be run with visible console):

**Expected Log Flow**:
```
[performUsernameLogin] Starting login for: tester-alpha
[performUsernameLogin] Creating player identity...
[performUsernameLogin] Player created: <uuid>
[performUsernameLogin] Creating presence record...
[performUsernameLogin] Presence created: { playerId, expiresAt, mode }
[performUsernameLogin] Presence verified in database: { ... }
[performUsernameLogin] Player added to server cache
[presenceStore] connect() called
[presenceStore] Using polling-only mode
[PresenceChannel] Using POLLING-ONLY mode (Realtime disabled)
[presenceStore] Polling /api/lobby/players...
[presenceStore] Polling returned 1 players: ["tester-alpha"]
```

**Actual** (suspected): Presence records not being created or expiring immediately

## 🔍 Root Cause Hypotheses

### Hypothesis 1: Database Transaction Rollback
**Theory**: Presence records are created but transaction rolls back  
**Evidence Needed**: Check server logs for transaction errors  
**Test**: Add explicit transaction verification

### Hypothesis 2: TTL Configuration Issue
**Theory**: Presence records expire instantly (TTL = 0 or negative)  
**Status**: `PLAYTEST_PRESENCE_TTL_SECONDS` not set, should default to 30s  
**Evidence Needed**: Check actual `expires_at` values in database

### Hypothesis 3: Connection Pool/Timing Issue
**Theory**: Race condition where reads happen before writes commit  
**Evidence Needed**: Add delays, check connection pool settings

### Hypothesis 4: RLS Policy Blocking
**Theory**: Row Level Security preventing reads  
**Status**: Unlikely - we're using service role key  
**Test**: Verify with direct database queries

## 📊 Test Status

| Test File | Status | Primary Issue |
|-----------|--------|---------------|
| `lobby-presence.spec.ts` | ❌ FAIL | Players not visible to each other |
| `matchmaking.spec.ts` (auto queue) | ❌ FAIL | Depends on presence |
| `matchmaking.spec.ts` (invite) | ❌ FAIL | Depends on presence |
| `rounds-flow.spec.ts` | ❌ FAIL | Depends on matchmaking |
| `debug-realtime.spec.ts` | ❓ NOT RUN | Created but not yet tested |

## 🛠️ Implementation Details

### Polling-Only Mode

**Activation**:
```bash
# In .env.local
NEXT_PUBLIC_DISABLE_REALTIME=true
```

**Code Path**:
```typescript
// lib/matchmaking/presenceStore.ts
const USE_POLLING_ONLY = process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true";
const subscribeFunction = USE_POLLING_ONLY 
  ? subscribeToLobbyPresencePollingOnly 
  : subscribeToLobbyPresence;
```

**Benefits**:
- Eliminates Realtime as a variable
- Simpler debugging
- Works even when Realtime service has issues

**Limitations**:
- 500ms latency vs real-time updates
- Higher server load (constant polling)
- Still requires database presence records to work

### Logging Output Locations

**Server-side** (Next.js dev server):
- Visible in terminal where `pnpm dev` is running
- Or in Playwright's `[WebServer]` output

**Client-side** (Browser):
- Visible in browser DevTools console
- Or in Playwright's test output with `--headed` flag

**To Capture Logs**:
```bash
# Run test with console output
PWDEBUG=console pnpm playwright test tests/integration/ui/lobby-presence.spec.ts

# Or run with headed browser to see console
pnpm playwright test tests/integration/ui/lobby-presence.spec.ts --headed
```

## 🎯 Recommended Next Steps

### Immediate Actions

1. **Capture Full Logs**
   ```bash
   # Terminal 1: Start dev server and watch logs
   pnpm dev | tee dev-server.log
   
   # Terminal 2: Run test
   pnpm playwright test tests/integration/ui/lobby-presence.spec.ts --headed
   
   # Review dev-server.log for presence creation logs
   ```

2. **Run Debug Test**
   ```bash
   pnpm playwright test tests/integration/ui/debug-realtime.spec.ts
   ```
   This will tell us if Realtime service itself works

3. **Check Database Directly During Test**
   ```bash
   # Terminal 1: Watch database
   watch -n 0.5 'docker exec supabase_db_wottle-local psql -U postgres -d postgres -c "SELECT player_id, expires_at, expires_at > NOW() as active FROM lobby_presence;"'
   
   # Terminal 2: Run test
   pnpm playwright test tests/integration/ui/lobby-presence.spec.ts
   ```

4. **Add Database Trigger Logging**
   ```sql
   -- Log all inserts to lobby_presence
   CREATE OR REPLACE FUNCTION log_presence_insert()
   RETURNS TRIGGER AS $$
   BEGIN
     RAISE NOTICE 'lobby_presence INSERT: player_id=%, expires_at=%', 
       NEW.player_id, NEW.expires_at;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   
   CREATE TRIGGER presence_insert_log
   AFTER INSERT ON lobby_presence
   FOR EACH ROW EXECUTE FUNCTION log_presence_insert();
   ```

### Investigation Checklist

- [ ] Capture server logs showing presence creation
- [ ] Verify presence records appear in database during test
- [ ] Check `expires_at` timestamps are in the future
- [ ] Run debug-realtime test to isolate Realtime issues
- [ ] Test with longer polling intervals to rule out timing issues
- [ ] Check for any error responses from `/api/lobby/players`
- [ ] Verify server-side cache contents during test

### Alternative Approaches

1. **Simplify Presence System**
   - Remove server-side cache entirely
   - Use only database + polling
   - Increase poll interval to 1000ms to reduce load

2. **Add Health Check Endpoint**
   ```typescript
   // app/api/health/presence/route.ts
   export async function GET() {
     const players = await fetchLobbySnapshot();
     const cacheSize = listCachedPresence().length;
     
     return Response.json({
       dbPlayers: players.length,
       cachePlayers: cacheSize,
       players: players.map(p => ({ id: p.id, username: p.username })),
     });
   }
   ```

3. **Fallback to In-Memory Only**
   - Remove database persistence entirely for MVP
   - Use only server-side cache + Realtime Presence
   - Simpler but loses persistence across restarts

## 📁 Files Created/Modified

### New Files
- ✅ `supabase/migrations/20251119001_enable_realtime.sql`
- ✅ `scripts/supabase/verify-realtime.sh`
- ✅ `lib/realtime/presenceChannel.polling.ts`
- ✅ `tests/integration/ui/debug-realtime.spec.ts`
- ✅ `PLAYWRIGHT_INVESTIGATION_SUMMARY.md`
- ✅ `PLAYWRIGHT_FIX_APPLIED.md`
- ✅ `PLAYWRIGHT_FINAL_STATUS.md` (this file)

### Modified Files
- ✅ `.env.local` - Fixed env var name, added polling-only flag
- ✅ `app/api/lobby/presence/route.ts` - Added cache cleanup
- ✅ `lib/matchmaking/profile.ts` - Added logging + verification
- ✅ `lib/realtime/presenceChannel.ts` - Added comprehensive logging
- ✅ `lib/matchmaking/presenceStore.ts` - Added logging + polling-only support

## 💡 Key Insights

1. **Realtime vs Database Presence**: The app uses TWO separate presence systems that must stay in sync
2. **Cache Cleanup Critical**: Server-side cache must be cleared on disconnect or stale data persists
3. **Verification Needed**: Database writes must be verified, not just assumed to work
4. **Logging is Essential**: Without comprehensive logging, debugging distributed systems is impossible
5. **Feature Flags Help**: Polling-only mode simplifies debugging by removing variables

## 🎓 Lessons Learned

1. Always verify database writes actually persisted
2. Use feature flags to isolate complex features during debugging
3. Comprehensive logging is not optional for distributed systems
4. Test infrastructure (Realtime) separately from application logic
5. Cache invalidation is indeed one of the two hard problems in computer science

## ⏭️ Path Forward

**Short Term** (Unblock Tests):
1. Capture full logs to understand what's happening
2. Run debug test to verify Realtime service
3. Check database during test execution

**Medium Term** (Fix Properly):
1. Identify why presence records aren't persisting
2. Fix the root cause
3. Remove polling-only workaround
4. Re-enable Realtime for production use

**Long Term** (Prevent Recurrence):
1. Add integration tests for presence system itself
2. Add health check endpoints
3. Improve error messages
4. Document presence system architecture

---

**Last Updated**: 2025-11-19 11:40 AM  
**Status**: Investigation ongoing, comprehensive debugging tools in place  
**Next Action**: Capture logs and run debug test to identify root cause

