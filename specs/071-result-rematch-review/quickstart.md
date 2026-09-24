# Quickstart: The result, rematch and review

This is a manual walk through spec 071 on a local stack. Use two browsers (A = Birna, B = Kári), each on its own profile.

## Setup

```bash
pnpm supabase:migrate                   # applies 20260926001_result_rematch_review.sql
pnpm build && pnpm start --port 3100    # production build; see the E2E gotchas memory
```

Fixtures, with no database: `/dev/room?phase=…` and `/en/dev/room?phase=…`. Phases: `result-moves`, `result-incomplete`, `result-both`, `result-forfeit`, `result-early`, `rematch-sent`, `rematch-in`, `rematch-in-review`, `rematch-declined`, `rematch-cooldown`, `review`, `review-refused`, `review-time`, `review-public`. At 390×844, `phone-result` and `phone-review`.

## 1. The result (US1)

1. A challenges B. Both sit down and play ten moves each.
2. After B's last reveal holds, the slip lands about 600ms later. Focus is on `Birna wins`, and a screen reader reads it.
3. Press Enter on `rematch ▸` at once: nothing happens. After half a second it works. Don't send yet: reload first.
4. The detail line reads `by N points · A words to B · territory A–B`, and nothing else on the slip repeats it. `your best word · … N` is present.
5. Press Esc and the slip lifts. `result ▸` in the foot restores it. The tab title reads `Birna wins · Wottle`.
6. Press Back once and you are in the lobby. Closing the tab raises no warning.

Repeat with a resignation (`Kári resigned · 3:12`), with 0:00 while B has 8 moves (`Kári played 8 of 10 · by 12 points`), and with an early end (`ended early · Kári was gone`).

## 2. Rematch (US2, US6)

1. Both on the result, A presses `rematch ▸`. A sees `rematch sent · 0:29` with a drain and `cancel ▸`. B's slip row 1 reads `Birna asks for a rematch · 0:29`, with `accept ▸` (not focused) and `decline`.
2. A cancels. B's line disappears. A presses `rematch ▸` again: refused, because a match allows one request.
3. On a fresh match: A sends and B declines. Both read the outcome, `rematch ▸` is gone for both, and A's `challenge again ▸` reads `again in 0:5x` until 60s have passed.
4. On a fresh match: A sends and B waits 30s. Both read `no answer`, with the same consequences as a decline.
5. On a fresh match: B lifts the slip with Esc and A sends. B's slip does not come back. The ledger's first line carries the request, and the cue, the tab title `(1) Birna asks for a rematch · Wottle` and the favicon change.
6. On a fresh match: both press `rematch ▸` within a second. One new match opens, both are at its table, and both scoreboard rows carry `match 2 · Birna 1–0`.
7. On a fresh match: B goes to the lobby. A's scoreboard shows `Kári has left`, and `rematch ▸` is gone. Separately, wait out 2:00 on a result: `rematch ▸` becomes `new opponent ▸`.
8. With B's tab hidden (switched to another tab) but still on the result, A can still send.

## 3. Review (US3, US4)

1. From the result, press `review the match ▸`. The URL gains `?review=20` and the slip lifts.
2. Focus the scrubber in the clock row. ← steps back instantly. → exchanges the two letters and draws that step's bands. Home and End go to the ends. Space plays one step a second, and any key stops it.
3. The scoreboard rows read `… · 3 of 10 at step 7`, with the totals at that step. The ledger's later cells read `not yet reached`. Tab into the ledger, move with the arrows, and Enter jumps to a cell's step.
4. The cursor line reads `move 3 · Birna · LEK · ÆSKU +33` over `froze 6 · Birna leads 51–18`.
5. Step 20 times, then press Back once: you are on the result. Press Back again: you are in the lobby.
6. In a match that ended at 0:00 with unplayed moves, the last step reads `time · −15 not played`, and its totals equal the result.
7. `/match/:id/summary` goes to `?review=last`. `?review=99` and `?review=abc` show the last step, and the URL is corrected.

## 4. Anyone with the link (US5)

1. In a third, signed-out browser, open `/match/:id?review=5`. The review renders read-only, with `this match is over · Birna – Kári` and `enter the lobby ▸`. It shows no slip and offers no rematch.
2. A void table's `/match/:id` goes to the lobby, or to the door when signed out.

## 5. Phone (US8)

At 390×844:
- The result slip fills the field's square, and the scoreboard's totals stay visible.
- In review, the clock row is the scrubber, the foot has `◂ úrslit` plus five 44px glyph buttons, and `saga ▸` opens the rows.

## Gates

```bash
pnpm test:unit && pnpm lint && pnpm typecheck && pnpm docs:check
pnpm test:visual                                   # on a production build
pnpm exec playwright test rematch-flow review-flow --project=chromium
pnpm test:integration -- tests/integration/db/rematch.race.test.ts   # 100 rounds of crossed rematches
```
