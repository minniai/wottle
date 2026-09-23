# Research: The table

Findings from the current code (2026-09-23, `main` at `3a9b7914`) and the decisions they lead to.

## R1. Where a match starts today

**Found:**
- `start_match_if_ready` (`supabase/migrations/20260921001_async_moves.sql:143-204`) is the one start path. The loader calls it on every load of a `pending` match that has a caller (`lib/match/stateLoader.ts:316-318`; the callers are the match page and the `/state` route).
  - It writes `board` the first time anyone loads, even while pending.
  - It starts the match when both players have heartbeats **or** 10s after creation (`START_GRACE_MS`), so one present player starts it alone.
- The loader also returns `board ?? boardFor(match)` for a pending match (`stateLoader.ts:335`), so the letters leak before the start.

**Decision:** Retire `start_match_if_ready` and replace it with the table functions (R3):
- the loader stops calling a start function and stops returning a board while pending;
- the function is dropped in the migration, and `START_GRACE_MS` and `START_COUNTDOWN_MS` are removed from the loader.

**Rationale:** FR-003 and FR-013. A start that does not need both seats is the defect.

**Alternatives considered:**
- Keeping `start_match_if_ready` with a seats condition added. Rejected: it also writes the board on first load and upserts heartbeats, which are two jobs the table must not do.

## R2. How a void is stored

**Found:**
- An abandoned match is stored as `state='completed', ended_reason='abandoned'`; the `abandoned` state value is never written (`app/actions/match/completeMatch.ts:110-160`).
- Readers of finished matches filter `state='completed'` (`getRecentGames.ts:42-61`, which today *includes* abandoned games).
- Ratings are read from `match_ratings`, so an unrated match is excluded from ratings and profile stats automatically.

**Decision:** A void is `state='completed'`, `ended_reason='void'`, `void_reason in ('not_seated','left')`, `voided_by uuid null`, and `completed_at` set, with no winner and no `match_ratings` row. Every reader of finished matches that is not already rating-based adds `ended_reason <> 'void'`:
- `getRecentGames`
- `getBestWords`
- `requestRematch` / `rematchRepository`
- the lobby statistics

**Rationale:** It matches the source's data line (C3 "Data") and the existing abandoned pattern. The busy rule (`pending`/`in_progress`) then frees both players without a change.

**Alternatives considered:**
- A new `state='void'`. Rejected: it widens `MatchPhase` and every exhaustive switch on it (roomStore, slip, page redirects) for no gain.

## R3. Seating, the start and the void as database functions

**Decision:** One migration, `supabase/migrations/20260924001_the_table.sql`:
- **`create_match_between`** gains the table. It sets `table_deadline_at = now() + 20s` and seats:
  - the pressing player (a new parameter, `p_pressed_by uuid[]`: empty for the queue, the accepter for a challenge or rematch, both for crossed ones);
  - any player whose last attention report (R5) is fresh (reported within 10s, visible, input within 30s).
- **`seat_player(p_match, p_player, p_board, p_lead_ms, p_clock_ms)`** takes the match row lock, then checks: pending, not void, the player is a participant, and `now() < table_deadline_at`.
  - It sets the player's `seated_at` if it is null.
  - If both are now seated, it writes `board`, sets `state='in_progress'`, `started_at = now() + lead`, and `deadline_at = started_at + clock`.
  - It returns `{status: seated|started|void|late|not_found, startedAt, deadlineAt, serverNow}`.
- **`start_table_if_seated(p_match, p_board, p_lead_ms, p_clock_ms)`** is the same completion step on its own, for a table that was full at creation. `createMatch.ts` calls it right after `created` when both seats are set, and the loader calls it lazily.
- **`void_table(p_match, p_reason, p_by)`** is a compare-and-set on `pending`. In one transaction it:
  - writes the void;
  - sets the absent player(s) `available`, clears their `queued_at` and sets `table_missed_at`;
  - requeues each seated player of a **queue** table (`status='matchmaking'`, `queue_language = match.language`, `queued_at` kept, `search_paused=false`);
  - sets everyone else `available`.
- **`find_due_tables()`** returns pending matches past `table_deadline_at`, for the sweep.
- **`table_leave_cooldown_until(p_player)`** returns the time the cooldown ends, or null: the second of two `left` voids by that player within 10 minutes, plus 5 minutes, when that is still in the future.

