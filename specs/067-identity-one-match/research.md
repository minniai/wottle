# Research: Identity, and one commitment at a time

Spec: [spec.md](spec.md). The code survey behind these decisions is summarised in plan.md § Current state.

## R1. Session format and signing

- **Decision**: The cookie value is `v1.<payload>.<mac>`. `payload` is base64url JSON `{ playerId, username, displayName, issuedAt, expiresAt }`, and `mac` is base64url HMAC-SHA256 over `v1.<payload>`, keyed by `WOTTLE_SESSION_SECRET` (at least 32 bytes, base64). Verification uses `crypto.timingSafeEqual`, then checks `expiresAt`, then parses the payload with zod. One module, `lib/auth/sessionToken.ts`, exports `signSession` / `verifySession`. `readLobbySession` is the only caller of `verifySession`, and nothing else decodes the cookie (FR-003).
- **Rationale**: Node `crypto` is available everywhere the cookie is read: Server Components, actions, route handlers, and `proxy.ts`, which runs on the Node runtime in Next 16. HMAC over the full string rejects any edit (FR-001). The `v1.` prefix never parses as the old base64 JSON, so old cookies are rejected by construction (US1-2). The payload keeps the fields callers already read (`session.player.id/username/displayName`), so no caller has to re-query the player. `status`, `avatarUrl`, `lastSeenAt` and `eloRating` move out of the payload because a snapshot of them goes stale. The survey found no reader of those fields from the session that cannot read the store or the DB instead; tasks verify this per caller.
- **Missing secret**: `requireSessionSecret()` throws `SessionSecretMissingError` on first use. In `NODE_ENV=production` it also throws when the secret is shorter than 32 bytes. There is no fallback to unsigned (US1-3).
- **Rotation**: a single key. Rotating it invalidates every session, and a browser with a device key renews silently (spec edge case). An optional previous key is not built.
- **Alternatives rejected**: an encrypted JWE (the payload is not secret and it adds a dependency), a server-side session table (a DB read on every request, when HMAC gives integrity at no DB cost), and `iron-session` (a new dependency for about 40 lines).

## R2. Device key and claim hash

- **Decision**: The cookie `wottle-device` holds 32 random bytes as base64url. It is httpOnly, `SameSite=Lax`, `Secure` per the existing `shouldUseSecureCookies()`, `path=/`, has a max-age of one year, and is re-set on each entry and renewal. The database stores `players.claim_hash = encode(sha256(key), 'hex')`. Several players may share one hash (clarification Q2). Lookups by hash use an index.
- **Rationale**: The key carries 256 bits of entropy, so a fast hash is enough; a slow KDF only protects low-entropy secrets. Storing only the hash means a database leak does not give out keys. Supabase Auth later links an account to the same hash (clarification Q1).
- **Alternative rejected**: HMAC-ing the key with the session secret. It would tie claims to the secret, so rotating the secret would orphan every claim.

## R3. Signed out vs lapsed

- **Decision**: Sign-out deletes the session and sets `wottle-signed-out=1` (httpOnly, one year). Silent renewal is skipped while that cookie is present. Entering (with a typed name or from the returning door) deletes it.
- **Rationale**: US2-4 (renew when the session lapsed) and US3 (the returning door after sign-out) need the two cases told apart, and only the browser knows which one happened. A separate cookie keeps the device key's value a pure secret.

## R4. Where silent renewal happens

- **Decision**: In `proxy.ts`. The matcher is widened to include `/api/*`, but not `_next` or static files. For each request:
  1. A valid session: pass through with no DB call.
  2. Otherwise, a device key and no signed-out mark: `resolveClaim(hash)`, one indexed select through the service-role client, returns the player this browser entered as most recently. The proxy then signs a new session, sets it on the **request** cookies (so the Server Component or route handler in this same request sees it) and on the **response**. This is the Supabase SSR pattern.
  3. A device key that matches no player: the proxy deletes it (US2-6).
  The locale routing is composed after this step, unchanged.
