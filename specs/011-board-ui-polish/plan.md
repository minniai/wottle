# Implementation Plan: [FEATURE]

**Branch**: `011-board-ui-polish` | **Date**: 2026-03-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-board-ui-polish/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement 3 UI polish features for the board:

1. Invalid Swap Feedback: Shake animation (3-4 oscillations, 300-400ms) and red border flash (200ms) when a swap is rejected.
2. Move Counters & HUD Polish: Update TimerHud to display exact move count (e.g., "M7") for each player instead of "Round X".
3. Responsive Mobile Board: Vertically scrollable board with pinch-to-zoom (50% to 150%) that maintains minimum 44x44px touch targets.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16
**Primary Dependencies**: Next.js App Router, Tailwind CSS 4.x, Zustand
**Storage**: N/A (UI only changes)
**Testing**: Playwright (E2E), Vitest (Unit)
**Target Platform**: Web (Mobile-first, progressive enhancement to Desktop)
**Project Type**: Web application
**Performance Goals**: 60 FPS for animations (GPU-accelerated only)
**Constraints**: Mobile pinch-to-zoom (50-150%), Touch targets >= 44x44px
**Scale/Scope**: 5-minute timed games

**Unknowns for Phase 0 Research**:

1. Animation Approach: [NEEDS CLARIFICATION: Should we use pure CSS keyframes with Tailwind for the shake/flash animations or a library?]
2. Board Zoom Implementation: [NEEDS CLARIFICATION: What is the optimal lightweight approach for pinch-to-zoom in React to maintain 60 FPS?]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Server-Authoritative Game Logic**: PASS. Visual client-side feedback decoupled from actual board simulation rules.
- **II. Real-Time Performance Standards**: PASS. Requires 60 FPS animations. We will prefer CSS transforms over React/layout reconciliations.
- **IV. Progressive Enhancement & Mobile-First**: PASS. The entire pinch-to-zoom aspect is explicitly mobile-first.
- **VI. Clean Code Principles**: PASS.
- **VII. TDD**: PASS. Hooks and complex state handling mechanisms for zoom layout and tracking moves will be tested.
- **VIII. External Context Providers**: PASS. Will rely on known web specifications and libraries.

## Project Structure

### Documentation (this feature)

```text
specs/011-board-ui-polish/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── styles/board.css
components/
├── game/
│   ├── BoardGrid.tsx
│   └── usePinchZoom.ts
├── match/
│   └── GameChrome.tsx
tests/
└── unit/components/
```

**Structure Decision**: Code will integrate into the existing `components/game` Next.js directory structure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None.
