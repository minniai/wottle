# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wottle is a competitive 2-player real-time word duel built with Next.js, TypeScript, and Supabase. Players swap letters on a 10×10 field to form Icelandic words, each on one match-long clock, with spatial tile-freezing strategy.

**Current State**: The core gameplay loop (swap → find words → score → freeze) is fully functional and well-covered by tests. Twenty-two Speckit specs have shipped. **Field & Ledger shipped (2026-09-14, spec `specs/044-field-ledger-redesign/spec.md`)**: every player-facing screen is one room — two player bars, the field, one ledger — with lobby, queue, found, match, final and profile as states of it; the design system and plan are reached via `docs/design/README.md` (→ `docs/design_documentation/260914-wottle-new-design/`). The previous look (April–June 2026) and every component it used are gone from the tree; its documents live under `docs/archive/`.

## Design (MANDATORY for any UI change)

- The UI follows `docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md` (entry point `docs/design/README.md`). Do not add colours, radii, shadows, gradients, blur or fonts outside it. Seven colour tokens (`--paper`, `--ink`, `--rule`, `--tint`, `--muted`, `--you`, `--opp`); two type families (`--font-board` slab serif, `--font-mono`).
- Every visible element is a letter (or a state of a letter) on the **field**, a fact about one player in that player's **bar**, or a fact about the match in the **ledger**. If a new element is none of these, do not add it.
- Colours are **seat-relative**: `--you` teal, `--opp` coral, always via `getSeatColors(viewerSlot, slot)`. Never map colour to `player_a` / `player_b`.
- **Nothing is ever positioned over the field.** No modals, banners, toasts, overlays or confetti during a match; state changes are written into the bars or the ledger's live row.
- Copy: sentence case, no exclamation marks, one idea per line, mono uppercase for labels, lowercase wordmark `wottle`. Fixed strings in design system §8.
- Motion is a state change, not a performance: durations and easing in design system §6; everything 0ms under `prefers-reduced-motion`.
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
pnpm test:visual             # Visual suite: /dev/room fixtures at 3 viewports, no Supabase
                             # `pnpm test:visual --update-snapshots` is the only way to change a baseline
pnpm lint                    # ESLint with zero-warnings policy
pnpm typecheck               # TypeScript type check
```

### Performance Testing

```bash
pnpm perf:lobby-presence      # Assert lobby broadcast <2s p95
pnpm perf:round-resolution    # Assert round resolution RTT <200ms p95
pnpm perf:swap                # Legacy swap latency (regression baseline)
pnpm perf:instant-scoring     # Assert spec-042 fast-path RTT <200ms p95
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

**Any change to `lib/game-engine/*`, `lib/match/roundEngine.ts`, `lib/match/stateMachine.ts`, `lib/scoring/*`, or `lib/constants/game-config.ts` MUST be checked against `docs/prd_and_requirements/wottle_game_rules.md`.** That document is the authoritative specification of Wottle's rules, the per-letter coverage rule (§4), the scoring formula (§5), the validation algorithm (§7), the board invariants (§8), and the regression log (§10). Scoring bugs are the most frequent class of regression in this codebase and each prior one is documented in §10 — read that table before editing the cross-validator. If the implementation and the spec disagree, update the spec in the same PR as the code change and add a regression test naming the invariant it pins.

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
  - `/app/api` - HTTP API routes (backup endpoints, polling, `POST /api/match/preview`)
  - `/app/(room)` - The **room** route group: `layout.tsx` reads the session once → `RoomShell`; pages `/` (landing = lobby with an empty seat), `/lobby`, `/matchmaking` (queue → found → match in place), `/match/[matchId]` (non-participant guard: live → `/lobby`, completed → read-only)
  - `/app/match/[matchId]/summary` - Redirects into the room (the result is a room state, not a page)
  - `/app/profile` - Own profile + `[handle]` public profile, rendered in the room grid
