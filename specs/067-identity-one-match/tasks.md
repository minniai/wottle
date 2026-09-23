# Tasks: Identity, and one commitment at a time

**Input**: `specs/067-identity-one-match/` — plan.md, spec.md, research.md (R1–R11), data-model.md, contracts/actions.md, contracts/sql-functions.md, quickstart.md
**Tests**: REQUIRED. TDD is mandatory for this repo (constitution VII): every test task is written first and must fail (Red) before its implementation task runs.
**Commits**: one conventional commit per green test (`test(auth): …`, `feat(match): …`), ending with the attribution line.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 as in spec.md
- The migration is split into four files so each story's SQL lands with its story: `…001_identity_columns.sql` (Phase 2), `…002_match_creation.sql` (US5), `…003_claim.sql` (US2), `…004_sign_out.sql` (US4). Together they are the one migration of data-model.md.

---

## Phase 1: Setup

- [X] T001 Add `WOTTLE_SESSION_SECRET` generation to `scripts/supabase/quickstart.sh`. Inside the existing `sync_env_values`, write `openssl rand -base64 48` only when the key is absent from `$ENV_FILE`. Never overwrite an existing value.
- [X] T002 [P] Add `WOTTLE_SESSION_SECRET` (a fixed 48-byte base64 test value) to every job env block in `.github/workflows/ci.yml` that sets `PLAYTEST_SESSION_SECRET`/`SUPABASE_SERVICE_ROLE_KEY`. Include the Playwright server start near line 485.
- [X] T003 [P] Add `WOTTLE_SESSION_SECRET` to the Vitest setup env (`vitest.config.ts` `test.env` or the existing setup file) so unit tests get a deterministic secret.

---

## Phase 2: Foundational (blocks every story)

- [X] T003a Write the failing `tests/integration/db/identity-columns.test.ts`. It asserts that `players.claim_hash`, `claimed_at`, `last_entered_at` and `players_claim_hash_idx` exist; that `matches.origin` rejects values outside the six origins; that `match_invitations` and `rematch_requests` accept `withdrawn` and `superseded`; and that a stale sender (`status='matchmaking'`, `queue_language` null) is `available` after the migration.
- [X] T004 Write `supabase/migrations/20260923001_identity_columns.sql` (T003a turns green):
  - `players`: add `claim_hash text`, `claimed_at timestamptz`, `last_entered_at timestamptz`, and index `players_claim_hash_idx (claim_hash, last_entered_at desc) where claim_hash is not null`.
  - `matches`: add `origin text` with a check on the six origins, and `origin_ref uuid`.
  - `match_invitations` and `rematch_requests`: widen the status checks by drop + add constraint, adding `withdrawn` and `superseded`.
  - `update public.players set status = 'available' where status = 'matchmaking' and queue_language is null` (senders stranded by the old `sendDirectInvite`).
  Follow the header and comment style of `20260922001_match_language.sql`.
- [X] T005 [P] Write the failing tests `tests/unit/auth/sessionToken.test.ts`:
  - sign → verify round-trip;
  - one changed character in the payload or the mac → `bad_mac`;
  - the old base64-JSON format → `legacy`;
  - `expiresAt` in the past → `expired`;
  - garbage → `malformed`;
  - the mac is compared with `timingSafeEqual` (a spy on `crypto`).
- [X] T006 [P] Write the failing tests `tests/unit/auth/sessionSecret.test.ts`: a missing secret throws `SessionSecretMissingError`; a secret shorter than 32 decoded bytes throws when `NODE_ENV=production`; a valid secret returns a `Buffer`.
- [X] T007 [P] Write the failing tests `tests/unit/auth/deviceKey.test.ts`: `newDeviceKey()` is 43 base64url characters (32 bytes) and unique across 1,000 calls; `hashDeviceKey` is 64-hex SHA-256 and deterministic.
- [X] T008 [P] Implement `lib/auth/sessionToken.ts` per research R1 (`import "server-only"`):
  - `SessionPayload` zod schema `{playerId uuid, username, displayName, issuedAt, expiresAt}`;
  - `signSession(payload, secret): string` → `v1.<b64url json>.<b64url hmac>`;
  - `verifySession(value, secret, now): SessionVerification`.
  T005 turns green.
