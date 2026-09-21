# Contract: settlement

`lib/match/matchSettlement.ts` — `settleMatchIfDue(matchId): Promise<"completed" | "not_due" | "already">`

1. `resolvePendingMoves(matchId)` first: every move received at or before the deadline is drained (FR-009; `receive_move` refuses anything later).
2. Due when both counts equal `move_limit`, or `deadline_at < clock_timestamp()` (compared in SQL, never with a lambda's clock).
3. `completeMatchInternal(matchId, "natural")` → `determineMatchWinner`:

```ts
determineMatchWinner({ scores, moves: { playerA, playerB }, moveLimit, frozenCounts }, playerAId, playerBId)
  → { winnerId, loserId, isDraw, reason }
// both < limit          → draw,            reason "both_incomplete"
// one  < limit          → the other wins,  reason "incomplete"
// both = limit          → score → exclusive frozen tiles → draw,  reason "moves_complete"
```

4. `completeMatchInternal` flips `state` with `where id = ? and state = 'in_progress' returning id`; zero rows → return the existing result and do nothing else (ratings once, FR-011). Scores and counts are read from `matches`.

## Triggers

- The resolver, after a finish that brings both counts to the limit.
- `loadMatchState` when `deadline_at` has passed (deduplicated per process).
- The cron sweep (`/api/cron/sweep-stale-matches`, every 30s): `find_due_matches()` beside the orphan sweep.
- The client's `settleMatch` action at 0:00 (renamed from `triggerTimeoutCheck`).

## Forced ends (unchanged shape)

- Resign → `forfeit`, forced winner.
- End early (narrowed claim, FR-012): caller has `move_limit` resolved moves and the opponent has been unreachable ≥ 90s → `completeMatchInternal(matchId, "natural")` (the opponent is incomplete, so the caller wins with reason `incomplete`; no forced winner).
- Abandoned → no winner, no rating.

## Verdict copy

| reason | detail line |
| --- | --- |
| `moves_complete` | `by 46 points · 10 words to 8 · territory 27–21` (draw: `draw 88–88`) |
| `incomplete` | `Kári played 8 of 10` |
| `both_incomplete` | `neither finished` |
| `forfeit` / `disconnect` | `Kári resigned` / `Kári left` |

The slip label counts the match: `match over · 4:52`.
