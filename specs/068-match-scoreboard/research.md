# Research: spec 068

There were no NEEDS CLARIFICATION items left after `/speckit.clarify` and the engineering review. This file records the technical decisions behind the plan.

## R1. Where the scoreboard lives in the room tree

- **Decision:** `Room` keeps its `topBar` / `field` / `bottomBar` / `ledger` slots. In the match states, `MatchRoomView` passes `<Scoreboard>` as `topBar` and `null` as `bottomBar`. `Room` gets a `layout: "bars" | "scoreboard"` prop, which it forwards to `useFieldSize` and sets as `data-layout` for the CSS.
- **Rationale:** This is the minimal diff. The lobby and queue keep the bars untouched (clarification Q1), and one grid component serves both layouts.
- **Alternatives:**
  - a second `MatchRoom` grid component: this duplicates the slip, landmark and field-slot logic;
  - removing the slots: this forces the lobby and queue to change now, which is out of scope.

## R2. Whole-pixel cells and the width budget

- **Decision:** `computeFieldSize(width, height, { layout, paddingX, ledgerWidth, gutter })`. In the scoreboard layout:
  - `available = min(height − 24 − scoreboardHeight − 12 − 24, width − paddingX − ledgerWidth − gutter)`;
  - `cell = min(71, floor((available − 3) / 10))`;
  - `field = cell × 10 + 3`.

  The `bars` layout keeps its height formula but gains the same width budget; this fixes the 901–1100px overflow (review decision 4). On phones (≤900px, one column) the field is `min(358, width − 32)` with fractional cells allowed, because the phone ledger sits below the field and no rows must line up. `--cell-size` is set from `cell` directly instead of `field / 10`, so the ledger rows and the board rows use the same integer.
- **Rationale:** SC-001 needs the rows to line up exactly, and fractional cells drift by up to 10px. The width bug is in the same function.
- **Alternatives:** a CSS `aspect-ratio` grid, which gives fractional cells again; a `transform: scale` of the whole composition, which blurs and is only approximate.

## R3. Clock ticks and phases

- **Decision:**
  - `ticksLeft = ceil(remainingMs / 5000)`, over 60 ticks.
  - Block k (0-based) has `clamp(ticksLeft − 6k, 0, 6)` ticks.
  - The phases come from `clockRowPhase(remainingMs, state)`: `starting | running | underMinute | lastSeconds | time | over`.
  - `FLASH_CLOCK_MS` is kept as `LAST_SECONDS_MS` (15s) for the label and weight only.
  - The `clock-flash` keyframe and every `flash` rule are deleted.
- **Rationale:** This is the spec 050 amendment (weight only, nothing blinks) plus the scoreboard amendment.
- **Alternatives:** a continuous draining bar, which the canvas replaced with ticks so that time can be read against moves.

## R4. Behind pace

- **Decision:** `behindPace = movesLeft > 0 && movesLeft − remainingMs / 30000 ≥ 1`, computed from whole seconds.
- **Rationale:** The canvas examples: 3 moves against 1.6 blocks is behind; 7 moves against 6.4 blocks is not. Time only falls, so between two resolved moves the flag can change at most once, from false to true (review failure-mode table).

## R5. Stakes and the missed beat

