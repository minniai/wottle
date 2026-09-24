# Research: Invite links and profiles

Decisions R1–R16 resolve every open point in the Technical Context. Each has the decision, why, and the alternatives that were rejected.

## R1. Token format and storage

- **Decision:** The server makes 32 random bytes (`crypto.randomBytes`) and encodes them base64url (43 characters). Only `sha256(token)` is stored, as `match_links.token_hash bytea unique`. Lookups hash the presented token and match on the hash.
- **Why:** 256 bits of entropy makes guessing impossible, so a fast hash is enough; a slow KDF would add latency to every read and buys nothing at this entropy. With the hash unique, lookup is a single index probe. This follows the device key's pattern (`lib/auth/deviceKey.ts`).
- **Alternatives:** The row id as token (guessable in practice once ids leak, e.g. in logs). A signed JWT-style token (it can't be single-use without a row anyway, and it would leak the sender id).

## R2. Where the token lives after creation

- **Decision:** The create action returns the token once. The client copies it and keeps `{linkId, url}` in `localStorage` under `wottle-link` until the link's `expiresAt`. `copy again ▸` reads it from there. If the link id in the standing facts differs from the stored one, or nothing is stored, the slot offers `new link ▸` instead (spec edge case "The sender reloads").
- **Why:** The server can't reproduce the token (R1). `localStorage` covers the sender's other tabs in the same browser and survives a reload. It is a per-viewer convenience, which is the right use of browser storage.
- **Alternatives:** Storing the token encrypted server-side (a second secret and a second copy to protect, for a 10-minute object). `sessionStorage` (lost across tabs).

## R3. Single use by compare-and-set

- **Decision:** `accept_link(p_token_hash, p_actor)` locks the link row (`for update`) and both players' rows in id order, re-checks `status = 'pending' and expires_at > now()`, calls `create_match_between(sender, actor, language, 'link', link_id, array[actor])`, and on `created` updates the link to `used` in the same transaction. A concurrent second accept blocks on the row lock, then sees `used` and returns `expired`.
- **Why:** This is the same pattern as `accept_invite` (spec 067/070), and it has been race-tested there. One transaction means a link can never be used without a match, or a match made without the link being used.
- **Alternatives:** An optimistic `update … where status = 'pending' returning` followed by creation in a second call (a crash between them loses the link).

## R4. The GET only renders

- **Decision:** `/c/[token]` (and `/en/c/[token]`) is a server component that calls `read_link(p_token_hash)`: `stable`, no writes, returning `{sender, language, expiresAt, valid}`. It sets `robots: { index: false, follow: false }`, `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer`. A mismatched locale redirects (307) to the link's locale. For a signed-in viewer it redirects to the lobby with `?invite=<token>` (see R6). Nothing in the render path runs an action or an RPC that writes.
- **Why:** Link unfurlers (Slack, iMessage, WhatsApp), prefetchers and crawlers fetch with GET. A contract test proves no row changes.
- **Alternatives:** An interstitial `POST` on page load (JS-driven; it breaks the "harmless preview" rule when a bot runs JS).

## R5. Accept is a Server Action (POST)

- **Decision:** Three actions under `app/actions/link/`:
  - `createLinkAction()`;
  - `cancelLinkAction(linkId)`;
  - `acceptLinkAction({ token, name? , returning? })`.
  Signed out with a name, accept runs the door's `loginAction` steps (rate limit → Zod → `enter_player` claim → cookies) and then `accept_link`. For the returning state it runs `enterAsReturningAction`'s steps. Signed in, it only runs `accept_link`. It then redirects to `/match/:id`.
- **Why:** Server Actions are the project's primary interface and are POST by construction. The login steps are reused, not copied: the plan extracts `signInWithName` and `signInAsReturning` from the two existing actions into `lib/auth/signIn.ts`.
- **Alternatives:** A route handler `POST /api/link/accept` (a second interface to maintain; Server Actions already carry the form).

## R6. How a signed-in viewer sees the link's call

- **Decision:** The GET redirects a signed-in viewer to `/{locale}?invite=<token>`. The lobby page reads the param, calls `read_link` (read only), and passes a `linkCall` fact to the `StandingProvider`, which holds it in client state for the tab. The page then strips the param with `history.replaceState`. `standingSlot` treats `linkCall` as an incoming call (precedence 1, after any challenge call, where it adds to the `+1` count). Accept calls `acceptLinkAction({ token })`. The fact is dropped at its `expiresAt`, when the tab closes, or on dismiss.
- **Why:** The link has no recipient until it is accepted, so the server can't list it under the viewer's incoming challenges. Holding it in the tab matches Story 3.3 ("gone for this session; opening the link again brings it back"). No cookie is written by the GET.
- **Alternatives:** A cookie set by the GET (a write on GET, even if client-side). A `link_views` table (a write on GET).

## R7. The sender's own link and busy viewers

- **Decision:** `read_link` returns `sender_id`. The page compares it with the session: the sender is redirected to `/?invite=<token>`, where the provider shows `this is your link · copy ▸` (the URL is at hand, so copy works even from another device). A viewer in a pending or live match (`findActiveMatchForPlayer`) is redirected to their match.
- **Why:** These are T64 and Story 3.5, decided before any accept is possible.

## R8. Link table deadline

- **Decision:** After `create_match_between` returns `created`, `accept_link` sets `matches.table_deadline_at = link.expires_at` in the same transaction. `find_due_tables`, the loader's lazy void and `seat_player`'s deadline check need no change, since they all read `table_deadline_at`. `MatchState.table.origin = 'link'` already reaches the client (spec 069), and `tableSlip.readySlipModel` reads `THE TABLE WAITS · m:ss` when the origin is `link` and the other seat is empty.
- **Why:** One column already carries "time to sit down"; the link only changes its value.

## R9. The accepter leaves a link table (clarification Q1)

- **Decision:** `void_table(p_match, 'left', p_by)` gains a branch before the update: when `origin = 'link'`, `p_by` is seated and the other seat is empty, the reason becomes `not_seated` and `voided_by` becomes the unseated sender. `table_release_player` then marks the sender `table_missed_at` (their search stops, spec 069), and the leaver is released as `available` without a `left` void, so `table_leave_cooldown_until` never counts it.
- **Why:** The cooldown counts from `void_reason = 'left' and voided_by = player` rows, so rewriting the reason is the whole change, and it lives where every void is decided.
- **Alternatives:** Special-casing the cooldown function (the row would still claim the accepter left).

## R10. Sender presence at accept

- **Decision:** `accept_link` does **not** refuse a `gone` sender. The table waits until expiry; the pokes, cue and notification reach any tab they still have. If they never come, the table voids `not_seated`.
- **Why:** Source A2: "the table waits for them until the link expires". A sender who pasted a link and closed the laptop lid (tab frozen, so beats stop) is the common case, and the waiting friend may leave at no cost (R9).
- **Alternatives:** Refusing as `gone` like `accept_invite` (it would expire most links for senders on phones).

## R11. One outgoing challenge, links included

- **Decision:** A link is not a `match_invitations` row. It is its own table (data-model), and every "withdraw outgoing" path also cancels pending links:
  - `send_challenge`;
  - `create_link`, which withdraws pending challenges and links and cancels the search;
  - `withdrawOutgoing` (the queue start);
  - `create_match_between` (anyone's accept);
  - `sign_out_player`;
  - `confirm_lobby_switch`, with `lobby_pending` gaining `'link'`.
  The rate limit in `send_challenge` and `create_link` counts invitations plus links in the last minute (6).
- **Why:** An invitation row needs a recipient, `recipient_id` is `not null` and used everywhere, and a link has none until it is used. A separate table keeps every invite query unchanged. `tests/unit/matchmaking/link-one-outgoing.test.ts` greps the SQL for `match_links` in each of those functions.
- **Alternatives:** A nullable `recipient_id` on `match_invitations` (it touches every invite query and RLS policy).

## R12. Slot and notification wiring

- **Decision:**
  - `StandingFacts` gains `link: { id, expiresAt, status, respondedAt } | null` (pending, or its outcome within 10s).
  - `SlotState` gains `{ kind: "link"; link; held }`, placed after `sent` and before `search`.
  - `slotLines` gains its lines (`Link copied · valid 9:58`, and the `copy again ▸` / `new link ▸` and `cancel link ▸` actions).
  - `PlayerPokeKind` gains `link`, sent to the sender on use, cancel and expiry.
  - The existing table push takes the sender to `/match/:id`.
  - `useNotifications` treats "table with origin link, created while the slot showed a link" as the §7.7 "link opened" event (cue, title, OS notification when hidden).
  - `expire_links()` runs in the 30s sweep and pokes each sender.
- **Why:** This reuses spec 070's machinery; the link is one more standing state.

## R13. Profile data: one read, no last-seen

- **Decision:** `lib/profile/readProfile.ts` (server-only) returns a `ProfileView`. It has no `lastSeenAt`, no `status` and no `avatarUrl`; it holds identity (id, handle, display name, `firstPlayedAt`), the rating in this language, peak, `weekChange`, matches, record, the last ten, the 30-day series, best words (3) and recent or shared matches. Pages pass only `ProfileView` to client components. `getPlayerProfile` and `getPlayerProfileByHandle` are retired with their `PlayerProfile` type, and a contract test asserts the page's RSC payload contains neither `last_seen` nor `lastSeen`.
- **Why:** Today `identity.lastSeenAt` is handed to the client `ProfilePage` (`app/actions/player/getPlayerProfile.ts:126`), so it already crosses into the browser. FR-041 forbids that.
- **Where the numbers come from:**
  - `match_ratings (player_id, language)` gives the rating series, the peak (max `rating_after`), the week change (the current rating minus the last `rating_after` before now − 7d, or the first `rating_before` in the window) and the last ten.
  - `player_ratings` gives the record.
  - "Playing since" is the first `match_ratings.created_at` in this language, falling back to `players.created_at`.
  - The 30-day series starts with the rating at the window start and adds one point per match in the window.

## R14. Best words

- **Decision:** A new SQL function, `best_words(p_player uuid, p_language text, p_limit int)`, does `distinct on (upper(word))` over `word_score_entries` joined to `matches`, where `language = p_language` and `ended_reason is distinct from 'void'` and `state = 'completed'`. It orders by points desc, then match `completed_at` asc (the earlier match wins a tie), and returns the letters with their tile coordinates for the strip. The page takes the top 3.
- **Why:** The current `getBestWords` dedupes in TypeScript after reading up to 100 rows. The function is one indexed query and returns exactly three.

## R15. Presence on a public profile

- **Decision:** On the public profile, the challenge state and presence come from `useLobbyList` (spec 070's live lobby rows on `lobby:{lang}` pokes) when the player is in this lobby. For anyone else, a server-read `presence_word(p_player, p_language)` returns `here | in_match | away | other_lobby | not_here` and `moves_played` (no timestamps). Challengeability and the reason it is closed reuse `rowOverlays` / `challengesClosed` and the lobby composer (`composerModel`, `ComposerRow` adapted to column B).
- **Why:** The profile, the lobby and the composer then always agree, and presence updates live without a new channel.

## R16. Rules page state and `close this tab ▸`

- **Decision:**
  - `RoomMenu`'s rules link becomes `/rules?from=<match path>` (validated like `?next=` by `nextParam`).
  - `rulesPrimary(slot, { signedIn, from })` in `lib/pages/pagePrimary.ts` chooses `close this tab ▸` (with `from`), `find an opponent ▸` (signed in, empty slot) or `enter the lobby ▸` (signed out). A call in the slot outranks all three.
  - `close this tab ▸` calls `window.close()`; if the tab is still open after 150ms (the browser refused), it navigates to `from`.
  - The rules content is wrapped in `PageFrame` (the old header and footer links are removed), and the masthead's `how to play ▸` carries `aria-current="page"`.
  - `PageMenu` (phone `⋯`) gains `how to play ▸`.
- **Why:** A tab opened by `target="_blank"` usually may be closed by script, and the fallback covers browsers that refuse.

## Context7

Consult Next.js 16 docs (Context7) before implementation for:

- the `robots` metadata and per-route `headers` on a dynamic segment;
- `redirect` from a server component under `proxy.ts` locale rewriting.

These are recorded as tasks, not open questions: both are established patterns in this repo (`app/[locale]/(pages)/page.tsx` `generateMetadata`, `proxy.ts`).
