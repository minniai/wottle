# Tasks: Languages by URL — Orðusta and wottle

**Input**: `/specs/060-locales/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)
**Tests**: Required. The constitution makes TDD non-negotiable, so every implementation task follows a failing test in the same phase.
**Organization**:
- Phase 2 is the routing work (plan P1), which blocks everything else.
- Stories then follow priority order. US1 is plan P2, US2 and US3 are plan P3, US4 is plan P4, and US5 is part of P2's surface.

Format: `- [ ] T### [P?] [US?] description — path`

## Implementation notes (2026-09-22)

- T001 baseline: typecheck, lint, 1526 unit tests and 109 visual tests green. Port 3000 on this machine served another checkout (`~/codex/wottle`), so every local Playwright run here uses `APP_PORT=3100`.
- T011/T015: `useLocale` outside a provider reads English instead of throwing, so the existing component tests needed no wrapper; `renderWithLocale` was not added.
- T022: no re-export shim — every caller moved to `useCopy()` / a `copy` argument in one step and `lib/constants/copy.ts` is deleted.
- T027: moves, challenges, rematch and resign map to codes on the client (the server already returned a `reason` or a status); only the login action gained a `code`. Preview errors are never shown, so they have no code.
- Chromium E2E before/after: the base commit fails 9 specs locally (lobby-presence, match-completion, profile-room ×2, reconnect-flow, room-flow, room-layout ×2, rules-page); the branch fails the same set, none new. The login rate limit (5/min, not disabled locally) causes the sign-in timeouts.
- Linux baselines for the new `is-*` set come from the CI visual job's artifacts, as for every baseline.
- T039: `selectOptimalCombination` takes `letterValues` as an optional last argument (Icelandic default, like every scorer); covered end to end by `moveResolver.english.spec.ts` and `tests/integration/db/matchLanguage.test.ts` rather than its own unit test.
- T044: `toLocaleUpperCase("is")` is left as it is — for every letter of both alphabets it equals the English result (research R11); a future language with different casing takes `pack.upperLocale`.
- T054/T047: the lobby is split by language end to end — presence row, in-memory presence cache, `/api/lobby/players?language=`, the heartbeat body, the Realtime topic `lobby-presence:{language}`, and the sign-in form's hidden `language`. A challenge to someone present in another language's lobby is refused.
- T056: the wrong-locale redirect is pinned by `tests/integration/app/match-locale-redirect.test.ts` (both directions) instead of a Playwright step.
- English copy now says English where the game is English: the tagline (`two players · one field · English words`) and the rules page, whose figures are WORD / GAME / MEN on an English board (`rulesFiguresFor`). English `landing-slip` and `rules` baselines refreshed.
- The visual tolerance (`maxDiffPixelRatio: 0.002`) lets a one-word change in small mono text pass against a stale baseline; refresh the affected phases on purpose after any copy change.
- US4: `lib/rating/playerRatings.ts` (`readRatings`, `readEloRatings`, `writeRatingResult`) is the only rating source; `players.elo_rating` and the record columns are no longer written or read. The viewer's own bar reads the page language's rating through `viewerInLanguage` (room layout, lobby page, queue page, sign-in), since the session cookie carries a stale, language-blind rating. Best words and recent matches on the profile and in the lobby are the page language's (`matches!inner(language)`). SC-006 was checked at migration time: 889 players, 889 Icelandic rows.
- US5: the link leads to the other language's lobby (`english ▸` / `íslenska ▸`, `lang` set on the link), from the lobby and from a finished match alike; a finished match keeps its language, so "the same page" would bounce back. A plain `<a>`: the switch is a full load, so `<html lang>`, the title and the room remount together.
- Baselines: after US5 the whole visual set was refreshed with `--update-snapshots=all`, which also caught phases whose earlier one-word changes had passed inside the tolerance (`review the match ▸`, the English tagline).
- Local E2E hygiene: `matchmaking.spec` ends with a player still searching, and a leftover `matchmaking` row is offered first to the next run's players (oldest first), so reruns can hang in the queue. Reset queued players between runs; run the dev server with `RATE_LIMIT_DISABLED_SCOPES=auth:login` to avoid the 5/min sign-in limit.

