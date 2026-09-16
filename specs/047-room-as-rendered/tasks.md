# Tasks: Field & Ledger — as rendered

**Input**: Design documents from `/specs/047-room-as-rendered/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`
**Design sources**: `docs/design_documentation/260916-design-scope-clarification/` — `README.md` (S1–S9, P1–P4), `TASKS.md`, `Wottle Implementation Review.dc.html` §07, `room-match-2026-09-16.png`.

**Tests**: MANDATORY. Every `[test]` task fails before its `[impl]` task and passes after. One commit per passing test (`test(scope): …` then `fix|feat(scope): …`).

**Organization**: by handoff step. Order: R1 → R2/R3/R4 (any order) → R5 → R6.

| Story | Handoff step | Findings |
| --- | --- | --- |
| US1 Every band spells its word (P0) | R1 Data integrity | S5 S4 |
| US2 Ledger is the height of the stack (P1) | R2 Geometry | S1 P3 |
| US3 The live row says what to do (P1) | R3 Ledger | S2 S3 S6 P1 (S9 verify) |
| US4 Shared letters are ink (P2) | R4 Field marks | S7 P4 (S8 verify) |
| US5 Every signal has a fixture (P2) | R5 Fixtures & baselines | P2 |
| US6 Documents (P3) | R6 Documents | — |

## Path Conventions

Single Next.js application at the repository root. Fixture route `/dev/room`; baselines `tests/integration/ui/room-fixtures.spec.ts-snapshots/`.

---

## Phase 1: Setup

- [x] T001 Create `specs/047-room-as-rendered/{spec,plan,tasks,research}.md`

## Phase 2: US1 — Data integrity (R1)

- [x] T002 [test] `tests/unit/match/persistFrozenTiles.spec.ts`: writes via rpc when the baseline matches; retries once onto the fresh map on 0 rows and preserves concurrent freezes; throws when the retry is also stale; throws (no plain update) when the function is missing
- [x] T003 [impl] `supabase/migrations/20260916001_update_frozen_tiles_if_unchanged.sql` (security definer, `search_path = ''`, returns integer row count, `service_role` only); `app/actions/match/publishRoundSummary.ts` `persistFrozenTilesAtomically` without the fallback branch, with `retryWithFreshBaseline`; `scripts/supabase/verify.ts` rpc probe
- [x] T004 [test] `tests/unit/lib/match/recoverStuckRound.test.ts`: skips re-scoring only when `board_snapshot_after` is persisted; re-runs combined scoring when only fast-path rows exist; scores against `rounds.frozen_tiles_before`; seeds the next round from a fresh read of `matches.frozen_tiles`
- [x] T005 [impl] `lib/match/recoverStuckRound.ts` per T004
- [x] T006 [test] `tests/unit/lib/room/roomStore.spec.ts`: a snapshot for a new matchId drops the previous `lastSummary` and scores; a summary addressed to another match is ignored
- [x] T007 [impl] `lib/room/roomStore.ts` `mergeSnapshot` / `applySummary` matchId guards
- [x] T008 [test] `tests/unit/lib/match/wordHistory.test.ts` and `tests/contract/get-match-words.contract.test.ts`
- [x] T009 [impl] `lib/match/wordHistory.ts` `loadMatchWordHistory`; `app/api/match/[matchId]/words/route.ts`
- [x] T010 [test] `tests/unit/components/room/hooks/useAccumulatedRounds.spec.tsx`: seeds from history; resets on matchId change; partial replaced by the canonical summary; partial for a canonical round ignored; repeated broadcast does not duplicate
- [x] T011 [impl] `components/room/hooks/useWordHistory.ts`; `useAccumulatedRounds(match, history)` reducer; `MatchRoomController` wiring
- [x] T012 [test] `tests/unit/lib/room/bandGeometry.spec.ts`: settled word with an unfrozen letter skipped with a dev warning; word with no frozen letters skipped; live round keeps its full run; never a band under two cells
- [x] T013 [impl] `lib/room/bandGeometry.ts` `settledCells`
- [x] T014 [test] `tests/unit/lib/room/wordIntegrity.spec.ts` (four cases); `tests/unit/app/dev/fixtures.spec.ts` (fixture spells its words; every coordinate frozen); `MatchRoomController.spec.tsx` logs once per match in dev
- [x] T015 [impl] `lib/room/wordIntegrity.ts`; controller effect
- [x] T016 [investigate] Run the read-only diagnostic in `research.md` §2 against prod for the Bari · Lari match; record the reading; name the S5 regression test

