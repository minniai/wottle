# Contract: routes and actions

Every route that reads or writes as the player requires the signed session (spec 067), except where a route is marked *public*. Inputs are parsed with Zod, and outputs have explicit types in `lib/types/standing.ts`. A 401 means no session. A 429 carries `Retry-After`.

## Presence

### `POST /api/presence/beat`

Body: `{ tabId: uuid, visible: boolean, inputAgoMs: int, page: "lobby"|"profile"|"rules"|"match"|"other" }`.

- It calls `beat_tab`, and writes `match_heartbeats (source 'page', cadence)` when the viewer's match is in progress and `page !== "match"`.
- On `transition`, it pokes `lobby:{language}` with `presence`.
- 200 `{ cadenceMs: 10000 | 30000, serverNow }`.
- Target: under 100ms p95 (`pnpm perf:heartbeat`).

### `POST /api/presence/leave` (beacon)

Body: `{ tabId }`, sent as text/plain JSON (the beacon cannot set headers).

- It calls `leave_tab`, then pokes `lobby:{language}` with `presence` and `{ recheckInMs: 8500 }`. This is the one poke with a field, and the field is a timing, not data.
- 204.

## Standing (the line slot)

### `GET /api/standing?visible=&inputAgoMs=`

- It records attention the same way `/api/match/active` does now.
- It runs `expire_challenges()` lazily for the viewer's own invites.
- 200 `StandingFacts` (data-model.md).
- Target: under 150ms p95 (`pnpm perf:standing`).

## Lobby reads

### `GET /api/lobby/players?language=` (session)

200 `{ rows: LobbyRow[] }`. The rows are:
- every player in `player_presence(language)` except the viewer;
- joined with ratings in that language and with `head_to_head(viewer, language)`;
- sorted by state (here → searching → in_match → away), then by rating distance from the viewer.

### `GET /api/lobby/overview?language=` (*public*; richer with a session)

200:

```ts
{
  counts: { here: number; searching: number; playersInMatch: number; matchesOn: number; other: { language: Language; here: number } };
  here?: Array<{ displayName: string; rating: number; state: "here" | "searching" }>;   // signed out only, at most 8
  more?: number;                                                                          // signed out only
  lastMatch?: { matchId: string; opponent: string; you: number; them: number; durationMs: number;
                completedAt: string; youWon: boolean | null; bands: Array<{ tiles: Coordinate[]; seat: "you" | "opp" }> } | null;
  form?: Array<"W" | "L" | "D">;                                                          // at most 10, oldest first
}
```

Signed out, it never returns `lastMatch`, `form` or any player id (FR-040, `contract/overview-public.contract.test.ts`).

## Lobby language

### Server action `enterLobbyAction({ language })`

It is called by the lobby page's server component on render.
- Returns `{ status: "same" | "switched" }`, or `{ status: "needs_confirm", pending: ("search"|"outgoing"|"incoming")[] }`.
- `needs_confirm` makes the page render with finding and challenging off, and the slot shows `switch`.

### Server action `confirmLobbySwitchAction({ language })`

- It calls `confirm_lobby_switch`, then pokes the affected senders and recipients (`outcome`) and both lobbies (`presence`).
- Returns `{ status: "switched" }`.

## Challenges

### Server action `sendChallengeAction({ recipientId })`

It replaces `sendInviteAction`, and calls `send_challenge`. Pokes:
- the recipient gets `challenge`;
- on `crossed`, both players get `table`;
- the sender's own withdrawn earlier recipient gets `outcome`.

Return value: `{ status, inviteId?, matchId?, until? }`, with the statuses from data-model.md. The copy per status:

| Status | EN | IS |
|---|---|---|
| `in_match` | `that player is in a match` | `sá leikmaður er í viðureign` |
| `gone`, `away` | `that player has left` | `sá leikmaður er farinn` |
| `rate_limited` | `too many challenges · wait a minute` | `of margar áskoranir · bíddu í mínútu` |
| `declined_recently` | `again in 0:52` on the row | `aftur eftir 0:52` on the row |
| `cooldown` | the spec 069 string | the spec 069 string |
| `other_lobby`, `self`, `busy_sender`, and any error | `challenge not sent · try again` | `áskorun fór ekki · reyndu aftur` |

### Server action `withdrawChallengeAction({ inviteId })`, and `POST /api/lobby/invite/withdraw` (beacon)

- They call `withdraw_challenge`, and poke the recipient with `outcome`.
- The action returns `{ status }`. The beacon route returns 204.
- The provider sends the beacon on `pagehide` only when this is the viewer's last tab. A tab that is not the last leaves the challenge alone; if it turns out to be the last, the challenge ends as `left` through `settle_gone_players` once the gone rule applies.

### Server action `respondInviteAction({ inviteId, accept })` (changed)

- Accept: `accept_invite` (spec 067), now also refusing `gone` and past `expires_at`. It pokes the sender (`outcome`, then `table`) and the players whose invites were superseded (`outcome`).
- Decline: pending → declined with `responded_at`. It pokes the sender with `outcome`.
- Returns `{ status: "accepted", matchId } | { status: "declined" } | { status: "sender_busy" | "sender_gone" | "expired" }`.

### Retired

`GET /api/lobby/invite` (the 3s invite poll) and `sendInviteAction`. `POST /api/lobby/invite/[id]/respond` stays as a thin wrapper around `respondInviteAction`.

## Cron sweep (`POST /api/cron/sweep-stale-matches`, changed)

It adds three steps after the existing ones:
- `expire_challenges()`, which pokes both sides (`outcome`);
- `settle_gone_players()`, which pokes affected counterparts (`outcome`) and the lobbies (`presence`);
- deleting `presence_tabs` rows that have been stale for more than 10 minutes.

## Redirects (`next.config.ts` `redirects()`, permanent → 308)

| From | To |
|---|---|
| `/lobby` | `/` |
| `/matchmaking` | `/` |
| `/en/lobby` | `/en` |
| `/en/matchmaking` | `/en` |

## Pokes (`lib/realtime/pokes.ts`, server only)

```ts
type PokeKind = "challenge" | "outcome" | "table" | "seat" | "rematch" | "match" | "presence";
pokePlayer(playerId: string, kind: Exclude<PokeKind, "presence">): Promise<void>;   // topic player:{hmac}
pokeLobby(language: Language, opts?: { recheckInMs?: number }): Promise<void>;       // topic lobby:{language}
```

- Payloads carry no ids.
- `lib/match/rematchBroadcast.ts` stops sending `newMatchId` and calls `pokePlayer(both, "rematch")`.
- `seat_player` and the table void (spec 069) add `pokePlayer(both, "seat" | "table")`.
- Match completion adds `pokePlayer(both, "match")`.
- Any failure to publish is logged (`poke.failed`) and swallowed. The fallback poll covers it.
