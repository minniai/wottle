# Data model: Invite links and profiles

One additive migration, `supabase/migrations/20260927001_invite_links_profiles.sql`.

## Table `match_links` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` pk default `gen_random_uuid()` | |
| `token_hash` | `bytea not null unique` | `sha256(token)`; the token itself is never stored (FR-003) |
| `sender_id` | `uuid not null references players(id) on delete cascade` | |
| `language` | `text not null check (language in ('is','en'))` | the sender's `lobby_language` at creation (FR-002) |
| `status` | `text not null default 'pending' check (status in ('pending','used','cancelled','expired','withdrawn','superseded'))` | |
| `created_at` | `timestamptz not null default now()` | |
| `expires_at` | `timestamptz not null` | `created_at + 10 minutes` (config, passed in) |
| `responded_at` | `timestamptz` | set on every move out of `pending` |
| `used_by` | `uuid references players(id) on delete set null` | the accepter |
| `match_id` | `uuid references matches(id) on delete set null` | the table it created |

**Indexes:**
- `unique (token_hash)`;
- `(sender_id, created_at desc)`, for standing and rate limits;
- a partial index on `(expires_at) where status = 'pending'`, for the sweep;
- `unique (sender_id) where status = 'pending'`, so a sender holds at most one live link.

RLS is enabled, with no policies: service role only, like `match_invitations`.

### Lifecycle

```text
pending ──accept (CAS, created)─────────> used        (match_id, used_by)
   │  ──cancel ▸ ───────────────────────> cancelled
   │  ──new link / challenge / search /
   │    accept elsewhere / lobby switch /
   │    sign out ───────────────────────> withdrawn
   │  ──expires_at passed (sweep, lazily
   │    at read and accept) ────────────> expired
   └──accept refused, sender busy ──────> superseded
```

Every status other than `pending` reads as `this link has expired` to a visitor (FR-013).

## Functions (security definer, `search_path = ''`, service role only)

| Function | Kind | Behaviour |
|---|---|---|
| `create_link(p_sender uuid, p_token_hash bytea, p_ttl_seconds int) → jsonb` | new | Locks the sender. Refuses `busy_sender` (a pending or live match), `cooldown` (`table_leave_cooldown_until`), `rate_limited` (invitations + links in the last minute ≥ 6). Withdraws pending challenges and links, and cancels the search, as `send_challenge` does. Inserts. Returns `{status:'created', link_id, expires_at, withdrawn_from}`. |
| `read_link(p_token_hash bytea) → jsonb` | new, **stable** | `{found, valid, sender_id, sender_name, sender_handle, language, expires_at}`. `valid` = `status = 'pending' and expires_at > now()`. No writes (R4). |
| `accept_link(p_token_hash bytea, p_actor uuid) → jsonb` | new | Returns `expired` when not found, not pending or past expiry (and marks it `expired` in the last case), and `own` when the actor is the sender. It locks the players in id order and the link `for update`, re-checks, then calls `create_match_between(sender, actor, language, 'link', link_id, array[actor])`. On `created` it sets `status='used'`, `used_by`, `match_id`, `responded_at`, and `matches.table_deadline_at = expires_at`. On `busy`: if the actor is busy it returns `busy` and the link is unchanged; if the sender is busy it sets `superseded` and returns `expired`. |
| `cancel_link(p_sender uuid, p_link uuid) → jsonb` | new | `pending` → `cancelled`; else `not_pending`. |
| `expire_links() → table(link_id, sender_id)` | new | Marks every `pending` link past `expires_at` as `expired`; consumed by the sweep for pokes. |
| `best_words(p_player uuid, p_language text, p_limit int) → table(word, points, tiles jsonb, match_id)` | new, stable | R14: the best words, distinct, from completed, non-void matches. |
| `presence_word(p_player uuid, p_language text) → jsonb` | new, stable | `{state: here\|in_match\|away\|other_lobby\|not_here, moves_played}`. Never a timestamp (FR-041). |
| `send_challenge` | changed | Also withdraws the sender's pending link; the rate limit counts links. |
| `create_match_between` | changed | Also withdraws both players' pending links (`withdrawn`), except `p_ref` when `p_origin = 'link'`. |
| `void_table` | changed | R9: on a link table, a `left` by the seated player while the other seat is empty becomes `not_seated`, voided by the unseated player. |
| `sign_out_player` | changed | Withdraws the player's pending link. |
| `lobby_pending` / `confirm_lobby_switch` | changed | `'link'` counts as pending and is withdrawn on switch. |