## Phase 1: Setup

- [X] T001 Confirm the baseline is green on the branch before any change: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:visual`, and record the results in `specs/060-locales/tasks.md` notes.
- [X] T002 [P] Create the directories `lib/i18n/`, `lib/i18n/copy/`, `components/i18n/`, `components/rules/content/` and `tests/unit/lib/i18n/`.

## Phase 2: Foundational — locale routing (plan P1; blocks all stories)

**Goal**:
- `/…` serves the is locale and `/en/…` serves the en locale, both still in English copy.
- `/is/…` redirects.
- Every internal link keeps the prefix.
- The en visual baselines pass at `/en`.

- [X] T003 [P] Write the failing tests for the registry in `tests/unit/lib/i18n/locales.spec.ts`:
  - `LOCALES`, `DEFAULT_LOCALE`, `isLocale`.
  - `localePath` for is and en, and that it throws when the path has no leading slash.
  - `switchLocalePath`.
  - `isLandingPath`, per `contracts/locale-routing.md`.
  - A stub third locale can be registered in the test (SC-007).
- [X] T004 [P] Write the failing tests for `decideLocaleRoute` in `tests/unit/lib/i18n/routing.spec.ts`, covering every row of the contract table, including query preservation and `/xx/lobby`.
- [X] T005 Implement the registry in `lib/i18n/locales.ts` (`Locale`, `LocaleConfig`, `LOCALES`, `DEFAULT_LOCALE`, `isLocale`, `localePath`, `switchLocalePath`, `isLandingPath`, `localeForLanguage`) until T003 passes.
- [X] T006 Implement the pure `decideLocaleRoute` in `lib/i18n/routing.ts` until T004 passes.
- [X] T007 Add `proxy.ts` at the repo root. It calls `decideLocaleRoute`, uses `NextResponse.rewrite` / `redirect(308)` / `next`, preserves the query, and uses matcher `['/((?!api|_next|.*\\..*).*)']`.
- [X] T008 Move the page tree with `git mv` so history is kept:
  - `app/(room)` → `app/[locale]/(room)`.
  - `app/rules` → `app/[locale]/rules`.
  - `app/profile` → `app/[locale]/profile`.
  - `app/match` → `app/[locale]/match`.
  - `app/dev` → `app/[locale]/dev`.
  - `app/layout.tsx` → `app/[locale]/layout.tsx`, and fix relative imports (`globals.css`, `styles/*`).
- [X] T009 In `app/[locale]/layout.tsx`:
  - Await `params.locale` and call `notFound()` unless `isLocale`.
  - Add `generateStaticParams` over `LOCALES` and `export const dynamicParams = false`.
  - Set `<html lang={htmlLang}>`.
  - Make `generateMetadata` set the title to the locale's wordmark and use a per-locale description, English for both until US1.
  - Add `app/[locale]/not-found.tsx`.
- [X] T010 [P] Write the failing tests for `LocaleProvider` in `tests/unit/components/i18n/LocaleProvider.spec.tsx`: `useLocale` and `useLocalePath` return the provided locale's config and prefixed paths, and throw outside a provider.
- [X] T011 Implement `components/i18n/LocaleProvider.tsx` (`LocaleProvider`, `useLocale`, `useLocalePath`), mount it in `app/[locale]/layout.tsx`, and add `tests/helpers/renderWithLocale.tsx`, which defaults to `en`.
- [X] T012 [P] Write the failing grep-guard test `tests/unit/styles/locale-links-grep.test.ts`. It fails on literal internal paths in `app/[locale]`, `components/` and `lib/room`: `href="/`, `` href={`/ ``, `push("/`, `replace("/`, `redirect("/`, and `replaceState` with a `"/` literal.
- [X] T013 Sweep the server redirects to `localePath(locale, …)` in `app/[locale]/(room)/lobby/page.tsx`, `matchmaking/page.tsx`, `match/[matchId]/page.tsx`, `app/[locale]/profile/page.tsx` and `app/[locale]/match/[matchId]/summary/page.tsx`.
- [X] T014 Sweep the client navigation to `useLocalePath()`:
  - `components/room/{Slip,LedgerFoot,RoomMenu,LobbyLedger}.tsx`.
  - `components/profile/ProfilePage.tsx`.
  - `components/room/MatchRoomController.tsx`, including `profileHref`.
  - `components/room/QueueRoomController.tsx`, including `history.replaceState` to the match.
  - `components/room/LobbyRoomController.tsx`, where `isLandingPath` replaces `pathname === "/"` and the existing replaceState keeps the prefix.
  - `app/[locale]/rules/page.tsx`.
  - T012 must pass.
- [X] T015 Wrap the component tests that render room, profile or rules components with `renderWithLocale` (en) wherever they throw without a provider, under `tests/unit/components/**`.
- [X] T016 Point the visual suite at `/en/dev/room` in `tests/integration/ui/room-fixtures.spec.ts` with the same snapshot names. `pnpm test:visual` must pass with no baseline change (SC-002).
- [X] T017 Prefix the Playwright navigation with `/en` in `tests/integration/ui/helpers/matchmaking.ts` (`loginViaSlip`, `goto`, `toHaveURL` patterns) and in the room specs that hardcode `/lobby` or `/match/`. Run `pnpm exec playwright test --project=chromium`.
- [X] T018 Run the checkpoint: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:visual`, then commit `feat(i18n): locale segment, proxy and prefixed links`.

## Phase 3: User Story 1 — Icelandic Orðusta at the plain address (P1) 🎯 MVP

**Goal**: Every player-facing string is Icelandic at `/…` and English at `/en/…`, the wordmark is `orðusta` or `wottle`, and the game is unchanged.
**Independent test**: Open `/`, then sign in, lobby, queue, match, final, profile and rules; no English string appears (SC-001).

- [X] T019 [P] [US1] Write the failing parity test in `tests/unit/lib/i18n/copyParity.spec.ts`:
  - Every key of `copyEn` is present in `copyIs` with the same `typeof`.
  - Every `copyIs` function called with sample args returns a non-empty string with no `undefined` or `NaN`.
  - No English stopword appears as a whole word: `the`, `your`, `move`, `waiting`, `wins`, `points`, `you`.
- [X] T020 [P] [US1] Write the failing tests in `tests/unit/lib/i18n/plural.spec.ts`: `plural("is", n, …)` gives one for 1, 21 and 101, and other for 0, 2, 11 and 111; en gives one only for 1.
- [X] T021 [US1] Create `lib/i18n/copy/en.ts`, which moves every export of `lib/constants/copy.ts` into `copyEn` with the same names and values. Also create `lib/i18n/copy/types.ts` (`Copy`, `ErrorCode`), `lib/i18n/plural.ts` and `lib/i18n/getCopy.ts`. `useCopy()` goes in `LocaleProvider`.
- [X] T022 [US1] Temporarily turn `lib/constants/copy.ts` into a re-export of `copyEn` fields so callers keep compiling. Move `tests/unit/lib/constants/copy.spec.ts` to `tests/unit/lib/i18n/copyEn.spec.ts`, unchanged in its assertions.
- [X] T023 [US1] Make the pure room functions take `copy: Copy` as an argument instead of importing it: `lib/room/{ledgerRows,liveLines,moveState,notices}.ts`. Update their unit tests to pass `copyEn`.
- [X] T024 [US1] Switch every component that imports `lib/constants/copy` to `useCopy()`:
  - `components/room/*`, including `hooks/useMatchOverSlip.ts`.
  - `components/rules/ScoringTable.tsx`.
  - `app/[locale]/dev/room/RoomFixture.tsx`.
  - Then delete `lib/constants/copy.ts` and update the scope of `tests/unit/styles/acceptance-grep.test.ts`, which should include `lib/i18n/copy/en.ts`.
- [X] T025 [US1] Move the hardcoded strings into `copyEn`:
  - `components/profile/ProfilePage.tsx`, where `Intl.DateTimeFormat` takes `htmlLang` and `wottle` becomes the wordmark.
  - `components/profile/ProfileRatingChart.tsx`.
  - `components/room/RoomMenu.tsx`.
  - `components/room/Ledger.tsx` (the challenge line, clock aria, territory and `aria-label`).
  - `MatchRoomController.tsx` (realtime lost).
  - `QueueRoomView.tsx` fallbacks.
  - `PlayerBar.tsx`, `LedgerSheet.tsx`, `NameInput.tsx`, `Field.tsx` and `LobbyLedger.tsx` aria-labels.
  - `lib/room/useRematchNegotiation.ts` errors.
  - The profile route error pages.
  - `components/rules/RulesFigure.tsx`.
- [X] T026 [US1] Write the failing tests for server message codes in `tests/unit/app/actions/errorCodes.spec.ts`: login, startQueue, sendInvite, requestRematch, respondToRematch and previewSwap each return a `code` from `ErrorCode` on their player-visible failures.
- [X] T027 [US1] Add `code` to the failure results of `app/actions/{auth/login,matchmaking/startQueue,matchmaking/sendInvite,match/requestRematch,match/respondToRematch,match/previewSwap,match/claimWin,match/resignMatch}.ts` and the matching `app/api/**/route.ts` JSON. Clients render `copy.errors[code]` in `lib/room/useMatchmaking.ts`, `useRematchNegotiation.ts`, `LobbyRoomController.tsx` and `NameInput`/slip sign-in.
- [X] T028 [US1] Write the Icelandic translation `lib/i18n/copy/is.ts` (`satisfies Copy`) following design-system copy rules: sentence case, no exclamation marks, one idea per line, lowercase `orðusta`. Use `plural("is", …)` for counts. T019 must pass.
- [X] T029 [P] [US1] Split the rules prose into `components/rules/content/en.tsx`, which takes today's text from `app/[locale]/rules/page.tsx`, and `components/rules/content/is.tsx`, the Icelandic rules. The page picks by locale and its metadata comes from copy.
- [X] T030 [US1] Make `app/[locale]/layout.tsx` `generateMetadata` return the Icelandic title and description for is, `orðusta · orðaeinvígi` or as per the copy.
- [X] T031 [US1] Update `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` §8 with an Icelandic column for the fixed strings, and run `pnpm docs:check`.
- [X] T032 [US1] Add an Icelandic visual set to `tests/integration/ui/room-fixtures.spec.ts`. It covers the unprefixed `/dev/room` at 3 viewports for landing-slip, lobby, idle, reveal, final, over-slip, profile and rules. Generate only those baselines with `pnpm test:visual --update-snapshots --grep "@is"` and review every PNG.
- [X] T033 [US1] Add the Playwright spec `tests/integration/ui/locale-is.spec.ts`:
  - `/` has `lang="is"`, the wordmark `orðusta` and an Icelandic sign-in slip.
  - `/is/lobby` redirects to `/lobby`.
  - A signed-in lobby shows no English copyEn value.
- [X] T034 [US1] Run the checkpoint: typecheck, lint, unit, visual and docs:check, then commit `feat(i18n): Icelandic Orðusta at the plain address`.

## Phase 4: User Story 2 — English wottle plays English (P2)

**Goal**: Matches from `/en` use the English dictionary, letter values and frequencies, and the queue and lobby are partitioned by language.
**Independent test**: Two `/en` players get an English board, `CAT` scores and `HESTUR` does not, and an is player and an en player are never paired.

- [X] T035 [P] [US2] Write the failing tests for the language pack in `tests/unit/lib/game-engine/languagePack.spec.ts`:
  - `is` returns today's weights and values unchanged.
  - `en` returns 26 letters, en values and upperLocale `en`.
  - `dk` throws `UnsupportedLanguageError`.
- [X] T036 [P] [US2] Write the failing curation test for the English dictionary in `tests/unit/lib/game-engine/dictionaryEn.spec.ts`: `word_list_en.txt` is lowercase a–z only, has at least 10k entries, and contains `cat` and `house`.
- [X] T037 [P] [US2] Write the failing resolver test `tests/unit/match/moveResolver.english.spec.ts`. `resolveOne` on an English board with the en dictionary and pack scores `CAT` with en values and does not score `HESTUR`. Existing Icelandic resolver tests stay unchanged.
- [X] T038 [US2] Implement `lib/game-engine/languagePack.ts` and add `ENGLISH_LETTER_WEIGHTS` in `lib/game-engine/boardGenerator.ts` (research R6). T035 must pass.
- [X] T039 [US2] Make `letterValues` a required parameter in `lib/game-engine/crossValidator.ts` and pass it from `wordEngine` and `moveResolver`. Keep the IS default only at the outermost test helpers (`tests/helpers/scoreMoves.ts`).
- [X] T040 [US2] Write migration `supabase/migrations/20260922001_match_language.sql` per data-model:
  - `matches`, `match_invitations` and `lobby_presence` each get `language`.
  - `players` gets `queue_language` plus an index.
  - `claim_next_move` is recreated, including `language` in its match object.
  - Run `pnpm supabase:migrate && pnpm supabase:verify`.
- [X] T041 [US2] Add `language` to the types and schemas: `MatchState`, `ClaimMatch`, `LobbyPresence` and `InvitationRecord` in `lib/types/{match,matchmaking}.ts`, `lib/match/schemas.ts` and the Zod schemas. `lib/types/board.ts` and `lib/match/previewSchemas.ts` validate letters against `ALL_LETTERS` from the packs.
- [X] T042 [US2] Thread the language through the resolver: `lib/match/moveResolver.ts` `resolveClaim` uses `loadDictionary(match.language)` and `pack.letterValues`, and adds `language` to the resolver logs. T037 must pass.
- [X] T043 [US2] Thread the language through preview and state:
  - `app/actions/match/previewSwap.ts` and `lib/match/previewScoring.ts` select `language` and use the pack and dictionary.
  - `lib/match/stateLoader.ts` generates the board with the pack weights, warms `match.language`, and puts `language` into `MatchState`.
- [X] T044 [US2] Thread the language on the client:
  - `lib/room/liveState.ts` `letterValue(letter, language)`, with `components/room/Field.tsx` passing the match language.
  - `lib/room/{wordIntegrity,bandGeometry}.ts` and `lib/match/matchIntegrity.ts` use `pack.upperLocale`.
- [X] T045 [US2] Write failing unit tests for the queue in `tests/unit/lib/matchmaking/inviteService.language.spec.ts`:
  - `startAutoQueue` sets `queue_language`.
  - The candidate and claim queries filter on it.
  - Leaving the queue clears it.
- [X] T046 [US2] Implement the queue by language:
  - `app/actions/matchmaking/startQueue.ts` takes `{ language }` via Zod.
  - `lib/matchmaking/inviteService.ts` `startAutoQueue` / `fetchQueueCandidates` / claim filter on it.
  - `bootstrapMatchRecord` in `lib/matchmaking/service.ts` takes `language`.
  - `app/actions/matchmaking/cancelQueue.ts` and the sweep clear it.
  - `lib/room/useMatchmaking.ts` passes `useLocale().language`.
- [X] T047 [US2] Implement lobby presence by language:
  - The login and `app/api/lobby/presence/route.ts` upserts store `language`.
  - `app/api/lobby/players/route.ts` and the presence snapshot filter by `?language=`.
  - `lib/realtime/presenceChannel.ts` uses channel `lobby-presence:${language}`.
  - `lib/matchmaking/presenceStore.ts` passes the locale language.
- [X] T048 [US2] Make the warm-up and queue placeholder boards use the locale pack weights in `components/room/LobbyRoomController.tsx` and `QueueRoomController.tsx`.
- [X] T049 [US2] Add integration test `tests/integration/db/queueLanguage.spec.ts` against local Supabase: an is queuer and an en queuer never claim each other, and two en queuers produce a match with `language='en'`.
- [X] T050 [US2] Add Playwright spec `tests/integration/ui/cross-language-queue.spec.ts` (`@two-player-playtest`): one player queues at `/lobby`, one at `/en/lobby`; after 15s neither has found an opponent.
- [X] T051 [US2] Verify that deploy tracing includes `data/wordlists/word_list_en.txt`: run `pnpm build`, then inspect `.next/server/**/*.nft.json`. Add `outputFileTracingIncludes` to `next.config.ts` if it is missing.
- [X] T052 [US2] Run the checkpoint: unit, integration, `pnpm perf:move-resolve` (<50ms p95), and the existing scoring regressions unchanged (SC-004, SC-005). Then commit `feat(game): the match's language picks its dictionary and board`.

