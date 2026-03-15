# 014 — Resign and Lobby Polish

## Context

After completing 013 (scoring overhaul), the core game loop is fully functional but lacks two key features for real playtesting: players can't resign mid-match, and the lobby doesn't show who's available vs. in-game. Additionally, 4 specs have 1-2 lingering tasks that should be closed out. This spec bundles these small, high-impact items to make Wottle feel like a complete playable game.

---

## Scope

### A. Resign Functionality

1. **Server Action** — Create `app/actions/match/resignMatch.ts`
   - Validate caller is a participant in the match
   - Validate match is in-progress (not already completed)
   - Set `matches.ended_reason` to `"forfeit"`, declare opponent as winner
   - Broadcast resignation event via Realtime match channel
   - Rate-limit scoped to `match:resign`

2. **UI — Resign Button** — Add to `components/match/GameChrome.tsx`
   - Small "Resign" button in player bar (only visible to active player)
   - Confirmation dialog: "Are you sure you want to resign? Your opponent will win."
   - Calls `resignMatch()` on confirm
   - Disabled during round resolution / after match ends

3. **Opponent Notification** — On receiving resign broadcast
   - `MatchClient.tsx` handles resign event → transitions to game-over state
   - Show message: "[Player] resigned"
   - Navigate to FinalSummary

4. **FinalSummary Update** — `components/match/FinalSummary.tsx`
   - When `ended_reason === "forfeit"`, show "Player X resigned" instead of normal score comparison
   - Winner still shown, scores still displayed

5. **Tests**
   - Unit: `resignMatch` action (valid resign, already-ended match rejection, non-participant rejection)
   - E2E: Player resigns → opponent sees result → FinalSummary shows forfeit

---

### B. Lobby Player Status Display

6. **Status Derivation** — Derive player status from existing `lobby_presence` + `matches` data
   - `"Available"` — in lobby, not in active match
   - `"In Match"` — has an active (non-completed) match
   - Utility: `lib/matchmaking/derivePlayerStatus.ts`

7. **LobbyCard Update** — `components/lobby/LobbyCard.tsx`
   - Show status badge: green dot "Available", orange dot "In Match"
   - Gray out / disable challenge for players currently in-match
   - Real-time updates via existing presence channel

8. **Tests**
   - Unit: `derivePlayerStatus` logic
   - Visual: LobbyCard renders correct status badges

---

### C. Close Out Near-Complete Specs

9. Review and complete remaining tasks in:
   - Spec 003 (1 task remaining)
   - Spec 006 (1 task remaining)
   - Spec 012 (1 task remaining)
   - Spec 013 (2 tasks remaining)

---

## Key Files to Modify / Create

| File                                    | Change                                         |
| --------------------------------------- | ---------------------------------------------- |
| `app/actions/match/resignMatch.ts`      | New                                            |
| `lib/matchmaking/derivePlayerStatus.ts` | New                                            |
| `components/match/GameChrome.tsx`       | Add resign button                              |
| `components/match/MatchClient.tsx`      | Handle resign broadcast                        |
| `components/match/FinalSummary.tsx`     | Forfeit display                                |
| `components/lobby/LobbyCard.tsx`        | Status badges                                  |
| `lib/types/match.ts`                    | Ensure `MatchEndedReason` includes `"forfeit"` |

---

## Existing Code to Reuse

- `lib/realtime/matchChannel.ts` — broadcast resign event
- `lib/supabase/server.ts` — service role client for match updates
- `app/actions/match/` — follow existing Server Action patterns (Zod validation, rate limiting, session check)
- `components/match/FinalSummary.tsx` — already shows winner/scores, extend with forfeit case

---

## Verification

1. `pnpm test` — all existing + new unit tests pass
2. `pnpm test:integration` — resign integration test passes
3. `pnpm exec playwright test` — E2E resign flow works
4. `pnpm lint && pnpm typecheck` — zero warnings
5. Manual: Start match → resign → opponent sees result → FinalSummary shows forfeit
6. Manual: Lobby shows correct status for available vs. in-match players