- `/lib` - Business logic and utilities
  - `/lib/game-engine` - **Board mechanics + Word Engine** (mutations, swaps, dictionary, board scanner, delta detection, scoring, frozen tiles, `readingDirection.ts`, `boardGenerator.ts`)
  - `/lib/match` - **Match orchestration** (round engine, state machine, conflict resolution, `wordScoreRow.ts`, `previewSchemas.ts`)
  - `/lib/room` - **Room state and pure UI logic**: `roomStore.ts` (zustand: phase lobby | queue | found | match | final, viewer, board, match, connection), `fieldInteraction.ts` (idle → picked → preview → committed reducer), `revealSequence.ts` (reveal planner), `ledgerRows.ts`, `bandGeometry.ts`, `clock.ts`, `notices.ts`, `displayBoard.ts`, `useMatchmaking.ts`, `useRematchNegotiation.ts`
  - `/lib/matchmaking` - Lobby presence, invites, player profiles
  - `/lib/scoring` - **Scoring** (roundSummary, highlights) — wired to word engine
  - `/lib/realtime` - Supabase Realtime with polling fallback
  - `/lib/supabase` - Client factories (server vs browser, with safety guards)
  - `/lib/rate-limiting` - Scoped rate limiting middleware
  - `/lib/a11y` - Focus trap, roving focus utilities
  - `/lib/observability` - Structured logging, performance marks
  - `/lib/types` - Shared TypeScript types
  - `/lib/constants` - Board dimensions, `seatColors.ts` (`getSeatColors`, `resolveSeat`), `copy.ts` (fixed strings, design system §8), app constants
- `/docs` - PRD, rules, design entry point (`docs/design/README.md`), archive of superseded material (`docs/archive/`)
  - `/data/wordlists` - Icelandic word list (~3.74M inflected forms, full BÍN fresh (1+ chars), loaded at runtime) + letter scoring values
- `/components` - React Client Components. There are two folders:
  - `/components/room` — the whole player-facing UI (spec 044): `Room` / `RoomShell` (the one grid: bar / field / bar + ledger), `PlayerBar` + `ClockLane` + `NameInput`, `Field` + `FieldCell` + `FieldBands`, `Ledger` + `LedgerFoot` + `LedgerSheet` + `LobbyLedger` + `RoomMenu`, the controllers `LobbyRoomController`, `QueueRoomController`, `MatchRoomController` (+ `MatchRoomView`), and `hooks/` (`useMatchTransport`, `useFieldInteraction`, `useReveal`, `useClockTick`, `useCountUp`, `useNotices`, `useLobbyInvites`, `useAccumulatedRounds`, `useFieldSize`, `useMeasuredLines`, `useNowTick`, `useReducedMotion`)
  - `/components/profile` — `ProfilePage`, `ProfileRatingChart` (same grid and grammar as the room)
- `/app/styles/room.css` — the one stylesheet: room grid, bars and lanes, field cells, bands, ledger, lobby tables, name input, profile classes; keyframes `field-shake`, `band-draw`, `count-up`, `lane-blink`, `lane-search`, `letter-land`, `pin-fade`; one `prefers-reduced-motion` block. Tokens and fonts live in `app/globals.css` / `tailwind.config.ts`.

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

#### 4. Match State Machine (`/lib/match/stateMachine.ts`)

```txt
States: pending → collecting → resolving → completed

Round Flow:
1. Collecting - Players submit moves (move_submissions table)
2. Trigger - Both players submit or timeout → advanceRound()
3. Resolving - Conflict resolution (first-come-first-served by timestamp)
4. Apply moves - Sequential application to board (immutable operations)
5. Word engine - Scan board, detect new words, score, freeze tiles
6. Publish summary - Broadcast round summary (words, scores, frozen tiles) via Realtime
7. Next round - Create new round with updated board OR complete match (10 rounds)
```

#### 5. Game State Management

- Board: `BoardGrid = string[][]` (10x10 grid, immutable updates)
- Clock: one 5:00 budget per player for the whole match (`matches.player_a/b_timer_ms`, default `300_000` in `roundEngine.ts`), 10 rounds (`DEFAULT_GAME_CONFIG.maxRounds`). `timePerRoundMs` in `game-config.ts` is not read by the live clock — do not treat it as a per-round limit.
- Conflict resolution: First submission wins when multiple players target same tile
- Round advancement: `/lib/match/roundEngine.ts` orchestrates the full cycle
- State loading: `/lib/match/stateLoader.ts` for server-side hydration

#### 6. Session & Authentication

- Session cookie: `wottle-playtest-session` (4-hour TTL, httpOnly, Secure in prod)
- Verification: `readLobbySession()` on every protected page
- Login flow: Username (3-24 chars) → player record → presence record → cookie → redirect

