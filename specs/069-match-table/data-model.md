# Data model: The table

One migration: `supabase/migrations/20260924001_the_table.sql`. It is additive, apart from dropping `start_match_if_ready`.

## `matches` (new columns)

| Column | Type | Rule |
|---|---|---|
| `player_a_seated_at` | timestamptz null | Set once, by `create_match_between` or `seat_player`. |
| `player_b_seated_at` | timestamptz null | Same. |
| `table_deadline_at` ("the time to sit down") | timestamptz null | `created_at + 20s` at creation. Existing pending rows get `created_at + 20s` in the migration. |
| `void_reason` | text null, check in (`not_seated`, `left`) | Non-null exactly when `ended_reason = 'void'`. |
| `voided_by` | uuid null → `players.id` | The unseated player (`not_seated`, null when neither sat) or the leaver (`left`). |

- `ended_reason` check: add `'void'`.
- Invariant (a check constraint): `state = 'in_progress'` implies both `*_seated_at` are not null and `started_at` is not null.
  - The migration first backfills `player_a_seated_at = player_b_seated_at = coalesce(started_at, created_at)` on every non-pending row. A `not valid` constraint would still reject later updates to matches that were live at the release.
  - The constraint is then added as valid.
- Index: `(state, table_deadline_at) where state = 'pending'`, for `find_due_tables`.

### State transitions

```text
pending ──seat_player (2nd seat) / start_table_if_seated──▶ in_progress (started_at = now + 4.5s)
pending ──void_table(not_seated | left)───────────────────▶ completed, ended_reason 'void'
in_progress, before started_at ──leaveTable──────────────▶ completed, ended_reason 'void', void_reason 'left'
in_progress ──(unchanged: moves, settle, resign, end early)──▶ completed
```

A leave during the count (after the start is set, before go) voids the match: `void_table` also accepts `in_progress` while `now() < started_at`.

## `players` (new columns)

| Column | Type | Rule |
|---|---|---|
| `queued_at` | timestamptz null | Set when a search starts from not searching. Kept through a pause and a requeue. Cleared by cancel, the 3:00 stop, and a missed table. |
| `search_paused` | boolean not null default false | True while the search tab is hidden. The queue skips a paused player. |
| `attention_visible` | boolean null | The tab's last reported visibility. |
| `attention_input_at` | timestamptz null | The last reported input time. |
| `attention_at` | timestamptz null | When the attention was last reported. |
| `table_missed_at` | timestamptz null | Set by a `not_seated` void on the unseated player. Read once by the lobby's notice (`you did not sit down · your search stopped`), then cleared. |

- **Seated by attention at creation:** `attention_at > now() − 10s and attention_visible and attention_input_at > now() − 30s`.
- **Queue candidate:** `status = 'matchmaking' and queue_language = L and not search_paused and last_seen_at > now() − 10s`, ordered by `queued_at asc`.
- `cancelQueue` also clears `queue_language` (a current bug).

## Derived: the cooldown

`table_leave_cooldown_until(p)` is computed from `matches`:

```sql
with lefts as (
  select completed_at from matches
  where ended_reason = 'void' and void_reason = 'left' and voided_by = p
    and completed_at > now() - interval '15 minutes'
  order by completed_at desc
)
-- the two most recent: if they are ≤10 minutes apart, the cooldown ends at the later one + 5 minutes
```

It returns null when that time is past.

## `MatchState` (the client contract, `lib/types/match.ts`)

```ts
type SeatKey = "a" | "b";
type TableOrigin = "queue" | "challenge" | "crossed_challenge" | "rematch" | "crossed_rematch" | "link";
type VoidReason = "not_seated" | "left";

interface MatchTable {
  seats: Record<SeatKey, string | null>; // ISO seated time or null
  deadlineAt: string;                    // table_deadline_at
  origin: TableOrigin;
  rematchOf: string | null;              // for the void slip's `result ▸`
  voidReason: VoidReason | null;
  voidedBy: string | null;
}

interface Stakes { win: number; draw: number; loss: number }

interface MatchState {
  // …existing
  table: MatchTable;                         // always present; the room ignores it after go
  stakes: Record<string, Stakes> | null;     // per player id; pending only (the room keeps them for play)
  board: BoardGrid | null;                   // null until both are seated (was always a board)
}
```

`MatchEndedReason` gains `"void"`.

## Room (client, pure)

- **`MoveBeat`** gains `table` (pending, not void) and `void` (ended `void`), before `starting`.
- **`SlipKind`** gains `ready` and `void`. The ranking is match over > end early > resign > ready | void.
- **`ReadySlipModel`**:
  - `label` (`opponent found · 0:14` or `starts in 3`)
  - `headline { name, rating }`
  - `facts`
  - `stakes`
  - `seats[2] { name, you, seated }`
  - `actions: "ready+leave" | "seated+leave" | "none"`
  - `drainMs`
- **`VoidSlipModel`**:
  - `headline` by reason and viewer
  - `body[]`
  - `actions`: queue-seated `cancel`; challenge `challengeAgain`, `lobby`; rematch `result`, `lobby`; otherwise `lobby`
- **The scoreboard's `table` phase** (clock row and sub-lines): `deriveScoreboard` gets the `table` input.
- **`QueueView`** is derived from `{ queuedAt, paused, now, answeredCheckAt }`: one of `searching | paused | stillSearching | stopped | cooldown`.
