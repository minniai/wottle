# Tasks: The result, rematch and review

**Input**: Design documents from `specs/071-result-rematch-review/`: plan.md, spec.md (Q1–Q2), research.md (R1–R17), data-model.md, contracts/routes-and-actions.md, contracts/room-derivations.md, quickstart.md.

**Tests**: Required. The constitution's principle VII (TDD) is non-negotiable, so every implementation task is preceded by a failing test.

**Organization**: One phase per user story, in the order they can land.
- The result (US1) comes first because rematch and review both start from it.
- Review is split into its content (US3) and its URL and history (US4). US4 cannot be tested without US3's page.
- The phone (US8) comes after the desktop stories it adapts.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task).
- **[Story]**: US1–US9 from spec.md.

---

## Phase 1: Setup

- [X] T001 Add `lib/constants/rematch.ts` (the request's 30s, the 2:00 window, and the `match:rematch` limit of 6/min). The repo has no rate-limit scope table; each action passes its limit inline, so the actions read this constant. `lib/review/` is created with its first module.
- [X] T002 No placeholder phases: `room-fixtures.spec.ts` snapshots every entry of `ROOM_PHASES`, so each story adds its own phases in its fixture task, with their baselines.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the migration, the shared types, the `ended_early` reason, the moves route and the review step builder.

### Tests first

- [X] T003 Write failing integration tests for the migration's schema in `tests/integration/db/result-rematch-review-schema.test.ts`:
  - `presence_tabs.match_id` exists and is nullable;
  - `rematch_requests.expires_at` defaults to `created_at + 30s` and is backfilled;
  - `matches.ended_reason` accepts `'ended_early'`;
  - the functions `player_on_match`, `pair_cooldown_until`, `request_rematch`, `decline_rematch`, `withdraw_rematch`, `expire_due_rematches` and `rematch_series` exist;
  - `beat_tab` accepts `p_match_id`.
- [X] T004 [P] Write failing unit tests for `buildReviewSteps` in `tests/unit/lib/review/buildReviewSteps.spec.ts`, from a 20-move fixture (IS-M, with steps 5–6 two consecutive Kári moves):
  - steps follow `globalSeq`;
  - a refused row is `kind: "refused"`, with the board unchanged, points 0 and no count;
  - `movesPlayed` counts only resolved rows;
  - `clockMs = durationMs − (receivedAt − startedAt)`, floored at 0;
  - a closing step appears for `incomplete`, `both_incomplete` and `ended_early` with unplayed moves, and is absent for `moves_complete` and `forfeit`;
  - **invariant:** the last step's totals equal `finalScores`, and its board equals the final board, for each of the five fixtures.
- [X] T005 [P] Write failing contract tests in `tests/contract/match-moves.contract.test.ts` for `GET /api/match/[matchId]/moves`:
  - signed out on a completed match: 200 with the `MovesResponse` shape;
  - a live, pending, void or unknown match: 404 `not_found`, the same body for each;
  - a malformed id: 400;
  - `Cache-Control` is immutable;
  - rejected rows are included and pending rows are not.
- [X] T006 [P] Write failing unit tests in `tests/unit/app/actions/completeMatchAbandoned.test.ts` (its completion harness):
  - `completeMatchInternal(id, "ended_early")` applies timeout penalties like `natural`, decides the winner by the normal rules and writes `ended_reason = 'ended_early'`;
  - `claimWin` calls it with `"ended_early"` (update the existing `claimWin` spec).

### Implementation

- [X] T007 Write `supabase/migrations/20260926001_result_rematch_review.sql` per data-model.md:
  - the column changes and the widened `ended_reason` check;
  - `player_on_match` and `pair_cooldown_until`;
  - `beat_tab` with `p_match_id`;
  - `request_rematch`, `decline_rematch`, `withdraw_rematch` and `expire_due_rematches`;
  - `accept_rematch` with the `expires_at` check (crossed is exempt);
  - `send_challenge`'s cooldown through `pair_cooldown_until`;
  - `rematch_series`;
  - grants to `service_role` only.

  Apply it with `pnpm supabase:migrate`. T003 passes.
- [X] T008 [P] Add `RematchRefusal`, `RematchRequestView`, `RematchOffer` and `SeriesView`, `"ended_early"` in `MatchEndedReason`, and `MatchState.rematch?` and `series?` to `lib/types/match.ts`. Add the review types (`ReviewMoveRow`, `ReviewStep`, `ReviewStepKind`, `MovesResponse`) to `lib/types/review.ts`. Keep `rematchMatchId` for now.
- [X] T009 Make `ended_early` a natural completion reason in `app/actions/match/completeMatch.ts`, and have `app/actions/match/claimWin.ts` pass it. Add the reason to `lib/room/ledgerRows.ts` `FORCED` / `naturalDetail` so nothing renders `undefined`. T006 passes.
- [X] T010 [P] Implement `lib/review/buildReviewSteps.ts`: pure, each function under 20 lines, with helpers `toStep`, `closingStep` and `countMoves`. T004 passes.
- [X] T011 Implement `lib/review/movesRepository.ts`: a service-role read of `matches` plus `match_moves` with embedded `word_score_entries`, in `global_seq` order, excluding pending and resolving rows. Map to `MovesResponse`, with `initialBoard` from the first row's `board_before`. Then `app/api/match/[matchId]/moves/route.ts`: Zod on the id, 404 unless completed and not void, immutable cache header, and a `review.moves.served` perf mark. T005 passes.

**Checkpoint**: `pnpm test:unit`, the contract and schema tests, typecheck and lint pass.

---

## Phase 3: User Story 1 – The result says who won and why (P1) 🎯 MVP

**Goal**: The slip lands after the last reveal, focuses its headline, guards its actions, and says once why the match ended.

**Independent test**: The `result-*` fixtures in both languages, plus `match-completion.spec.ts` for timing and focus.

### Tests first

- [X] T012 [P] [US1] Write failing unit tests for `resultDetail` in `tests/unit/lib/room/resultDetail.spec.ts`:
  - every reason in the contract table, in EN and IS;
  - a draw drops the margin;
  - the phone form keeps two clauses;
  - no clause appears twice.
- [X] T013 [P] [US1] Write failing unit tests for `bestWordOf` (the viewer's highest scoring word, or null) in `tests/unit/lib/room/bestWord.spec.ts`, and for the result title (`Birna wins · Wottle`, `Draw · Orðusta`) in `tests/unit/lib/room/tabTitle.spec.ts` (`tabTitle` takes `result`).
- [X] T014 [P] [US1] Write failing unit tests for `useActivationGuard(key, 500)` in `tests/unit/components/room/hooks/useActivationGuard.spec.tsx`, under fake timers:
  - activation is ignored before 500ms and allowed after;
  - a new key restarts the guard.
- [X] T015 [P] [US1] Update `tests/unit/components/room/Slip.matchOver.spec.tsx` so it fails:
  - focus is on the headline (`tabIndex=-1`), not `rematch ▸`;
  - every action is ignored for 500ms;
  - the detail line renders `resultDetail`;
  - the best-word line is present or absent;
  - action row 1 is `rematch ▸` · `new opponent ▸`, and row 2 is `review the match ▸` · `lobby`;
  - the headline is in an assertive live region, announced once;
  - the winner's scoreboard sub-line ends `· wins` / `· vann`, and a draw adds nothing (`tests/unit/lib/room/scoreboard.spec.ts`).
- [X] T016 [P] [US1] Write failing tests for the history kinds in `tests/unit/components/room/useLiveBackGuard.spec.tsx`:
  - on completion the guard entry is replaced by `{kind:"result"}` and `beforeunload` is removed;
  - a popstate after completion raises no leave slip.

### Implementation

- [X] T017 [P] [US1] Implement `lib/room/resultDetail.ts` and the copy in `lib/i18n/copy/en.ts` and `is.ts`: the clause strings, plus `YOUR_BEST_WORD`, `resultTitle` and the IS early-end string marked `// native-read`. Retire the detail branch of `buildVerdict` in `lib/room/ledgerRows.ts` so the ledger verdict and the slip share one source. T012 passes.
- [X] T018 [P] [US1] Implement `lib/room/bestWord.ts` and `lib/room/resultTitle.ts`. T013 passes.
- [X] T019 [P] [US1] Implement `components/room/hooks/useActivationGuard.ts`, and use it for the existing guarded primaries in `components/room/Slip.tsx` so there is one guard. T014 passes.
- [X] T020 [US1] Rework the matchOver branch of `components/room/Slip.tsx`:
  - headline ref and `tabIndex=-1`;
  - detail from props;
  - the best-word line;
  - two action rows, each guarded;
  - fix the doubled `accept ▸ · decline` by trimming `rematchRequest` in both copy files.

  Extend `lib/room/slip.ts` `matchOver` with `detail: string[]` and `bestWord`. Remove the unused `EndReason` and `endReasonFor` from `lib/room/slip.ts` and `components/room/hooks/useMatchOverSlip.ts`. T015 passes.
- [X] T021 [US1] Wire the result in `components/room/MatchRoomController.tsx`:
  - build `detail` from `matchState.endedReason` and the facts (words and territory from the ledger, the resignation time `completed_at − started_at`);
  - build `bestWord` from the accumulated words;
  - the tab title via `resultTitle`;
  - `· wins` appended to the winner's final sub-line in `lib/room/scoreboard.ts`, not on a draw;
  - `readOnly` viewers get no slip (`useMatchOverSlip` skips them).
- [X] T022 [US1] Update `components/room/hooks/useLiveBackGuard.ts`: replace the guard with `{kind:"result"}` on completion, and never re-arm. T016 passes.
- [X] T023 [US1] Fill the `result-moves`, `result-incomplete`, `result-both`, `result-forfeit` and `result-early` phases in `app/[locale]/dev/room/fixtures.ts` and `RoomFixture.tsx`. Add them to `tests/integration/ui/room-fixtures.spec.ts`, and take baselines with `pnpm test:visual --update-snapshots` on a production build.
- [X] T024 [US1] Extend `tests/integration/ui/match-completion.spec.ts`:
  - the slip appears 500–700ms after the final settle;
  - `document.activeElement` is the headline;
  - an Enter within 500ms does nothing;
  - Esc lifts and `result ▸` restores;
  - one Back reaches the lobby.

**Checkpoint**: US1 stands alone. The result is correct with the old rematch still in place.

---

## Phase 4: User Story 2 – Ask for a rematch, once (P1)

**Goal**: One request per match, 30s long, within 2:00, with both players on the match, accepted through `create_match_between` and closed for good by a decline or silence.

**Independent test**: `tests/integration/db/rematch.test.ts`, then `rematch-flow.spec.ts` in two browsers.

### Tests first

- [X] T025 [P] [US2] Write failing integration tests in `tests/integration/db/rematch.test.ts` (harness from `tests/integration/db/harness.ts`):
  - `request_rematch` refuses: `not_completed` (live, void, abandoned), `not_participant`, `window_closed` (`completed_at` 121s ago), `opponent_left` and `self_left` (no fresh tab on the match), `already_requested`;
  - a hidden fresh tab counts (Q2);
  - a sent request has `expires_at = now + 30s`;
  - the opponent's request crosses into one new match with both seated;
  - `decline_rematch` sets `declined`;
  - `withdraw_rematch` by the requester sets `withdrawn`, and by the responder sets `superseded`;
  - `accept_rematch` after `expires_at` returns `expired`;
  - `expire_due_rematches` returns the match ids and sets `responded_at = expires_at`;
  - a busy player's accept is refused and the request becomes `superseded`;
  - a responder with no fresh tab on the match: `expire_due_rematches` marks the request `superseded`, and `pair_cooldown_until` stays null.
- [X] T026 [P] [US2] Write failing tests in `tests/integration/db/pair-cooldown.test.ts`:
  - a declined or expired rematch from A to B makes `send_challenge(A→B)` return `declined_recently` for 60s;
  - B→A is not held;
  - three rematch declines do not trigger `challenger_silenced`;
  - a withdrawn request starts no cooldown.
- [X] T027 [P] [US2] Write a failing race test in `tests/integration/db/rematch.race.test.ts`: 100 rounds of both players calling `request_rematch` at once. Each round creates exactly one match, and neither player sees an error.
- [X] T028 [P] [US2] Write failing unit tests for `deriveRematchView` in `tests/unit/lib/room/rematchView.spec.ts`: every row of the contract table, the countdown and drain at 24s and at 0, `challenge again` enabled or disabled by the cooldown, EN and IS lines, and the name-safe IS strings.
- [X] T029 [P] [US2] Write failing unit tests for `readRematchOffer` in `tests/unit/match/rematchOffer.spec.ts`, with the Supabase client mocked, plus a test that `loadMatchState`'s result has no `rematch` key:
  - `offered` only with no request, inside the window and with both on the match;
  - `reason` for each refusal;
  - `cooldownUntil` from `pair_cooldown_until`;
  - `expire_due_rematches` is called before the read.
- [X] T030 [P] [US2] Write a failing grep test `tests/unit/match/rematch-one-caller.test.ts`: only `lib/match/rematchService.ts` may name the RPCs `request_rematch`, `accept_rematch`, `decline_rematch`, `withdraw_rematch` and `expire_due_rematches`.
- [X] T031 [P] [US2] Update `tests/unit/components/room/Slip.matchOver.spec.tsx` and `tests/unit/components/room/Ledger.call.spec.tsx` so they fail on the new rows:
  - the negotiation row for `sent` (line, drain, `cancel ▸` at the row end), `incoming` (`accept ▸` primary, unfocused and guarded; `decline`) and `closed` (`new opponent ▸` primary);
  - with the slip lifted, the rematch is the ledger's first call line with `accept ▸` and `decline`;
  - in `tests/unit/components/room/MatchRoomController.rematch.spec.tsx`: an incoming request with the slip lifted sets the title `(1) Kári asks for a rematch · Wottle`, sets the favicon to the opponent's seat, plays the `challenge` cue once and writes a polite announcement; nothing fires for your own sent request.

### Implementation

- [X] T032 [US2] Rewrite `lib/match/rematchService.ts` as the only caller of the rematch RPCs: `requestRematch`, `acceptRematch`, `declineRematch`, `withdrawRematch` and `expireDueRematches`, each returning typed results. Keep `walkRematchChain` and `deriveSeriesContext`, which are pure. Drop the TypeScript `validateRematchRequest`, now decided in SQL, and its tests. Point `lib/match/createMatch.ts` `acceptRematch` at the service. T025–T027 and T030 pass.
- [X] T033 [US2] Reshape the actions:
  - `app/actions/match/requestRematch.ts` becomes a thin caller with rate limit `match:rematch`;
  - `respondToRematch.ts` handles accept and decline (drop the TypeScript 30s check);
  - new `withdrawRematch.ts`, and delete `cancelRematch.ts`.

  Each logs `match.rematch.*` and calls `pokePlayers(players, "rematch")`. Update `lib/match/rematchAnnouncements.ts` so no broadcast carries an id. Add unit tests beside the existing action specs.
- [X] T034 [US2] Implement `lib/match/rematchOffer.ts` `readRematchOffer(client, matchId, viewerId)`: lazy `expire_due_rematches`, the request row, the window, `player_on_match` for both players, `pair_cooldown_until(viewer, opponent)` and `opponentHere` from presence. Attach it in `app/api/match/[matchId]/state/route.ts` and `app/[locale]/(room)/match/[matchId]/page.tsx` for participants only; never in `loadMatchState` or the publisher. T029 passes.
- [X] T035 [US2] Have `useTabPresence` in `components/standing/hooks/useTabPresence.ts` send `matchId` when on `/match/:id`. Add it to `app/api/presence/beat/route.ts` (Zod) and `lib/presence/presenceService.ts`. Extend `tests/unit/components/standing/useTabPresence.spec.tsx`.
- [X] T036 [US2] Add the sweep step `expire_due_rematches` plus pokes to `app/api/cron/sweep-stale-matches/route.ts`, with a unit test in its existing spec.
- [X] T037 [P] [US2] Implement `lib/room/rematchView.ts` and the copy (EN and IS: `rematch sent`, `asks for a rematch`, `accepted`, `declined`, `no answer`, `withdrew`, `started another match`, `has left`; IS name-safe). T028 passes.
- [X] T038 [US2] Thin `lib/room/useRematchNegotiation.ts` down to commands only (request, accept, decline, withdraw), plus navigation with `router.replace` to the new match (R4). Remove the local 30s timer and the event handlers. The view comes from `deriveRematchView(matchState.rematch, …, now)` with a 1s tick. Update `tests/unit/lib/room/useRematchNegotiation.test.ts`.
- [X] T039 [US2] Render the negotiation in `components/room/Slip.tsx`. It replaces action row 1 only, and every changed action is guarded by its key. `new opponent ▸` and `lobby` withdraw first. Then `lib/room/ledgerCallLine.ts` takes the rematch view (incoming first), and `MatchRoomController.tsx` passes it when the slip is lifted and retires `rematchLine` notices. An incoming request sets the title `(1) Kári asks for a rematch · <wordmark>`, the favicon in `--opp` and the challenge cue through the standing hooks, and gets a polite announcement. T031 passes.
- [X] T040 [US2] Series:
  - `rematch_series` is read in `lib/match/rematchRepository.ts`, replacing `fetchMatchChainForSeries`;
  - `MatchState.series` comes from `deriveSeriesContext` in the loader when `table.rematchOf` is set;
  - the scoreboard sub-line appends `· match 2 · Birna 1–0` in `lib/room/scoreboard.ts`.

  Unit tests in `tests/unit/lib/room/scoreboard.spec.ts` and `tests/unit/match/rematchRepository.spec.ts`.
- [X] T041 [US2] Remove `MatchState.rematchMatchId` and its readers (`useRematchNegotiation`, the loader's `rematchOf()`), reading `rematch.request.newMatchId` instead. Update `tests/unit/match/stateLoader*.spec.ts`.
- [X] T042 [US2] Fill the `rematch-sent`, `rematch-in` and `rematch-declined` fixtures, and take baselines. (`rematch-in-review`, the RematchIncoming artboard, moves to T058: it needs the review fixture.)
- [X] T043 [US2] Write `tests/integration/ui/rematch-flow.spec.ts` (tagged `@two-player-playtest`):
  - send, cancel, and send refused;
  - decline, then `challenge again` in cooldown;
  - expiry after 30s;
  - an incoming request with the slip lifted (the slip stays down, the ledger line shows, the title changes);
  - a crossed request leads both players to one table with the series line.

  Run it with `--workers=1`.

**Checkpoint**: US1 and US2 pass together. Rematch works end to end.

---

## Phase 5: User Story 3 – Review the match step by step (P1)

**Goal**: The same field shows any step. The scoreboard's clock row is the scrubber. There are labelled controls, keys, ledger cells, and a cursor line.

**Independent test**: the `review` fixtures, then `/match/:id?review=7` on a seeded completed match.

### Tests first

- [X] T044 [P] [US3] Write failing unit tests in `tests/unit/lib/review/`:
  - `reviewParam.spec.ts` (`parseReviewParam`: null, `last`, empty, text, 0, 99, 7);
  - `scrubber.spec.ts` (`stepAtFraction`, `scrubberValueText` for a move, a miss, a refusal and the closing step, EN and IS);
  - `cursorLines.spec.ts` (every line form in the contract, fitting 40 mono characters);
  - `ledgerCells.spec.ts` (reached, current and ahead, and the `not yet reached` names);
  - `bandsAtStep.spec.ts` (step k's words are current, earlier ones settled, later ones absent).
- [X] T045 [P] [US3] Write failing unit tests in `tests/unit/lib/room/scoreboard.spec.ts` for `deriveScoreboard({ review })`:
  - the clock row phase is `review`, with step, clock and fraction;
  - the player rows show totals and moves at step k, with the sub-line `1204 · 3 of 10 at step 7`;
  - no pace, tint or series.
- [X] T046 [P] [US3] Write failing component tests in `tests/unit/components/room/ReviewScrubber.spec.tsx`:
  - `role="slider"` with `aria-valuemin`, `max`, `now` and `valuetext`;
  - ←/→ step, Home/End jump, Space toggles play;
  - keys do nothing unless the scrubber has focus;
  - a pointer at x selects `stepAtFraction`.
- [X] T047 [P] [US3] Write failing component tests in `tests/unit/components/room/ReviewControls.spec.tsx`:
  - five buttons with words (`first · back · play ▸ · next · last`, IS `fyrst · aftur · spila ▸ · næst · síðast`);
  - `play ▸` becomes `pause`;
  - first and back are disabled at step 1, next and last at the end.
- [X] T048 [P] [US3] Write failing component tests in `tests/unit/components/room/Ledger.review.spec.tsx`:
  - the caption `review · 4:52`;
  - the rows form a `grid` with a roving tabindex (arrows move, Enter jumps);
  - cell states and names;
  - the cursor line replaces the live row.
- [X] T049 [P] [US3] Write failing hook tests in `tests/unit/components/room/hooks/useReview.spec.tsx` and `useReviewAutoplay.spec.tsx`, under fake timers with fetch mocked:
  - `/moves` is loaded once;
  - the step clamps;
  - autoplay advances once a second, stops at the end, and stops on any input or `visibilitychange` to hidden;
  - a forward step by one sets `exchange` and a reveal key;
  - a backward step or a jump sets none;
  - under reduced motion no animation runs.

### Implementation

- [X] T050 [P] [US3] Implement `lib/review/reviewParam.ts`, `scrubber.ts`, `cursorLines.ts`, `ledgerCells.ts` and `bandsAtStep.ts`, plus the copy (EN and IS: `step 7 of 20`, `review`, `the clock at step 7`, `at step 7`, `refused · frozen`, `time · −N not played`, `ended early · −N not played`, `froze N`, `leads`, `level`, `not yet reached`, `first`, `back`, `play ▸`, `pause`, `next`, `last`, and the phone `klukkan þá`). T044 passes.
- [X] T051 [US3] Add the `review` input to `lib/room/scoreboard.ts`. T045 passes.
- [X] T052 [P] [US3] Implement `components/room/ReviewScrubber.tsx`, and render it from `components/room/Scoreboard.tsx` when the clock phase is `review` (both desktop and compact). Style it in `app/styles/room.css` with the scoreboard's tokens only: a 10px bar desktop, 4px phone, and a 44px hit area. T046 passes.
- [X] T053 [P] [US3] Implement `components/room/ReviewControls.tsx` with a desktop variant that has words. T047 passes.
- [X] T054 [US3] Add review mode to `components/room/Ledger.tsx`:
  - `ReviewCell` buttons in a `role="grid"` using `lib/a11y/rovingFocus.ts`;
  - cell states from `ledgerCellStates`;
  - the cursor line in the live row's slot;
  - `ReviewControls` in the head's second row, the state line;
  - the caption `review · m:ss`.

  T048 passes.
- [X] T055 [US3] Implement `components/room/hooks/useReview.ts` (load `/moves`, build the steps, hold the step, expose `go(n)`, `next`, `back`, `first` and `last`) and `useReviewAutoplay.ts`. Reuse `useReveal` and `planReveal` for a forward step by one: key = step index, band ids = the step's words, `exchange` = the step's swap. T049 passes.
- [X] T056 [US3] Wire review into `components/room/MatchRoomController.tsx` and `MatchRoomView.tsx`. When the match is completed and `review` is present:
  - the Field gets the step's board, frozen map, `bandsFromWords(bandsAtStep…)` with step k as `liveMoveKey`, ticks from the step's swap, and `exchange`;
  - the scoreboard gets the review input;
  - the ledger enters review mode;
  - the slip stays lifted.
- [X] T057 [US3] Review foot in `components/room/LedgerFoot.tsx`: `◂ result` on the left. On the right, one primary by availability from `RematchOffer`: `rematch ▸` while offered, else `challenge again ▸` if the opponent is here, else `new opponent ▸`. `⋯` holds `lobby`. Extend its spec.
- [X] T058 [US3] Build a static review fixture `app/[locale]/dev/room/reviewFixture.ts` (IS-M, 20 steps; an EN version from the English pack). Fill the `review`, `review-refused` and `review-time` phases, and take baselines at 1280×800, 1440×900 and 390×844.

**Checkpoint**: review renders and steps from the fixtures and from a real completed match.

---

## Phase 6: User Story 4 – Review lives at a URL on the same page (P1)

**Goal**: `?review=n` on the match page. Entering pushes one entry and steps replace it. Back runs review → result → lobby. Old links land on review.

**Independent test**: `tests/integration/ui/review-flow.spec.ts`.

### Tests first

- [X] T059 [P] [US4] Write failing hook tests in `tests/unit/components/room/hooks/useReviewHistory.spec.tsx`:
  - `enter(n)` pushes `{kind:"review"}` with `?review=n`;
  - `step(n)` replaces;
  - `leave()` calls `history.back()` from a review entry and `replaceState` to the plain URL otherwise;
  - a popstate without `review` restores the slip;
  - a non-canonical param is replaced by the canonical one;
  - on a match that is not completed the param is removed.
- [X] T060 [P] [US4] Write failing tests for the page redirects in `tests/unit/app/matchPage.redirects.spec.ts`:
  - `/summary` goes to `?review=last` in the match's locale;
  - the locale redirect keeps the query;
  - the door redirect's `next` keeps the query.

### Implementation

- [X] T061 [US4] Implement `components/room/hooks/useReviewHistory.ts` with the native History API, which Next 16 syncs with `useSearchParams` (verified with Context7). Use it in `MatchRoomController.tsx`: `review the match ▸` enters at the last step, `◂ result` leaves, and Esc in review does nothing special. T059 passes.
- [X] T062 [US4] Change `app/[locale]/match/[matchId]/summary/page.tsx` to redirect to `?review=last`. Make every redirect in `app/[locale]/(room)/match/[matchId]/page.tsx` keep the search params. T060 passes.
- [X] T063 [US4] Write `tests/integration/ui/review-flow.spec.ts` (chromium):
  - result → `review the match ▸` gives `?review=20`, with the slip gone;
  - End and Home work;
  - step five times, then Back once reaches the result with the slip, and Back again reaches the lobby;
  - `/summary` lands on the last step;
  - `?review=abc` is corrected;
  - the lobby's `review ▸` link and the band map land on the last step.

**Checkpoint**: US3 and US4 together make review complete for participants.

---

## Phase 7: User Story 5 – Review for anyone who has the link (P2)

**Goal**: A completed match's review is readable read-only, without a session.

**Independent test**: open a completed match's review signed out.

- [X] T064 [P] [US5] Write failing tests:
  - in `tests/unit/app/matchPage.access.spec.ts`: signed out plus completed and not void renders read-only; signed out plus live goes to the door with `next`; void goes to `/`;
  - in `tests/unit/components/room/MatchRoomController.readOnly.spec.tsx`: a read-only view never calls `/state`, never beats, raises no slip, enters review at `last` with no param, shows the line `this match is over · Birna – Kári`, and its foot's primary is `enter the lobby ▸` when signed out and none when signed in.
- [X] T065 [US5] Change `app/[locale]/(room)/match/[matchId]/page.tsx` so a signed-out visitor can read a completed, non-void match. Change `MatchRoomController.tsx` so read-only skips the transport poll, the beat and the slip, and defaults to review. The first player takes the near seat. Add the copy for the line and `enter the lobby ▸`. T064 passes.
- [X] T066 [US5] Fill the `review-public` fixture and its baseline. Add the signed-out case to `review-flow.spec.ts`.

---

## Phase 8: User Story 6 – When rematch is not offered (P2)

**Goal**: A late result, a closed window, a decline or a missing opponent offers `new opponent ▸` and, when possible, `challenge again ▸` with its cooldown.

**Independent test**: the `rematch-cooldown` fixture, plus the loader offer tests.

- [X] T067 [P] [US6] Write failing tests in `tests/unit/components/room/Slip.matchOver.spec.tsx` for the `closed` view:
  - `new opponent ▸` is primary;
  - `challenge again ▸` appears only when the opponent is here, and is disabled with `again in 0:52` during the cooldown;
  - `Kári has left` shows on the scoreboard sub-line (`lib/room/scoreboard.ts` test);
  - when the window closes while the slip is up, the primary is re-guarded.
- [X] T068 [US6] Implement `challenge again ▸`: it calls the existing `sendChallengeAction` (the same language and the 60s rules) from `Slip.tsx` and the review foot, and its state shows in the line slot. Add the opponent's `has left` sub-line to `lib/room/scoreboard.ts` from `rematch.opponentOnMatch`. T067 passes.
- [X] T069 [US6] Fill the `rematch-cooldown` fixture and its baseline. Add the "past 2:00" and "opponent went to the lobby" cases to `rematch-flow.spec.ts`.

---

## Phase 9: User Story 8 – The phone result and review (P2)

**Goal**: The phone slip is the field's square. The phone review puts the scrubber in the clock row and five glyph controls in the pinned foot.

**Independent test**: the `phone-result` and `phone-review` viewport tests at 390×844, 390×664 and 360.

- [X] T070 [P] [US8] Write failing tests:
  - `tests/unit/components/room/Slip.matchOver.spec.tsx` (compact): two detail clauses, and the negotiation replaces action row 2;
  - `tests/unit/components/room/ReviewControls.spec.tsx` (compact): five 44×44 glyph buttons with the `aria-label`s `fyrst`, `aftur`, `spila`, `næst`, `síðast`;
  - `tests/unit/components/room/Ledger.phone.spec.tsx`: in review, the rows open in the sheet with `saga ▸`, the cursor line takes the live row, and the foot is pinned with `◂ úrslit` and the controls; in the final state, `úrslit ▸` sits in the foot when the slip is lifted.
- [X] T071 [US8] Implement the compact variants in `Slip.tsx`, `ReviewControls.tsx`, `Ledger.tsx`, `LedgerFoot.tsx` and `LedgerSheet.tsx`, with styles in `app/styles/room.css`. Move `úrslit ▸` out of the sheet into the pinned foot (the map found it only inside the sheet today). T070 passes.
- [ ] T072 [US8] Add the viewport tests `phone-result` and `phone-review` (over `result-moves` and `review`) at 390×844, 390×664 and 360 in `tests/integration/ui/room-fixtures.spec.ts`, and take baselines.

---

## Phase 10: User Story 7 – Other calls while on the result (P3)

- [X] T073 [P] [US7] Write failing tests in `tests/unit/lib/room/ledgerCallLine.spec.ts`: with a rematch and a third-party call, the rematch comes first and the call second. Integration test in `tests/integration/db/rematch.test.ts`: accepting either answers the other (the call is `superseded` through `create_match_between`, and the rematch request is `superseded`).
- [X] T074 [US7] Render both lines in `components/room/Ledger.tsx`, with the call's `accept ▸` as a secondary. T073 passes.

---

## Phase 11: User Story 9 – The rules document describes review (P3)

- [ ] T075 [US9] Amend `docs/prd_and_requirements/wottle_game_rules.md` §12:
  - *Match over*: headline focus, two action rows, the detail by reason, the 500ms guard, the rematch window and single request; reactions are phase 2;
  - add *Review*: steps in receipt order, refused steps, the closing step, scrubber and keys, public for completed matches; best here is phase 2;
  - §2a: `ended_early`.

  Run `pnpm docs:check`.

---

## Phase 12: Polish and cross-cutting

- [ ] T076 [P] Extend `tests/integration/ui/slot-overflow.spec.ts` with the longest IS and EN strings for:
  - the detail line;
  - the negotiation line;
  - the cursor lines;
  - the scrubber label;
  - the review controls.

  Check them at 1440 and 390.
- [ ] T077 [P] Run `tests/unit/lib/i18n/copyParity.spec.ts` and `tests/unit/i18n/name-safe-grep.test.ts` over the new keys, and fix any gaps. List every new IS string marked `// native-read` in CLAUDE.md's remaining gaps.
- [ ] T078 [P] Run an axe check on the result and review pages at 1440×900 and 390×844 in both languages (SC-009), in `tests/integration/ui/review-flow.spec.ts`.
- [ ] T079 [P] Update `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md`: the review scrubber in the clock row, review cells, and the result slip's focus and guard.
- [ ] T080 Update the spec-071 paragraph and the fixture phase list in `CLAUDE.md`, and fix the Recent Changes. Run `pnpm docs:check`.
- [ ] T081 Gates (with `pnpm perf:review-moves` and `pnpm perf:rematch`): `pnpm test:unit`, `pnpm lint`, `pnpm typecheck`, `pnpm test:visual` (production build), the `tests/integration/db` suites against local Supabase, and the rematch-flow and review-flow Playwright specs.
- [ ] T082 Walk `specs/071-result-rematch-review/quickstart.md` by hand (for the user).
- [ ] T083 [P] Add `perf:review-moves` (`tests/perf/review-moves.bench.ts`): `GET /moves` plus `buildReviewSteps` on a 20-move match against local Supabase; assert under 150ms p95 for the route and under 5ms for the build. Add the script to `package.json`.
- [ ] T084 [P] Add `perf:rematch` (`tests/perf/rematch.bench.ts`): `request_rematch` plus `accept_rematch`, under 200ms p95.

---

## Dependencies and order

- **Setup (T001–T002)**, then **Foundational (T003–T011)**, which blocks everything.
- **US1 (T012–T024)** comes next. US2's slip rows and US3's `review the match ▸` both build on its slip.
- **US2 (T025–T043)** and **US3 (T044–T058)** can run in parallel after US1. They touch different files except `Slip.tsx` (US2) and `MatchRoomController.tsx` (both), so sequence the controller tasks T039 and T056.
- **US4 (T059–T063)** needs US3.
- **US5 (T064–T066)** needs US3 and US4.
- **US6 (T067–T069)** needs US2.
- **US8 (T070–T072)** needs US1, US2 and US3.
- **US7 (T073–T074)** needs US2.
- **US9 (T075)** can run any time after US3.
- **Polish (T076–T082)** comes last.

## Parallel examples

- **Foundational:** T004, T005 and T006 together, then T008 and T010 together after T007.
- **US1:** T012, T013, T014, T015 and T016 together, then T017, T018 and T019 together.
- **US2:** T025–T031 together (different files). T037 runs beside T032–T036.
- **US3:** T044–T049 together, then T050, T052 and T053 together.

## Implementation strategy

1. **MVP:** Setup, Foundational and US1. The result is correct and says why. Ship-safe on its own.
2. **Increment 2:** US2 (rematch, with its database enforcement and race test).
3. **Increment 3:** US3 and US4 (review for participants), then US5 (public review).
4. **Increment 4:** US6, US8 and US7, then US9 and polish.

Commit each passing test separately (`test(071): …`, then `feat(071): …`), per CLAUDE.md.

## Notes from implementation

- **The series is on the scoreboard's clock row** (T040), under the label when no pace is shown (`match 2 · Birna 1–0`). The final rating lines leave no room on the player rows, and the design system puts facts about the match on the clock row. GAME_FLOW_SPEC §7.8 said "both bars", but the bars are gone since spec 068.
- **The rematch actions take the match id**, not the request id: there is one request per match, so the server finds it (`pendingRequestOf`).
- **T030** extends `tests/unit/lib/one-service-per-rpc.test.ts` rather than adding a grep test. `accept_rematch` stays with the creation functions in `lib/match/createMatch.ts`.
- **Busy accepts** end the request as `superseded` (spec 067 left it pending); `tests/integration/db/accept-rematch.test.ts` was updated.
- **The live guard steps back past every guard entry** at completion, the table's included (each entry records its depth), so one Back from the result reaches the lobby.
- **Review's step motion** (T055): stepping forward by one exchanges the step's letters through the Field's `exchange`; its bands appear at once rather than drawing over 400ms. A back step or a jump is instant, as specified. The band draw on a forward step is a follow-up.
- **The App Router and native history:** a state object that carries the router's own `__NA` marker is taken as the router's call and not synced into `useSearchParams`. Review's entries carry only `{ kind }` (`useReviewHistory`).
- **A reader** of a finished match (not a participant, signed in or out) gets `?review=last`, no slip, and a transport in `reader` mode that subscribes to and polls nothing. A signed-out reader's words come from the steps, since `/words` needs a session.
- **The closing step** takes the ledger's first row with an unplayed move for its cursor line.
- **T069's cooldown fixture** is `rematch-declined` (it shows `again in 0:52`). The "past 2:00" and "opponent left" cases are pinned in `tests/integration/db/rematch.test.ts` rather than in Playwright, since a 2:00 wait does not belong in the e2e suite.
- **Two answers on the result** (a rematch and a call) share the ledger's state row, one line each, the rematch first. Accepting either supersedes the other through `create_match_between`.

