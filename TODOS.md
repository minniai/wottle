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

### Show the loss stake in the resign slip

**What:** The resign slip's body reads `Kári wins · your rating moves as a loss · −9`, with the number coming from the match's rating stakes.

**Why:** Game flow spec C6 draws the number. Spec 068 left it out because the room has each player's rating but not their K-factor (games played), so the exact stake can't be computed on the client.

**Context:** The table stage (C1, server work S3) shows `win +7 · draw −1 · loss −9` and has to put those stakes into the match state. Once they are there, `resignConsequence` in `lib/i18n/copy/{en,is}.ts` takes the loss stake, drawn in ink (a rating loss is never `--err`). See spec 068 clarification Q3.

**Effort:** S
**Priority:** P2
**Depends on:** The table stage (stakes in the match state).
