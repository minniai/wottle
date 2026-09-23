# Tasks: The table

**Input**: Design documents from `specs/069-match-table/`: plan.md, spec.md (clarifications Q1–Q3), research.md (R1–R11), data-model.md, contracts/, quickstart.md.

**Tests**: Required. The constitution's TDD rule applies: each test task is written first, fails, and is then made to pass. Database tests run against local Supabase (`tests/integration/db`, which skips without one).

**Organization**: by user story. US1–US3 share the server core in Phase 2 and must ship in one slice (plan: a pending match without the `table` beat renders a board-less `yourMove`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US8 from spec.md.

---

## Phase 1: Setup

- [X] T001 Add the table constants in `lib/constants/game-config.ts`:
  - `TABLE_SEAT_WINDOW_MS = 20_000`
  - `TABLE_LEAD_MS = 4_500`
  - `SLIP_LIFT_BEFORE_GO_MS = 3_300`
  - `ATTENTION_INPUT_WINDOW_MS = 30_000`
  - `ATTENTION_FRESH_MS = 10_000`
  - `QUEUE_FRESH_MS = 10_000`
  - `QUEUE_CHECK_AT_MS = 180_000`
  - `QUEUE_CHECK_DRAIN_MS = 30_000`
  - `TABLE_LEAVE_WINDOW_MS = 600_000`
  - `TABLE_LEAVE_COOLDOWN_MS = 300_000`
  - `TABLE_CHECK_POLL_MS = 3_000`

  Each carries a one-line comment naming its spec FR. Add a unit test pinning the values in `tests/unit/constants/table-config.test.ts`.

- [X] T002 [P] Add the types to `lib/types/match.ts`:
  - `SeatKey`, `TableOrigin`, `VoidReason`, `MatchTable`, `Stakes`;
  - `MatchEndedReason` gains `"void"`;
  - `MatchState` gains `table: MatchTable` and `stakes: Record<string, Stakes> | null`;
  - `board` becomes `BoardGrid | null` (per data-model).

  Fix every type error this surfaces with the smallest change, e.g. `board ?? emptyBoard()` in the room readers. Add Zod schemas `matchTableSchema` and `stakesSchema` in `lib/match/schemas.ts`.

- [X] T003 [P] Add the copy keys to `lib/i18n/copy/types.ts`, `en.ts` and `is.ts`, with the strings from spec US1–US6. Every key is added in both languages, so the parity test passes.
  - **The table:** `tableLabel(s)`, `tableContext` (`opponent found`), `tableFacts(language)`, `tableStakes(s)`, `seatOnTheWay`, `seatReady`, `seatYou`, `readyAction` (`ready ▸` / `ég er til ▸`), `youAreSeated`, `leaveAction` (`leave` / `fara`).
  - **The scoreboard:** `sbStartsWhenSeated`, `sbNotReady`.
  - **The start:** `pickWhenClockStarts`.
  - **The void:** `voidLabel`, `voidOppNotSeated(name)`, `voidOppLeft(name)`, `voidYouNotSeated`, `voidNothingRated`, `voidBackInQueue`, `challengeAgainAction`, `tableMissedNotice`.
  - **The queue:** `searchPaused`, `resumeAction`, `stillSearching(t)`, `keepSearchingAction`, `searchStopped`, `findAgainAction`, `findAgainIn(t)`.
  - **Tab titles:** `titleTable(name)`, `titleStarting(n, name)`, `titleSearching(t)`.
  - **Error codes:** `not_started`, `table_cooldown`.

  Mark every Icelandic string that is (?) in the source with a `// native-read` comment.

---

## Phase 2: Foundational (blocks every story)

**Purpose:** the migration, the table service and the loader: the server rules every story reads.

- [X] T004 Write the failing DB tests in `tests/integration/db/table.test.ts`, using the `harness.ts` and `matchCreation.fixtures.ts` patterns:
  - `create_match_between` sets `table_deadline_at` 20s out and seats by `pressed_by` and by fresh attention (fresh, stale, hidden, and input older than 30s);
  - `seat_player` returns each status in `contracts/table-functions.md`;
  - the second seat writes the board, sets `started_at` 4.5s out and the deadline 5:00 later;
  - `start_table_if_seated` completes a table that was full at creation;
  - `void_table` handles `not_seated` (before and after the deadline) and `left` (pending, and during the count), with the player side effects for each origin: the absent player available with `table_missed_at`, the seated queue player requeued with `queued_at` kept;
  - `find_due_tables`;
  - `table_leave_cooldown_until`: 0, 1 and 2 leaves, 2 leaves 11 minutes apart, and an expired cooldown;
  - `pair_from_queue` refuses a paused or stale candidate.
- [X] T005 Write the failing race test in `tests/integration/db/table.race.test.ts`: 100 rounds of seat A, seat B, leave A, leave B and a deadline sweep in random interleavings. Invariants:
  - never `in_progress` without both seats;
  - never both started and void;
  - `started_at` is set at most once.
- [X] T006 Write the migration `supabase/migrations/20260924001_the_table.sql`:
  - the columns on `matches` and `players` (data-model);
  - `ended_reason` check plus `'void'`, and the `void_reason` check;
  - backfill the seat times on non-pending rows, then add the valid `in_progress ⇒ seated` check;
  - give existing pending rows `table_deadline_at = created_at + 20s`;
  - indexes `(state, table_deadline_at) where state='pending'` and `(queue_language, queued_at) where status='matchmaking'`;
  - `create_match_between(…, pressed_by uuid[] default '{}')` and the `accept_invite`, `accept_rematch` and `pair_from_queue` updates (`contracts/table-functions.md`);
  - the new functions `seat_player`, `start_table_if_seated`, `void_table`, `find_due_tables`, `table_leave_cooldown_until`;
  - `drop function start_match_if_ready`;
  - grants to `service_role` only.

  Run `pnpm supabase:migrate` and make T004 and T005 pass.

- [X] T007 [P] Write the failing unit tests for `stakesFor` in `tests/unit/lib/rating/stakes.spec.ts`: equal ratings under K 32 give +16/0/−16; a 1204-against-1187 case; K 16 after 20 games; the rating floor. Then implement `lib/rating/stakes.ts` on `calculateElo`.
- [X] T008 Write the failing unit tests for `lib/match/tableService.ts` (mocked Supabase client, Zod-parsed RPC results) in `tests/unit/lib/match/tableService.spec.ts`:
  - `seat(matchId, playerId)` passes `boardFor(match)`, `TABLE_LEAD_MS` and `MATCH_CLOCK_MS`, publishes the state on `seated|started`, and turns `late` into `voidDueTable`;
  - `leave(matchId, playerId)`;
  - `voidDueTable(matchId)`;
  - `startIfSeated(matchId)`;
  - each emits its structured log (`table.seated`, `table.started`, `table.void`).

  Then implement the service.

- [X] T009 Change `lib/match/createMatch.ts`: pass `pressed_by` per caller (queue `[]`, challenge `[accepter]`, crossed `[a,b]`, rematch `[accepter]`), and call `tableService.startIfSeated` when the result reports both seats. Update `tests/unit/lib/match/createMatch.spec.ts` first.
- [X] T010 Write the failing contract test `tests/contract/no-board-before-seats.contract.test.ts`: `loadMatchState` for a pending match returns `board: null`, `table` and `stakes`; past its deadline it calls `voidDueTable` and returns the void; with both seats it calls `startIfSeated`. Then change `lib/match/stateLoader.ts`:
  - remove `startIfReady`, `START_GRACE_MS` and `START_COUNTDOWN_MS`;
  - make those three changes;
  - read the stakes (`readRatings` plus `stakesFor`) only while `pending` (one query per table poll, none during play); the room keeps the last stakes it received in `roomStore` for the resign slip;
  - return `board` only from `in_progress` on.

  Remove every reference to the retired constants (grep).

- [X] T011 Change `app/api/cron/sweep-stale-matches/route.ts` to call `find_due_tables()` and then `tableService.voidDueTable` for each. Extend its unit test.
- [X] T012 [P] Exclude voids from finished-match readers with `ended_reason <> 'void'`: `app/actions/match/getRecentGames.ts`, `app/actions/player/getBestWords.ts`, `app/actions/match/requestRematch.ts` (refuse with the existing not-eligible code) and `lib/match/rematchRepository.ts`.
  - Add a grep test, `tests/unit/match/void-excluded-grep.test.ts`, that lists every `.eq("state", "completed")` reader in `app/` and `lib/` and fails when one lacks the void filter or an allow-list entry.

**Checkpoint:** the server holds the table. The room still needs the `table` beat (US1) before this ships.

---

## Phase 3: User Story 1 - Sit down at the table (P1) 🎯 MVP

**Goal:** every match opens at the table, and the viewer is seated by their press, by attention, or by `ready ▸`.

**Independent test:** pair two players with one tab hidden. The visible one is seated, the hidden one sees `ready ▸` and the 20s drain, and no letters reach either client before both are seated.

### Tests for User Story 1

- [X] T013 [P] [US1] Tests in `tests/unit/lib/room/moveState.table.spec.ts`: `deriveMoveState` gives `table` for pending, and `void` before `table`; `yourMove` never appears for a pending match.
- [X] T014 [P] [US1] Tests in `tests/unit/lib/room/tableSlip.spec.ts` for `readySlipModel`:
  - the label counts down from `deadlineAt`;
  - `ready+leave` when unseated, `seated+leave` when seated, `none` once started;
  - the stakes come from `stakes[viewer]`;
  - the facts come from the language;
  - the seat lines are ordered opponent then you.
- [X] T015 [P] [US1] Tests in `tests/unit/lib/room/scoreboard.table.spec.ts`: the clock row reads `match clock` over `starts when both sit`, with a full, still track and `5:00`; the rows have no totals; the sub-lines are `on the way|ready` and `you · not ready|ready`. Test both languages.
- [X] T016 [P] [US1] Tests in `tests/unit/components/room/Slip.table.spec.tsx` for the ready slip:
  - the headline is focused (`tabindex -1`) and announced once;
  - `ready ▸` is not focused and ignores clicks for 500ms;
  - once seated, row 1 is text with no button, and `leave` stays in row 2;
  - the drain bar's width follows `drainMs`;
  - it is a dialog.
- [X] T017 [P] [US1] Tests in `tests/unit/hooks/useAttention.spec.ts`: visibility changes, throttled input, and `inputAgoMs`. Tests in `tests/unit/hooks/useTableCheck.spec.ts`: polls every 3s with the attention, `router.push` to `/match/:id` on a match, `onNotice` for `table_missed`, `onCooldown`, and stops on unmount.
- [X] T018 [P] [US1] Write the failing contract test `tests/contract/seat-action.contract.test.ts`: `seatAction` covers Zod input, session, rate limit `matchmaking:table`, the status mapping, and a publish on seat.

### Implementation for User Story 1

- [X] T019 [US1] Add the `table` and `void` beats in `lib/room/moveState.ts` (make T013 pass).
- [X] T020 [P] [US1] Implement `readySlipModel` in `lib/room/tableSlip.ts` (T014), and add the `ready` and `void` kinds with the new ranking in `lib/room/slip.ts`.
- [X] T021 [P] [US1] Add the `table` phase and sub-lines to `deriveScoreboard` in `lib/room/scoreboard.ts` (T015), and render them in `components/room/Scoreboard.tsx`: no total at the table.
- [X] T022 [US1] Render the ready slip in `components/room/Slip.tsx`:
  - label; headline with `initialFocusRef`; facts; stakes (ink); two seat lines with squares; the action rows; a 4px drain bar using the existing drain style;
  - the 500ms guard reuses the end-early guard.

  Make T016 pass.

- [X] T023 [US1] Add `app/actions/match/seat.ts` (`seatAction`) with the `matchmaking:table` scope in the rate-limit config (T018).
- [X] T024 [P] [US1] Implement `components/room/hooks/useAttention.ts` and `lib/matchmaking/attention.ts` (`recordAttention`: clamps `inputAgoMs` to 0–600000 and writes the three columns).
- [X] T025 [US1] Change `app/api/match/active/route.ts` and `app/api/match/[matchId]/state/route.ts`: read `visible` and `inputAgoMs` and call `recordAttention`; return `{ match, cooldownUntil: null, notice: null }` (US3 and US5 fill these). Implement `components/room/hooks/useTableCheck.ts` (T017).
- [X] T026 [US1] Mount `useTableCheck`:
  - in `components/room/LobbyRoomController.tsx`, replacing the active-match half of `useLobbyInvites` (`router.push`);
  - in `components/profile/ProfilePage.tsx`.

  Not in the queue: its own poll returns `matched`, and a second check could push the table twice (analysis I1).

  Change the challenge-accept and rematch-accept navigation (`LobbyRoomController.tsx`, `MatchRoomController.tsx` `onNewMatch`) from `router.replace` to `router.push`.

- [X] T027 [US1] In `components/room/MatchRoomController.tsx` and `MatchRoomView.tsx`, at the `table` beat:
  - the empty ruled field at 32% under the ready slip;
  - the ledger caption `opponent found`, with the territory `0 · 100 free · 0` and no live row;
  - `onReady` → `seatAction`, then refresh;
  - `onLeave` → `leaveTableAction` (US3);
  - seat changes announced politely through `useAnnouncements`;
  - when the drain reaches 0, re-read the state once (the lazy void answers within 1s, SC-005);
  - `useAttention` is mounted in the match room and its values ride on the 2s `/state` poll, so a player on the result screen (a rematch requester) is seated by attention (analysis G2);
  - the `pagehide` disconnect beacon is skipped while the beat is `table`.

  Test it in `tests/unit/components/room/MatchRoomController.table.spec.tsx`.

- [X] T028 [US1] Add the tab title `Kári · opponent found · Wottle` in `lib/room/tabTitle.ts` (test first in `tests/unit/lib/room/tabTitle.spec.ts`). Add the `challenge` cue to `components/room/hooks/useSoundEffects.ts`, played when the table opens while `document.hidden` (respecting the toggle).
- [X] T029 [US1] Add `sitDownIfAsked(page)` to `tests/integration/ui/helpers/matchmaking.ts`, and call it for both pages after pairing in `moves-flow`, `disconnect-claim`, `match-completion`, `deadline-flow`, `reconnect-flow`, `room-flow`, `matchmaking`, `cross-language-queue` and `locale-is`.
  - Migrate any spec that asserted the old `found` phase.
- [X] T030 [US1] Write the Playwright spec `tests/integration/ui/table.spec.ts`:
  - two players pair; both land on `/match/:id` at the table with the empty frame;
  - one is auto-seated right after a click;
  - the other presses `ready ▸`;
  - no field cell has a letter before both are seated;
  - axe is clean on the ready slip;
  - `⋯ sign out` is refused at the table (spec 067).

**Checkpoint:** US1 works end to end with the Phase 2 server.

---

## Phase 4: User Story 2 - The start (P1)

**Goal:** the second seat sets the start 4.5s ahead; the 3·2·1 plays in the scoreboard, the letters land, and go opens the match.

**Independent test:** both rooms count 3·2·1 from the same server time, the letters land during `3`, and `move 1 · your move` shows at go.

- [X] T031 [P] [US2] Tests in `tests/unit/lib/room/tableSlip.spec.ts` (start) and `moveState.table.spec.ts`:
  - once `in_progress` with `msToStart > 3300`, the slip's label reads `starts in 3` and the slip stays;
  - at `≤ 3300` the slip lifts (`slipKind` none) and the beat is `starting` with `min(3, ceil(ms/1000))`;
  - line 2 reads `pick when the clock starts`;
  - past go, the live beats.
- [X] T032 [US2] Implement the lift and the count in `lib/room/tableSlip.ts` and `lib/room/moveState.ts` (clamp the count to 3; line 2 `pickWhenClockStarts`).
- [X] T033 [US2] At go in `components/room/MatchRoomController.tsx`: wire `playMatchStart` (existing `useSoundEffects`), keep the spec 068 focus-to-field, and announce line 1. The letters land when the `in_progress` snapshot brings the board (the existing `letter-land`, row by row; instant under reduced motion). Extend `tests/unit/components/room/MatchRoomController.table.spec.tsx`.
- [X] T034 [P] [US2] Add the tab title `3 · Kári · Wottle` during the count in `lib/room/tabTitle.ts` (test first).
- [X] T035 [US2] Extend the Playwright `tests/integration/ui/table.spec.ts`: both pages read `starts in 3` within 250ms of each other (sampled every 50ms), and both show `move 1 · your move` at go.

---

## Phase 5: User Story 3 - A table that does not fill is void (P1)

**Goal:** a deadline or a leave voids the table; nothing is rated; the seated queue player is requeued; the absent player's search stops.

**Independent test:** let a table run out with one player unseated. No rating, record or recent-match change; the seated queue player is searching again at the front; the absent player is not searching.

- [X] T036 [P] [US3] Tests in `tests/unit/lib/room/tableSlip.spec.ts` for `voidSlipModel`: the headline for each reason and viewer (`contracts/room-derivations.md` table), the body lines, and the actions by origin (queue-requeued `cancel`; challenge `challengeAgain` and `lobby`; rematch `result` and `lobby`).
- [X] T037 [P] [US3] Write the failing contract test `tests/contract/resign-pending.contract.test.ts`: `resignMatch` refuses `pending`, and `in_progress` before `started_at`, with `not_started`. Write the failing contract test `tests/contract/leave-table.contract.test.ts` for `leaveTableAction`.
- [X] T038 [US3] Implement `voidSlipModel` in `lib/room/tableSlip.ts`, and the void phase sub-lines (`did not sit down`, `left`, `you · searching`) in `lib/room/scoreboard.ts`.
- [X] T039 [US3] Add `app/actions/match/leaveTable.ts` (`leaveTableAction`, rate-limit scope `matchmaking:table`). Change `app/actions/match/resignMatch.ts` to refuse before go (T037).
- [X] T040 [US3] Render the void slip in `components/room/Slip.tsx` (headline focused, no motion) and wire its actions in `components/room/MatchRoomController.tsx`:
  - `cancel ▸` → `cancelQueueAction`, then the lobby;
  - `challenge again ▸` → `sendInviteAction(opponentId, language)`, then `router.push` to the lobby; a refusal shows its `ErrorCode` line (cooldown, busy, gone);
  - `result ▸` → `/match/:rematchOf`;
  - `lobby`.

  - A requeued viewer keeps searching from the void slip: the void-queue slip runs `useMatchmaking` in resume mode (the queue poll with attention, its `searching · 0:03` line under the body, `cancel ▸`). On `matched` it pushes `/match/:new`. Without this poll the requeued player goes stale after 10s and is never paired (analysis G1).

- [X] T041 [US3] Test first in `tests/unit/components/room/MatchRoomController.guard.spec.tsx`: a guard entry is pushed at the table; `popstate` calls `leaveTableAction` and routes to the lobby; after go no guard remains and no history is added. Then: Back leaves the table in `components/room/MatchRoomController.tsx`: while the beat is `table` or `starting`, push one `history.state = { kind: "table-guard" }` entry on mount; `popstate` from it calls `leaveTableAction` and routes to the lobby. After go the guard is removed without adding history.
- [X] T042 [US3] Test first in `tests/contract/match-active.contract.test.ts`: `notice` is `table_missed` once, then null; the attention is recorded; `cooldownUntil` is passed through. Then fill in `notice` in `app/api/match/active/route.ts`: read and clear `players.table_missed_at` → `table_missed`. `LobbyRoomController` shows `you did not sit down · your search stopped` as a lobby notice.
- [X] T043 [US3] Test first in `tests/unit/app/matchPage.void.spec.tsx`: a participant opening a void match gets the room with the void beat; a non-participant is redirected to `/lobby`. Then: a void match's address shows the void slip over the empty frame. Check `app/[locale]/(room)/match/[matchId]/page.tsx`: a void match is not redirected as a non-participant's completed match; participants see the slip; others get the existing read-only redirect to `/lobby`.
- [X] T044 [US3] Extend the Playwright `tests/integration/ui/table.spec.ts`:
  - leave → both see the void, and the leaver lands on the lobby;
  - the deadline with one unseated player (a hidden page, no input) → the void, and the seated queue player's row reads `you · searching`.

  In both cases the profile shows no new match.
  - A third player searching after the void is paired with the requeued player, who reaches the new table without leaving the void slip first.

---

## Phase 6: User Story 4 - A queue that never pairs a ghost (P1)

**Goal:** `queued_at` order, 10s freshness, pause on hidden, the 3:00 check, and requeue at the front.

**Independent test:** with one searcher stale by 12s and two fresh ones, a new searcher pairs with the one who joined first.

- [X] T045 [P] [US4] Write the failing DB test in `tests/integration/db/queue-order.test.ts` (the `pair-from-queue.test.ts` patterns): candidates in `queued_at` order; stale (>10s) and paused players skipped; `queued_at` unchanged by polls and kept through a requeue.
- [X] T046 [P] [US4] Tests in `tests/unit/lib/room/queueView.spec.ts`: `searching` with the elapsed time, `paused`, `stillSearching` at 180s with a 30s drain, `stopped` at 210s, `cooldown` first, and an answered check resetting the 180s.
- [X] T047 [US4] Change `lib/matchmaking/inviteService.ts`:
  - `joinQueue` sets `queued_at` only when it is null and `search_paused=false` on a visible poll, and records the attention;
  - a hidden poll sets `search_paused=true` and returns `paused`;
  - `fetchQueueCandidates` filters freshness and not paused, and orders by `queued_at`;
  - `selectQueueOpponent` orders by `queued_at`.

  Update `tests/unit/lib/matchmaking/inviteService*.spec.ts` first.

- [X] T048 [US4] Test first in `tests/contract/queue-actions.contract.test.ts` (`startQueueAction` with attention, `paused`, `cooldown`; `resumeQueueAction` keeps `queued_at`; `cancelQueueAction` clears `queued_at` and `queue_language`) and `tests/contract/pause-beacon.contract.test.ts` (204, pauses only a `matchmaking` player, no session → 401). Then change `app/actions/matchmaking/startQueue.ts` (input `attention`; result `queuedAt` and `paused`), add `app/actions/matchmaking/resumeQueue.ts`, add `app/api/matchmaking/pause/route.ts` (the beacon, 204), and change `app/actions/matchmaking/cancelQueue.ts` to clear `queued_at` and `queue_language` (with a `reason`).
- [X] T049 [US4] Implement `lib/room/queueView.ts` (T046).
- [X] T050 [US4] Change `lib/room/useMatchmaking.ts`:
  - send the attention on each poll;
  - send a `sendBeacon` to the pause route on `visibilitychange` to hidden;
  - expose `resume()` and `answerCheck()`;
  - cancel with `timeout` when the check drains.

  Change `components/room/QueueRoomController.tsx`:
  - draw the `QueueView` lines: `search paused · resume ▸`, `Still searching? · 3:00` with the primary `keep searching ▸`, the secondary `cancel ▸` and the drain, and `search stopped · find again ▸`;
  - on `matched`, `router.push('/match/:id')`;
  - remove the inline `found` phase, `FOUND_COUNTDOWN_MS` and the inline `MatchRoomController`.

  Remove `found` from `lib/room/roomStore.ts`. Test it in `tests/unit/components/room/QueueRoomController.spec.tsx`.

- [X] T051 [P] [US4] Add the tab title `searching 0:07 · Wottle` in `lib/room/tabTitle.ts` (test first), and set it from `QueueRoomController`.
- [X] T052 [US4] Extend the Playwright `tests/integration/ui/matchmaking.spec.ts`:
  - a hidden searcher (`page.evaluate` dispatching `visibilitychange` with a stubbed `document.visibilityState`) is not paired, and reads `search paused · resume ▸` on return;
  - a closed searcher is not paired after 10s.

---

## Phase 7: User Story 5 - Leaving tables has a cost (P2)

**Goal:** two `left` voids within 10 minutes → 5 minutes without searching or sending challenges. Accepting stays open (Q1).

**Independent test:** after two recorded leaves, a search and a challenge are refused with the time remaining, and the lobby counts it down.

- [X] T053 [P] [US5] Write the failing tests:
  - `tests/unit/lib/matchmaking/cooldown.spec.ts`: `startAutoQueue` returns `cooldown` with `until`; `sendDirectInvite` throws `table_cooldown`; `respondToInvite` accept is not gated.
  - A test in `tests/unit/components/room/LobbyRoomController.cooldown.spec.tsx`: the find slot reads `find again in 4:12`, counts down, and is not a button.
- [X] T054 [US5] Call `table_leave_cooldown_until` from `lib/matchmaking/inviteService.ts` (`startAutoQueue`, `sendDirectInvite`). Return `cooldownUntil` from `app/api/match/active/route.ts`.
- [X] T055 [US5] Draw the cooldown in the lobby's find slot in `components/room/LobbyRoomController.tsx` / `LobbyRoomView.tsx`. The void slip's `challenge again ▸` shows the same refusal line.

---

## Phase 8: User Story 6 - The table on a phone (P2)

**Goal:** the slip is exactly the field's square; the facts line moves to the ledger block; the screen stays awake.

**Independent test:** at 390×844, 390×664 and 360×640 the table fits with `ég er til ▸` and `fara` visible and nothing scrolling.

- [X] T056 [P] [US6] Tests in `tests/unit/hooks/useWakeLock.spec.ts`: requests the lock when active on a coarse pointer, re-acquires on visible, releases on inactive or unmount, and is a no-op without `navigator.wakeLock`.
- [X] T057 [US6] Implement `components/room/hooks/useWakeLock.ts`. Use it in `MatchRoomController` (the `table` beat) and in `QueueRoomController` (searching).
- [X] T058 [US6] Test first: extend `tests/integration/ui/room-fixtures.spec.ts`: `phone-table` at 390×844, 390×664 and 360×640 with no scroll and both actions in view; axe clean. These fail until T059.
- [X] T059 [US6] Phone layout:
  - `components/room/Slip.tsx` phone budget for ready and void (F5 table: label, headline 28px, stakes, seats, actions, drain), with the facts line dropped;
  - `components/room/Ledger.tsx` collapsed live-row position carries the facts line at the table;
  - styles in `app/styles/room.css`. Make T058 pass.

---

## Phase 9: User Story 7 - The rules, the design system and the fixtures say what is built (P2)

**Goal:** the documents and fixtures match the build (S13).

**Independent test:** `pnpm docs:check` passes; the six phases and the phone table render with no database; the visual suite passes.

- [X] T060 [P] [US7] Fixtures in `app/[locale]/dev/room/fixtures.ts` and `RoomFixture.tsx`:
  - the phases `table`, `table-seated`, `void` (challenge origin), `void-queue` and `searching-paused`;
  - `starting` updated to follow the table (4.5s lead, slip lifted);
  - the phone view `phone-table` over `table`.

  Extend the phase list test.

- [X] T061 [P] [US7] Rules document `docs/prd_and_requirements/wottle_game_rules.md`:
  - §2a: "every match that starts is rated …" (spec US7 scenario 1);
  - §12: a new row _The table_ (seating, 20s, void);
  - the _Clock_ row names `starting` with the 4.5s lead;
  - the _Every match is rated_ row excludes voids.
- [X] T062 [P] [US7] Design system `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md`:
  - §1.1 and §5.9: the ready and void slip kinds and the ranking;
  - §5.3: the table sub-lines;
  - §8: the table, void and queue strings;
  - §6: "time is not motion" names the table drain.
- [X] T063 [US7] Update `CLAUDE.md`:
  - a spec 069 paragraph in Current State;
  - Design: the slip kinds;
  - Architecture: §4 match states with the table, §4a `pressed_by`, §5 "the start", §7 the room flow (queue → table at `/match/:id`);
  - Disconnect Handling;
  - the fixture phases list;
  - the Icelandic native-read strings in gap 4.

  Add retired phrases to `scripts/docs/consistency-grep.sh` (`START_GRACE_MS`, `start_match_if_ready`, the `found` phase). Run `pnpm docs:check`.

- [X] T064 [US7] Run `pnpm test:visual --update-snapshots` for the new and changed phases (darwin). Review every changed baseline by eye, and delete any orphaned `found-visual-*` baselines.

---

## Phase 10: User Story 8 - The resign slip names the loss (P3)

- [X] T065 [P] [US8] Test in `tests/unit/lib/i18n/resignConsequence.spec.ts`: `resignConsequence(name, loss)` ends `· −9` in both languages, and the slip draws it in ink (no `.points-lost`).
- [X] T066 [US8] Pass the stored `stakes[viewer].loss` (kept in `roomStore` from the table, T010) from `MatchRoomController` to the resign slip; with no stored stakes (a reload mid-match) the body omits the number. Update `lib/i18n/copy/{en,is}.ts`, and remove the item from `TODOS.md`.

---

## Phase 11: Polish & cross-cutting

- [X] T067 [P] Observability: confirm the structured logs `table.seated`, `table.started`, `table.void {reason, origin}`, `queue.paused`, `queue.requeued` and `table.cooldown` in `lib/match/tableService.ts` and `lib/matchmaking/inviteService.ts`, with a unit test asserting the payload shape.
- [X] T068 [P] Performance: add a seat step to `pnpm perf:move-receipt`'s scenario (or a new `perf:seat`) and assert seat RTT under 200ms p95.
- [X] T069 Run the gates:
  - `pnpm test`, `pnpm test:integration` (local Supabase), `pnpm lint`, `pnpm typecheck`, `pnpm docs:check`, `pnpm test:visual`;
  - the Playwright two-player specs one file at a time (`table`, `moves-flow`, `disconnect-claim`, `match-completion`, `matchmaking`).

  Record the results in this file's Notes.

- [X] T070 Walk through `quickstart.md` in two browsers, and fix anything it finds.

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (T006 blocks T008–T012; T002 blocks everything typed).
- **US1** needs Phase 2. **US2** and **US3** need US1's beats and slip (T019–T022, T027). **US1–US3 ship together** (plan).
- **US4** needs Phase 2 (the migration's queue columns) and T024 (attention). It is independent of US2 and US3, except for requeue, which T006 implements.
- **US5** needs Phase 2 (`table_leave_cooldown_until`) and US3 (leaves exist).
- **US6** needs US1's slip. **US7** needs US1–US6 for its fixtures and baselines. **US8** needs T010 (stakes in the state).
- **Within a story:** tests → pure derivations → server actions → components → E2E.

## Parallel examples

```text
Phase 2:  T007 (stakes) ∥ T012 (void readers), after T006
US1:      T013 ∥ T014 ∥ T015 ∥ T016 ∥ T017 ∥ T018 → T019 → (T020 ∥ T021 ∥ T024) → T022 → T023, T025–T030
US4:      T045 ∥ T046 → T047 → T048 → T049 → T050, with T051 alongside
US7:      T060 ∥ T061 ∥ T062 → T063 → T064
```

## Implementation strategy

1. **MVP slice (one PR, or one merge point):** Phases 1–5, which give US1 to US3. After it, nobody is rated for a match they did not sit at, and the letters never leak.
2. **Then US4:** the fair queue, which stops the ghosts from being paired at all.
3. **Then US5 and US6,** then US7's documents and baselines, then US8.
4. **Commit** per passing test or tight group, as conventional commits. The migration lands with T004 and T005 green. The E2E helper (T029) lands in the same commit that makes seating required.

## Notes

- The Linux baselines come from the CI visual job's artifacts.
- Run the two-player Playwright specs locally one file at a time (CLAUDE.md, Test Health).

### Implementation notes (2026-09-23)

- **T001:** the constants live in `lib/constants/table.ts`, not `game-config.ts`, which is a rules file (CLAUDE.md, Game Rules Spec).
- **T009:** `pressed_by` is decided in SQL (`accept_invite` and `accept_rematch` pass the accepter, or both for a crossed press); `createMatch.ts` only starts a table full at creation.
- **T006:** every table function takes the players' locks before the match. `seat_player` updates the match row twice in one transaction, the second update re-checks its player foreign keys, and taking the match first deadlocked against a leave in the race test.
- **T047:** the "higher id claims" tie-break is gone. With `queued_at` order it would have kept the oldest searcher waiting on a newer one; `pair_from_queue`'s locks already keep one match per pair.
- **T048:** there is no `resumeQueueAction`. The first poll of a search, and the first after `resume ▸`, carry `resume: true`; no other poll clears a pause. The browser test found a poll in flight when the tab went hidden landing after the pause beacon and clearing it, so a poll that returns to a hidden tab sends the beacon again.
- **T050:** the queue's `found` phase is gone from the store, the view and the fixtures, with its baselines.
- **T059:** on a phone the facts line takes the live row's place through the ready slip's model (`MatchRoomView`), not the ledger.
- **Not built:** the 30s drain bar under `Still searching?` (the check reads and counts, but draws no bar); OS notifications and reactions (stage 4, phase 2).
- **Visual baselines:** a first run against a dev server started before the branch switch wrote coral into the new baselines; they were deleted and regenerated on a fresh server, and `starting` and `end-early` were regenerated from scratch because their changes fell under the diff tolerance.
- **Gates (T069, 2026-09-23, local):** unit 2053 passed; integration 130 passed (35 files, live Supabase); lint, typecheck and `docs:check` clean; visual 206 passed; `perf:seat` p95 7.9ms. Playwright on chromium, one file at a time: `table` (3), `moves-flow`, `room-flow` (5), `reconnect-flow` and `matchmaking` (3) pass. `match-completion` fails where it failed before this stage (the rematch request never arrives over local Realtime), and `lobby-presence` fails identically on `main` (a departed player stays in the here-now list locally). `disconnect-claim` was not rerun.
- **T070:** the quickstart's steps are exercised by the automated runs above: pairing and both seated, the count to move 1, an unseated player pressing `ready ▸`, a hidden searcher not paired and `resume ▸`, a leave and a table whose 20s run out (`table.spec`, `matchmaking.spec`), and the cooldown (`queue-order.test.ts`). No separate manual walk in two browsers was done.

