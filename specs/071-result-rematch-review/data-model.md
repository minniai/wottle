# Data model: The result, rematch and review

This spec has one additive migration, `supabase/migrations/20260926001_result_rematch_review.sql`. It deletes no data.

## Schema changes

### `presence_tabs` (spec 070)

| Column | Type | Rule |
|---|---|---|
| `match_id` | `uuid null` references `matches(id)` on delete set null | Set by `beat_tab` when `p_page = 'match'`; null on every other page. |

A partial index on `(match_id) where match_id is not null`.

### `rematch_requests` (spec 016)

| Column | Change | Rule |
|---|---|---|
| `expires_at` | **new** `timestamptz not null default now() + interval '30 seconds'` | Backfilled as `created_at + 30s`. Read by `accept_rematch`, `expire_due_rematches` and the client's drain. |
| `status` | the check is unchanged: `pending, accepted, declined, expired, withdrawn, superseded` | The requester's cancel now writes `withdrawn`, not `expired`. |
| `UNIQUE (match_id)` | unchanged | One request per match (FR-011). A crossed send is the second player accepting. |

### `matches`

| Column | Change |
|---|---|
| `ended_reason` | The check is widened with `'ended_early'`. It settles like `incomplete`: unplayed moves are penalised, and the winner is decided by the normal rules. `claimWin` passes `"ended_early"` as a natural completion reason. |

## Functions

All are `security definer`. Only `lib/match/rematchService.ts` calls the rematch functions, and only `lib/presence/presenceService.ts` calls `beat_tab`.

| Function | Change | Returns |
|---|---|---|
| `player_on_match(p_player uuid, p_match uuid) → boolean` | new | Whether any `presence_tabs` row for the player has `match_id = p_match` and `tab_is_fresh`, visible or hidden. |
| `pair_cooldown_until(p_sender uuid, p_recipient uuid) → timestamptz` | new | 60s after the latest of: a declined, non-auto `match_invitations` row from sender to recipient; a `rematch_requests` row with requester = sender, responder = recipient and status `declined` or `expired` (its `responded_at`). Null when that time has passed. |
| `send_challenge` | its cooldown uses `pair_cooldown_until` | `declined_recently` with `until`, as today. `challenger_silenced` is unchanged (clarification Q1). |
| `beat_tab` | takes `p_match_id uuid default null` | as today |
| `request_rematch(p_match uuid, p_actor uuid) → jsonb` | new | See the state machine below. `{status: 'sent', requestId, expiresAt}` · `{status: 'accepted', newMatchId}` (crossed) · `{status: 'refused', reason}` with reason in `not_completed`, `not_participant`, `window_closed`, `opponent_left`, `self_left`, `already_requested`, `busy`. |
| `accept_rematch` | adds `now() <= expires_at` for `p_origin = 'rematch'`, and expires a row whose time has passed | as today |
| `decline_rematch(p_request uuid, p_actor uuid) → jsonb` | new | `{status: 'declined'}` · `{status: 'refused', reason: 'not_responder' \| 'not_pending'}` |
| `withdraw_rematch(p_request uuid, p_actor uuid) → jsonb` | new; also called by `new opponent ▸` and `lobby` | The requester's call writes `withdrawn`. The responder's (leaving for a new opponent or the lobby) writes `superseded`. Returns `{status}` or `{status: 'refused', reason}`. Neither starts a cooldown. |
| `expire_due_rematches() → setof uuid` | new; called from the cron sweep and lazily by `readRematchOffer`. It also supersedes pending rows whose responder has no fresh tab on the match (no cooldown) | the match ids of rows moved to `expired`, with `responded_at = expires_at`, so both players can be poked |
| `rematch_series(p_match uuid) → table(match_id uuid, winner_id uuid, ordinal int)` | new | A recursive CTE backwards over `matches.rematch_of`, at most 50 deep, ordered oldest first. Void matches are skipped. |

### Rematch request state machine

```
(none) ──request_rematch(actor A, window open, both on match)──▶ pending(A→B, expires_at = now+30s)
pending ──request_rematch(actor B)──────────────▶ accepted (crossed_rematch, new match)
pending ──accept_rematch(B, before expires_at)──▶ accepted (new match via create_match_between)
pending ──decline_rematch(B)─────────────────────▶ declined   → pair cooldown A→B 60s
pending ──expires_at passes──────────────────────▶ expired    → pair cooldown A→B 60s
pending ──withdraw_rematch(A) / A's new opponent or lobby / sign-out ─▶ withdrawn (no cooldown)
pending ──withdraw_rematch(B): B's new opponent or lobby ─────────▶ superseded (no cooldown)
pending ──sweep: player_on_match(B) is false ────────▶ superseded (no cooldown; A reads `Kári has left`)
pending ──create_match_between for A or B elsewhere─▶ withdrawn (A's own) / superseded (addressed to B)
accept refused busy ─────────────────────────────▶ superseded; both read `<name> started another match`
```

