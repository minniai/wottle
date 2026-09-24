# Contract: room derivations

Every function here is pure (no React, no fetch), has an explicit return type, and has a unit test with fixtures in both languages. The components render them and do not decide.

## The result slip

### `resultDetail(reason, facts, copy): string[]`

`facts`: `{ winnerName, loserName, margin, words: {winner, loser}, territory: {winner, loser}, moves: {a, b}, limit, resignedAtMs, goneName }`.

| `reason` | EN clauses | IS clauses |
|---|---|---|
| `moves_complete` | `by 46 points`, `10 words to 8`, `territory 27–21` | `með 46 stigum`, `10 orð gegn 8`, `svæði 27–21` |
| `incomplete` | `Kári played 8 of 10`, `by 12 points` | `Kári lék 8 af 10`, `með 12 stigum` |
| `both_incomplete` | `neither finished`, `by 12 points` | `hvorugt kláraði`, `með 12 stigum` |
| `forfeit` | `Kári resigned`, `3:12` | `Kári gafst upp`, `3:12` |
| `ended_early` | `ended early`, `Kári was gone` | `lokið snemma`, `Kári hætti að spila` (native-read) |
| a draw | the margin clause is dropped | as EN |

The labels are rendered in mono caps by CSS. The strings stay sentence case in the copy. The name-safe grep covers every IS clause.

### `slipFocus`

The matchOver slip is a slip the game raises, so its headline carries `tabIndex={-1}` and is the trap's `initialFocusRef`. Asserted in `Slip.matchOver.spec.tsx`, which replaces the current first-focusable assertion.

### Guard

`useActivationGuard(key, 500)`. `key` is `${action}:${label}`, so an action whose label changes (for example `rematch ▸` becoming `accept ▸`, or the window closing) is ignored for another 500ms.

## Rematch

### `deriveRematchView(offer, viewerId, opponentName, nowMs, copy): RematchView`

```ts
type RematchView =
  | { kind: "offered";  primary: "rematch"; secondary: "newOpponent" }
  | { kind: "sent";     line: string; secondsLeft: number; drain: number; action: "withdraw" }
  | { kind: "incoming"; line: string; secondsLeft: number; drain: number; primary: "accept"; secondary: "decline" }
  | { kind: "closed";   line: string | null; primary: "newOpponent"; challengeAgain: ChallengeAgain | null }
  | { kind: "accepted"; line: string };      // navigating
type ChallengeAgain = { enabled: boolean; label: string };   // `challenge again ▸` | `again in 0:52`
```

| Offer | View |
|---|---|
| no request, `offered` | `offered` |
| no request, not offered (`window_closed`, `opponent_left`, `self_left`) | `closed`. The line is `Kári has left` / `Kári hætti` for `opponent_left`, otherwise null. |
| pending, viewer is requester | `sent` · `rematch sent · 0:24` |
| pending, viewer is responder | `incoming` · `Kári asks for a rematch · 0:24` |
| declined | `closed` · `Kári declined`. For the decliner the line is null. |
| expired | `closed` · `no answer` |
| withdrawn | `closed` · null for the requester; the responder sees `Kári withdrew` / `Kári hætti við` |
| superseded | `closed` · `Kári started another match` |
| accepted | `accepted` · `Kári accepted` |

- `secondsLeft = ceil((expiresAt − now) / 1000)`, clamped to at least 0.
- `drain = secondsLeft / 30`.
- At 0 the view stays `sent` or `incoming` with `0:00` until the next state read. The client never decides expiry itself.
- `challengeAgain` is present only when `opponentHere` is true. It is disabled with `again in m:ss` while `cooldownUntil > now`.

### `ledgerCallLine(rematchView | null, call | null, copy)` (extended)

- An incoming rematch is the first line.
- A third-party call is below it.
- Each has a `secondary` accept, and `decline`.

## Review

| Function | Contract |
|---|---|
| `buildReviewSteps(moves, facts)` | Steps in `globalSeq` order. A refused row is `kind: "refused"`: board unchanged, points 0, no count. The closing step is added per research R2. Every step's `totals` equals the row's `score_*_after`. `movesPlayed` counts only resolved rows. `clockMs = max(0, durationMs − (receivedAt − startedAt))`. |
| `parseReviewParam(raw, n)` | `null` → not reviewing. `"last"`, `""` and a value that is not a number → `n`. A number below 1 → 1, above `n` → `n`. `canonical` is the string to write back. |
| `stepAtFraction(x, n)` | `clamp(round(x × (n − 1)) + 1, 1, n)` |
| `scrubberValueText` | `step 7 of 20, Birna, LEK ÆSKU plus 33`. A miss: `step 8 of 20, Kári, no word minus 5`. A refusal: `…, refused`. The closing step: `…, time, minus 15 not played`. |
| `cursorLines` | line 1: `move 3 · Birna · LEK · ÆSKU +33`, `move 4 · Kári · no word −5`, `move 5 · Kári · refused`, `time · −15 not played`. Line 2: `froze 6 · Birna leads 51–18`, `refused · frozen`, or `level 40–40`. Both lines fit about 40 mono characters (the slot-overflow test). |
| `ledgerCellStates(steps, k)` | Every counted move gets `reached` (index < k), `current` (= k) or `ahead`. The accessible name for `ahead` is `move 8, Kári, not yet reached`. |
| `bandsAtStep(steps, k)` | Words of steps 1..k. Those of step k are `current` (30%), the rest `settled` (14%). |

## Scoreboard (`lib/room/scoreboard.ts`)

`deriveScoreboard` accepts `review: { step, stepCount, clockMs, fraction, valueText, totals, movesPlayed }`. When it is given:
- the clock row's `phase` is `"review"`;
- the player rows use `totals` and `movesPlayed`, with the sub-line `1204 · 3 of 10 at step 7`;
- there is no pace, no urgency tint and no series.

## Tab title

- `resultTitle`: `Birna wins · Wottle`, `Draw · Orðusta`.
- An incoming rematch takes precedence: `(1) Kári asks for a rematch · Wottle`.
- Review keeps the result title.