## Phase 5: User Story 3 — a match always speaks its own language (P2)

**Goal**: Invites carry the language, rematches copy it, and a match URL in the wrong locale redirects.
**Independent test**: Open an English match at `/match/<id>` and land on `/en/match/<id>`.

- [X] T053 [P] [US3] Write failing tests:
  - `tests/unit/lib/matchmaking/invite.language.spec.ts`: an invite stores the sender's lobby language, a recipient in another language is rejected with `invite_failed`, and accepting it creates a match in the invite language.
  - `tests/unit/app/actions/rematch.language.spec.ts`: a rematch copies the original match's language.
- [X] T054 [US3] Implement invites and rematches:
  - `app/actions/matchmaking/sendInvite.ts` and `app/api/lobby/invite/route.ts` take the language.
  - In `lib/matchmaking/inviteService.ts`, send stores it and accept passes `invite.language`.
  - `app/actions/match/{requestRematch,respondToRematch}.ts` read `matches.language`.
  - `components/room/hooks/useLobbyInvites.ts` passes the locale language.
- [X] T055 [US3] Add the redirect to the match's locale in `app/[locale]/(room)/match/[matchId]/page.tsx`: when `match.language !== locale.language`, call `redirect(localePath(localeForLanguage(match.language), …))`. Write the unit test first in `tests/unit/app/matchPageLocale.spec.ts`.
- [X] T056 [US3] Extend `tests/integration/ui/locale-is.spec.ts` with a check that an en match opened unprefixed lands on `/en/match/…`. Then commit.

