# Tasks: The door, the lobby, challenges and presence

**Input**: Design documents from `specs/070-door-lobby/`: plan.md, spec.md (Q1–Q4), research.md (R1–R19), data-model.md, contracts/routes-and-actions.md, contracts/page-derivations.md, quickstart.md.

**Tests**: Required. The constitution's principle VII (TDD) is non-negotiable, so every implementation task is preceded by a failing test.

**Organization**: One phase per user story, in the order they can land. The door (US1) and presence (US6) come first because the lobby reads both. Then the lobby, challenges and the line slot follow. The lobby room, the queue room and the invite poll are deleted in US4, in the same slice that brings the line slot (plan: order of landing).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task).
- **[Story]**: US1–US10 from spec.md.

---

## Phase 1: Setup

- [X] T001 Re-check with Context7 that supabase-js 2.108 accepts `realtime: { worker: true }`, and check Next 16's route-group layouts and `redirects()` (`permanent: true` gives 308). Record anything that differs from R6 and R10 in `specs/070-door-lobby/research.md`.
- [X] T002 [P] Add the scripts `perf:heartbeat` and `perf:standing` to `package.json`, pointing at `tests/perf/heartbeat.bench.ts` and `tests/perf/standing.bench.ts`.
- [X] T003 [P] Create `app/styles/pages.css` (tokens only: page grid, masthead, line slot, folio, row tables, composer row, form strip, lockup) and import it in `app/[locale]/layout.tsx`.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the migration, the shared types and constants, the pokes module, the page frame, and the provider shell.

### Tests first

- [X] T004 Write failing integration tests for the migration's schema in `tests/integration/db/door-lobby-schema.test.ts`:
  - `presence_tabs` exists, with RLS on and no anon access;
  - `players.lobby_language` and `players.unseen_result_match_id` exist;
  - `match_invitations` has `expires_at` and `auto_declined`, and accepts the status `left`;
  - `match_heartbeats` has `source` and `cadence_ms`;
  - every new function is executable by the service role only.
- [X] T005 [P] Write a failing unit test for the presence constants in `tests/unit/lib/presence/constants.spec.ts`. It checks the values in spec FR-032: 10s and 30s cadences, gone after 3 × cadence + 5s, away after 2:00, the 8s leaving grace, the 30s recent input, the 60s challenge TTL, the 60s decline cooldown, 6 challenges a minute, the three-declines rule over 10 minutes and 4 hours, the 500ms guard, and the 3s and 12s polls.
- [X] T006 [P] Write a failing unit test for pokes in `tests/unit/lib/realtime/pokes.spec.ts`:
  - `topicFor(id)` is a stable 32-hex HMAC of the id under `WOTTLE_SESSION_SECRET`;
  - `pokePlayer` sends an empty payload with the event name set to the kind;
  - `pokeLobby` sends only `recheckInMs` when given one;
  - a publish failure is logged as `poke.failed` and never thrown.

### Implementation

- [X] T007 Write `supabase/migrations/20260925001_door_lobby.sql` per data-model.md:
  - the `presence_tabs` table and its indexes;
  - the new columns on `players`, `match_invitations` (backfilling `expires_at`) and `match_heartbeats`;
  - the `matches` head-to-head indexes;
  - the widened status check;
  - grants.

  The functions come in later tasks, each with its tests. Make T004 pass.
- [X] T008 [P] Create `lib/presence/constants.ts` (T005), shared by client and server, with no server-only imports.
- [X] T009 [P] Create `lib/types/standing.ts` with `PresenceState`, `LobbyRow`, `InviteStatus`, `Outcome`, `StandingFacts`, `SlotState`, `Overview` and `ChallengeStatus`, each with a matching Zod schema.
- [X] T010 [P] Create `lib/realtime/pokes.ts` with `topicFor`, `pokePlayer` and `pokeLobby` over the service-role broadcast `send`, following `lib/match/statePublisher.ts`. Make T006 pass.
- [X] T011 [P] Set `realtime: { worker: true }` in `lib/supabase/browser.ts`, and add a unit test in `tests/unit/lib/supabase/browserRealtime.spec.ts` asserting the option is passed.
- [X] T012 [P] Write a failing test for `nextParam` in `tests/unit/lib/auth/nextParam.spec.ts`. It keeps `/`, `/en/rules`, `/profile/k%C3%A1ri` and `/match/<uuid>`, and drops `//evil`, `https://x`, `/unknown`, `javascript:` and paths with backslashes. Then implement `lib/auth/nextParam.ts`.
- [X] T013 [P] Write a failing test for the lockup geometry in `tests/unit/lib/brand/lockup.spec.ts`:
  - IS 7×6: ORÐUSTA across row 3, WOTTLE down column 6, crossing at T, whose value is 2 and whose seat is `you`;
  - EN 6×7: WOTTLE across, ORÐUSTA down from the shared O;
  - numerals hidden below 32px cells;
  - the opponent's letters use the text colour below 31px cells;
  - the values come from the language packs;
  - `strip()` and `cell()` sizes.

  Then implement `lib/brand/lockup.ts`.
- [X] T014 Write a failing test for the page frame in `tests/unit/components/page/PageFrame.spec.tsx`:
  - the landmarks banner, main and contentinfo;
  - the masthead's order: how to play, the switch, the player square, then `⋯`;
  - the line slot is rendered only with a session, and reserves its height when empty;
  - the folio text.

  Then implement `components/page/PageFrame.tsx`, `Masthead.tsx`, `Folio.tsx`, `Strip.tsx`, `LanguageSwitch.tsx` and `PageMenu.tsx`.
- [X] T015 Create the route group `app/[locale]/(pages)/layout.tsx`, which renders `PageFrame` (reading the session once). Move `app/[locale]/profile/**` and `app/[locale]/rules/page.tsx` into `app/[locale]/(pages)/` unchanged. Fix any imports and the locale-link grep test.
- [X] T016 Create the shell `components/standing/StandingProvider.tsx` (a context with no hooks yet), and mount it in `app/[locale]/layout.tsx` when `readLobbySession()` returns a session.
- [X] T017 Add a fixture route `app/[locale]/dev/page/page.tsx` and `fixtures.ts`, gated by `ROOM_FIXTURES` like `/dev/room`. It renders `PageFrame` with static facts and no database, and takes `?phase=`. Add an empty phase list and extend `tests/integration/ui/room-fixtures.spec.ts`, or add `page-fixtures.spec.ts`, to iterate the page phases at 1440×900, 390×844, 390×664 and 360×640.