Terminal states never return to `pending`, and the unique constraint forbids a second row. `rematch ▸` is offered only while no row exists, with `now() ≤ completed_at + 120s` and `player_on_match` true for both players.

## Types (`lib/types/match.ts`)

```ts
export type RematchRefusal =
  | "not_completed" | "not_participant" | "window_closed" | "opponent_left" | "self_left"
  | "already_requested" | "declined" | "expired" | "withdrawn" | "superseded" | "busy";
// request_rematch's `refused.reason` and RematchOffer.reason both use this one type.

export interface RematchRequestView {
  id: string;
  requesterId: string;
  status: "pending" | "accepted" | "declined" | "expired" | "withdrawn" | "superseded";
  createdAt: string;
  expiresAt: string;
  newMatchId: string | null;
}

export interface RematchOffer {
  offered: boolean;                 // the viewer may press `rematch ▸` now
  reason: RematchRefusal | null;    // why not, when not offered
  request: RematchRequestView | null;
  windowEndsAt: string;             // completed_at + 2:00
  cooldownUntil: string | null;     // pair_cooldown_until(viewer, opponent)
  opponentOnMatch: boolean;         // `has left` when false
  opponentHere: boolean;            // gates `challenge again ▸`
}

export interface SeriesView { ordinal: number; leaderId: string | null; wins: { a: number; b: number } }

// Never part of loadMatchState: statePublisher broadcasts that object to both players.
// readRematchOffer(client, matchId, viewerId) in lib/match/rematchOffer.ts computes it for the
// caller; only /api/match/[id]/state and the match page attach it, for participants.
rematch?: RematchOffer;             // replaces rematchMatchId (removed at the end of the spec)
series?: SeriesView | null;         // on any match with table.rematchOf
```

`MatchEndedReason` gains `"ended_early"`, and `CompletionReason` gains it as a natural reason.

## Review (`lib/review/`, pure; not persisted)

```ts
export interface ReviewMoveRow {        // from GET /api/match/:id/moves
  globalSeq: number;
  slot: "player_a" | "player_b";
  seq: number | null;                   // null when refused
  status: "resolved" | "rejected";
  rejectionReason: "frozen" | "moved" | null;
  swap: { from: Coordinate; to: Coordinate };
  receivedAt: string;
  boardAfter: BoardGrid;
  frozenAfter: FrozenTileMap;
  scoreAfter: { a: number; b: number };
  delta: number;
  words: WordScore[];                   // with tiles, in scored order
}

export type ReviewStepKind = "move" | "refused" | "closing";

export interface ReviewStep {
  index: number;                        // 1-based; ?review=index
  kind: ReviewStepKind;
  slot: "player_a" | "player_b" | null; // null for the closing step
  moveNumber: number | null;            // the mover's n-th counted move
  clockMs: number;                      // time left when received (closing: 0, or the time left at an early end)
  swap: { from: Coordinate; to: Coordinate } | null;
  board: BoardGrid;                     // after the step
  frozen: FrozenTileMap;
  words: WordScore[];                   // this step's words
  points: number;                       // this step's delta (−5 for a miss; the penalties for closing)
  totals: { a: number; b: number };     // after the step
  movesPlayed: { a: number; b: number };
  frozeCount: number;                   // letters this step froze
  closing?: { reason: "time" | "ended_early"; unplayed: { a: number; b: number } };
}
```

Functions (each pure and unit-tested):
- `buildReviewSteps(moves, facts) → ReviewStep[]`. The invariant: `last.totals` equals the match's recorded scores, and `last.board` equals `matches.board`.
- `parseReviewParam(raw: string | null, stepCount: number) → { step: number; canonical: string }`
- `stepAtFraction(x: number, stepCount: number) → number`
- `cursorLines(step, names, copy) → { line1: string; line2: string }`
- `scrubberValueText(step, stepCount, names, copy) → string`
- `ledgerCellStates(steps, k) → Map<string, "reached" | "current" | "ahead">`, keyed `slot:moveNumber`
- `bandsAtStep(steps, k) → WordScore[]` with each word's `current` flag, fed to `bandsFromWords`

## Result (`lib/room/`, pure)

- `resultDetail(endedReason, facts, copy) → string[]`. It returns the clauses, and the caller joins them with ` · `. On a phone the first two clauses are shown.
- `bestWordOf(words, viewerSlot) → { word: string; points: number } | null`
- `deriveRematchView(offer, viewer, opponentName, nowMs, copy) → RematchView`. `RematchView` is the slip's action row 1, or the ledger call line, with its seconds left, drain fraction, actions and guard key.
- `resultTitle(verdict, copy) → string`, e.g. `Birna wins · Wottle`