## Phase 6: User Story 4 — a rating for each language (P3)

**Goal**: Separate Elo per language, with existing ratings becoming Icelandic.
**Independent test**: Winning an en match moves only the en rating, and `/profile/x` and `/en/profile/x` differ.

- [X] T057 [P] [US4] Write failing unit tests `tests/unit/lib/rating/persistRatingChanges.language.spec.ts`:
  - It reads and upserts `player_ratings` for the match language.
  - A missing row is treated as 1200/0.
  - `match_ratings.language` is written.
- [X] T058 [US4] Write migration `supabase/migrations/20260922002_ratings_by_language.sql` per data-model: the `player_ratings` table, its RLS, the backfill, `match_ratings.language` with backfill, and an index.
- [X] T059 [US4] Implement `readRating` and a language-aware `persistRatingChanges` in `lib/rating/`, and pass the language from `app/actions/match/completeMatch.ts` and `settleMatch.ts`.
- [X] T060 [US4] Make the readers language-aware:
  - `app/actions/match/getMatchRatings.ts`.
  - `app/actions/player/{getPlayerProfile,getPlayerProfileByHandle,getTopPlayers,getBestWords}.ts` and `app/actions/matchmaking/getMatchOverview.ts`.
  - The presence rating join in `lib/matchmaking/{profile,service}.ts`.
  - The `stateLoader` rating lines.
  - `app/[locale]/profile/**` pages pass `locale.language`.
