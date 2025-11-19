# Playwright Test Failures - Quick Fix Guide

## TL;DR - What's Wrong?

**All 4 Playwright tests are failing because Supabase Realtime is not configured for the `lobby_presence` table.**

The tests fail because:
1. The realtime channel for `lobby-presence` throws `CHANNEL_ERROR`
2. Players can't see each other in the lobby
3. Matchmaking can't pair players
4. The entire playtest flow is blocked

## Quick Fix (5 minutes)

### Step 1: Apply the Migration

```bash
# Reset the database to apply the new migration
supabase db reset

# Or if you prefer to only apply the new migration
supabase migration up
```

### Step 2: Verify the Fix

```bash
# Run the verification script
./scripts/supabase/verify-realtime.sh

# You should see all green checkmarks:
# ✅ lobby_presence - published
# ✅ lobby_presence - full (all columns)
```

### Step 3: Run the Tests

```bash
# Run the failing tests
pnpm playwright test tests/integration/ui/lobby-presence.spec.ts
pnpm playwright test tests/integration/ui/matchmaking.spec.ts
pnpm playwright test tests/integration/ui/rounds-flow.spec.ts

# All tests should now pass
```

## What Changed?

### New Migration File

**File**: `supabase/migrations/20251119001_enable_realtime.sql`

This migration enables Supabase Realtime for the following tables:
- `lobby_presence` - Player presence tracking
- `matches` - Match state updates
- `rounds` - Round progression
- `move_submissions` - Player moves
- `match_invitations` - Invite notifications

### How It Works

Before the fix:
```
Browser → Supabase Realtime Channel → ❌ CHANNEL_ERROR
                ↓
         Falls back to polling (500ms)
                ↓
         Race conditions → Test failures
```

After the fix:
```
Browser → Supabase Realtime Channel → ✅ SUBSCRIBED
                ↓
         Real-time presence events (instant)
                ↓
         Tests pass reliably
```

## Technical Details

### What the Migration Does

```sql
-- 1. Enable replica identity (tells Postgres to track all column changes)
alter table public.lobby_presence replica identity full;

-- 2. Add table to realtime publication (makes it available to clients)
alter publication supabase_realtime add table public.lobby_presence;
```

Without these:
- The Realtime channel subscription fails with `CHANNEL_ERROR`
- The presence system falls back to 500ms polling
- Tests timeout waiting for real-time updates

### Why Tests Were Failing

#### Test 1: lobby-presence.spec.ts
```typescript
// Expected: Players see each other within 5 seconds
await expect(
  listA.getByTestId("lobby-card").filter({ hasText: /tester-beta/i })
).toBeVisible({ timeout: 5_000 });
```

**Failed because**: Polling every 500ms couldn't reliably update within 5 seconds due to race conditions.

#### Test 2: rounds-flow.spec.ts
```typescript
// Expected: Match shell appears within 15 seconds
await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 15000 });
```

**Failed because**: Players couldn't see each other in lobby, so matchmaking never started.

#### Test 3 & 4: matchmaking.spec.ts
```typescript
// Expected: Queue pairs players and match starts
await Promise.all([
  waitForMatchShell(pageA),
  waitForMatchShell(pageB),
]);
```

**Failed because**: Presence system was broken, matchmaking logic couldn't discover players.

## Browser Console Errors (Before Fix)

You'll see these errors in the browser console when realtime is not configured:

```
Lobby presence channel error Error: Realtime channel error (lobby-presence)
Lobby presence channel error Error: Snapshot request failed with status 500
```

After the fix, these errors should disappear.

## Verification Checklist

- [ ] Migration applied (`supabase db reset` or `supabase migration up`)
- [ ] Verification script passes (`./scripts/supabase/verify-realtime.sh`)
- [ ] No "Realtime channel error" in browser console
- [ ] Lobby presence test passes
- [ ] Matchmaking tests pass
- [ ] Rounds flow test passes

## Troubleshooting

### Issue: "Migration already applied"

```bash
# Reset the database completely
supabase db reset
```

### Issue: "Verification script fails"

```bash
# Check if Supabase is running
supabase status

# If not running:
supabase start
```

### Issue: "Tests still failing"

1. Check browser console for errors
2. Verify realtime configuration:
   ```bash
   ./scripts/supabase/verify-realtime.sh
   ```
3. Check Supabase Studio → Database → Replication
4. Restart Next.js dev server

### Issue: "Connection refused"

Make sure Supabase is running:
```bash
supabase start
```

## Related Files

- **Analysis**: `PLAYWRIGHT_TEST_FAILURE_ANALYSIS.md` - Deep dive into root cause
- **Migration**: `supabase/migrations/20251119001_enable_realtime.sql` - The fix
- **Verification**: `scripts/supabase/verify-realtime.sh` - Automated verification
- **Tests**: `tests/integration/ui/*.spec.ts` - The failing tests

## Next Steps

1. Apply the migration
2. Run the verification script
3. Run the tests
4. Commit the changes

All tests should pass once realtime is configured correctly. If you still see failures, refer to the detailed analysis in `PLAYWRIGHT_TEST_FAILURE_ANALYSIS.md`.

## Questions?

- **Why full replica identity?** - We need to track changes to non-primary-key columns (like `status`, `expires_at`)
- **Why not just use polling?** - Tests expect sub-second updates, polling introduces latency and race conditions
- **Is this safe for production?** - Yes, this is standard Supabase configuration for realtime features
- **Do I need RLS policies?** - Not for the MVP, but recommended for production

## Success Criteria

✅ All 4 Playwright tests pass
✅ No realtime errors in browser console
✅ Players see each other in lobby within 1 second
✅ Matchmaking pairs players successfully
✅ Round flow works end-to-end

---

**Last Updated**: 2025-11-19
**Status**: Ready to apply
**Impact**: Unblocks all playtest functionality