**Checkpoint**: The migration is applied, the types and pokes exist, and the pages render an empty frame. Nothing visible has changed for players yet.

---

## Phase 3: User Story 1 – The door (P1) 🎯 MVP

**Goal**: A signed-out visitor at `/` or `/en` sees the lockup, the headline, the lede, one name field and here now (at most 8 rows), and enters the lobby at the same URL.

**Independent test**: quickstart §1. `tests/integration/ui/door.spec.ts` passes.

### Tests first

- [X] T018 [P] [US1] Write a failing test for the door's copy models in `tests/unit/lib/pages/doorCopy.spec.ts`:
  - the headline and lede are built from `moveLimit` and `MATCH_CLOCK_MS` through the per-language number-word table, with digits as the fallback;
  - the kicker;
  - the count line, which is hidden when nobody is here.
- [X] T019 [P] [US1] Write a failing component test in `tests/unit/components/page/door/Door.spec.tsx`:
  - the one `h1` is the headline;
  - the lockup is `role="img"` with its label, and contains no link;
  - the input has no autofocus, and `aria-describedby` points at the format rule;
  - each error (format, taken, too many, failed) sets `aria-invalid` and appears in the polite region;
  - Enter submits;
  - the primary ignores repeat presses while submitting;
  - the returning state and `not Birna? · use another name`;
  - the preference line when the browser language differs, which removes the masthead switch.
- [X] T020 [P] [US1] Write a failing test for the door's here-now list in `tests/unit/components/page/door/HereNowList.spec.tsx`:
  - at most 8 rows (here before searching, then by rating distance from 1200);
  - `+ 22 more`, which is not a link;
  - the empty state;
  - the rows are not links.
- [X] T021 [P] [US1] Write a failing contract test in `tests/contract/overview-public.contract.test.ts`. A signed-out `GET /api/lobby/overview` returns `counts`, `here` (at most 8) and `more`, and never `lastMatch`, `form` or any player id.
- [X] T022 [US1] Write a failing Playwright spec `tests/integration/ui/door.spec.ts`:
  - `/` and `/en` render the door with no field;
  - a too-short name shows the format error;
  - a valid name lands in the lobby at `/`, with the door's history entry replaced;
  - `?next=/rules` lands on the rules;
  - `?next=//evil.example` is ignored;
  - the phone layout at 390×664 has the primary above the fold.

### Implementation

- [X] T023 [P] [US1] Implement `lib/pages/doorCopy.ts` (T018), and add the door strings to `lib/i18n/copy/{en,is}.ts` and `types.ts`: the kicker, headline, lede, labels, errors, `SKRÁNING ÓÞÖRF`, `ÞESSI VAFRI GEYMIR NAFNIÐ ÞITT`, how it plays, the preference line and the door title. Mark the (?) Icelandic strings `// native-read`.
- [X] T024 [US1] Implement `lib/lobby/overview.ts` (`lobbyCounts` with `here`, `searching`, `playersInMatch` and `matchesOn`, signed-out `here` capped at 8, `more`), and add `lobby_counts(p_language)` to the migration. A minimal version of `player_presence` is needed here, reading `lobby_presence` until US6 replaces it; mark it `-- replaced in US6`. Implement `app/api/lobby/overview/route.ts` (T021).
- [X] T025 [P] [US1] Implement `components/page/Lockup.tsx` from `lib/brand/lockup.ts`, including the once-per-session arrival: a `sessionStorage` flag in try/catch, the `letter-land` then `band-draw` sequence, and only the end state under reduced motion.
- [X] T026 [US1] Implement `components/page/door/Door.tsx`, `DoorForm.tsx` (moving the name validation and `enter_player` call from `components/room/NameInput.tsx`), `HereNowList.tsx` and `HowItPlays.tsx`, with the desktop and phone (F1) layouts in `pages.css`. Make T019 and T020 pass.
- [X] T027 [US1] Create `app/[locale]/(pages)/page.tsx`: signed out it renders the door, reading the overview on the server for the first paint; signed in it renders the lobby placeholder until US2. Apply `nextParam` after entry. Emit the door's title and the hreflang alternates (`/`, `/en`, x-default `/`) in `generateMetadata`.
- [X] T028 [US1] Delete `app/[locale]/(room)/page.tsx`. Delete the `signIn` slip kind in `lib/room/slip.ts` and `components/room/Slip.tsx`, the slip's name form, and any fixture phases that used it (`landing-slip`, `returning-slip`) with their baselines and the orphan `landing-visual-*` files. Update `tests/integration/ui/helpers/matchmaking.ts` so `loginViaSlip` becomes `enterViaDoor`, and switch every spec to it.
- [X] T029 [P] [US1] Replace `app/icon.png` with `public/brand/cell-{is,en}.svg` and `cell-{is,en}-call.svg`, generated from `lib/brand/lockup.ts` `cell()` by `scripts/brand/renderCells.ts`. Render `app/[locale]/apple-icon.png` per locale with the same script. Set the icons per locale in `generateMetadata`.
- [X] T030 [US1] Add the page phases `door`, `is-door` and `door-returning` to `app/[locale]/dev/page/fixtures.ts`. Generate baselines with `pnpm test:visual --update-snapshots` and review them. Make T022 pass.

**Checkpoint**: The door ships alone. A signed-in player still reaches the old lobby, through `/lobby`, until US2.

---

## Phase 4: User Story 6 – Presence that tells the truth (P1)

**Goal**: Presence is per tab. The states are here, searching, in a match, away and gone. A closed tab drops within 8s, and a reload changes nothing.

**Independent test**: quickstart §2. `tests/integration/db/presence.test.ts` and `tests/integration/ui/presence.spec.ts` pass.

### Tests first

- [X] T031 [P] [US6] Write failing integration tests in `tests/integration/db/presence.test.ts`:
  - `beat_tab` upserts the tab and refreshes `lobby_presence.expires_at` and the attention columns;
  - `transition` is true on a player's first fresh tab and on a visibility change, and false on repeat beats;
  - `player_presence` returns here, searching, in_match (with the move count, from `matches`) and away (all tabs hidden 2:00);
  - it omits gone players: past 3 × cadence + 5s, or a leaving mark older than 8s;
  - the best state across tabs wins;
  - a reload (a leaving mark followed by a new beat within 8s) keeps the player;
  - `presence_tabs.language` comes from `players.lobby_language`, not from the page.
