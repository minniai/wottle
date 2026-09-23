# Data model: Identity, and one commitment at a time

One additive migration, split into four files so each story lands its own SQL: `20260923001_identity_columns.sql`, `…002_match_creation.sql`, `…003_claim.sql`, `…004_sign_out.sql`. No data is deleted. Existing players start unclaimed.

## players (changed)

| Column | Type | Rule |
|---|---|---|
| `claim_hash` | `text null` | Hex SHA-256 of a device key. Null means unclaimed. Several players may share one value (one browser, several names). Set once by `enter_player` and never overwritten with a different value in this stage. |
| `claimed_at` | `timestamptz null` | Set together with `claim_hash`. |
| `last_entered_at` | `timestamptz null` | Set on every successful entry or renewal. Among the players sharing a `claim_hash`, the one with the latest value is the returning door's name and the one renewal signs in as. |

Index: `players_claim_hash_idx on (claim_hash, last_entered_at desc) where claim_hash is not null`.

`status` is no longer written by entry (it was reset to `available` by the old upsert).

## matches (changed)

| Column | Type | Rule |
|---|---|---|
| `origin` | `text null` check in (`queue`, `challenge`, `crossed_challenge`, `rematch`, `crossed_rematch`, `link`) | Written only by `create_match_between`. Null for matches created before this migration. |
| `origin_ref` | `uuid null` | The invite, rematch request or (later) link that caused the match. Null for `queue`. |

The invariant is enforced by the functions below, not by a constraint: at most one match in (`pending`, `in_progress`) per player. A partial unique index cannot express "per player across two columns" without a helper table. The row locks in `create_match_between` serialise every creator, and the concurrency test (SC-004) pins it.

## match_invitations (changed)

The `status` check widens to (`pending`, `accepted`, `declined`, `expired`, `withdrawn`, `superseded`).

| Transition | By |
|---|---|
| pending → accepted | `accept_invite` (compare-and-set) |
| pending → declined | `respondToInvite` decline (unchanged) |
| pending → expired | `expireStaleInvites` (unchanged) |
| pending → withdrawn | `create_match_between` (the sender's other outgoing invites), `sign_out_player` |
| pending → superseded | `create_match_between` (invites addressed to either player); `accept_invite` when the sender is busy |

## rematch_requests (changed)

The `status` check widens the same way. `accept_rematch` does pending → accepted. `create_match_between` and `sign_out_player` apply the withdrawn/superseded transitions as for invites. `cancelRematch` keeps writing `expired`.

## Cookies (browser)

| Name | Value | Lifetime | Flags |
|---|---|---|---|
| `wottle-playtest-session` | `v1.<b64url payload>.<b64url HMAC-SHA256>`; payload `{ playerId, username, displayName, issuedAt, expiresAt }` | 4h | httpOnly, SameSite=Lax, Secure (prod) |
| `wottle-device` | 32 random bytes, base64url | 1 year, re-set on entry and renewal | httpOnly, SameSite=Lax, Secure (prod) |
| `wottle-signed-out` | `1` | 1 year | httpOnly, SameSite=Lax, Secure (prod) |

## Functions (security definer, `search_path = ''`, execute granted to `service_role` only)

- `enter_player(p_username citext, p_display_name text, p_claim_hash text) → jsonb`
  `{status:'entered', player}` | `{status:'name_taken'}`
- `resolve_claim(p_claim_hash text) → jsonb`
  The player with this hash and the latest `last_entered_at`, stamping it; `{status:'unknown'}` if none.
- `create_match_between(p_a uuid, p_b uuid, p_language text, p_origin text, p_ref uuid) → jsonb`
  `{status:'created', match_id}` | `{status:'busy', player_id}` | `{status:'invalid', reason}` (same player twice, unknown player, bad language or origin)
- `accept_invite(p_invite uuid, p_actor uuid, p_ttl_seconds int, p_origin text default 'challenge') → jsonb`
  `created` | `busy` | `{status:'not_pending'}` | `{status:'not_recipient'}` | `{status:'expired'}`
- `accept_rematch(p_request uuid, p_actor uuid, p_origin text default 'rematch', p_ttl_seconds int default 30) → jsonb`
  as `accept_invite`, plus `{status:'not_completed'}`
- `pair_from_queue(p_self uuid, p_opponent uuid, p_language text) → jsonb`
  `created` | `busy` | `{status:'not_searching'}`
- `sign_out_player(p_player uuid) → jsonb`
  `{status:'signed_out'}` | `{status:'in_match', match_id}`

Invite expiry stays computed from `created_at`; the caller passes `PLAYTEST_INVITE_EXPIRY_SECONDS` as `p_ttl_seconds`, so the environment variable keeps one reader.

## TypeScript types

- `lib/auth/sessionToken.ts`: `SessionPayload`, `signSession(payload, secret): string`, `verifySession(value, secret, now): SessionVerification` (`{ok:true, payload}` | `{ok:false, reason}`).
- `lib/auth/deviceKey.ts`: `newDeviceKey(): string`, `hashDeviceKey(key): string`.
- `lib/match/createMatch.ts`: `MatchOrigin`, `CreateMatchResult` (`created` | `busy` | …), plus thin typed wrappers over the four RPCs. They are the only TS callers of those RPCs.
- `LobbySession` narrows to `{ player: { id, username, displayName }, issuedAt, expiresAt }`.
- `ReturningPlayer`: `{ displayName, rating: number | null }`.
