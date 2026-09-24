# Contract: routes and actions

Every input is validated with Zod at the entry point. Every server action has an explicit return type and a rate-limit scope.

## GET `/api/match/[matchId]/moves` (new, S9)

**Access:** public. It needs no session. It is served only when `matches.state = 'completed'` and `ended_reason <> 'void'`.

| Case | Status | Body |
|---|---|---|
| a completed match that is not void | 200 | `MovesResponse` |
| void, pending, in progress, or unknown id | 404 | `{ error: "not_found" }` (the same body for each, so a live match's existence is not revealed) |
| malformed id | 400 | `{ error: "invalid_id" }` |

```ts
interface MovesResponse {
  matchId: string;
  language: "is" | "en";
  players: { a: { id: string; displayName: string }; b: { id: string; displayName: string } };
  startedAt: string;
  durationMs: number;            // deadline_at − started_at
  moveLimit: number;
  endedReason: MatchEndedReason;
  completedAt: string;
  winnerId: string | null;
  finalScores: { a: number; b: number };
  initialBoard: BoardGrid;       // the first move's board_before (or matches.board when there are no moves)
  moves: ReviewMoveRow[];        // ordered by global_seq; resolved and rejected only
}
```

- One select from `match_moves`, with `word_score_entries(*)` embedded through `move_id`, plus one select from `matches`. Both use the service-role client, in `lib/review/movesRepository.ts`.
- `Cache-Control: public, max-age=31536000, immutable`, because a completed match never changes.
- The payload holds no identity data beyond the display names already shown on the page.
- Contract tests:
  - signed out, a completed match returns 200;
  - a live match returns 404;
  - a void match returns 404;
  - the last move's totals plus the closing penalties equal `finalScores`.

## GET `/api/match/[matchId]/state` (changed)

- For a completed match, the route attaches `rematch: RematchOffer`, computed for the caller by `readRematchOffer` after `loadMatchState`; it is absent from every broadcast (contract test: a `state` broadcast payload has no `rematch` key). `series` comes from the loader (data-model.md). It still returns 403 to non-participants, since review reads `/moves`.
- `rematchMatchId` is removed at the end of the spec, once no client reads it. Until then it mirrors `rematch.request?.newMatchId`.
- `readRematchOffer` calls `expire_due_rematches` first (lazy expiry).

## POST `/api/presence/beat` (changed)

The body gains `matchId?: string` (a uuid), sent only when `page = 'match'`. It is forwarded to `beat_tab(p_match_id)`.

## Server actions (`app/actions/match/`)

| Action | Input | Result | Calls |
|---|---|---|---|
| `requestRematchAction` | `{ matchId }` | `{ status: "sent"; requestId; expiresAt } \| { status: "accepted"; newMatchId } \| { status: "refused"; reason: RematchRefusal } \| { status: "error"; code: ErrorCode }` | `request_rematch`. If crossed, then `announceRematch` (poke both, payload-free). |
| `respondToRematchAction` | `{ requestId, answer: "accept" \| "decline" }` | accept: `{ status: "accepted"; newMatchId } \| { status: "expired" } \| { status: "busy" }`. decline: `{ status: "declined" }` | `accept_rematch` / `decline_rematch`. Pokes both. |
| `withdrawRematchAction` | `{ requestId }` | `{ status: "withdrawn" } \| { status: "refused"; reason }` | `withdraw_rematch`, then a poke. Replaces `cancelRematch`. |

- `new opponent ▸` and `lobby` call `withdrawRematchAction` before they navigate whenever a request is pending. From the requester it writes `withdrawn`. From the responder it writes `superseded`, which the requester reads as `Kári started another match` (T42). Neither starts a cooldown.
- Rate limit: scope `match:rematch`, 6 per minute per player. The old limit was 5 per minute on request only.
- Every rematch function is called only from `lib/match/rematchService.ts`. A grep test keeps it that way, like `one-way-to-make-a-match`.

## Pages

| Route | Change |
|---|---|
| `app/[locale]/(room)/match/[matchId]/page.tsx` | Signed out and completed, not void: render read-only. Signed out and not completed: the door with `?next=`, as today. Non-participant and completed: read-only, and `?review` is kept. Every redirect keeps the query string. Void: `/`. |
| `app/[locale]/match/[matchId]/summary/page.tsx` | Redirects to `/match/:id?review=last` in the match's locale. |

## Cron sweep (`app/api/cron/sweep-stale-matches`)

A new step calls `expire_due_rematches()` and pokes both players of each match it returns.
