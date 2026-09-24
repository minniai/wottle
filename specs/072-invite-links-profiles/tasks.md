# Tasks: Invite links and profiles

**Input**: Design documents from `specs/072-invite-links-profiles/`: plan.md, spec.md (Q1–Q3), research.md (R1–R16), data-model.md, contracts/routes-and-actions.md, contracts/page-derivations.md, quickstart.md.

**Tests**: Required. The constitution's principle VII (TDD) is non-negotiable, so every implementation task is preceded by a failing test.

**Organization**: One phase per user story, in the order they can land.
- Link out (US1) comes first; the invite door (US2) and the signed-in open (US3) read the links it makes.
- The sender at the table (US4) needs an accept, so it follows US2.
- The profiles (US5, US6, US7) and the rules (US8) do not depend on links and can run in parallel with US2–US4 once Foundational is done.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task).
- **[Story]**: US1–US8 from spec.md.

Fixtures used throughout: IS-T1, EN-L and IS-M from GAME_FLOW_SPEC §5.0. Strings are those in spec.md and contracts/page-derivations.md.

---

## Phase 1: Setup

- [X] T001 Add `lib/constants/links.ts`:
  - `LINK_TTL_MS = 600_000`;
  - `LINK_TOKEN_BYTES = 32`;
  - `LINK_CREATE_LIMIT = { limit: 6, windowMs: 60_000 }`;
  - `LINK_ACCEPT_LIMIT = { limit: 10, windowMs: 60_000 }`;
  - `LINK_STORAGE_KEY = "wottle-link"`.
  Each has a JSDoc naming its source (§7.1 link TTL, spec 070 FR-023).
- [X] T002 [P] Create empty module folders `lib/profile/` (keep `readHandle.ts`) and `app/actions/link/`. There are no placeholder fixture phases: each story adds its own phases with their baselines, as spec 071 did.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the migration, the link service and token, the shared types, and the extracted sign-in steps.

### Tests first

- [X] T003 Write failing integration tests for the schema in `tests/integration/db/invite-links-schema.test.ts`:
  - `match_links` has the columns and checks of data-model.md;
  - `token_hash` is unique;
  - a second `pending` link for one sender violates the partial unique index;
  - RLS is on and the anon role can't select;
  - the functions `create_link`, `read_link`, `accept_link`, `cancel_link`, `expire_links`, `best_words` and `presence_word` exist and are executable by `service_role` only.
- [X] T004 [P] Write failing integration tests for the link functions in `tests/integration/db/link.test.ts`, using two seeded players and `pnpm supabase:reset` fixtures:
  - `create_link`:
    - refuses `busy_sender` (a pending match);
    - refuses `cooldown` (two `left` voids);
    - refuses `rate_limited` (6 invitations and links in a minute);
    - withdraws a pending challenge and an earlier pending link;
    - cancels a search (`players.status` back to `available`, `queued_at` null);
    - stores `language = lobby_language`.
  - `read_link`:
    - returns `valid=false` for used, cancelled, expired and unknown hashes;
    - writes nothing (compare `xmin` before and after).
  - `accept_link`:
    - `own` when the actor is the sender;
    - `expired` past `expires_at`, marking the row `expired`;
    - `busy` when the actor has a live match, leaving the link `pending`;
    - `expired` plus `superseded` when the sender is busy;
    - `created` sets `used`, `used_by`, `match_id`, and the match's `origin='link'`, `origin_ref=link id`, `table_deadline_at = expires_at`;
    - the accepter is seated;
    - a gone sender is not refused (R10).
  - `cancel_link`: `pending` → `cancelled`, then `not_pending`.
  - `expire_links` returns and marks only overdue pending links.
