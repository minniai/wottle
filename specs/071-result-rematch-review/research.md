# Research: The result, rematch and review

Decisions for spec 071. Each records what was chosen, why, and what was rejected. File references are to the tree at `main` 2078100e.

## R1 · Review data: one public moves route built from `match_moves`

**Decision.** Add `GET /api/match/[matchId]/moves`. It makes one select of `match_moves` ordered by `global_seq`, embeds `word_score_entries` by `move_id`, and returns the match's facts: players, started_at, move_limit, duration, ended_reason, completed_at and the final scores. It serves only completed matches that are not void, and it needs no session. It reads with the service-role client, because RLS on `match_moves` admits only participants.

**Rationale.** Every move row already carries what a step needs: `board_before` and `board_after`, `frozen_after`, `score_a_after` and `score_b_after`, the swap (`from_x/y`, `to_x/y`), `received_at`, `status` and `rejection_reason` (`20260921001_async_moves.sql:66-92`). A refused row has `board_after = board_before` and delta 0. The first row's `board_before` is the starting board. Nothing has to be replayed, and a 20-step match is about 4 KB of boards.

**Alternatives.**
- Reuse `/words`. It needs a session and carries no swap or boards (`lib/match/wordHistory.ts:8-13`).
- Rebuild boards on the client by replaying swaps backwards from the final board. That duplicates server state and breaks on refusals.
- Put the steps in `MatchState`. It would bloat every state poll.

## R2 · The time step is derived, not stored

**Decision.** `buildReviewSteps` appends a synthetic closing step whenever a natural settlement penalised unplayed moves: `ended_reason ∈ {incomplete, both_incomplete, ended_early}` and some player has fewer than `move_limit` moves. Its penalty per player is `timeoutPenalty(limit − movesPlayed)` (`lib/scoring/missPenalty.ts`). The step reads `time · −N not played` at 0:00, and `ended early · −N not played` when the match was ended early. An early end settles naturally (`claimWin` → `completeMatchInternal(…, "natural")`), so the absent player's unplayed moves are penalised there too. A test pins the invariant that the last step's totals equal `matches.player_*_score` for every fixture (SC-006). A resigned (`forfeit`) match applies no penalties and stops at the last received move.

**Rationale.** Unplayed penalties are written only into the match totals in the completion compare-and-set (`completeMatch.ts:132-162`). No move row holds them.

**Alternatives.** Insert penalty rows at settlement. That changes the settlement transaction and old matches would still lack them.

## R3 · Review is a state of the match controller, driven by `?review`

**Decision.**
- `MatchRoomController` reads `useSearchParams().get("review")`. When the match is completed and the parameter is present, the room is in **review**. `parseReviewParam(raw, stepCount)` (pure) clamps it: `last`, empty, out of range or not a number all go to the last step.
- A `useReview` hook loads the steps once, owns the step index and autoplay, and writes the URL with the native History API. `pushState` on entry carries `{kind:"review"}`, and `replaceState` changes the step. The Next.js 16 App Router syncs `useSearchParams` with native `pushState`/`replaceState`, so nothing remounts.
- On a match that is not completed, the parameter is removed with `replaceState`.

**Rationale.** FR-030 requires the same field with no remount. The Field is prop-driven and keyless under a stable Room, so a step only changes its `board`, `frozenTiles`, `bands`, `ticks` and `exchange` props.

**Alternatives.** `router.push`/`router.replace` for each step. That re-runs the server component and needlessly re-fetches the state RSC.

## R4 · History entries: guard → result → review

**Decision.**
- On completion, `useLiveBackGuard` replaces its leftover `{kind:"guard"}` entry with `{kind:"result"}`, so it never pops to a same-URL guard.
- Entering review pushes `{kind:"review"}`.
- `◂ result` calls `history.back()` when the current entry is a review entry. Otherwise, when review was opened directly, it `replaceState`s to the plain URL.
- `popstate` with no `review` parameter restores the slip (`restoreSlip`).
- An accepted rematch navigates with `router.replace` (T40), not `push` as today (`MatchRoomController.tsx:144`).

**Rationale.** Back from review reaches the result, and one Back from the result reaches the lobby (FR-007, US4.3).

## R5 · Being on the match: `presence_tabs.match_id`

**Decision.**
- Add `presence_tabs.match_id uuid null`. The tab beat sends it when `page='match'`, from the match controller's route params through `useTabPresence`.
- A pure SQL helper `player_on_match(player, match)` means a fresh tab (`tab_is_fresh`) on this match, **visible or hidden** (clarification Q2).
- The opponent's `has left` and the offer read it.

**Rationale.** `presence_tabs` knows only `page='match'`, not which match. `match_heartbeats` is written only while a tab polls `/state`, and hidden tabs throttle polls. The per-tab beat already runs every 10s visible and 30s hidden, is fresh for 3 beats + 5s, and its closing beacon clears it in 8s. That is exactly "a fresh tab on this match".

