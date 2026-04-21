# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wottle is a competitive 2-player real-time word duel built with Next.js, TypeScript, and Supabase. Players swap tiles on a 10x10 board to form Icelandic words, with chess-clock tension and spatial tile-freezing strategy.

**Current State**: The core gameplay loop (swap → find words → score → freeze) is fully functional and well-covered by tests. Nineteen Speckit specs have shipped, and the Warm Editorial visual redesign is in progress: Phases 1a–3 of the design proposal (theme flip, match surfaces, HUD classic, left-rail cards, post-game redesign, lobby finish) have shipped or are in open PRs. See `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` for the redesign master plan and `docs/superpowers/plans/` for the per-phase implementation plans.

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
pnpm lint                    # ESLint with zero-warnings policy
pnpm typecheck               # TypeScript type check
```

### Performance Testing

```bash
pnpm perf:lobby-presence      # Assert lobby broadcast <2s p95
pnpm perf:round-resolution    # Assert round resolution RTT <200ms p95
pnpm perf:swap                # Legacy swap latency (regression baseline)
```

### Supabase Operations

```bash
pnpm supabase:migrate         # Apply pending migrations
pnpm supabase:seed            # Seed test data
pnpm supabase:reset           # Drop data, reapply migrations
pnpm supabase:verify          # Check schema, RLS, observability hooks
pnpm supabase:policies        # Verify RLS policy coverage
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
- `019-lobby-visual-foundation` — Warm Editorial lobby (Fraunces/Inter, ui primitives, hero, stats strip, PlayNowCard, LobbyDirectory, InviteDialog, skeleton/empty states)

**Warm Editorial Redesign** — visual reimagining of the entire app per the Claude Design prototype. Design doc: `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md`. Per-phase plans in `docs/superpowers/plans/`.

| Phase | Scope | Status |
|---|---|---|
| 1a | OKLCH theme flip (light mode) + TopBar + JetBrains Mono | Merged |
| 1b | Match surfaces — letterpress tiles, A–J/1–10 coord labels, `RoundPipBar`, `TilesClaimedCard` | Merged |
| 1c | HUD classic refresh — `.hud-card`, `MatchCenterChrome`, top-strip + board-row grid | Merged |
| 1d | Left-rail cards — `HowToPlayCard`, `LegendCard`, `YourMoveCard`, `MatchLeftRail` | Merged |
| 2 | Post-game redesign — `PostGameVerdict`, `PostGameScoreboard`, `RoundByRoundChart`, `WordsOfMatch` | Merged |
| 3 | Lobby finish — `RecentGamesCard`, `TopOfBoardCard`, `EmptyLobbyState`, `InviteToast` + Server Actions | Merged |
| 4a | Landing screen — dedicated `/` route, `LandingScreen` + `LandingTileVignette`, lobby login form removed | Merged |
| 4b | Matchmaking screen — dedicated `/matchmaking` route, ring + found/starting phases | In progress |
| 5 | Profile (modal + `/profile` page) + rating history | Planned |
| 6 | Disconnection modal + claim-win Server Action | Planned |

## Architecture

### Directory Structure

**Critical Directories:**

- `/app` - Next.js App Router
  - `/app/actions/*.ts` - **Server Actions** (primary frontend→backend interface)
  - `/app/api` - HTTP API routes (backup endpoints, polling)
  - `/app/(landing)` - Landing page (unauthenticated `/`)
  - `/app/(lobby)` - Lobby page (`/lobby`)
  - `/app/matchmaking` - Matchmaking screen (searching / found / starting phases)
  - `/app/match/[matchId]` - Match page with dynamic routing