- [X] T005 [P] Write failing integration tests for one outgoing challenge in `tests/integration/db/link-one-outgoing.test.ts`. A pending link becomes `withdrawn` after each of:
  - `send_challenge` by its sender;
  - `create_match_between` involving the sender (a queue pairing, and accepting someone else's challenge);
  - `sign_out_player`;
  - `confirm_lobby_switch`.
  Also: `lobby_pending` includes `'link'` while one is pending, and `send_challenge`'s rate limit counts links.
- [X] T006 [P] Write failing integration tests for the Q1 void in `tests/integration/db/link-table-void.test.ts`:
  - on a link table with only the accepter seated, `void_table(m,'left',accepter)` records `void_reason='not_seated'`, `voided_by=sender`;
  - the sender's `table_missed_at` is set;
  - `table_leave_cooldown_until(accepter)` stays null after two such leaves within 10 minutes;
  - a `left` by the sender, or on a non-link table, is unchanged (`left`, voided by the leaver).
- [X] T007 [P] Write failing integration tests for `best_words` and `presence_word` in `tests/integration/db/best-words.test.ts`:
  - distinct words, case-insensitive, each at its highest points;
  - a tie goes to the earlier match's `completed_at`;
  - void, abandoned and other-language matches are excluded;
  - `p_limit` is honoured;
  - `tiles` is returned in reading order;
  - `presence_word` returns `here`, `in_match` (with `moves_played`), `away`, `other_lobby` and `not_here`, and its JSON has no timestamp key.
- [X] T008 [P] Write failing unit tests for the token module in `tests/unit/matchmaking/linkToken.test.ts`:
  - `makeLinkToken()` returns 43 base64url characters and a 32-byte `sha256` Buffer;
  - `hashLinkToken(token)` is deterministic;
  - `parseLinkToken` rejects wrong length, padding and non-URL-safe characters (Zod), and never throws.
- [X] T009 [P] Write failing grep tests:
  - `tests/unit/matchmaking/link-one-caller.test.ts`: `create_link`, `read_link`, `accept_link`, `cancel_link` and `expire_links` appear in `.rpc(` calls only in `lib/matchmaking/linkService.ts`. Extend `tests/unit/lib/one-service-per-rpc.test.ts` if that is where the rule lives.
  - `tests/unit/matchmaking/link-cancel-everywhere.test.ts`: the latest definitions of `send_challenge`, `create_match_between`, `sign_out_player` and `confirm_lobby_switch` in `supabase/migrations/` each mention `match_links`.
- [X] T010 [P] Write failing unit tests for the extracted sign-in in `tests/unit/auth/signIn.test.ts`:
  - `signInWithName(name, language, store)` and `signInAsReturning(store)` produce the same cookies and errors as the current `loginAction` and `enterAsReturningAction`;
  - the existing `tests/unit/actions/auth/*` suites stay green unchanged.

### Implementation

- [X] T011 Write `supabase/migrations/20260927001_invite_links_profiles.sql`:
  - the `match_links` table, indexes and RLS of data-model.md;
  - `create_link`, `read_link` (`stable`), `accept_link` (R3, R8, R10), `cancel_link` and `expire_links`;
  - `best_words` (R14) and `presence_word` (R15);
  - `create or replace` of `send_challenge` (withdraw the link; the rate limit counts `match_links`), taken from its latest definition in `20260926001_result_rematch_review.sql`;
  - `create_match_between` from `20260925001_door_lobby.sql`: set both players' pending links to `withdrawn`, except `p_ref` when `p_origin='link'`;
  - `void_table` from `20260924001_the_table.sql`, with the R9 branch;
  - `sign_out_player` from `20260923004_sign_out.sql`;
  - `lobby_pending` and `confirm_lobby_switch` from `20260925001_door_lobby.sql`;
  - the `revoke`/`grant` for every function.
  Make T003–T007 pass.
- [X] T012 [P] Implement `lib/matchmaking/linkToken.ts` (`makeLinkToken`, `hashLinkToken`, `parseLinkToken`) with `node:crypto`. Makes T008 pass.
- [X] T013 [P] Add the types to `lib/types/link.ts`: `LinkStatus`, `LinkView`, `OutgoingLink`, `CreateLinkResult`, `AcceptLinkResult`, `LinkCall`. Also add `link: outgoingLinkSchema.nullable()` to `standingFactsSchema` in `lib/types/standing.ts`, with Zod schemas for each.
- [X] T014 [P] Add `lib/types/profile.ts` (`ProfileView`, `PresenceWord`, `ProfileWord`, `ProfileMatchRow`) per data-model.md.
- [X] T015 Implement `lib/matchmaking/linkService.ts` (server-only): `create(senderId, tokenHash)`, `read(tokenHash)`, `accept(tokenHash, actorId)`, `cancel(senderId, linkId)` and `expireDue()`. It maps the RPC JSON to typed results, logs `link.*` events with no token or hash (`logWriter`), and puts a `performance.mark` around `accept`. Makes T009 pass.
- [X] T016 Extract `lib/auth/signIn.ts` (`signInWithName`, `signInAsReturning`) from `app/actions/auth/login.ts` and `app/actions/auth/enterAsReturning.ts`, and make both actions call it. Makes T010 pass.
- [X] T017 Add `"link"` to `PlayerPokeKind` in `lib/realtime/pokes.ts`, and extend `withdrawOutgoing(senderId)` in `lib/matchmaking/challengeService.ts` to also cancel the sender's pending link (via `linkService.cancel` of the pending id), with a unit test in `tests/unit/matchmaking/challengeService.withdraw.test.ts`.

**Checkpoint**: the link SQL is proven by integration tests; stories can start.

---

## Phase 3: User Story 1 - Invite a friend by link (Priority: P1) 🎯 MVP

**Goal**: a signed-in player makes a single-use, 10-minute link from the lobby; it is copied and stands in the line slot until used, cancelled or expired.

**Independent Test**: sign in to an empty lobby and press `invite a friend ▸`. The clipboard holds `/c/<43 chars>`, and the slot reads `Tengill afritaður · gildir í 9:58` with `afrita aftur ▸` and `ógilda tengil ▸`.

### Tests first

- [ ] T018 [P] [US1] Write failing unit tests in `tests/unit/lib/pages/standingSlot.link.spec.ts`:
  - a pending `facts.link` gives `{kind:"link"}` below `sent` and above `search`;
  - a call, a match or a switch outranks it;
  - a held `cancelled` or `expired` outcome shows for 4s;
  - `ownLink` with no pending link gives the own-link state.
- [ ] T019 [P] [US1] Write failing unit tests in `tests/unit/lib/pages/slotLines.link.spec.ts` for every row of the link table in contracts/page-derivations.md, in both languages:
  - the countdown `9:58` from `expiresAt`;
  - `copy again ▸` when the stored link id matches, else `new link ▸`;
  - clipboard refused shows the URL on line 2;
  - a 10:00 drain;
  - no primary.
- [ ] T020 [P] [US1] Write failing unit tests in `tests/unit/lib/pages/pagePrimary.lobby.spec.ts` (`lobbyPrimary`):
  - with no other rows, `invite a friend ▸` is the primary and `find an opponent ▸` a secondary;
  - otherwise `find` is the primary and `invite` a secondary with `a link that works for 10 minutes`.
  Also in `tests/unit/lib/pages/composer.link.spec.ts`: line 3 `sending cancels your link` when a link is pending, and the find consequence `finding cancels your link`.
- [ ] T021 [P] [US1] Write failing contract tests in `tests/contract/standing-link.contract.test.ts`:
  - `GET /api/standing` returns `link` for a pending link, and for 10s after it leaves `pending`, else `null`;
  - the response never contains a token or `token_hash`.
- [ ] T022 [P] [US1] Write failing unit tests for the actions in `tests/unit/actions/link/create.test.ts` and `cancel.test.ts` (with the service mocked):
  - unauthenticated;
  - rate limited;
  - refusals mapped to the send `ErrorCode`s;
  - the URL built with `localePath` for each locale;
  - a `link` poke to the sender;
  - cancelling someone else's link is `not_pending`.

### Implementation

- [ ] T023 [US1] Implement `createLinkAction` in `app/actions/link/create.ts` and `cancelLinkAction` in `app/actions/link/cancel.ts`, per contracts/routes-and-actions.md. Makes T022 pass.
- [ ] T024 [US1] Add the `link` fact to `lib/standing/readStanding.ts` (the newest link: pending, or responded within 10s). Makes T021 pass.
- [ ] T025 [US1] Extend `SlotState` and `standingSlot` in `lib/pages/standingSlot.ts`, `slotLines` in `lib/pages/slotLines.ts` (new `SlotAction`s: `copyLink`, `newLink`, `cancelLink`, `copyOwnLink`), and `lobbyPrimary` and the composer consequence in `lib/pages/pagePrimary.ts` and `lib/pages/composer.ts`. Makes T018–T020 pass.
- [ ] T026 [P] [US1] Add the link strings to `lib/i18n/copy/pages.en.ts` and `pages.is.ts` (and `Copy` types): slot lines, outcomes, `invite a friend ▸`, `a link that works for 10 minutes`, and the consequences. Mark `// native-read` on `ógilda tengil ▸`, `tengillinn þinn fellur úr gildi` and `Tengill úti`.
- [ ] T027 [US1] Wire the link in `components/standing/useStandingMachine.ts` and `StandingProvider.tsx`:
  - `createLink()` calls the action, writes `{linkId, url, expiresAt}` to `localStorage[LINK_STORAGE_KEY]` (try/catch), and copies via `navigator.clipboard.writeText`; on refusal it sets `clipboardRefused` and, on touch devices where `navigator.share` exists, offers share;
  - `copyAgain`, `newLink` (cancel then create) and `cancelLink`;
  - storage is cleared at expiry or on any non-pending status;
  - the held outcome reuses `useHeldOutcome`.
  Unit tests go in `tests/unit/components/standing/useStandingMachine.link.spec.tsx` with fake timers and a mocked clipboard.
- [ ] T028 [US1] Render the link states in `components/page/LineSlot.tsx` (status style, 4px drain, the selectable URL fallback) and the phone bottom slot (64px). Put `invite a friend ▸` in `components/page/lobby/Lobby.tsx` / `HereNowTable.tsx` as the primary for an empty lobby and a secondary below the table otherwise, and the consequence line in `ComposerRow.tsx`. Component tests go in `tests/unit/components/page/LineSlot.link.spec.tsx`.
- [ ] T029 [US1] Add link expiry to `app/api/cron/sweep-stale-matches/route.ts` (`linkService.expireDue()`, a `link` poke per sender), with a test in `tests/unit/api/sweep.links.test.ts`.
- [ ] T030 [P] [US1] Add page fixtures `lobby-link-out`, `lobby-empty-invite` and `is-lobby-link-out` (plus a `lobby-link-refused-clipboard` state) to `app/[locale]/dev/page/fixtures.ts` and `PageFixture.tsx`, and record baselines with `pnpm test:visual --update-snapshots` for those phases only.

**Checkpoint**: links can be made, copied, cancelled and expire; nothing yet accepts them.

---

## Phase 4: User Story 2 - A friend opens the link and accepts (Priority: P1)

**Goal**: the invite door (A2) for signed-out visitors; `accept ▸` signs in and seats them at the sender's table. The GET never writes.

**Independent Test**: open a fresh link in a private window, enter a free name, press `accept ▸`. The visitor lands on the table, seated; reopening the link reads `this link has expired`.

### Tests first

- [ ] T031 [P] [US2] Write failing unit tests for `inviteDoorModel` in `tests/unit/lib/pages/inviteDoor.spec.ts`:
  - valid EN and IS band lines, `1265 · English words · link valid 9:12`;
  - the countdown reaching 0 switches to expired;
  - expired: `this link has expired`, primary `enter the lobby ▸`, no secondary and no consequence;
  - the returning state keeps the band.
- [ ] T032 [P] [US2] Write the failing contract test `tests/contract/link-get.contract.test.ts` (R4):
  - 20 GETs of `/c/<token>`, including `User-Agent: Slackbot-LinkExpanding 1.0`, `Purpose: prefetch` and `Sec-Purpose: prefetch`, leave `match_links`, `matches` and `players` unchanged, and the link stays pending;
  - the response has `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` and a `noindex` robots meta;
  - an Icelandic link under `/en/c/` returns 307 to `/c/`;
  - a malformed token renders the expired band without querying (spy).
- [ ] T033 [P] [US2] Write failing unit tests for `acceptLinkAction` in `tests/unit/actions/link/accept.test.ts`, with the service and sign-in mocked:
  - a malformed token → `expired` with no calls;
  - an invalid link → `expired` with no sign-in;
  - `name` mode with a taken name → `sign_in_failed` with `name_taken`, and `accept` is not called;
  - `name` mode succeeds → sign-in, then accept, then a redirect to `/match/:id` in the link's locale;
  - `returning` mode;
  - `session` mode unauthenticated;
  - `busy`;
  - `own` → a lobby redirect;
  - the rate limits `auth:login` and `link:accept`;
  - the pokes (`table` to both, `link` to the sender).
- [ ] T034 [P] [US2] Write failing component tests in `tests/unit/components/page/door/InviteDoor.spec.tsx`:
  - the band as a call (`--tint`, a 3px left rule, an `--opp` square);
  - column B order: band, label, input, error line, `accept ▸`, `enter the lobby instead`, consequence, here now, how it plays, `how to play ▸`;
  - the returning state (a name with a `--you` square, `not Birna? · use another name`);
  - the error line and `aria-invalid` for each door error;
  - the primary guarded for 500ms;
  - one `h1`.

### Implementation

- [ ] T035 [US2] Implement `inviteDoorModel` in `lib/pages/inviteDoor.ts`. Makes T031 pass.
- [ ] T036 [US2] Implement `acceptLinkAction` in `app/actions/link/accept.ts` per the contract (Zod input union, R5 steps). Makes T033 pass.
- [ ] T037 [US2] Build `components/page/door/InviteBand.tsx` and `InviteDoor.tsx`. They reuse `Door.tsx`'s column A, masthead and folio and `DoorForm.tsx`'s input and error line; the form posts to `acceptLinkAction` in `name` or `returning` mode; `enter the lobby instead` runs the door's normal entry, then navigates to `/{locale}?invite=<token>` (so the call stays, Story 2.5); the band ticks each second (`useNowTick`). Makes T034 pass.
- [ ] T038 [US2] Add the route `app/[locale]/(pages)/c/[token]/page.tsx`:
  - `parseLinkToken`, then `linkService.read`;
  - the locale mismatch → `redirect` to the link's locale;
  - signed in → the R7 redirects (live match → the match; otherwise `/{locale}?invite=<token>`);
  - signed out → `InviteDoor` with `readReturningPlayer`;
  - `generateMetadata` (title `Kári challenges you · Wottle`, `robots: {index:false, follow:false}`);
  - the response headers via `headers()` in `next.config` `headers()` for `/:locale?/c/:token*`.
  Check Context7 for Next.js 16 `robots` and route `headers` first. Makes T032 pass.
- [ ] T039 [P] [US2] Add the door strings to `lib/i18n/copy/pages.{en,is}.ts`:
  - band line 1 and line 2;
  - `this link has expired`, `accept ▸`, `enter the lobby instead`;
  - the consequence line;
  - the page title.
  Mark `// native-read` on `bara inn í lobbíið` and the Icelandic consequence.
- [ ] T040 [P] [US2] Add page fixtures `invite-door`, `is-invite-door`, `invite-door-expired` and `invite-door-returning`, and the phone view `phone-invite-door` (390×844, 390×664, 360×640), with baselines.
- [ ] T041 [US2] Write the Playwright spec `tests/integration/ui/invite-link-flow.spec.ts` (tagged `@two-player-playtest`, part 1):
  - A makes a link and B (a fresh context) opens it, sees the band, enters a free name and accepts;
  - B lands on `/match/:id` seated;
  - B reopens the link and sees the expired band;
  - a taken name shows the error and the link stays usable.

**Checkpoint**: a friend with no account can accept a link.

---

## Phase 5: User Story 3 - A signed-in player opens a link (Priority: P1)

**Goal**: a signed-in visitor lands in the lobby with the link's call in the slot. The sender sees their own link. A busy player goes to their match.

**Independent Test**: signed in, open someone else's link. The URL is `/`, the slot shows `Hekla invites you by link · accept ▸`, and accept seats you at Hekla's table.

### Tests first

- [ ] T042 [P] [US3] Write failing unit tests in `tests/unit/lib/pages/standingSlot.linkCall.spec.ts`:
  - `linkCall` is a call (precedence 1) after challenge calls, and `more` counts it;
  - line 1 `Hekla invites you by link` / `Hekla býður þér með tengli`;
  - line 2 `1250 · English words · link valid 9:12`;
  - `accept ▸` is the page primary;
  - it drops at `expiresAt`;
  - the own-link state is `this is your link` / `valid 9:12` / `copy ▸`.
- [ ] T043 [P] [US3] Write failing tests for the lobby page's `?invite` handling in `tests/unit/app/lobbyInvite.test.ts`:
  - a valid token yields `linkCall`;
  - the sender's own token yields `ownLink`;
  - an invalid token yields neither;
  - `read_link` is the only call (no writes).
  In `tests/unit/components/standing/StandingProvider.invite.spec.tsx`: the param is stripped with `replaceState`; the call survives client navigation to `/profile` and back; dismiss removes it.

### Implementation

- [ ] T044 [US3] Read `searchParams.invite` in `app/[locale]/(pages)/page.tsx` via `linkService.read`, and pass `linkCall` / `ownLink` into `LobbyPage` → `StandingProvider` (a new `seedLinkCall` API). Makes T043's page half pass.
- [ ] T045 [US3] Hold `linkCall` and `ownLink` in `useStandingMachine` state (per tab, dropped at expiry or on dismiss), feed them to `standingSlot`, and wire the call's `accept ▸` to `acceptLinkAction({ token, mode: "session" })` with `useActivationGuard`, navigating on `created` and showing a held `this link has expired` outcome on `expired`. Makes T042 and T043 pass.
- [ ] T046 [P] [US3] Add the call and own-link strings to `lib/i18n/copy/pages.{en,is}.ts`, and render the call in `components/page/LineSlot.tsx` (call style, 104px on phones, a drain to expiry).
- [ ] T047 [P] [US3] Add page fixtures `lobby-link-call`, `is-lobby-link-call` and `lobby-own-link`, with baselines.
- [ ] T048 [US3] Extend `tests/integration/ui/invite-link-flow.spec.ts` (part 2):
  - B, signed in, opens A's link: the URL becomes `/`, the call shows, and accept goes to the table;
  - A opens its own link and sees `this is your link · copy ▸`;
  - an Icelandic link under `/en/c/` redirects to `/c/`.

**Checkpoint**: links work for new and returning players.

---

## Phase 6: User Story 4 - The sender is brought to the table (Priority: P1)

**Goal**: when a friend accepts, the sender's tab reaches the table with cue, title and notification. The table waits until the link's expiry; the friend may leave without a cooldown (Q1).

**Independent Test**: make a link, hide the tab, accept from a second browser. The first tab plays the cue and changes its title, and `ready ▸` within the link's time starts the match.

### Tests first

- [ ] T049 [P] [US4] Write failing unit tests in `tests/unit/lib/room/tableSlip.link.spec.ts`:
  - `origin: "link"`, the viewer seated and the other seat empty → label `THE TABLE WAITS · 9:12` / `BORÐIÐ BÍÐUR · 9:12`, counting to `deadlineAt`;
  - otherwise the existing `OPPONENT FOUND · 0:14` is unchanged.
- [ ] T050 [P] [US4] Write failing unit tests in `tests/unit/components/standing/useNotifications.link.spec.tsx`:
  - a transition from slot `link` (pending) to a match fact whose table origin is `link` fires the `challenge` cue once, sets the title, and calls `Notification` when hidden and permission is granted;
  - it does not fire for a queue table.
- [ ] T051 [P] [US4] Write the failing race test `tests/integration/db/link.race.test.ts`:
  - 100 rounds of two concurrent `accept_link` calls by two different players on one fresh link: exactly one `created` and one `expired` each round, and one match;
  - plus 20 rounds of one player's double accept.

### Implementation

- [ ] T052 [US4] Extend `readySlipModel` in `lib/room/tableSlip.ts` for link tables, and add the copy keys (`BORÐIÐ BÍÐUR` marked `// native-read`). Makes T049 pass.
- [ ] T053 [US4] Detect "link opened" in `components/standing/hooks/useNotifications.ts` (and the cue in the standing machine), per R12. Makes T050 pass.
- [ ] T054 [US4] Confirm the push: the sender's `useTableCheck` and the `table` poke route them to `/match/:id` on a link table. Add a regression unit test in `tests/unit/components/room/hooks/useTableCheck.link.spec.tsx` if the origin filter excludes `link`, and fix it.
- [ ] T055 [P] [US4] Add the room fixture `table-link-waits` (the friend seated, the sender absent, 9:12 left) to `app/[locale]/dev/room/fixtures.ts`, with baselines.
- [ ] T056 [US4] Extend `tests/integration/ui/invite-link-flow.spec.ts` (part 3):
  - A's tab is hidden (`page.evaluate` to dispatch `visibilitychange`), B accepts, A's title changes and A reaches the table, presses `ready ▸`, and the match starts;
  - in a second run, A closes the tab, B sees `THE TABLE WAITS`, presses `leave`, and can start a search at once (no cooldown line).
- [ ] T057 [US4] Add `scripts/perf/link-accept.ts` and `pnpm perf:link-accept` in `package.json` (100 accepts on a local Supabase; assert p95 < 200ms, following `perf:seat`).

**Checkpoint**: the whole link flow works end to end (the P1 set).

---

## Phase 7: User Story 5 - Your own profile (Priority: P2)

**Goal**: E1 on the page frame: the rating in this language, sub-lines, the 30-day chart, the form strip, the record, best words, recent matches, the other-language link and sign out.

**Independent Test**: open `/profile` with IS-T1. It shows `Birna 1212`, the sub-lines, the chart, the form `S S T S T S S T S S`, the record `20 · 15 · 0 · 57%`, HESTAR 32, BORÐA 29, SKÍRN 24, and eight recent matches.

### Tests first

- [ ] T058 [P] [US5] Write failing unit tests for the derivations in `tests/unit/lib/profile/`:
  - `profileHeader.spec.ts`: EN and IS sub-lines; the month from `firstPlayedAt`; the week clause dropped at 0; `−` U+2212; the new-player line;
  - `record.spec.ts`: `57%` for 20/35 and `—` at 0;
  - `weekChange.spec.ts`: current minus the last `rating_after` before now − 7d, or the first `rating_before` in the window;
  - `chartSeries.spec.ts`: the first point at the window start, one point per match, `empty` with a flat line, ticks;
  - `bestWordStrips.spec.ts`: 40px and 32px cells, letter values from the language pack.
- [ ] T059 [P] [US5] Write failing integration tests for `readProfile` in `tests/integration/db/readProfile.test.ts`:
  - the IS-T1 seed gives the expected `ProfileView`;
  - void and abandoned matches are excluded;
  - the other-language summary;
  - a new player.
  In `tests/unit/types/profile-view-allowlist.test.ts`: the keys of a built `ProfileView` equal an allow-list with no `lastSeen*`, `status` or `avatarUrl`.
- [ ] T060 [P] [US5] Write failing component tests in `tests/unit/components/profile/ProfileOwnPage.spec.tsx`:
  - column A order;
  - the name `h1`;
  - the rating in `--you`;
  - the form strip reused from `components/page/lobby/FormStrip.tsx`;
  - the record cells;
  - three `WordStrip`s with `--you` bands;
  - column B: primary `find an opponent ▸`, eight rows with `review ▸` → `/match/:id?review=last`, the other-language link or its empty line, and sign out with the lobby's consequence line (disabled in a live match);
  - with a call in the slot, find is a secondary;
  - the folio `ORÐUSTA · PRÓFÍLL · BIRNA`.

### Implementation

- [ ] T061 [US5] Implement the pure modules in `lib/profile/`: `profileHeader.ts`, `record.ts`, `weekChange.ts`, `chartSeries.ts` and `bestWordStrips.ts`. Makes T058 pass.
- [ ] T062 [US5] Implement `lib/profile/readProfile.ts` (server-only; parallel queries per R13, `best_words` via `linkService`'s sibling `profileRepository` or a direct `.rpc` in `lib/profile/profileRepository.ts`), returning `ProfileView`. Makes T059 pass.
- [ ] T063 [US5] Build `components/profile/ProfileHeader.tsx`, `RecordRow.tsx`, `WordStrip.tsx`, `ProfileChart.tsx` (reworked from `ProfileRatingChart.tsx`: one 1.5px polyline, 708×200 desktop and 358×140 phone, with `30 DAYS AGO` / `TODAY` labels, the flat empty state and a `role="img"` label), `ProfileMatches.tsx` and `ProfileOwnPage.tsx`. Makes T060 pass.
- [ ] T064 [US5] Rewrite `app/[locale]/(pages)/(framed)/profile/page.tsx` to `readProfile(..., { mode: "own" })` → `ProfileOwnPage`, with the signed-out redirect to `/{locale}?next=/profile` and the tab title. Retire `components/profile/ProfilePage.tsx`, `ProfileRatingChart.tsx`, `deriveProfileChartData.ts`, `app/actions/player/getPlayerProfile.ts`, `getBestWords.ts` and the `PlayerProfile` / `BestWord` / `RatingHistoryEntry` types once nothing imports them (grep, and update or remove their tests).
- [ ] T065 [P] [US5] Add the profile strings (sub-lines, labels, best words, recent matches, results, empty lines, folio) to `lib/i18n/copy/pages.{en,is}.ts`.
- [ ] T066 [P] [US5] Add page fixtures `profile-own`, `is-profile-own`, `profile-own-new` and `profile-own-call` (Embla's call), and the phone view `phone-profile` (390×844, 390×664, 360×640), with baselines. On the phone the name is Zilla 32, the rating on its own line, the sub-lines on two lines, the record in mono 28, 32px strips, and the primary pinned (F9).

**Checkpoint**: the own profile is complete on desktop and phone.

---

## Phase 8: User Story 6 - Another player's profile and challenge ▸ (Priority: P2)

**Goal**: E2 in the owner's seat colour, a presence word (never a time), `challenge ▸` with the stakes, the composer in column B, sent and outcomes, and your matches with them.

**Independent Test**: with EN-L, open `/en/profile/k%C3%A1ri`. It shows `Kári 1265` in terracotta, `HERE NOW`, `CHALLENGE ▸`, and `english words · win +7 · draw −1 · loss −9`; sending shows `sent · 0:4x` and `withdraw ▸`.

### Tests first

- [ ] T067 [P] [US6] Write failing unit tests:
  - `tests/unit/lib/profile/presenceLine.spec.ts`: each state in both languages (`in a match · 6 of 10`, `in the Icelandic lobby` / `í enska lobbíinu`), and no digit sequence that looks like a time other than `n of 10`.
  - `tests/unit/lib/profile/publicPrimary.spec.ts`:
    - here → `challenge` with stakes from `calculateElo` (EN-L: `win +7 · draw −1 · loss −9`);
    - a pending challenge to them → `sent · 0:41`;
    - cooldown, silenced and rate-limited → `closed` with the lobby row's wording;
    - in a match, away, other lobby or not here → `closed` with a null reason;
    - signed out → `enterLobby`.
- [ ] T068 [P] [US6] Write failing component tests in `tests/unit/components/profile/ProfilePublicPage.spec.tsx`:
  - the seat colours via `getSeatColors` (name and rating `--opp`, chart and win bars `--opp`, word letters `--opp`, numerals `--opp-text`);
  - the presence line;
  - the one primary `CHALLENGE ▸` with stakes beneath;
  - `challenge ▸` opens the composer in column B (send focused, Esc and `not now` return focus, the send guarded for 500ms);
  - sent state in the primary slot;
  - `YOUR MATCHES` rows with date, score, result and `review ▸`;
  - no head-to-head block, no block, no report.
- [ ] T069 [P] [US6] Write the failing contract test `tests/contract/profile-no-last-seen.contract.test.ts`: the HTML plus RSC payload of `/profile` and `/profile/<handle>` (signed in and out) contains no `last_seen`, `lastSeen` or `last_seen_at`, and `presence_word`'s JSON has no timestamp.

### Implementation

- [ ] T070 [US6] Implement `lib/profile/presenceLine.ts` and `lib/profile/publicPrimary.ts` (reusing `composerModel`, `rowOverlays` and `challengesClosed`). Makes T067 pass.
- [ ] T071 [US6] Extend `readProfile` with `mode: "public"`: `presence_word` for players outside this lobby, and `matchesList` = the viewer's matches against the owner in this language (completed, non-void, newest first, up to 8).
- [ ] T072 [US6] Build `components/profile/PresenceLine.tsx` and `ProfilePublicPage.tsx`. Presence and challengeability come from `useLobbyList` when the owner is in this lobby (live), else from the server `PresenceWord`. Column B holds the primary slot, the composer adapted from `components/page/lobby/ComposerRow.tsx` into a column-B variant (`ComposerPanel`), and `ProfileMatches` in `vs` mode. Makes T068 pass.
- [ ] T073 [US6] Rewrite `app/[locale]/(pages)/(framed)/profile/[handle]/page.tsx`:
  - the self redirect to `/profile`;
  - `readProfile(..., { mode: "public", viewerId })`;
  - a 404 with `no player by that name` (`notFound()` plus a `not-found.tsx` in the page frame);
  - the title.
  Retire `app/actions/player/getPlayerProfileByHandle.ts`. Makes T069 pass.
- [ ] T074 [P] [US6] Add the strings: presence words, stakes, `YOUR MATCHES` / `ÞÍNAR VIÐUREIGNIR`, `sent · 0:41`. Mark `// native-read` on `fjarverandi` and `í enska lobbíinu`.
- [ ] T075 [P] [US6] Add page fixtures `profile-public`, `profile-public-sent`, `profile-public-in-match`, `profile-public-away` and `is-profile-public`, and the phone view `phone-profile-public` (the pinned `skora á ▸` with stakes above), with baselines.
- [ ] T076 [US6] Write the Playwright spec `tests/integration/ui/profile.spec.ts` (part 1): the own profile renders; from the English lobby, click a name; `CHALLENGE ▸`; `send challenge ▸`; the sent state and `withdraw ▸`; the other browser's slot shows the call.

**Checkpoint**: challenging from a profile works.

---

## Phase 9: User Story 7 - Profiles for anyone, and handles in URLs (Priority: P3)

**Goal**: signed-out visitors can read public profiles; handles resolve encoded or not; unknown handles 404.

**Independent Test**: signed out, open `/profile/k%C3%A1ri`. Kári's page renders in `--you`, with presence, no stakes, and `enter the lobby ▸` returning to the profile after entry.

- [ ] T077 [P] [US7] Write failing unit tests in `tests/unit/lib/profile/readHandle.spec.ts`:
  - `k%C3%A1ri`, `kári` and `KÁRI` (NFC and NFD) resolve alike;
  - a double-encoded handle does not;
  - the link builder `profilePath(locale, handle)` percent-encodes.
  Extend `tests/unit/styles/locale-links-grep.test.ts` if new link sites are added.
- [ ] T078 [US7] Implement the handle normalisation in `lib/profile/readHandle.ts` and a `profilePath` helper in `lib/i18n/locales.ts`, used by `HereNowTable`, `ProfileMatches`, the masthead and the recent-match rows. Makes T077 pass.
- [ ] T079 [US7] Handle the signed-out case in `ProfilePublicPage` (the owner in `--you`, no stakes, primary `enter the lobby ▸` → `/{locale}?next=/profile/<handle>`), and add the fixtures `profile-public-signed-out` and `profile-missing`, with baselines.
- [ ] T080 [US7] Extend `tests/integration/ui/profile.spec.ts` (part 2):
  - signed out, a public profile renders, and `enter the lobby ▸` then entering returns to it;
  - `/profile` signed out redirects to the door with `?next`;
  - the viewer's own handle redirects to `/profile`;
  - an unknown handle returns 404 with the text.

---

## Phase 10: User Story 8 - The rules, from every page, and the review link (Priority: P3)

**Goal**: `/rules` in the page frame with its primary chosen by state; `how to play ▸` on every page; the review `⋯` gains `copy link ▸` (Q3).

**Independent Test**: follow `how to play ▸` from each page. Each reaches `/rules`; from a match it opens a new tab whose primary `close this tab ▸` closes it.

- [ ] T081 [P] [US8] Write failing unit tests in `tests/unit/lib/pages/pagePrimary.rules.spec.ts` (`rulesPrimary`):
  - a call → `accept ▸`;
  - `from` → `close this tab ▸`;
  - signed in and empty → `find an opponent ▸`;
  - signed out → `enter the lobby ▸`.
  In `tests/unit/auth/nextParam.rules.spec.ts`: `from` accepts only same-origin `/match/<uuid>` paths in either locale.
- [ ] T082 [P] [US8] Write failing component tests:
  - `tests/unit/components/room/RoomMenu.rules.spec.tsx`: the match `⋯` rules link carries `?from=<match path>` and `target="_blank"`, and the review variant has `copy link ▸`, which writes `origin + /match/:id?review=last` (locale-aware) and shows `link copied` for 2s;
  - `tests/unit/components/page/PageMenu.rules.spec.tsx`: the phone `⋯` has `how to play ▸`;
  - `tests/unit/components/page/Masthead.rules.spec.tsx`: on `/rules`, `how to play ▸` has `aria-current="page"`.
- [ ] T083 [US8] Implement `rulesPrimary` in `lib/pages/pagePrimary.ts` and extend `lib/auth/nextParam.ts`. Makes T081 pass.
- [ ] T084 [US8] Rewrite `app/[locale]/(pages)/(framed)/rules/page.tsx`:
  - the content inside the frame, with the old `rules__header` and `rules__footer` links removed;
  - the primary from `rulesPrimary`;
  - `close this tab ▸` as a client component calling `window.close()` with a 150ms fallback `router.push(from)`.
  Update `app/styles/rules.css`.
- [ ] T085 [US8] Update `components/room/RoomMenu.tsx` (rules `?from`, the review `copy link ▸`), `components/page/PageMenu.tsx` (`how to play ▸`) and `components/page/Masthead.tsx` (`aria-current`). Makes T082 pass.
- [ ] T086 [P] [US8] Fix `components/rules/content/en.tsx` and `is.tsx`: the `10moves` typo, and the clock line describing today's clock (it darkens under a minute and counts the last 15 seconds in words; nothing flashes). Add a unit test that renders both and asserts no `10moves` and no `flash`/`blikk`.
- [ ] T087 [P] [US8] Add the strings `close this tab ▸` / `loka flipanum ▸`, `copy link ▸` / `afrita tengil ▸` and `link copied` / `tengill afritaður`. Add fixtures `rules`, `is-rules`, `rules-from-match` and the room phase `review-copy-link`, with baselines.
- [ ] T088 [US8] Write the Playwright spec `tests/integration/ui/rules-links.spec.ts`:
  - `how to play ▸` reaches `/rules` (or `/en/rules`) from the door, the invite door, the lobby, both profiles, the phone `⋯`, and the match `⋯` (a new tab, the match tab's URL unchanged);
  - the new tab's `close this tab ▸` closes it.

---

## Phase 11: Polish and cross-cutting

- [ ] T089 [P] Extend `tests/integration/ui/slot-overflow.spec.ts` with every new slot, band, presence and stakes string in both languages at 1440 and 390, and fix any overflow in the copy.
- [ ] T090 [P] Extend the copy-parity and name-safe tests (`tests/unit/i18n/*`) to the new keys, and list every new `// native-read` string in CLAUDE.md's remaining gaps.
- [ ] T091 [P] Add axe checks for `/c/<token>` (valid, expired), `/profile`, `/profile/<handle>` (signed in, out) and `/rules` at 1440×900 and 390×844 in both languages, in `tests/integration/ui/pages-a11y.spec.ts`.
- [ ] T092 [P] Update `docs/prd_and_requirements/wottle_game_rules.md` §12 (rows for the invite link, the link table's wait, and the profile's facts) and `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` (word strip, profile layout, link slot states, the invite band).
- [ ] T093 Update `CLAUDE.md`:
  - the spec 072 paragraph (links, profiles, rules);
  - the page fixture list;
  - `perf:link-accept` in Performance Testing;
  - the retired profile modules removed from the directory map.
  Then run `pnpm docs:check`.
- [ ] T094 Run the gates in quickstart.md: lint, typecheck, unit, the integration db suites, the Playwright specs one file at a time, `pnpm test:visual`, `perf:link-accept`, `docs:check` and `guard:no-service-role`. Record the results under "Notes from implementation" in this file.
- [ ] T095 Walk quickstart.md steps 1–13 by hand in two browsers and note any deviation.

---

## Dependencies and execution order

- **Setup (T001–T002)** comes first.
- **Foundational (T003–T017)** blocks every story. Within it, the tests (T003–T010) come before T011–T017. T011 is one file, so it is done in one go.
- **US1 (T018–T030)** needs Foundational.
- **US2 (T031–T041)** needs US1's `createLinkAction` for its Playwright spec only; its units can start after Foundational.
- **US3 (T042–T048)** needs US2's route (T038) and accept action (T036).
- **US4 (T049–T057)** needs US2 (an accept).
- **US5 (T058–T066)** needs Foundational only (types, `best_words`), so it can run beside US1–US4.
- **US6 (T067–T076)** needs US5's components and `readProfile`.
- **US7 (T077–T080)** needs US6.
- **US8 (T081–T088)** needs Foundational only.
- **Polish (T089–T095)** comes last.

## Parallel examples

- **Foundational:** T004, T005, T006, T007, T008, T009 and T010 together; then T012, T013 and T014 beside T011.
- **US1:** T018–T022 together; then T026 and T030 beside T023–T025.
- **US2:** T031–T034 together; T039 and T040 beside T035–T038.
- **Across stories:** after Foundational, one developer takes US1 → US2 → US3 → US4 while another takes US5 → US6 → US7, and US8 fits anywhere.

## Implementation strategy

1. **MVP:** Setup, Foundational, US1 and US2. A player can invite a new friend, and the friend can accept. This fills an empty lobby.
2. **Increment 2:** US3 and US4 (returning players; the sender brought to the table; the race test and perf).
3. **Increment 3:** US5 and US6 (profiles and challenge from a profile).
4. **Increment 4:** US7, US8 and polish.

Commit each passing test separately (`test(072): …`, then `feat(072): …`), per CLAUDE.md.

## Notes from implementation

(Filled in by T094.)
