# Implementation Plan: Identity, and one commitment at a time

**Branch**: `067-identity-one-match` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/067-identity-one-match/spec.md`

## Summary

The work makes a session unforgeable, makes a name belong to the browser that claimed it, and makes the database the one place a match is created.

- **Session**: an HMAC-SHA256-signed cookie (`v1.<payload>.<mac>`).
- **Claim**: a year-long device key whose SHA-256 is stored as `players.claim_hash`, claimed atomically by `enter_player`.
- **Renewal**: silent, in `proxy.ts`, unless the browser signed out.
- **Door**: a returning state in the existing sign-in slip, and a `name_taken` error.
- **Sign-out**: never resigns; it is refused during a live match.
- **Match creation**: `create_match_between` plus three thin callers (`accept_invite`, `accept_rematch`, `pair_from_queue`). All are row-locked Postgres functions, and they replace every TS insert and status juggle in the queue, challenge, crossed-challenge, rematch and crossed-rematch paths.

## Current state (code survey)

- **Session.** The cookie is written by `persistLobbySession` and read by `readLobbySession` (`lib/matchmaking/profile.ts:130-168`) as unsigned base64 JSON. About 35 callers read it: pages, actions and API routes. `proxy.ts` handles only locale routing and excludes `/api`.
- **Entry.** Entry is `upsertPlayerIdentity` (`lib/matchmaking/service.ts:58`), an upsert on `username` that also resets `status` to `available`.
- **Logout.** Logout can call `resignMatch` (`app/actions/auth/logout.ts:51-66`). No app caller passes the flag, but the code path exists. There are three sign-out buttons: lobby, match-final and profile.
- **Match creation.** Every match insert goes through `bootstrapMatchRecord`, which has no transaction and no re-check. It is reached from:
  - `startAutoQueue` (conditional update of the opponent);
  - `respondToInvite` (checks neither player);
  - `acceptRematchAction` / `acceptRematchInternal` (checks neither player).
- **Crossed challenges.** They do not exist: sending marks the sender `matchmaking`, so a counter-challenge is refused.
- **Invite and rematch statuses.** The status checks are (`pending`, `accepted`, `declined`, `expired`).
- **SQL style.** Security-definer RPCs follow `receive_move` (`20260921001_async_moves.sql:211`).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router, `proxy.ts` on the Node runtime)
**Primary Dependencies**: Supabase JS v2 (RPC), Zod, zustand, Node `crypto` (HMAC, SHA-256, `timingSafeEqual`, `randomBytes`). No new dependency.
**Storage**: Supabase PostgreSQL. One additive migration in four files (`20260923001`–`004`): three columns on `players`, two on `matches`, widened status checks, and seven security-definer functions.
**Testing**: Vitest (unit, contract), Vitest against local Supabase (`tests/integration/db`) for the functions and races, Playwright with two browser contexts, and the visual suite for the new slip phase.
**Target Platform**: Vercel (serverless Node), Supabase Cloud.
**Project Type**: Web application (single Next.js app).
**Performance Goals**: session verification <1ms (no I/O); renewal adds one indexed select only when the session is missing. `create_match_between` stays under 50ms p95 (SC-007), and move RTT is unaffected (moves do not touch these paths).
**Constraints**: server-only secret (`WOTTLE_SESSION_SECRET`, at least 32 bytes). No grace period for old cookies. Release when no match is in progress. No screen changes beyond the returning slip and the error lines.
**Scale/Scope**: closed playtest, about 10² players. About 35 session call sites keep one reader. Five creation paths collapse into one function.

## Constitution Check

| Principle | Status | Note |
|---|---|---|
| I. Server-authoritative | ✅ | Identity and match creation become more server-authoritative: the database decides, under row locks. |
| II. Performance SLAs | ✅ | No change to the move path. SC-007 adds a 50ms p95 budget for creation and entry, measured in the integration suite. |
| III. Type-safe end-to-end | ✅ | New actions have explicit return types and zod inputs. RPC results are parsed with zod in `lib/match/createMatch.ts` and `lib/auth/claim.ts`. |
| IV. Mobile-first | ✅ | The returning slip reuses the slip, and its targets are at least 44px. |
| V. Observability | ✅ | Events are listed in research R10. `performance.mark` goes around entry and creation. |
| VI. Clean code | ✅ | Small modules (`sessionToken`, `deviceKey`, `claim`, `renewal`, `createMatch`). The SQL functions each answer one question. Removes `bootstrapMatchRecord`, `releaseSenders`, `releaseOtherChallengers` and the resign-on-logout branch. |
| VII. TDD | ✅ | Each function and module starts from a failing test. The race test and the insert grep are written first. |
| VIII. Context7 | ✅ | Next 16 proxy cookie behaviour confirmed (research, final note). |
| IX. Commits | ✅ | Conventional commits, one per green test. |

No violations. Post-design re-check: still passes; the design added no dependency and no new layer.

## Project Structure

### Documentation (this feature)

```text
specs/067-identity-one-match/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R11
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── actions.md       # server actions, routes, proxy
│   └── sql-functions.md # the seven functions
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code

