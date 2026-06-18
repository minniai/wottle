# Implementation Plan: Improve Scoring Resolution Visualization

**Branch**: `043-scoring-resolution-viz` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/043-scoring-resolution-viz/spec.md`

## Summary

Improve how each round's scoring resolution reads on the board, with three client-only changes:

1. **Calm waiting state** — replace the whole-board grey-out (`opacity: 0.45 + saturate(0.3)`) shown
   after a player submits with a non-destructive **board frame + waiting banner**; tiles stay
   full-color and the board stays click-locked.
2. **Current-round scored distinction** — tiles that scored **this round** keep a persistent,
   player-colored glow/ring that is **held until the round completes**, visually distinct from
   previously-scored tiles (which already render via the calmer frozen-tile tint). On round advance,
   the current-round marks clear and those tiles settle into the existing frozen treatment.
3. **Swap reveal-then-fade** — swapped tiles reveal with the existing animation, then their lift
   fades after a short delay (or on resolution); tiles that ended up in a scored word transition into
   the current-round scored mark instead of fading to plain.

The work is **presentation-only**: no Server Actions, database, scoring engine, or schema changes. It
consumes match state already broadcast to clients (`lastSummary`, `partialSummary`,
`frozenTiles`, move-lock flags). All animation work stays GPU-friendly (transform / opacity /
box-shadow) consistent with the existing board CSS.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x, CSS keyframe animations (GPU-accelerated, no Framer Motion); existing `lib/constants/playerColors.ts`, `deriveHighlightPlayerColors`, `lib/match/partialReveal.ts`
**Storage**: N/A — no new persistence; reads existing match state (`RoundSummary`, `PartialRoundSummary`, `FrozenTileMap`)
**Testing**: Vitest (unit + component) and Playwright two-player E2E (`tests/integration/ui/`)
**Target Platform**: Web (mobile-first, touch + desktop), modern evergreen browsers
**Project Type**: Web application (Next.js front-end with Server Actions back-end — back-end untouched here)
**Performance Goals**: Maintain 60 FPS on the new animations; no regression to move RTT (<200ms p95). New CSS transitions limited to compositor-friendly properties already in use on the board.
**Constraints**: Honor `prefers-reduced-motion` (non-animated equivalents); behave identically under Realtime and polling; stay consistent with the spec-042 instant-scoring fast path (no double-flash).
**Scale/Scope**: ~3 components touched (`MatchClient.tsx`, `BoardGrid.tsx`, `app/styles/board.css`), 1 new pure helper module, no API surface change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Server-Authoritative Game Logic (NON-NEGOTIABLE) | ✅ Pass | No game-state mutation. Pure visualization of server-broadcast results. No client scoring/freezing logic introduced — freeze data still comes from `matchState.frozenTiles`. |
| II. Real-Time Performance Standards (NON-NEGOTIABLE) | ✅ Pass | Animations use transform/opacity/box-shadow only (existing pattern). No new network calls, no added move-path latency. 60 FPS target preserved. |
| III. Type-Safe End-to-End | ✅ Pass | New BoardGrid props and the helper module are fully typed; reuses shared `Coordinate`/`FrozenTileMap`/`PartialRoundSummary` types. No `any`. |
| IV. Progressive Enhancement & Mobile-First | ✅ Pass | Waiting frame + banner and scored marks are CSS-driven and scale with the board; touch targets unchanged. `prefers-reduced-motion` fallbacks specified. |
| V. Observability & Resilience | ✅ Pass | Behavior identical under Realtime and polling; no new failure modes. Existing aria-live freeze announcement preserved. |
| VI. Clean Code | ✅ Pass | Current-round scored map derivation extracted into a pure, testable module; functions small and single-purpose. |
| VII. TDD (NON-NEGOTIABLE) | ✅ Pass | Plan sequences failing tests first: unit tests for the new helper, component tests for BoardGrid class output, Playwright E2E for the three user-visible behaviors. |
| VIII. External Context Providers (Context7) | ✅ Pass (N/A) | No new external library/framework/asset introduced; change is internal CSS/React patterns. No Context7 fetch required — explicit fallback per principle. |
| IX. Commit Message Standards | ✅ Pass | Conventional Commits; test commits precede implementation commits. |

**Gate result: PASS** — no violations; Complexity Tracking section intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/043-scoring-resolution-viz/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (client-only view-state model)
├── quickstart.md        # Phase 1 output (how to run + manually verify)
├── contracts/
│   └── boardgrid-visual-contract.md   # Component prop contract (no HTTP API in scope)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit.specify)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
components/
├── match/
│   └── MatchClient.tsx          # MODIFY — current-round-scored state, reveal-fade timers,
│                                #          waiting-state wiring; reuse existing reset-on-round effect
└── game/
    └── BoardGrid.tsx            # MODIFY — new `currentRoundScoredTiles` prop + class wiring;
                                 #          waiting frame (drop full-board dim); showLockBanner wiring

lib/
└── match/
    ├── currentRoundScored.ts    # NEW — pure helper: build current-round scored color map from
    │                            #       RoundSummary + PartialRoundSummary (reuses deriveHighlightPlayerColors)
    └── partialReveal.ts         # REUSE — buildPartialRevealKey, deriveRevealHighlightsFromPartial

app/
└── styles/
    └── board.css                # MODIFY — `.board-grid--locked` → calm frame (no dim);
                                 #          new `.board-grid__cell--scored-current` (persistent player ring);
                                 #          own-swap reveal-then-fade; restyled lock banner;
                                 #          reduced-motion fallbacks for each

tests/
├── unit/
│   ├── match/currentRoundScored.spec.ts        # NEW — helper unit tests
│   └── components/BoardGrid.*.spec.tsx          # MODIFY/NEW — class-output tests for new prop + no-dim
└── integration/ui/
    └── scoring-resolution-viz.spec.ts           # NEW — two-player E2E for US1/US2/US3
```

**Structure Decision**: Single Next.js web app (existing layout). All edits live in the front-end
presentation layer (`components/`, `app/styles/`) plus one pure helper under `lib/match/`. No
`backend/` split exists; Server Actions remain untouched. This mirrors how prior visual specs (010,
018, 042) were structured.

## Phase 0 — Research

See [research.md](./research.md). All Technical Context items are resolved (no NEEDS CLARIFICATION
remained after `/speckit.specify`). Research confirms the reuse points and the chosen persistence
boundary (clear current-round marks when `matchState.currentRound` advances).

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — client-only view-state entities (current-round scored map, swap
  reveal lifecycle, waiting state) and their transitions.
- [contracts/boardgrid-visual-contract.md](./contracts/boardgrid-visual-contract.md) — the BoardGrid
  prop/CSS-class contract that stands in for an HTTP contract (this feature exposes no endpoints).
- [quickstart.md](./quickstart.md) — run + manual verification steps.

## Complexity Tracking

No constitution violations — section intentionally omitted.
