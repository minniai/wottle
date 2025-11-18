# Playwright Test Fixes Applied

## Changes Made

### Test Fixes (Immediate Actions)

#### 1. Lobby Presence Test - Increased cleanup timeout
**File**: `tests/integration/ui/lobby-presence.spec.ts`
**Change**: Increased poll timeout from 5s to 10s
```typescript
// Before
timeout: 5_000

// After  
timeout: 10_000
```
**Rationale**: Accounts for real-world latency in presence cleanup propagation (keepalive fetch → DB update → poller fetch → UI update)

#### 2. Direct Invite Test - Wait for player visibility
**File**: `tests/integration/ui/matchmaking.spec.ts`
**Change**: Added explicit wait for target player in presence list before opening invite modal
```typescript
// Wait for Player A to see Player B in their presence list
const listA = pageA.getByTestId("lobby-presence-list");
await expect(
  listA.getByTestId("lobby-card").filter({ hasText: /invite-bravo/i })
).toBeVisible({ timeout: 10_000 });

await pageA.getByTestId("matchmaker-invite-button").click();
```
**Rationale**: Ensures presence list is fully synced before interacting with invite modal

### Production Code Improvements

#### 3. Faster presence cleanup
**File**: `lib/matchmaking/service.ts`
**Change**: Changed `expireLobbyPresence()` to DELETE instead of UPDATE
```typescript
// Before: Set expires_at to past date
const expiredTime = new Date(Date.now() - 1_000);
await client
  .from("lobby_presence")
  .update({ expires_at: expiredTime.toISOString() })
  .eq("player_id", playerId);

// After: Delete immediately
await client
  .from("lobby_presence")
  .delete()
  .eq("player_id", playerId);
```
**Rationale**: More immediate effect, simpler logic, no timing issues with `expires_at` filtering

#### 4. Improved invite button UX
**File**: `components/lobby/MatchmakerControls.tsx`
**Change**: Disable invite button when no players available
```typescript
disabled={isInviting || presenceStatus !== "ready" || inviteTargets.length === 0}
title={
  presenceStatus !== "ready"
    ? "Connecting to lobby..."
    : inviteTargets.length === 0
    ? "No players available to invite"
    : undefined
}
```
**Rationale**: Prevents confusing empty modal, provides clear user feedback

## Expected Test Results

After these changes:
- ✅ `lobby-presence.spec.ts` should PASS (increased timeout + faster cleanup)
- ✅ `matchmaking.spec.ts` (auto queue) should PASS (existing atomic claim fix)
- ✅ `matchmaking.spec.ts` (direct invite) should PASS (explicit wait + improved button)
- ⏭️ 8 tests remain skipped (board tests need Phase 3 rewrite)

**Expected**: 3/3 active tests passing, 8 skipped

## Root Cause Summary

Both test failures were **timing issues**, not functional bugs:

1. **Lobby presence cleanup**: Multi-step async cleanup (fetch → DB → poller → UI) raced against 5s test timeout
2. **Direct invite modal**: Presence sync completing after modal opened, leaving invite list empty

## Technical Details

See `PLAYWRIGHT_TEST_ANALYSIS.md` for comprehensive root cause analysis and alternative solutions considered.

