# Playwright Tests Still Failing - Next Debugging Steps

## Current Status

After fixing:
1. ✅ Environment variable naming (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
2. ✅ Presence TTL in code (30s → 300s)  
3. ✅ CI environment override (removed `PLAYTEST_PRESENCE_TTL_SECONDS: "3"`)

**Tests are STILL failing** with the same symptoms:
- Player B cannot see Player A in lobby
- Matchmaking cannot proceed (depends on presence)
- Rounds cannot start (depends on matchmaking)

## The Mystery

We've fixed all the configuration issues, but the core problem persists:
**Presence records are not being visible across users.**

## Possible Root Causes

### 1. Database Isolation Between Browser Contexts

**Hypothesis**: Each Playwright browser context might be getting a separate database connection or session that's not seeing other sessions' data.

**Evidence Needed**:
- Are presence records actually in the database?
- Do both users write their records successfully?
- Can they query each other's records via raw SQL?

### 2. Cookie/Session Isolation

**Hypothesis**: Server-side session cookies might not be carrying forward properly, causing auth/permission issues.

**Evidence Needed**:
- Are cookies being set correctly after login?
- Do API calls include proper session cookies?
- Does the server recognize both users as authenticated?

### 3. Server-Side Cache Not Shared

**Hypothesis**: The server-side presence cache (`presenceCache.ts`) might not be shared between requests or is being cleared.

**Evidence Needed**:
- Is `rememberPresence()` being called?
- Is the global cache persisting between requests?
- Are cache entries expiring too quickly?

### 4. Realtime vs Polling Timing

**Hypothesis**: The transition from Realtime to polling might be dropping presence data.

**Evidence Needed**:
- What does the console log show for Realtime connection status?
- Is polling actually working?
- Are there timing issues between subscribe and first poll?

### 5. Race Condition in Test

**Hypothesis**: Test might be checking before data is actually propagated.

**Evidence Needed**:
- What happens if we add a longer wait?
- Do manual refreshes show the data?
- Is the polling interval (500ms) too slow?

## Debug Strategy

### Step 1: Add Comprehensive Logging (DONE)

Added to `tests/integration/ui/lobby-presence.spec.ts`:
- Console log capture from both browser contexts
- Direct API endpoint calls to bypass client state
- Presence store state inspection

### Step 2: Run Test and Analyze Logs

```bash
cd /Users/ari/git/wottle
pnpm playwright test tests/integration/ui/lobby-presence.spec.ts --reporter=line
```

Look for in the output:
- `[DEBUG] Player A sees via API:` - What does the API return for Player A?
- `[DEBUG] Player B sees via API:` - What does the API return for Player B?
- `[DEBUG] Player B store state:` - What's in the client-side store?
- Console logs with `[performUsernameLogin]` - Are presence records being created?
- Console logs with `[presenceStore]` - Is the client connecting?

### Step 3: Database Inspection During Test

Add a test step to query the database directly:

```typescript
// In test, after both logins
const dbCheck = await pageA.evaluate(async () => {
  const res = await fetch('/api/debug/presence-records');
  return await res.json();
});
console.log('[DEBUG] Database presence records:', dbCheck);
```

We'd need to create `/api/debug/presence-records` endpoint temporarily.

### Step 4: Check Server Logs

The server-side logs should show:
- `[performUsernameLogin] Starting login for: tester-alpha`
- `[performUsernameLogin] Presence created: {playerId: ..., expiresAt: ...}`
- `[performUsernameLogin] Presence verified in database: ...`
- `[performUsernameLogin] Player added to server cache`

If these aren't showing up, the problem is on the server side.

### Step 5: Simplify the Test

Create a minimal reproduction:

```typescript
test("minimal presence test", async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  
  await loginAs(pageA, "test-user-1");
  
  // Wait 5 seconds
  await pageA.waitForTimeout(5000);
  
  // Check via API
  const players = await pageA.evaluate(async () => {
    const res = await fetch('/api/lobby/players');
    return await res.json();
  });
  
  console.log('Players in lobby:', players);
  expect(players.players).toHaveLength(1);
  expect(players.players[0].username).toBe('test-user-1');
});
```

If this fails, the problem is with single-user presence, not multi-user.

## Immediate Action Items

1. **Push the debug commit** and run CI to get logs
2. **Analyze the debug output** to see what API returns
3. **Check if server logs appear** in CI output
4. **Create temporary debug endpoint** if needed
5. **Consider if production build** (Next.js `pnpm build`) behaves differently than dev mode

## Potential Quick Fixes to Try

### A. Increase Polling Frequency

In `lib/matchmaking/presenceStore.ts`:
```typescript
pollIntervalMs: 500,  // Try 100ms or 200ms
```

### B. Force Polling Mode

In `lib/matchmaking/presenceStore.ts`:
```typescript
const USE_POLLING_ONLY = true;  // Force polling, bypass Realtime
```

### C. Add Explicit Wait After Login

In test:
```typescript
await loginAs(pageA, "tester-alpha");
await pageA.waitForTimeout(2000);  // Give time for presence to propagate
await loginAs(pageB, "tester-beta");
```

### D. Check if Server-Side Rendering Issue

The lobby page uses Server Components. Maybe the `initialPlayers` is empty and client-side never updates?

In `app/(lobby)/page.tsx`, add logging:
```typescript
const [initialPlayers, boardResult] = await Promise.all([
  session ? fetchLobbySnapshot() : Promise.resolve<PlayerIdentity[]>([]),
  loadBoard(),
]);
console.log('[LobbyPage SSR] Initial players:', initialPlayers.length);
```

## What We Know

✅ **Working**:
- Environment variables are correct
- TTL is set to 300 seconds
- No CI override
- Database schema is correct
- Realtime is configured

❌ **Not Working**:
- Player B cannot see Player A
- Presence data is not visible across browser contexts
- This happens consistently in CI

## Next Decision Point

After reviewing the debug logs from the next CI run, we'll know:

1. **If API returns empty**: Problem is server-side (DB or cache)
2. **If API returns data but UI doesn't show**: Problem is client-side (React rendering or state)
3. **If console logs are missing**: Problem is in login flow itself
4. **If timing varies**: Problem is race condition

---

**Created**: 2025-11-19 2:00 PM  
**Status**: Awaiting debug output from CI  
**Next**: Run CI with debug logging, analyze output

