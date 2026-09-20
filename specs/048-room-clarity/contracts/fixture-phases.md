# Contract: fixture phases added by spec 048

`/dev/room?phase=<phase>`; guard and isolation unchanged from `specs/045-field-ledger-completion/contracts/fixture-route.md`.

| phase | seeds | pins |
| --- | --- | --- |
| `landing-slip` | `viewer: null`, warm-up board, `landedCount: 0`, `slip: signIn` | empty frame, sign-in slip, no letters (SC-003) |
| `idle` (changed) | round-4 idle | turn frame, `round 4 · your move` / `pick a letter`, sub-lines `· your move` / `· thinking`, rail 3 past + 4 current |
| `played` (changed) | you paused | ink frame, `played · waiting for Kári`, `· played ●` / `· thinking` |
| `opp-played` (changed) | opp paused | turn frame, `· your move` / `· played ●` |
| `reveal` (changed) | mid-reveal | `resolving round 3` |
| `settle` | `holdRound: 3`, `currentRound: 4`, round-3 words | R3 row settled with `round 3 scored` / `you +9 · Kári +0 · round 4 opens in 1`, R4 future, field disabled, rail 4 current |
| `resign` | round-4 idle + `slip: resign` | resign slip, field faded, clocks shown running |
| `claim-win` | disconnect fixture past the window + `slip: claimWin` | claim slip over the dashed lane |
| `final` (changed) | completed, `slipDismissed: true` | final ledger with `result ▸` in the foot, rail all past, caption `final · 10 of 10 · 18:50` |
| `over-slip` | completed, `slip: matchOver` | the match-over slip with both rating rows |
| `queue` (changed) | as today | rail all future, caption `10 rounds · 5:00 clocks` |
| `lobby` (changed) | as today | `here now`, `how to play ▸` in the foot, no `? rules` |
| `rules` | none (renders `/rules` content in the fixture shell) | the page at three widths |

`phone-sheet` keeps the rail above the live row. Every phase runs at the three viewports except `phone-sheet` (390 only) and `rules` (which is a scrolling page: full-page screenshot).

Baselines: `pnpm test:visual --update-snapshots` on darwin and in CI (linux); both committed.