**Alternatives.** `match_heartbeats` with `source='match'` within 10s. A hidden tab's throttled poll would read as gone, which contradicts Q2.

## R6 · Rematch rules live in one locked function

**Decision.** New `request_rematch(p_match, p_actor)` (security definer). It takes the match row lock, then both player locks in id order. Then:
1. It refuses:
   - `not_completed` for a match that is not completed, or whose `ended_reason` is `void`, `abandoned` or `error`;
   - `window_closed` when `now() > completed_at + 120s`;
   - `opponent_left` when `player_on_match(opponent)` is false, or `self_left` for the actor;
   - `already_requested` when a request exists that is not `pending`, or is the actor's own.
2. If the opponent's request is pending (and within 30s), it calls `accept_rematch(…, 'crossed_rematch')`.
3. Otherwise it inserts the request `pending`, with `expires_at = now() + 30s`.

Also:
- `respond_rematch(p_request, p_actor, p_answer)` for decline.
- `withdraw_rematch(p_request, p_actor)`, which sets `withdrawn`. Today's cancel writes `expired` (`cancelRematch.ts`).
- `expire_due_rematches()` sets `expired`, `responded_at = expires_at`. It runs in the 30s cron sweep and lazily in the loader.
- `accept_rematch` keeps its body and adds the `expires_at` check. The crossed path is exempt, as today.

The TypeScript actions become thin callers through `lib/match/rematchService.ts`, the only caller, mirroring `challengeService`.

**Rationale.** Today the window, presence and expiry are unenforced: the 30s expiry is a client timer, and no sweep exists. The unique `(match_id)` constraint already gives one request per match (FR-011).

## R7 · The rematch cooldown joins the pair cooldown (clarification Q1)

**Decision.** `send_challenge`'s decline cooldown (`door_lobby.sql:463-468`) becomes the latest of two times:
- declined `match_invitations` from `p_sender` to `p_recipient`, as today;
- `rematch_requests` whose requester is `p_sender`, whose responder is `p_recipient`, and whose status is `declined` or `expired`, using `responded_at`.

In both cases the cooldown ends 60s after that time. `readStanding`'s `facts.cooldowns` uses the same union through one SQL helper, `pair_cooldown_until(sender, recipient)`, so the lobby row and the result's `again in 0:52` agree. `challenger_silenced` (the three-declines rule) is unchanged and reads invitations only.

## R8 · `MatchState.rematch` replaces `rematchMatchId`

**Decision.** For completed matches, `readRematchOffer(matchId, viewerId)` returns the value below. It is attached only by `/api/match/[id]/state` and the match page, and never by the loader or the publisher, because `loadMatchState` is broadcast to both players (`lib/match/statePublisher.ts`):

```
rematch: {
  offered,
  reason,
  request,
  cooldownUntil,
  opponentHere,
  opponentOnMatch,
}
```

The fields mean:
- `offered`: boolean.
- `reason`: `RematchRefusal` (data-model.md), or null.
- `request`: `{ id, requesterId, status, createdAt, expiresAt, newMatchId }`, or null.
- `cooldownUntil`: an ISO string or null.
- `opponentHere`: whether the opponent is present in the lobby language.
- `opponentOnMatch`: whether the opponent has a fresh tab on this match.

`rematchMatchId` stays as an alias of `request.newMatchId` until the client migrates within this spec, then it is removed. All pokes stay payload-free (`kind: "rematch"`). The client re-reads `/state`.

**Rationale.** Server-authoritative (constitution I). The client derives every negotiation line from `rematch` plus `now`, and the countdown is `expiresAt − now`.

## R9 · The negotiation model on the client

**Decision.**
- `useRematchNegotiation` becomes a pure `deriveRematchView(rematch, viewerId, nowMs, copy)`. It returns `idle-offered | not-offered | sent | incoming | declined | expired | withdrawn | accepted | busy`, with the line, the seconds left, the drain fraction and the actions.
- The hook keeps only the command calls and navigation. The local 30s `setTimeout` is removed, and a 1s tick drives the drain.
- When the slip is lifted or in review, an incoming request goes through `ledgerCallLine(rematch, call)`. The controller passes it today as `null` (`MatchRoomController.tsx:609`). The notice lines `rematchLine` are retired.
- `rematchRequest` copy loses its embedded `· accept ▸ · decline`.

## R10 · The result slip: focus, guard, detail

