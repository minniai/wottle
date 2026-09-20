# Tasks: Scored-letter integrity and ownership

**Input**: Design documents from `/specs/049-scored-letter-integrity/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md` (the diagnosis; read §1 first), `data-model.md`, `contracts/{state-loader,round-end-write,integrity-check,ownership-rendering}.md`, `quickstart.md`

**Tests**: MANDATORY (constitution VII). Every `[test]` task fails before its `[impl]` task and passes after; one commit per passing test. Baselines change only through `pnpm test:visual --update-snapshots` after that phase's unit tests are green.

**Organization**: by user story. US1 is four independent fixes that share one pure module; they can be worked in any order after Phase 2. US2 is presentation and can start in parallel with US1 on a separate branch.

| Story | Slice | Priority |
| --- | --- | --- |
| US1 The field shows the board the match was played on | I · loader, guarded write, integrity check, no lying band | P0 |
| US2 Every scored letter has one owner and one colour | II · ownership rendering | P1 |

## Path Conventions

Single Next.js application at the repository root. Server code in `lib/match/` and `app/actions/`; room code in `lib/room/` and `components/room/`; fixtures in `app/dev/room/`; baselines in `tests/integration/ui/room-fixtures.spec.ts-snapshots/`. Branched from `main`; rebase onto `main` after PR #263 (spec 048) merges — both touch `app/dev/room/RoomFixture.tsx` and the baselines.

---

## Phase 1: Setup

- [x] T001 Create `specs/049-scored-letter-integrity/{spec,plan,research,data-model,quickstart,tasks}.md` and `contracts/` (done by `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`)
- [x] T002 [P] Add the three event helpers to `lib/observability/log.ts`: `trackMatchIntegrityFailed({ matchId, round, failures })` at error, `trackStaleMatchWrite({ matchId, expectedRound, carried })` at warn, `trackBandRecordMismatch({ matchId, record })` at warn; one unit test each in `tests/unit/lib/observability/log.spec.ts` asserting the event name and level
- [x] T003 [P] Add a regression row to `docs/prd_and_requirements/wottle_game_rules.md` §10 naming the seed-regeneration defect (research.md §1.3) and the stale round-end write (§1.4), dated 2026-09-20, with the invariant each pins

---

## Phase 2: Foundational — the integrity module and the last-played round

**Purpose**: `verifyMatchIntegrity` is used by the round engine, recovery and (mirrored) the client; `lastPlayedRound` is used by the loader and by the tests that build the 20 September row.

- [x] T004 [test] `tests/unit/lib/match/matchIntegrity.spec.ts`: a clean match returns `[]`; a record whose letters moved returns one `spelling` failure naming the record, the expected word and the letters found; a frozen cell whose letter differs from `letterAtFreeze` returns one `immutability` failure naming the cell and both letters; Icelandic upper-casing (`ð → Ð`, `æ → Æ`, `í → Í`) folds before comparing; a record with the wrong number of tiles is a `spelling` failure; the function never throws
- [x] T005 [impl] `lib/match/matchIntegrity.ts`: `verifyMatchIntegrity({ board, records, frozenTiles, letterAtFreeze }): MatchIntegrityFailure[]` and the `MatchIntegrityFailure` type per `contracts/integrity-check.md`; `letterAtFreeze(rounds, records)` helper that maps each frozen cell to the letter on the `board_snapshot_after` of the round whose word froze it
- [x] T006 [test] `tests/unit/lib/match/stateLoader.lastPlayed.spec.ts` (new file, mock client as in `tests/unit/match/stateLoader.*.test.ts`): `lastPlayedRound` returns the highest `round_number` with a non-null `board_snapshot_after`; `null` for a match with no rounds
- [x] T007 [impl] `lib/match/stateLoader.ts`: export `lastPlayedRound(client, matchId)`

**Checkpoint**: `pnpm test:unit -- tests/unit/lib/match` green.

---

## Phase 3: User Story 1 — The field shows the board the match was played on (Priority: P0)

**Goal**: A completed match is served from its last played round; a missing round row is a fault, never a fresh board; a late round-end write changes nothing; every resolution is verified; the client draws no band it cannot verify.

