# Contract: routes and actions

Every action is `"use server"` with an explicit return type, validates its input with Zod, and is rate limited through `assertWithinRateLimit`.

## Pages

### `GET /c/[token]` · `GET /en/c/[token]` (new; `app/[locale]/(pages)/c/[token]/page.tsx`)

Renders or redirects only; it never writes (FR-010, R4).

| Viewer | Link | Response |
|---|---|---|
| any | the token is malformed, not found, or not `pending` / past expiry | 200: the invite door with the `this link has expired` band; primary `enter the lobby ▸` |
| any | valid, its language ≠ the path's locale | 307 → the same token under the link's locale |
| signed out (a device key names a player) | valid | 200: the invite door, returning state |
| signed out | valid | 200: the invite door, empty name state |
| signed in, sender | valid | 307 → `/{locale}?invite=<token>` (the slot shows `this is your link · copy ▸`) |
| signed in, in a pending or live match | any | 307 → `/{locale}/match/:id` |
| signed in | valid | 307 → `/{locale}?invite=<token>` (the slot shows the link call) |

Headers and metadata:
- `Cache-Control: private, no-store`;
- `Referrer-Policy: no-referrer`;
- `robots: noindex, nofollow`;
- title `Kári challenges you · Wottle` / `Kári skorar á þig · Orðusta`; no description beyond the language.

Contract test (`tests/contract/link-get.contract.test.ts`): 20 GETs, one with a `Slackbot-LinkExpanding` user agent and one with `Purpose: prefetch`, leave `match_links`, `matches` and `players` byte-identical, and the link stays `valid`.

### `GET /{locale}?invite=<token>` (lobby, changed)

The lobby page reads `invite` with `read_link` (read only) and passes `linkCall: { token, view } | null` and `ownLink: boolean` to `StandingProvider`. The client strips the param with `replaceState`. An invalid token drops silently.

### `GET /profile` · `/en/profile` (changed)

Signed out → 307 `/{locale}?next=/profile`. Otherwise `readProfile(viewerId, language, { mode: "own" })` → `ProfileOwnPage`.

### `GET /profile/[handle]` · `/en/profile/[handle]` (changed)

| Case | Response |
|---|---|
| the handle is the viewer's own | 307 → `/{locale}/profile` |
| unknown handle | 404 page, `no player by that name` |
| otherwise | `readProfile(playerId, language, { mode: "public", viewerId? })` → `ProfilePublicPage` |

Contract test (`tests/contract/profile-no-last-seen.contract.test.ts`): the HTML and RSC payload of both pages, signed in and signed out, contain no `last_seen`, `lastSeen` or ISO timestamp other than `firstPlayedAt`, chart points and match dates.

### `GET /rules?from=<path>` (changed)

`from` is validated by `nextParam` as a same-origin `/match/…` path; if invalid it is ignored. It selects the `close this tab ▸` primary.

## Actions

### `createLinkAction(): Promise<CreateLinkResult>` (`app/actions/link/create.ts`)

- Session required. Rate limit scope `link:create`, 6 per minute per player; `create_link` also counts invitations and links together.
- Makes the token (R1), calls `linkService.create(sender, tokenHash)`, and returns `url = origin + localePath(locale, "/c/" + token)`.
- Pokes the sender (`link`). On success the lobby is poked too, if a search was cancelled.
- Refusals map to the same `ErrorCode`s as a refused send (`busy_sender`, `cooldown` with `until`, `rate_limited`).

### `cancelLinkAction(input: { linkId: string }): Promise<{ status: "cancelled" | "not_pending" | "unauthenticated" }>` (`app/actions/link/cancel.ts`)

Session required; the link must be the viewer's own. Pokes the sender (`link`).

### `acceptLinkAction(input): Promise<AcceptLinkResult>` (`app/actions/link/accept.ts`)

```ts
input = { token: string } & (
  | { mode: "session" }                   // signed in (the slot's accept ▸)
  | { mode: "name"; name: string }        // invite door, empty state
  | { mode: "returning" }                 // invite door, returning state
)
```

1. Zod on the token (R-validation). A malformed token → `expired` with no query.
2. `read_link`. If it is not valid → `expired` (no sign-in is attempted).
3. For `name`: the `auth:login` rate limit (5 per minute per IP), then `signInWithName` (claim, cookies). A failure → `sign_in_failed` with the door's `ErrorCode`; the link is untouched (FR-021).
   For `returning`: `signInAsReturning`.
   For `session`: the session is required.
4. The `link:accept` rate limit (10 per minute per player). `linkService.accept(tokenHash, actorId)`.
5. On `created`: poke both players (`table`) and the sender (`link`), log `link.accepted`, and redirect to `/{locale}/match/:id`.
   On `busy`: return `busy` (the door reads `you are in a match` and redirects to it).
   On `own`: redirect to the lobby.
   On `expired`: return `expired`. The door re-renders the expired band; a newly signed-in accepter is sent to the lobby with the held outcome `this link has expired`.

The 500ms activation guard is client-side (`useActivationGuard`) on every accept control.

### `leaveTableAction` (unchanged signature)

It keeps calling `void_table(…, 'left', actor)`; the reason rewrite for link tables (R9) is in SQL.

### `copyReviewLink` (client only, FR-063)

The `RoomMenu` review variant's `copy link ▸` writes `origin + localePath(match.language, "/match/:id?review=last")` to the clipboard and shows `link copied` for 2s. No server call.

## Standing (`GET /api/standing`, changed)

The response gains `link: OutgoingLink | null`: the viewer's newest link, if it is `pending`, or if it left `pending` less than 10s ago (for the 4s outcome). The Zod schema is updated. `/api/standing` never returns a token.

## Pokes (`lib/realtime/pokes.ts`, changed)

`PlayerPokeKind` gains `"link"`. It is sent to the sender on create, cancel, use and expiry (sweep). Pokes still carry no payload.

## Sweep (`/api/cron/sweep-stale-matches`, changed)

It adds `linkService.expireDue()` → `expire_links()` and pokes each sender with `link`.

## Logs (`logWriter`)

`link.created {senderId, language}`, `link.cancelled`, `link.expired`, `link.accepted {linkId, matchId, signedInAtAccept: boolean}`, `link.accept_refused {reason}`. Tokens and hashes are never logged.
