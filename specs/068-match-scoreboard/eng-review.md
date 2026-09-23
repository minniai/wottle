# Engineering review: spec 068 (plan stage)

`/plan-eng-review`, 2026-09-23, run against `spec.md` before `/speckit.plan`. `/speckit.plan` MUST carry the decisions and test requirements below.

## Decisions

| # | Decision | Choice |
|---|---|---|
| S0 | Scope | Everything stays in this branch, in two phases. **Phase 1:** scoreboard, one grid, colours, brand, new baselines. **Phase 2:** the C4, C6 and C8 details (stories 7 and 8). Each phase ships green. |
| 1 | Last-move tick after a reload | Client only. A tick comes only from a resolved `lastResolution`. After a reload onto a refused move, or once the player's last move has fallen out of the six most recent, no tick shows until that player's next move. No server change. |
| 2 | Field sizing | `computeFieldSize` gains a layout: `bars` (lobby, queue, profile; unchanged) or `scoreboard` (match states). In the scoreboard layout the cell is `floor(available ÷ 10)`, capped at 71, and the field is 10 cells plus its frame. At found → match the field resizes (708 → 713 at 1440×900); it still remounts there, as today (a persistent field is the later "one field" stage). |

| 3 | Codex findings | All 12 applied to the spec: the tick count; the framed field (10 × cell + 3); the lane's accessibility; the missed beat's `−5` in `--err`; `rating pending`; line 2 precedence; `keep waiting` never re-raises; reconnect and `gone for` on the server-corrected clock; one-off announcements at 1:00 and 0:15; opponent announcements deduped by receipt sequence and live only; line 2 fit by shortening copy; the no-remount claim dropped. |
| 4 | Width bug at 901–1100px | Fixed here: the desktop sizing subtracts the ledger and gutter from the width, with a 1000×800 test case. |

## Plan requirements from the outside voice

- `useMatchTransport` gains an outage lifecycle: `lostAt` when the transport loses the match (channel closed and the polls failing), `recoveredAt` on the first good state after that. It feeds `offline · reconnecting` and `back · you were away m:ss`, and clears the viewer's own disconnect in place without a page load.
- The live row's line 2 is one selector over the ordered sources (FR-031), with the hold timers kept outside it. It is unit-tested for every pair that can overlap.
- Opponent announcements are queued from `move-resolved` events, keyed by `globalSeq`. A snapshot never produces one.
- The end-early re-raise timer (`MatchRoomController.tsx:323-333`) is removed. `keep waiting` sets a per-match flag.

## Code-quality requirements (adopted, no alternatives)

1. One pure `deriveScoreboard()` in `lib/room/scoreboard.ts` gives the clock row and both player rows. It absorbs `MatchRoomView.subline()` and `barSuffixFor()` (`lib/room/moveState.ts:103`), so no sub-line string is built in two places.
2. `segmentStates` moves from `BarLane.tsx` to `lib/room/`. `BarLane` (lobby, queue) and the scoreboard track share it.
3. There is one brand source. The locale registry's `wordmark` becomes `Wottle` / `Orðusta`, and the copy's `WORDMARK` reads it (today it lives in both `lib/i18n/locales.ts` and `lib/i18n/copy/{en,is}.ts`).
4. Pick cleared becomes a live-row line 2 state. `pickClearedNotice` (`lib/room/notices.ts`) is retired from the match. Notices remain for challenges and rematches.
5. `LiveState.illegal` gains the frozen word, looked up by cell from the accumulated words.

## Test requirements

