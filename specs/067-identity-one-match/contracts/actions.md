# Contract: server actions and routes

Every result is typed in `lib/types/`, and every input is validated with zod. `ErrorCode` gains `name_taken`, `opponent_busy` and `sign_out_in_match` (a parity test covers both copy files).

## `loginAction(prevState, formData)`: `app/actions/auth/login.ts` (changed)

Input: `username` (3–24 characters, unchanged rule) and `language`.

| Case | Result | Cookies set |
|---|---|---|
| rate limited | `{status:'error', code:'rate_limited'}` | none |
| invalid name | `{status:'error', code:'invalid_name'}` | none |
| claimed by another key | `{status:'error', code:'name_taken'}` | none |
| entered | `{status:'success', player}` (`sessionToken` removed from the result) | session, device (created if absent), signed-out deleted |

Order: rate limit, then zod, then `enter_player`. `POST /api/auth/login` mirrors this and returns `409 {code:'name_taken'}` when the name is taken.

## `enterAsReturningAction(language)`: `app/actions/auth/enterAsReturning.ts` (new)

| Case | Result |
|---|---|
| no device key, or the key is unknown | `{status:'error', code:'login_failed'}`; the device cookie is cleared |
| known | `{status:'success', player}`; session set, signed-out deleted, presence created in `language` |

Rate limited under `auth:login`.

## `logoutAction()`: `app/actions/auth/logout.ts` (changed; `LogoutInput` removed)

| Case | Result |
|---|---|
| no session | `{status:'signed-out'}` |
| live match | `{status:'refused', code:'sign_out_in_match'}`; nothing changes |
| otherwise | `{status:'signed-out'}`: `sign_out_player` has run, presence expired, session deleted, `wottle-signed-out=1` set, device kept |

`resignedMatchId` is removed from the result, and `resignMatch` is no longer imported.

## `respondInviteAction` and `POST /api/lobby/invite/[inviteId]/respond` (changed)

Accept goes through `acceptInvite(inviteId, actor)`, which wraps the `accept_invite` RPC.

| RPC result | Action result |
|---|---|
| `created` | `{status:'accepted', matchId}` (unchanged) |
| `busy` | `{status:'error', code:'opponent_busy', name}`, where `name` is the display name of the player who is busy |
| `not_pending` / `expired` | `{status:'error', code:'invite_expired'}` (existing code) |
| `not_recipient` | 403 / `{status:'error', code:'forbidden'}` |

Decline is unchanged.

## `sendInviteAction` and `POST /api/lobby/invite` (changed)

- The sender's status is no longer written.
- If a pending invite from the recipient to the sender exists, the action calls `accept_invite(reverse, sender, 'crossed_challenge')` and returns `{status:'accepted', matchId}` (a new variant). The client routes it the same way an accepted outgoing invite is routed today.
- Otherwise it behaves as today.

## Rematch (changed)

- `acceptRematchAction` calls `accept_rematch(request, actor)`. `busy` becomes `{status:'error', code:'opponent_busy', name}`.
- In `requestRematchAction`, a crossed request calls `accept_rematch(opponentRequest, caller, 'crossed_rematch')`.
- The broadcast and match log after `created` are unchanged.

## Queue (changed)

`startAutoQueue` replaces the conditional status update plus `bootstrapMatchRecord` with `pair_from_queue(self, opponent, language)`. `busy` and `not_searching` both mean "try the next candidate, else stay queued".

## Removed

- `bootstrapMatchRecord` (`lib/matchmaking/service.ts`) and `createRematchMatch` / `setPlayersInMatch`: their work moves into SQL.
- `releaseOtherChallengers` / `releaseSenders`: `create_match_between` does this now, and senders are no longer marked.
- A grep test (`tests/unit/match/one-way-to-make-a-match.test.ts`) fails if `from("matches").insert` / `.upsert` appears anywhere under `app/` or `lib/` (SC-006).

## `proxy.ts` (changed)

- The matcher gains `/api/*`.
- Renewal runs before locale routing (research R4).
- Response headers are otherwise unchanged.
