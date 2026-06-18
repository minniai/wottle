# Code Quality & Refactoring Review — 2026-06-18

**Scope:** Match orchestration (`lib/match`), word engine (`lib/game-engine`), scoring,
Server Actions (`app/actions/match`), the match client (`components/match`,
`components/game`), board styles, and the test/repo hygiene around the recently-shipped
scoring-resolution-viz (spec 043) and O-74 work.
**Method:** Three parallel read-only sweeps cross-checked against the project's own
standards in `CLAUDE.md` (functions <20 lines, complexity <10, explicit return types,
Zod at boundaries, server-authoritative logic).
**Bottom line:** One genuine correctness bug, two god-objects that are slowing future
work, a handful of cheap type-safety wins, and minor hygiene. The recent CSS/animation
work is actually in good shape.

---

## Priority summary

| # | Item | Severity | Effort |
|---|------|----------|--------|
| 1 | Silent word-engine failure persists a wrong board | 🔴 Correctness | S |
| 2 | Frozen-tile baseline divergence + non-atomic fallback | 🔴 Correctness | M |
| 3 | `ensureBoardSnapshot` regenerates a random board on parse failure | 🔴 Correctness | S |
| 4 | `MatchClient.tsx` god component (1,388 lines) | 🟠 Structure | L |
| 5 | `advanceRound` / `loadMatchState` mega-functions | 🟠 Structure | L |
| 6 | Layering inversion: `lib/match` imports `app/actions` | 🟠 Structure | M |
| 7 | Missing return types + `any`/double-casts in polling hot path | 🟡 Type-safety | S |
| 8 | `BoardGrid` cell-render logic should be a pure helper | 🟡 Structure | M |
| 9 | Tests assert on CSS class names; duplicated setup | 🟡 Tests | S |
| 10 | Repo hygiene (`.antigravitycli/`, `reports/`, stray PNG) | 🟢 Hygiene | XS |

---

## 🔴 Correctness — fix regardless of any refactor

### 1. Silent word-engine failure corrupts game state
`lib/match/roundEngine.ts` (~299–314). The scoring call is wrapped in `try/catch`; on
failure it logs and **continues** with the pre-scoring board + stale frozen tiles, then
marks the round `completed` and writes that snapshot to the DB. The caller receives no
error signal.

This is not graceful degradation — it persists a wrong board as if scoring succeeded,
and matches a prior incident in the game-rules regression log
(`docs/prd_and_requirements/wottle_game_rules.md` §10). A round-resolution failure
should **abort the transition and trigger recovery**, not fall through. This is the only
finding that is a bug rather than a smell.

### 2. Frozen-tile baseline divergence
`instantScoring.ts`, `roundEngine.ts`, and `app/actions/match/publishRoundSummary.ts`
each compute the freeze baseline slightly differently (`round.frozen_tiles_before ??
match.frozen_tiles` vs. RPC-driven persist). `persistFrozenTilesAtomically` has a
**non-atomic `update()` fallback** when its RPC is absent. Under concurrent rounds this
is a freeze/unfreeze race. Consolidate to a single baseline resolver and keep the write
atomic (no silent fallback).

### 3. `ensureBoardSnapshot` regenerates a random board on parse failure
`lib/match/stateLoader.ts` (~127–141). If a stored snapshot fails `boardGridSchema.parse`,
it falls back to `generateBoard(...)` — a *different* playable board — and clients render
it as if it were real game state. Fail loud (surface "board unavailable") rather than
substituting fabricated state.

---

## 🟠 Structure — the work that's slowing future changes

### 4. `MatchClient.tsx` is a 1,388-line god component
~35 `useState`, ~22 `useRef`, ~18 `useEffect`, and **two** copies of the round-recap
animation state machine (one driven by `lastSummary`, one by `partialSummary`) that
duplicate timer and cleanup logic. Highest-leverage refactor. Extract cohesive hooks:

- `useRoundRecapAnimation()` — owns `animationPhase`, both reveal paths, highlight
  timers, the `currentRoundScored` merge.
- `useDisconnectionHandling()` — disconnect state, modal, claim-win, heartbeat net.
- `useMatchTimers()` — `timerTick` / `opponentTick` + snapshots.
- `useRealtimeMatch()` — channel subscribe + polling fallback + the `matchStateRef`
  mutable-signal workaround (which exists only to keep the poller out of effect deps).

Target ~500 lines and makes recap logic unit-testable without mounting the client.

