# Contract: the round-end write is conditional

Applies to `advanceRound` step 14 (`lib/match/roundEngine.ts`) and to recovery's advancing write (`lib/match/recoverStuckRound.ts`).

```sql
update matches
   set current_round = :next, player_a_timer_ms = :a, player_b_timer_ms = :b, updated_at = now()
       [, state = 'completed', completed_at = now()]
 where id = :match
   and current_round = :roundReadAtStart
   and state <> 'completed';
```

- Zero rows affected is not an error: log `match.write.stale` at warn with `{ matchId, expectedRound, carried: { next, a, b } }` and return `not_advancing`.
- `completeMatchInternal` stays the sole writer of `winner_id` and `ended_reason`, and is already idempotent on `winner_id`.
- The 20 September row (`current_round` 6 after completion, `updated_at` two minutes past `completed_at`) is the regression fixture: replaying a round-5 write against a completed match must change nothing.

## Tests

- `tests/unit/lib/match/roundEngine.staleWrite.spec.ts`: the update carries both conditions; a zero-row result logs and returns without throwing; a matching row advances.
- `tests/unit/lib/match/recoverStuckRound.test.ts` (extend): recovery's write carries the same conditions.