#### 7. Frontend Communication

```txt
Room flow (spec 044):
1. app/(room)/layout.tsx reads the session once → RoomShell seeds roomStore.viewer
2. Lobby page → LobbyRoomController: presence store, warm-up field, LobbyLedger, invites polled every 3s
3. play ranked ▸ → /matchmaking → QueueRoomController: placeholder letters land, startQueueAction polled
   every 3s, found → opponent writes into the top bar, real board swapped in, round 1 in 3·2·1,
   then MatchRoomController renders in place (URL via history.replaceState)
4. Match page → MatchRoomController: useMatchTransport (Realtime + 2s safety poll + polling fallback)
   → roomStore.applySnapshot / applySummary; useFieldInteraction posts moves; useReveal draws bands
5. Disconnect → opponent bar counts `reconnecting · m:ss left` from MatchState.disconnectedAt; both
   lanes hold; after the window the ledger offers `claim the win ▸` (claimWinAction)
6. state = completed → final phase in the same room: verdict block, rating lines from
   getMatchRatings, rematch negotiation as ledger lines, actions rematch ▸ · new opponent ▸ · lobby
```

### Core Types & Validation

All types defined in `/lib/types/` with Zod schemas for runtime validation:

- `Board`: Coordinate, BoardGrid, MoveRequest, MoveResult, Direction, BoardWord, ScanResult
- `Match`: PlayerIdentity, MatchState, RoundSummary, MatchPhase, SubmissionRecord, FrozenTile, FrozenTileMap, WordScoreBreakdown, RoundScoreResult
- `Matchmaking`: LobbyPresence, InvitationRecord, LobbyStatus

Validation happens at Server Action entry points with clear error messages.

### Database Interaction

All access through Supabase client with pattern:

```typescript
const { data, error } = await supabase.from("table").select("*").single(); // or .maybeSingle() or .limit(1)
```

Common operations: `upsert()`, `select()`, `update()`, `insert()`, `delete()`

RLS policies enforced on all tables: players, lobby_presence, matches, rounds, move_submissions, word_scores, match_logs

## Project Status & Known Issues

### Current Test Health

- **134 unit/contract test files, 972 tests passing** (2 intentionally skipped), zero failures (measured 2026-09-14 on `044-field-ledger-redesign` after the retired-component sweep).
- CI splits Playwright by tag: the one spec tagged `@two-player-playtest` (`rounds-flow`, a whole ten-round match) runs on the `playtest-firefox` project with `--workers=1`; every other room spec runs on `chromium`. On failure the job uploads `playwright-results-<suite>` (traces + `error-context.md` page snapshots). Locally, run two-player spec files one at a time to avoid Realtime contention; sign in through `loginViaBar` (`tests/integration/ui/helpers/matchmaking.ts`).
- Lint (zero-warnings policy), typecheck and `pnpm docs:check` pass cleanly.

### Implementation Status by Area

| Area             | Status     | Notes                                                                            |
| ---------------- | ---------- | -------------------------------------------------------------------------------- |
| Auth & Lobby     | Complete   | Login, presence + 60s heartbeat, realtime + polling fallback                     |
| Matchmaking      | Complete   | Direct invites, auto-queue, match bootstrap                                      |
| Round Engine     | Complete   | State machine, conflict resolution, 10-round cycle                               |
| Realtime         | Complete   | WebSocket channels + HTTP polling fallback                                       |
| Reconnection     | Complete   | 90s window counted down in the opponent's bar; `claim the win ▸` ledger line     |
| Rate Limiting    | Complete   | 5/min auth, 30/min moves, 1/min claim-win, 429 responses                         |
| Accessibility    | Complete   | Focus traps, aria-live, keyboard nav, 44×44 touch targets, WCAG 2.1 AA axe clean |
| Observability    | Complete   | Structured logs, perf marks, analytics hooks                                     |
| Word Finding     | Complete   | Set-based dictionary (3.74M entries), four-direction scanner, delta detection    |
| Scoring          | Complete   | PRD-compliant formula, length bonus, combo bonuses, unique word tracking         |
| Frozen Tiles     | Complete   | Freeze tracking, swap validation, visual overlay, >=24 unfrozen safeguard        |
| Field Motion     | Complete   | Pins, band draw + count-up reveal, in-colour shake, lane blink; 0ms reduced-motion |
| Server Timer     | Complete   | `rounds.started_at`-based enforcement, timeout-pass synthesis (spec 007)         |
| Elo + Ratings    | Complete   | `match_ratings` written on match end, ±N rating deltas in post-game (spec 017)   |
| Rematch          | Complete   | `rematch_requests` table, 30s invite TTL, series tracking (spec 016)             |
| Theme (visual)   | Complete   | Field & Ledger (spec 044): seven tokens, two type families, one room; see Design |