- **Rationale**: Server Components cannot set cookies. The proxy is the one place every page, server action (a POST to the page path) and API route passes through, so renewal lives in one function (DRY) instead of in 30+ `readLobbySession` callers. The DB cost falls only on the rare lapsed request.
- **Alternative rejected**: a fallback inside `readLobbySession`. It cannot persist the cookie from a Server Component, so it would hit the DB on every request until an action happened to run.
- **Guard**: `pnpm guard:no-service-role` already excludes server files, and `proxy.ts` is server-only. The plan adds a unit test showing that `lib/auth/*` is never imported from a `"use client"` module.

## R5. Claiming at entry: one atomic function

- **Decision**: A new security-definer function, `enter_player(p_username citext, p_display_name text, p_claim_hash text) returns jsonb`:
  1. `insert … on conflict (username) do nothing`, then `select … for update` on the player row.
  2. If `claim_hash` is null, set it to `p_claim_hash` and set `claimed_at = now()`.
  3. If it equals `p_claim_hash`, continue.
  4. Otherwise return `{status:'name_taken'}`.
  5. On success, set `last_entered_at = now()` and `last_seen_at = now()`, and return the player.
  It never writes `status`. The old upsert reset an `in_match` player to `available`; that bug goes away.
- **Rationale**: The row lock makes two simultaneous attempts serialise: exactly one sets the hash and the other sees a different hash (spec edge case). Unclaimed existing players are claimed by the first browser (US2-5), with no grace period for old cookies (clarification Q3).
- **Browser with no key**: the server generates a key before the call and sets the cookie only on success.
- **Error mapping**: `performUsernameLogin` throws `NameTakenError`. `loginErrorCode` maps it to the new `ErrorCode` `name_taken`, and the rate-limit check still runs first (spec edge case).

## R6. The returning door's data

- **Decision**: `app/[locale]/(room)/layout.tsx` reads, besides the session, a `ReturningPlayer | null`. It is set only when there is no session, the device key is valid and the signed-out mark is present. It holds `{ displayName, rating }`, where `rating` is the viewer's `player_ratings` row for the page's language (or null when they have none; the sub-line then shows only the language). It passes this to `RoomShell`, then `Slip` `signIn`, then a new `ReturningBody`. `use another name` is local state in the slip. `enter the lobby ▸` posts `enterAsReturningAction(language)`.
- **Rationale**: This keeps the change inside the existing slip (spec assumption: no A1 layout work) and adds one fixture phase so the visual suite covers it.

## R7. One way to make a match

- **Decision**: Four security-definer functions in one migration. Every creation path calls one of them, and each ends in `create_match_between`.

  | Function | Called by | Precondition it adds before `create_match_between` |
  |---|---|---|
  | `create_match_between(a, b, language, origin, ref)` | the other three; nothing else in app code | — |
  | `accept_invite(invite, actor, ttl_seconds, origin default 'challenge')` | challenge accept; crossed challenge (`origin='crossed_challenge'`, `actor` = the new sender) | the invite is pending, the recipient is `actor`, it is not expired; compare-and-set to accepted |
  | `accept_rematch(request, actor, origin default 'rematch')` | rematch accept; crossed rematch (`'crossed_rematch'`) | the request is pending, the responder is `actor`, it is not older than 30s (unless crossed), and the old match is completed; compare-and-set to accepted |
  | `pair_from_queue(self, opponent, language)` | `startAutoQueue` | both are `matchmaking` in `language` |

  `create_match_between`:
  - locks both `players` rows `order by id … for update`;
  - refuses `{status:'busy', player_id}` if either has a match in `pending` or `in_progress`;
  - inserts the match (`board_seed = gen_random_uuid()`, `language`, `origin`, `origin_ref`, `rematch_of` when the origin is a rematch; `move_limit` keeps its column default);
  - sets both players `status='in_match'`, `queue_language=null`;
  - sets both `lobby_presence` rows to mode `auto`;
  - withdraws both players' pending outgoing invites (except `ref`) with status `withdrawn`, and supersedes pending invites addressed to either (status `superseded`);
  - does the same for pending rematch requests;
  - returns `{status:'created', match_id}`.

  Accept functions: if `create_match_between` refuses, the accept **raises** inside a sub-block, so the compare-and-set is rolled back and the invite stays pending (FR-018). The function then returns `{status:'busy', player_id}`. When the busy player is the sender, it also marks the invite `superseded`, because it can never be accepted.