- **CRITICAL regression.** The match E2E specs select `player-bar-top`, `player-bar-subline`, `player-bar-score` and `player-bar-turn`: `moves-flow`, `disconnect-claim`, `match-completion`, `reconnect-flow`, `room-layout`, `room-flow`, `sensoryFeedback`, `locale-is`, `helpers/swaps.ts` and `helpers/matchmaking.ts`. Phase 1 MUST move them to scoreboard testids (`scoreboard-row-opp`, `scoreboard-row-you`, `scoreboard-subline`, `scoreboard-total`, `scoreboard-clock`) in the same commit that removes the bars from the match. The lobby and queue specs keep `player-bar-*`.
- **Unit tests,** all new:
  - `deriveScoreboard`: every clock phase; ticks = ⌈s ÷ 5⌉; the phone (no ticks); every label, including `<1s a move`; a behind-pace case table (SC-007); every sub-line; the segment states.
  - `computeFieldSize` in the scoreboard layout: 1440×900 → 713, 1280×800 → whole cells.
  - `lastMoves`: resolved, frozen dropped, refused ignored, reload onto a refused move.
  - `moveState`: the missed beat, the floored −3, stakes −15 and `nothing to lose`, the illegal word, pick cleared, `back` after 0:34.
  - The tab title.
  - A brand-casing grep (FR-026) and an `--err` usage grep (FR-022).
- **Fixture and E2E tests:**
  - rows level to within 1px at 1440×900 and 1280×800 (SC-001);
  - 3 seconds of `last-seconds` with only the numeral and ticks changing (SC-002);
  - phone 390×844, 390×664 and 360×640 with no scroll and the foot visible (SC-005);
  - the longest line 2 strings on one line at 1440 (SC-006);
  - end early: headline focus, 500ms guard, keep waiting;
  - focus moves to the field at go.

## Not in scope (considered, deferred)

- A persistent field across queue → found → match (the "one field" principle, game flow §8 item 1).
- A server fix for the tick after a reload (in TODOS.md): it breaks the stage's no-server-change rule, and the gap is one missing tick, never a wrong one.
- The resign slip's `· −9` (in TODOS.md): it arrives with the stakes in the table stage (C1, S3).
- The table, leave slip, stepped out, reactions and the new ledger-foot menu items: these belong to later stages.

## What already exists (reused)

- `segmentStates` and the `BarLane` segment CSS.
- `clockPhase` and `formatClock` (`lib/room/clock.ts`); the `flash` phase is retired.
- `deriveMoveState` → `liveLinesFor` (`lib/room/moveState.ts`).
- `MatchState.disconnectedAt` and `RECONNECT_WINDOW_MS_CLIENT`, for `gone for`.
- `PlayerMatchFacts.lastResolution.swap`, for the tick.
- `timeoutPenalty` and `missPenaltyFor` (`lib/scoring/missPenalty.ts`), for the stakes and the floored miss.
- `Room`'s `topBar` slot, which holds the scoreboard; `bottomBar` is empty in the match states.
- `getSeatColors`, and the `--opp-band` / `--opp-live` colour-mix tokens, which follow the new `--opp` automatically.

## Failure modes

| Codepath | Realistic failure | Test | Handling | User sees |
|---|---|---|---|---|
| Clock ticks | Client and server clocks drift, so a tick empties a second early | `remainingFromDeadline` already corrects with `serverNow` | yes | one-second skew at most |
| Behind pace | Could it flicker at the boundary? | case table | computed from whole seconds, and s ÷ 30 only falls, so it flips once and stays until a move resolves | one change, no flicker |
| Tick | Reload onto a refused move | unit (1A) | no tick | a missing tick, silent but harmless |
| Whole-pixel cell | A very short viewport gives a cell under 32px | existing `CELL_SIZE_SMALL_PX` guard | yes | smaller numerals |
| Tab title | Updates every second while the tab is hidden | unit | cheap | nothing |
| Brand casing | A lowercase `wottle` in a new string | grep test | fails CI | nothing reaches users |

| Own offline | Transport recovers without a page load, and the disconnect never clears | unit (transport lifecycle) | added (plan requirement) | `offline` would stick: now tested |
| Line 2 | Two sources at once (a refusal during the stakes line) | pairwise selector tests | precedence (FR-031) | exactly one line |
| Announcements | Poll catch-up replays moves | unit, keyed by `globalSeq` | live events only | no replays |

No critical gaps remain once the requirements above are in the plan. Before the outside voice there were two, the false no-remount claim and the unordered line 2, and both are now closed.

## Outside voice (Codex, gpt, read-only)

It found 12 problems, and all 12 were accepted (decision 3). The cross-model tension: this review first reported no critical gaps, and Codex was right that two existed.
