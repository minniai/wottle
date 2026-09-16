# Feature Specification: Field & Ledger — as rendered

**Feature Branch**: `047-phone-field-full-width` (spec numbered 047; the handoff bundle says "spec 046" and is corrected in the repo copy)
**Created**: 2026-09-16
**Status**: Implemented (2026-09-16)
**Input**: User description: "Design review done by Claude Design resulted in number of improvements of the current implementation. The review result is in docs/design_documentation/260916-design-scope-clarification/. Analyse the design review and do a plan to fix and adhere to the design. Be mindful of UX Design best practices."

**Sources** (binding for this feature):

- `docs/design_documentation/260916-design-scope-clarification/README.md` — the handoff: nine findings S1–S9 against the rendered room, four amendments P1–P4 to the design, steps R1–R6, binding specs, the human acceptance checklist.
- `docs/design_documentation/260916-design-scope-clarification/TASKS.md` — task-level detail T001–T024 (mirrored and corrected in this feature's `tasks.md`).
- `docs/design_documentation/260916-design-scope-clarification/Wottle Implementation Review.dc.html` §07 "As rendered" and `room-match-2026-09-16.png` (Fig. 11: a live match, Bari · Lari, round 4, ~1024px).
- `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` as amended by P1–P4 — the repo's design system (eight tokens). The bundle's own `WOTTLE_DESIGN_SYSTEM.md` is the older seven-token copy and is not a source.

## Summary

Spec 045 made the room paint as designed and gave it a fixture route. The 16 September review is the first look at a live match after that work. Bars, lanes, bands, crossings and the caption match Fig. 2. Nine deviations remain. One is a data defect: round-1 bands drawn on letters that do not spell the ledger's words, on tiles that are not frozen (S5). Two are structural: the ledger fills the viewport instead of matching the stack (S1), and the idle beat has no signal while the hint reads an instruction for a state the player is not in (S2). The rest are detail: a clipped live-row label (S3), an orphan chevron (S4), dashed row rules (S6), shared-letter numerals in an arbitrary seat colour (S7), and two items to verify (S8, S9).

The review also amends the design: the instruction travels with the state in a two-line live row (P1); the fixture route gains a phase for every asymmetric signal (P2); the ledger keeps the stack's height when the 720px cap binds (P3); shared letters are ink throughout (P4).

## Clarifications

### Session 2026-09-16 (decisions taken with the team)

- Q: Spec number and branch? → A: **047 on the current branch**; the bundle's "spec 046" is corrected in the repo copy.
- Q: How wide does the S5 fix go when the seen match is not in the local database? → A: **Fix every certain defect found** — the client accumulator (no reset on rematch, no history on reload, orphaned partials), the missing frozen-tiles CAS migration (every freeze write is a blind overwrite), and the stuck-round recovery baseline — and run the prod diagnostic once to name the regression test.
- Q: The working tree moved `docs/design_documentation/README.md` to `docs/design_documentation/README.md`. → A: **Commit the move, repoint every live reference, refresh the README's stale decisions table.**
- Q: The handoff names `/__room` and `tests/integration/ui/__screenshots__/`. → A: **Keep the repo's paths**: `/dev/room` and `tests/integration/ui/room-fixtures.spec.ts-snapshots/`.

### Verified against the code before any task was written

- **S8 is already done** (spec 045 decision 2): `room.css` scored-numeral rule uses `--opp-text`; both axe exclusion lists hold only `.ledger__row--future .ledger__round`. T019 is verification.
- **S9 is not a defect**: the line under the seat header is `--ink` by design (Fig. 2); rules *between rows* are `--rule`. Documented in DS §5.4.
- `LiveState` has no preview kind; the preview price only ever reached the hint line. `ESC_CANCELS` is declared and never rendered.
- `tests/unit/app/dev/` does not exist; the fixture guard is `tests/unit/app/roomFixtures.imports.test.ts`.
- `playwright.config.ts` sets no `reducedMotion`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every band spells its word (Priority: P0)

A player in round 4 looks at a teal band and reads the letters under it. They spell the word in the ledger row for that round, in the direction the chevron points, and every letter under the band is frozen in that seat's colour. After a rematch, the new match's ledger starts empty. After a reload mid-match, every completed round is back in the ledger and on the field.

**Why this priority**: a band that lies makes every other screenshot a lie, and a ledger that forgets rounds on reload breaks the match's one record.

**Independent Test**: `/dev/room?phase=picking` passes `assertWordsSpellBoard`; a unit test rematches a controller and sees `words = []`; a unit test reloads a round-4 state and sees rounds 1–3; the frozen-tiles CAS function exists and a stale write is retried, never blind.

**Acceptance Scenarios**:

1. **Given** a settled round whose word has one coordinate no longer frozen, **When** bands are computed, **Then** no band is drawn for it and a development warning names the round and word.
2. **Given** a match state for match B arriving while the store holds match A, **When** it is applied, **Then** match A's `lastSummary` and scores are not carried over.
3. **Given** a first-mover partial for round 4 and then the canonical round-4 summary, **When** both have been applied, **Then** the ledger holds only the canonical words.
4. **Given** two concurrent writers of `matches.frozen_tiles`, **When** the second's baseline is stale, **Then** its write is rejected by the database, retried once onto the fresh map, and no earlier freeze is lost.
5. **Given** a stuck round with only the first mover's fast-path rows, **When** recovery runs, **Then** the combined scoring runs and the next round's freeze baseline is read after scoring.

### User Story 2 - The ledger is the height of the stack (Priority: P1)

At 1440×900 the ledger's top rule sits on the top bar's top edge and its foot sits on the bottom bar's bottom edge; the ten rows share the stack's height evenly; the room top-aligns at its 24px padding when the 720px cap binds.

**Independent Test**: fixture route at 1440×900 and 1280×800: `|ledger.top − topBar.top| ≤ 1` and `|ledger.bottom − bottomBar.bottom| ≤ 1`; ten `ledger-row-*` boxes share one height ±1px.

### User Story 3 - The live row says what to do (Priority: P1)

Nothing picked: the live row reads `pick a letter` and the hint line is gone. One letter picked: `picking · T (2)` over `tap a second letter`. Previewing: `24 · hestur` over `tap again to play · esc cancels`. Played: `played ●`. An illegal pick: `frozen · Kári R2 · pick another` for two seconds, then back. Every row is one continuous rule; the live row's `R4` is fully visible.

**Independent Test**: unit tests on `liveText` and the controller; fixture screenshots `idle`, `picking`, `previewed`, `played`, `illegal`.

### User Story 4 - Shared letters are ink (Priority: P2)

A letter in both seats' words is ink 700 with an ink numeral; scored numerals in the opponent's seat are `#C2402A`.

### User Story 5 - Every asymmetric signal has a fixture (Priority: P2)

`/dev/room` renders `idle`, `picking`, `previewed`, `played`, `opp-played`, `low-clock`, `illegal`, `phone-sheet` alongside the existing phases; each has a baseline at 1440×900, 1280×800 and 390×844 (`phone-sheet` at 390×844 only; `low-clock` also under reduced motion).

### User Story 6 - The documents say what the room does (Priority: P3)

DS §4, §5.1, §5.4, §7, §8 carry P1–P4; `CLAUDE.md` carries the three sentences; every reference to the moved design README resolves; `pnpm docs:check` is green.

### Edge Cases

- A word record whose coordinates derive no reading direction is skipped (as today).
- The live round's band (during a reveal) keeps its full run even before the freeze lands; the settled rule applies from the next round on.
- The `illegal` live state must not survive a round change or a successful pick.
- The phone trigger shows both live-row lines inside its 44px minimum height.
- History fetch fails: the ledger still fills from broadcasts; the failure is logged, not shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** `bandsFromWords` draws a settled word only from coordinates present in `frozenTiles`, skips the word (dev warning) if any coordinate is missing, and never returns a band with fewer than two cells; the live round keeps the current rule.
- **FR-002** `assertWordsSpellBoard(board, words)` returns one message per violation and runs in development once per match from `MatchRoomController`.
- **FR-003** `useAccumulatedRounds` resets when `matchId` changes, seeds from `GET /api/match/[matchId]/words`, replaces partial words with the canonical summary for the same round, and never duplicates a repeated broadcast.
- **FR-004** `roomStore` ignores snapshots' sticky fields and summaries addressed to another `matchId`.
- **FR-005** `update_frozen_tiles_if_unchanged(uuid, jsonb, jsonb) returns integer` exists as a migration, `security definer`, `search_path = ''`, executable by `service_role` only; `persistFrozenTilesAtomically` has no blind-update branch and retries a stale write once onto the fresh map; `pnpm supabase:verify` probes the function.
- **FR-006** `recoverStuckRound` treats `rounds.board_snapshot_after` as the "combined scoring ran" marker, scores against `rounds.frozen_tiles_before`, writes `board_snapshot_after`, and seeds the next round from a fresh read of `matches.frozen_tiles`.
- **FR-007** `.room__ledger` at ≥900px: `align-self: start; height: calc(var(--field-size) + 2 * var(--bar-height) + 2 * var(--bar-gap))`; ≤900px: `height: auto`.
- **FR-008** `.ledger__row` is the grid item (`display: grid; grid-template-columns: 34px 1fr 1fr; column-gap: 8px; grid-column: 1 / -1; border-bottom: 1px solid var(--rule)`); `.ledger__rows` has no columns or gap; cells have no border; `.ledger__round { padding-left: 6px }`; `.ledger__row--live` carries the tint and the 3px inset rule; `.ledger__hint:empty { display: none }`.
- **FR-009** `liveText` returns `{ line1, line2 }` per the P1 table (idle · picking · previewing · played · illegal · resolving); `buildMatchLedger` defaults `hint` to `""`; the hook no longer produces a hint; the `frozen` notice becomes a two-second live state.
- **FR-010** `.field__cell[data-state="shared"] .field__value { color: var(--ink) }`.
- **FR-011** `ROOM_PHASES` = landing, lobby, queue, found, idle, picking, previewed, played, opp-played, low-clock, illegal, reveal, final, disconnect, profile, phone-sheet; every value in `fixtures.ts` is a literal.
- **FR-012** Baselines for every phase at the three viewports under `tests/integration/ui/room-fixtures.spec.ts-snapshots/`; the human checklist ticked in the PR.
- **FR-013** Documents per R6; `pnpm docs:check` green; `tokens.test.ts` unchanged.

### Key Entities

- **AccumulatedWord** (`lib/room/ledgerRows.ts`): unchanged shape; now also produced by the history route.
- **LiveState** (`lib/room/ledgerRows.ts`): gains `previewing` and `illegal`.
- **HistoryWord** (`lib/match/wordHistory.ts`): `WordScore & { roundNumber; isDuplicate }`.

## Success Criteria *(mandatory)*

- **SC-001** `assertWordsSpellBoard` is `[]` on the fixture and, in development, on any match played end to end locally.
- **SC-002** At 1440×900 and 1280×800 the ledger's top and bottom edges are within 1px of the bars' outer edges.
- **SC-003** The `idle` fixture shows `pick a letter` and no hint; `picking` shows two lines; `played` shows `played ●` once.
- **SC-004** Every row rule is one continuous line; `R4` is fully visible; axe passes on `picking`, `final`, `profile` with the single future-label exclusion.
- **SC-005** No blind write to `matches.frozen_tiles` remains in the tree; the CAS function exists in every environment `pnpm supabase:verify` checks.
- **SC-006** Sixteen phases × three viewports of baselines are committed for darwin and linux; the visual CI job is green and blocking.

## Assumptions

- The Bari · Lari match was played against the production Supabase project; the diagnostic runs there read-only.
- The 047 phone-width commit already on the branch ships with this feature.

## Out of Scope

- Any change to scoring, the dictionary, or the reading-direction rules.
- New tokens, fonts, radii or shadows. The palette stays at eight values.
- Re-baselining the pre-existing phases beyond what the ledger and band changes force.

## Outcome (2026-09-16)

### What closed

- **S5 / S4 (P0)** — three defects, each confirmed in the seen match by the prod diagnostic (`research.md` §2): the frozen-tiles compare-and-set function now exists as a migration and the blind-update fallback is gone (`lib/match/frozenTilePersistence.ts`); recovery marks scoring by `board_snapshot_after`, scores on the round's own baseline and seeds the next round from a fresh read; the client hydrates completed rounds from `GET /api/match/[matchId]/words`, resets per `matchId` and drops a partial once its canonical summary lands; the store ignores foreign snapshots and summaries. Settled bands draw only over frozen letters and never under two cells; `assertWordsSpellBoard` runs in development. The column-0 band in the screenshot was `róla`, round 10 of the players' previous match.
- **S1 / P3** — `.room__ledger` is `align-self: start` with `height` bound to the stack; `height: auto` on phones. Asserted at 1440×900, 1280×800 and 1024×1100.
- **S2 / P1** — `liveText` returns `{ line1, line2 }`; idle reads `pick a letter`; the hint defaults to `""` and hides when empty; the preview price and `esc cancels` moved to the live row; an illegal pick is a two-second live state.
- **S3 / S6** — the row is the grid item and owns its rule; `.ledger__round` is inset 6px.
- **S7 / P4** — `.field__cell[data-state="shared"] .field__value { color: var(--ink) }`.
- **S8** — verified already closed (spec 045 decision 2). **S9** — not a defect; the seat header's rule is ink by design, now stated in DS §5.4.
- **P2** — sixteen fixture phases from literals; the preview word `tak` priced against the real dictionary.

### Acceptance checklist (darwin baselines, 2026-09-16)

1. ☑ Ledger top rule on the top bar's top; foot on the bottom bar's bottom (1440×900, 1280×800, 1024×1100 — asserted, ±1px).
2. ☑ Every row one continuous `--rule` line; `R4` fully visible (asserted: row rule 1px, children 0px, label inset 6px).
3. ☑ `idle`: `pick a letter`, hint hidden. `picking`: `picking · T (1)` over `tap a second letter`. `played`: `played ●`, your clock stopped.
4. ☑ Every band spells its word in the chevron's direction; one chevron per band (fixture pinned by `fixtures.spec.ts`; live matches by the dev assertion).
5. ☑ Shared letter L at (7,6) in ink with an ink numeral; opponent's scored numerals `--opp-text`; letters, lanes, totals and squares `--opp`.
6. ☑ `low-clock`: 8px lane; under reduced motion the lane's animation duration is `0s` (asserted).
7. ☑ 390×844: cells ≥ 35px, numerals hidden, sheet in flow beneath the trigger with both live lines and `history ▸`; the page does not scroll.

### Left open

- Linux baselines for `picking`, `reveal`, `final`, `disconnect` and the eight new phases are produced by the CI visual job on the first push and must be committed from its artifact before the job is green.
- The migration `20260916001_update_frozen_tiles_if_unchanged.sql` must be applied to production before this branch deploys: without it every freeze write there now throws instead of overwriting.
- `tests/integration/ui/room-layout.spec.ts` and `room-flow.spec.ts` (Supabase, two players) were updated but not run locally in this session.
