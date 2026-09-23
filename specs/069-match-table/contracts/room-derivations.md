# Contract: pure room derivations (client)

All are pure, with explicit types, in `lib/room/`.

## `deriveMoveState` (changed, `moveState.ts`)
- **Input:** as today, plus `table: MatchTable`, `endedReason`.
- **Order:** `void` (completed & `void`) > `table` (pending) > `starting` (in_progress & msToStart > 0) > the existing beats.

## `readySlipModel({ table, viewerId, players, stakes, language, copy, nowMs }) → ReadySlipModel` (`tableSlip.ts`)
- `label`: `copy.tableLabel(secondsLeft)` while pending; `copy.startsIn(min(3, ceil(msToStart/1000)))` once started.
- `actions`: `"ready+leave"` when the viewer is unseated; `"seated+leave"` when seated and waiting; `"none"` once started.
- `secondsLeft = max(0, ceil((deadlineAt − now)/1000))`; `drainMs = deadlineAt − now`.
- **The slip lifts when** `msToStart ≤ 3_300` (`SLIP_LIFT_BEFORE_GO_MS`).

## `voidSlipModel({ table, viewerId, players, queueSeated, copy }) → VoidSlipModel`
| Reason | Viewer | Headline |
|---|---|---|
| `not_seated` | voidedBy = opponent | `copy.voidOppNotSeated(name)` |
| `not_seated` | voidedBy = viewer or null | `copy.voidYouNotSeated` |
| `left` | voidedBy = opponent | `copy.voidOppLeft(name)` |
| `left` | voidedBy = viewer | not shown (the leaver is routed to the lobby) |

Actions by `origin`: `queue` → `cancel` when the viewer is requeued; `challenge`/`crossed_challenge` → `challengeAgain`, `lobby`; `rematch`/`crossed_rematch` → `result`, `lobby`; otherwise `lobby`.

## `deriveScoreboard` (changed)
In the `table` phase:
- the clock row is `copy.sbMatchClock` over `copy.sbStartsWhenSeated`, with a full track and `5:00`;
- the rows have no total;
- the sub-lines are `<rating> · opponent · on the way|ready` and `<rating> · you · not ready|ready`.

In the `void` phase: the opponent's row reads `did not sit down` or `left`, and yours `you · searching` (when requeued) or `you`.

## `queueView({ queuedAt, paused, nowMs, checkAnsweredAt, cooldownUntil }) → QueueView`
- `cooldown` when `cooldownUntil > now`;
- `paused` when paused;
- `stillSearching` when `now − max(queuedAt, checkAnsweredAt) ≥ 180s` (with `drainMs` over 30s);
- `stopped` after 210s;
- else `searching` with `elapsed`.

## `tabTitle` (changed)
Adds the `table`, `starting` and `searching` beats (R10).

## `stakesFor(ratings, me, opp) → Stakes` (`lib/rating/stakes.ts`)
Three `calculateElo` calls, at actual scores 1, 0.5 and 0.