### Remaining Gaps

1. **Legacy `boards` table** — singleton board from the original prototype (`supabase/migrations/20251105001_init.sql`) still exists in the schema and is seeded by `scripts/supabase/seed.ts`; no runtime code reads it anymore. A follow-up migration can drop the table + its seed/reset/verify wiring.

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
- The other player's bar shows the sub-line `reconnecting · m:ss left` (from `MatchState.disconnectedAt`), a dashed lane, and both clocks hold; after the window the ledger offers `<name> is gone · claim the win ▸` (`notice-claim-win`). Nothing is drawn over the field.
- Reconnection within 90s clears the flag; past 90s `claimWinAction` or the auto-finalise awards the non-disconnected player (forced-winner path on `completeMatchInternal`)
- Detection has two layers: (1) fast path via `disconnectStore` (in-memory, populated by `pagehide`/`sendBeacon`, Realtime `system: CLOSED`, or `onOpponentLeave` presence leave); (2) shared-store safety net via `match_heartbeats` upserted on every `/api/match/[matchId]/state` poll — `loadMatchState` surfaces the stale player after `HEARTBEAT_STALE_MS` (10s) with a grace window for match launch (issue #164).

## Key Entities

- **PlayerIdentity**: User profile and session (players table)
- **LobbyPresence**: Real-time lobby status (lobby_presence table, 5-min TTL)
- **Match**: Game session with board seed and rounds (matches table)
- **Round**: Round state with submissions and resolution (rounds table)
- **MoveSubmission**: Player's move for a round (move_submissions table)

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
2. Player taps letter B → default: picked → committed, effect `submit`
   (with the preview setting on: picked → preview, effect `requestPrice` → previewSwap Server Action,
    read-only; a third tap or Enter commits)
3. useFieldInteraction posts /api/match/[matchId]/move → submitMove() Server Action
4. Rate limit check + session validation; insert move_submission; publishMatchState in after()
5. Both boards: the committer's two letters pin (dashed ring, seat colour); the opponent's
   field pins them in coral from `MatchState.pendingMoves`
6. Trigger async advanceRound(matchId) when both players submitted
7. Backend resolves conflicts (FCFS by timestamp), applies swaps, scores, freezes
8. Backend publishes state + round-summary via Realtime; useMatchTransport → roomStore
9. Ledger row for the round fills with both seats' words; frozen letters take the scorer's seat colour
10. Round advances → field back to idle; if game over → final room state
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

## Word Engine Architecture (Spec 003)

> **Authoritative rules reference: [`docs/prd_and_requirements/wottle_game_rules.md`](docs/prd_and_requirements/wottle_game_rules.md).** The summary below is operational; the spec is normative.

The word engine pipeline runs server-side during round resolution:

```txt
1. Dictionary loads on first use → Set of ~3.74M Icelandic inflected forms (full BÍN fresh, 1+ chars)
2. Board Scanner → 4-orthogonal scan from swap coords (both readings per axis) for 3+ letter words
3. Cross-Validator → selectOptimalCombination enumerates subsets; per-letter coverage rule (game_rules §4)
4. Scorer → Per-word: base (letter values) + length bonus (word_length - 2) * 5
5. Combo Bonus → Multi-word bonus per player per round
6. Unique Word Tracking → Duplicate words (same player, prior rounds) score 0
7. Frozen Tiles → Scored word tiles freeze; >=24 unfrozen safeguard (FR-016)
8. Observability → Structured JSON logging of scoring metrics
```

Key files:

- `/lib/game-engine/dictionary.ts` — Set-based dictionary with `DictionaryLoadError`
- `/lib/game-engine/boardScanner.ts` — 8-directional board scanning
- `/lib/game-engine/deltaDetector.ts` — Pre/post swap word diffing
- `/lib/game-engine/scorer.ts` — Letter points, length bonus, combo bonus calculations
- `/lib/game-engine/frozenTiles.ts` — Tile freezing with 24-unfrozen minimum
- `/lib/game-engine/wordEngine.ts` — Orchestrates the full pipeline per round

## Active Technologies
- TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router) + Tailwind CSS 4.x, `next/font/google` (Zilla Slab, Red Hat Mono), Supabase JS v2, Zod, zustand (`roomStore`, `preferencesStore`); dev: `@axe-core/playwright`. No Framer Motion. (044-field-ledger-redesign)
- No schema change — reads existing `word_score_entries.tiles` (order encodes reading direction), `matches`, `match_ratings`; `localStorage` `PlayerPreferences` gains `previewEnabled`. (044-field-ledger-redesign)
- TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router) + Tailwind CSS 4.x (seven-token theme in `tailwind.config.ts`), `next/font/google` (Zilla Slab, Red Hat Mono), zustand (`roomStore`, `preferencesStore`), Supabase JS v2, Zod. No Framer Motion; no new runtime dependency is introduced by this feature. (045-field-ledger-completion)
- Supabase PostgreSQL. One additive migration: `matches.rated boolean not null default true`. No other schema change; the fixture route touches no database at all. (045-field-ledger-completion)

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

