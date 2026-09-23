# Implementation Plan: The scoreboard, one grid, the new colours and the capitalised brand

**Branch**: `068-match-scoreboard` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/068-match-scoreboard/spec.md`, and the decisions and test requirements in [eng-review.md](./eng-review.md). Where the two differ, the review wins.

## Summary

During a match, one scoreboard box above the field replaces the two player bars and the ledger clock:
- **Row 1:** the clock, as ten 30s blocks of six 5s ticks, plus the label and the numeral.
- **Row 2:** the opponent.
- **Row 3:** the viewer.

All three rows share one ten-column track. The ledger is laid on the same grid, and each move row is exactly one cell tall. `--opp` becomes terracotta, a ninth token `--err` marks points lost only, and the brand is capitalised. Phase 2 adds the C4, C6 and C8 details: the last-move tick, the missed beat, stakes, illegal word, pick cleared, the line 2 precedence, offline and back, gone for, end early, announcements and focus at go.

**Technical approach.** Everything is client-side, derived from the `MatchState` and `MoveResolution` the room already receives. Nothing changes on the server, in the database or in any API.
- **New pure modules** in `lib/room/`:
  - `scoreboard.ts` (`deriveScoreboard`);
  - `segments.ts` (moved out of `BarLane`);
  - `lastMoves.ts`;
  - `liveLine2.ts` (the precedence selector);
  - `stakes.ts`;
  - `tabTitle.ts`.
- **New component:** `components/room/Scoreboard.tsx`, placed in `Room`'s top slot for the match states.
- **Sizing:** `computeFieldSize` gains a `scoreboard` layout with whole-pixel cells and a width budget.
- **Stylesheet:** `room.css` gains the scoreboard and the gridded ledger, and loses the ledger clock.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x (tokens in `app/globals.css`, `tailwind.config.ts`), zustand (`roomStore`), Supabase JS v2 (Realtime transport, unchanged). No new dependency.
**Storage**: N/A. No schema, migration or API change.
**Testing**: Vitest plus Testing Library (unit and component), Playwright (the `room-fixtures` visual suite at 1440×900, 1280×800 and 390×844, plus the E2E room specs), and `pnpm docs:check`.
**Target Platform**: Evergreen desktop and mobile browsers. The phone reference sizes are 390×844, 390×664 and 360×640.
**Project Type**: Web application (Next.js, one project)
**Performance Goals**: No added latency to a move (SC-009). The once-a-second re-render stays within one frame; the scoreboard adds about 60 tick spans.
**Constraints**:
- Nothing blinks.
- Everything is 0ms under `prefers-reduced-motion`, except time, which still steps.
- Nine colour tokens.
- Field states never scroll.
- No server change (spec scope, review decision 1A).

**Scale/Scope**: Nine user stories in two phases. About 30 files are touched, and about 17 E2E specs have their selectors migrated.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Note |
|---|---|---|
| I. Server-authoritative | PASS | No game logic moves. Pace, stakes, behind pace, ticks, gone for and the last moves are display derivations from server state, and the stakes use the server's own `timeoutPenalty` rule. The server still decides every score. |
| II. Real-time performance | PASS | Nothing is added on the move path. Opponent announcements are read from the `move-resolved` events already received. |
| III. Type-safe end to end | PASS | Every new module is a pure function with explicit input and output types (see [contracts/](./contracts/)). No `any`. No new server input, so no new Zod schema. |
| IV. Progressive enhancement and mobile-first | PASS | The phone layout is a P1 story. 44×44 targets are kept, and the foot is pinned with the safe area. |
| V. Observability and resilience | PASS | The transport's outage lifecycle (`lostAt`, `recoveredAt`) makes offline and recovery observable. The existing `connection` mode logging stays. |
| VI. Clean code | PASS | The review's DRY items are adopted: one `deriveScoreboard`, shared segment logic, one brand source. Functions stay under 20 lines, and the line 2 precedence is a table, not nested conditionals. |
| VII. TDD | PASS | Every new module starts from a failing test (the test requirements in [eng-review.md](./eng-review.md)). The critical selector regression is migrated in the same commit that removes the bars from the match. |
| VIII. Context7 | PASS | No new library. |
| IX. Commit standards | PASS | Conventional commits, one passing test (or tight group) per commit. |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/068-match-scoreboard/
├── spec.md
├── eng-review.md        # plan-stage decisions (binding)
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1: view models and derivations
├── quickstart.md        # Phase 1: how to see and verify it
├── contracts/           # Phase 1: pure-function and component contracts
│   ├── scoreboard.md
│   ├── field-size.md
│   ├── live-line2.md
│   └── last-moves.md
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
app/
├── globals.css                     # --opp #B56A4F, --opp-text #A1583D, + --err #AD1F3D; comments say terracotta
├── styles/room.css                 # + .scoreboard; ledger rows on --cell-size / --sb-row; − .ledger__clock*, − clock-flash keyframe
├── [locale]/layout.tsx             # title from the capitalised registry wordmark
└── [locale]/dev/room/fixtures.ts, RoomFixture.tsx   # + phases (US9), EN-M values

tailwind.config.ts                  # + err token

lib/
├── i18n/locales.ts                 # wordmark: "Orðusta" / "Wottle" (the one source)
├── i18n/copy/{en,is}.ts, types.ts  # WORDMARK from the registry; new strings (scoreboard, missed, stakes, gone, offline, back, …)
├── room/scoreboard.ts              # NEW deriveScoreboard (absorbs MatchRoomView.subline + barSuffixFor)
├── room/segments.ts                # NEW segmentStates (moved from BarLane)
├── room/lastMoves.ts               # NEW the tick cells per seat
├── room/liveLine2.ts               # NEW the line 2 precedence selector
├── room/stakes.ts                  # NEW stakes line from timeoutPenalty
├── room/tabTitle.ts                # NEW
├── room/clock.ts                   # − FLASH phase; + clockRowPhase, ticksLeft, pace
├── room/moveState.ts               # + missed beat; barSuffixFor removed (moved)
├── room/liveLines.ts               # illegal carries the word
├── room/ledgerRows.ts              # − clock fields
└── room/notices.ts                 # pickCleared leaves the match

components/room/
├── Scoreboard.tsx                  # NEW clock row + two player rows, one track
├── MatchRoomView.tsx               # topBar = Scoreboard, bottomBar = none; drops PlayerBar
├── MatchRoomController.tsx         # end-early re-raise removed; tab title; focus at go; announcements
├── Room.tsx                        # passes layout to useFieldSize; data-layout
├── hooks/useFieldSize.ts           # computeFieldSize(layout, …) whole cells + width budget
├── hooks/useMatchTransport.ts      # outage lifecycle lostAt / recoveredAt
├── hooks/useOpponentAnnouncements.ts # NEW queue keyed by globalSeq
├── Ledger.tsx                      # − LedgerClock; first three rows mirror the scoreboard; ⋯ in row 1
├── Field.tsx, FieldCell.tsx        # the last-move tick; aria label suffix
├── BarLane.tsx                     # imports segments.ts (lobby, queue)
└── Slip.tsx                        # resign and end-early copy per C6/C8; phone geometry per F8

docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md   # §2 §3 §5 §5.1 §5.4 §6 §8 §9
docs/prd_and_requirements/wottle_game_rules.md                              # §12 rows
CLAUDE.md                                                                   # Design section
scripts/docs/consistency-grep.sh                                            # retired phrases
TODOS.md                                                                    # (written by the review)

tests/
├── unit/lib/room/{scoreboard,segments,lastMoves,liveLine2,stakes,tabTitle,clock,moveState}.spec.ts
├── unit/components/room/{Scoreboard,FieldCell.tick,MatchRoomView.scoreboard}.spec.tsx
├── unit/hooks/{useFieldSize,useMatchTransport.outage,useOpponentAnnouncements}.spec.ts
├── unit/styles/{err-token-grep,brand-casing-grep}.test.ts
└── integration/ui/room-fixtures.spec.ts (+ grid, no-blink, phone, line-2 fit) and the migrated match specs
```