**Independent Test**: The three matches of 20 September 2026 render their round-10 boards with every band spelling; a replayed round-5 write against a completed row is a no-op; a seeded misspelled record draws no band and logs once.

### I.1 The loader (contracts/state-loader.md)

- [x] T008 [US1] [test] `tests/unit/lib/match/stateLoader.lastPlayed.spec.ts` (extend): a `completed` match with rounds 1–10 and `current_round = 11` serves round 10's `board_snapshot_after`, round 10's scoreboard snapshot and round 10's summary, and reports `currentRound: 11`; the same rows with `current_round = 6` (the 20 September shape: build it from `research.md` §1.4's values) still serve round 10's; an `abandoned` match likewise; an `in_progress` match with `current_round = 7` and no round 7 serves round 6's `_after`, logs `match.round.missing` and calls `triggerRecoveryInBackground`; a match with no rounds still bootstraps round 1 from the seed; a match with rounds whose snapshot fails to parse serves the previous round's `_after`, logs, and does **not** call `generateBoard`
- [x] T009 [US1] [impl] `lib/match/stateLoader.ts`: for `completed` / `abandoned` resolve the serving round via `lastPlayedRound`; `ensureBoardSnapshot` gains `hasRounds` and regenerates only when `false`, otherwise throws `MatchStateError`; the in-progress missing-row branch (`isRoundMissing`) joins `isMatchMissingWinner` in the recovery trigger; `scoresSnapshotRound` and `loadLatestRoundSummary` take the serving round

### I.2 The guarded round-end write (contracts/round-end-write.md)

- [x] T010 [P] [US1] [test] `tests/unit/lib/match/roundEngine.staleWrite.spec.ts` (mock client as in `tests/unit/lib/match/roundEngine.test.ts`): the step-14 update carries `.eq("current_round", <round read at step 1>)` and `.neq("state", "completed")`; a zero-row result logs `match.write.stale` with the carried values and returns `{ status: "not_advancing" }` without throwing; a matching row advances as before; a replay of a round-5 write against the 20 September row (`state: completed`, `current_round: 6`) changes nothing
- [x] T011 [US1] [impl] `lib/match/roundEngine.ts` step 14 per T010; `.select("id")` on the update to read the affected rows
- [x] T012 [P] [US1] [test] `tests/unit/lib/match/recoverStuckRound.test.ts` (extend): recovery's advancing write carries the same two conditions and logs on zero rows
- [x] T013 [US1] [impl] `lib/match/recoverStuckRound.ts` per T012

### I.3 The integrity check after resolution (contracts/integrity-check.md)

- [x] T014 [US1] [test] `tests/unit/lib/match/roundEngine.integrity.spec.ts`: after step 9c `verifyMatchIntegrity` is called with the persisted board, the match's records and `letterAtFreeze`; with `[]` the round proceeds to step 13; with a failure it logs `match.integrity.failed` with the failures, calls `recoverStuckRound(matchId)` and returns `{ status: "not_advancing", reason: "integrity" }` without inserting the next round or advancing the match
- [x] T015 [US1] [impl] `lib/match/roundEngine.ts` between steps 9c and 10; one records read (`word_score_entries` for the match) and the rounds' `board_snapshot_after` for `letterAtFreeze`
- [x] T016 [P] [US1] [test] `tests/unit/lib/match/recoverStuckRound.test.ts` (extend): after recovery re-scores, the check runs on its result; a failure logs and does not create the next round
- [x] T017 [US1] [impl] `lib/match/recoverStuckRound.ts` per T016

### I.4 The client never draws a lie (contracts/integrity-check.md, client mirror)