- [X] T009 [P] Implement `lib/auth/sessionSecret.ts` (`requireSessionSecret(): Buffer`, `SessionSecretMissingError`) so that T006 passes.
- [X] T010 [P] Implement `lib/auth/deviceKey.ts` (`newDeviceKey`, `hashDeviceKey`) so that T007 passes.
- [X] T011 [P] Implement `lib/auth/cookies.ts`:
  - the names `SESSION_COOKIE_NAME` (moved from `lib/matchmaking/profile.ts`, re-exported there for existing importers), `DEVICE_COOKIE_NAME = "wottle-device"` and `SIGNED_OUT_COOKIE_NAME = "wottle-signed-out"`;
  - option builders `sessionCookieOptions()` (4h), `deviceCookieOptions()` and `signedOutCookieOptions()` (1 year), all httpOnly, `sameSite: "lax"`, and `secure` from the existing `shouldUseSecureCookies()` (move it here).
- [X] T012 [P] Write the failing guard test `tests/unit/auth/server-only-guard.test.ts`: it greps every file containing `"use client"` under `components/`, `lib/`, `app/`, and fails if any imports from `@/lib/auth/`.

**Checkpoint**: the primitives are green. No behaviour has changed yet.

---

## Phase 3: User Story 1 — My session cannot be forged (P1) 🎯 MVP

**Goal**: only a server-issued, signed, unexpired session identifies a player.
**Independent test**: sign in, alter or fabricate `wottle-playtest-session`, reload: the sign-in slip; every action or route answers as unauthenticated.

- [X] T013 [US1] Write the failing tests `tests/unit/lib/matchmaking/session.test.ts` for `readLobbySession`:
  - a valid signed cookie returns `{player:{id,username,displayName}, issuedAt, expiresAt}`;
  - a tampered, legacy, expired or missing cookie returns null;
  - it logs `auth.session.rejected` with the reason, sampling `legacy` 1 in 10.
  Mock `next/headers` `cookies()` as the existing `tests/unit/app/actions/auth/logout.test.ts` does.
- [X] T014 [US1] Rewrite `readLobbySession` and `persistLobbySession` in `lib/matchmaking/profile.ts`:
  - reading goes through `verifySession(requireSessionSecret())`;
  - writing through `signSession` with the options from `lib/auth/cookies.ts`;
  - `LobbySession` narrows to `{ player: { id, username, displayName }, issuedAt, expiresAt }`;
  - delete `encodeSession`/`decodeSession` and the old `sessionSchema`, and drop `sessionToken` from `LoginResult`.
  T013 turns green.
- [X] T015 [US1] Fix every compile error from the narrowed `LobbySession`. `pnpm typecheck` lists them. Callers that used `session.player.status|avatarUrl|lastSeenAt|eloRating` read the player row instead, or the store.
  Candidates:
  - `app/[locale]/(room)/layout.tsx` (viewer seed)
  - `app/actions/auth/login.ts` (`viewerInLanguage`)
  - `app/actions/player/getPlayerProfile.ts`
  - `app/api/lobby/presence/route.ts`
- [X] T016 [P] [US1] Remove `sessionToken` from the result of `app/actions/auth/login.ts` and from `app/api/auth/login/route.ts`. Update `tests/unit/app/actions/auth/login.test.ts` and `tests/contract/post-login.contract.test.ts` to assert it is absent.
- [X] T017 [US1] Write the failing, table-driven contract test `tests/contract/forged-session.contract.test.ts` over every route handler that calls `readLobbySession`: `api/match/[matchId]/{state,words,disconnect}`, `api/match/{active,start}`, `api/lobby/invite`, `api/lobby/invite/[inviteId]/respond`, `api/lobby/presence`. For each: a legacy base64 cookie → 401; one flipped character → 401; a valid signed cookie → not 401. Add a unit test that sends a forged cookie through the real `readLobbySession` into `submitMove`, `sendInviteAction`, `startQueueAction` and `resignMatch` and expects the unauthenticated result (SC-001).
- [X] T018 [US1] Make T017 green. Any route that decodes on its own or trusts a header instead of `readLobbySession` is changed to call it. The survey found none, so this should only need the test.
- [X] T019 [US1] Run `pnpm test:unit`, `pnpm typecheck` and `pnpm lint`, and fix any remaining unit test that built a session object with the old shape (they `vi.mock` `readLobbySession`; update the mocked return shape).