- [X] T061 [US4] Add integration test `tests/integration/db/ratingsByLanguage.spec.ts`:
  - Backfill equality for every player (SC-006).
  - Settling an en match changes only the en rows and inserts `match_ratings.language='en'`.
- [X] T062 [US4] Run the checkpoint and commit `feat(rating): a rating for each language`.

## Phase 7: User Story 5 — switch language from the room (P3)

**Goal**: One link in the lobby and final ledger foot, and none during a live match.
**Independent test**: At `/lobby`, following `english ▸` lands on `/en/lobby`, still signed in.

- [X] T063 [P] [US5] Write a failing component test `tests/unit/components/room/LedgerFoot.language.spec.tsx`:
  - Lobby and final render `copy.languageLink` with an `href` equal to `switchLocalePath`.
  - The live match renders no language link.
- [X] T064 [US5] Implement the link in `components/room/LedgerFoot.tsx` (lobby and final variants only). Add `languageLink` to both copies (`english ▸` / `íslenska ▸`) and re-baseline only the fixtures whose foot changed. Review the PNGs and commit.

## Phase 8: Polish and cross-cutting

- [ ] T065 [P] Update the docs:
  - `CLAUDE.md`: routing under `app/[locale]`, `lib/i18n`, language packs, the new columns and table, the fixture URL `/en/dev/room`, and Remaining Gaps (`players.elo_rating` and related columns are unread).
  - `docs/prd_and_requirements/wottle_game_rules.md` §12: the language is a property of the match.
  - PRD §1: languages.
  - Run `pnpm docs:check`.