- [x] T018 [P] [US1] [test] `tests/unit/lib/room/bandGeometry.spec.ts` (extend): `bandCells` takes the board; a settled record whose cells are all frozen but whose letters do not spell the word returns `null`; the live and trusted rounds are still drawn from coordinates; a record with the wrong tile count returns `null`
- [x] T019 [US1] [impl] `lib/room/bandGeometry.ts`: `bandCells(word, board, frozenTiles, trusted)` spells before it draws; `bandsFromWords` gains `board` in `BandsInput`; the one caller in `components/room/MatchRoomController.tsx` passes `match.board`
- [x] T020 [P] [US1] [test] `tests/unit/lib/room/wordIntegrity.spec.ts` (extend): `reportWordIntegrity(matchId, board, words)` calls `trackBandRecordMismatch` once per match for the first mismatch, never again for that match, in production and development alike, and never throws
- [x] T021 [US1] [impl] `lib/room/wordIntegrity.ts` and its call in `components/room/MatchRoomController.tsx` (drop the `NODE_ENV` gate; keep the per-match dedupe ref)
- [x] T022 [US1] [test] `tests/integration/ui/match-completion.spec.ts` (extend): after the resign-to-final flow, on both clients every `[data-testid="field-band"]`'s `data-word` equals the letters read from the cells it covers, and the field's letters differ from round 1's where round 1's swaps moved them (read the starting board before the first swap and compare)
- [x] T023 [US1] [impl] Fix anything T022 surfaces
- [ ] T024 [US1] Verify against production per `quickstart.md`: run the research §4 diagnostic for `ed22c625`, deploy to a preview, open the match as either player, confirm the round-10 board and spelling bands; record the result in `research.md` §1 as "verified after fix"

**Checkpoint**: `pnpm test:unit -- tests/unit/lib/match tests/unit/lib/room` green; a completed match renders its last board.

---

## Phase 4: User Story 2 — Every scored letter has one owner and one colour (Priority: P1)

**Goal**: A scored letter is coloured by its frozen tile's owner; a band covers only the letters its word froze first; nothing scored is ink.

**Independent Test**: `/dev/room?phase=reveal` shows LEK over GILT with the L in coral inside GILT's tint and LEK's band over E and K; no cell anywhere has `data-state="shared"`.

- [ ] T025 [P] [US2] [test] `tests/unit/lib/room/bandGeometry.spec.ts` (extend): `ownerSeatOf(frozenTiles, coord, viewerSlot)` resolves through `seatForSlot`; `bandCells` returns only the cells whose frozen owner is the word's seat and `WordBand.wordCells` the whole word; the four cases of `contracts/ownership-rendering.md` (all own; one crossing cell excluded; one-letter extension keeps one cell and a chevron at the whole word's start; same-seat re-crossing keeps all); `sharedCells` is no longer exported (`// @ts-expect-error`)
- [ ] T026 [US2] [impl] `lib/room/bandGeometry.ts`: `ownerSeatOf`, `wordCells` on `WordBand`, `bandCells` filters by owner, `chevronPath` placed from `wordCells`, `sharedCells` and `seatOfCell` removed
- [ ] T027 [P] [US2] [test] `tests/unit/components/room/Field.spec.tsx`: a cell frozen by `player_b` renders `data-seat="opp"` and its numeral in `--opp-text` whatever bands cover it; a cell frozen by `player_a` under the opponent's band renders `data-seat="you"`; no cell ever has `data-state="shared"`; `aria-label` names one owner; the `sharedCells` prop no longer exists (type-level); hovering a round lights every `wordCells` of its bands, including a cell owned by another band, and the lit cell keeps its `data-seat`
- [ ] T028 [US2] [impl] `components/room/Field.tsx` (seat from `ownerSeatOf`; `shared` derivation removed; highlight from `wordCells`), `components/room/FieldCell.tsx` (`CellState` −`"shared"`), `components/room/FieldBands.tsx` (draw over `cells`, chevron from `wordCells`, dim by `wordCells`)
- [ ] T029 [P] [US2] [test] `tests/unit/styles/room-css.test.ts` (extend): no `[data-state="shared"]` rule remains; `tests/unit/styles/acceptance-grep.test.ts`: `"shared"` as a cell state and `sharedCells` return nothing under `components/` and `app/styles/`
- [ ] T030 [US2] [impl] `app/styles/room.css`: remove the two `shared` rules
- [ ] T031 [US2] [test] `tests/unit/app/dev/RoomFixture.spec.tsx` (extend): in `reveal`, `(7,6)` renders `data-seat="opp"`; the LEK band's `data-cells` (add the attribute to `FieldBands`) lists `(8,6)` and `(9,6)` only; the GILT band lists all four
- [ ] T032 [US2] [impl] `app/dev/room/fixtures.ts` comment and `RoomFixture.tsx` per T031; `components/room/FieldBands.tsx` gains `data-cells`
- [ ] T033 [US2] [test] `tests/integration/ui/room-fixtures.spec.ts` (extend): at 1440×900 `reveal`'s cell `(7,6)` has `data-seat="opp"` and no cell on any phase has `data-state="shared"`
- [ ] T034 [US2] Update baselines (`pnpm test:visual --update-snapshots`) for `reveal`, `settle`, `final`, `over-slip`, `idle`, `played`, `opp-played`, `picking`, `previewed`, `low-clock`, `illegal`, `disconnect`, `resign`, `claim-win`, `phone-sheet` — every phase that shows the crossing — at three viewports; commit both platforms

