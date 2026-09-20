# Quickstart — Room Clarity

## See every new state without a database

```bash
pnpm dev
open "http://localhost:3000/dev/room?phase=landing-slip"
```

Then `settle`, `resign`, `claim-win`, `over-slip`, and the changed `idle`, `played`, `opp-played`, `final`, `queue`, `lobby`. The rules page is `http://localhost:3000/rules`.

## Check against the baselines

```bash
pnpm test:unit -- tests/unit/lib/room tests/unit/components/room
pnpm test:visual                      # three viewports, all phases
pnpm test:visual --update-snapshots   # only after the unit tests pass; attach images to the PR
pnpm lint && pnpm typecheck && pnpm docs:check
```

## Play it live (two browsers)

1. Open `/` in two profiles. Each shows the empty frame and the sign-in slip; no letters.
2. Sign in on both; the letters land. Player A: `play ranked ▸`; player B: the same.
3. Round 1: both see `round 1 · your move`, a teal frame, `· your move` / `· thinking`. Play a swap on A: A's frame goes ink, `played · waiting for B`; B's top bar reads `· played ●`.
4. Play on B: both see `resolving round 1`, the bands, then `round 1 scored` for 1.2s with the deltas, then `round 2 · your move`. The rail moves 1 → 2.
5. From A's `⋯` menu, `how to play` opens `/rules` in a new tab; A's match keeps ticking.
6. From B's `⋯` menu, `resign` → the resign slip; `keep playing ▸` lifts it.
7. Play to round 10 (or resign): 600ms after the last band, both see the match-over slip. `review the field ▸` lifts it; `result ▸` in the foot brings it back; `rematch ▸` rewrites the other player's slip action line.

## Acceptance greps

```bash
grep -rn "unranked\|no rating change\|? rules\|firstMatchRules" components lib app   # nothing
```