**Structure decision.** This is the existing single Next.js project. Room logic stays pure in `lib/room/`, the rendering goes in `components/room/`, and nothing is added under `app/actions` or `app/api`.

## Phases and sequencing

```text
Phase 1 (US1–US6, US9 partial)             Phase 2 (US7, US8, US9 rest)
──────────────────────────────             ───────────────────────────
tokens + brand ─┐                          liveLine2 selector ─┬─ missed beat, stakes, illegal word
segments.ts ────┤                                              ├─ pick cleared (line 2), back/offline
clock.ts phases ┼─ deriveScoreboard ─ Scoreboard.tsx ─┐        └─ end-early offer (no re-raise)
fieldSize ──────┘                                     ├─ MatchRoomView swap + E2E selector migration (one commit)
ledger grid (rows = cell) ────────────────────────────┘        lastMoves → tick in FieldCell
fixtures + baselines (darwin), docs                            transport outage lifecycle
                                                               announcements, focus at go, tab title
                                                               slips (C6, C8, F8), phases + baselines, docs
```

Phase 1 ships green on its own: the visual suite is re-baselined, the E2E specs pass on the scoreboard testids, and `docs:check` passes. Phase 2 builds on its `deriveScoreboard` sub-lines (gone for, offline, behind pace are already in Phase 1's derivation; their live-row halves arrive in Phase 2).

## Risks

| Risk | Mitigation |
|---|---|
| The selector migration misses a spec, and CI fails on a run that uses a Realtime-heavy spec | Grep `player-bar-` in the match specs within the same commit. Lobby and queue specs keep their selectors. Run the two-player specs one file at a time locally. |
| Line 2 strings wrap at 340px | FR-032's overflow test. Shorten the copy, and record the change in design system §8. |
| Linux baselines differ from darwin | As before, take the Linux baselines from the CI visual job's artifacts (CLAUDE.md gap 5). |
| The Icelandic strings added here need a native read | Add them to gap 4's list in CLAUDE.md. |

## Complexity Tracking

None.
