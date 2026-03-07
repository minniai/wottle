# Implementation Plan: Move Playability Improvements

**Branch**: `014-move-playability-improvements` | **Date**: 2026-03-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-move-playability-improvements/spec.md`

## Summary

Seven playability improvements for pre-playtest polish: (1) move lock + orange swap highlight, (2) opponent move reveal on round completion, (3) prominent timer panels with green/orange/red backgrounds, (4) dual-timeout game end, (5) frozen tile colors on final summary, (6) Scrabble-style tile score values, (7) always-visible round summary table. Primarily client-side UI changes with one server-side extension (adding swap coordinates to RoundSummary broadcast).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x, CSS Animations/Transforms (GPU-accelerated, no Framer Motion)
**Storage**: N/A — reads existing Supabase tables; no new tables or columns
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web (desktop ≥900px + mobile)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 60 FPS animations, <200ms move RTT
**Constraints**: All animations via CSS transforms/opacity (no layout thrashing); server-authoritative game logic
**Scale/Scope**: ~8 files modified, ~2 new CSS keyframes, 1 type extension

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative | PASS | Move lock is client-side UI guard only; server already prevents duplicate submissions. Swap coordinates added to server broadcast (not client-derived). |
| II. Real-Time Performance | PASS | No new server round-trips. Animation durations (~1s reveal + ~700ms highlight) are additive but don't affect move RTT. CSS-only animations maintain 60 FPS. |
| III. Type-Safe E2E | PASS | `RoundMove` type added to `RoundSummary` interface; TypeScript catches mismatches at build time. |
| IV. Progressive Enhancement | PASS | Timer panel colors work on all screen sizes. Tile score values use relative font sizing. Round summary table respects existing responsive breakpoint (900px). |
| V. Observability | PASS | No new critical paths; existing logging covers move submission and round resolution. |
| VI. Clean Code | PASS | Move lock is a simple boolean + coordinate pair. Animation phase extends existing enum. No functions exceed 20 lines. |
| VII. TDD | PASS | Each feature has testable acceptance criteria. Unit tests for state transitions, E2E for visual behavior. |
| IX. Commit Standards | PASS | Each feature is independently committable with its tests. |

**Post-design re-check**: All gates still pass. No new server actions, no new database schema, no performance-critical paths added.

## Project Structure

### Documentation (this feature)

```text
specs/014-move-playability-improvements/
├── plan.md              # This file
├── research.md          # Phase 0: Technical decisions
├── data-model.md        # Phase 1: Type extensions
├── quickstart.md        # Phase 1: Implementation guide
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (files to modify)

```text
lib/types/match.ts                          # Add RoundMove type, extend RoundSummary
app/actions/match/publishRoundSummary.ts    # Populate moves in RoundSummary broadcast

components/match/MatchClient.tsx            # Move lock state, animation phase extension,
                                            #   opponent reveal, always-visible summary container
components/game/BoardGrid.tsx               # Disabled prop, locked tile orange highlight,
                                            #   opponent reveal highlight, tile score values
components/match/GameChrome.tsx             # Timer panel background colors (green/orange/red)
components/match/FinalSummary.tsx           # Thread frozenTiles to BoardGrid
app/match/[matchId]/summary/page.tsx        # Pass frozenTiles prop to FinalSummary

app/styles/board.css                        # Opponent-reveal fade keyframe,
                                            #   locked tile orange style, tile score value style

tests/unit/components/MatchClient.test.tsx  # Move lock, animation phase, opponent reveal tests
tests/unit/components/BoardGrid.test.tsx    # Disabled state, tile score value tests (new file if needed)
tests/unit/components/GameChrome.test.tsx   # Timer panel color tests
tests/unit/lib/scoring/roundSummary.test.ts # RoundSummary moves field test
```

**Structure Decision**: Existing Next.js App Router structure. No new directories or files beyond test files. All changes are modifications to existing components and one type extension.

## Complexity Tracking

No constitution violations. No complexity justification needed.
