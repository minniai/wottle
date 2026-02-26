# Next Feature After 005-Board-UI-Animations

**Purpose:** Recommend the next spec to implement after 005-board-ui-animations so the game delivers high value on the path to MVP without being too large in scope.

**References:** PRD (`docs/wottle_prd.md`), project analysis (`docs/project-analysis-2026-02-14.md`), proposal 006 (`docs/proposals/006-match-completion.md`), current codebase (roundEngine, submitMove, completeMatch, FinalSummary).

---

## 1. What’s Already Done (Post–005)

From the codebase and PRD:

| PRD requirement | Status |
|-----------------|--------|
| **10-round limit** | Done. `roundEngine` sets `isGameOver = nextRound > 10`, updates match to `state: "completed"`, calls `completeMatchInternal(matchId, "round_limit")`. |
| **Post-game screen** | Done. `/match/[matchId]/summary`, `FinalSummary` (winner, scoreboard, word history, rematch, return to lobby). `MatchClient` navigates on match complete. |
| **Winner calculation** | Done for score. Tiebreaker “most frozen tiles” (PRD §1.6) not implemented — `determineMatchWinner` uses only scores. |
| **Timer columns** | Done. `matches.player_a_timer_ms` / `player_b_timer_ms` exist (default 300_000). Loaded and displayed in UI. |
| **Time expiration flow** | Not done. Server never updates timer values; no move rejection when time ≤ 0; no match end on timeout. |

So **006-match-completion** is partly done: round limit and victory screen exist. The main missing piece for “match completion” is **server-authoritative time control** plus a small **frozen-tile tiebreaker**.

---

## 2. Recommended Next Spec: **006-Server-Authoritative-Timer** (and Tiebreaker)

Implement one focused spec that:

1. **Server-authoritative timer** (PRD §1.4, §10.4)  
   - **On round resolution:** Compute elapsed time per player (e.g. from round start to their `submitted_at`), subtract from that player’s `remainingMs`, persist `player_a_timer_ms` / `player_b_timer_ms` on `matches`.  
   - **On move submit:** Reject with a clear error if the submitting player’s `remainingMs ≤ 0`.  
   - **On time expiration:** If a player’s clock hits 0, they cannot submit further; opponent continues for remaining rounds; when the match ends (round limit or opponent time), complete with `ended_reason: "timeout"` and winner (score, then frozen tiles).  
   - **Round start time:** Use existing round timestamps (e.g. `rounds.completed_at` of previous round or a dedicated `rounds.started_at` if added) so elapsed time is deterministic and server-authoritative.

2. **Frozen-tile tiebreaker** (PRD §1.6)  
   - In `completeMatchInternal`, load `frozen_tiles` from the match row (or from last round state).  
   - Count tiles per player (tiles where `owner === "player_a"` or `"player_b"`; “both” can count for both or be ignored for tiebreaker — PRD says “most frozen tiles”).  
   - Extend `determineMatchWinner(scores, frozenCountA, frozenCountB, playerAId, playerBId)` (or equivalent) so that when scores are equal, winner is the player with more frozen tiles; if still tied, draw.

**Why this scope**

- **Bounded:** Mostly round resolution + submit validation + one small change in `resultCalculator`. No new pages; timer UI already exists.  
- **High value:** Delivers “chess-clock tension” and fair time limits (PRD core loop); tiebreaker makes draws and close games feel fair.  
- **MVP-ready:** After this, a full game is “playable to the end” with correct time and winner rules, which is the right point for playtesting and tuning.

**Out of scope for this spec (keep for later)**

- Periodic clock-sync broadcasts to correct client drift (PRD §10.4): can be a follow-up.  
- Board generation (seed words, anti-clustering).  
- Legacy endpoint cleanup, production config, mobile polish.

---

## 3. Alternative: Shorter First Step

If you want an even smaller step before the timer:

- **006-frozen-tiebreaker-only:** Implement only the frozen-tile tiebreaker in `completeMatch` / `determineMatchWinner`. Very small (on the order of a few tasks). Then do **007-server-authoritative-timer** as the next spec.

Either way, the **next big value** after 005 is **server-authoritative timer + time expiration**, with the tiebreaker as a small addition in the same or the immediately following spec.

---

## 4. Summary

| Recommendation | Scope | Value |
|----------------|--------|--------|
| **006-server-authoritative-timer** (+ frozen-tile tiebreaker) | Timer updates on round resolution; reject move when time ≤ 0; end match on timeout; tiebreaker in `determineMatchWinner`. | Completes PRD time control and match end; ready for MVP playtests. |

After 005-board-ui-animations, implementing **006-server-authoritative-timer** (with the frozen-tile tiebreaker) is the suggested next feature: not too big, high impact, and it closes the main remaining gap in match completion on the way to MVP.
