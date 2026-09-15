# Implementation Plan: Field & Ledger Completion

**Branch**: `045-field-ledger-completion` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/045-field-ledger-completion/spec.md`

## Summary

Close the twenty-five findings of the 15 September implementation review without restructuring the room. The order is forced by two facts: nothing can be judged until the room renders without a database, and nothing is finished until a person has compared it with the figures.

The technical approach in one line per step:

- **R1 Seen** — a development-only route, `app/dev/room/`, renders the nine room states from a typed static fixture module by seeding the existing Zustand stores and mounting the existing presentational views. Two view/controller extractions (lobby, queue) follow the `MatchRoomController` → `MatchRoomView` split that already exists. A new Playwright project per viewport captures `toHaveScreenshot` baselines with no Supabase service running.
- **R2 Field paint** — `app/styles/room.css`: paper ground, `gap: 0`, delete `.field::before`, rules as cell borders, `--cell-size` declared on `.field`, numeral floor; `FieldBands` stroke 1.5; `useFieldSize` subtracts real padding and takes the 56px phone bar; two one-line controller fixes (picking value, frozen round). Asserted statically in `room-css.test.ts` and visually on the fixture route.
- **R3 Composition** — `.room { grid-template-columns: auto var(--ledger-width); justify-content: center }`, `.room__stack { margin: 0 }`; the live row becomes one full-width element with an inner `34px 1fr 1fr` grid; `LedgerModel` gains `live?: string` so the queue uses the same element; the bare "Match not found" page becomes a lobby redirect with a notice.
- **R4 Phone** — `Ledger` gains `collapsed` and renders `LedgerSheet` **in flow** (`flex: 1; min-height: 0; overflow-y: auto`), replacing its current `position: fixed`, which violates the design's "nothing over the field" rule.
- **R5 Interaction & motion** — pointer capture for drag, a document `pointerdown` listener for tap-outside, one hotkey hook, a FLIP exchange driven by `--dx`/`--dy` custom properties, `pin-fade` wired up, the disconnected lane as an inline SVG `stroke-dasharray`.
- **R6 Debt, decisions, documents** — delete the legacy alias blocks, `lib/ui/*` and move `ds-bundle/`; add `matches.rated` and the `--opp-text` token; floor the numeral; bring the repository's design bundle in line with the eight decisions.
- **R7 Seen for real** — human checklist against Fig. 2, 5–10; commit the baselines and make the visual job blocking; one full two-player Supabase run.

**Landed before R1 (2026-09-15)**, because the branch's own gate was red without it: a line-level
`<!-- retired-name -->` exemption in `scripts/docs/consistency-grep.sh`, so a task that says "delete
`--p1`" is not counted as drift, pinned by `tests/unit/scripts/docsConsistencyGrep.test.ts`. See <!-- retired-name -->
`research.md` §9. R6 still edits the same script for a second reason — extending its scope to the
current design bundle (§7).

Also landed: constitution **v1.5.0**, adopting the board-responsiveness amendment drafted under spec
044 so Principle IV states what this feature builds. No code change; see the Constitution Check.

R5 is independent of R3–R4 and may run in parallel. Everything else is strictly ordered.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x (seven-token theme in `tailwind.config.ts`), `next/font/google` (Zilla Slab, Red Hat Mono), zustand (`roomStore`, `preferencesStore`), Supabase JS v2, Zod. No Framer Motion; no new runtime dependency is introduced by this feature.
**Storage**: Supabase PostgreSQL. One additive migration: `matches.rated boolean not null default true`. No other schema change; the fixture route touches no database at all.
**Testing**: Vitest (JSDOM) for units, contract and static-stylesheet assertions (`tests/unit/styles/room-css.test.ts` reads `app/styles/room.css` and matches rule blocks — the existing pattern); Playwright for the room, with a **new visual project set** running against `/dev/room` with no Supabase; `@axe-core/playwright` for accessibility.
**Target Platform**: Browsers. Reference viewports 1440×900, 1280×800, 390×844.
**Project Type**: Single Next.js web application at the repository root.
**Performance Goals**: Unchanged SLAs (move RTT <200ms p95, validation <50ms, broadcast <100ms). New motion — the 150ms letter exchange, the 200ms pin fade and name write — animates `transform` and `opacity` only and must hold 60fps; the drag path adds no server round trip beyond the existing commit.
**Constraints**: Nothing may be positioned over the field, which makes the phone ledger sheet an in-flow element, not an overlay. The page must not scroll at 390×844. Every motion is 0ms under `prefers-reduced-motion`. The palette is exactly eight colour values. No gradients, shadows (other than `inset` line drawing), blur or radii.
**Scale/Scope**: Nine room states × three viewports = 27 reference images. Roughly 20 files edited, 8 created, 4 deleted or moved. Estimated 5½ days.

**No NEEDS CLARIFICATION remain.** The three decisions the review left open were given by the team on 15 September and are recorded in the spec's Clarifications; the five decisions of 14 September are already implemented.

## Constitution Check

*GATE: checked before Phase 0 and re-checked after Phase 1 design. Constitution v1.5.0.*

| Principle | Assessment | Verdict |
| --- | --- | --- |
| I. Server-Authoritative Game Logic | The fixture route renders static data and mounts no transport; a test asserts nothing under `app/dev/room/` imports `lib/supabase/**` or `app/actions/**`. Drag changes only how a swap is *initiated* — the same client posts the same move to the same Server Action. `rated` is set server-side at match creation and read server-side by the rating step; the client never writes it. | **PASS** |
| II. Real-Time Performance Standards | No change to the move or broadcast path. New motion animates `transform`/`opacity` only (FLIP via custom properties, one keyframe), per the existing `room.css` header rule. The fixture route is excluded from production builds, so it adds nothing to the shipped bundle. | **PASS** |
| III. Type-Safe End-to-End | Fixtures are typed with the existing `MatchState`, `LedgerModel`, `AccumulatedWord` and profile types — **no new types are introduced for fixtures**. `rated` is added to `MatchState` and the state loader with its Zod schema. `getSeatColors` gains a `text` field on the existing `SeatColors` interface. | **PASS** |
| IV. Progressive Enhancement & Mobile-First | The phone story is this principle, and the principle was amended to match it. Constitution **v1.5.0 (2026-09-15)** replaced "Board responsiveness: Scrollable container with pinch-to-zoom (50–150%)" with "the field fills the available width without scrolling or zoom; cells never fall below 35px, and the page itself never scrolls (spec 045 FR-021)". FR-021 is now the principle's own acceptance test rather than a conflict with it. Touch targets stay at the 44px minimum, which the ledger sheet must also meet. | **PASS** |
| V. Observability & Resilience | No change to logging, reconnection or degradation. The disconnect line and claim path are explicitly out of scope. | **PASS** |
| VI. Clean Code | The two view extractions reduce controller size; the hotkey hook and `useIsPhone` are single-purpose. `computeFieldSize` gains an options object rather than a fourth positional parameter (parameters ≤3, no boolean parameters). `collapsed` on `Ledger` is a rendering mode, not a behaviour switch, and is paired with a distinct child component. | **PASS** |
| VII. TDD (NON-NEGOTIABLE) | Every task in `tasks.md` is written test-first: the failing assertion names the file it will live in, and the implementation task follows it. Static stylesheet assertions make the paint fixes red-then-green without a browser. One commit per passing test. | **PASS** |
| VIII. External Context Providers | Playwright's visual-comparison API was fetched from Context7 (`/microsoft/playwright`, `class-pageassertions.md`, `class-locatorassertions.md`, `screenshotter.ts`) during Phase 0; findings and their effect on the plan are recorded in `research.md` §6 with provenance. | **PASS** |
| IX. Commit Message Standards | Conventional Commits, `test(scope):` before `feat(scope):`/`fix(scope):`, subject <80 chars, imperative. | **PASS** |

**Gate result**: proceed, all nine principles pass. The one conflict found at Phase 0 — Principle IV's retired pinch-zoom bullet — was resolved by amending the constitution to v1.5.0 on 2026-09-15 rather than by taking a local exception; no code changed either way.

## Project Structure

### Documentation (this feature)

```text
specs/045-field-ledger-completion/
├── plan.md              # This file
├── research.md          # Phase 0: eight decisions with rationale and rejected alternatives
├── data-model.md        # Phase 1: the five state additions and the fixture shape
├── quickstart.md        # Phase 1: how to see the room and capture a baseline
├── contracts/
│   ├── rated-flag.md        # matches.rated: creation, propagation, rating skip, captions
│   └── fixture-route.md     # /dev/room: phases, guard, isolation, what it may import
├── checklists/
│   ├── requirements.md  # written by /speckit.specify
│   └── visual.md        # written in R7 (T038), one line per design-system value
└── tasks.md             # T001–T041, copied from the handoff bundle
```

### Source Code (repository root)

```text
app/
├── dev/room/                    # NEW — development-only fixture route (R1)
│   ├── page.tsx                 #   server guard → client renderer, reads ?phase=
│   └── fixtures.ts              #   the 10-row board, players, rounds, verdict, profile
├── (room)/
│   └── match/[matchId]/page.tsx # EDIT — redirect instead of the bare <div> (R3)
├── actions/match/completeMatch.ts # EDIT — skip rating when the match is unrated (R6)
├── globals.css                  # EDIT — delete the legacy alias block; add --opp-text (R6)
└── styles/room.css              # EDIT — field paint, room grid, live row, sheet, motion (R2–R5)

components/
├── room/
│   ├── Field.tsx                # EDIT — pointer drag resolution, FLIP offsets (R5)
│   ├── FieldCell.tsx            # EDIT — pointer handlers, exchange/unpinned props (R5)
│   ├── FieldBands.tsx           # EDIT — strokeWidth 1.5 (R2)
│   ├── ClockLane.tsx            # EDIT — disconnected lane as inline SVG (R5)
│   ├── Ledger.tsx               # EDIT — full-width live row; collapsed + sheet (R3, R4)
│   ├── LedgerSheet.tsx          # EDIT — in-flow, scrolls internally (R4)
│   ├── LedgerFoot.tsx           # EDIT — data-field-safe on action buttons (R5)
│   ├── PlayerBar.tsx            # EDIT — `writing` name fade (R5)
│   ├── Room.tsx                 # EDIT — data-cell-size on the field slot (R2)
│   ├── LobbyRoomView.tsx        # NEW — extracted from LobbyRoomController (R1)
│   ├── QueueRoomView.tsx        # NEW — extracted from QueueRoomController (R1)
│   ├── LobbyRoomController.tsx  # EDIT — render the view; read ?notice=; hotkeys (R1, R3, R5)
│   ├── QueueRoomController.tsx  # EDIT — render the view; live row; name write (R1, R3, R5)
│   ├── MatchRoomController.tsx  # EDIT — picking value, frozen round, hotkeys (R2, R5)
│   └── hooks/
│       ├── useFieldSize.ts      # EDIT — real padding, phone bar height (R2)
│       ├── useFieldInteraction.ts # EDIT — drag + tapOutside dispatch (R5)
│       ├── useIsPhone.ts        # NEW (R4)
│       └── useRoomHotkeys.ts    # NEW (R5)
└── profile/ProfileRatingChart.tsx # EDIT — measured viewBox (R6)

lib/
├── constants/seatColors.ts      # EDIT — `text` colour on SeatColors (R6)
├── constants/copy.ts            # EDIT — NO_SUCH_MATCH; unranked strings (R3, R6)
├── constants/game-config.ts     # EDIT — drop timePerRoundMs (R6)
├── room/ledgerTypes.ts          # EDIT — LedgerModel.live?: string (R3)
├── room/ledgerRows.ts           # EDIT — rated-aware captions; queue live line (R3, R6)
├── matchmaking/inviteService.ts # EDIT — respondToInvite creates rated: false (R6)
├── matchmaking/service.ts       # EDIT — bootstrapMatchRecord carries rated (R6)
├── match/stateLoader.ts         # EDIT — hydrate rated onto MatchState (R6)
├── types/match.ts               # EDIT — rated on MatchState (R6)
└── ui/                          # DELETE — tokens.ts, avatarGradient.ts (R6)

ds-bundle/                       # MOVE → docs/archive/ds-bundle-warm-editorial/ (R6)

supabase/migrations/
└── <ts>_matches_rated.sql       # NEW (R6)

tests/
├── unit/styles/{room-css,tokens,acceptance-grep,tailwind-config}.test.ts  # EDIT
├── unit/components/room/*.spec.tsx                                        # EDIT + NEW
├── unit/app/roomFixtures.imports.test.ts                                  # NEW (R1)
├── contract/post-invite.contract.test.ts                                  # EDIT (R6)
└── integration/ui/
    ├── room-fixtures.spec.ts    # NEW — the visual suite (R1)
    ├── room-fixtures.spec.ts-snapshots/  # NEW — 27 committed baselines (R7)
    ├── room-layout.spec.ts      # EDIT — gutter, phone scroll height (R3, R4)
    └── room-flow.spec.ts        # EDIT — drag, tap-outside, ?/M (R5)

.github/workflows/ci.yml         # EDIT — `visual` job, no Supabase services (R1, R7)
docs/design_documentation/260914-wottle-new-design/*.md  # EDIT — the eight decisions (R6)
scripts/docs/consistency-grep.sh # DONE (pre-R1) — retired-name exemption; EDIT again in R6 for the bundle scope
```

**Structure Decision**: the existing single Next.js application at the repository root, unchanged. This feature adds exactly one new route folder (`app/dev/room/`), two new hooks, two extracted views and one migration. It restructures nothing: `components/room/`, `lib/room/` and the room states keep their shape, because the review found the architecture correct and only the rendering wrong.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| A development-only route inside `app/` | A rendered check that needs no database is the direct fix for review finding E1 — the absence of one is why three paint defects and an unwired phone ledger shipped. | Storybook or a separate harness application would add a build system, a second component registry and a second set of providers for the store; the room's views already compose from props, so a route is the smallest thing that renders the real components. The route is `notFound()` in production unless `ROOM_FIXTURES=1`, and a test pins its import isolation. |
| `matches.rated` column plus a flag threaded through four creation paths | Decision 1 of 15 September: a directory challenge lets a player choose their opponent, which the rating must not reward. The rating step is server-side and needs the fact at completion time, long after the invite is gone. | Deriving "was this a challenge?" at completion from `match_invitations` would couple the rating step to the matchmaking tables and break for rematches of a challenge. An additive column defaulting to `true` leaves every existing and queue match exactly as it is today. |
