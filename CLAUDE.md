# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wottle is a local-first board game prototype built with Next.js, TypeScript, and Supabase. Currently focused on the two-player playtest milestone (`002-two-player-playtest`) enabling login, matchmaking, and 10-round gameplay.

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

**Active Spec**: `specs/002-two-player-playtest/` (In Progress - Phase 5: Submit Rounds & Resolve Moves)

## Architecture

### Directory Structure

**Critical Directories:**

- `/app` - Next.js App Router
  - `/app/actions/*.ts` - **Server Actions** (primary frontend→backend interface)
  - `/app/api` - HTTP API routes (backup endpoints, polling)
  - `/app/(lobby)` - Lobby page
  - `/app/match/[matchId]` - Match page with dynamic routing
- `/lib` - Business logic and utilities
  - `/lib/game-engine` - **Board mechanics** (mutations, swaps, validation)
  - `/lib/match` - **Match orchestration** (round engine, state machine, conflict resolution)
  - `/lib/matchmaking` - Lobby presence, invites, player profiles
  - `/lib/realtime` - Supabase Realtime with polling fallback
  - `/lib/supabase` - Client factories (server vs browser, with safety guards)
  - `/lib/types` - Shared TypeScript types
- `/components` - React Client Components
  - `/components/game` - Board, BoardGrid, TimerHud
  - `/components/match` - MatchClient, RoundSummaryPanel
  - `/components/lobby` - LobbyList, LobbyLoginForm, MatchmakerControls

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
5. Publish summary - Broadcast round summary via Realtime
6. Next round - Create new round with updated board OR complete match (10 rounds)
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

- `Board`: Coordinate, BoardGrid, MoveRequest, MoveResult
- `Match`: PlayerIdentity, MatchState, RoundSummary, MatchPhase, SubmissionRecord
- `Matchmaking`: LobbyPresence, InvitationRecord, LobbyStatus

Validation happens at Server Action entry points with clear error messages.

### Database Interaction

All access through Supabase client with pattern:

```typescript
const { data, error } = await supabase.from("table").select("*").single(); // or .maybeSingle() or .limit(1)
```

Common operations: `upsert()`, `select()`, `update()`, `insert()`, `delete()`

RLS policies enforced on all tables: players, lobby_presence, matches, rounds, move_submissions, word_scores, match_logs

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
- Animated components: Use Framer Motion or CSS transforms (GPU-accelerated)
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