### 5. `advanceRound` (490 lines) and `loadMatchState` (~294-line fn in a 644-line file)
Each does 10+ jobs (fetch → timeout synthesis → conflict resolution → apply → transition
→ score → timers → complete → broadcast). Worst offenders against the repo's own
"<20 lines, complexity <10" rule. Split `advanceRound` into named stages
(`synthesizeTimeoutPasses`, `resolveConflicts`, `applyMoves`, `scoreRound`,
`finalizeRound`) — each independently testable, which is precisely where bug #1 would have
been caught.

### 6. Layering inversion
`lib/match/roundEngine.ts` imports from `app/actions/match/` (`completeMatchInternal`,
`publishRoundSummary`, `computeWordScoresForRound`). The dependency arrow points the wrong
way — Server Actions should depend on `lib`, never the reverse. Move the scoring/round
orchestration into `lib/match`, leave the action as a thin wrapper. Do this **before** the
splits in #5 so the inversion isn't baked into the new modules.

---

## 🟡 Type-safety, render logic, tests

### 7. Type-safety holes (cheap, high value)
- `advanceRound` has **no explicit return type** despite a 4-variant discriminated union;
  every caller infers it. Add the union — the compiler then surfaces the
  `summaryResult.status` / `.reason` narrowing gaps in the `Promise.allSettled` handler.
- `any[]` in `mapWordScores` and `(match as any).frozen_tiles as FrozenTileMap`
  double-casts bypass Zod — in the **2s polling hot path** (`stateLoader.ts` ~198, ~519).
  Parse with the existing schemas.

### 8. `BoardGrid` cell-render logic
The per-cell `className` is a ~9-condition nested ternary; the per-tile style block derives
~16 CSS props inline in the render loop. Extract pure `deriveCellClasses(flags)` and
`deriveCellStyle(flags)` outside the loop. The
`isOwnSwapRaw → isOwnSwap → isFading → isLocked` state machine (spec 043 + O-74) then
becomes directly testable, and tests stop depending on raw class strings.

### 9. Tests are brittle
16 assertions across `BoardGrid.scoredCurrent/swapReveal/waitingState.spec.tsx` check
`className.toContain("board-grid__cell--…")` — coupling tests to CSS naming. After #8,
test the pure helper's output and keep one thin render smoke test. Also extract the
duplicated `EMPTY_BOARD` + `tileAt()` setup (copy-pasted across 3 files) into a shared
test util.

### 10. Repo hygiene (5 minutes)
- `.antigravitycli/` is a developer-specific symlink into `~/.gemini` — must be gitignored,
  never committed.
- `reports/vitest.xml` is auto-generated; `.gitignore` covers `coverage/` / `test-results/`
  but **not `reports/`**. Add it.
- A stray `Screenshot 2026-06-18….png` (the O-74 repro) sits in the repo root — move to
  `.claude/` or delete.
- The untracked `docs/` proposal + notes for this feature *should* be committed (real
  artifacts), unlike the above.

---

## Explicitly NOT worth doing

To keep the signal honest:

- **The two `currentRoundScored.ts` builders** are one-liners distinguished by input *type*
  (`RoundSummary` vs `PartialRoundSummary`). Collapsing to a generic saves nothing and reads
  worse. Leave them.
- **"Unnecessary `useMemo`" calls** — micro-optimization noise.
- **CSS `!important` (10×) and animation magic numbers** — each `!important` is a legitimate
  specificity override, and reduced-motion fallbacks are 11/11 complete. The board CSS is in
  good shape; a timing-token refactor is optional polish, not debt.

---

## Suggested order of operations

1. **Now (XS PR):** gitignore hygiene + delete stray screenshot.
2. **Correctness PR:** make word-engine failure abort+recover instead of swallowing; add
   `advanceRound` return type; replace the `any`/double-cast in the polling path with Zod
   parses; consolidate the frozen-tile baseline + drop the non-atomic fallback. Pin each
   with a test.
3. **Layering PR:** move scoring/round orchestration out of `app/actions` into `lib/match`;
   invert the import.
4. **Decomposition (largest):** split `advanceRound` into stages, then extract `MatchClient`
   hooks — in that order, so the engine is well-tested before the UI churns.
5. **Opportunistic:** extract `BoardGrid` cell-derivation helpers + retarget those tests to
   the helper.

Start with #2 — the silent-swallow path is the only item here that can corrupt a live
match.