- 043-scoring-resolution-viz: Presentation-only round-resolution clarity. New `lib/match/currentRoundScored.ts` builds a persistent "scored THIS round" tile→color map (fed by both the `lastSummary` recap and the spec-042 partial reveal, dedupe-guarded; cleared on round advance) → new `BoardGrid` prop `currentRoundScoredTiles` + `.board-grid__cell--scored-current` ring, distinct from the calmer frozen tint for previous rounds (US1). The waiting state no longer greys out the board: `.board-grid--locked` is now a calm pulsing frame (no `opacity`/`saturate`) + the `showLockBanner={moveLocked}` chip (US2). Own swap lift is transient — reveal-then-fade via `revealFadeTiles` + `.board-grid__cell--swap-fade`; scored swap tiles promote to the current-round mark instead of fading (US3). No new tables/Server Actions; reduced-motion fallbacks for each new visual. New tests: `tests/unit/match/currentRoundScored.spec.ts`, `tests/unit/components/BoardGrid.{scoredCurrent,waitingState,swapReveal}.spec.tsx`, `tests/integration/ui/scoring-resolution-viz.spec.ts`.
- 042-instant-scoring-reveal: Added `instantScoreFirstSubmission` server-side fast path that runs in `submitMove`'s `after()` hook; new `lib/match/instantScoring.ts`, `lib/match/schemas.ts` (Zod), `lib/match/partialReveal.ts` (client helpers), `lib/observability/instantScoring.ts` (3 typed log helpers); `PartialRoundSummary` type added to `MatchState`; `loadMatchState` hydrates `partialSummary` from `word_score_entries` mid-collecting; BoardGrid auto-deselect + aria-live region on freeze (FR-004, FR-005, FR-017). New perf script `pnpm perf:instant-scoring`. No new tables — reuses `word_score_entries`, `matches.frozen_tiles`.
- 004-ci-pipeline-refactor: Added YAML (GitHub Actions workflow syntax); TypeScript 5.x / Node.js 20 (project language — unchanged) + `actions/cache@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `supabase/setup-cli@v1`, `pnpm/action-setup@v4`, `actions/setup-node@v4`
- 005-board-ui-animations: Added TypeScript 5.x, React 19+, Next.js 16 (App Router) + Tailwind CSS 4.x, CSS Animations/Transforms (no Framer Motion needed for this scope)
- 006-match-completion: No new technologies. Server-authoritative clock enforcement via `rounds.started_at` timestamp; timer deduction in existing `matches.player_x_timer_ms` columns; timeout-pass synthesis in `roundEngine.ts`; `FinalSummary` extended with frozen tile count and top-scoring words.

<!-- OPENWIKI:START -->

## OpenWiki

See [AGENTS.md](AGENTS.md) for OpenWiki agent instructions.

<!-- OPENWIKI:END -->
