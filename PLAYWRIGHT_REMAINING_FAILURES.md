# Playwright Remaining Test Failures - Analysis

## Summary

After implementing US3 and fixing TypeScript errors, we have 4 remaining test failures (down from 6):
- ❌ lobby-presence.spec.ts
- ❌ rounds-flow.spec.ts  
- ❌ matchmaking.spec.ts (2 tests)

## Tests Removed

### debug-realtime.spec.ts ❌ REMOVED
**Reason**: Cannot dynamically import npm modules in browser context  
**Error**: `Failed to fetch dynamically imported module: http://localhost:3000/node_modules/@supabase/supabase-js/dist/module/index.js`  
**Impact**: Lost diagnostic test, but we have comprehensive logging in place instead

The test tried to:
```typescript
const supabaseModule = await import("/node_modules/@supabase/supabase-js/dist/module/index.js");
```

This doesn't work because:
1. Browser can't import from `/node_modules/` directly
2. Next.js doesn't expose npm modules at that path
3. Would need to access app's existing Supabase client instead

**Alternative**: Use comprehensive logging we added to actual code:
- `lib/matchmaking/profile.ts` - Login flow
- `lib/realtime/presenceChannel.ts` - Channel lifecycle
- `lib/matchmaking/presenceStore.ts` - Store operations

## Remaining Failures - Root Cause

All 4 remaining failures stem from the **same underlying issue**: Players cannot see each other in the lobby.

### Issue Chain

```
1. Player logs in
   ↓
2. Presence record created (or not?)
   ↓  
3. Presence record not persisting in database
   ↓
4. Polling returns empty player list
   ↓
5. Realtime channel fails (CHANNEL_ERROR)
   ↓
6. Players can't see each other
   ↓
7. All tests depending on presence fail
```

### Test Failure Details

#### 1. lobby-presence.spec.ts
**Failure Point**: Line 31  
**Error**: `getByTestId('lobby-card').filter({ hasText: /tester-alpha/i })` not visible  
**Expected**: Player B should see Player A in lobby list  
**Actual**: Empty lobby list / "Waiting for testers to join the lobby…"

**Depends on**:
- ✅ Login working
- ❌ Presence records persisting
- ❌ Polling returning players
- ❌ OR Realtime working

#### 2. rounds-flow.spec.ts
**Failure Point**: Line 31 in `loginAndStartMatch()`  
**Error**: `getByTestId('match-shell')` not visible  
**Expected**: Match shell appears after queue pairing  
**Actual**: Never enters match because matchmaking doesn't start

**Depends on**:
- ✅ Login working  
- ❌ Presence working (players must see each other)
- ❌ Queue pairing (needs presence)
- ❌ Match creation

#### 3. matchmaking.spec.ts - auto queue
**Failure Point**: Line 23 in `waitForMatchShell()`  
**Error**: `getByTestId('match-shell')` not visible  
**Expected**: Queue pairs players and creates match  
**Actual**: Players never paired because presence broken

**Depends on**:
- ✅ Login working
- ❌ Presence working
- ❌ Queue logic
- ❌ Match creation

#### 4. matchmaking.spec.ts - direct invite
**Failure Point**: Line 13 in `loginAndAwaitMatchmaker()`  
**Error**: `getByTestId('matchmaker-controls')` not visible  
**Expected**: Matchmaker controls appear after login  
**Actual**: UI stuck waiting for presence to initialize

**Depends on**:
- ✅ Login working
- ❌ Presence system ready
- ❌ UI renders matchmaker controls

## Investigation Status

### ✅ Completed
1. Database Realtime configuration migration
2. Environment variable fixes
3. Server-side cache cleanup
4. Comprehensive logging added
5. Polling-only fallback implementation
6. TypeScript errors fixed

### ❌ Still Broken
1. Presence records not persisting in database
2. Realtime channel subscription failing
3. Polling endpoint returns empty list
4. Server-side cache empty

### 🔍 Needs Investigation

**Primary Question**: Why are presence records not persisting?

**Hypotheses**:
1. **Transaction Rollback** - Database writes not committing
2. **TTL Too Short** - Records expire immediately  
3. **Timing Issue** - Race condition between write and read
4. **RLS Policy** - Row Level Security blocking reads (unlikely with service role)