`tests/unit/matchmaking/link-one-caller.test.ts`: `create_link`, `read_link`, `accept_link`, `cancel_link` and `expire_links` are called only from `lib/matchmaking/linkService.ts`.

## Types (TypeScript)

```ts
// lib/types/link.ts
export type LinkStatus = "pending" | "used" | "cancelled" | "expired" | "withdrawn" | "superseded";

export interface LinkView {            // what the invite door and the call read (no ids beyond the sender's handle)
  valid: boolean;
  senderName: string;
  senderHandle: string;
  senderRating: number;               // in the link's language
  language: Language;
  expiresAt: string;                  // ISO
}

export interface OutgoingLink {        // StandingFacts.link
  id: string;
  status: LinkStatus;
  expiresAt: string;
  respondedAt: string | null;
}

export type CreateLinkResult =
  | { status: "created"; linkId: string; url: string; expiresAt: string }
  | { status: "busy_sender" | "rate_limited" | "unauthenticated" | "error" }
  | { status: "cooldown"; until: string };

export type AcceptLinkResult =
  | { status: "created"; matchId: string }
  | { status: "expired" | "own" | "busy" | "unauthenticated" | "error" }
  | { status: "sign_in_failed"; code: ErrorCode };
```

`StandingFacts` (Zod, `lib/types/standing.ts`) gains `link: OutgoingLink | null`. `SlotState` gains `{ kind: "link"; link: OutgoingLink | null; held: HeldOutcome | null }`. `IncomingCall` gains the variant `{ kind: "link"; token: string; view: LinkView }`, alongside the challenge call. It lives in client state only and never comes from `/api/standing` (R6).

```ts
// lib/types/profile.ts — replaces PlayerProfile for pages
export interface ProfileView {
  playerId: string;
  handle: string;
  displayName: string;
  language: Language;
  rating: number;
  peak: number;
  weekChange: number;                 // 0 hides the clause
  matches: number;                    // rated, played, this language
  firstPlayedAt: string | null;       // month shown; null → new player
  record: { won: number; lost: number; drawn: number; winRate: number | null };
  lastTen: FormResult[];              // oldest first
  chart: { at: string; rating: number }[]; // 30-day series, first point = rating at window start
  bestWords: ProfileWord[];           // ≤ 3
  otherLanguage: { language: Language; rating: number; matches: number };
  matchesList: ProfileMatchRow[];     // own: recent 8; public: vs viewer
  presence: PresenceWord | null;      // public only
}
export type PresenceWord = { state: "here" | "in_match" | "away" | "other_lobby" | "not_here"; movesPlayed: number | null };
export interface ProfileWord { word: string; points: number; tiles: { letter: string; value: number }[] }
export interface ProfileMatchRow { matchId: string; opponentName: string; opponentHandle: string; own: number; theirs: number; result: FormResult; endedAt: string }
```

No field of `ProfileView` holds a last-seen time. A unit test fails if one is added (`Object.keys` against an allow-list).

## Existing data read, unchanged

- `match_ratings (player_id, language, rating_before, rating_after, match_result, created_at, match_id)`: chart, peak, week change, last ten, first played.
- `player_ratings (player_id, language)`: rating and record.
- `word_score_entries` + `matches`: best words.
- `matches` (`origin = 'link'`, `origin_ref = match_links.id`, `table_deadline_at`): the link table.
- `presence_tabs`, `players.lobby_language`: presence word.

## Validation rules

| Rule | Where |
|---|---|
| The token is 43 base64url chars; anything else reads as expired without a query | `lib/matchmaking/linkToken.ts` (Zod) |
| Link life = `LINK_TTL_MS` (600 000) | `lib/constants/links.ts`, passed to `create_link` |
| At most one pending link per sender | partial unique index + `create_link` |
| The handle is percent-decoded once, NFC-normalised and lowercased | `lib/profile/readHandle.ts` (existing), extended |
| The `?from=` on rules is validated as a same-origin match path | `lib/auth/nextParam.ts` |