- [ ] T066 [P] Check accessibility: extend the axe run (`@axe-core/playwright`) to `/` and `/en/lobby` so the `lang` attribute and translated aria labels are covered.
- [ ] T067 Run the full quickstart (`specs/060-locales/quickstart.md`) by hand with `pnpm dev`. Then run the two-player Playwright specs one at a time on firefox (`moves-flow`, `disconnect-claim`, `cross-language-queue`).
- [ ] T068 Open the PR for 060, stacked on #282 or rebased onto `main` after #282 merges. The description asks for a native Icelandic review of `lib/i18n/copy/is.ts` and `components/rules/content/is.tsx` before release.

## Dependencies

- Phase 2 blocks everything.
- US1 (Phase 3) depends only on Phase 2.
- US2 (Phase 4) depends on Phase 2. It is independent of US1, except that T046 and T047 read `useLocale()` from T011.
- US3 depends on US2's migration (T040) and `bootstrapMatchRecord` (T046).
- US4 depends on T040, because it backfills from `matches.language`.
- US5 depends on US1 (copy) and Phase 2 (`switchLocalePath`).
- Polish comes last.

## Parallel opportunities

- Phase 2: T003, T004, T010 and T012 are separate test files. T013 and T014 can split between server and client files.
- US1: T019, T020 and T029 can run in parallel with each other. T028 (the translation) can be drafted in parallel with T023–T027 once T021 fixes the keys.
- US2: T035, T036 and T037 can run in parallel with each other. T045 can run alongside T042–T044.
- After T040, US3 and US4 can proceed in parallel.

## Implementation strategy

1. **MVP** is Phase 2 plus US1. Orðusta in Icelandic at `/` and wottle in English at `/en`, with every match still Icelandic. This is shippable and reversible.
2. **Next** is US2 plus US3: English is really playable.
3. **Then** US4 splits ratings, and US5 is a convenience.
4. Each phase ends with a green checkpoint and its own commit. Baselines change only in T032 (new is set) and T064 (the foot link).