- **Rationale**: `accept_rematch` and `pair_from_queue` exist because rematch requests and queue rows are different tables with different preconditions. Folding them into `accept_invite` would make one function answer two questions (Clean Code). They are thin wrappers, so the invariant still has **one** home (FR-016). Lock order by id prevents deadlock between crossed calls. A single transaction per call makes SC-004 hold against any interleaving.
- **Crossed challenges**: `sendDirectInvite` first looks for a pending invite from the recipient to the sender; if it finds one, it calls `accept_invite(reverse, sender, 'crossed_challenge')`. This needs **no sender status write on send** (today the sender is set to `matchmaking`, which makes every counter-challenge fail with "unavailable"). The sender stays `available`. The recipient check stays `available`. `releaseSenders`, which un-marks senders, becomes dead code and is removed.
- **Alternatives rejected**: a TS-side transaction (supabase-js has none), and advisory locks (row locks on `players` are already the natural mutex, and `receive_move` uses the same pattern).

## R8. Sign-out

- **Decision**: `logoutAction()` takes no input and calls the security-definer `sign_out_player(p_player)`, which checks and acts atomically.
  - If the player has a `pending` or `in_progress` match, it returns `in_match`, the action returns `{status:'refused', code:'sign_out_in_match'}`, and nothing changes (FR-014).
  - Otherwise it withdraws pending outgoing invites and pending outgoing rematch requests, and sets `status='available', queue_language=null` when the status is `matchmaking`.
  - Then `expireLobbyPresence` and `forgetPresence` run, the session is deleted, and the signed-out mark is set.
  - The Profile page hides sign-out and change-name while the store says a match is live, and the server refuses anyway.
- **Rationale**: This removes `resignMatch` from logout entirely (FR-013). `RoomMenu` already hides sign-out in the match variant.

## R9. Refusal copy

- **Decision**: New `ErrorCode`s:
  - `name_taken`: `that name is taken · pick another` / `þetta nafn er frátekið · veldu annað`.
  - `opponent_busy`: `{name} can't play right now` / `{name} getur ekki spilað núna`. The Icelandic template takes the nominative, so the name needs no case form.
  - `sign_out_in_match`: `finish your match first` / `kláraðu viðureignina fyrst (?)`.
  The accept result carries the busy player's display name. The lobby shows it through the existing notice channel (`lib/room/notices.ts`) as a one-line notice, which is not a new element.
- **Rationale**: No screen redesign (scope). The `(?)` marks a string for native review, per the game-flow spec's convention.

## R10. Observability

- **Decision**: Structured JSON events through the existing `logPlaytestError` / console JSON pattern:
  - `auth.session.rejected {reason: bad_mac|legacy|expired|malformed}` (sampled 1 in 10 for `legacy`)
  - `auth.session.renewed {playerId}`
  - `auth.claim.created`
  - `auth.claim.name_taken {username}`
  - `auth.device.unknown`
  - `match.create {origin, matchId, ms}`
  - `match.create.refused {origin, reason, playerId}`
  - `auth.sign_out.refused`
  `performance.mark` goes around `enter_player` and `create_match_between` calls.

## R11. Release

- **Decision**: `WOTTLE_SESSION_SECRET` is added to quickstart (generated with `openssl rand -base64 48` when absent), to CI env, and to Vercel (production and preview) **before** merge. The migration is additive. Release when no match is `in_progress` (clarification Q3). The runbook goes in quickstart.md.

## Constitution notes (Context7 check, principle VIII)

- Next 16 `proxy.ts` runs on the Node.js runtime, and `runtime` config throws there. Setting cookies on both `request.cookies` and a `NextResponse.next({ request })` makes a refreshed cookie visible to the same request (Next.js docs; Supabase SSR example). This confirms R4.
