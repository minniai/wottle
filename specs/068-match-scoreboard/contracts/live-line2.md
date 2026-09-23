# Contract: `selectLine2`

```ts
export const LINE2_ORDER = ["offline", "back", "submitError", "refused", "pickCleared", "endEarlyOffer", "missedOrStakes", "instruction"] as const;
export function selectLine2(sources: Partial<Record<Line2Kind, Line2Source>>): Line2Source | null;
```

- It returns the first defined source in `LINE2_ORDER`.
- It is pure; the holds (2s pick cleared or refused, 4s back) are the callers' timers.

| Source | English | Icelandic |
|---|---|---|
| offline | `offline · reconnecting` | `án tengingar · tengist aftur` |
| back | `back · you were away 0:34 · the clock kept running` (fit-tested; shortened if it wraps) | |
| refused (frozen) | `frozen · GILT · Kári · pick another` | `frosinn · GILT · Kári · veldu annan` |
| pickCleared | `pick cleared · Kári moved that letter` | `val fellt niður · Kári færði stafinn` |
| endEarlyOffer | `Kári is gone · end the match ▸` (a secondary action) | `Kári · án tengingar · ljúka viðureigninni ▸` |
| missedOrStakes (missed) | `−5 · move 5 opens`, or `−3 · a total never falls below 0` | `−5 · leikur 5 opnast` |
| missedOrStakes (stakes) | `3 moves left · −15 if unplayed`, or `· nothing to lose` | `3 leikir eftir · −15 ef óleiknir` |

Every number of points lost is rendered through `renderPointsLost`: the number in `--err`, its label in `--muted`.

**Tests:** one for each adjacent pair, showing the higher source wins, and one showing a held lower source returns once the higher one clears.