**Decision.**
- Attach `headlineRef` with `tabIndex={-1}` to the matchOver headline. `useFocusTrap` already honours `initialFocusRef`.
- Every matchOver action takes the existing 500ms guard (`Slip.tsx:33-40`), and so does any action whose meaning changes (keyed by the action's id and label).
- `resultDetail(endedReason, facts, copy)` (pure) replaces the detail branch of `buildVerdict`:
  - `moves_complete`: `by N points · A words to B · territory A–B`;
  - `incomplete`: `KÁRI PLAYED 8 OF 10 · BY 12 POINTS`;
  - `both_incomplete`: `NEITHER FINISHED · BY 12 POINTS`;
  - `forfeit`: `KÁRI RESIGNED · 3:12`, the clock at resignation from `completed_at − started_at`;
  - ended early: `ENDED EARLY · KÁRI WAS GONE`.
- An early end is recorded today as `incomplete` via `claimWin` (`claimWin.ts:97`). To tell it apart, add `ended_reason` value `ended_early`. It settles exactly like `incomplete` (same winner rule), and the check constraint is widened in the migration.
- On a phone, `detailClauses(…, 2)`.
- Best word: the viewer's highest `total_points` word from the accumulated words.
- The Icelandic early-end detail avoids `farinn`: `LOKIÐ SNEMMA · KÁRI HÆTTI AÐ SPILA` (name-safe, `// native-read`).

**Rationale.** EndReason in `slip.ts` exists but is never rendered. `useMatchOverSlip` already delays 600ms after a reveal and 0ms otherwise, which matches FR-001.

## R11 · The review scrubber is a variant of the scoreboard's clock row

**Decision.**
- `ScoreboardView.clock` gains `phase: "review"` with `{ step, stepCount, clockMs, fraction, valueText }`.
- `Scoreboard` renders `ReviewScrubber` in place of `ClockLine`: `role="slider"`, `aria-valuemin=1`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`, and `tabIndex=0`. It owns ←/→/Home/End/Space in its own `onKeyDown`, and pointer drag or tap maps x to a step.
- Player rows take `score` and `movesPlayed` at step k, with the sub-line `1204 · 3 of 10 at step 7`.
- On a phone (compact) it is the same row at 32px or more, labelled `skref 7 · klukkan þá · 3:31`.

**Rationale.** The canvas (Review, PhoneReview) draws the scrubber in the clock row. `deriveScoreboard` already derives segments from `movesPlayed`.

## R12 · Controls and cursor line

**Decision.**
- Desktop: `ReviewControls` (five word buttons) takes the ledger head's second row, the state line, as the canvas draws it. `play ▸` toggles to `pause`.
- Phone: five 44×44 glyph buttons with `aria-label`s in the pinned foot, beside `◂ úrslit`.
- The cursor line takes the live row's slot (`LiveText`), with lines from `cursorLines(step, copy)`.
- The ledger gets `reviewCells` mode: a `role="grid"` with a roving tabindex (`lib/a11y/rovingFocus.ts`). Every cell is a button that jumps to its step, and its state (`reached | current | ahead`) comes from `cellStateAt(k)`.
- On a phone, rows stay in `LedgerSheet` (`saga ▸`).

## R13 · Step motion reuses the reveal

**Decision.** Stepping forward by one sets `exchange` to the step's swap and runs `planReveal` over the step's band ids. `useReveal` is reused with its key set to the step index. A jump of more than one step, a step back, or reduced motion renders the end state at once. The band alpha is `current` (30%) for step k's words and `settled` (14%) otherwise, through `bandsFromWords` with `liveMoveKey` set to step k's key.

## R14 · Read-only and signed-out review

**Decision.**
- `app/[locale]/(room)/match/[matchId]/page.tsx` stops redirecting a signed-out visitor to the door when the match is completed and not void. It renders the controller `readOnly` with SSR state, and a void match redirects to `/`.
- A read-only controller never polls `/state` (a non-participant would get 403), never beats a match, and raises no slip. It enters review at `last` when there is no parameter (T54).
- The foot's primary is `enter the lobby ▸` when signed out, and none when signed in.
- The locale redirect and the door redirect keep the query string.
- `/summary` redirects to `?review=last`.

## R15 · Series on the scoreboard

**Decision.** Replace the N-query `fetchMatchChainForSeries` with the SQL function `rematch_series(p_match)`, a recursive CTE over `rematch_of`, capped at 50. It returns the ordered ids and winners. `deriveSeriesContext` stays pure. The loader adds `MatchState.series` when `table.rematchOf` is set. Both player rows' sub-lines append `· match 2 · Birna 1–0` at the table, while starting and live, and in the result.

## R16 · Autoplay

**Decision.** `useReviewAutoplay` uses a 1s interval that advances a step and stops:
- at the last step;
- on any control, key, cell or scrubber input;
- on `visibilitychange` to hidden.

It still runs under reduced motion, because stepping is time, not motion, and each step is then instant.

## R17 · Fixtures

**Decision.**
- `app/[locale]/dev/room/fixtures.ts` gains a static `REVIEW_STEPS` fixture, IS-M with 20 steps and a steps 5–6 double Kári. The EN copy comes from the English pack.
- New phases:
  - `result-moves`, `result-incomplete`, `result-both`, `result-forfeit`, `result-early`;
  - `rematch-sent`, `rematch-in`, `rematch-in-review`, `rematch-declined`, `rematch-cooldown`;
  - `review`, `review-refused`, `review-time`, `review-public`.
- Phone viewport tests: `phone-result`, `phone-review`.
- The existing `over-slip` and `final` phases are kept and re-baselined.
