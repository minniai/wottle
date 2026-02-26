# Implementation Plan: Visual Feedback Polish — Score Delta Popup & Invalid Swap Feedback

**Branch**: `008-score-delta-popup` | **Date**: 2026-02-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/008-score-delta-popup/spec.md`

---

## Summary

Both primary deliverables — the score delta popup (P1) and invalid swap shake (P2) — are already implemented in the codebase as of this branch. CSS keyframes, React components, and `MatchClient` wiring all exist and pass existing unit tests. The remaining work is:

1. **Unit tests** for `deriveScoreDelta` (the mapping function in `MatchClient`) — currently untested in isolation.
2. **Playwright E2E tests** covering the full user journeys (popup appearing after a real round, invalid shake on frozen-tile rejection, popup coexisting with `RoundSummaryPanel`).
3. **Minor robustness fix** in `BoardGrid` — cancel the previous shake timeout when a rapid second rejection arrives (FR-012 edge case).

No new components, CSS, or server-side changes are needed.

---

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router)
**Primary Dependencies**: Vitest + React Testing Library (unit), Playwright (E2E), Tailwind CSS 4.x, CSS Animations (no Framer Motion)
**Storage**: N/A — no new persistence; all state is client-side and derived from existing `RoundSummary` broadcasts
**Testing**: Vitest (unit + contract), Playwright (E2E)
**Target Platform**: Browser (desktop + mobile)
**Performance Goals**: Popup appears within 200ms of round summary receipt (SC-001); shake begins within one frame of server rejection (SC-004); all animations at 60 FPS via CSS transforms only (SC-005)
**Constraints**: CSS transforms + opacity only (no layout-triggering properties); no Framer Motion; server-authoritative — shake triggered only by server rejection response
**Scale/Scope**: UI-only; affects two components (`ScoreDeltaPopup`, `BoardGrid`), one orchestrator (`MatchClient`), and one CSS file

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative Game Logic | ✓ PASS | Shake triggers on server rejection only (no client-side pre-validation). `deriveScoreDelta` reads existing server-broadcast `RoundSummary`. No new mutations. |
| II. Real-Time Performance Standards | ✓ PASS | CSS keyframe animations (GPU-accelerated); `deriveScoreDelta` is a pure O(n) client-side function over words (n ≤ ~20 per round). Popup appears within one render cycle of summary receipt. |
| III. Type-Safe End-to-End | ✓ PASS | `ScoreDelta` interface typed; `deriveScoreDelta` has explicit return type `ScoreDelta \| null`. No `any`. |
| IV. Progressive Enhancement & Mobile-First | ✓ PASS | Popup is positioned via CSS `position: absolute`; touch targets unaffected. Invalid shake uses `transform` only. Reduced-motion handled via `@media (prefers-reduced-motion)`. |
| V. Observability & Resilience | ✓ PASS | No new critical paths. Existing `performance.mark("board-grid:hydrated")` unchanged. Popup failure is silent (component returns null). |
| VI. Clean Code Principles | ✓ PASS | `deriveScoreDelta` is a pure function <20 lines. Components are small and single-responsibility. |
| VII. TDD (NON-NEGOTIABLE) | ⚠ GAP | Existing implementation was not written TDD-first. New tasks follow TDD: tests for `deriveScoreDelta`, E2E specs, and robustness fix must have failing tests written before code changes. |
| VIII. External Context Providers | ✓ N/A | No external library APIs consumed. |
| IX. Commit Message Standards | ✓ PASS | Conventional Commits enforced. |

**Re-check post-design**: All principles remain satisfied. No new violations introduced.

---

## Project Structure

### Documentation (this feature)

```text
specs/008-score-delta-popup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A — no new API contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
components/
├── match/
│   ├── ScoreDeltaPopup.tsx       # ✅ Implemented — popup component
│   ├── GameChrome.tsx            # ✅ Implemented — mounts popup
│   └── MatchClient.tsx           # ✅ Implemented — deriveScoreDelta + wiring
└── game/
    └── BoardGrid.tsx             # ✅ Implemented — invalid shake; ⚠ timeout fix needed

app/styles/
└── board.css                     # ✅ Implemented — all CSS keyframes

tests/
├── unit/
│   └── components/
│       ├── match/
│       │   └── ScoreDeltaPopup.test.tsx    # ✅ 9 tests passing
│       ├── GameChrome.test.tsx             # ✅ 3 popup integration tests passing
│       ├── game/
│       │   └── BoardGrid.test.tsx          # ✅ 3 invalid shake tests passing
│       └── MatchClient.test.tsx            # ⚠ Missing: deriveScoreDelta unit tests
└── integration/
    └── ui/
        ├── rounds-flow.spec.ts             # ⚠ Missing: score delta popup E2E
        ├── swap-flow.spec.ts               # ⚠ Missing: invalid shake E2E (frozen tile)
        └── round-summary.spec.ts           # ⚠ Missing: popup + panel coexistence E2E
