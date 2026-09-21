# Research: Ten moves each on one shared clock

## 1. Serialising resolution on serverless

**Decision**: SQL-side receipt under a row lock (`receive_move`), a CAS claim of the move at `resolved_seq + 1` (`claim_next_move`), a pure resolver in Node, and a CAS finish (`finish_move`) that advances `resolved_seq` by exactly one.

**Rationale**: resolution needs the word engine, which lives in Node with a ~3.7M-entry dictionary, so the whole resolution cannot run inside Postgres. A Node-held `pg_advisory_xact_lock` would need a raw connection from Vercel lambdas (new dependency, pooling risk). The CAS pattern is already this codebase's idiom (the round-state CAS, `roundEndWrite`, `update_frozen_tiles_if_unchanged`). With the claim keyed to `resolved_seq + 1`, only one move can be in resolution per match at a time, so receipt order equals resolution order regardless of how many lambdas race.

**Alternatives considered**: resolve inline in the POST (rejected: cold dictionary sits on the request; a player's RTT would depend on the opponent's pending move); sort by `received_at` at resolution time (rejected: `clock_timestamp()` is not monotone across a restart; the sequence is the authority and the timestamp is informational).

## 2. Receipt timestamp

**Decision**: `received_at default clock_timestamp()` assigned inside `receive_move` while the match row is locked.

**Rationale**: `now()` is the transaction start, not the statement time; two receipts in one long transaction would tie. `clock_timestamp()` under the lock is monotone within a session and the sequence carries the order anyway.

## 3. "Moved" detection

**Decision**: the client sends the two letters it saw; the resolver refuses on mismatch.

**Rationale**: simplest and self-explaining; identical-letter exchanges pass harmlessly. The alternative (`seenSeq` plus a per-cell touched-since check) needs a per-cell history.

## 4. Async resolution and the cold dictionary

**Decision**: `after(() => resolvePendingMoves(matchId))`; warm the dictionary in `after()` at match start; stale claims reclaimable after 10s.

**Rationale**: O-71 measured 1.3–4s for a cold load; that must not sit on a move request. The stale-claim window bounds the worst case at ~10s plus a poll.

## 5. Where the clock is drawn

**Decision**: ledger caption only; bars lose the numeral and the clock lane; the lane counts moves 0–10. <!-- retired-name -->

**Rationale**: the design system's second principle: a fact about the match lives in the ledger, a fact about a player in their bar. One clock drawn in two bars would be the same fact four times. The caption is inside the collapsed phone ledger, so the clock stays visible at 390px.

## 6. Duplicate words

**Decision**: withdrawn; a word scores every time it is formed at a new location. `is_duplicate` dropped.

**Rationale**: product decision 2026-09-21. The rule was never implemented (`is_duplicate: false` hard-coded in `publishRoundSummary.ts`), so nothing changes in play. The same word at the same location cannot re-score: its letters are frozen, and a move must pass through an unfrozen letter.

## 7. Hard cut vs. a mode column

**Decision**: one destructive migration; delete matches; reset ratings.

**Rationale**: no live users; a `matches.mode` column would double every reader for a mode nobody plays. Ratings under the old rules are not comparable.

## 8. Completion races

**Decision**: `completeMatchInternal` flips state with `where state = 'in_progress'` and returns early on zero rows.

**Rationale**: three triggers (resolver, state poll, cron sweep) will race to complete a match; today's read-then-write would apply Elo twice.