- [X] T032 [P] [US6] Write failing integration tests for `settle_gone_players()` in `tests/integration/db/presence.gone.test.ts`. A gone player with a search has it cancelled; their pending challenges, sent and received, become `left` with `responded_at`; and the function returns the affected ids.
- [X] T033 [P] [US6] Write a failing unit test for the heartbeat hook in `tests/unit/components/standing/useTabPresence.spec.ts`:
  - the tab id is kept in `sessionStorage`, with an in-memory fallback when storage throws;
  - the cadence is 10s while visible and 30s while hidden, switching on `visibilitychange`;
  - the last input time is taken from `useAttention`;
  - a `pagehide` sends the beacon to `/api/presence/leave` with text/plain JSON;
  - the page kind is sent with each beat.
- [X] T034 [P] [US6] Write a failing contract test in `tests/contract/beacons.contract.test.ts`. `POST /api/presence/leave` and `POST /api/lobby/invite/withdraw` accept a text/plain JSON body and return 204, or 401 with no session.
- [X] T035 [US6] Write a failing Playwright spec `tests/integration/ui/presence.spec.ts`:
  - B enters and appears in A's list;
  - B reloads and never disappears;
  - B closes its tab and disappears within 8s;
  - B hidden for 2:00 shows `away` (use a clock override or a shortened constant under `ROOM_FIXTURES`).

### Implementation