```

**Structure Decision**: Follows existing Web Application structure. All changes are in `components/`, `tests/`, and no new directories are created.

---

## Implementation State

### Already Implemented (no action required)

| Item | File | Spec coverage |
|------|------|---------------|
| `ScoreDeltaPopup` component | `components/match/ScoreDeltaPopup.tsx` | FR-002, FR-003, FR-005, FR-006, FR-007 |
| `score-delta-popup` CSS keyframe | `app/styles/board.css` | FR-005, SC-005 |
| Reduced-motion: popup instant | `app/styles/board.css` (media query) | FR-005 (clarification), SC-006 |
| `GameChrome` mounts popup | `components/match/GameChrome.tsx` | FR-001, FR-004 |
| `deriveScoreDelta` function | `components/match/MatchClient.tsx` | FR-004, FR-006 |
| `scoreDelta` wired to player GameChrome | `components/match/MatchClient.tsx` | FR-001, FR-004 |
| `invalidTiles` state in `BoardGridActive` | `components/game/BoardGrid.tsx` | FR-008, FR-009, FR-010, FR-011 |
| `invalid-shake` CSS keyframe | `app/styles/board.css` | FR-008, SC-005 |
| Red border on invalid class | `app/styles/board.css` | FR-009 |
| Reduced-motion: shake → border-only | `app/styles/board.css` (media query) | SC-006 |

### Remaining Work

| Task | Type | Priority | Spec requirement |
|------|------|----------|-----------------|
| Unit tests for `deriveScoreDelta` | New tests (TDD) | P1 | FR-004, FR-006, data-model |
| E2E: score delta popup appears after round | New Playwright test | P1 | SC-001, FR-001, FR-002 |
| E2E: popup absent when zero delta | New Playwright test | P1 | FR-006 |
| E2E: popup coexists with RoundSummaryPanel | New Playwright test | P2 | FR-001 (clarification Q2) |
| E2E: invalid shake on frozen-tile rejection | New Playwright test | P2 | FR-008, FR-009 |
| Fix rapid re-rejection timeout cancellation | Code fix + test | P2 | FR-012 |

---

## Phase 0: Research

**Status**: COMPLETE — see `research.md`.

Key findings:
- All components and CSS implemented; no new technology required.
- TDD gap: `deriveScoreDelta` has no isolated unit tests.
- E2E gap: No Playwright tests cover popup or shake in a live match context.
- Minor code gap: `invalidTiles` timeout not cancelled on rapid second rejection (FR-012).

---

## Phase 1: Design & Contracts

### Data Model

See `data-model.md`. No new server entities. Client-only `ScoreDelta` type already exists.

### API Contracts

No new API endpoints. Feature reads from existing `RoundSummary` broadcast (Realtime channel) and uses existing move rejection response (`HTTP 400` from `POST /api/match/[matchId]/move`).

### deriveScoreDelta — Function Contract

```typescript
// In: components/match/MatchClient.tsx
function deriveScoreDelta(
  summary: RoundSummary,
  playerId: string,
  slot: "player_a" | "player_b",
): ScoreDelta | null

// Invariants:
// - Returns null iff letterPoints === 0 AND lengthBonus === 0 AND combo === 0
// - Excludes words where isDuplicate === true
// - Excludes words where playerId !== current player's id
// - combo is taken from comboBonus[slot], defaulting to 0 if comboBonus is undefined
```

### invalidTiles Timeout Fix — Design

```typescript
// Current (simplified):
setInvalidTiles([from, to]);
setTimeout(() => setInvalidTiles(null), 400);

// Fixed pattern (cancel prior timeout):
const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// In handleSwap catch:
if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current);
setInvalidTiles([from, to]);
invalidTimerRef.current = setTimeout(() => {
  setInvalidTiles(null);
  invalidTimerRef.current = null;
}, 400);
```

This ensures that a second rejection before the first 400ms completes:
1. Cancels the pending `setInvalidTiles(null)` from the first rejection
2. Immediately updates `invalidTiles` to the new pair (restarts animation via class removal + re-add via state update)
3. Starts a fresh 400ms window

---

## Phase 2: Task Breakdown

Tasks are defined in `tasks.md` (generated by `/speckit.tasks`). High-level groupings:

### Group A — Unit Tests: deriveScoreDelta (TDD)
- Test: returns null when all fields zero
- Test: filters out words for other player
- Test: filters out duplicate words
- Test: sums letter points and bonus points correctly
- Test: reads comboBonus by slot (player_a vs player_b)
- Test: returns null when comboBonus is undefined and words array empty

### Group B — Code Fix: FR-012 rapid re-rejection
- Test (failing): two rapid rejections both trigger full 400ms shake cycles
- Fix: add `invalidTimerRef` and clear on entry to catch block

### Group C — E2E: Score Delta Popup (Playwright)
- Test: popup appears with correct breakdown after a scoring round
- Test: no popup shown when player earns zero points in a round
- Test: popup and RoundSummaryPanel visible simultaneously

### Group D — E2E: Invalid Shake (Playwright)
- Test: frozen-tile swap shows `board-grid__cell--invalid` class on both tiles

---

## Constitution Check (Post-Design)

All principles re-verified:

- **Server-Authoritative**: shake fires in `handleSwap`'s `catch` block (after `await submitSwapRequest` throws on HTTP 400). Zero client-side pre-validation. ✓
- **Type Safety**: `deriveScoreDelta` return type explicit. `invalidTiles` typed as `[Coordinate, Coordinate] | null`. ✓
- **TDD**: All new/changed code follows Red → Green → Refactor. Test files written before code changes. ✓
- **Performance**: All animations CSS-only. `deriveScoreDelta` O(n) pure function. ✓
- **Clean Code**: `invalidTimerRef` fix keeps `handleSwap` under 20 lines; clear intent. ✓