**Debug Steps**:
```bash
# 1. Watch database during test
watch -n 0.5 'docker exec supabase_db_wottle-local psql -U postgres -d postgres -c "SELECT player_id, expires_at > NOW() as active FROM lobby_presence;"'

# 2. Run test with server logs visible
pnpm dev | tee dev-server.log &
pnpm playwright test tests/integration/ui/lobby-presence.spec.ts --headed

# 3. Check logs for presence creation
grep "performUsernameLogin" dev-server.log
grep "Presence created" dev-server.log
grep "Presence verified" dev-server.log

# 4. Check polling logs
grep "presenceStore" dev-server.log
grep "Polling returned" dev-server.log
```

## Workarounds Available

### Polling-Only Mode
```bash
# In .env.local
NEXT_PUBLIC_DISABLE_REALTIME=true
```

**Status**: Implemented but tests still fail  
**Why**: Even polling mode needs database presence records

### Manual Database Seeding
```sql
-- Manually insert presence records for testing
INSERT INTO lobby_presence (player_id, connection_id, mode, expires_at, updated_at)
VALUES 
  ('<player-a-uuid>', gen_random_uuid(), 'auto', NOW() + INTERVAL '30 seconds', NOW()),
  ('<player-b-uuid>', gen_random_uuid(), 'auto', NOW() + INTERVAL '30 seconds', NOW());
```

**Status**: Not attempted  
**Risk**: Doesn't solve root cause

## Impact Assessment

### Blocked User Stories
- **US1**: Lobby Presence ❌ (core failure)
- **US2**: Matchmaking ❌ (depends on US1)
- **US3**: Rounds Engine ⚠️ (implemented but can't test end-to-end)
- **US4**: Round Scoring ⏸️ (not yet implemented, would be blocked)
- **US5**: Final Summary ⏸️ (not yet implemented, would be blocked)

### Test Coverage
- **Unit Tests**: ✅ Passing (isolated logic)
- **Contract Tests**: ✅ Passing (API schemas)
- **Integration Tests**: ❌ Failing (presence dependency)
- **E2E Tests**: ❌ Failing (presence dependency)

### CI/CD Status
- **TypeCheck**: ✅ Passing
- **Linter**: ✅ Passing  
- **Unit Tests**: ✅ Passing
- **Playwright (baseline)**: ❌ Failing (6 tests)
- **Playwright (playtest)**: ❌ Failing (port conflict, didn't run)

## Recommended Actions

### Immediate (Unblock Development)
1. ✅ Remove broken debug-realtime tests
2. ⬜ Capture full server logs during test run
3. ⬜ Watch database state during test execution
4. ⬜ Add database trigger logging for presence inserts
5. ⬜ Verify presence record TTL calculation

### Short Term (Fix Root Cause)
1. ⬜ Identify why presence records don't persist
2. ⬜ Fix the persistence issue
3. ⬜ Verify Realtime channel can connect
4. ⬜ Re-run all tests

### Medium Term (Improve Robustness)
1. ⬜ Add health check endpoint for presence system
2. ⬜ Add integration tests for presence CRUD operations
3. ⬜ Improve error messages throughout presence flow
4. ⬜ Document presence system architecture

### Long Term (Production Readiness)
1. ⬜ Add monitoring for presence system
2. ⬜ Add alerts for presence failures
3. ⬜ Load test presence under concurrent users
4. ⬜ Add automatic recovery mechanisms

## Notes

### Playtest Matrix Port Conflict
**Error**: `EADDRINUSE: address already in use 0.0.0.0:3000`  
**Cause**: Baseline tests left server running  
**Fix**: Ensure proper cleanup between test matrix runs  
**Impact**: Playtest matrix didn't run, only baseline ran

### Logging Infrastructure
All logging is now in place to diagnose the issue:
- Server-side: Visible in `pnpm dev` output
- Client-side: Browser DevTools console
- Database: Can add trigger logging

### Next Debug Session
When returning to this issue:
1. Start with fresh database: `supabase db reset`
2. Run single test with logs: `pnpm dev &` then test
3. Watch database in real-time during test
4. Review all logged output for presence creation
5. Check if records exist before first poll

---

**Last Updated**: 2025-11-19 12:00 PM  
**Status**: Debug test removed, core issue remains  
**Blockers**: Presence record persistence mystery