**Checkpoint**: sessions are unforgeable. Every player is signed out once and signs in again as today (no claim yet).

---

## Phase 4: User Story 5 — One match at a time, whichever way in (P1)

**Goal**: every match is created by `create_match_between` under row locks, and a player never holds two live matches.
**Independent test**: Birna is in a match with Kári, and Embla accepts Birna's older challenge → `Birna can't play right now` and no new match row. Concurrent accepts for one pair → exactly one match.

### Tests (write first, Red)

- [X] T020 [P] [US5] Write the failing `tests/integration/db/create-match-between.test.ts` (local Supabase, with `tests/integration/db/harness.ts`):
  - `created` sets both players `in_match` with `queue_language` null, sets presence mode `auto`, withdraws each player's other pending outgoing invites and rematch requests, and supersedes the incoming ones, all except `p_ref`;
  - `busy` names the busy player and writes nothing;
  - `invalid` for the same player twice, an unknown player, a bad language or a bad origin;
  - `origin` and `origin_ref` are stored.
- [X] T021 [P] [US5] Write the failing `tests/integration/db/accept-invite.test.ts`:
  - pending → `created` with `match_id` set;
  - a second accept → `not_pending`;
  - a stranger → `not_recipient`;
  - past the TTL → `expired` with the status written;
  - sender busy → `busy`, the invite `superseded`, no match;
  - accepter busy → `busy`, the invite still `pending`;
  - `crossed_challenge` origin stored.
- [X] T022 [P] [US5] Write the failing `tests/integration/db/accept-rematch.test.ts`:
  - pending → `created` with `new_match_id` and `rematch_of` set;
  - older than 30s → `expired`, but not when crossed;
  - the old match not `completed` → refused;
  - either player busy → `busy`, the request still pending.
- [X] T023 [P] [US5] Write the failing `tests/integration/db/pair-from-queue.test.ts`:
  - both `matchmaking` in the language → `created`;
  - the opponent has cancelled, or is in another language → `not_searching`;
  - the opponent was just booked → `busy`.
- [X] T024 [US5] Write the failing race test `tests/integration/db/match-creation.race.test.ts` (SC-004). Over at least 100 rounds, seed players A, B, C, D and fire concurrently, mixing in random order:
  - `accept_invite` (B accepts A's challenge);
  - `accept_invite` (C accepts A's other challenge, made before it was withdrawn);
  - `pair_from_queue(A, D)`;
  - `accept_rematch` (A/B);
  - crossed `accept_invite` between A and C.
  Assert that no player ever has more than one match in (`pending`, `in_progress`), and that there were no deadlock errors. Model it on `tests/integration/db/receiveMove.race.test.ts`.
- [X] T025 [P] [US5] Write the failing grep test `tests/unit/match/one-way-to-make-a-match.test.ts` (SC-006). It fails if `from("matches")` followed by `.insert(` or `.upsert(` appears in any file under `app/` or `lib/`, and it lists the offenders.

### Implementation

- [X] T026 [US5] Write `supabase/migrations/20260923002_match_creation.sql` with `create_match_between`, `accept_invite`, `accept_rematch` and `pair_from_queue`, exactly per `contracts/sql-functions.md`:
  - lock order: players by id, then the invite or request;
  - the accept's compare-and-set runs inside `begin … exception` so it rolls back on `busy`;
  - `security definer set search_path = ''`, fully qualified names, `revoke … grant execute to service_role`.
  T020–T024 turn green.
- [X] T027 [US5] Write the failing `tests/unit/lib/match/createMatch.test.ts`: each wrapper calls the right RPC with the right argument names, parses the jsonb with zod into `CreateMatchResult`, and throws on an RPC error; `acceptInvite` passes `PLAYTEST_INVITE_EXPIRY_SECONDS` (default 30) as `p_ttl_seconds`.
- [X] T028 [US5] Implement `lib/match/createMatch.ts`: `MatchOrigin`, `CreateMatchResult`, and `acceptInvite(client, {inviteId, actorId, origin?})`, `acceptRematch(client, {requestId, actorId, origin?})`, `pairFromQueue(client, {selfId, opponentId, language})`. Log `match.create` / `match.create.refused` with the origin and ms, and wrap each call in `performance.mark`. T027 turns green.
- [X] T029 [US5] Rewire the challenge accept in `lib/matchmaking/inviteService.ts` `respondToInvite`:
  - accept calls `acceptInvite`;
  - map `busy` to `{status:"error", code:"opponent_busy", name}`, looking up the busy player's display name;
  - `not_pending`/`expired` → `invite_expired`;
  - `not_recipient` → the existing forbidden path;
  - decline is unchanged.
  Delete `releaseOtherChallengers`. Update `tests/unit/lib/matchmaking/inviteService.test.ts` and `inviteContention.test.ts`.
- [X] T030 [US5] Rewire `sendDirectInvite` in `lib/matchmaking/inviteService.ts`:
  - remove the sender status write (`matchmaking`);
  - before inserting, look for a pending invite from the recipient to the sender, and if one exists call `acceptInvite(reverse, sender, "crossed_challenge")` and return `{status:"accepted", matchId}`;
  - delete `releaseSenders` and its use in `expireStaleInvites`.
  Update `tests/unit/lib/matchmaking/inviteService.test.ts`, `inviteService.language.spec.ts` and `tests/contract/post-invite.contract.test.ts`. Add a crossed-challenge case to `tests/integration/db/challenges.test.ts`.
- [X] T031 [US5] Rewire `startAutoQueue` in `lib/matchmaking/inviteService.ts`: replace the conditional opponent update plus `bootstrapMatchRecord` with `pairFromQueue`. On `busy`/`not_searching`, try the next candidate, else return `queued`. Delete `setPlayerStatus(self, in_match)` and the presence resets now done in SQL. Update `tests/integration/db/queueLanguage.test.ts` and `tests/contract/post-match-start.contract.test.ts`.
- [X] T032 [US5] Rewire the rematch accept:
  - `app/actions/match/respondToRematch.ts` `acceptRematchAction` calls `acceptRematch`, and `busy` maps to `{status:"error", code:"opponent_busy", name}`;
  - `lib/match/rematchService.ts` `acceptRematchInternal` (crossed) calls `acceptRematch(..., "crossed_rematch")`;
  - keep the `rematch-accepted` broadcast and the match log after `created`;
  - delete `lib/match/rematchMatch.ts` (`createRematchMatch`) and `setPlayersInMatch`.
  Update `tests/unit/app/actions/respondToRematch.test.ts`, `requestRematch.test.ts` and `rematch.language.spec.ts`.
- [X] T032a [US5] Widen the status unions to include `withdrawn` and `superseded`: `InviteRow["status"]` and `OutgoingInvite` in `lib/matchmaking/inviteService.ts`, the payload check in `app/api/lobby/invite/[inviteId]/respond/route.ts`, the rematch status type in `lib/types/match.ts`. In `lib/match/rematchService.ts` count both as "already processed".
- [X] T032b [US5] In `lib/room/notices.ts` `challengeOutcome`, `superseded` returns `copy.challengeTaken(recipientName)` and `withdrawn` returns `null`. In `lib/room/useRematchNegotiation.ts` both close the negotiation as `expired` does. Tests first in the notices and rematch-negotiation specs.
- [X] T033 [US5] Delete `bootstrapMatchRecord` from `lib/matchmaking/service.ts` and any remaining import. T025 turns green. Leave `scripts/supabase/seed.ts` and `tests/integration/db/harness.ts` alone (they are outside `app/`/`lib/`).
- [X] T034 [P] [US5] Add the `opponent_busy` error copy: `{name} can't play right now` in `lib/i18n/copy/en.ts` and `{name} getur ekki spilað núna` in `lib/i18n/copy/is.ts`. Update `lib/i18n/copy/types.ts` if the errors object is typed there. The parity test must stay green.
- [X] T035 [US5] Show `opponent_busy` in the lobby through the existing notice channel (`lib/room/notices.ts`, `components/room/LobbyRoomController.tsx` accept handler). Handle a `sendInvite` result of `accepted` (crossed) the same way an accepted outgoing invite routes today. Add a unit test in `tests/unit/lib/room/notices.test.ts` (or the existing notices spec).

**Checkpoint**: SC-004 and SC-006 green. All five creation paths use one function.

---

## Phase 5: User Story 2 — This browser keeps my name (P1)

**Goal**: the device key claims names, `name_taken` refuses other browsers, and a lapsed session renews silently.
**Independent test**: enter a new name in context A; the same name in context B gives `that name is taken · pick another`; delete only the session cookie in A and reload → still signed in.

- [X] T036 [P] [US2] Write the failing `tests/integration/db/enter-player.test.ts`:
  - a new name → `entered` with `claim_hash` set;
  - the same hash again → `entered`;
  - a different hash → `name_taken`;
  - `Birna` / `BIRNA` count as one name;
  - an existing unclaimed player is claimed by the first hash;
  - two concurrent calls with different hashes → exactly one `entered`;
  - `status` is unchanged for an `in_match` player;
  - `resolve_claim` returns the player with the latest `last_entered_at` among those sharing a hash, and `unknown` for an unused hash.
- [X] T037 [US2] Write `supabase/migrations/20260923003_claim.sql` with `enter_player` and `resolve_claim` per `contracts/sql-functions.md`. T036 turns green.
- [X] T038 [P] [US2] Write the failing `tests/unit/auth/claim.test.ts` for `lib/auth/claim.ts`: `enterPlayer(client, {username, displayName, claimHash})` returns the player or throws `NameTakenError`; `resolveClaim(client, claimHash)` returns the player or null; the jsonb is parsed with zod; `auth.claim.name_taken` and `auth.claim.created` are logged.
- [X] T039 [US2] Implement `lib/auth/claim.ts`. T038 turns green.
- [X] T040 [US2] Write the failing tests in `tests/unit/app/actions/auth/login.test.ts`:
  - no device cookie → one is created and set with `deviceCookieOptions`;
  - an existing device cookie is reused;
  - `NameTakenError` → `{status:"error", code:"name_taken"}` and no cookie set;
  - the rate limit is checked before the claim;
  - success deletes `wottle-signed-out`.
- [X] T041 [US2] Change `performUsernameLogin` in `lib/matchmaking/profile.ts` to take `claimHash`, call `enterPlayer` instead of `upsertPlayerIdentity`, and keep the presence creation. Delete `upsertPlayerIdentity` from `lib/matchmaking/service.ts` if nothing else uses it. Update `app/actions/auth/login.ts` and `app/api/auth/login/route.ts` to read or create the device key, pass its hash, and set the device cookie only on success. The route returns `409 {code:"name_taken"}`. T040 turns green, and `tests/contract/post-login.contract.test.ts` is updated.
- [X] T042 [P] [US2] Map `NameTakenError` → `name_taken` in `lib/i18n/errorCodes.ts` `loginErrorCode`. Add `errors.name_taken`: `that name is taken · pick another` in `lib/i18n/copy/en.ts` and `þetta nafn er frátekið · veldu annað` in `lib/i18n/copy/is.ts`. Add a unit test for the mapping.
- [X] T043 [US2] Write the failing `tests/unit/auth/renewal.test.ts` for the pure `decideRenewal({sessionValid, deviceKey, signedOut})` in `lib/auth/renewal.ts`:
  - a valid session → `pass`;
  - no session, a device key, not signed out → `resolve`;
  - signed out → `pass`;
  - no device key → `pass`.
  Also test `applyRenewal(request, response, player)`: it sets the signed session on both `request.cookies` and the response, and re-sets the device cookie's max-age.
- [X] T044 [US2] Implement `lib/auth/renewal.ts`: `decideRenewal`, `applyRenewal`, and `renewSession(request)`, which runs `resolveClaim` through the service-role client. When the result is unknown it deletes the device cookie and logs `auth.device.unknown`. T043 turns green.
- [X] T045 [US2] Change `proxy.ts`:
  - run `renewSession(request)` before `decideLocaleRoute`;
  - build the response with `NextResponse.next({ request })` / rewrite / redirect as today, carrying the renewed cookies;
  - widen `config.matcher` to include `/api/:path*` while excluding `_next` and static files, and bypass locale routing for `/api`.
  Add `tests/unit/proxy.test.ts` cases: an API request with a lapsed session and a device key comes out with a `Set-Cookie`; locale redirects are unchanged.
- [ ] T046 [US2] Write `tests/integration/ui/identity.spec.ts`, tagged `@identity`. Scenario "name taken": context A enters `id-<rand>`; context B enters the same name, and `name-input-error` reads `that name is taken · pick another`. Scenario "silent renewal": in A, clear only `wottle-playtest-session` and reload → the lobby shows the same name.
- [X] T047 [US2] Audit the 37 `loginViaSlip(` calls under `tests/integration/ui/`. Any test that re-enters a fixed name from a fresh browser context must generate a unique name (the pattern in `tests/integration/ui/helpers/matchmaking.ts`) or reuse its context. Run the affected specs one file at a time and confirm they pass.

**Checkpoint**: names are claimed, `name_taken` works, sessions renew. SC-002 and SC-003 green.

---

## Phase 6: User Story 4 — Signing out never costs me a match (P2)

**Goal**: sign-out never resigns and is refused during a live match; otherwise it clears the player's commitments and marks the browser signed out. (US4 comes before US3 because the returning door is reached by signing out.)
**Independent test**: in a match, no sign-out anywhere, and the action returns `sign_out_in_match`; outside a match with a pending challenge and a search, sign-out withdraws the challenge and leaves the queue.

- [ ] T048 [P] [US4] Write the failing `tests/integration/db/sign-out.test.ts`:
  - a player in a `pending` or `in_progress` match → `in_match` and nothing changes;
  - otherwise the pending outgoing invites and rematch requests become `withdrawn`;
  - `matchmaking` → `available` with `queue_language` null;
  - an `available` player keeps their status.
- [ ] T049 [US4] Write `supabase/migrations/20260923004_sign_out.sql` with `sign_out_player` per `contracts/sql-functions.md`. T048 turns green.
- [ ] T050 [US4] Rewrite `tests/unit/app/actions/auth/logout.test.ts` to fail first:
  - no `resignActiveMatch` input, and `resignMatch` is never imported (assert with a module mock that throws if loaded);
  - a live match → `{status:"refused", code:"sign_out_in_match"}` with the session cookie kept;
  - success → `sign_out_player` called, presence expired, the session deleted, `wottle-signed-out=1` set, the device cookie untouched;
  - the result has no `resignedMatchId`.
- [ ] T051 [US4] Rewrite `app/actions/auth/logout.ts` per `contracts/actions.md`: drop `LogoutInput`, `resignMatch` and `findActiveMatchForPlayer`; call `sign_out_player`; log `auth.sign_out.refused`. T050 turns green.
- [ ] T052 [P] [US4] Add `errors.sign_out_in_match`: `finish your match first` in `lib/i18n/copy/en.ts` and `kláraðu viðureignina fyrst (?)` in `lib/i18n/copy/is.ts`.
- [ ] T053 [US4] Handle the refused result in the three callers:
  - `components/room/LobbyRoomController.tsx:178` and `components/room/MatchRoomController.tsx:408` show the error through the existing notice line instead of navigating;
  - `components/profile/ProfilePage.tsx` hides `sign out` and `change name` while the viewer has a live match (from `/api/match/active` or the room store's match phase), and handles the refusal the same way.
  Add a case to `tests/unit/components/room/MatchRoomController.spec.tsx` and the ProfilePage spec.
- [ ] T054 [US4] Extend `tests/integration/ui/identity.spec.ts`: "sign-out refused in match". Two contexts are paired; the match menu has no sign-out; `/profile` shows no sign-out.

**Checkpoint**: SC-005 green. Sign-out cannot touch a match.

---

## Phase 7: User Story 3 — Returning door (P2)

**Goal**: after sign-out, the door greets the browser's most recent name, which enters with one press or gives way to `use another name`.
**Independent test**: sign out → `WELCOME BACK · Birna · 1310 · english`; `enter the lobby ▸` → the lobby as Birna; `not Birna? · use another name` → the input; entering `embla` works, and the browser can still enter as Birna.

- [ ] T055 [US3] Write the failing `tests/unit/auth/returningPlayer.test.ts` for `readReturningPlayer(locale)` in `lib/auth/returningPlayer.ts`:
  - null when a session is valid, when there is no device key, or when the signed-out mark is absent;
  - otherwise `{displayName, rating}` from the player that `resolve_claim` picks, with a read-only variant that does not stamp `last_entered_at`, and `player_ratings` for the locale's language;
  - `rating: null` when there is no rating row.
  Use a read-only select, not the stamping RPC.
- [ ] T056 [US3] Implement `lib/auth/returningPlayer.ts`. T055 turns green.
- [ ] T057 [US3] Write the failing `tests/unit/app/actions/auth/enterAsReturning.test.ts`:
  - no device key or an unknown one → `{status:"error", code:"login_failed"}` and the device cookie cleared;
  - known → the session set, `wottle-signed-out` deleted, presence created in `language`, `{status:"success", player}`;
  - rate-limited under `auth:login`.
- [ ] T058 [US3] Implement `app/actions/auth/enterAsReturning.ts` (`"use server"`, explicit return type, zod `language`), reusing `resolveClaim` and `persistLobbySession`. T057 turns green.
- [ ] T059 [P] [US3] Add the returning-slip copy to `lib/i18n/copy/en.ts` and `lib/i18n/copy/is.ts` (keys under the sign-in group, sentence or label case per design system §8):
  - `WELCOME BACK` / `GAMAN AÐ SJÁ ÞIG AFTUR`
  - `not {name}? · use another name` / `ekki {name}? · annað nafn`
  - `NO ACCOUNT NEEDED` / `SKRÁNING ÓÞÖRF`
  - `THIS BROWSER KEEPS YOUR NAME` / `ÞESSI VAFRI GEYMIR NAFNIÐ ÞITT`
  - the rating sub-line template `{rating} · {language}` and `{language}`
- [ ] T060 [US3] Write the failing component tests `tests/unit/components/room/Slip.returning.spec.tsx`:
  - given `returning`, the slip renders the label, the name (not an input) with a 12px `--you` square (`getSeatColors`), the sub-line, and the primary and secondary buttons;
  - the secondary swaps to the `NameInput` empty state, which shows the two new lines under the primary;
  - the primary calls `enterAsReturningAction`;
  - no colours outside the tokens;
  - axe is clean.
- [ ] T061 [US3] Implement the component. In `components/room/Slip.tsx`, split `SignInBody` into `ReturningBody` and the existing name-input body, chosen by a `returning: ReturningPlayer | null` prop with local `useState` for "use another name". Add the two lines under the primary in `components/room/NameInput.tsx`. Styles go in `app/styles/room.css`, using existing classes and tokens only. T060 turns green.
- [ ] T062 [US3] Thread the data: `app/[locale]/(room)/layout.tsx` calls `readReturningPlayer(locale)` when there is no session and passes it through `RoomShell` to the sign-in slip. Update `components/room/RoomShell.tsx` props and the room store only if the slip reads from it.
- [ ] T063 [US3] Add the fixture phase `returning-slip` to `app/[locale]/dev/room/fixtures.ts` (`ROOM_PHASES`) and `app/[locale]/dev/room/RoomFixture.tsx` (EN-L Birna 1310; IS-T1 Birna 1212). Add it to `tests/integration/ui/room-fixtures.spec.ts` for the visual and a11y runs. Update the CLAUDE.md fixture count (24 → 25). Generate the darwin baselines with `pnpm test:visual --update-snapshots` for this phase only, en and is.
- [ ] T064 [US3] Extend `tests/integration/ui/identity.spec.ts` with "returning door":
  - sign out, and the slip shows `WELCOME BACK` and the name;
  - `enter the lobby ▸` → the lobby as the same name;
  - sign out again, `use another name`, enter a second fresh name → the lobby;
  - sign out, and the returning slip shows the second name;
  - `use another name` + the first name → enters (the same device key).

**Checkpoint**: all five stories work independently and together.

---

## Phase 8: Polish & cross-cutting

- [ ] T065 [P] Add a `tests/perf/` or integration timing assertion that `create_match_between`, `enter_player` and `resolve_claim` (renewal) are under 50ms p95 across 200 calls on local Supabase (SC-007). Model it on `pnpm perf:move-resolve`.
- [ ] T066 [P] Docs (FR-022):
  - CLAUDE.md "Session & Authentication" (signed cookie, device key, claim, renewal in `proxy.ts`, signed-out mark);
  - "Key Architectural Patterns" (a new "Match creation" item: the four functions, lock order);
  - Remaining Gaps (the Icelandic `sign_out_in_match` string needs review);
  - the fixture list.
  Remove the "forgeable session cookie" blocker wording wherever docs list it.
- [ ] T067 [P] Update `docs/prd_and_requirements/wottle_game_rules.md` wherever it describes signing in, signing out or starting a match (sign-out never resigns; one match at a time). Update design system §8 fixed strings with the new strings from T034/T042/T052/T059.
- [ ] T068 Run `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration` (local Supabase), `pnpm docs:check`, `pnpm guard:no-service-role`, `pnpm test:visual`, and `pnpm exec playwright test --grep "@identity|@two-player-playtest"` (one file at a time). Fix anything red.
- [ ] T069 Walk through `specs/067-identity-one-match/quickstart.md` "Verify by hand" steps 1–6 on `pnpm dev` and record the results in the PR description.

---

## Dependencies & execution order

- **Setup (T001–T003)**: no dependencies.
- **Foundational (T004–T012)**: after Setup. Blocks every story.
- **US1 (T013–T019)**: after Foundational. The MVP.
- **US5 (T020–T035)**: after Foundational, independent of US1 (the SQL and action rewiring do not touch the session). It can run in parallel with US1 on a separate worktree; merge US1 first to keep the session-shape changes in one place.
- **US2 (T036–T047)**: after US1 (it signs sessions with `persistLobbySession`).
- **US4 (T048–T054)**: after US1. T051's signed-out mark uses `lib/auth/cookies.ts` (Foundational), and its refusal is independent of US2.
- **US3 (T055–T064)**: after US2 (device key, `resolve_claim`) and US4 (the signed-out mark).
- **Polish (T065–T069)**: after all stories.

Within each story: the tests marked Red come first, then SQL, then the TS wrapper, then actions, then UI.

## Parallel examples

- **Foundational**: T005, T006, T007 and T012 (tests) together; then T008, T009, T010 and T011 together.
- **US5**: T020, T021, T022, T023 and T025 together (different test files); T034 alongside T029–T032.
- **US2**: T036 and T038 together; T042 alongside T041.
- **US4**: T048 alongside T050; T052 at any point.
- **US3**: T059 alongside T055–T058.
- **Polish**: T065, T066 and T067 together.

## Implementation strategy

1. **MVP = Setup + Foundational + US1.** This closes the top beta blocker (forged sessions) on its own, and can ship once `WOTTLE_SESSION_SECRET` is set in Vercel.
2. **Add US5.** No player is ever double-booked. Ship.
3. **Add US2.** Names are claimed and sessions renew. From here on the release runbook (quickstart.md) applies: release when no match is in progress.
4. **Add US4, then US3.** Sign-out is safe, then the returning door.
5. **Polish**, then open the PR.

## Summary

| Phase | Tasks | Count |
|---|---|---|
| Setup | T001–T003a | 4 |
| Foundational | T004–T012 | 9 |
| US1 (P1) | T013–T019 | 7 |
| US5 (P1) | T020–T035 | 18 |
| US2 (P1) | T036–T047 | 12 |
| US4 (P2) | T048–T054 | 7 |
| US3 (P2) | T055–T064 | 10 |
| Polish | T065–T069 | 5 |
| **Total** | | **72** |
