# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wottle is a competitive 2-player real-time word duel built with Next.js, TypeScript, and Supabase. Players swap letters on a 10×10 field to form words — Icelandic at `/` (where the game is **Orðusta**), English at `/en` (**wottle**) — ten moves each whenever they like on one shared 5:00 clock, with spatial tile-freezing strategy.

**Current State**: The core gameplay loop (swap → find words → score → freeze) is fully functional and well-covered by tests. Twenty-two Speckit specs have shipped. **Field & Ledger shipped (2026-09-14, spec `specs/044-field-ledger-redesign/spec.md`)**: every player-facing screen is one room — two player bars, the field, one ledger — with lobby, queue, found, match, final and profile as states of it; the design system and plan are reached via `docs/design_documentation/README.md` (→ `docs/design_documentation/260914-wottle-new-design/`). The previous look (April–June 2026) and every component it used are gone from the tree; its documents live under `docs/archive/`. **Completion shipped (2026-09-15, spec `specs/045-field-ledger-completion/spec.md`)**: the twenty-five findings of the implementation review are closed — the field paints as designed, the room is one composition, the phone ledger collapses, drag and the hotkeys work, the palette is eight tokens and directory challenges are unranked. It also added the thing whose absence caused those defects: `/dev/room?phase=…` renders every room state from static fixtures with no database, and `pnpm test:visual` compares them against committed baselines in a blocking CI job. **As rendered (spec `specs/047-room-as-rendered/spec.md`, 2026-09-16)**: the first look at a live match after 045 found nine deviations; the ledger is now the height of the stack, the live row carries state and instruction on two lines and the hint collapses, every row owns one continuous rule, shared letters are ink throughout, and a settled band is drawn only over frozen letters. Its P0 was a data bug: the frozen-tiles compare-and-set function had no migration, so every freeze write was a blind overwrite; stuck-round recovery seeded the next round pre-scoring; and the client's word accumulator never reset on rematch or hydrated on reload. All three are fixed (`supabase/migrations/20260916001_…`, `lib/match/frozenTilePersistence.ts`, `lib/match/recoverStuckRound.ts`, `GET /api/match/[matchId]/words` + `lib/room/accumulatedWords.ts`). **Room clarity (spec `specs/048-room-clarity/spec.md`, 2026-09-20)**: the biggest moments were the quietest. It adds the **slip**, the one element ever laid over the field, for the four moments a player must notice or decide — sign in, resign, claim the win, match over — with the field faded to 32% beneath it; the **round state**, one of six beats (`round 4 · your move`, `played · waiting for Kári`, `resolving round 4`, `round 4 scored`, `out of time · …`) that writes the live row's first line in the board face, outlines the field in the viewer's seat colour while the move is theirs, and suffixes both bar sub-lines (`· your move` / `· thinking` / `· played ●`), closed by a 1.2s **settle hold**; the **round rail**, ten cells under the ledger caption; **no field before a name** (signed out the room is an empty ruled frame under the sign-in slip); the rules on their own page at `/rules`, reached by `how to play ▸`, never in the room; and **every match rated** (the unranked branch and `matches.rated` reader are gone). **Scored-letter integrity (spec `specs/049-scored-letter-integrity/spec.md`, 2026-09-20)**: a live match's final field showed non-words (`ÞKHL`, `GÁAAT`) under settled bands because `loadMatchState` regenerated the starting board from the seed whenever the round pointer named no row (a completed match's pointer is one past its last round), and an unguarded round-end write had let a thawed `after()` hook rewrite a completed match. Now a finished match is served from its last played round (`lastPlayedRound`), the round-end write is a compare-and-set (`lib/match/roundEndWrite.ts`), every resolution checks that each record spells and no frozen letter moved (`lib/match/matchIntegrity.ts`, `match.integrity.failed`), a settled band must spell its word before it is drawn, and a scored letter takes the colour of the player who froze it first — the `shared` ink state is gone. **Ten moves each on one shared clock (spec `specs/050-async-moves/spec.md`, 2026-09-21, P0–P3 on branch `050-async-moves`)**: the rules changed. There are no rounds: each player makes ten moves whenever they like; one 5:00 clock runs for the match and never pauses; the server stamps every move with a receipt sequence under a per-match lock and resolves moves one at a time in that order (`receive_move` → `claim_next_move` → `finish_move`, `lib/match/moveResolver.ts`); a move landing on a letter an earlier move froze or exchanged is refused and not counted; a player waits only for their own reveal plus a 600ms hold; a move with no word costs a flat −5 (`lib/scoring/missPenalty.ts`, rules §5.6, 2026-09-21), and at 0:00 every unplayed move costs −5 too; then score → exclusive frozen tiles → draw (running out of time no longer loses by itself; totals can go negative); every result is rated; repeated words score. The clock is drawn once, in the ledger caption; each bar's lane counts that player's moves; ledger rows are indexed by move number. Design canvas: https://claude.ai/artifact/SU3bj2nTT4tEyCiinoEAAB. The destructive migration `supabase/migrations/20260921001_async_moves.sql` deletes every match and resets ratings. A player with ten moves whose opponent has been gone 90s may end the match early; a disconnect by itself decides nothing. The room counts `starts in 3·2·1` from the server's `started_at` and takes no pick before it. Tasks: `specs/050-async-moves/tasks.md`. <!-- retired-name --> **Identity, and one commitment at a time (spec `specs/067-identity-one-match/spec.md`, 2026-09-23, branch `067-identity-one-match`)**:
- **Session and name.** The session cookie is HMAC-signed. A year-long device key claims each name, and another browser reads `that name is taken · pick another`. A lapsed session renews silently in `proxy.ts`.
- **Door.** After a sign-out the door greets the browser's player (`welcome back`).
- **Sign-out** never resigns and is refused during a live match.
- **Match creation.** Every match is created by `create_match_between`, so no player is ever booked into two live matches. Challenges no longer mark their sender, so two players who challenge each other start at once. Four migrations: `supabase/migrations/20260923001`–`004`.

**The scoreboard (spec `specs/068-match-scoreboard/spec.md`, 2026-09-23, branch `068-match-scoreboard`, Phases A and B)**:
- **Scoreboard.** In the match states (starting, live, match over) one box above the field replaces the two player bars: row 1 the match clock, row 2 the opponent, row 3 you. One track column: the clock's ten 30s blocks of six 5s ticks stand above each player's ten moves, so time left and moves left compare down a column (`components/room/Scoreboard.tsx`). The lobby, queue and profile keep their bars.
- **Nothing blinks.** Urgency is weight and ground only (`--tint`, ink ticks, numeral 700 under 1:00; `last 12s`; `time`). The old caption clock and its flash are gone.
- **One grid.** Cells are whole pixels (`min(floor((available − 3) / 10), 71)`; 713px field at 1440×900). The ledger's head mirrors the scoreboard's three rows and its ten move rows are one cell tall, level with the board. On a phone the ledger block ends in a foot pinned to the bottom edge (`⋯` and the language).
- **Colours.** Nine tokens: the opponent is burnished terracotta (`--opp` `#B56A4F`, `--opp-text` `#A1583D`), and `--err` crimson `#AD1F3D` marks only a number of points lost, through `components/room/PointsLost.tsx`.
- **Name.** Orðusta and Wottle are capitalised wherever written as a word (`lib/i18n/locales.ts` `wordmark`); a live match's tab title reads `3:12 · move 4 · Wottle`.
- **Phase B (the whole move).** A 2px last-moved tick under each player's latest resolved swap; live row line 2 shows one source by precedence and never wraps; the missed beat (`move 4 · no word`) and the stakes under 1:00 (`3 moves left · −15 if unplayed`); opponent moves and `1:00 left` / `0:15 left` announced once (`useAnnouncements`); focus moves to the field at go; the resign slip's primary is `keep playing ▸`; the end-early slip focuses its headline, guards its primary for 500ms, and `keep waiting ▸` moves the offer to line 2 for good; your own outage reads `offline · reconnecting`, then `back · away 0:34 · the clock ran on` (`useOutage` in `useMatchTransport`).

**The table (spec `specs/069-match-table/spec.md`, 2026-09-23, branch `069-match-table`)**: nobody is rated for a match they did not sit down at.
- **The table.** Every match begins `pending`, at a table: the field is the empty ruled frame under the **ready** slip and the server holds the letters (`board: null`) until both players are seated. A player is seated at creation by their own press (accepting a challenge or rematch, or a crossed send) or by a visible tab with input in the last 30s (`useAttention`, reported on the table check, the queue poll and the match's state poll); anyone else has 20s to press `ready ▸` / `ég er til ▸`. `seat_player`'s second seat writes the board and sets `started_at` 4.5s ahead; the slip lifts 3.3s before go and the 3·2·1 runs in the scoreboard's clock row (`lib/room/tableSlip.ts`, `components/room/hooks/useTable.ts`).
- **The void.** A table not filled in 20s, or left (`leave`, or Back), is `completed` with `ended_reason` `void` (`void_reason` `not_seated` | `left`, `voided_by`): no winner, no rating, in no history, record or rematch offer. A seated queue player is requeued at the front (`queued_at` kept) and keeps searching from the **void** slip; the absent player's search stops (`you did not sit down · your search stopped`). Voided lazily by the loader, by a seat past the deadline and by the 30s sweep (`find_due_tables`). `resignMatch` refuses before go.
- **The queue.** Paired in `queued_at` order among searchers heard from within 10s and not paused; a hidden tab pauses its search on every device (a beacon to `/api/matchmaking/pause`; `resume ▸`); 3:00 in, `Still searching?`; a pairing pushes `/match/:id` (the queue's own `found` phase is gone). Two `left` voids in 10 minutes refuse searching and sending challenges for 5 minutes (`table_leave_cooldown_until`; the lobby reads `find again in 4:12`); accepting stays open.
- **Everywhere.** Every room page checks every 3s for a waiting table (`useTableCheck` → `GET /api/match/active`); tables are pushed history; the resign slip names the loss stake the table showed. One migration, `supabase/migrations/20260924001_the_table.sql` (it drops `start_match_if_ready`); the table's functions are called only from `lib/match/tableService.ts`.

**The door, the lobby, challenges and presence (spec `specs/070-door-lobby/spec.md`, 2026-09-24, branch `070-door-lobby`)**: where there is no field there is a **page**.
- **Pages.** `/` and `/en` are the door signed out and the lobby signed in (`app/[locale]/(pages)/page.tsx`); `/lobby` and `/matchmaking` 308 there. A page is `PageFrame`: the masthead (the strip home, `how to play ▸`, the other lobby with its count, you, `⋯`), the **line slot** (sticky on desktop, pinned to the bottom on a phone) and the folio. The lobby is your block and the form strip, who is here with your record against each (`HereNowTable`), and your last match as a band map. The lobby and queue rooms and the sign-in slip are gone.
- **The line slot.** One standing state on every page and the match page, composed once by `useStandingMachine` in `StandingProvider` (locale layout): call > match > switch > sent or held outcome > search > notice > empty (`lib/pages/standingSlot.ts`, `slotLines.ts`), with its countdown, the cue, notifications, the tab title and the favicon. The search runs here (`SearchRunner`), so it follows you across pages.
- **Challenges.** `challenge ▸` opens the composer in the row (terms and stakes, then `send challenge ▸`); 60s to answer, a decline cools that pair for 60s, three declines silence the sender, one out at a time, within one language's lobby. One locked function decides a send (`send_challenge`), called only from `lib/matchmaking/challengeService.ts`.
- **Presence per tab.** Each tab beats (`/api/presence/beat`, 10s visible, 30s hidden) into `presence_tabs`; fresh for three beats plus 5s, a closing tab's beacon gone after 8s, away once every tab is hidden 2:00 (`lib/presence/`). A page beat in a live match keeps its heartbeat as `page`, so the opponent reads `stepped out`; a result that ends while you are away stays in your slot (`unseen_result_match_id`).
- **Pokes, not payloads.** Every event is a payload-free broadcast on `player:{hmac}` or `lobby:{lang}` (`lib/realtime/pokes.ts`); clients re-read `/api/standing` or `/api/lobby/players`, with a 3s poll (12s once the channel is joined). The rematch id is never broadcast: both players are poked and read it from the old match's state (`rematchMatchId`).
- **One lobby language** per player (`players.lobby_language`); opening the other lobby switches at once, or asks first when a search or challenge is out.
- **The leave slip** (Back in a live match, or `⋯ go to the lobby`): `stay ▸` is focused and it never resigns.
One migration, `supabase/migrations/20260925001_door_lobby.sql`. Tasks: `specs/070-door-lobby/tasks.md`. Canvas: https://claude.ai/artifact/W1emDuJCT6zNAH4h79N3yo.

**Languages by URL (spec `specs/060-locales/spec.md`, 2026-09-22, branch `060-locales`)**: every page lives under `app/[locale]`; `proxy.ts` serves Icelandic unprefixed (`/`, `/lobby`, `/match/…`, wordmark `Orðusta`), English under `/en/…` (`Wottle`), and redirects `/is/…` to the bare path (`lib/i18n/routing.ts`). Build every internal path with `localePath` / `useLocalePath` (`lib/i18n/locales.ts`; `tests/unit/styles/locale-links-grep.test.ts` fails on a bare one). Strings are one typed object per language, `lib/i18n/copy/{en,is}.ts` (`Copy`; a parity test fails on a missing key or an English leftover), read with `useCopy()` or `getCopy(locale)` and passed to the room's pure functions as `copy`; server failures reach the room as `ErrorCode`s. A match's language is fixed at creation (`matches.language`; invites carry it, rematches copy it, a match opened under the other locale redirects to its own) and picks its language pack (`lib/game-engine/languagePack.ts`: dictionary, letter values, letter weights). Queue (`players.queue_language`), lobby presence (`lobby_presence.language`, Realtime `lobby-presence:{language}`) and ratings (`player_ratings (player_id, language)`, `lib/rating/playerRatings.ts`) are per language. Adding a language is a registry entry, a copy file, a word list and a language pack. Tasks and notes: `specs/060-locales/tasks.md`.

Fixture phases (32): table, table-seated, void, void-queue, idle, picking, illegal, reveal, final, disconnect, profile, phone-sheet, resign, over-slip, rules, scoring, scored, opp-reveal, rejected, done-waiting, time-up, end-early, low-clock, last-seconds, starting, missed, stakes, pick-cleared, last-moved, gone, offline, leave (spec 070; the sign-in, lobby, queue and paused-search phases went with their rooms). Pages have their own fixtures at `/dev/page?phase=…` (door, is-door, door-returning, lobby, is-lobby, lobby-new, lobby-empty, composer, is-composer). The phone views `phone-match`, `phone-match-664` and `phone-match-360` (over `idle`) and `phone-table`, `phone-table-664` and `phone-table-360` (over `table`) are viewport tests with their own baselines, not phases.

## Design (MANDATORY for any UI change)

- The UI follows `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` (entry point `docs/design_documentation/README.md`). Do not add colours, radii, shadows, gradients, blur or fonts outside it. Nine colour tokens (`--paper`, `--ink`, `--rule`, `--tint`, `--muted`, `--you`, `--opp`, `--opp-text` for terracotta **text below 17px** only, and `--err`); two type families (`--font-board` slab serif, `--font-mono`).
- **Crimson (`--err`) marks a number of points lost and nothing else** (spec 068): the `−5` of `no word` and of `not played`. Only the number is crimson; its label stays `--muted`, and a floored 0 is muted. Never a seat, a rating change, urgency, a frame, focus or a control. Its one door is the `.points-lost` class, applied only by `components/room/PointsLost.tsx`.
- Every visible element is a letter (or a state of a letter) on the **field**, a fact about one player on that player's row of the **scoreboard** (in a match) or in their **bar** (lobby, queue), or a fact about the match on the scoreboard's clock row or in the **ledger**. If a new element is none of these, do not add it.
- Colours are **seat-relative**: `--you` teal, `--opp` terracotta, always via `getSeatColors(viewerSlot, slot)`. Never map colour to `player_a` / `player_b`.
- **Pages (spec 070, design system §5.10).** Where there is no field there is a page: the door, the lobby, the profile and the rules, each a `PageFrame` (masthead, line slot, content, folio). A page never draws a field; the room never draws a masthead. A standing state (a call, your match, your challenge, your search) is the line slot's, never a notice or an overlay. One primary per page; a call's `accept ▸` or an open composer's send takes it. Anything that appears under the pointer ignores activation for 500ms, and nothing that arrives takes focus.
- **Only the slip is ever positioned over the field** (design system §5.9, spec 048): a paper panel with a 1.5px ink frame, for ready and void (spec 069: the table, derived from the match, never raised), leave (spec 070: Back in a live match; `stay ▸` focused; never resigns), resign, end early (spec 050; it was claim the win) and match over, with the field faded to 32% beneath it. Ranking: match over > end early > resign > leave > ready or void. The sign-in slip is retired: signing in is the door. No other modal, banner, toast, overlay or confetti; every other state change is written into the scoreboard, the bars or the ledger's live row. <!-- retired-name -->
- **The live row says the beat and the next step** (`lib/room/moveState.ts` `deriveMoveState` → `liveLinesFor` → `{ line1, line2 }`, spec 050): line 1 is the move's beat in the board face (`starts in 3`, `move 4 · your move`, `move 4 · scoring`, `move 4 scored`, `10 of 10 played`, `time · scoring`); line 2 is the field's instruction while a move is yours to make (`pick a letter`, `picking · T (2) · tap a second letter`) or the beat's fact otherwise (`you +13 · move 5 opens`, `Kári · 8 of 10 · 1:12 left`). Line 2 shows exactly one thing (spec 068), by precedence: offline > back > submit error > refused or illegal pick (`frozen · Kári froze it · pick another`, `frozen · GILT · Kári · pick another`, 2s) > pick cleared (`pick cleared · Kári moved that letter`, 2s) > the end-early offer > the missed beat (`−5 · move 5 opens`) or the stakes (`3 moves left · −15 if unplayed`) > the instruction or fact. It never wraps at 1440 (about 40 mono characters; a test renders every string in both languages; a long string is shortened in the copy). After your own reveal the scored row holds 600ms (the move hold) before the next opens, and the field takes no pick meanwhile; the opponent's reveal never locks your field, and a pick on a letter they exchanged or froze clears on line 2, not as a notice.
- **The scoreboard (spec 068):** in the match states (starting, live, match over) one box above the field (1.5px `--ink` frame) holds the clock and both players; there are no player bars around the field (the lobby and queue keep theirs). Row 1 is the match clock: a two-line label (`match clock`, `under a minute`, `last 12s`, `time`, `starts in 3`, `match over` over the pace `≈27s a move` while the move is yours, or `4:52 of 5:00` at match over), the track, the numeral. Row 2 is the opponent, row 3 you (nearest the board): square, name, sub-line, that player's ten moves on the track (emptying from the right; 30% in flight; outlined when reconnecting, gone or offline), the total. **One track column:** the clock's ten 30s blocks of six 5s ticks stand above each player's ten moves. Only your row names its seat (`1310 · you · move 4 of 10`); theirs reads `1265 · 6 of 10 · playing`, `reconnecting · 0:42 left` in the 90s window and `8 of 10 · gone for 2:04` after it; yours says `move 8 · behind pace` when moves left − seconds left ÷ 30 ≥ 1. Starting: both rows `ready` while the clock row loads over the 3·2·1. Match over: the clock holds what was left and the rows carry the rating lines. The clock is drawn nowhere else. The field is outlined 3px in `--you` only while a move is yours to make.
- **Nothing blinks.** Urgency is weight and ground only: under 1:00 the clock row takes `--tint`, ink ticks, numeral 700; the last 15 seconds read `last 12s`; 0:00 is an empty track and `time`. Time is not motion: the numeral and ticks step once a second under reduced motion too.
- **One grid (spec 068):** cells are whole pixels, `min(floor((available − 3) / 10), 71)`, the field `10 × cell + 3` (713px at 1440×900), bounded by height and by the width beside the ledger. The ledger's head has three rows mirroring the scoreboard's (wordmark + context + `⋯`; territory or the verdict; the face-off header, its ink rule level with the box's bottom border); then ten move rows, each one cell tall, level with the board's rows. There is no desktop foot during a match. On a phone: scoreboard, field, the live row (`history ▸`), territory, and a foot pinned to the bottom edge (`⋯`, `english words` / `íslensk orð`); no wordmark and no clock in the phone ledger; the sheet opens between the field and the foot.
- **The ledger** holds the match's facts only: rows are indexed by move number, your Nth move in your column and theirs in theirs, either side of a ruled **spine** that carries the move number (2026-09-21); each cell reads inward to it (points beside the spine), a miss writes `no word −5` / `−5 not played` (the number crimson, the label muted), the final state closes on a totals row, and the live row is your next open move, one band across the ledger. Nothing is ever pinned: a committed move resolves at once.
- The hint line is for match-level lines only and hides when empty. The ledger is the height of the stack, never stretched to the viewport; every row is one grid item that owns its `--rule`. A scored letter and its numeral take the colour of the player who froze it first (`ownerSeatOf`); a crossing letter keeps the earlier owner's colour, and every band shades its whole word, the crossing included (spec 049, amended 2026-09-21). No cell is ever `shared`.
- **The rules are not in the room.** `/rules` is the one page outside it, reached by `how to play ▸` from the lobby and final feet, the sign-in slip, and the match `⋯` menu (a new tab, so a match is never interrupted).
- Copy: sentence case, no exclamation marks, one idea per line, mono uppercase for labels. The name is capitalised wherever it is written as a word: **Wottle**, **Orðusta** (wordmarks, tab titles, metadata, prose; one source, `lib/i18n/locales.ts` `wordmark`); identifiers, URLs, cookie and file names stay lowercase. Fixed strings in design system §8.
- Motion is a state change, not a performance: durations and easing in design system §6; everything 0ms under `prefers-reduced-motion` except time, which still steps once a second.
- The rules → rendering contract is `docs/prd_and_requirements/wottle_game_rules.md` §12 ("What the player sees").

## Essential Commands

### Setup & Development

```bash
pnpm quickstart              # One-command setup: Supabase preflight, Docker, migrations, seed, .env.local
pnpm dev                     # Start Next.js dev server (requires .env.local)
pnpm build                   # Build production app
```

### Testing

```bash
pnpm test                    # Run unit tests (Vitest)
pnpm test:unit               # Unit + contract tests
pnpm test:integration        # Integration tests (requires Supabase)
pnpm exec playwright test    # E2E browser tests (CI auto-starts services)
pnpm test:visual             # Visual suite: /en/dev/room fixtures (+ an Icelandic set at /dev/room) at 3 viewports, no Supabase
                             # `pnpm test:visual --update-snapshots` is the only way to change a baseline
pnpm lint                    # ESLint with zero-warnings policy
pnpm typecheck               # TypeScript type check
```

### Performance Testing

```bash
pnpm perf:lobby-presence      # Assert lobby broadcast <2s p95
pnpm perf:move-receipt        # Assert move receipt RTT <200ms p95 (spec 050)
pnpm perf:move-resolve        # Assert one move resolves <50ms p95, warm dictionary (spec 050)
pnpm perf:seat                # Assert sitting down at the table <200ms p95, live local Supabase (spec 069)
pnpm perf:swap                # Legacy swap latency (regression baseline)
```

### Supabase Operations

```bash
pnpm supabase:migrate         # Apply pending migrations
pnpm supabase:seed            # Seed test data
pnpm supabase:reset           # Drop data, reapply migrations
pnpm supabase:verify          # Check schema, RLS, observability hooks
pnpm supabase:policies        # Verify RLS policy coverage
pnpm supabase:logs            # Export Supabase logs
pnpm guard:no-service-role    # Fail if service_role key can reach client code
```

### Single Test Execution

```bash
# Unit test (specific file)
pnpm test:unit -- path/to/test.spec.ts

# Playwright (specific test)
pnpm exec playwright test --grep "test name"

# Integration test (specific file)
pnpm test:integration -- path/to/integration-test.spec.ts
```

## Game Rules Spec (MANDATORY READING BEFORE SCORING CHANGES)

**Any change to `lib/game-engine/*`, `lib/match/moveResolver.ts`, `lib/match/matchSettlement.ts`, `lib/match/resultCalculator.ts`, `lib/scoring/*`, or `lib/constants/game-config.ts` MUST be checked against `docs/prd_and_requirements/wottle_game_rules.md`.** That document is the authoritative specification of Wottle's rules, the per-letter coverage rule (§4), the scoring formula (§5), the validation algorithm (§7), the board invariants (§8), and the regression log (§10). Scoring bugs are the most frequent class of regression in this codebase and each prior one is documented in §10 — read that table before editing the cross-validator. If the implementation and the spec disagree, update the spec in the same PR as the code change and add a regression test naming the invariant it pins.

## Speckit Workflow (MANDATORY)

This project uses **Speckit** for spec-driven development. All feature work MUST follow this workflow:

1. **Specify** (`/speckit.specify`) - Define requirements in natural language
2. **Clarify** (`/speckit.clarify`) - Resolve ambiguities
3. **Plan** (`/speckit.plan`) - Create implementation plan with technical context
4. **Tasks** (`/speckit.tasks`) - Generate actionable, ordered tasks
5. **Implement** (`/speckit.implement`) - Execute with TDD

**Constitution**: `.specify/memory/constitution.md` defines non-negotiable principles:

- Server-Authoritative Game Logic (all state mutations server-side)
- Real-Time Performance Standards (move RTT <200ms, validation <50ms, broadcast <100ms)
- Type-Safe End-to-End (explicit return types, Zod validation)
- TDD workflow (Red → Green → Refactor)
- Clean Code principles

Before implementing any feature:

1. Review the constitution for alignment
2. Check existing specs in `specs/` for patterns
3. Use appropriate Speckit command for the phase

**Completed Specs** (all merged to `main`):

- `001-e2e-board-scaffold` — initial board + swap scaffold
- `002-two-player-playtest` — infrastructure milestone (52 tasks)
- `003-word-engine-scoring` — word engine, scoring, frozen tiles (52 tasks)
- `004-ci-pipeline-refactor` — GitHub Actions pipeline
- `005-board-ui-animations` — tile swap + scored-tile highlight animations
- `006-match-completion` — server-authoritative clock enforcement, match end, `FinalSummary`
- `007-server-authoritative-timer` — timer refactor driven by `rounds.started_at`
- `008-score-delta-popup` — round-end delta breakdown popup
- `009-game-rules-config` — rule constants + feature flags
- `010-word-discovery-highlights` — player-colored scored-tile glow
- `011-board-ui-polish` — tile-grid visual polish
- `012-round-history-and-game-recap` — accumulated round history panel
- `013-scoring-change` — PRD-compliant scoring (length bonus, combo bonus)
- `014-move-playability-improvements` — invalid-move feedback + shake animation
- `015-sensory-feedback` — Web Audio + Vibration API, prefers-reduced-motion
- `016-rematch-post-game-loop` — rematch negotiation, series tracking
- `017-elo-rating-player-stats` — Elo calculation, lobby rating display, profile modal
- `018-match-hud-layout` — 3-column match layout + compact mobile bars
- `019-lobby-visual-foundation` — previous-design lobby (ui primitives, hero, stats strip, PlayNowCard, LobbyDirectory, InviteDialog, skeleton/empty states); UI superseded by spec 044
- `042-instant-scoring-reveal` — first mover's scored words, score delta, and tile freezes appear on both boards instantly via `instantScoreFirstSubmission` fast path in `submitMove`'s `after()` hook; race-window guard + zero-score branch keep contention safe; second mover's auto-deselect + aria-live announcement on freeze (Linear O-57)
- `043-scoring-resolution-viz` — presentation-only round-resolution clarity: current-round scored ring, calm waiting frame, transient swap lift (see Recent Changes)

**Field & Ledger Rebuild** (`044-field-ledger-redesign`, shipped 2026-09-14) — one room for every screen. Plan: `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_PLAN.md` §11. Each step shipped on its own; the acceptance greps for the retired components (`tests/unit/styles/acceptance-grep.test.ts`) and the docs phrase list (`pnpm docs:check`) return nothing.

| Step | Work                                                                                                                     | Retires                                                                                                                                                                                                       | Status                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| P0   | Reading direction on scored word records; `BORÐA + GILT` and `FÁR/RÁF` regression tests; copy fixes; rules doc §2a / §12 | —                                                                                                                                                                                                             | Done                                |
| P1   | Tokens, fonts, Tailwind config; shell without top bar; `PlayerBar`                                                       | `HudCard`, `PlayerPanel`, `TimerDisplay`, `MatchCenterChrome`, `RoundPipBar`, `TopBar` in match                                                                                                               | Done                                |
| P2   | `Ledger` (match variant)                                                                                                 | `MatchLeftRail` + 3 cards, `ScoredWordsCard`, `TilesClaimedCard`, `ScoreDeltaPopup`, `RoundSummaryPanel`, `RoundHistoryPanel`, resign button                                                                  | Done                                |
| P3   | Field: flat cells, word bands with chevrons, pick → preview → commit, reveal choreography                                | `BoardCoordLabels`, `MoveFeedback`, lock banner, round announce, invalid flash, bulk of `board.css`                                                                                                           | Done                                |
| P4   | Room states: landing / lobby / queue / found / final in one `Room`; warm-up and setting fields                           | `LandingScreen`, `LobbyHero`, `PlayNowCard`, `LobbyDirectory`, `LobbyCard`, `MatchRing`, `MatchmakingVsBlock`, `FinalSummary`, `PostGameVerdict`, `PostGameScoreboard`, `RematchBanner`, `DisconnectionModal` | Done                                |
| P5   | Profile; Playwright + visual acceptance; remaining docs per `DOCS_CONSISTENCY.md`                                        | `ProfileSidebar`, `ProfileStat`, `ProfileWordCloud`, `ProfileMatchHistoryList`                                                                                                                                | Done                                |

The previous redesign (phases 1a–6, April–June 2026) shipped in full and is superseded; its plan `docs/archive/superpowers/specs/2026-04-19-wottle-design-implementation.md` and phase plans under `docs/archive/superpowers/plans/` are marked as such and kept because they explain why the current code looks as it does.

## Architecture

### Directory Structure

**Critical Directories:**

- `/app` - Next.js App Router
  - `/app/actions/*.ts` - **Server Actions** (primary frontend→backend interface)
  - `/app/api` - HTTP API routes (backup endpoints, polling)
  - `/app/[locale]` - Every page, under the language segment (spec 060): `layout.tsx` is the root layout (`<html lang>`, metadata, `LocaleProvider`); `is` is served unprefixed through `proxy.ts`
  - `/app/[locale]/(pages)` - The **pages** (spec 070): `page.tsx` is `/` and `/en` (the door signed out, the lobby signed in); `(framed)/profile`, the rules
  - `/app/[locale]/(room)` - The **room** route group: `/match/[matchId]` (non-participant guard: live → `/`, completed → read-only); `/lobby` and `/matchmaking` 308 to `/`
  - `/app/[locale]/match/[matchId]/summary` - Redirects into the room (the result is a room state, not a page)
  - `/app/[locale]/profile` - Own profile + `[handle]` public profile, rendered in the room grid
- `/lib` - Business logic and utilities
  - `/lib/game-engine` - **Board mechanics + Word Engine** (mutations, swaps, dictionary, board scanner, delta detection, scoring, frozen tiles, `readingDirection.ts`, `boardGenerator.ts`, `languagePack.ts` — a match language's letter values, weights and alphabet)
  - `/lib/i18n` - **Languages (spec 060)**: `locales.ts` (registry, `localePath`), `routing.ts` (the proxy's decision), `copy/{en,is}.ts` + `types.ts` (`Copy`, `ErrorCode`), `getCopy.ts`, `plural.ts`, `errorCodes.ts`, `params.ts` (`readLocaleParam`)
  - `/lib/rating` - Elo: `playerRatings.ts` (per-language records), `persistRatingChanges.ts`
  - `/lib/match` - **Match orchestration**: spec 050 → `moveResolver.ts` (claim → resolve one → finish), `matchSettlement.ts`, `movePublisher.ts`, `resultCalculator.ts`, `stateLoader.ts`, `wordScoreRow.ts`, `integrityCheck.ts` + `matchIntegrity.ts` (spec 049's check, run after every resolved move)
  - `/lib/room` - **Room state and pure UI logic**: `roomStore.ts` (zustand: phase lobby | queue | found | match | final, viewer, board, match, connection), `fieldInteraction.ts` (idle → picked → committed reducer; there is no move preview), `moveState.ts` (the move beats, plus `starting` before the clock runs), `revealSequence.ts` (reveal planner, `MOVE_HOLD_MS`), `ledgerRows.ts`, `moveRail.ts`, `bandGeometry.ts`, `clock.ts`, `notices.ts`, `displayBoard.ts`, `useMatchmaking.ts`, `useRematchNegotiation.ts`
  - `/lib/matchmaking` - Invites, challenges (`challengeService.ts`), the lobby language (`lobbyLanguage.ts`), head-to-head, player profiles
  - `/lib/presence` - Presence per tab (spec 070): `presenceService.ts` (the one caller of `beat_tab`, `leave_tab`, `player_presence`, `lobby_counts`), `constants.ts`
  - `/lib/pages` - Pure page logic (spec 070): `standingSlot.ts`, `slotLines.ts`, `pagePrimary.ts`, `pageTitle.ts`, `composer.ts`, `lobbyRows.ts`, `rowOverlays.ts`, `heldOutcome.ts`, `doorCopy.ts`, `formStrip.ts`, `bandMap.ts`
  - `/lib/standing` - `readStanding.ts`, the viewer's standing facts for `/api/standing`
  - `/lib/lobby` - The overview (`/api/lobby/overview`), the lobby's rows, the sweep
  - `/lib/brand` - The lockup and strip geometry
  - `/lib/scoring` - **Scoring** (`calculateWordScore`, highlights) — wired to word engine
  - `/lib/realtime` - Supabase Realtime with polling fallback
  - `/lib/supabase` - Client factories (server vs browser, with safety guards)
  - `/lib/rate-limiting` - Scoped rate limiting middleware
  - `/lib/a11y` - Focus trap, roving focus utilities
  - `/lib/observability` - Structured logging, performance marks
  - `/lib/types` - Shared TypeScript types
  - `/lib/constants` - Board dimensions, `seatColors.ts` (`getSeatColors`, `resolveSeat`), app constants (fixed strings moved to `lib/i18n/copy/`)
- `/docs` - PRD, rules, design entry point (`docs/design_documentation/README.md`), archive of superseded material (`docs/archive/`)
  - `/data/wordlists` - Source lists: Icelandic (~3.71M inflected forms, full BÍN fresh (1+ chars)), English (~79k) and the not-yet-playable se/no/dk lists. The game loads the **board wordlists** `word_list_<min>_<max>_<lang>.txt` (`word_list_3_10_is.txt`, ~1.16M), the source stripped of words shorter than `minimumWordLength` or longer than `BOARD_SIZE`; `pnpm wordlists:build` writes them and `loadDictionary` throws if one is missing
- `/components` - React Client Components:
  - `/components/page` — the pages (spec 070): `PageFrame`, `Masthead`, `Folio`, `LineSlot`, `Lockup`, `Strip`, `LanguageSwitch`, `PageMenu`; `door/` (the door, its form); `lobby/` (`LobbyPage`, `YourBlock`, `FormStrip`, `HereNowTable`, `ComposerRow`, `BandMap`, `LastMatch`, `RecentMatches`)
  - `/components/standing` — `StandingProvider`, `useStandingMachine`, `SearchRunner`, and `hooks/` (`useTabPresence`, `useStandingFacts`, `useLobbyList`, `useHeldOutcome`, `useFavicon`, `useTabTitle`, `useNotifications`, `useArrivalWatch`)
  - `/components/room` — the whole player-facing UI (spec 044): `Room` / `RoomShell` (the one grid: the scoreboard over the field in a match, bar / field / bar in the lobby and queue, + ledger), `Scoreboard` (spec 068), `PlayerBar` + `BarLane` (lobby and queue) + `NameInput`, `PointsLost` (the one use of `--err`), `Field` + `FieldCell` + `FieldBands`, `Ledger` + `LedgerFoot` + `LedgerSheet` + `LobbyLedger` + `RoomMenu`, the controllers `LobbyRoomController`, `QueueRoomController`, `MatchRoomController` (+ `MatchRoomView`), and `hooks/` (`useMatchTransport`, `useFieldInteraction`, `useReveal`, `useMoveHold`, `useDeadlineTick`, `useCountUp`, `useNotices`, `useLobbyInvites`, `useAccumulatedMoves`, `useWordHistory`, `useMatchOverSlip`, `useFieldSize`, `useMeasuredLines`, `useNowTick`, `useReducedMotion`)
  - `/components/i18n` — `LocaleProvider` (`useLocale`, `useCopy`, `useLocalePath`; outside a provider the room reads English)
  - `/components/rules` — the rules page's `content/{en,is}.tsx`, figures (`rulesFiguresFor`), scoring table
  - `/components/profile` — `ProfilePage`, `ProfileRatingChart` (same grid and grammar as the room)
- `/app/styles/room.css` — the one stylesheet: room grid, bars and lanes, field cells, bands, ledger, lobby tables, name input, profile classes; the scoreboard; keyframes `field-shake`, `band-draw`, `count-up`, `lane-blink`, `lane-search`, `letter-land` (nothing blinks, spec 068); one `prefers-reduced-motion` block. Tokens and fonts live in `app/globals.css` / `tailwind.config.ts`.

### Key Architectural Patterns

#### 1. Server Actions Pattern (Primary Communication)

- Components call Server Actions (defined in `/app/actions/*.ts`)
- Flow: Component → Server Action → Validation (Zod) → Business Logic → Database → Typed Response
- All Server Actions have explicit return types (`Promise<ReturnType>`)
- Rate limiting via `assertWithinRateLimit()` with scoped limits

#### 2. Supabase Client Separation (Security-First)

- `/lib/supabase/server.ts` - Service role client (server-only, RLS bypass) - throws if run in browser
- `/lib/supabase/browser.ts` - Anon key client (browser, respects RLS)
- Guard script: `pnpm guard:no-service-role` prevents service_role key from reaching client

#### 3. Realtime with Polling Fallback

- `/lib/realtime/matchChannel.ts` - Match state broadcasts
- `/lib/realtime/presenceChannel.ts` - Lobby presence tracking
- Automatic fallback to HTTP polling (2s interval) on WebSocket failure
- Component tracks mode: `"realtime" | "polling"`

#### 4. Move Resolution (`/lib/match/moveResolver.ts`, spec 050)

```txt
Match states: pending (the table) → in_progress → completed | abandoned
              pending → completed with ended_reason 'void' (the table did not fill, or was left)
Move states:  pending → resolving → resolved | rejected

Move flow:
1. Receive  - submitMove → receive_move RPC: row lock on the match, gates (ended, deadline, cap,
              in_flight), gap-free global_seq + received_at (clock_timestamp), insert pending
2. Claim    - resolvePendingMoves → claim_next_move: CAS the move at resolved_seq + 1 to resolving
              (pending, or resolving but stale > 10s)
3. Resolve  - resolveOne (pure): refuse `frozen` / `moved`, else applySwap → scan → cross-validate
              → score → freeze (>= 24 unfrozen); a move with no word scores −5 (the miss
              penalty); no duplicate suppression
4. Finish   - finish_move: CAS resolved_seq + 1; write board, frozen map, score, count, the move
              row and its word_score_entries in one transaction
5. Publish  - `move-resolved` (MoveResolution) then `state`; loop to 2
6. Settle   - both counts = 10, or deadline passed and the queue drained → completeMatchInternal
              (CAS on state; unplayed moves penalised as misses and written in the same update)
              → determineMatchWinner: score, then tiles, then draw → Elo once
```

#### 4a. Match Creation (spec 067)

- One writer of new matches: `create_match_between(a, b, language, origin, ref, pressed_by)`. It takes both players' row locks in id order and refuses `busy` if either has a `pending` or `in_progress` match. Spec 069: it opens the table (`table_deadline_at` 20s out) and seats the players in `pressed_by` and any whose attention is fresh; a table full at creation starts at once (`start_table_if_seated`).
- In the same transaction it:
  - books both players (`in_match`, search cleared);
  - withdraws their outgoing challenges and rematch requests;
  - supersedes the ones addressed to them.
- Callers go through `lib/match/createMatch.ts`, each adding only its own precondition:
  - `accept_invite`: challenge; crossed challenges are the second challenge accepting the first;
  - `accept_rematch`: rematch and crossed rematch;
  - `pair_from_queue`: the queue.
- `tests/unit/match/one-way-to-make-a-match.test.ts` fails on any `from("matches").insert/upsert` in `app/` or `lib/`. `tests/integration/db/match-creation.race.test.ts` fires every path at once for 100 rounds.

#### 5. Game State Management

- Board: `matches.board` (`BoardGrid = string[][]`, 10x10, written by every resolved move)
- Clock: **one** 5:00 clock for the match (`matches.started_at`, `matches.deadline_at`), set by the seat that completes the table, 4.5s ahead (spec 069), never paused; the deadline is decided at receipt by the database clock. Ten moves per player (`matches.move_limit`). There are no per-player timers and no per-round timer.
- Ordering: `match_moves.global_seq` is the authority; `received_at` is informational
- Refusal: a move whose letters were frozen or exchanged since the player saw them is `rejected` and not counted
- State loading: `/lib/match/stateLoader.ts` for server-side hydration (never starts a match: a `pending` table past its deadline is voided and one both sat at is started, both through `tableService`; no board before go; the stakes while pending; dispatches the resolver and settlement when it sees pending, stale or due work)

#### 6. Session & Authentication

Spec 067 (2026-09-23) is a bridge until Supabase Auth, which arrives in the next phase and replaces the device key.

- **Session cookie** `wottle-playtest-session`:
  - HMAC-SHA256 signed (`v1.<payload>.<mac>`, `lib/auth/sessionToken.ts`), keyed by `WOTTLE_SESSION_SECRET`. With no secret the server throws; it never falls back to unsigned.
  - 4-hour lifetime; httpOnly, SameSite=Lax, Secure in production.
  - It names only who you are: id, username, display name. `viewerInLanguage` reads status and rating fresh.
- **One reader:** `readLobbySession()` (`lib/matchmaking/profile.ts`). A forged, edited, expired or pre-067 cookie reads as no session (`tests/contract/forged-session.contract.test.ts`).
- **The claim:**
  - `wottle-device` is a year-long httpOnly device key. Its SHA-256 is `players.claim_hash`, and one key may claim several names.
  - `enter_player` claims a name, or refuses it as `name_taken` (`that name is taken · pick another`).
  - Existing players are claimed by the first browser that enters after the migration.
- **Silent renewal:** `proxy.ts` (all pages, actions and `/api`) signs a new session from the device key when the session is missing. It does not do this after a sign-out: the `wottle-signed-out` mark makes the door greet the player instead (`readReturningPlayer`, `enterAsReturningAction`).
- **Sign-out** (`logoutAction`, `sign_out_player`):
  - never resigns, and is refused while a match is `pending` or `in_progress`;
  - otherwise it withdraws the player's challenges and rematch requests and leaves the queue;
  - it keeps the device key.
- **Login flow:** rate limit → Zod → `enter_player` (claim) → presence → signed cookie + device cookie.

#### 7. Frontend Communication

```txt
Flow (spec 070: door → lobby → slot → table):
1. app/[locale]/layout.tsx reads the session; signed in it mounts StandingProvider (useStandingMachine): the tab's
   heartbeat, /api/standing on every poke of player:{hmac} (3s poll, 12s once joined), the search, the line slot
2. `/` signed out → the door (DoorPage): a name → loginAction → the same URL reads again as the lobby (LobbyPage):
   enter_lobby, your block, here now (useLobbyList on lobby:{lang} pokes), the last match
3. challenge ▸ → the composer → sendChallengeAction → send_challenge; the other side's slot shows the call → accept ▸
   → accept_invite → create_match_between → both pushed to /match/:id: the table (spec 069)
   find an opponent ▸ → the provider's SearchRunner (useMatchmaking, startQueueAction every 3s with attention)
   → paired → router.push(/match/:id)
3a. The table: MatchRoomController at the `table` beat, the ready slip over the empty field; ready ▸ → seatAction;
   the second seat starts the match 4.5s ahead; the 3·2·1 in the scoreboard; leave / Back → leaveTableAction (void)
4. Match page → MatchRoomController: useMatchTransport (Realtime + 2s safety poll + polling fallback)
   → roomStore.applySnapshot / applyResolution; useFieldInteraction posts moves (with the two letters
   seen); two reveals: own (locks the field, then the 600ms hold) and opponent's (bands only)
5. Disconnect → the opponent's scoreboard row counts `reconnecting · m:ss left` from MatchState.disconnectedAt, then `gone for m:ss`; the
   clock keeps running; once the viewer has ten moves and the window is spent, a slip offers
   `end the match ▸` (→ claimWinAction, normal rules); otherwise nothing is offered
6. state = completed → final phase in the same room: verdict block, rating lines from
   getMatchRatings; the match-over slip lands 600ms after the final settle with the verdict,
   both rating lines and rematch ▸ · new opponent ▸ · review the match ▸ · lobby (rematch
   negotiation rewrites its action line). `review the match ▸` lifts it; `result ▸` in the foot restores it
```

### Core Types & Validation

All types defined in `/lib/types/` with Zod schemas for runtime validation:

- `Board`: Coordinate, BoardGrid, MoveRequest, MoveResult, Direction, BoardWord, ScanResult
- `Match`: PlayerIdentity, MatchState (players, clock, resolvedSeq), MoveResolution, MatchPhase, FrozenTile, FrozenTileMap, WordScoreBreakdown (spec 050)
- `Matchmaking`: LobbyPresence, InvitationRecord, LobbyStatus

Validation happens at Server Action entry points with clear error messages.

### Database Interaction

All access through Supabase client with pattern:

```typescript
const { data, error } = await supabase.from("table").select("*").single(); // or .maybeSingle() or .limit(1)
```

Common operations: `upsert()`, `select()`, `update()`, `insert()`, `delete()`

RLS policies enforced on all tables: players, lobby_presence, matches, match_moves, word_score_entries, match_logs, player_ratings (spec 060) (spec 050; `rounds`, `move_submissions`, `scoreboard_snapshots` are dropped by its migration)

## Project Status & Known Issues

### Current Test Health

- **143 unit/contract test files, 1442 tests passing** (2 intentionally skipped), zero failures; 18 integration files, 45 tests, of which the four `tests/integration/db` suites run against a live local Supabase and skip themselves without one (measured 2026-09-21 on `050-async-moves`). `pnpm test:visual` passes at three viewports over 24 fixture phases.
- CI splits Playwright by tag: the specs tagged `@two-player-playtest` (`moves-flow`, a whole match, and `disconnect-claim`, end early) run on the `playtest-firefox` project with `--workers=1`; every other room spec runs on `chromium`. On failure the job uploads `playwright-results-<suite>` (traces + `error-context.md` page snapshots). Locally, run two-player spec files one at a time to avoid Realtime contention; sign in through `loginViaSlip` (`tests/integration/ui/helpers/matchmaking.ts`).
- Lint (zero-warnings policy), typecheck and `pnpm docs:check` pass cleanly.

### Implementation Status by Area

| Area             | Status     | Notes                                                                            |
| ---------------- | ---------- | -------------------------------------------------------------------------------- |
| Auth & Lobby     | Complete   | Login, presence + 60s heartbeat, realtime + polling fallback                     |
| Matchmaking      | Complete   | Direct invites, auto-queue, match bootstrap                                      |
| Move Resolution  | Spec 050   | Receipt order, claim/finish CAS, refusal not consumed, integrity per move        |
| Realtime         | Complete   | WebSocket channels + HTTP polling fallback                                       |
| Reconnection     | Complete   | 90s window counted down in the opponent's bar; end early is a slip (spec 050)    |
| Rate Limiting    | Complete   | 5/min auth, 30/min moves, 1/min end-early, 429 responses                         |
| Accessibility    | Complete   | Focus traps, aria-live, keyboard nav, 44×44 touch targets, WCAG 2.1 AA axe clean |
| Observability    | Complete   | Structured logs, perf marks, analytics hooks                                     |
| Word Finding     | Complete   | Set-based dictionary (1.16M board-length entries), four-direction scanner, delta |
| Scoring          | Complete   | PRD-compliant formula, length bonus, combo bonuses; repeated words score (050)   |
| Frozen Tiles     | Complete   | Freeze tracking, swap validation, visual overlay, >=24 unfrozen safeguard        |
| Field Motion     | Complete   | Band draw + count-up reveal, in-colour shake, caption blink; 0ms reduced-motion  |
| Match Clock      | Spec 050   | One 5:00 clock, deadline decided at receipt, 3·2·1 anchored to `started_at`      |
| Elo + Ratings    | Complete   | `match_ratings` written on match end, ±N rating deltas in post-game (spec 017)   |
| Rematch          | Complete   | `rematch_requests` table, 30s invite TTL, series tracking (spec 016)             |
| Theme (visual)   | Complete   | Field & Ledger (044) + scoreboard (068): nine tokens, two families; see Design   |
| Move legibility  | Spec 068   | Move state, turn frame, scoreboard (clock + both players on one track), 600ms hold |
| Slip             | Complete   | Sign in · resign · end early · match over; the one overlay (spec 048, 050)       |

### Remaining Gaps

1. **Legacy `boards` table** — singleton board from the original prototype (`supabase/migrations/20251105001_init.sql`) still exists in the schema and is seeded by `scripts/supabase/seed.ts`; no runtime code reads it anymore. A follow-up migration can drop the table + its seed/reset/verify wiring.
2. **Unread `matches.rated` column** — added by spec 045, retired by spec 048 (every match is rated). Nothing reads or writes it; a follow-up migration can drop it.
3. **Unread rating columns on `players`** — `elo_rating`, `games_played`, `wins`, `losses`, `draws` stopped being read or written with spec 060 (ratings live in `player_ratings`, one row per language). A follow-up migration can drop them.
4. **Icelandic translation review** — `lib/i18n/copy/is.ts` and `components/rules/content/is.tsx` were drafted in the implementation and need a native speaker's read before release. Spec 068 Phase B added `venjulegar reglur ráða úrslitum`, `Kári frysti stafinn · veldu annan`, `Kári færði stafinn · veldu annan`, `samtala fer aldrei undir 0`, `engu að tapa`, `tenging komin · 0:34 án tengingar`, `síðasti leikur · Kári` and `án tengingar · ljúka viðureigninni ▸`. Spec 069 added, marked `// native-read` in `is.ts`: `veldu þegar klukkan fer af stað`, `þú ert aftur í leitinni`, `skora aftur á ▸`, `þú fórst frá tveimur borðum · bíddu í nokkrar mínútur` and the facts line `íslensk orð · 10 leikir hvor · ein 5:00 klukka`.
5. **Linux visual baselines** for the `is-*` set and the refreshed English phases come from the CI visual job's artifacts.
6. **Spec 070 Icelandic strings** need the same native read: the door and lobby copy in `lib/i18n/copy/pages.is.ts` (lines marked `// native-read`), and the name-safe rewrites of 2026-09-24 (`<nafn> · beðið svars`, `mótspilari · <nafn>`, `aftur í sambandi · 0:34 án tengingar`, `sá leikmaður er ekki lengur hér`).
7. **Identity is a bridge (spec 067).** Losing a browser's cookies loses its names until Supabase Auth (next phase) brings recovery. The Icelandic `sign_out_in_match` (`kláraðu viðureignina fyrst`), `opponentBusy` and returning-door strings need the native read in gap 4. `WOTTLE_SESSION_SECRET` must be set in Vercel before release, and the release signs everyone out once (no grace for unsigned cookies).

## Code Standards

### TDD Workflow (MANDATORY)

1. **Red** - Write failing test FIRST
2. **Green** - Write MINIMUM code to pass
3. **Refactor** - Improve while keeping tests green

**Commit Strategy:**

- Each passing test committed separately
- Format: `test(scope): [what test verifies]` or `feat(scope): [feature] - add test for [behavior]`
- NEVER commit failing tests (except WIP with `[WIP]` prefix)
- NEVER commit code without corresponding passing test

### Clean Code Principles (MANDATORY)

- Functions <20 lines, do one thing (Single Responsibility)
- Function names: Verbs describing action
- Parameters ≤3 (use objects for more)
- No boolean parameters (split into separate functions)
- Command-Query Separation: do something OR answer something, not both
- DRY principle, organize by feature/domain (not technical layers)
- Comments explain "why" not "what" (code self-documents)
- Dead code removed, no commented-out code
- Cyclomatic complexity <10 per function

### TypeScript Standards

- Strict mode enabled
- All Server Actions have explicit return types
- Shared types in `/lib/types/` for server-client consistency
- Zod validation on all Server Action inputs
- Avoid `any`, use `unknown` or proper types

### Performance Standards (NON-NEGOTIABLE)

- Move RTT: <200ms p95
- Word validation: <50ms server-side
- Realtime broadcast: <100ms p95
- Animated components: CSS transforms + keyframes (GPU-accelerated, no Framer Motion)
- Critical paths: Instrumented with `performance.mark()`

### Git Conventions

- Branch naming: `###-feature-name` (e.g., `002-two-player-playtest`)
- Commits: Conventional Commits format
  - `type(scope): subject` (<80 chars, imperative, no trailing period)
  - Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`
  - Body: Optional, explains what/why, wrap at ~72 chars

### Formatting (Prettier enforced)

- Semicolons required
- Double quotes for strings
- Trailing commas always
- Print width: 90 characters
- Tab width: 2 spaces
- Tailwind CSS classes auto-sorted

### Linting

- ESLint: Next.js config + zero warnings policy
- Checks: `.ts`, `.tsx` files
- Max warnings: 0 (CI fails on any warnings)

## Error Handling

**Rate Limiting:**

- Custom `RateLimitExceededError` thrown by `assertWithinRateLimit()`
- Scopes: `auth:login` (5/min per IP), `match:submit-move` (30/min per player)
- API routes add `Retry-After` header on 429

**Validation Errors:**

- `ZodError` caught → meaningful message
- Returned as `MoveResult { status: "rejected", error: "..." }`

**Realtime Failures:**

- Channel error → sets `usePolling: true`
- Graceful degradation, game continues uninterrupted

**Disconnect Handling:**

- Player marked disconnected in match state (realtime broadcast)
- The other player's scoreboard row shows the sub-line `reconnecting · m:ss left` (from `MatchState.disconnectedAt`), then `gone for m:ss`, with their moves outlined. The match clock keeps running (spec 050). Once the viewer has ten moves and the window is spent, a slip over the faded field offers `<name> is gone` (focused) · `the normal rules decide it` · `end the match ▸` (guarded 500ms) · `keep waiting ▸`; `keep waiting` moves the offer to live row line 2 for the rest of the match. A viewer still playing is offered nothing.
- Your own outage (spec 068): two failed safety polls in a row or the browser's `offline` event read `offline · reconnecting` on your row and line 2, with the field locked; the first good poll calls `handlePlayerReconnect` and line 2 holds `back · away m:ss · the clock ran on` for 4s.
- Reconnection within 90s clears the flag; `claimWinAction` (gated on the caller having ten moves) completes the match under the normal rules — the absent player is incomplete and loses. A player who never returns loses at 0:00 for the same reason.
- Detection has two layers: (1) fast path via `disconnectStore` (in-memory, populated by `pagehide`/`sendBeacon`, Realtime `system: CLOSED`, or `onOpponentLeave` presence leave); (2) shared-store safety net via `match_heartbeats` upserted on every `/api/match/[matchId]/state` poll — `loadMatchState` surfaces the stale player after `HEARTBEAT_STALE_MS` (10s) with a grace window for match launch (issue #164).

## Key Entities

- **PlayerIdentity**: User profile and session (players table)
- **LobbyPresence**: Real-time lobby status (lobby_presence table, 5-min TTL)
- **Match**: Game session with the live board, the clock, the receipt counter and resolution cursor, both counts and scores, and its language (matches table)
- **Language rating**: a player's Elo and record in one language (player_ratings table, spec 060)
- **Move**: One player's swap with its receipt sequence, status, per-player sequence, snapshots and delta (match_moves table, spec 050)

## Testing Strategy

This project follows strict TDD principles. All code changes require tests.

**Test Suites:**

- **Unit** (`tests/unit/`) - Domain logic, utilities, components (Vitest)
- **Integration** (`tests/integration/`) - API endpoints, Server Actions (Vitest)
- **Contract** (`tests/contract/`) - OpenAPI-backed REST endpoints
- **E2E** (`tests/integration/ui/`) - Playwright full user flows
- **Performance** (`tests/perf/`) - Artillery load tests for latency SLAs

**CI Pipeline** (`.github/workflows/ci.yml`):

1. Lint → Typecheck → Unit Tests → Integration Tests
2. Quickstart validation
3. Playwright (dual-session E2E)
4. Performance gates (Artillery assertions)

**Test Helpers:**

- Playwright: Retry helpers in `tests/integration/ui/helpers/matchmaking.ts` for race conditions
- Exponential backoff + polling for reliable matchmaking tests

## Environment Variables

Required variables in `.env.local` (auto-populated by `pnpm quickstart`):

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase REST URL (default: `http://localhost:54321`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key for browser
- `SUPABASE_ANON_KEY` - Server-side anon key (matches public)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only key (NEVER expose to client)
- `SUPABASE_DB_PASSWORD` - Postgres password for CLI scripts
- `WOTTLE_SESSION_SECRET` - base64 key (≥32 bytes) that signs the session cookie (spec 067); `pnpm quickstart` generates one, CI sets a test value, Vercel needs its own per environment. Changing it signs everyone out (device keys renew them silently)

Playtest configuration:

- `PLAYTEST_INVITE_EXPIRY_SECONDS` - Invite TTL (default: 30)
- `PLAYTEST_MAX_CONCURRENT_MATCHES` - Concurrent match limit (default: 20)
- `PLAYTEST_SESSION_SECURE` - Force secure cookies (auto true in prod)
- `RATE_LIMIT_DISABLED_SCOPES` - Bypass rate limits (comma-separated, e.g., `auth:login`)
- `NEXT_PUBLIC_DISABLE_REALTIME` - Force the polling transport (read by `useMatchTransport` and the presence store); there are no other feature flags

## Common Workflows

### Example: Full Move Submission Flow

```txt
1. Player taps letter A on the field → reduceField: idle → picked (sound tile-select)
2. Player taps letter B → picked → committed, effect `submit` (the move preview was removed
   2026-09-22: the second letter always plays the move)
3. useFieldInteraction posts /api/match/[matchId]/move → submitMove() Server Action
4. Rate limit check + Zod + session; receive_move RPC stamps global_seq under the match row lock
   (refuses ended / deadline / cap / in_flight without recording); resolvePendingMoves in after()
5. The committer's field: letters exchange in place, frame back to ink, no pick; live row `move 4 · scoring`
6. Resolver claims the move at resolved_seq + 1, refuses `frozen` / `moved` or scores and freezes,
   finishes under CAS, publishes `move-resolved` then `state`
7. Own resolution → bands draw, total counts up, `move 4 scored` holds 600ms → `move 5 · your move`
   (a refusal → `frozen · Kári froze it · pick another` for 2s, count unchanged)
8. The opponent's field: the letters exchange and the bands draw while they pick; a touched pick clears
9. Ledger: your column of row 4 fills; frozen letters take the scorer's seat colour
10. Both counts 10, or 0:00 with the queue drained → settlement → final room state
```

### Adding a New Server Action

1. Create in `/app/actions/<domain>/<action>.ts`
2. Add `"use server"` directive
3. Define explicit return type
4. Validate inputs with Zod schema
5. Add rate limiting via `assertWithinRateLimit(scope)`
6. Write business logic (call `/lib` utilities)
7. Write passing test FIRST (TDD)
8. Add HTTP API route wrapper if needed (`/app/api/...`)

### Adding a New Component

1. Create in `/components/<domain>/<Component>.tsx`
2. Mark as Client Component if needed (`"use client"`)
3. Follow composition patterns (small, focused components)
4. Use shared types from `/lib/types`
5. Add unit test in `tests/unit/components/`
6. Follow Clean Code: <20 lines per function, descriptive names

### Modifying Game Logic

1. Check constitution alignment (server-authoritative, performance SLAs)
2. Update `/lib/game-engine` or `/lib/match` utilities (pure functions)
3. Write failing test FIRST (TDD Red)
4. Implement logic to pass test (TDD Green)
5. Refactor while keeping tests green
6. Run performance tests to validate SLAs
7. Update types in `/lib/types` if needed

## Next Steps (Recommended Priority Order)

### P0 — Legacy Cleanup + Production Readiness

- Drop the legacy `boards` singleton table + its seed/reset/verify wiring.
- Board generation enhancement (seeded words, anti-clustering).
- Sentry error tracking + APM, Vercel production config, Supabase Cloud project setup.
- Re-establish conventional commit discipline (add commitlint hook).
- Next language (spec 060): Danish at `/dk` (`htmlLang: "da"`) — a `LOCALES` entry, `lib/i18n/copy/da.ts`, a language pack (letter weights for `dk`), widen the `language` check constraints, and a native read of the strings. `word_list_dk.txt` and `letter_scoring_values_dk.ts` already exist.
- A larger English word list (the shipped one has ~79k entries and misses some inflections).

## Word Engine Architecture (Spec 003)

> **Authoritative rules reference: [`docs/prd_and_requirements/wottle_game_rules.md`](docs/prd_and_requirements/wottle_game_rules.md).** The summary below is operational; the spec is normative.

The word engine pipeline runs server-side for every resolved move:

```txt
1. Dictionary loads on first use → Set of ~1.16M Icelandic inflected forms (full BÍN, stripped to 3–10 letters: `word_list_3_10_is.txt`)
2. Board Scanner → 4-orthogonal scan from swap coords (both readings per axis) for 3+ letter words
3. Cross-Validator → selectOptimalCombination enumerates subsets; per-letter coverage rule (game_rules §4)
4. Scorer → Per-word: base (letter values) + length bonus (word_length - 2) * 5
5. Combo Bonus → Multi-word bonus per move
6. Repeated words score (spec 050 withdrew duplicate suppression; it was never implemented)
7. Frozen Tiles → Scored word tiles freeze; >=24 unfrozen safeguard (FR-016)
8. Observability → Structured JSON logging of scoring metrics
```

Key files:

- `/lib/game-engine/dictionary.ts` — Set-based dictionary with `DictionaryLoadError`
- `/lib/game-engine/boardScanner.ts` — 8-directional board scanning
- `/lib/game-engine/deltaDetector.ts` — Pre/post swap word diffing
- `/lib/game-engine/scorer.ts` — Letter points, length bonus, combo bonus calculations
- `/lib/game-engine/frozenTiles.ts` — Tile freezing with 24-unfrozen minimum
- `/lib/game-engine/wordEngine.ts` — Orchestrates the full pipeline per move

## Active Technologies
- TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router) + Tailwind CSS 4.x, `next/font/google` (Zilla Slab, Red Hat Mono), Supabase JS v2, Zod, zustand (`roomStore`, `preferencesStore`); dev: `@axe-core/playwright`. No Framer Motion. (044-field-ledger-redesign)
- No schema change — reads existing `word_score_entries.tiles` (order encodes reading direction), `matches`, `match_ratings`; `localStorage` `PlayerPreferences` gains `previewEnabled`. (044-field-ledger-redesign)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router) + Tailwind CSS 4.x (seven-token theme in `tailwind.config.ts`), `next/font/google` (Zilla Slab, Red Hat Mono), zustand (`roomStore`, `preferencesStore`), Supabase JS v2, Zod. No Framer Motion; no new runtime dependency is introduced by this feature. (045-field-ledger-completion)
- Supabase PostgreSQL. One additive migration: `matches.rated boolean not null default true`. No other schema change; the fixture route touches no database at all. (045-field-ledger-completion)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router) + Tailwind CSS 4.x, zustand (`roomStore`), Supabase JS v2, Zod. No new dependency. (048-room-clarity)
- Supabase PostgreSQL. No schema change; `matches.rated` stops being read and written (stays at its default `true`). (048-room-clarity)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router) + Supabase JS v2, Zod, zustand. No new dependency. (049-scored-letter-integrity)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router) + Supabase JS v2 (three security-definer functions: `receive_move`, `claim_next_move`, `finish_move`), Zod, zustand. No new dependency. (050-async-moves)
- Supabase PostgreSQL. **One destructive migration** `20260921001_async_moves.sql`: deletes all matches, resets ratings, adds `match_moves` and the clock/counter columns on `matches`, drops `rounds`, `move_submissions`, `scoreboard_snapshots`, `is_duplicate`. (050-async-moves)
- Supabase PostgreSQL. **No schema change.** No data repair: the loader change renders the affected matches correctly from the rows they have. (049-scored-letter-integrity)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router, `proxy.ts` convention) + Supabase JS v2, Zod, zustand, Tailwind 4. No new dependency; i18n is a typed object per locale plus `Intl.PluralRules` / `Intl.DateTimeFormat`. (060-locales)
- Supabase PostgreSQL. Two additive migrations. `claim_next_move` is recreated to return `language`. (060-locales)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router, `proxy.ts` on the Node runtime) + Supabase JS v2 (RPC), Zod, zustand, Node `crypto` (HMAC, SHA-256, `timingSafeEqual`, `randomBytes`). No new dependency. (067-identity-one-match)
- Supabase PostgreSQL. One additive migration, `20260923001_identity_one_match.sql`: three columns on `players`, two on `matches`, widened status checks, and seven security-definer functions. (067-identity-one-match)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router) + Tailwind CSS 4.x (tokens in `app/globals.css`, `tailwind.config.ts`), zustand (`roomStore`), Supabase JS v2 (Realtime transport, unchanged). No new dependency. (068-match-scoreboard)
- N/A. No schema, migration or API change. (068-match-scoreboard)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router); PL/pgSQL. + Supabase JS v2 (RPC, Realtime), Zod, zustand (`roomStore`), Tailwind 4. Browser APIs: Page Visibility, Screen Wake Lock (feature-detected), `navigator.sendBeacon`, Web Audio (existing `useSoundEffects`). No new dependency. (069-match-table)
- Supabase PostgreSQL. One additive migration, `20260924001_the_table.sql`: 5 columns on `matches`, 6 on `players`, `ended_reason` widened with `'void'`, 5 new functions, 2 changed, 1 dropped. (069-match-table)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router); PL/pgSQL. + Supabase JS v2.108 (RPC; Realtime broadcast with `worker: true`), Zod, zustand, Tailwind 4. Browser APIs: Page Visibility, `navigator.sendBeacon`, the Notification API (feature-detected), Screen Wake Lock (existing `useWakeLock`), Web Audio (existing `playChallenge`). No new dependency. (070-door-lobby)
- Supabase PostgreSQL. One additive migration, `20260925001_door_lobby.sql` (data-model.md). `lobby_presence` stays as the per-player summary. (070-door-lobby)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router); PL/pgSQL. + Supabase JS v2 (RPC; Realtime pokes from spec 070), Zod, zustand (`roomStore`), Tailwind 4. Browser: the History API (`pushState`/`replaceState`, synced by the App Router's `useSearchParams`), Page Visibility (autoplay), existing Web Audio cue, favicon and title hooks. No new dependency. (071-result-rematch-review)
- Supabase PostgreSQL. One additive migration, `20260926001_result_rematch_review.sql`: `presence_tabs.match_id`, `rematch_requests.expires_at`, `ended_reason` widened with `'ended_early'`, 7 new functions, 3 changed (data-model.md). (071-result-rematch-review)

- **Runtime (current)**: Node.js 22 (`.nvmrc`, `engines.node >=22`), pnpm 11.7 (`packageManager`; settings live in `pnpm-workspace.yaml`). Per-spec lines below that say "Node.js 20" are historical.
- TypeScript 5.x, Node.js 20 + Next.js 16 (App Router), Supabase JS v2, Zod (007-server-authoritative-timer)
- Supabase PostgreSQL — `matches`, `rounds`, `move_submissions` (all in place) (007-server-authoritative-timer)
- TypeScript 5.x, React 19+, Next.js 16 (App Router) + Tailwind CSS 4.x, CSS Animations/Transforms (GPU-accelerated, no Framer Motion) (010-word-discovery-highlights)
- N/A — reads existing `RoundSummary` from Supabase Realtime broadcasts; no new persistence (010-word-discovery-highlights)
- N/A — reads existing `word_score_entries`, `scoreboard_snapshots`, `rounds` tables via Supabase; no new tables or columns (012-round-history-and-game-recap)
- TypeScript 5.x, Node.js 20, Next.js 16 (App Router) + Supabase JS v2, Zod, Vitest, Playwrigh (013-scoring-change)
- Supabase PostgreSQL — `matches` (frozen_tiles JSONB), `word_score_entries`, `scoreboard_snapshots` (013-scoring-change)
- N/A — reads existing Supabase tables; no new tables or columns (014-move-playability-improvements)
- TypeScript 5.x / Node.js 20 + Next.js 16 (App Router), React 19+, Supabase JS v2, Web Audio API (browser-native), Vibration API (browser-native) (015-sensory-feedback)
- Browser `localStorage` (sensory preferences only); existing Supabase PostgreSQL (the `rounds.started_at` column already exists — just not populated for round 1) (015-sensory-feedback)
- TypeScript 5.x, Node.js 20, Next.js 16 (App Router) + Supabase JS v2, React 19+, Tailwind CSS 4.x, Zod (016-rematch-post-game-loop)
- Supabase PostgreSQL — new `rematch_requests` table, `matches.rematch_of` column (016-rematch-post-game-loop)
- Supabase PostgreSQL — existing `players` table (modified), new `match_ratings` table (017-elo-rating-player-stats)
- Supabase PostgreSQL — reads existing `players` table (no new tables/columns) (018-match-hud-layout)
- TypeScript 5.x, React 19+, Next.js 16 (App Router) + Tailwind CSS 4.x (theme extension), `next/font/google` (the previous display + body fonts, replaced in spec 044), existing `zustand` presence store, existing `lib/a11y/useFocusTrap.ts` and `lib/a11y/rovingFocus.ts`. No Radix/shadcn/Framer Motion added. (019-lobby-visual-foundation)
- None new. Reads existing `players`, `lobby_presence`, `matches` via already-wired Server Actions and API routes. (019-lobby-visual-foundation)
- TypeScript 5.x, React 19+, Next.js 16 (App Router) + Tailwind CSS 4.x, CSS keyframe animations (GPU-accelerated, no Framer Motion); existing `lib/constants/playerColors.ts`, `deriveHighlightPlayerColors`, `lib/match/partialReveal.ts` (043-scoring-resolution-viz)
- N/A — no new persistence; reads existing match state (`RoundSummary`, `PartialRoundSummary`, `FrozenTileMap`) (043-scoring-resolution-viz)

- TypeScript 5.x, React 19+, Next.js 16 (App Router)
- Tailwind CSS 4.x, CSS Animations/Transforms (GPU-accelerated, no Framer Motion)
- Supabase (Postgres, Realtime, RLS)
- Vitest + Playwright for testing
- pnpm package manager
- YAML (GitHub Actions workflow syntax); TypeScript 5.x / Node.js 20 (project language — unchanged) + `actions/cache@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `supabase/setup-cli@v1`, `pnpm/action-setup@v4`, `actions/setup-node@v4` (004-ci-pipeline-refactor)
- N/A for application data. GitHub ephemeral artifact storage used within runs (`retention-days: 1` for build artifact). `actions/cache@v4` used for pnpm store, Playwright browsers, and Docker image archive across runs. (004-ci-pipeline-refactor)
- TypeScript 5.x, React 19+, Next.js 16 (App Router) + Tailwind CSS 4.x, CSS Animations/Transforms (no Framer Motion needed for this scope) (004-board-ui-animations)
- N/A (reads existing MatchState from Supabase Realtime broadcasts; no new persistence) (004-board-ui-animations)

## Recent Changes

- 050-async-moves (2026-09-21): rules change — ten moves each on one shared 5:00 clock, receipt-ordered resolution, refusal not consumed, moves-first win rule, repeated words score, clock in the ledger caption, moves lane, rows by move. Rules doc §2/§2a/§7/§8/§12, PRD §1.4/§1.6, design system §5.3/§5.4/§7/§8, `/rules`, the consistency grep and this file rewritten; `specs/050-async-moves/` holds the spec, plan, data model and six contracts; design canvas https://claude.ai/artifact/SU3bj2nTT4tEyCiinoEAAB. P1: migration, resolver, settlement, receipt action, the new match state and the room's move beats; P2: the end-to-end suite on moves (`moves-flow`, `deadline-flow`, end early), the live row and baselines, `perf:move-receipt` + `perf:move-resolve`; P3: retired-name greps, the scoring regressions run through `resolveOne` (`tests/helpers/scoreMoves.ts`), the database doc.
- 043-scoring-resolution-viz: Presentation-only round-resolution clarity. New `lib/match/currentRoundScored.ts` builds a persistent "scored THIS round" tile→color map (fed by both the `lastSummary` recap and the spec-042 partial reveal, dedupe-guarded; cleared on round advance) → new `BoardGrid` prop `currentRoundScoredTiles` + `.board-grid__cell--scored-current` ring, distinct from the calmer frozen tint for previous rounds (US1). The waiting state no longer greys out the board: `.board-grid--locked` is now a calm pulsing frame (no `opacity`/`saturate`) + the `showLockBanner={moveLocked}` chip (US2). Own swap lift is transient — reveal-then-fade via `revealFadeTiles` + `.board-grid__cell--swap-fade`; scored swap tiles promote to the current-round mark instead of fading (US3). No new tables/Server Actions; reduced-motion fallbacks for each new visual. New tests: `tests/unit/match/currentRoundScored.spec.ts`, `tests/unit/components/BoardGrid.{scoredCurrent,waitingState,swapReveal}.spec.tsx`, `tests/integration/ui/scoring-resolution-viz.spec.ts`.
- 042-instant-scoring-reveal: Added `instantScoreFirstSubmission` server-side fast path that runs in `submitMove`'s `after()` hook; new `lib/match/instantScoring.ts`, `lib/match/schemas.ts` (Zod), `lib/match/partialReveal.ts` (client helpers), `lib/observability/instantScoring.ts` (3 typed log helpers); `PartialRoundSummary` type added to `MatchState`; `loadMatchState` hydrates `partialSummary` from `word_score_entries` mid-collecting; BoardGrid auto-deselect + aria-live region on freeze (FR-004, FR-005, FR-017). New perf script `pnpm perf:instant-scoring`. No new tables — reuses `word_score_entries`, `matches.frozen_tiles`.
- 004-ci-pipeline-refactor: Added YAML (GitHub Actions workflow syntax); TypeScript 5.x / Node.js 20 (project language — unchanged) + `actions/cache@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `supabase/setup-cli@v1`, `pnpm/action-setup@v4`, `actions/setup-node@v4`
- 005-board-ui-animations: Added TypeScript 5.x, React 19+, Next.js 16 (App Router) + Tailwind CSS 4.x, CSS Animations/Transforms (no Framer Motion needed for this scope)
- 006-match-completion: No new technologies. Server-authoritative clock enforcement via `rounds.started_at` timestamp; timer deduction in existing `matches.player_x_timer_ms` columns; timeout-pass synthesis in `roundEngine.ts`; `FinalSummary` extended with frozen tile count and top-scoring words.