## Phase 3: US2 — Geometry (R2)

- [x] T017 [test] `tests/unit/styles/room-css.test.ts`: `.room__ledger` ≥900px `align-self: start` + the height calc, no stretch, no min-height; phone block `height: auto`
- [x] T018 [impl] `app/styles/room.css`
- [x] T019 [test] `tests/integration/ui/room-fixtures.spec.ts`: ledger top/bottom = bar top/bottom ±1 at both desktop projects on `?phase=picking`; ten rows share one height ±1; `tests/integration/ui/room-layout.spec.ts` adds 1280×800

## Phase 4: US3 — Ledger (R3)

- [x] T020 [test] `room-css.test.ts`: rows/row/live/round/hint rules per FR-008
- [x] T021 [impl] `app/styles/room.css` ledger block; `components/room/Ledger.tsx` `Row` (row is the grid item, `ledger-live-row` on the text wrapper, two lines; trigger stacks both lines)
- [x] T022 [test] `tests/unit/lib/room/ledgerRows.spec.ts`: `liveText` table; `buildMatchLedger` hint `""`
- [x] T023 [impl] `lib/constants/copy.ts` (`PICK_A_LETTER`, `PREVIEWING`, `NO_WORD`, `RESOLVING`, `previewLine`); `lib/room/ledgerRows.ts` (`LiveState` + `liveText`)
- [x] T024 [test] `tests/unit/components/room/MatchRoomController.spec.tsx`: pick → two lines, hint empty; commit → `played ●` once; frozen tap → `frozen · … · pick another` then back after 2s; `Field.interaction.spec.tsx` reads the preview price from `liveStateFor`
- [x] T025 [impl] `lib/room/liveState.ts` `liveStateFor(interaction, …)`; controller `illegalUntil`; `useFieldInteraction` drops `hintFor`; `MatchRoomView` hint = match-level only; `room-flow.spec.ts:67` reads the live row
- [x] T026 [test] `tests/integration/ui/room-fixtures.spec.ts`: `R4` visible with ≥6px offset; each row `border-bottom-width` 1px, children 0px

## Phase 5: US4 — Field marks (R4)

- [x] T027 [test] `Field.spec.tsx` shared numeral has no seat; `room-css.test.ts` shared-value block is ink, scored-opp numeral is `--opp-text`
- [x] T028 [impl] `app/styles/room.css` shared rule; S8 verified by the existing axe tests

## Phase 6: US5 — Fixtures & baselines (R5)

- [x] T029 [test] `tests/unit/app/dev/RoomFixture.spec.tsx`: every `ROOM_PHASES` entry renders; `roomFixtures.imports.test.ts` still green
- [x] T030 [impl] `app/dev/room/fixtures.ts` (+ literals), `RoomFixture.tsx`, `page.tsx` default `picking`, `ci.yml` wait-on URL
- [x] T031 [test] `room-fixtures.spec.ts`: every phase screenshotted; `phone-sheet` at 390×844 with the sheet open; `low-clock` also under reduced motion
- [x] T032 Baselines: darwin locally (49 files); linux for the phases whose ledger changed and for the new phases come from the CI visual job's artifact on the first push (the stale ones were removed so CI cannot pass on them)
- [x] T033 [human] Acceptance checklist walked on the darwin baselines (`picking`, `previewed`, `illegal`, `opp-played`, `low-clock` at 1440/1280; `phone-sheet` at 390) — see spec.md Outcome; paste the ticked list and the `picking` baselines in the PR

## Phase 7: US6 — Documents (R6)

- [x] T034 DS §4, §5.1, §5.4, §7, §8; `CLAUDE.md`; corrected bundle copy
- [x] T035 Docs move: repoint every reference to `docs/design_documentation/README.md`; refresh `docs/design_documentation/README.md`
- [x] T036 `pnpm docs:check` green; `tokens.test.ts` unchanged; spec Outcome section

## Dependencies

- T002–T016 before anything is screenshotted.
- T020–T021 before T026; T022–T023 before T024–T025; T030 before T031–T033.
- T034–T036 last.
