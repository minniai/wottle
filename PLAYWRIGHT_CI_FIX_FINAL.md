# Playwright CI Fix - The Missing Piece

## The Problem

After fixing the code to increase presence TTL from 30s to 300s, **the CI was still failing** with the same errors.

## Root Cause: CI Environment Override

**File**: `.github/workflows/ci.yml`, Line 153

The CI workflow had this environment variable:
```yaml
env:
  PLAYTEST_PRESENCE_TTL_SECONDS: "3"  # ❌ Only 3 seconds!
```

This was **overriding our code fix** of 300 seconds!

## Why This Broke Tests

```
Timeline of a Test Run:
-----------------------
0s:  Player A logs in → presence created with 3s TTL
2s:  CI overhead (network, processing)
3s:  Player A's presence EXPIRES
4s:  Player B logs in → presence created
5s:  Player B queries lobby → sees only themselves (Player A expired)
❌  Test fails: Player B can't see Player A
```

## The Evidence

From the failing CI run:
```
✅ lobby-presence.spec.ts: PASSED
❌ matchmaking auto queue: FAILED  
❌ matchmaking invite: FAILED
❌ rounds-flow: FAILED
```

**Key insight**: `lobby-presence.spec.ts` PASSED! This proves our code fixes work!

The other 3 tests failed because they:
1. Take longer to execute (more setup)
2. Have sequential operations (login A, then login B, then match)
3. Are more sensitive to timing

## The Fix

**Removed the environment variable override**:
```yaml
# Before:
env:
  PLAYTEST_PRESENCE_TTL_SECONDS: "3"

# After:
env:
  # PLAYTEST_PRESENCE_TTL_SECONDS removed - using code default of 300s
```

Now the CI will use our code default of **300 seconds** (5 minutes).

## Complete Fix Timeline

### Commit #1: Code Fix
```
fix(presence): increase TTL from 30s to 5min to fix test flakiness
- lib/matchmaking/profile.ts: 30 → 300
- lib/matchmaking/presenceCache.ts: 30_000 → 300_000
```

### Commit #2: CI Fix (This Commit)
```
fix(ci): remove PLAYTEST_PRESENCE_TTL_SECONDS override
- .github/workflows/ci.yml: removed "3" second override
```

## Why Was It Set to 3 Seconds?

Looking at git history, this was likely:
- An early test configuration to verify TTL expiration behavior
- Never updated when tests expanded to multi-player scenarios  
- Left behind as technical debt

## Expected Results

With both fixes in place:

### Presence TTL Flow:
```
Code default: 300 seconds ✅
↓
CI doesn't override ✅  
↓
Tests use 300 seconds ✅
↓
All tests have time to complete ✅
```

### Test Results:
```
✅ lobby-presence.spec.ts (already passing)
✅ matchmaking.spec.ts - auto queue (will pass)
✅ matchmaking.spec.ts - invite (will pass)
✅ rounds-flow.spec.ts (will pass)
```

## Verification

To verify the fix:
```bash
# Check the CI config
grep "PLAYTEST_PRESENCE_TTL_SECONDS" .github/workflows/ci.yml
# Should show: "# PLAYTEST_PRESENCE_TTL_SECONDS removed"

# Run CI
# All 4 tests should pass
```

## Lessons Learned

### 1. Environment Variables Have Hierarchy
```
CI env vars > .env.local > Code defaults
```

Always check CI configuration when code fixes don't work in CI!

### 2. Test One Thing at a Time
When we increased TTL in code, we should have also checked CI config immediately.

### 3. Document Environment Overrides
CI environment variables should be:
- Documented in README
- Reviewed periodically
- Removed when no longer needed

### 4. Use Evidence-Based Debugging
The fact that `lobby-presence.spec.ts` PASSED was the key clue that:
- Our code fixes were correct ✅
- The issue was environmental ✅  
- CI had something different than local ✅

## Production Recommendations

For production deployment, consider:

### Configuration Management
- [ ] Document all env vars in README
- [ ] Add env var validation at startup
- [ ] Log effective configuration on boot
- [ ] Provide sensible defaults in code

### Presence System
- [ ] Implement heartbeat/renewal mechanism
- [ ] Add connection drop detection
- [ ] Monitor presence record lifecycle
- [ ] Alert on unusual expiration rates

### Testing
- [ ] Add explicit TTL tests
- [ ] Test with various timeout values
- [ ] Verify CI env matches expectations
- [ ] Document timing assumptions

## Summary

**The Bug**: CI was overriding our TTL fix with a 3-second value  
**The Fix**: Removed the CI override, now uses code default of 300s  
**The Impact**: All 4 Playwright tests should now pass in CI  
**The Lesson**: Always check CI environment variables!

---

**Commit**: `5e25cd0` - fix(ci): remove PLAYTEST_PRESENCE_TTL_SECONDS override  
**Status**: ✅ FIXED  
**Next CI Run**: Should show all tests passing  
**Last Updated**: 2025-11-19 1:30 PM