**Checkpoint**: no `shared` state anywhere; the crossing letter is coral on every fixture that shows it.

---

## Phase 5: Polish & cross-cutting

- [ ] T035 [P] Design system amendments in `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md`: §2 drop the shared-letter-is-ink bullet; §5.1 drop the `shared` row and reword scored/frozen as "the owner's seat colour, inside the owner's band; a letter keeps the colour of the player who froze it first"; §5.2 add "a band covers the letters its word froze first; a crossing keeps the earlier owner; the chevron sits at the whole word's reading start"; §7 Settle row unchanged; §8 no new strings
- [ ] T036 [P] `docs/prd_and_requirements/wottle_game_rules.md` §12: the crossing row per `contracts/ownership-rendering.md`; a new row "Which board the room shows: the last played round's; never the seed once a round exists"
- [ ] T037 [P] `CLAUDE.md`: Design section line for the crossing rule; Project Overview sentence for spec 049; Disconnect/Reconnection unchanged; test counts
- [ ] T038 [P] `tests/integration/ui/README.md`: `field-band` gains `data-cells`; `shared` removed from the `data-state` list
- [ ] T039 Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm docs:check && pnpm test:visual`, then `match-completion`, `room-flow` and `rounds-flow` (Firefox project) against local Supabase with `RATE_LIMIT_DISABLED_SCOPES=auth:login` and realtime on; fix residue; regenerate linux baselines in CI and commit them
- [ ] T040 File the follow-up for the instant-scoring race window (research.md §3) as a Linear issue with the code pointers, outside this spec

---

## Dependencies & Execution Order

```text
Phase 1 (T001–T003)
  └─ Phase 2 (T004–T007)        ← verifyMatchIntegrity + lastPlayedRound
       ├─ Phase 3 US1
       │    ├─ I.1 loader (T008–T009)         ← needs T007
       │    ├─ I.2 guarded write (T010–T013)  ← independent of I.1
       │    ├─ I.3 integrity check (T014–T017) ← needs T005; I.2 first in roundEngine.ts to avoid a merge on the same function
       │    ├─ I.4 client mirror (T018–T021)  ← independent; shares bandGeometry.ts with US2 (sequence T019 before T026)
       │    └─ T022–T024 after all four
       └─ Phase 4 US2 (T025–T034)             ← needs only Phase 2; after T019 in bandGeometry.ts
Phase 5 (T035–T040) after everything
```

## Parallel Opportunities

- Phase 1: T002 ∥ T003.
- Phase 2: T004 ∥ T006 (tests); their impls are separate files.
- Phase 3: I.1, I.2 and I.4 touch different files and can run together; I.3 follows I.2 in `roundEngine.ts`. Within I.2, T010 ∥ T012; within I.4, T018 ∥ T020.
- Phase 4 can run on a second branch beside Phase 3 once T019 has landed.
- Phase 5: T035–T038 all parallel.

## Implementation Strategy

1. **MVP** = Phase 2 + I.1 + I.4 (T004–T009, T018–T024): the affected matches render correctly and the client can never again draw a non-word. One PR; it is the production-visible fix.
2. **Second PR**: I.2 + I.3 (the guard and the check): server hardening, its own review because it touches the round engine.
3. **Third PR**: Phase 4 + Phase 5: the ownership rendering, baselines and documents.

Every PR runs the visual suite; baselines for both platforms are committed in the PR that changes them.
