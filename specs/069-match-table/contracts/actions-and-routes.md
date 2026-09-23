# Contract: server actions and routes

Every action validates its input with Zod, reads the session with `readLobbySession()`, and returns a typed result. Errors are `ErrorCode`s (`lib/i18n/types.ts`).

## `seatAction({ matchId }) → { status: "seated" | "started" | "void" | "late" }`
- Rate limit: `matchmaking:table` (20/min).
- Calls `seat_player` with `boardFor(match)`, `TABLE_LEAD_MS = 4_500` and `MATCH_CLOCK_MS`.
- On `late`, it calls `voidDueTable(matchId)` and returns `void`.
- On `seated` or `started`, it publishes the match state (`statePublisher`).

## `leaveTableAction({ matchId }) → { status: "void" | "not_pending" }`
- Rate limit: `matchmaking:table`.
- Calls `void_table(match, 'left', viewer)` and publishes.
- The client then routes to the lobby.

## `resignMatchAction` (changed)
- Refuses `pending`, and `in_progress` before `started_at`, with `ErrorCode` `not_started`.

## `startQueueAction({ language, attention })` (changed)
- **Input:** `attention: { visible: boolean, inputAgoMs: number }`. It is recorded on the player; the server computes `attention_input_at = now() − inputAgoMs`, clamped to 0..10 minutes.
- **Refusal:** `{ status: "cooldown", until }` when `table_leave_cooldown_until` is set.
- **Hidden poll:** a poll with `visible:false` sets `search_paused = true` and returns `{ status: "paused" }`.
- **Result:** `{ status: "queued", queuedAt }` or `{ status: "matched", matchId }`.
- **Candidates and order:** per data-model.

## `resumeQueueAction({ language }) → { status: "queued", queuedAt }`
Clears `search_paused` and keeps `queued_at`.

## `cancelQueueAction({ reason?: "user" | "timeout" })` (changed)
Also clears `queued_at` and `queue_language`.

## `POST /api/matchmaking/pause` (new, beacon)
Sets `search_paused = true` for the session's player when they are `matchmaking`, and returns 204.

## `sendInviteAction` (changed)
Refuses with `ErrorCode` `table_cooldown` (and `until`) during the cooldown. Accepting is not gated (clarification Q1).

## `GET /api/match/active?visible=0|1&inputAgoMs=n` (changed)
- Records the attention.
- Returns `{ match: { id, state } | null, cooldownUntil: string | null, notice: "table_missed" | null }`.
- `notice` is set, then cleared, from `players.table_missed_at`.

## `GET /api/match/[matchId]/state` and the match page (changed)
- Accepts `?visible=0|1&inputAgoMs=n` and records the attention, as `/api/match/active` does.
- `loadMatchState` no longer starts a match.
- For a pending match:
  - past its deadline, it calls `voidDueTable` first;
  - with both seats set but not started, it calls `start_table_if_seated`.
- It returns `table`, `stakes` (pending only), and `board: null` until `in_progress`.

## Cron: `POST /api/cron/sweep-stale-matches` (changed)
Adds `find_due_tables()` → `voidDueTable(id)` for each.
