# Phase 0 research — Field & Ledger as rendered

## 1. S5 root-cause model

The seen match (Bari · Lari, 2026-09-16, round 4) is not in the local database, so the root cause was established from source. Three independent defects each produce "round-1 bands on wrong letters, tiles unfrozen, later rounds fine".

1. **Blind freeze writes.** `persistFrozenTilesAtomically` (`app/actions/match/publishRoundSummary.ts`) calls rpc `update_frozen_tiles_if_unchanged`, which no migration defines. The "function missing" fallback writes `matches.frozen_tiles = baseline ∪ this round` unconditionally, so a stale baseline erases earlier rounds' freezes. Unfrozen round-1 letters become swappable again (`submitMove` checks only `matches.frozen_tiles`); the letters move; `bandsFromWords` falls back to the full stored run when none of a word's coordinates is frozen, so the band paints over the new letters.
2. **Recovery baseline.** `lib/match/recoverStuckRound.ts` `createNextRound` seeds `rounds.frozen_tiles_before` from the `matches` row read before `finalizeResolvingRound` scored, and `scoringRan` counts one first-mover partial row as "scored", so a half-scored round completes without the combined pass and without `board_snapshot_after`.
3. **Client accumulation.** `useAccumulatedRounds` is append-only, sourced only from `lastSummary` / `partialSummary`, has no `matchId` reset (rematch is `router.replace` in the same segment, so the component instance survives), never hydrates completed rounds on reload, and keeps a partial's words after the server deleted them. `roomStore.mergeSnapshot` carries `lastSummary` across a `matchId` change and `applySummary` never checks `matchId`.

Ruled out: every read of `word_score_entries` is scoped by `match_id` and/or `round_id` (a UUID FK), so a cross-match leak from the database is not possible.

## 2. Diagnostic (read-only, once, prod ref `vcjmanighljftajzizat`)

```sql
with m as (
  select m.* from matches m
  join players a on a.id = m.player_a_id join players b on b.id = m.player_b_id
  where m.created_at::date = '2026-09-16'
    and least(a.username, b.username) = 'Bari' and greatest(a.username, b.username) = 'Lari'
  order by m.created_at desc limit 1)
select 'match' k, m.id::text, m.state, m.current_round::text, m.rematch_of::text, m.frozen_tiles::text from m
union all
select 'round', r.id::text, r.state, r.round_number::text, (r.board_snapshot_after is not null)::text, r.frozen_tiles_before::text
  from rounds r join m on r.match_id = m.id where r.round_number between 1 and 4
union all
select 'r1word', w.id::text, w.word, w.total_points::text, w.player_id::text, w.tiles::text
  from word_score_entries w join rounds r on r.id = w.round_id join m on r.match_id = m.id
  where r.round_number = 1;
```

Readings:

| Observation | Layer | Regression test |
| --- | --- | --- |
| R1 tiles missing from `matches.frozen_tiles` but present in round 2's `frozen_tiles_before` | blind write (defect 1) | `persistFrozenTiles.spec.ts` |
| R1 tiles missing from round 2's `frozen_tiles_before` too | recovery seeded pre-scoring (defect 2) | `recoverStuckRound.test.ts` |
| R1 has one player's rows and `board_snapshot_after` is null | partial-only round completed by recovery (defect 2) | `recoverStuckRound.test.ts` |
| Server data consistent, `rematch_of` set | client bleed (defect 3) | `useAccumulatedRounds.spec.tsx` |
| Everything consistent | client only (defect 3) | `useAccumulatedRounds.spec.tsx` |

Result: _pending (T016)_.

## 3. Handoff corrections

- S8 already done in spec 045; S9 is the seat header, ink by design.
- `/__room` → `/dev/room`; `__screenshots__/` → `room-fixtures.spec.ts-snapshots/`; `tests/unit/app/dev/` is new.
- `LiveState` needs `previewing` and `illegal`; `ESC_CANCELS` exists unused.
- `playwright.config.ts` has no `reducedMotion`; the `low-clock` reduced-motion shot uses a per-test context.
- A node carries one `data-testid`: the live row keeps `ledger-row-n`; `ledger-live-row` moves to the text wrapper.

## 4. History hydration: route, not state

`loadMatchState` runs on every broadcast (`statePublisher`), every 2s safety poll and every `submitMove`. Completed-round words change once per round, so they are served by `GET /api/match/[matchId]/words`, fetched on mount, on `matchId` change and when `currentRound` jumps by more than one. Two indexed queries; nothing on the move path.