```text
supabase/migrations/20260923001_identity_columns.sql … 004_sign_out.sql   # columns, checks, 7 functions, grants

lib/auth/                        # new, server-only
├── sessionToken.ts              # signSession / verifySession (pure)
├── sessionSecret.ts             # requireSessionSecret, SessionSecretMissingError
├── deviceKey.ts                 # newDeviceKey / hashDeviceKey (pure)
├── cookies.ts                   # names + options for session, device, signed-out
├── claim.ts                     # enterPlayer / resolveClaim RPC wrappers, NameTakenError
└── renewal.ts                   # decideRenewal → pass | resolve; renewSession clears an unknown device key

lib/matchmaking/profile.ts       # readLobbySession → verifySession; persistLobbySession signs; performUsernameLogin → enterPlayer
lib/matchmaking/service.ts       # upsertPlayerIdentity, bootstrapMatchRecord removed
lib/matchmaking/inviteService.ts # respondToInvite → acceptInvite; sendDirectInvite: crossed + no sender status; startAutoQueue → pairFromQueue
lib/match/createMatch.ts         # new: typed wrappers over create/accept_invite/accept_rematch/pair_from_queue
lib/match/rematchService.ts, rematchMatch.ts   # accept via acceptRematch; rematchMatch.ts removed
lib/i18n/copy/{en,is}.ts         # errors.name_taken, opponent_busy, sign_out_in_match; returning slip strings
lib/i18n/errorCodes.ts           # NameTakenError → name_taken

proxy.ts                         # renewal before locale routing; matcher includes /api

app/actions/auth/login.ts, logout.ts, enterAsReturning.ts (new)
app/api/auth/login/route.ts
app/actions/matchmaking/sendInvite.ts, app/api/lobby/invite/**    # busy / crossed results
app/actions/match/respondToRematch.ts, requestRematch.ts
app/[locale]/(room)/layout.tsx   # reads ReturningPlayer
components/room/Slip.tsx         # SignInBody → EmptySignIn | ReturningBody
components/room/NameInput.tsx    # error line gains name_taken
components/room/LobbyRoomController.tsx, MatchRoomController.tsx, components/profile/ProfilePage.tsx  # sign-out result handling
app/[locale]/dev/room/{fixtures.ts,RoomFixture.tsx}  # phase "returning-slip"

scripts/supabase/quickstart.sh   # writes WOTTLE_SESSION_SECRET
.github/workflows/ci.yml         # sets WOTTLE_SESSION_SECRET

tests/unit/auth/*                # token, device key, renewal decisions, client-import guard
tests/unit/match/one-way-to-make-a-match.test.ts
tests/integration/db/{create-match-between,accept-invite,accept-rematch,pair-from-queue,enter-player,sign-out}.test.ts
tests/integration/ui/identity.spec.ts   # @identity: name taken, returning door, sign-out refused in match
```

**Structure Decision**: This is the existing single Next.js app. The new `lib/auth/` holds identity, which was spread across `lib/matchmaking/profile.ts`. `lib/match/createMatch.ts` is the one TS entry point to match creation.

## Phasing (for /speckit.tasks)

1. **P0: Foundation.** Migration (columns, checks, functions). `lib/auth/sessionToken`, `sessionSecret` and `deviceKey`. Env in quickstart and CI. Tests first.
2. **P1: US1 + US5 (the two P1 server stories).**
   - Signed session through `readLobbySession` and `persistLobbySession`, and narrow `LobbySession`.
   - `createMatch.ts`, and rewire the queue, accept, crossed challenge, rematch and crossed rematch.
   - Remove `bootstrapMatchRecord`.
   - Race test and grep test.
3. **P2: US2.** `enter_player` / `resolve_claim`, `name_taken`, device cookie, proxy renewal and the signed-out mark.
4. **P3: US3 + US4.**
   - Returning slip, action, fixture phase and baselines.
   - Sign-out rewrite (`sign_out_player`, refusal, hidden in profile during a match).
   - Playwright `@identity`.
5. **P4: Docs.**
   - CLAUDE.md (session, entry and match-creation paragraphs, remaining gaps).
   - Rules doc and design system §8, where sign-in and sign-out are described (FR-022).
   - `docs:check`.

## Risks

- **Every existing session drops at release.** Accepted by clarification Q3, and the runbook is in quickstart.md.
- **E2E suites sign in by name.** Each Playwright context has its own cookie jar, so each gets its own device key. Suites that reuse a fixed name across tests in fresh contexts will hit `name_taken`. Mitigation: helpers generate unique names per test (most already do), and the tasks audit `loginViaSlip` callers.
- **A pending match that never starts would block its players.** Today the loader starts a pending match on first load (with a grace), and `findActiveMatchForPlayer` routes the player into it, so it resolves by the clock. S3 (the table) replaces this with a table deadline.
- **Proxy on `/api` adds work to every poll.** That work is one HMAC verification (microseconds), with I/O only when the session is missing.
- **The Icelandic `sign_out_in_match` string is marked (?)** for native review.

## Complexity Tracking

No constitution violations to justify.
