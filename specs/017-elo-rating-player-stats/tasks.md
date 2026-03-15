# Tasks: Elo Rating & Player Stats

**Input**: Design documents from `/specs/017-elo-rating-player-stats/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per constitution principle VII (TDD is NON-NEGOTIABLE). Tests are written first and must fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and shared TypeScript types that all stories depend on

- [x] T001 Create migration file supabase/migrations/20260315001_elo_rating.sql — ALTER players: set elo_rating NOT NULL DEFAULT 1200 (backfill NULLs), add games_played/wins/losses/draws integer NOT NULL DEFAULT 0, add CHECK constraints (elo_rating >= 100, games_played = wins + losses + draws). CREATE TABLE match_ratings with columns per data-model.md, UNIQUE(match_id, player_id), indexes on (player_id, created_at DESC) and (match_id), RLS policies (SELECT for authenticated, INSERT/UPDATE/DELETE for service role only)
- [x] T002 Add rating-related TypeScript types to lib/types/match.ts — EloCalculationInput, EloCalculationResult, MatchRatingResult, PlayerStats, PlayerProfile, RatingChange interfaces per data-model.md
- [x] T003 Verify migration applies cleanly: run pnpm supabase:reset && pnpm supabase:verify and confirm schema matches data-model.md

**Checkpoint**: Schema and types ready — all user story work can begin

---

## Phase 2: User Story 1 — Rating Updates After Match Completion (Priority: P1) 🎯 MVP

**Goal**: After a match ends, calculate Elo rating changes for both players and persist them atomically. This is the foundational calculation that all other stories depend on.

**Independent Test**: Complete a match between two players with known ratings → verify both players' ratings updated correctly in the database.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] [US1] Unit test for determineKFactor in tests/unit/lib/rating/calculateElo.spec.ts — returns 32 for gamesPlayed < 20, returns 16 for gamesPlayed >= 20, boundary case at exactly 20
- [x] T005 [P] [US1] Unit test for calculateElo in tests/unit/lib/rating/calculateElo.spec.ts — equal ratings (1200 vs 1200, win → +16 with K=32), higher beats lower (1400 vs 1100, expected small gain), lower beats higher (1100 vs 1400, expected large gain), draw between equal ratings (both adjust by 0), draw between unequal ratings (converge), rating floor enforcement (result never below 100), rounding to nearest integer
- [ ] T006 [P] [US1] Integration test for persistRatingChanges in tests/integration/rating/persistRatingChanges.spec.ts — inserts 2 match_ratings rows, updates both players' elo_rating/games_played/wins/losses/draws atomically, verify CHECK constraints (games_played = wins + losses + draws), verify UNIQUE(match_id, player_id) rejects duplicate
- [ ] T007 [P] [US1] Integration test for Elo calculation in completeMatchInternal in tests/integration/rating/completeMatchRating.spec.ts — complete a match → verify match_ratings rows created with correct before/after/delta, verify players table updated, verify draw handling, verify resignation treated as loss

### Implementation for User Story 1

- [x] T008 [P] [US1] Implement determineKFactor(gamesPlayed: number): number in lib/rating/calculateElo.ts — returns 32 if gamesPlayed < 20, else 16
- [x] T009 [US1] Implement calculateElo(input: EloCalculationInput): EloCalculationResult in lib/rating/calculateElo.ts — standard Elo formula E = 1/(1+10^((opp-player)/400)), new rating = old + K*(actual - expected), floor at 100, round to integer
- [x] T010 [US1] Implement persistRatingChanges(matchId, playerA: MatchRatingResult, playerB: MatchRatingResult) in lib/rating/persistRatingChanges.ts — atomic transaction: INSERT 2 rows into match_ratings + UPDATE both players' elo_rating, games_played, wins/losses/draws using service-role client
- [x] T011 [US1] Integrate Elo calculation into completeMatchInternal() in app/actions/match/completeMatch.ts — after determineMatchWinner(): fetch both players' current elo_rating and games_played, call calculateElo for each player, call persistRatingChanges, include RatingChange in return value. Handle errors gracefully (log, don't block match completion)

**Checkpoint**: Elo ratings calculate and persist on match completion. Verify with: complete a match → check players table for updated elo_rating, games_played, wins/losses/draws → check match_ratings for snapshot rows

---

## Phase 3: User Story 2 — Ratings Displayed in Lobby (Priority: P1)

**Goal**: Show each player's Elo rating in the lobby list, plus the Elo difference relative to the viewing player.

**Independent Test**: Log in → lobby shows "1200" next to each username → verify Elo difference badge.

### Tests for User Story 2

- [x] T012 [P] [US2] Unit test for LobbyCard Elo display in tests/unit/components/lobby/LobbyCard.spec.ts — renders elo_rating next to username, renders "1200" for null/undefined eloRating, renders Elo difference when viewerRating prop provided ("+170" green for higher, "-170" red for lower, "±0" neutral for equal)

### Implementation for User Story 2

- [x] T013 [US2] Modify LobbyCard in components/lobby/LobbyCard.tsx — render player.eloRating (or 1200 fallback) as a badge/label next to username. Accept optional viewerRating prop; when present, show signed Elo difference with color coding (green for positive, red for negative, neutral for zero)
- [x] T014 [US2] Modify LobbyList in components/lobby/LobbyList.tsx — pass current player's eloRating as viewerRating prop to each LobbyCard so difference is displayed

**Checkpoint**: Lobby displays ratings and Elo differences. No presence channel changes needed (eloRating already in PlayerIdentity and fetched by fetchLobbySnapshot).

---

## Phase 4: User Story 4 — Rating Change on Final Summary (Priority: P2)

**Goal**: Show both players' rating changes (+/-) on the FinalSummary screen after match completion, with green/red color coding.

**Independent Test**: Complete a match → FinalSummary shows "+16" in green for winner, "-16" in red for loser.

**Note**: US4 is placed before US3 because it's simpler (extends existing FinalSummary) and the profile modal (US3) can link to names on FinalSummary, benefiting from this being done first.

### Tests for User Story 4

- [x] T015 [P] [US4] Unit test for getMatchRatings Server Action in tests/unit/actions/match/getMatchRatings.spec.ts — returns both players' rating records for a completed match, returns not_found for match without ratings
- [x] T016 [P] [US4] Unit test for FinalSummary rating display in tests/unit/components/match/FinalSummary.spec.ts — renders rating delta with "+" prefix and green color for positive, "-" prefix and red color for negative, renders "Rating update pending" when ratingChanges is undefined

### Implementation for User Story 4

- [x] T017 [US4] Create getMatchRatings Server Action in app/actions/match/getMatchRatings.ts — "use server", validate session, Zod validate matchId as UUID, query match_ratings WHERE match_id, return MatchRatingResult[] (2 rows) with explicit return type
- [x] T018 [US4] Extend PlayerSummary type in lib/types/match.ts — add optional ratingBefore, ratingAfter, ratingDelta fields
- [x] T019 [US4] Modify FinalSummary in components/match/FinalSummary.tsx — add rating change display for each player near the score section. Show ratingDelta with sign prefix (+/-), green text for gains, red for losses. Show "Rating update pending" if rating data is not yet available
- [x] T020 [US4] Wire rating data into FinalSummary — in the server component that loads FinalSummary props (match summary page), call getMatchRatings(matchId) and merge ratingBefore/ratingAfter/ratingDelta into each PlayerSummary

**Checkpoint**: FinalSummary shows rating changes after every completed match.

---

## Phase 5: User Story 3 — Player Profile View (Priority: P2)

**Goal**: A modal accessible by clicking a username (in lobby or FinalSummary) showing career stats, current rating, and 5-game rating trend.

**Independent Test**: Click a username in the lobby → modal shows rating, games played, wins, losses, draws, win rate, and trend direction for last 5 games.

### Tests for User Story 3

- [x] T021 [P] [US3] Unit test for getPlayerProfile Server Action in tests/unit/actions/player/getPlayerProfile.spec.ts — returns correct PlayerProfile shape, computes winRate as wins/(wins+losses) or null when no decisive games, returns up to 5 trend values ordered oldest-first, returns empty trend for new player
- [x] T022 [P] [US3] Unit test for PlayerProfileModal in tests/unit/components/player/PlayerProfileModal.spec.ts — renders all stats (rating, games, wins, losses, draws, win rate), renders "—" for win rate when no decisive games, renders trend indicators (up arrow for ascending, down for descending), renders correctly with 0 games (empty state), renders correctly with fewer than 5 trend points

### Implementation for User Story 3

- [x] T023 [US3] Create getPlayerProfile Server Action in app/actions/player/getPlayerProfile.ts — "use server", validate session, Zod validate playerId as UUID, fetch player row (elo_rating, games_played, wins, losses, draws) + last 5 match_ratings rows (rating_after, ordered by created_at DESC then reversed for oldest-first), compute winRate, assemble and return PlayerProfile
- [x] T024 [US3] Create PlayerProfileModal component in components/player/PlayerProfileModal.tsx — modal dialog showing: player username + avatar, current Elo rating (large), stats grid (games/wins/losses/draws/win rate), 5-game rating trend with direction indicator (↑/↓/→). Responsive layout (full-width on mobile). Close button + click-outside-to-dismiss. Accept playerId prop, fetch via getPlayerProfile on mount
- [x] T025 [US3] Make usernames clickable in LobbyCard — in components/lobby/LobbyCard.tsx, wrap username in a button that opens PlayerProfileModal with the player's ID. Manage modal open/close state locally
- [x] T026 [US3] Make usernames clickable in FinalSummary — in components/match/FinalSummary.tsx, wrap player names in buttons that open PlayerProfileModal. Manage modal open/close state locally

**Checkpoint**: Player profiles accessible from both lobby and FinalSummary. Verify: click username → modal shows correct stats and trend.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling, and validation across all stories

- [ ] T027 [P] Integration test for edge cases in tests/integration/rating/eloEdgeCases.spec.ts — rating floor at 100 (player with low rating loses → doesn't go below 100), draw increments draws count (not wins or losses), resignation treated as loss for resigning player, games_played consistency CHECK constraint prevents invalid state
- [x] T028 [P] Add structured logging for rating operations in lib/rating/persistRatingChanges.ts — log matchId, both players' before/after/delta, K-factors using existing observability patterns (structured JSON)
- [x] T029 Verify existing tests still pass — run pnpm test && pnpm typecheck && pnpm lint to confirm no regressions
- [ ] T030 Run quickstart.md validation — follow quickstart.md steps on a clean Supabase reset, verify full flow: lobby shows ratings → complete match → FinalSummary shows deltas → profile modal works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Phase 1 (schema + types)
- **US2 (Phase 3)**: Depends on Phase 1 only (lobby display doesn't need Elo calc logic, just the column)
- **US4 (Phase 4)**: Depends on Phase 2 (needs match_ratings data from Elo calculation)
- **US3 (Phase 5)**: Depends on Phase 2 (needs match_ratings for trend) and Phase 4 (FinalSummary username links)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Foundation — no user story dependencies
- **US2 (P1)**: Independent of US1 (reads existing elo_rating column; works with default 1200 even before any match completes)
- **US4 (P2)**: Depends on US1 (needs rating calculation to populate match_ratings)
- **US3 (P2)**: Depends on US1 (needs match_ratings for trend), soft dependency on US4 (FinalSummary username links)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD Red)
- Implementation makes tests pass (TDD Green)
- Refactor while keeping tests green

### Parallel Opportunities

- T004, T005, T006, T007 can all run in parallel (different test files)
- T008 can run in parallel with T010 (different implementation files)
- T012 can run in parallel with US1 implementation (different domain)
- T015, T016 can run in parallel (different test files)
- T021, T022 can run in parallel (different test files)
- T027, T028 can run in parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests in parallel (all different files):
Task: T004 "Unit test for determineKFactor in tests/unit/lib/rating/calculateElo.spec.ts"
Task: T005 "Unit test for calculateElo in tests/unit/lib/rating/calculateElo.spec.ts"
Task: T006 "Integration test for persistRatingChanges in tests/integration/rating/persistRatingChanges.spec.ts"
Task: T007 "Integration test for completeMatchInternal rating in tests/integration/rating/completeMatchRating.spec.ts"

# Launch parallel implementations (different files):
Task: T008 "Implement determineKFactor in lib/rating/calculateElo.ts"
Task: T010 "Implement persistRatingChanges in lib/rating/persistRatingChanges.ts"
# Then sequential:
Task: T009 "Implement calculateElo in lib/rating/calculateElo.ts (same file as T008)"
Task: T011 "Integrate into completeMatchInternal (depends on T009, T010)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration + types)
2. Complete Phase 2: User Story 1 (Elo calculation + persistence)
3. **STOP and VALIDATE**: Run integration tests, manually complete a match, verify DB updates
4. At this point, ratings are being tracked — just not displayed yet

### Incremental Delivery

1. Setup + US1 → Ratings calculate on match completion (MVP!)
2. Add US2 → Ratings visible in lobby
3. Add US4 → Rating deltas on FinalSummary
4. Add US3 → Full player profiles with trend
5. Polish → Edge cases, logging, validation

### Single Developer Strategy

1. Phase 1 → Phase 2 (US1) → Phase 3 (US2) → Phase 4 (US4) → Phase 5 (US3) → Phase 6 (Polish)
2. Each phase is a logical commit boundary
3. Stop at any checkpoint to validate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution mandates TDD: every implementation task has a preceding test task
- LobbyCard already receives player.eloRating via PlayerIdentity — US2 is purely a render addition
- fetchLobbySnapshot() already SELECTs elo_rating — no presence channel changes needed
- US2 can start before US1 completes (lobby shows default 1200 for all players until matches happen)
