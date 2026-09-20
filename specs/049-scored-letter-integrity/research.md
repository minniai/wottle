# Phase 0 research — Scored-letter integrity and ownership

## 1. The diagnosis (FR-007) — the hypothesis was wrong

Read-only queries against the production project (`vcjmanighljftajzizat`, via `supabase db query --linked`, 2026-09-20) over the three Dari · Kari matches of that evening. The screenshot is match `ed22c625` (21:08 UTC; round-10 scoreboard 106–177, Kari's clock spent by rounds 6–10 timeouts).

### 1.1 The records are clean

For every `word_score_entries` row in all three matches, the letters at its `tiles` on its own round's `board_snapshot_after` **and** on the final round's `board_snapshot_after` spell its word, letter for letter. 55 records, zero disagreements. No frozen letter moved. The instant-scoring race named in the spec's Background is **not implicated**; the combined pass, the freeze map and the records agree throughout.

### 1.2 The board the client showed is the match's starting board

Comparing the screenshot's ten rows against every round's `board_snapshot_before` and `_after` for `ed22c625`: round 1 `before` matches **10/10**; round 1 `after` 8/10; round 4 `after` and later 0/10. Regenerating from the row's `board_seed` with `generateBoard` reproduces the screenshot's first rows exactly (`ÞKHLXAGALG / KTÆÍSIÓÚTÁ / DISBTLNRXA`).

So the client drew ten rounds of correct bands and correct freezes over the **initial** board. `ÞKHL` is `þaks` (round 9) at `(0,0)…(3,0)` on the starting letters; `GÁAAT` is `gátan` (round 10); `DUT` is `hul`; `ÝGRR` is `ýgra`.

### 1.3 Why the loader serves the starting board

`loadMatchState` (`lib/match/stateLoader.ts`) fetches the round at `matches.current_round` and hands it to `ensureBoardSnapshot`, which prefers that round's snapshot and, if there is no round row or the snapshot fails to parse, **silently regenerates the board from the seed**. When a match completes, `advanceRound` step 14 sets `current_round = 11`; there is no round 11; the loader regenerates. Every completed match therefore serves its starting board with its final scores and its full freeze map. The two other matches of the evening (`current_round = 11`) are in the same state today. The bands drew "correctly" over it because `bandCells` checks only that a band's cells are frozen, never that they spell the word.

Before spec 048 this was rarely seen: the final field sat under a small ledger verdict. Spec 048's match-over slip invites the player to `review the field ▸`, which is exactly what surfaced it.

### 1.4 A second defect: a thawed `after()` hook wrote the match row backwards

`ed22c625`'s row reads `current_round = 6`, `player_a_timer_ms = 71427`, `player_b_timer_ms = 149872`, `winner_id = null`, `ended_reason = null`, `state = completed`, `completed_at = 21:17:15`, `updated_at = 21:19:28` — while rounds 1–10 exist and completed, and round 6 alone was `resolving` for 59 s (21:15:12 → 21:16:11) with round 7 created at 21:15:28 by stuck-round recovery. Two minutes after the match completed, something wrote round-5-era values over the row. `advanceRound` step 14 updates `matches` with `.eq("id", matchId)` and no guard on the round it read; it runs in `submitMove`'s `after()` hook, which Vercel can freeze after the response and thaw much later. A thawed round-5 hook explains every stale value. The client kept the starting board rather than round 6's because the safety poll refuses a snapshot whose round goes backwards.

### 1.5 The shared-letter finding

`sharedCells` marks a cell ink only when bands of **both** seats cover it; tints stack, hence the darker cells. The dark G at `(9,0)` is `gáta` (Kari, round 5) under `gátan` (Dari, round 10): a legal extension of a frozen run, scored as one longer word. Working as designed; the design is what changes.

## 2. Decisions

### R1 — Serve the last played round's board; never regenerate a board a match already has

**Decision**: For a match in `completed` or `abandoned`, `loadMatchState` uses the highest round that has a `board_snapshot_after` for the board, the scores snapshot and the last summary. For an in-progress match whose `current_round` has no row, it serves the highest existing round's board and triggers recovery (the O-79 shape). `ensureBoardSnapshot` regenerates from the seed **only** when the match has no round at all (the bootstrap path, which upserts round 1 in the same breath); otherwise a missing or unparseable snapshot is an error, logged and routed to recovery, never papered over.

**Rationale**: The seed regeneration was written for first load. Reusing it for "round row missing" turned a data fault into a plausible-looking board.

**Alternatives**: clamping `current_round` at write time (step 14 leaving it at 10 for a completed match) — rejected as the primary fix: every reader that computes "previous round" from `current_round` assumes 11, and a clamp would not protect an in-progress match with a missing row. Recovery already relies on `current_round = 11` for terminal rounds.

### R2 — Guard the match-row write against a stale writer

**Decision**: `advanceRound` step 14 updates `matches` with `.eq("current_round", currentRound)` (the value it read at step 1) `.neq("state", "completed")`, and treats zero rows as "another writer got here first" — logged at warn, not an error. Recovery's equivalent write gets the same guard. `completeMatchInternal` remains the only writer of `winner_id` / `ended_reason`.

**Rationale**: The DB is the single source of truth and a thawed hook is a legitimate caller; the guard makes the write idempotent instead of trying to stop the thaw.

**Alternatives**: moving `advanceRound` out of `after()` — out of scope and would lengthen the move response.

### R3 — The integrity invariant stays, as a detector

**Decision**: Keep FR-001/FR-002. After each resolution the server checks that every record spells on the persisted board and that no frozen letter changed; a failure logs at error level with the record and routes to recovery. It is cheap (one board, ≤ 40 records) and it is what would have caught 1.4 the day it happened.

### R4 — The client never draws a lie

**Decision**: `bandCells` additionally requires the letters under a settled band's cells to spell the word (the `assertWordsSpellBoard` check already exists, dev-only); otherwise no band, one warn per record in every environment.

### R5 — One owner, one colour

**Decision**: A scored letter's colour comes from `frozenTiles[cell].owner` (first-owner-wins, already the engine's rule) via `getSeatColors`; the `shared` state, `sharedCells` and the ink-700 rule go. A band covers only the cells its word froze first (`bandCells` filters cells whose frozen owner's seat differs from the band's seat); the chevron stays at the whole word's reading start. Hover lights the whole word from the record's coordinates, not from the band's cells.

