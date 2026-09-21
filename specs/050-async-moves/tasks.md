	# Tasks: Ten moves each on one shared clock

Each task lands red → green → refactor; the test commit precedes the implementation commit.

## P0 — Design and documents (no code)

- [x] T001 Design canvas (eleven artboards) — https://claude.ai/artifact/SU3bj2nTT4tEyCiinoEAAB
- [x] T002 `specs/050-async-moves/` spec, plan, research, data-model, contracts, quickstart, tasks
- [x] T003 `docs/prd_and_requirements/wottle_game_rules.md` §2, §2a, §3.4, §3.7 (withdrawn), §5.3, §5.4 (withdrawn), §5.5, §7.1, §8, §10 row, §11, §12
- [x] T004 `docs/prd_and_requirements/wottle_prd.md` §1.4, §1.6, match flow, edge cases
- [x] T005 Design system §1 (principles 4, 6), §5.1, §5.3, §5.4, §5.9, §6, §7, §8, §9
- [x] T006 `app/rules/page.tsx` sections 1, 5, 6 and the lede
- [x] T007 `CLAUDE.md`: overview, design bullets, architecture §4/§5/§7, disconnect handling, entities, move flow, status table, fixture phases, commands
- [x] T008 `scripts/docs/consistency-grep.sh`: retired phrases

## P1 — Server and client core

- [x] T010 Migration `20260921001_async_moves.sql` + `scripts/supabase/{verify,verify-realtime,seed}.ts` (the seed also resets the two dev players' ratings and counts, decided 2026-09-21), `policies/check.ts`
- [x] T011 `lib/types/match.ts`, `lib/types/board.ts`, `lib/match/schemas.ts` (`moveRequestSchema`, `moveResolutionSchema`) — tests first
- [x] T012 `lib/match/moveResolver.ts` (`resolveOne` pure; the claim/finish loop) — `tests/unit/lib/match/moveResolver.spec.ts`
- [x] T013 `lib/match/resultCalculator.ts` moves-first — `resultCalculator.test.ts`
- [x] T014 `lib/match/matchSettlement.ts` + `app/actions/match/settleMatch.ts` + cron sweep — `matchSettlement.spec.ts`
- [x] T015 `app/actions/match/completeMatch.ts` CAS + scores from `matches`
- [x] T016 `lib/match/movePublisher.ts`, `lib/realtime/matchChannel.ts` (`move-resolved`)
- [x] T017 `app/actions/match/submitMove.ts` rewrite + `/api/match/[matchId]/move` — `submitMove.test.ts`, `post-move.contract.test.ts`
- [x] T018 `lib/match/stateLoader.ts` new shape, start, self-heal dispatch — `stateLoader.test.ts`
- [x] T019 `lib/match/wordHistory.ts` + `/api/match/[matchId]/words`; `integrityCheck.ts` per move; `previewSwap.ts` reads `matches.board`; `claimWin.ts` narrowed
- [x] T020 Delete the round world (`roundEngine`, `instantScoring`, `conflictResolver`, `recoverStuckRound`, `stateMachine`, `roundEndWrite`, `clockEnforcer`, `frozenTilePersistence`, `frozenTileMerge`, `partialReveal`, `timerStore`, `publishRoundSummary`, `triggerTimeoutCheck`, `observability/instantScoring`, the round summary route) and their tests
- [x] T021 `lib/room/moveState.ts` — `moveState.spec.ts`
- [x] T022 `lib/room/fieldInteraction.ts` new events — `fieldInteraction.spec.ts`
- [x] T023 `lib/room/roomStore.ts` (`holdMove`, `applyResolution`), `safetySnapshot.ts`, `revealSequence.ts` (`MOVE_HOLD_MS`) — tests
- [x] T024 Hooks: `useMatchTransport` (`move-resolved`), `useFieldInteraction` (letters), `useMoveHold`, `useDeadlineTick`, `useMatchOverSlip`
- [x] T025 `MatchRoomController.tsx` two reveals, `canPick`, no pins; `MatchRoomView.tsx`
- [x] T026 Integration: `receiveMove.race.test.ts`, `moveResolver.race.test.ts`, `stuckMove.test.ts`, `settlement.test.ts`

## P2 — Room polish, fixtures, end-to-end

- [x] T030 `PlayerBar.tsx` without clock; `BarLane.tsx` (`moves` · `searching` · `disconnected`)
- [x] T031 `Ledger.tsx` caption clock (`.ledger__caption-clock`, low-clock blink, reduced motion), rows by move, `moveRail.ts`; `ledgerRows.ts`, `accumulatedWords.ts` keyed by player+seq
- [x] T032 `Slip.tsx` end-early kind; verdict copy for the three natural reasons
- [x] T033 `lib/constants/copy.ts` retire/add strings; acceptance greps
- [x] T034 `app/dev/room/fixtures.ts` + `RoomFixture.tsx` new phases; `pnpm test:visual --update-snapshots` (darwin baselines committed; the linux ones come from the CI visual job's artifact, as before)
- [x] T035 Playwright `moves-flow.spec.ts`, `deadline-flow.spec.ts` (`PLAYTEST_MATCH_CLOCK_MS`), `disconnect-claim.spec.ts` → end-early gate
- [x] T036 Perf: `perf:move-receipt`, `tests/perf/move-resolve.yml`; delete `perf:instant-scoring`

## P3 — Sweep

- [ ] T040 `tests/unit/styles/acceptance-grep.test.ts` retired names; `pnpm docs:check`; CLAUDE.md status tables and counts
