# Research: 008-score-delta-popup

**Date**: 2026-02-26
**Branch**: `008-score-delta-popup`

---

## Summary: Implementation Already Exists

All primary deliverables for this feature are already implemented in the codebase as part of prior exploratory work. The plan focuses on verification, gap-filling (missing tests), and any minor behavioural corrections needed to fully satisfy the spec.

---

## Finding 1: ScoreDeltaPopup component — implemented

**Decision**: Use `ScoreDeltaPopup.tsx` component as-is.

**Current state**:
- File: `components/match/ScoreDeltaPopup.tsx`
- Exports `ScoreDelta` interface `{ letterPoints, lengthBonus, combo }`
- Renders a `<span>` with `className="score-delta-popup"` and `aria-live="polite"`
- Filters zero-value components (FR-003 ✓)
- Returns null when all components are zero (FR-006 ✓)
- Auto-dismisses after 3000ms via `setTimeout` (FR-005 ✓)

**Gap**: The spec (FR-005) specifies hold duration of 2–2.8s, but the current implementation uses 3000ms for both the CSS animation and the React state timer. The CSS `@keyframes score-delta-popup` holds visible until 80% of 3s = 2.4s, then fades. This is within spec range. No change required.

**Alternatives considered**: Framer Motion — rejected by constitution (CSS transforms only).

---

## Finding 2: CSS animations — implemented

**Decision**: `app/styles/board.css` contains all required keyframes. No new CSS needed.

**Current state**:
- `.score-delta-popup` + `@keyframes score-delta-popup`: fade-in 200ms, hold ~2.4s, fade-out ~600ms over 3s total (within 2–3s spec)
- `.board-grid__cell--invalid` + `@keyframes invalid-shake`: 4 oscillations over 400ms (spec: 3–4 oscillations over 300–400ms ✓), red border via `border-color` override ✓
- Both keyframes use `transform` + `opacity`/`border-color` only — no layout properties (SC-005 ✓)
- `@media (prefers-reduced-motion: reduce)`: popup sets `animation-duration: 0ms` — this causes instant appear/disappear (FR-005 clarification ✓); invalid class sets `animation: none` — removes shake motion, border-only flash remains (SC-006 ✓)

**Gap**: The reduced-motion rule for `.board-grid__cell--invalid` (`animation: none`) removes the shake but the red border CSS is applied via the class itself (not the animation keyframe), so the border still flashes. This matches the clarified spec (SC-006: "MAY be reduced to a single brief flash or border-only signal"). ✓

---

## Finding 3: BoardGrid invalid shake — implemented

**Decision**: `BoardGrid.tsx` already implements the full invalid swap feedback path.

**Current state**:
- `invalidTiles` state: `[Coordinate, Coordinate] | null`
- Set on swap error (catch block in `handleSwap`): `setInvalidTiles([from, to])`
- Cleared after 400ms via `setTimeout`
- CSS class `board-grid__cell--invalid` applied to both tiles when `invalidTiles !== null`
- Trigger: server rejection only — the shake fires inside the `catch` of `submitSwapRequest`, which is called after the server response (FR-008 clarification: server-only ✓)
- Board state unchanged on rejection: grid is reverted via immutable update before setting invalid tiles (FR-011 ✓)

**Gap**: The `invalidTiles` state uses a `setTimeout` to clear after 400ms, which matches animation duration. However, a second rapid rejection while the first shake is running resets `invalidTiles` (replacing the previous value), which effectively restarts the timeout — new `setTimeout` fires. This satisfies FR-012 (re-triggerable), but the old timeout may also fire and call `setInvalidTiles(null)` prematurely. This is a minor timing issue. The spec acceptance scenarios require each rejection to have its own shake cycle. A `useRef`-based timeout cancellation pattern would be cleaner but is not strictly required; the current behaviour is functionally acceptable. Noted for tasks.

---

## Finding 4: MatchClient wiring — implemented

**Decision**: `MatchClient.tsx` already derives and passes the score delta to `GameChrome`.

**Current state**:
- `deriveScoreDelta(summary, playerId, slot)` — filters `summary.words` by `playerId`, excludes `isDuplicate`, sums `lettersPoints` and `bonusPoints`, reads `comboBonus` by slot
- Returns `null` when all three totals are 0 (FR-006 ✓)
- `scoreDelta` state updated via `useEffect` on `summary` change
- Passed to player `GameChrome` only (not opponent) (FR-004 ✓)
- `key={scoreDeltaRound}` on `ScoreDeltaPopup` — retriggers animation on new round (edge case: consecutive deltas ✓)

**Gap**: No unit tests for `deriveScoreDelta` logic exist (tested only indirectly). Spec requires: player filtering, duplicate exclusion, zero-delta suppression, combo slot selection. These should be unit-tested directly.

---

## Finding 5: Popup coexistence with RoundSummaryPanel — confirmed by code

**Decision**: The popup and `RoundSummaryPanel` are independent components in different DOM locations (popup inside `GameChrome`'s score container; panel is a sibling after `BoardGrid`). No coordination is needed — they can both be visible simultaneously.

**Current state**: Both are rendered independently in `MatchClient`; no suppression logic exists. This matches the clarified spec (Q2 answer: show both simultaneously). ✓

---

## Finding 6: Test gaps

| Test | Status | Action required |
|------|--------|----------------|
| `ScoreDeltaPopup` unit (9 tests) | ✓ Pass | None |
| `GameChrome` ScoreDeltaPopup integration (3 tests) | ✓ Pass | None |
| `BoardGrid` invalid shake unit (3 tests) | ✓ Pass | None |
| `deriveScoreDelta` unit tests | ✗ Missing | Add unit tests |
| E2E: score delta popup appears after real round | ✗ Missing | Add Playwright test |
| E2E: invalid shake on frozen-tile swap | ✗ Missing | Add Playwright test |
| E2E: popup coexists with RoundSummaryPanel | ✗ Missing | Add Playwright test (or unit) |
| Timeout clearance on rapid re-rejection (FR-012) | ~ Partial | Improve `invalidTiles` timeout cancellation |

---

## Technology Decisions

No new dependencies. Feature uses:
- React `useState`, `useEffect`, `useRef` — existing patterns
- CSS keyframes in `app/styles/board.css` — existing pattern
- Vitest + React Testing Library — existing unit test stack
- Playwright — existing E2E stack