- **Decision:**
  - The stakes line uses `timeoutPenalty(total, unplayed)` from `lib/scoring/missPenalty.ts`. When it is 0, the line reads `nothing to lose`.
  - The missed beat's number comes from the resolution's `delta` (the server's floored penalty). A resolved move with no words has delta ≤ 0.
  - `move N · no word` replaces `move N scored` when the resolution's `words` is empty.
- **Rationale:** One source of the rule (constitution I). The client never recomputes a score, it only reads one or previews the timeout rule exactly as the server applies it.

## R6. The last-move tick

- **Decision:**
  - `lastMoves(resolutionsBySeat, frozen)` → per seat, the two `swap` cells of that seat's most recent **resolved** move, minus frozen cells.
  - While the match is live, the room store keeps each seat's latest resolved `MoveResolution`, fed by `applyResolution` and by `lastResolution` from a snapshot only when its status is `resolved`.
  - A reload onto a refused move gives no tick (review decision 1A; server follow-up in TODOS.md).
- **Rationale:** No server change.
- **Alternatives:** a server read fix, deferred.

## R7. Line 2 precedence

- **Decision:** one pure selector `selectLine2(sources)` over a fixed ordered list:

  | Order | Source |
  |---|---|
  | 1 | offline |
  | 2 | back |
  | 3 | submit error |
  | 4 | refused or illegal |
  | 5 | pick cleared |
  | 6 | end-early offer |
  | 7 | missed beat or stakes |
  | 8 | instruction |

  Each source is `{ active, text, tone }`. Hold timers (2s and 4s) live in the hooks that own each source, not in the selector. A held source that is overridden keeps its own timer, so it reappears only if time is left.
- **Rationale:** FR-031. It can be tested pair by pair, and it is a table rather than nested ifs (constitution VI).

## R8. Own outage lifecycle

- **Decision:**
  - `useMatchTransport` records `lostAt` when the channel reports `CLOSED`/`CHANNEL_ERROR` and the next poll fails (or `navigator.onLine` turns false).
  - It records `recoveredAt` on the first successful snapshot after that. It exposes `{ offline, awayMs }` through the room store's `connection` slice.
  - On recovery it calls the existing `handlePlayerReconnect` server action (`app/actions/match/handleDisconnect.ts`), which the match page already calls on load, so the viewer's own disconnect clears in place.
- **Rationale:** Codex finding (review, plan requirements). The server action already exists, so no server change.
- **Alternatives:** clearing only on reload, which is today's behaviour: `offline` would stick.

## R9. Server-anchored reconnect and gone for

- **Decision:** `reconnectMsLeft` and `goneForMs` are computed as `serverCorrectedNow − disconnectedAt`, where `serverCorrectedNow = now + (serverNow − localNowAtSnapshot)`, the same drift that `remainingFromDeadline` uses.
- **Rationale:** Codex finding. A wrong device clock must not shift the 90s window.

## R10. Announcements

- **Decision:**
  - `useOpponentAnnouncements` subscribes to the store's resolutions (not snapshots).
  - It keeps a `Set<globalSeq>` per match, and queues an announcement only for a `resolved` opponent move with `globalSeq` greater than the highest seen at mount.
  - It waits until the viewer's own beat has been announced (the reveal is idle), then writes one line to a polite region.
  - Rate limit: at most one announcement per 1.5s. The newest move wins, and skipped moves are dropped, not queued.
  - The 1:00 and 0:15 announcements are raised once each, when the clock crosses the mark, into the same region.
- **Rationale:** FR-033, FR-010 and the Codex finding.

## R11. The brand source

- **Decision:** `LOCALES[*].wordmark` becomes `Orðusta` / `Wottle`, and `copy.WORDMARK` reads `getLocale(id).wordmark`. The `brand-casing-grep` test fails on `"wottle"` or `"orðusta"` as a string literal in `lib/i18n/copy/`, `app/[locale]/**/layout.tsx`, metadata builders or `components/rules/content/`. Identifiers, URLs, cookie names and file names are exempt by pattern.
- **Rationale:** One place to capitalise (review code-quality item 3).

## R12. `--err` guard

- **Decision:** `--err` is used only through one class, `.points-lost`, applied by one helper, `renderPointsLost(value, label)`. The grep test fails on `var(--err)` anywhere except that class, and on `.points-lost` anywhere except the helper. The helper returns the label in `--muted` and the number in `--err`, or `0` in `--muted` when nothing was lost.
- **Rationale:** FR-022 is enforceable only if there is exactly one door.

## R13. E2E selectors

- **Decision:** the new testids are `scoreboard`, `scoreboard-clock`, `scoreboard-row-opp`, `scoreboard-row-you`, `scoreboard-name`, `scoreboard-subline`, `scoreboard-turn` (the seat-coloured suffix), `scoreboard-total` and `scoreboard-track`. Each match spec and helper (`helpers/swaps.ts`, `helpers/matchmaking.ts`) swaps `player-bar-top|bottom` for `scoreboard-row-opp|you` in the same commit that removes the bars from `MatchRoomView`.
- **Rationale:** The critical regression from the review.
