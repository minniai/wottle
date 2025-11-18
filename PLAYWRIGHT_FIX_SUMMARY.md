# Playwright Test Fix Summary

## Root Cause

The Playwright tests were failing because **Supabase was not running** when the tests executed locally. The tests require a local Supabase instance to function.

## Solution

Before running Playwright tests, ensure Supabase is running:

```bash
# Start Supabase (one-time, keeps running)
export QUICKSTART_SKIP_TOKEN_CHECK=1
export QUICKSTART_DISABLE_STOP=1
pnpm quickstart

# Then run tests
pnpm exec playwright test
```

## Current Status

- **Before fix**: 0/11 tests passing (all failed due to missing Supabase)
- **After fix**: 8/11 tests passing ✅

## Remaining Failures

The following 3 tests still fail and appear to have actual application bugs:

### 1. `lobby-presence.spec.ts` - Player presence not cleaned up

**Error**: Expected 0 players after disconnect, but got 1

**Issue**: When a browser context closes, the player's presence remains in the lobby instead of being removed. The cleanup mechanism (`/api/lobby/presence` DELETE endpoint) either:

- Doesn't execute in time when the browser closes abruptly
- The server-side presence cache isn't being cleared
- The polling system isn't picking up the change fast enough

**Potential Fix**: Add explicit cleanup before closing context, or increase cache expiration checking

### 2. `matchmaking.spec.ts` - Auto queue

**Error**: `matchmaker-queue-status` element not found

**Issue**: The queue status element isn't appearing when players click "Start Queue". This could be a timing issue or a bug in the matchmaking UI state management.

**Potential Fix**: Investigate why the queue status doesn't show, possibly a race condition

### 3. `matchmaking.spec.ts` - Direct invite

**Error**: `invite-bravo` not visible in invite modal

**Issue**: When player A opens the invite modal, player B doesn't appear in the list of available players to invite. This suggests:

- Presence list isn't being populated correctly in the modal
- Race condition between login and presence synchronization
- Modal is opening before presence data is ready

**Potential Fix**: Ensure presence is synced before opening modal, or add retry logic

## Files Modified

- `tests/integration/ui/README.md` - Added documentation for running tests

## Recommendation

1. **Immediate**: Update CI/CD to ensure Supabase starts before tests (appears to work in CI based on original error logs)
2. **Short-term**: Fix the 3 remaining test failures (appear to be real bugs)
3. **Long-term**: Consider adding a test setup script that automatically starts Supabase if not running

## Running Tests Locally

See `tests/integration/ui/README.md` for detailed instructions.
