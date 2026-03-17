# 016-rematch-and-post-game-loop

## Context

With 15 specs delivering a fully functional gameplay loop — swap, score, freeze, reveal, sensory feedback — the match experience is polished from start to finish. But it ends abruptly. The `FinalSummary` component shows the winner, top words, and frozen tile counts, then offers nothing but a "Return to Lobby" link. The PRD (§3.4) explicitly requires: **"Offer rematch or return to lobby."**

This is the single highest-leverage gap for player retention. Every casual game study shows the same pattern: the moment between "game over" and "play again" is where you keep or lose players. A tight post-game loop turns a one-match session into a three-match session.

---

## 1. Rematch Request Flow

### 1.1 Initiation
After a match completes, both players see two primary actions on the `FinalSummary` screen:

- **"Rematch"** — sends a rematch request to the opponent.
- **"Return to Lobby"** — navigates back to the lobby (existing behavior).

When a player clicks "Rematch":
- Their button changes to "Waiting for opponent..." (disabled state).
- The opponent receives an inline rematch invitation on their `FinalSummary` screen — no lobby round-trip, no modal. A banner or card appears: **"[Opponent] wants a rematch!"** with Accept / Decline buttons.

### 1.2 Acceptance
When the opponent accepts:
- A new match is created server-side with a fresh board seed.
- Both players are redirected to `/match/[newMatchId]`.
- The new match starts immediately (same as current match bootstrap).

### 1.3 Decline / Timeout
- If the opponent clicks "Decline" or navigates away (return to lobby, close tab), the requesting player sees: **"Opponent declined."** and the Rematch button resets.
- Rematch requests expire after **30 seconds** of no response. The requesting player sees: **"No response — returning to lobby."** and is redirected.
- If both players click "Rematch" simultaneously, the match is created immediately (no invitation step needed).

### 1.4 Edge Cases
- **Disconnected opponent:** If the opponent disconnects before responding, treat as decline after the reconnection window (10s) expires.
- **Multiple rapid clicks:** Server deduplicates — only one active rematch request per completed match.
- **Resigned matches:** Rematch is still offered. The player who resigned may want to try again.

---

## 2. Series Awareness (Lightweight)

To build narrative across rematches, track a minimal "series" context:

### 2.1 Series Counter
- When a rematch creates a new match, link it to the previous match via a `rematch_of` column on the `matches` table.
- The `FinalSummary` and match header can display: **"Game 2"**, **"Game 3"**, etc.
- Series score shown as: **"You lead 2-1"** or **"Tied 1-1"**.

### 2.2 Scope Limit
- Series tracking is display-only — no effect on gameplay, scoring, or matchmaking.
- Series context is derived by walking the `rematch_of` chain. No separate `series` table.
- If either player declines a rematch and later re-invites from the lobby, it starts a new series (no chain link).

---

## 3. Server Actions & Persistence

### 3.1 New Server Actions
- **`requestRematch(matchId)`** — validates match is completed, caller is a participant, no active request exists. Inserts a `rematch_requests` row.
- **`respondToRematch(matchId, accept: boolean)`** — validates request exists, caller is the recipient. If accepted, creates new match and returns `newMatchId`. If declined, marks request as declined.

### 3.2 Database Changes
- **`rematch_requests` table:** `id`, `match_id`, `requester_id`, `responder_id`, `status` (pending/accepted/declined/expired), `created_at`, `responded_at`.
- **`matches.rematch_of`** column (nullable FK to `matches.id`): links rematches for series tracking.
- RLS: only match participants can create/respond to rematch requests for their match.

### 3.3 Real-Time Delivery
- Rematch requests are broadcast on the existing match Realtime channel (which both players are still subscribed to on the `FinalSummary` screen).
- Event type: `rematch_request` and `rematch_response` payloads on the match channel.
- No new Realtime channels needed.

---

## 4. UI Components

### 4.1 FinalSummary Changes
- Add "Rematch" button alongside existing "Return to Lobby" link.
- Rematch button states: `idle` → `pending` (waiting) → `accepted` (redirecting) / `declined` (reset).
- Incoming rematch banner: appears at top of `FinalSummary` with Accept/Decline.

### 4.2 Series Display
- Small badge on `FinalSummary`: "Game 2 — You lead 1-0".
- Optional: same badge in the match header (`GameChrome`) during rematches.

### 4.3 Animations
- Rematch button: pulse animation while in `pending` state (reuse existing CSS patterns).
- Incoming banner: slide-down entry (200ms), consistent with `RoundSummaryPanel` style.
- Transition to new match: brief "Starting new game..." interstitial (500ms) before redirect.

---

## 5. Why This is the Next Step

1. **Highest retention leverage:** The post-game moment is where players decide to stay or leave. A frictionless rematch eliminates the lobby round-trip and keeps momentum.
2. **Small surface area:** Two Server Actions, one new table, one new column, UI changes confined to `FinalSummary`. No changes to the game engine, scoring, or round resolution.
3. **Uses existing infrastructure:** Match creation logic already exists. Realtime channel is already open. The only new persistence is a lightweight request table.
4. **PRD compliance:** Directly fulfills §3.4 ("Offer rematch or return to lobby") — one of the few remaining unimplemented PRD requirements.
5. **Series context is free:** Walking the `rematch_of` chain is a simple recursive query with no new infrastructure, but it adds narrative and competitive tension.

---

## 6. Estimated Scope

| Area | Tasks (est.) |
|------|-------------|
| Database migration (`rematch_requests`, `matches.rematch_of`) | 2-3 |
| Server Actions (`requestRematch`, `respondToRematch`) + validation | 3-4 |
| Realtime event handling (broadcast + subscribe) | 2-3 |
| FinalSummary UI (rematch button, incoming banner, states) | 3-4 |
| Series derivation + display | 2-3 |
| Edge cases (timeout, disconnect, simultaneous) | 2-3 |
| Tests (unit + integration + E2E) | 4-5 |
| **Total** | **~18-25 tasks** |