- [X] T036 [US6] Add `beat_tab`, `leave_tab`, `player_presence` (replacing US1's minimal version) and `settle_gone_players` to the migration. Make T031 and T032 pass.
- [X] T037 [US6] Implement `lib/presence/presenceService.ts`: `beat`, `leave`, `playerPresence` and `lobbyCounts`, with RPCs parsed by Zod and structured logs `presence.transition` and `presence.gone`.
- [X] T038 [US6] Implement `app/api/presence/beat/route.ts` and `app/api/presence/leave/route.ts` per the contract. Beat pokes `lobby:{language}` on a transition. Leave pokes with `recheckInMs: 8500`. Make T034 pass for presence.
- [ ] T039 [US6] Implement `components/standing/hooks/useTabPresence.ts` (T033) and wire it into `StandingProvider`. Retire the 60s heartbeat in `lib/matchmaking/presenceStore.ts`, and delete `app/api/lobby/presence/route.ts` and its unit test `tests/unit/lib/matchmaking/presenceHeartbeat.test.ts`, replacing them with the new tests.
- [X] T040 [US6] Point the attention recording in `lib/matchmaking/attention.ts` at the best of the player's fresh tabs as well, so that seating (spec 069) reads any signed-in page. Add a case to `tests/unit/lib/matchmaking/attention.spec.ts`.
- [X] T041 [US6] Add `expire` of challenges (placeholder until US3), `settle_gone_players` and pruning `presence_tabs` stale for more than 10 minutes to `app/api/cron/sweep-stale-matches/route.ts`. Poke the affected counterparts (`outcome`) and lobbies (`presence`). Extend `tests/unit/app/api/sweepStaleMatches.test.ts`.
- [X] T042 [US6] Write a perf bench `tests/perf/heartbeat.bench.ts` for `POST /api/presence/beat` p95 under 100ms on local Supabase. Make T035 pass.

**Checkpoint**: Presence is truthful everywhere the old lobby reads it, because `lobby_presence` is still maintained.

---

## Phase 5: User Story 10 – The lobby overview (P2, needed by US2)

**Goal**: One overview read per language: counts for both lobbies, the viewer's last match with its bands, and the last ten.

**Independent test**: `tests/integration/db/overview.test.ts` and `head-to-head.test.ts` pass.

- [X] T043 [P] [US10] Write failing integration tests in `tests/integration/db/head-to-head.test.ts`. `head_to_head(viewer, language)` counts wins, losses and draws against each opponent over completed matches in that language; it excludes void, abandoned and other-language matches; and it is one query.
- [X] T044 [P] [US10] Write failing integration tests in `tests/integration/db/overview.test.ts`:
  - the counts for this lobby and the other, with `playersInMatch` (players at a table or in a match) and `matchesOn` (matches in progress) as separate numbers;
  - `lastMatch` is the latest completed, rated match in that language, and carries `bands`: every `word_score_entries` row's tiles, with the seat relative to the viewer;
  - `form` is the last ten `match_ratings` results in that language, oldest first;
  - void and abandoned matches never appear.
- [X] T045 [US10] Add `head_to_head` to the migration, and implement `lib/matchmaking/headToHead.ts` (T043).
- [X] T046 [US10] Extend `lib/lobby/overview.ts` and `app/api/lobby/overview/route.ts` with `lastMatch` and `form` for a session (T044). Make `app/actions/match/getRecentGames.ts` exclude `state='abandoned'`, and add `?language=` to `app/api/lobby/stats/matches-in-progress/route.ts`. Update `tests/unit/app/actions/getRecentGames.spec.ts`.

---

## Phase 6: User Story 2 – The lobby, and who is here (P1)

**Goal**: The signed-in `/` is the lobby page. It shows your block, the form strip, the here-now table with your record against each player, the band map, your recent matches, and the new-player and empty states. `/lobby` and `/matchmaking` return 308.

**Independent test**: quickstart §1.4 and §2. `tests/integration/ui/lobby-challenge.spec.ts` (the list part) passes.

### Tests first

- [X] T047 [P] [US2] Write a failing test in `tests/unit/lib/pages/lobbyRows.spec.ts`:
  - rows are ordered by state, then by rating distance, then by name;
  - the order freezes, and new ids are appended at the end;
  - status words: `in a match · 6 of 10` and `away` are muted with no action;
  - the record reads `3–1`, `3–1–1` or `—`;
  - eight rows are shown, then `+ 6 more ▸`.
- [X] T048 [P] [US2] Write a failing test in `tests/unit/lib/pages/formStrip.spec.ts`: ten cells, oldest first, padded; W, L and D map to their letters in both languages; the `aria-label` names draws only when there are any.
- [X] T049 [P] [US2] Write a failing test in `tests/unit/lib/pages/bandMap.spec.ts`: the rectangles and chevrons follow the `bandGeometry` inset at 34px cells, the seat colour is relative to the viewer, and there are no letters.
- [X] T050 [P] [US2] Write failing component tests in `tests/unit/components/page/lobby/Lobby.spec.tsx`:
  - the `h1` is the name;
  - the block's sub-line, per language;
  - the primary `find an opponent ▸` and the searching count;
  - the form strip is `role="img"`;
  - the table is `role="table"`, with actions labelled name first;
  - the band map is one link, `review your last match`;
  - the new-player state;
  - the empty state, with find as the primary and `tell me when someone is here ▸`;
  - the `⋯` menu: sound, and sign-out with its consequence line or disabled state (the notifications item comes in T080 and T085).
- [X] T051 [P] [US2] Write a failing unit test in `tests/unit/components/standing/useLobbyList.spec.ts`:
  - it reads `/api/lobby/players` on mount and on a `presence` poke;
  - on a leaving poke it reads again after `recheckInMs`;
  - the fallback poll is 3s without a socket and 12s with one;
  - it pauses re-sorting while the table is frozen.

### Implementation

- [X] T052 [US2] Rewrite `app/api/lobby/players/route.ts` and `lib/matchmaking/profile.ts` `fetchLobbySnapshot` over `player_presence` joined with ratings and `head_to_head`. Update the unit tests that mocked the old snapshot.
- [X] T053 [P] [US2] Implement `lib/pages/lobbyRows.ts`, `formStrip.ts` and `bandMap.ts` (T047–T049).
- [ ] T054 [US2] Implement `components/standing/hooks/useLobbyList.ts` (T051). Remove the Supabase Presence half of `lib/matchmaking/presenceStore.ts`, and delete `lib/realtime/presenceChannel.ts` and `presenceChannel.polling.ts` with their tests.
- [X] T055 [US2] Implement `components/page/lobby/Lobby.tsx`, `YourBlock.tsx`, `FormStrip.tsx`, `HereNowTable.tsx` (hover and focus states, the 8-row cap, frozen order), `BandMap.tsx`, `LastMatch.tsx` and `RecentMatches.tsx`, with the desktop and phone (F2) layouts in `pages.css`. Make T050 pass.
- [X] T056 [US2] Add the lobby strings to `lib/i18n/copy/{en,is}.ts`:
  - the block's sub-lines, the form strip, the table caption and columns;
  - the statuses `hér`, `leitar`, `í viðureign · 6 af 10` and `fjarverandi`;
  - the last match, `review ▸`, the recent result words, the new-player and empty states, the `⋯` menu, and the lobby title.

  Retire the lobby strings §5 lists as replaced (`Enginn andstæðingur enn`, `No runs yet…`, raw `WIN`/`LOSS`, and so on).
- [X] T057 [US2] Render the lobby from `app/[locale]/(pages)/page.tsx` when signed in. On the server, read the players, the overview and the viewer for the first paint (SC-008). Call `enterLobbyAction` as a placeholder that always returns `same` until US7.
- [ ] T058 [US2] Add the 308 redirects for `/lobby`, `/matchmaking`, `/en/lobby` and `/en/matchmaking` to `next.config.ts`, and delete `app/[locale]/(room)/lobby/page.tsx`. Keep `app/[locale]/(room)/matchmaking/page.tsx` until US5 (the redirect wins), then delete it in T088. Add a test `tests/unit/config/redirects.spec.ts`.
- [X] T059 [US2] Add the page phases `lobby-signed-in`, `is-lobby`, `lobby-new` and `lobby-empty` (LobbyEmpty EN-L) to `app/[locale]/dev/page/fixtures.ts`, generate the baselines, and review them against the Lobby, LobbyEmpty and PhoneLobby artboards.

**Checkpoint**: The lobby page renders from real data. Challenges still go through the old invite action until US3; the old `LobbyRoomController` is no longer mounted.

---

## Phase 7: User Story 3 – Challenge someone, and see what happened (P1)

**Goal**: The composer states the stakes. Send, withdraw, a 60s TTL, the outcomes on the row and in the slot, the 60s decline cooldown, the limits, crossed challenges, and gone ending as `left`.

**Independent test**: quickstart §3. `tests/integration/db/challenges.test.ts`, `challenges.race.test.ts` and `tests/integration/ui/lobby-challenge.spec.ts` pass.

### Tests first

- [X] T060 [P] [US3] Write failing integration tests in `tests/integration/db/challenges.test.ts` for `send_challenge`:
  - `sent` records `expires_at` = +60s, withdraws the sender's other pending challenge, cancels the sender's search, and does not touch the sender's `players.status` or `lobby_presence.mode`;
  - refusals `in_match` (pending or in progress), `gone`, `away`, `other_lobby`, `self`, `busy_sender`, `cooldown` (spec 069), `declined_recently` (with `until` = decline + 60s) and `rate_limited` (the 7th in a minute);
  - `crossed` creates the match through `accept_invite`;
  - after three declines from the same recipient within 10 minutes, the next challenge is inserted `declined` with `auto_declined` and the status `sent`, for 4 hours.
- [X] T061 [P] [US3] Write failing integration tests in `tests/integration/db/challenges.lifecycle.test.ts`:
  - `withdraw_challenge` is a compare-and-set from pending, and returns `not_pending` otherwise;
  - `expire_challenges` expires past-due invites and returns both ids;
  - `accept_invite` refuses `gone` (the invite becomes `left`) and past-expiry invites;
  - `create_match_between` supersedes the other pending incoming invites and clears `unseen_result_match_id`.
- [X] T062 [P] [US3] Write a failing race test `tests/integration/db/challenges.race.test.ts`: 100 rounds of send, accept, withdraw, crossed send and queue pairing at once. It holds that a player never has two pending outgoing challenges, that no match is created with a busy or gone player, and that every invite ends in exactly one terminal status.
- [X] T063 [P] [US3] Write a failing test in `tests/unit/lib/pages/composer.spec.ts`:
  - line 2 carries the stakes from `stakesFor` and the terms from config, in both languages (one line on desktop, two on a phone);
  - line 3 appears for a running search or a pending outgoing challenge;
  - `sendDrawnAs` is secondary while a call is up.
- [X] T064 [P] [US3] Write failing component tests in `tests/unit/components/page/lobby/ComposerRow.spec.tsx`:
  - the row opens in place at 120px, and the order freezes;
  - focus moves to send;
  - Esc and `not now` close the row and return focus to its `challenge ▸`;
  - only one row is open at a time;
  - send ignores activation for 500ms after changing meaning;
  - the send errors are written on the row;
  - `again in 0:52` counts down to `challenge ▸`.
- [X] T065 [P] [US3] Write a failing unit test in `tests/unit/components/standing/useHeldOutcome.spec.ts`: a terminal status is held for 4s (400ms for `accepted`, followed by the navigation callback); a newer outcome replaces an older one; it is idempotent under repeated reads.
- [ ] T066 [US3] Write a failing Playwright spec `tests/integration/ui/lobby-challenge.spec.ts` (two players):
  - A composes and sees the stakes;
  - A sends: the slot shows the sent state with a drain, and B's row reads `sent`;
  - B declines: A sees `declined` for 4s, then `again in`, and a resend is refused;
  - after the cooldown A sends again and B accepts: both are at the table, and A is seated;
  - A withdraws a pending challenge: B's call disappears and A sees `withdrawn`;
  - crossed sends start the match with both seated.

### Implementation

- [X] T067 [US3] Add `send_challenge`, `withdraw_challenge` and `expire_challenges` to the migration, and change `accept_invite` and `create_match_between` (data-model.md). Make T060–T062 pass.
- [X] T068 [US3] Implement `lib/matchmaking/challengeService.ts`: `send`, `withdraw`, `respond`, `expire` and `settleGone`. Each is an RPC parsed by Zod, pokes per the contract, and logs `challenge.*`. Remove `sendDirectInvite`, `getOutgoingInvite` and the `mode='direct_invite'` write from `lib/matchmaking/inviteService.ts`. Add `tests/unit/lib/matchmaking/one-challenge-writer.test.ts`, which fails on any `from("match_invitations").insert/update` outside `challengeService` and the SQL.
- [X] T069 [US3] Implement the server actions `app/actions/challenge/send.ts`, `withdraw.ts` and `respond.ts` (Zod input, explicit return, session). Add `POST /api/lobby/invite/withdraw` (the beacon) in `app/api/lobby/invite/withdraw/route.ts`. Make `app/api/lobby/invite/[inviteId]/respond/route.ts` a wrapper around `respond`. Delete `app/actions/matchmaking/sendInvite.ts` (which holds both `sendInviteAction` and `respondInviteAction`) and the GET in `app/api/lobby/invite/route.ts`, together with their tests. Make T034 pass for withdraw.
- [X] T070 [US3] Set `expire_challenges` in the cron sweep (replacing T041's placeholder), and change the `PLAYTEST_INVITE_EXPIRY_SECONDS` default to 60 in `lib/match/createMatch.ts` and the env docs.
- [X] T071 [P] [US3] Implement `lib/pages/composer.ts` (T063) and `components/standing/hooks/useHeldOutcome.ts` (T065).
- [X] T072 [US3] Implement `components/page/lobby/ComposerRow.tsx` and wire it into `HereNowTable.tsx`: send, `not now`, the row's status cell (`sent · 0:52`, the outcomes, `challenges you`) and the action cell (`again in`, errors). Add the phone 176px variant (F6). Make T064 pass.
- [X] T073 [US3] Add the challenge strings to `lib/i18n/copy/{en,is}.ts`: the composer lines, the send and withdraw labels, the outcomes table, the errors, `again in`, `withdraws your challenge`, `accepted`, `Kári can't play right now`, `Kári has left · challenge withdrawn`, and the name-safe Icelandic forms.
- [ ] T074 [US3] Add the page phases `composer` (LobbyComposer EN-L) and `challenge-sent` (LobbySent: Kári sent at 0:52, Hekla `declined · again in 0:41`, no filled primary) to the fixtures, with their phone variants (PhoneComposer), and generate the baselines.

---

## Phase 8: User Story 4 – The line slot follows you (P1)

**Goal**: One standing read and one slot on every signed-in page, with the precedence call > match > switch > sent > search > empty. The cue, the title, the favicon, notifications, announcements and the skip link come with it. The old lobby room, queue room, invite poll and table check are deleted.

**Independent test**: quickstart §3.3. `tests/integration/ui/line-slot.spec.ts` passes.

### Tests first

- [X] T075 [P] [US4] Write failing tests in `tests/unit/lib/pages/standingSlot.spec.ts`:
  - every precedence pair;
  - `more` for a second call;
  - `searching` on a call;
  - the table and running match both give `match`;
  - `over` shows until opened;
  - a held outcome keeps `sent` for 4s.
- [X] T076 [P] [US4] Write failing tests in `tests/unit/lib/pages/slotLines.spec.ts`. The exact strings in both languages, for:
  - the call: with and without a record, `· +1`, and the searching suffix;
  - sent, search (0:30 alone, still searching, paused, stopped, cooldown);
  - match running, match over, switch, and the empty terms.
  
  It also checks the drains and sweeps, and that a wait's secondary is never marked focusable-first.
- [X] T077 [P] [US4] Write failing tests in `tests/unit/lib/pages/pagePrimary.spec.ts` for every row of the precedence table in contracts/page-derivations.md.
- [X] T078 [P] [US4] Write a failing test in `tests/unit/lib/room/tabTitle.pages.spec.ts` for every page beat (door, lobby, call `(1)`/`(2)`, sent, search, arrival, match running, over). While the match controller is mounted, the match titles win.
- [X] T079 [P] [US4] Write a failing contract test in `tests/contract/standing-auth.contract.test.ts`. `GET /api/standing` returns 401 without a session, and otherwise a `StandingFacts` object that parses with the Zod schema, whose `topic` equals `topicFor(viewer)`.
- [X] T080 [P] [US4] Write failing hook tests in `tests/unit/components/standing/`:
  - `usePlayerChannel.spec.ts`: it subscribes to the topic; a poke re-reads; the poll cadence is 3s while the socket is down and 12s while it is up; it never navigates on broadcast data;
  - `useStandingFacts.spec.ts`: it sends attention with each read and handles server time drift;
  - `useTabTitle.spec.ts`;
  - `useFavicon.spec.ts`: the call swaps the link's href and restores it;
  - `useNotifications.spec.ts`: feature-detected; permission requested only from an explicit opt-in; shown only while hidden; the opt-in kept in localStorage behind try/catch. `⋯ notifications · on/off` toggles the opt-in, and the item is hidden when the API is unsupported or permission is denied.
- [X] T081 [P] [US4] Write failing component tests in `tests/unit/components/page/LineSlot.spec.tsx`:
  - call style and status style;
  - the reserved height is kept on a content change (layout shift is measured in T082);
  - `role="region"` with its label;
  - polite announcements on arrival and at 10s left;
  - the skip link is the first focusable element while a call is up;
  - accept ignores activation for 500ms;
  - decline;
  - `back to the match ▸`;
  - `result ▸`.
  
  Also `BottomSlot.spec.tsx` for the phone: a 104px call, a 64px status, a 56px primary, the safe-area padding, and the primary hidden while a call is up.
- [ ] T082 [US4] Write a failing Playwright spec `tests/integration/ui/line-slot.spec.ts`:
  - B is on `/rules` with the tab hidden when A challenges: B's title becomes `(1) A challenges you · …` and the favicon swaps;
  - B returns and accepts on `/rules`: both are at the table;
  - A's sent state follows A from the lobby to `/profile`;
  - a match running while on a page shows `back to the match ▸`, and it returns to the match.
  - with a `PerformanceObserver('layout-shift')` running, cycling the slot through empty → call → sent → search → empty leaves the cumulative shift under the masthead at 0 (SC-006).

### Implementation

- [X] T083 [US4] Implement `app/api/standing/route.ts` per the contract: attention, the lazy expiry for the viewer's own invites, incoming invites with their records, outgoing, cooldowns, search, the table cooldown, the match (table, running, or `over` from `unseen_result_match_id`), `switchPending` (null until US7) and `topic`. Make T079 pass. Add `tests/perf/standing.bench.ts` for p95 under 150ms.
- [X] T084 [P] [US4] Implement `lib/pages/standingSlot.ts`, `slotLines.ts` and `pagePrimary.ts` (T075–T077), and extend `lib/room/tabTitle.ts` (T078).
- [X] T085 [US4] Implement `components/standing/hooks/usePlayerChannel.ts`, `useStandingFacts.ts`, `useTabTitle.ts`, `useFavicon.ts` and `useNotifications.ts` (T080). Wire them into `StandingProvider` with the `challenge` cue: `playChallenge` plays once per new incoming id and when a table waits in a hidden tab, respecting the toggle and the first gesture. Add the `⋯` notifications item in `components/page/PageMenu.tsx`.
- [X] T085a [P] [US4] Write a failing test in `tests/unit/components/standing/useArrivalWatch.spec.ts`:
  - opt in from an empty lobby;
  - the first poke in which another player appears plays the cue, sets the title `Embla is here · Wottle`, and shows the notification if the tab is hidden and permission is granted;
  - the opt-in then ends, and a second arrival does nothing;
  - the control reads `we will tell you · cancel` while on, and `cancel` ends it;
  - opting in again later arms it again.
- [X] T085b [US4] Implement `components/standing/hooks/useArrivalWatch.ts`, reading `useLobbyList`. Wire it into `StandingProvider` and into the empty lobby's control in `components/page/lobby/Lobby.tsx`. Add the strings `Embla is here` / `Embla er hér` and `we will tell you · cancel` / `við látum þig vita · hætta við`. Make T085a pass.
- [X] T086 [US4] Implement `components/page/LineSlot.tsx` and `components/page/BottomSlot.tsx` (T081), and mount them in `PageFrame`. Accept goes through `respond`, then `router.push(/match/:id)`. Decline goes through `respond`. `back to the match ▸` and `result ▸` push the match.
- [X] T087 [US4] Make the rest of the page follow the slot:
  - `pagePrimary` drives the lobby block's primary slot and the phone's pinned primary;
  - the challenged player's row reads `challenges you` with no action;
  - B8 removes every row's `challenge ▸` while your match runs;
  - sign-out is disabled with `finish your match first`.
- [X] T091 [P] [US4] Write a failing unit test `tests/unit/components/standing/searchInProvider.spec.ts`:
  - starting a search from the lobby runs `useMatchmaking` inside the provider;
  - it survives a page change;
  - `cancel ▸` stops it;
  - the 0:30-alone line reads correctly;
  - a pairing pushes `/match/:id`;
  - a hidden tab pauses it with the beacon (spec 069's behaviour, kept).
- [X] T092 [US4] Move `lib/room/useMatchmaking.ts`'s owner from the deleted queue controller into `StandingProvider`, exposing `startSearch` and `cancelSearch`. The lobby's primary calls `startSearch`, which withdraws the outgoing challenge through the server. Wire the Wake Lock (`useWakeLock`) while searching or while a challenge is out on a coarse pointer. Make T091 pass.
- [X] T093 [US4] Add the search strings in the slot (`Searching for an opponent · 0:07`, `2 SEARCHING NOW · ENGLISH WORDS`, `NO ONE ELSE IS SEARCHING · CHALLENGE SOMEONE BELOW`, and on a phone `LEITAR · 0:07` over `haltu skjánum opnum`), and retire the queue page's strings.
- [X] T088 [US4] After T092 (search runs in the provider), delete, together with their tests and fixtures:
  - `components/room/LobbyRoomController.tsx`, `LobbyRoomView.tsx`, `LobbyLedger.tsx`, `QueueRoomController.tsx`, `QueueRoomView.tsx` and `NameInput.tsx`;
  - `components/room/hooks/useLobbyInvites.ts` and `useTableCheck.ts`;
  - `app/[locale]/(room)/LobbyRoomPage.tsx` and `app/[locale]/(room)/matchmaking/page.tsx`;
  - the `/dev/room` phases `lobby`, `queue`, `searching-paused` and `void-queue`, and their baselines. Re-home each phase's states as page phases where the spec keeps them.
- [ ] T094 [US4] Migrate the two-player Playwright specs off `/matchmaking`. Add the helpers `findOpponent(page)`, `challenge(page, name)` and `acceptCall(page)` to `tests/integration/ui/helpers/matchmaking.ts`, and update `matchmaking.spec.ts`, `moves-flow.spec.ts`, `room-flow.spec.ts`, `reconnect-flow.spec.ts`, `match-completion.spec.ts`, `disconnect-claim.spec.ts`, `deadline-flow.spec.ts`, `table.spec.ts`, `cross-language-queue.spec.ts` and `lobby-presence.spec.ts`. Run them in chromium one file at a time. Same commit as T088; the suite must pass at this commit.

  Remove `useTableCheck` from `components/profile/ProfilePage.tsx`. Make spec 069's void slip queue action push `/` with the search running (`lib/room/tableSlip.ts`, `MatchRoomController.tsx`). Run the acceptance grep test and extend it with the deleted names.
- [ ] T089 [US4] B6: while a match's final state is shown with the slip lifted, a third-party call is the ledger's first line in live-row style, with the secondary `accept ▸` and `decline`, in the ledger's first line. It goes through a slot model `ledgerCallLine(rematch, call)`, which ranks a rematch first once stage 5 provides one; the unit test covers the call-only case. Add this to `components/room/Ledger.tsx` and the phone live row, reading the provider's standing facts. Add a unit test in `tests/unit/components/room/Ledger.call.spec.tsx`.
- [ ] T090 [US4] Add the page phases `challenge-in` (LobbyIncoming IS-T1, with the skip link shown focused), `match-running` and `match-over-away`, and a phone call-line variant (PhoneLobby). Generate the baselines. Make T082 pass.

**Checkpoint**: The MVP social loop works on every page (door → lobby → challenge → call → table).

---

## Phase 9: User Story 5 – Search from the lobby (P2)

**Goal**: The searching fixtures and the phone variant. Search itself moved into US4 (T091–T094), because deleting the queue room needs it (analysis O1, O2).

**Independent test**: quickstart §4.

- [ ] T095 [US5] Add the page phase `searching` (LobbySearching EN-L), with its phone variant, and generate the baselines.

---

## Phase 10: User Story 7 – One lobby language (P2)

**Goal**: The lobby language is stored per player. Reading a page in the other locale never moves the player. Switching, whether by the switch or by opening the other lobby directly, confirms first when something is out.

**Independent test**: quickstart §5. `tests/integration/ui/lobby-language.spec.ts` passes.

- [X] T096 [P] [US7] Write failing integration tests in `tests/integration/db/lobby-language.test.ts`:
  - `enter_lobby` returns `same`, `switched`, or `needs_confirm` with the pending list;
  - `confirm_lobby_switch` cancels the search, withdraws the outgoing challenge, ends incoming challenges as `left`, and switches;
  - heartbeats never change `lobby_language`;
  - `send_challenge` refuses `other_lobby`.
- [X] T097 [US7] Add `enter_lobby` and `confirm_lobby_switch` to the migration. Implement `lib/matchmaking/lobbyLanguage.ts` and `app/actions/lobby/{enterLobby,confirmSwitch}.ts` with pokes (T096).
- [X] T098 [US7] Replace T057's placeholder `enterLobbyAction`. On `needs_confirm` the lobby renders with find and every `challenge ▸` off. The standing read returns `switchPending`, and the slot shows `switch` (`you are in the Icelandic lobby · switching cancels your search · switch ▸` / `þú ert í íslenska lobbíinu · …`). The masthead switch shows the same consequence line first when something is out (T3). Add a unit test in `tests/unit/components/page/LanguageSwitch.spec.tsx`.
- [ ] T099 [US7] Name the language beside every rating on pages (FR-033, US7.5). Add the switch strings, and the page phase `switch-confirm`.
- [ ] T100 [US7] Write the Playwright spec `tests/integration/ui/lobby-language.spec.ts` for quickstart §5: `/en/rules` does not move the player; typing `/en` with a search out asks first; confirming switches the lists.

---

## Phase 11: User Story 8 – Leave a live match without resigning (P2)

**Goal**: Back after the first pick, and `⋯ go to the lobby`, open the leave slip. `stay ▸` is focused, and leaving keeps the match running. The opponent sees `stepped out`, and the slot shows your match.

**Independent test**: quickstart §6. `tests/integration/ui/leave-slip.spec.ts` passes.

- [X] T101 [P] [US8] Write a failing test in `tests/unit/lib/room/slip.leave.spec.ts`: the `leave` kind ranks below resign and above ready and void; the model's label is `move 4 of 10 · 3:12 left`; its headline, body, primary (`stay ▸`) and secondary; and its phone square content.
- [X] T102 [P] [US8] Write a failing hook test in `tests/unit/components/room/useLiveBackGuard.spec.ts`:
  - no guard before the first pick;
  - the first pick pushes a guard with `history.state.kind = "guard"`;
  - popstate raises the leave slip and re-pushes the guard;
  - `go to the lobby` leaves the guard and pushes `/`;
  - returning to the match replaces the guard instead of stacking one;
  - after completion the guard is disarmed and skipped;
  - `beforeunload` is armed only while the match is in progress.
- [X] T103 [P] [US8] Write failing integration tests in `tests/integration/db/stepped-out.test.ts`:
  - a page heartbeat writes `match_heartbeats (source 'page', cadence)`;
  - the loader reports `steppedOutPlayerId` while it is fresh by the presence rule, and `reconnecting` only when neither source is fresh;
  - `completeMatchInternal` sets `unseen_result_match_id` for a player whose last match heartbeat is not a fresh match source;
  - a read of the completed match clears it;
  - sign-out clears it.
- [X] T104 [US8] Implement the heartbeat source and cadence in `lib/match/heartbeatRepository.ts`. Write the page heartbeat from `app/api/presence/beat/route.ts`. Add `steppedOutPlayerId` to `lib/match/stateLoader.ts` and the `MatchState` type. Set and clear `unseen_result_match_id` in `app/actions/match/completeMatch.ts`, `app/api/match/[matchId]/state/route.ts` and `app/actions/auth/logout.ts`. Make T103 pass.
- [X] T105 [US8] Add the `stepped out` / `brá sér frá` sub-line to `lib/room/scoreboard.ts` and `components/room/Scoreboard.tsx`, with a unit test in `tests/unit/lib/room/scoreboard.steppedOut.spec.ts`.
- [X] T106 [US8] Implement `components/room/hooks/useLiveBackGuard.ts` (T102). Add the leave slip to `lib/room/slip.ts` and `components/room/Slip.tsx`, with `stay ▸` focused through `initialFocusRef`. Change `RoomMenu.tsx`'s `leave` to `go to the lobby`, which opens the leave slip. Make `confirmResign` reachable only from `⋯ resign`. Wire all of this into `MatchRoomController.tsx` (T101).
- [X] T107 [US8] Add the leave slip's strings and the `/dev/room` phase `leave` (desktop and phone, F8), and generate the baselines.
- [ ] T108 [US8] Write the Playwright spec `tests/integration/ui/leave-slip.spec.ts`:
  - after a pick, Back opens the slip with `stay ▸` focused, and Esc keeps playing;
  - `go to the lobby` leaves the match in progress, and the lobby slot reads `your match · …`;
  - the opponent's scoreboard reads `stepped out`;
  - `back to the match ▸` returns;
  - letting the clock end shows `your match is over` in the slot.

---

## Phase 12: User Story 9 – Pokes, not polls (P2)

**Goal**: Every event reaches the player's tabs as a payload-free poke. The rematch id broadcast becomes a poke, and the socket keep-alive survives background tabs.

**Independent test**: SC-001, measured in `line-slot.spec.ts` with Realtime on (the call within 1s) and with `NEXT_PUBLIC_DISABLE_REALTIME=1` (within 3s).

- [ ] T109 [P] [US9] Write a failing test in `tests/unit/lib/match/rematchBroadcast.spec.ts`: no broadcast carries `newMatchId`, and both players are poked with `rematch`. Update `tests/unit/lib/room/useRematchNegotiation.spec.ts`: on a `rematch` poke it reads the match state route and navigates only to an id from that response.
- [ ] T110 [US9] Change `lib/match/rematchBroadcast.ts`, `lib/match/rematchAnnouncements.ts` and `lib/room/useRematchNegotiation.ts` accordingly (T109). Add the `seat` and `table` pokes to `lib/match/tableService.ts` and the `match` poke to match completion, each with a unit test.
- [ ] T111 [US9] Add the timing assertions to `tests/integration/ui/line-slot.spec.ts`: with the socket up the call appears within 1s, and with `NEXT_PUBLIC_DISABLE_REALTIME=1` it appears within 3s. Add a unit test that the poll slows to 12s once the channel is joined and returns to 3s when it errors.

---

## Phase 13: Polish and cross-cutting

- [ ] T112 [P] Write the slot-overflow test `tests/integration/ui/slot-overflow.spec.ts`. It renders every fixed slot (line 1 and 2 of the slot in each style, the row status and action cells, the composer lines, the block primary, the phone bottom slot) with its longest Icelandic and English string at 1440 and 390, and fails on overflow (SC-007).
- [ ] T113 [P] Add the name-safe grep test `tests/unit/i18n/name-safe-grep.test.ts`. It fails on any Icelandic template that puts a name after eftir, gegn, til, frá, á, við or handa, and on the banned variants `klár`, `komin(n)`, `aftur tengd`, `ekki laus` and `leikur Kára`.
- [ ] T114 [P] Add a grep test `tests/unit/lib/one-service-per-rpc.test.ts`: the presence functions are called only from `lib/presence/presenceService.ts`, and the challenge functions only from `lib/matchmaking/challengeService.ts`.
- [ ] T115 [P] Amend `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` per spec §8 items 1, 3, 4, 7, 10 and 13:
  - "One field", with the three pages;
  - the slip kinds (leave; sign-in retired) and their ranking;
  - primary and focus rules;
  - the phone slip;
  - the new components (page frame, line slot, lobby block, form strip, band map, composer row, lockup, strip and cell);
  - the phone bottom slot;
  - the Icelandic glossary and the name-safe rule.
- [ ] T116 [P] Update `CLAUDE.md`:
  - the Design section (pages, the line slot, the leave slip, the marks);
  - the architecture §7 frontend flow (door → lobby → slot → table);
  - the directory structure (`(pages)`, `components/page`, `components/standing`, `lib/pages`, `lib/presence`, `lib/brand`);
  - the fixture phase list;
  - Remaining Gaps: the Icelandic (?) strings of this stage.
- [ ] T117 [P] Update `docs/design_documentation/260922-game-flow/HANDOVER.md` only if the user asks. It is the user's file, and it has an uncommitted edit.
- [ ] T118 Run the gates: `pnpm test:unit`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:check`, `pnpm test:visual`, `pnpm perf:heartbeat`, `pnpm perf:standing` and `pnpm perf:seat`. Then run the chromium Playwright specs one at a time: `door`, `presence`, `lobby-challenge`, `line-slot`, `lobby-language`, `leave-slip`, `table`, `moves-flow`, `room-flow`, `reconnect-flow`, `matchmaking`, `match-completion` and `lobby-presence`. Check each by its exit code, not by grepping. Record the results in `specs/070-door-lobby/tasks.md`.
- [ ] T119 Walk through quickstart.md §1–§6 by hand in two browsers, and note any deviation from the artboards (Lobby, LobbyEmpty, LobbyComposer, LobbySent, LobbyIncoming, LobbySearching, DoorIs, DoorEn, and the phone boards).

---

## Dependencies and order

```text
Setup (T001–T003)
  └─ Foundational (T004–T017)
       ├─ US1 door (T018–T030) ─────────────┐
       ├─ US6 presence (T031–T042) ─────────┤
       │    └─ US10 overview (T043–T046) ───┤
       │         └─ US2 lobby (T047–T059) ──┤
       │              └─ US3 challenges (T060–T074)
       │                   └─ US4 line slot + search (T075–T094)   ← deletes the lobby and queue rooms
       │                        ├─ US5 searching fixtures (T095)
       │                        ├─ US7 language (T096–T100)
       │                        ├─ US8 leave (T101–T108)
       │                        └─ US9 pokes (T109–T111)
       └─ Polish (T112–T119) after every story
```

- US1 and US6 are independent of each other after the Foundational phase.
- US5, US7, US8 and US9 are independent of each other after US4.
- US8's server half (T103–T105) can start right after US6.
- Landing: US2 to US4 go into one PR slice. Deleting the lobby room (T088) needs the line slot (T086) and the search in the provider (T092). T094 lands in the same commit as T088. Task IDs are kept; T091–T094 now sit inside US4.

## Parallel examples

- **Foundational:** T005, T006, T008–T013 (different files).
- **US1:** T018–T021 together, then T023, T025 and T029 together.
- **US6:** T031–T034 together.
- **US2:** T047–T051 together, then T053.
- **US3:** T060–T065 together, then T071.
- **US4:** T075–T081 together, then T084.
- **Across stories after US4:** T095 (US5), T096 (US7), T101–T103 (US8) and T109 (US9).
- **Polish:** T112–T116 together.

## Implementation strategy

1. **MVP:** Setup, Foundational and US1 (the door). It is visible and it ships without the lobby changing.
2. **Truthful presence:** US6 and US10. There is no visible change, but the data becomes reliable.
3. **The social loop (one slice):** US2, US3 and US4. The new lobby, challenges and the line slot replace the old rooms together.
4. **Then, independently:** US5 (search in the slot), US7 (lobby language), US8 (leave slip), US9 (pokes everywhere).
5. **Polish:** overflow, grep tests, docs and the full gates.

**Totals:** 121 tasks.

| Phase | Tasks |
|---|---|
| Setup | 3 |
| Foundational | 14 |
| US1 | 13 |
| US6 | 12 |
| US10 | 4 |
| US2 | 13 |
| US3 | 15 |
| US4 | 22 |
| US5 | 1 |
| US7 | 5 |
| US8 | 8 |
| US9 | 3 |
| Polish | 8 |