- `/lib` - Business logic and utilities
  - `/lib/game-engine` - **Board mechanics + Word Engine** (mutations, swaps, dictionary, board scanner, delta detection, scoring, frozen tiles)
  - `/lib/match` - **Match orchestration** (round engine, state machine, conflict resolution)
  - `/lib/matchmaking` - Lobby presence, invites, player profiles
  - `/lib/scoring` - **Scoring** (roundSummary, highlights) — wired to word engine
  - `/lib/realtime` - Supabase Realtime with polling fallback
  - `/lib/supabase` - Client factories (server vs browser, with safety guards)
  - `/lib/rate-limiting` - Scoped rate limiting middleware
  - `/lib/a11y` - Focus trap, roving focus utilities
  - `/lib/observability` - Structured logging, performance marks
  - `/lib/types` - Shared TypeScript types
  - `/lib/constants` - Board dimensions, feature flags, app constants
- `/docs` - PRD, analysis, wordlists
  - `/data/wordlists` - Icelandic word list (~3.74M inflected forms, full BÍN fresh (1+ chars), loaded at runtime) + letter scoring values
- `/components` - React Client Components
  - `/components/game` — `Board`, `BoardGrid`, `BoardCoordLabels`, `MoveFeedback`, `TimerHud`, `usePinchZoom`
  - `/components/match` — core match client (`MatchClient`, `MatchShell`), HUD (`HudCard`, `MatchCenterChrome`, `RoundPipBar`), panels (`PlayerPanel`, `PlayerAvatar`, `TimerDisplay`, `TilesClaimedCard`), left rail (`MatchLeftRail`, `HowToPlayCard`, `LegendCard`, `YourMoveCard`), round recap (`RoundSummaryPanel`, `RoundHistoryPanel`, `RoundHistoryInline`, `ScoreDeltaPopup`, `WordHighlightOverlay`), post-game (`FinalSummary`, `PostGameVerdict`, `PostGameScoreboard`, `RoundByRoundChart`, `WordsOfMatch`), rematch (`RematchBanner`, `RematchInterstitial`, `useRematchNegotiation`)
  - `/components/lobby` — `LobbyHero`, `LobbyList`, `LobbyDirectory`, `LobbyCard`, `LobbyStatsStrip`, `PlayNowCard`, `InviteDialog`, `InviteToast`, `RecentGamesCard`, `TopOfBoardCard`, `EmptyLobbyState` *(`InviteToast`, `RecentGamesCard`, `TopOfBoardCard`, `EmptyLobbyState` ship with Phase 3 / PR #115)*
  - `/components/landing` — `LandingScreen`, `LandingTileVignette` *(Phase 4a)*
  - `/components/matchmaking` — `MatchmakingClient`, `MatchRing`, `MatchmakingVsBlock` *(Phase 4b)*
  - `/components/ui` — shared primitives: `Avatar`, `Badge`, `Button`, `Card`, `Dialog`, `GearMenu`, `SettingsPanel`, `Skeleton`, `Toast`, `ToastProvider`, `TopBar`
  - `/components/player` — `PlayerProfileModal` (lobby → player drill-in)
- `/app/styles` — Board + lobby CSS (GPU-accelerated animations, letterpress tiles, `.hud-card`, `.match-layout__hud-strip` / `--board-row` / `--rail--left|right`, ambient lobby background)

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
- Conflict resolution: First submission wins when multiple players target same tile
- Round advancement: `/lib/match/roundEngine.ts` orchestrates the full cycle
- State loading: `/lib/match/stateLoader.ts` for server-side hydration

#### 6. Session & Authentication

- Session cookie: `wottle-playtest-session` (4-hour TTL, httpOnly, Secure in prod)
- Verification: `readLobbySession()` on every protected page
- Login flow: Username (3-24 chars) → player record → presence record → cookie → redirect

#### 7. Frontend Communication

```txt
MatchClient Flow:
1. Server Component loads initial state → loadMatchState()
2. Client hydrates → Subscribe to Realtime match channel
3. State updates → Broadcast or polling
4. Move submission → POST /api/match/[matchId]/move → submitMove() Server Action
5. Feedback → MoveFeedback component
6. Disconnect → Fallback to polling, mark player disconnected
7. Game end → Navigate to summary
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

- **118 test files passing on `main`**, **818 tests passing** (2 intentionally skipped), zero failures.
- CI runs the two-player Playwright specs (`hud-classic`, `left-rail`, `match-surfaces`, `postgame`, `lobby-finish`) in serial mode + `retries: 1` to avoid Realtime contention.
- Lint (zero-warnings policy) and typecheck both pass cleanly.

### Implementation Status by Area

| Area              | Status      | Notes                                                                           |
| ----------------- | ----------- | ------------------------------------------------------------------------------- |
| Auth & Lobby      | Complete    | Login, presence + 60s heartbeat, realtime + polling fallback                    |
| Matchmaking       | Complete    | Direct invites, auto-queue, match bootstrap                                     |
| Round Engine      | Complete    | State machine, conflict resolution, 10-round cycle                              |
| Realtime          | Complete    | WebSocket channels + HTTP polling fallback                                      |
| Reconnection      | Complete    | 10s window, timer pause, state restoration                                      |
| Rate Limiting     | Complete    | 5/min auth, 30/min moves, 429 responses                                         |
| Accessibility     | Complete    | Focus traps, aria-live, keyboard nav, 44×44 touch targets, WCAG 2.1 AA axe clean |
| Observability     | Complete    | Structured logs, perf marks, analytics hooks                                    |
| Word Finding      | Complete    | Set-based dictionary (3.74M entries), 8-directional scanner, delta detection    |
| Scoring           | Complete    | PRD-compliant formula, length bonus, combo bonuses, unique word tracking        |
| Frozen Tiles      | Complete    | Freeze tracking, swap validation, visual overlay, >=24 unfrozen safeguard       |
| Board Animations  | Complete    | Tile-swap FLIP, scored-tile glow, invalid-move shake, round-recap sequence      |
| Server Timer      | Complete    | `rounds.started_at`-based enforcement, timeout-pass synthesis (spec 007)        |
| Elo + Ratings     | Complete    | `match_ratings` written on match end, ±N rating deltas in post-game (spec 017)  |
| Rematch           | Complete    | `rematch_requests` table, 30s invite TTL, series tracking (spec 016)            |
| Theme (visual)    | Phase 1–3   | OKLCH light-mode, HUD classic, post-game redesign, lobby cards (PR #115)        |

### Remaining Gaps

1. **Warm Editorial Phase 4** — dedicated Landing (`/`) + Matchmaking (`/matchmaking`) screens; routing change to pull the login form off `/lobby`.
2. **Warm Editorial Phase 5** — player Profile modal and full `/profile` page with rating-history chart, word cloud, match history.
3. **Warm Editorial Phase 6** — centered disconnection modal with 90s countdown + `claimWin` Server Action (currently just a text banner).
4. **Legacy Endpoints** — `api/board`, `api/swap`, `actions/getBoard.ts`, `actions/swapTiles.ts` remain from early prototyping and should be removed in a cleanup pass.
5. **Unused `PlayerPanel` full variant** — Phase 1c stopped mounting it on desktop; the code path still powers `RoundHistoryInline` surfaces. Audit and delete once verified unused.

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

- Player marked disconnected in match state
- Other player sees banner
- Reconnection clears flag

## Key Entities

- **PlayerIdentity**: User profile and session (players table)
- **LobbyPresence**: Real-time lobby status (lobby_presence table, 5-min TTL)
- **Match**: Game session with board seed and rounds (matches table)
- **Round**: Round state with submissions and resolution (rounds table)
- **MoveSubmission**: Player's move for a round (move_submissions table)

## Feature Flags

Located in `/lib/constants/featureFlags.ts`:

- `NEXT_PUBLIC_ENABLE_PLAYTEST_LOBBY` - Show lobby UI
- `NEXT_PUBLIC_ENABLE_PLAYTEST_MATCH` - Show match UI
- `NEXT_PUBLIC_DISABLE_REALTIME` - Force polling mode

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

## Common Workflows

### Example: Full Move Submission Flow

```txt
1. User clicks tile pair on board
2. BoardGrid.onSwapComplete fires
3. submitMove(matchId, fromX, fromY, toX, toY) [Server Action]
4. Rate limit check + session validation
5. Insert move_submission record
6. Trigger async advanceRound(matchId) if both players submitted
7. Backend resolves conflicts (FCFS by timestamp)
8. Backend applies moves to board (immutable operations)
9. Backend publishes state via Realtime broadcast
10. MatchClient receives onState callback
11. Update board display, round number, timer
12. If round complete → Display RoundSummaryPanel
13. If game over → Navigate to /match/[matchId]/summary
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

### P0 — Warm Editorial Phase 4: Landing + Matchmaking screens

Dedicated `/` landing (username form → `/lobby`) and `/matchmaking` (ring spinner, rating-window expansion, found / starting states). Requires minor routing changes to pull the login form off `/lobby`.

### P1 — Warm Editorial Phase 5: Profile modal + `/profile` page

- `PlayerProfileDialog` opens from `LobbyDirectory` card clicks; shows sparkline + form chips + Challenge CTA.
- `/profile` full page with sidebar, stats grid, SVG rating chart, word cloud, match history.
- New Server Action `getPlayerProfile(handle)` aggregating stats + rating history (start derived from `match_ratings`; migrate to dedicated `rating_history` table only if the derivation gets expensive).

### P2 — Warm Editorial Phase 6: Disconnection modal + claim-win

- Replace the current text banner with a centered modal (pulse indicator, 90s countdown, Keep-waiting / Claim-win buttons).
- New Server Action `claimWin(matchId)` — forfeits the opponent once `last_seen_at ≥ 90s`, awards the caller the truncated-score win, broadcasts match-completed via Realtime.

### P3 — Legacy Cleanup + Production Readiness

- Remove legacy endpoints: `api/board`, `api/swap`, `actions/getBoard.ts`, `actions/swapTiles.ts`.
- Audit + delete the unused `PlayerPanel` full variant once `RoundHistoryInline` is confirmed not to need it.
- Board generation enhancement (seeded words, anti-clustering).
- Production config (`next.config.ts` security headers, `.nvmrc`, `engines` field).
- Sentry error tracking + APM, Vercel production config, Supabase Cloud project setup.
- Re-establish conventional commit discipline (add commitlint hook).

## Word Engine Architecture (Spec 003)

The word engine pipeline runs server-side during round resolution:

```txt
1. Dictionary loads on first use → Set of ~3.74M Icelandic inflected forms (full BÍN fresh, 1+ chars)
2. Board Scanner → 8-directional scan (H, V, 4 diagonals) for 3+ letter words
3. Delta Detector → Compares pre-swap vs post-swap boards to find newly formed words
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
- TypeScript 5.x, React 19+, Next.js 16 (App Router) + Tailwind CSS 4.x (theme extension), `next/font/google` (Fraunces variable + existing Inter), existing `zustand` presence store, existing `lib/a11y/useFocusTrap.ts` and `lib/a11y/rovingFocus.ts`. No Radix/shadcn/Framer Motion added. (019-lobby-visual-foundation)
- None new. Reads existing `players`, `lobby_presence`, `matches` via already-wired Server Actions and API routes. (019-lobby-visual-foundation)

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
- 004-ci-pipeline-refactor: Added YAML (GitHub Actions workflow syntax); TypeScript 5.x / Node.js 20 (project language — unchanged) + `actions/cache@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `supabase/setup-cli@v1`, `pnpm/action-setup@v4`, `actions/setup-node@v4`
- 005-board-ui-animations: Added TypeScript 5.x, React 19+, Next.js 16 (App Router) + Tailwind CSS 4.x, CSS Animations/Transforms (no Framer Motion needed for this scope)
- 006-match-completion: No new technologies. Server-authoritative clock enforcement via `rounds.started_at` timestamp; timer deduction in existing `matches.player_x_timer_ms` columns; timeout-pass synthesis in `roundEngine.ts`; `FinalSummary` extended with frozen tile count and top-scoring words.