**Alternatives**: keeping both bands over the crossing cell (stacked tint) — rejected; the user asked for the earlier colour to stay, and one cell in two tints is neither.

### R6 — No data repair

The loader fix (R1) makes the three affected matches render correctly without touching their rows; `ed22c625`'s stale `current_round` is harmless once the loader stops trusting it for a completed match. The stale timers are cosmetic on a completed match (the bars show rating lines). Recorded, not repaired.

## 3. Out of scope, recorded

- The instant-scoring race window (second swap validated against a freeze map the fast path has not yet written) is real in code but produced no bad data in three matches; it is filed as a follow-up, not fixed here.
- `match_logs` holds no rows for `ed22c625` after 21:13, so the thaw is inferred from `updated_at` and the values, not observed.

## 4. Diagnostic, for reuse

```sql
-- every scored word, spelled on its round's board and on the final board
with last as (select distinct on (match_id) match_id, board_snapshot_after as board
              from rounds where board_snapshot_after is not null order by match_id, round_number desc)
select r.round_number, e.word,
  (select string_agg(r.board_snapshot_after -> (t->>'y')::int ->> (t->>'x')::int, '' order by ord)
     from jsonb_array_elements(e.tiles) with ordinality t(t, ord)) as at_round,
  (select string_agg(l.board -> (t->>'y')::int ->> (t->>'x')::int, '' order by ord)
     from jsonb_array_elements(e.tiles) with ordinality t(t, ord)) as at_end
from word_score_entries e join rounds r on r.id = e.round_id join last l on l.match_id = e.match_id
where e.match_id = :match order by r.round_number;
```