**Rationale:**
- The seat and the start must be one compare-and-set under the match row lock, so two simultaneous `ready ▸` presses start the match exactly once (edge case, SC-001).
- The board is computed in TypeScript (the language pack's weights), as today, and passed in.

**Alternatives considered:**
- Starting from TypeScript after two separate updates. Rejected: it races.

## R4. Who decides a void, and when

**Found:** The pg_cron job posts to `app/api/cron/sweep-stale-matches` every 30s (`20260424001_sweep_stale_matches.sql:47-75`). No sweep touches `pending` matches, so an unloaded pending match keeps both players busy forever.

**Decision:**
- **Lazy:** `loadMatchState` voids a pending match whose `table_deadline_at` has passed (reason `not_seated`, `voided_by` = the one unseated player, or null when neither sat).
- **Seat refusal:** a seat after the deadline returns `late`, and the client reloads to show the void.
- **Sweep:** the cron route adds `find_due_tables()` → `void_table`.
- **Release:** the migration sets `table_deadline_at = created_at + 20s` on every existing pending match. They are all past, so the first read or sweep voids them.

**Rationale:** SC-005: within 1s for a player who is looking (the 2s state poll plus the drain reaching 0 triggers a reload), and within 30s otherwise.

## R5. Visibility and recent input without stage 4's presence

**Found:** Nothing in the client reads `visibilityState` or tracks input (grep). The only exit signal is the match `pagehide` beacon.

**Decision:**
- A client hook, `useAttention()`, keeps `{ visible, lastInputAt }`:
  - `visibilitychange`;
  - `pointerdown` and `keydown`, passive and throttled to one update per second.
- The attention is sent on the polls that already run, or run from this stage:
  - the queue poll (`startQueueAction`);
  - the table check (R6);
  - the match room's 2s `/state` poll, so a player on the result screen (a rematch requester) is seated by attention too.
- The server writes it to `players.attention_visible`, `attention_input_at` and `attention_at` (the report time).
- `create_match_between` reads it: a player counts as "visible with input in the last 30s" only when `attention_at` is within 10s, `attention_visible`, and `attention_input_at` is within 30s.

**Rationale:**
- The owner's rule (§7.3) needs the server to know it at creation.
- Stage 4's per-tab presence (S5) will write the same three columns from its own heartbeat, so the rule does not change.

**Alternatives considered:**
- Trusting a client-claimed `seated: true`. Rejected: the server must decide the seat (constitution I).

## R6. Reaching the table from any page

**Found:**
- `useLobbyInvites` polls `/api/match/active` every 3s, but only in the lobby (`LobbyRoomController.tsx:162-171`).
- The queue learns of its match through `startAutoQueue`'s `matched`.
- The profile page does not poll.
- Challenges are accepted with `router.replace`.

**Decision:**
- Extract `useTableCheck({ onTable })`. It polls `GET /api/match/active` every 3s with the attention (R5) as query parameters, and is mounted by:
  - `LobbyRoomController` (replacing the lobby's own active poll);
  - `ProfilePage`.
- The queue page does not mount it: its own poll returns `matched`, and two checks could push the table twice.
- The route writes the attention, and for a `pending` or `in_progress` match returns `{ match }`. The hook navigates with `router.push(localePath('/match/:id'))`.
- The accept paths (challenge and rematch) also use `push`.
- The rules page does not mount it.

**Rationale:** Clarification Q3 and FR-025a. `push` makes Back from the table a leave (T28).

## R7. The queue

**Found:**
- `joinQueue` rewrites `last_seen_at` on every 3s poll, and `selectQueueOpponent` then sorts by the *oldest* `last_seen_at`. That picks the player who polled least recently, which is the most likely ghost. There is no freshness filter and no `queued_at`.
- Cancel does not clear `queue_language`.
- Unmounting the queue does not cancel it.

**Decision:**
- `players.queued_at timestamptz`. It is set when a search starts from `available`, and never rewritten by a poll. It is cleared by cancel and by the stop at 3:00. It is kept through a requeue.
- `players.search_paused boolean not null default false`.
- **Candidates:** `status='matchmaking'`, the same `queue_language`, `not search_paused`, `last_seen_at > now() - 10s`, ordered by `queued_at asc`, limit 5.
- **The claim:** `pair_from_queue` also checks freshness and not paused under its locks. The higher-id claim tie-break stays, so only one side claims.
- **Pause:**
  - On `visibilitychange` to hidden, the client sends a beacon to `POST /api/matchmaking/pause`.
  - The poll also carries `visible:false`, and the server treats a hidden poll as paused.
  - On visible, the queue reads `search paused · resume ▸`. `resume ▸` calls `resumeQueueAction`, which clears `search_paused` and keeps `queued_at`.
- **The 3:00 check** is client-side, from the search's `queued_at` as the server returns it:
  - at 180s the queue's lines switch to the check, with a 30s drain;
  - unanswered, it calls `cancelQueueAction` with reason `timeout`, which clears `queued_at`, and reads `search stopped · find again ▸`.
- **The cooldown:** `startAutoQueue` and `sendDirectInvite` call `table_leave_cooldown_until` and refuse with `ErrorCode` `table_cooldown` and the end time.
- **Rate limit:** add a `matchmaking:table` scope for seat and leave (20/min). The queue poll stays unlimited, as today.

## R8. The client room at the table

**Found:**
- `MatchRoomController` derives `starting` from `msToStart = tickMs − clockLength` only when `in_progress` (`lib/room/moveState.ts:52`).
- A pending match has no clock, so it falls through to `yourMove`.
- The queue's `found` phase counts its own 3·2·1 and renders the match inline behind `history.replaceState`.

**Decision:**
- **`moveState`** gains two beats before `starting`:
  - `table`: pending, not void;
  - `void`: completed with `ended_reason='void'`.
- **The slip:** `lib/room/slip.ts` gains the `ready` and `void` kinds, with ranking match over > end early > resign > ready or void.
  - `Slip.tsx` renders them from a pure `readySlipModel` / `voidSlipModel` (label, headline, facts, stakes, seats, actions).
- **The scoreboard:** `deriveScoreboard` gains the table sub-lines and the `table` clock phase (`match clock` over `starts when both sit`, a full, still track, and `5:00`).
- **The start:** `started_at − now` is 4.5s. The slip shows `starts in 3` until `msToStart ≤ 3300`, then lifts. The scoreboard's `starting` count shows `min(3, ceil(msToStart/1000))`. The board arrives with the `in_progress` snapshot, and the letters land (the existing `letter-land`).
- **At go:** the controller plays `match-start` (existing `useSoundEffects.playMatchStart`, now wired), focuses the field (spec 068), and announces line 1.
- **The queue:** it stops rendering the match inline. On `matched` it calls `router.push('/match/:id')`. The `found` phase and `FOUND_COUNTDOWN_MS` are deleted from `roomStore` and `QueueRoomController`.
- **Back:**
  - While the match is `pending`, or `in_progress` before go, the controller pushes one guard entry on mount.
  - `popstate` on it calls `leaveTableAction` and routes to the lobby (T28).
  - Closing the tab is not a leave: a seated player stays seated, and an unseated one simply does not sit.

## R9. Stakes

**Found:** `calculateElo` (K 32 below 20 games, else 16) and `readRatings(client, ids, language)` are pure and in scope (`lib/rating/`).

**Decision:**
- `lib/rating/stakes.ts`, `stakesFor(ratings, playerId, opponentId)`, returns `{ win, draw, loss }` from three `calculateElo` calls.
- `loadMatchState` adds `stakes: Record<playerId, Stakes>` for `pending` matches only, with one `readRatings` read. During play the poll adds no query.
- The room keeps the last stakes it received in `roomStore`; the resign slip's `resignConsequence` takes `stakes[viewer].loss` from there, and omits the number after a mid-match reload. This closes the `TODOS.md` item.

## R10. Signals

**Decision:**
- **Tab titles:** `lib/room/tabTitle.ts` gains:
  - `table`: `Kári · opponent found · Wottle`;
  - `starting`: `3 · Kári · Wottle`;
  - `searching`: `searching 0:07 · Wottle`.
- **The `challenge` cue:** a new two-note Web Audio cue in `useSoundEffects`. It plays when the table opens in a hidden tab, and respects the toggle.
- **Wake lock:** `useWakeLock(active)` requests `navigator.wakeLock` on coarse-pointer devices while at the table or searching. It re-acquires on `visibilitychange` and releases on unmount.
- **Announcements:** the slip's headline is assertive once. Seat changes are polite, through the existing `useAnnouncements` queue.

## R11. Tests that assume the old start

**Found:** The two-player E2E specs (`moves-flow`, `disconnect-claim`, `match-completion`, the queue and challenge specs) enter a match and expect letters within seconds.

**Decision:**
- Add `sitDownIfAsked(page)` to `tests/integration/ui/helpers/matchmaking.ts`: it presses `ready ▸` when the ready slip is present.
- Every two-player spec calls it for both pages after pairing. The queue spec asserts the table first.
- Integration tests for the functions run against local Supabase in `tests/integration/db/table.race.test.ts`: 100 rounds of seat, seat, leave and deadline in random interleavings. Invariant: never `in_progress` without both seats, and never both started and void.
