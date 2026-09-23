# TODOS

## Match room

### Send each player's last resolved move in the match state

**What:** `loadMatchState` sends each player's latest *resolved* move, not their latest finished one.

**Why:** Spec 068's last-move tick (two cells in the mover's seat colour) is rebuilt from `lastResolution` after a reload. When a player's latest move was refused, or has fallen out of the six most recent moves, their tick is missing until they move again.

**Context:**
- Decision 1A of the spec 068 engineering review (`specs/068-match-scoreboard/eng-review.md`) keeps that stage client-only, so the tick is simply not drawn in those cases.
- The fix belongs in `lib/match/stateLoader.ts` `loadMoveFacts`. Today it reads the six most recent `resolved | rejected` rows and keeps the first one per player. It should read the latest `resolved` row per player instead (for example, one query per player, `limit 1`).
- `lastResolution` also feeds `deriveMoveState` (the scored delta), so check that callers still handle a refused move.

**Effort:** S
**Priority:** P3
**Depends on:** Spec 068 shipped.
