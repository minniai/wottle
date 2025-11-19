# Playwright Tests - Current Status

## Test Results (Latest CI Run)

```
✅ 1 passed
❌ 3 failed
⏭️  8 skipped
```

### Failing Tests
1. `lobby-presence.spec.ts` - Player B cannot see Player A
2. `matchmaking.spec.ts` (auto queue) - Cannot create match (needs presence)
3. `rounds-flow.spec.ts` - Cannot start rounds (needs matchmaking)

### Passing Tests
- All board grid tests ✅
- All swap tests ✅  
- All accessibility tests ✅

## Fixes Applied So Far

### ✅ Fix #1: Environment Variable Naming (Commit 5e25cd0)
**Problem**: `SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
**Result**: Login now works, UI renders

### ✅ Fix #2: Presence TTL Increased (Commit c178601)
**Problem**: 30-second TTL too short  
**Result**: Code default now 300 seconds

### ✅ Fix #3: Removed CI Override (Commit 5e25cd0)
**Problem**: CI was setting `PLAYTEST_PRESENCE_TTL_SECONDS: "3"`  
**Result**: CI now uses code default

### 🔍 Fix #4: Debug Logging Added (Commit d32fde5)
**Purpose**: Diagnose why presence still not working  
**What it does**: Captures console logs, API responses, store state

## The Remaining Problem

**Symptom**: Player B cannot see Player A in the lobby

**What We Know**:
- ✅ Environment variables are correct
- ✅ TTL is 300 seconds
- ✅ No CI override
- ✅ Login works
- ✅ UI renders
- ❌ Presence data doesn't propagate between users

**What We Don't Know**:
- Are presence records actually in the database?
- Does the API return the records?
- Is it a client-side rendering issue?
- Is it a timing/race condition?

## Investigation Strategy

### Phase 1: Gather Data (Current)

Run CI with debug logging to see:
```
[DEBUG] Player A sees via API: {...}
[DEBUG] Player B sees via API: {...}
[DEBUG] Player B store state: {...}
```

This will tell us if the problem is:
- **Server-side**: API returns empty → DB or cache issue
- **Client-side**: API returns data but UI doesn't show → React/state issue
- **Timing**: Data appears after delay → race condition

### Phase 2: Hypotheses to Test

**H1: Server-Side Cache Not Shared**
```typescript
// The global cache might not persist between requests
// or might be getting cleared
```
**Test**: Add logging to `presenceCache.ts` operations

**H2: Database Transaction Isolation**
```typescript
// Each browser context might have isolated DB sessions
```
**Test**: Query DB directly during test

**H3: Production Build Behavior**
```typescript
// Next.js production builds behave differently
// SSR might be caching empty state
```
**Test**: Compare `pnpm dev` vs `pnpm build && pnpm start`

**H4: Polling Frequency Too Slow**
```typescript
// 500ms polling might miss quick sequences
```
**Test**: Reduce to 100ms or 200ms

**H5: initialPlayers Not Propagating**
```typescript
// Server renders with initialPlayers but client doesn't use them
```
**Test**: Log initialPlayers from both SSR and client

### Phase 3: Targeted Fixes

Based on Phase 1 data, apply one of:

**If API returns empty**:
- Check database queries
- Check server-side cache
- Verify presence TTL calculation

**If API returns data**:
- Check client state management
- Check React rendering
- Check if store is updating

**If timing issue**:
- Increase wait times
- Reduce polling interval
- Add explicit sync points

## What to Do Next

### Option A: Push and Wait for CI Logs
```bash
git push origin 002-two-player-playtest
# CI will run with debug logging
# Analyze the output
```

### Option B: Test Locally
```bash
# Terminal 1: Start production server
pnpm build
pnpm start

# Terminal 2: Run test
pnpm playwright test tests/integration/ui/lobby-presence.spec.ts --headed

# Watch console output for debug logs
```

### Option C: Add More Debug Tools

Create a debug endpoint:
```typescript
// app/api/debug/presence/route.ts
export async function GET() {
  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from('lobby_presence')
    .select('*');
  return NextResponse.json({ presence: data });
}
```

## Timeline

- **Started**: 2025-11-19 10:00 AM
- **First fix applied**: 11:00 AM (env vars)
- **Second fix applied**: 12:00 PM (TTL)
- **Third fix applied**: 1:30 PM (CI override)
- **Debug logging added**: 2:00 PM
- **Current time**: 2:15 PM
- **Status**: Awaiting debug output

## Confidence Levels

- ✅ **90% confident**: Our configuration fixes are correct
- ❓ **50% confident**: The issue is server-side (DB/cache)
- ❓ **30% confident**: The issue is client-side (React/state)
- ❓ **20% confident**: The issue is timing/race condition

After seeing debug logs, confidence will shift dramatically.

## Success Criteria

Test passes when:
1. Player A logs in
2. Player A's presence record is created
3. Player B logs in
4. Player B's presence record is created
5. **Player B can see Player A in their lobby list** ← This is failing
6. **Player A can see Player B in their lobby list** ← This works

## Key Files

- `tests/integration/ui/lobby-presence.spec.ts` - The failing test (with debug)
- `lib/matchmaking/profile.ts` - Server-side presence creation (with logs)
- `lib/matchmaking/presenceStore.ts` - Client-side presence management (with logs)
- `lib/matchmaking/presenceCache.ts` - Server-side cache
- `app/api/lobby/players/route.ts` - API that returns player list

## Next Update

After CI runs with debug logging, we'll update this document with:
- Actual debug output
- Root cause identification
- Specific fix to apply

---

**Status**: 🔍 DEBUGGING IN PROGRESS  
**Last Updated**: 2025-11-19 2:15 PM  
**Awaiting**: CI debug output

