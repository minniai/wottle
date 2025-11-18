# Wottle Constitution

<!-- Sync Impact Report:
  Version: 1.3.0 → 1.4.0 (MINOR: new principle added)
  Created: 2025-01-08
  Last Amended: 2025-11-05

  Principles Added (v1.0.0):
  - I. Server-Authoritative Game Logic (NON-NEGOTIABLE)
  - II. Real-Time Performance Standards
  - III. Type-Safe End-to-End
  - IV. Progressive Enhancement & Mobile-First
  - V. Observability & Resilience

  Principles Added (v1.1.0):
  - VI. Clean Code Principles (Uncle Bob)

  Principles Added (v1.2.0):
  - VII. Test Driven Development (TDD) (NON-NEGOTIABLE)

  Principles Added (v1.3.0):
  - VIII. External Context Providers (Context7)

  Principles Added (v1.4.0):
  - IX. Commit Message Standards

  Sections Added:
  - Technology Stack Standards
  - Code Organization & Patterns
  - Development Workflow

  Templates Requiring Updates:
  - ✅ updated: .specify/templates/plan-template.md - added Constitution Check for external context providers
  - ✅ updated: .specify/templates/spec-template.md - no changes required
  - ✅ updated: .specify/templates/tasks-template.md - no changes required
  - ✅ reviewed: commit message guidance requires no template changes (covered under Development Workflow)
-->

## Core Principles

### I. Server-Authoritative Game Logic (NON-NEGOTIABLE)

All game state mutations MUST execute server-side; clients are view layers only.

- Move validation, scoring calculations, and board state updates execute via Server Actions
- Client-side state is optimistic only; server broadcasts definitive state
- Clock management and turn order enforced server-side with database transactions
- Word validation against dictionary occurs server-side; dictionary never exposed to client
- Anti-cheating measures: Move sequence numbers, rate limiting, server clock authority

**Rationale**: Real-time competitive integrity requires server validation to prevent client manipulation of scores, timing, and move order.

### II. Real-Time Performance Standards (NON-NEGOTIABLE)

Performance targets from PRD are strict SLAs, not suggestions.

- Move RTT (client → server → client): MUST be <200ms at p95 latency
- Word validation: MUST complete in <50ms (measured server-side)
- Board generation: MUST complete in <200ms
- Realtime broadcast latency: MUST be <100ms between players
- Frontend animations: MUST maintain 60 FPS for tile swaps and word highlights

**Violations**: Performance degradation above SLA thresholds MUST trigger performance optimization work or architectural changes before feature deployment.

**Rationale**: Chess-clock gameplay requires sub-second responsiveness; delays break player experience and fairness.

### III. Type-Safe End-to-End

Server Actions provide compile-time guarantees from server to client.

- All Server Actions MUST have explicit TypeScript return types (`Promise<ReturnType>`)
- Shared types defined in `/lib/types/` for server-client consistency
- Zod schemas validate all Server Action inputs
- Client code uses Server Actions directly (no manual fetch calls or JSON parsing)
- Compiler errors when Server Action signatures change prevent runtime mismatches

**Rationale**: End-to-end type safety catches integration errors at build time, reduces bugs, improves DX.

### IV. Progressive Enhancement & Mobile-First

Game MUST be playable on all screen sizes with graceful degradation.

- Primary interaction: Touch-first swap controls (44×44px minimum targets)
- Desktop: Keyboard shortcuts and mouse drag-and-drop as enhancements
- Board responsiveness: Scrollable container with pinch-to-zoom (50–150%)
- Realtime fallback: Polling when WebSocket fails (2s intervals)
- Offline detection: Show connection status; queue moves if temporarily offline

**Rationale**: Accessibility and reach require mobile-optimized UX; desktop features are additive, not required.

### V. Observability & Resilience

Production debugging requires structured logging and error capture.

- Structured logs: JSON format with context (matchId, playerId, validationTime)
- Error tracking: Sentry integration with performance monitoring (10% trace sampling)
- Reconnection handling: ≤10 second window with server-side pause state
- Graceful degradation: Game continues with reduced features when non-critical services fail
- Performance marks: Critical paths instrumented with `performance.mark()` for profiling

**Rationale**: Real-time games need observability to debug latency spikes and rare race conditions in production.

### VI. Clean Code Principles (Uncle Bob)

All code MUST follow Clean Code principles for maintainability and readability.

**Function Design**:

- Functions MUST be small and do one thing well (Single Responsibility Principle)
- Function names MUST be verbs that clearly describe what the function does
- Functions MUST have minimal parameters (ideally ≤3; use objects for more)
- Boolean parameters MUST be avoided (split into separate functions instead)
- Functions MUST either do something or answer something, but not both (Command-Query Separation)

**Naming Conventions**:

- Names MUST be descriptive and reveal intent; avoid abbreviations and magic numbers
- Classes and modules MUST be nouns; methods MUST be verbs
- Constants MUST be defined for all magic numbers and strings
- Variable names MUST be pronounceable and searchable
- Names MUST use domain vocabulary from the problem space (game engine terms, not generic CS terms)

**Code Structure**:

- Code MUST follow the DRY principle (Don't Repeat Yourself)
- Code MUST be organized by feature/domain, not by technical layers
- Dependencies MUST point inward (high-level modules don't depend on low-level modules)
- Comments MUST explain "why", not "what" (code should be self-documenting)
- Dead code MUST be removed; commented-out code is forbidden

**Error Handling**:

- Errors MUST be handled explicitly; never ignore exceptions
- Error messages MUST be informative and include context
- Custom error classes MUST be used for domain-specific failures (e.g., `InvalidMoveError`, `GameEndError`)
- Try-catch blocks MUST not be used for control flow

**Code Quality Standards**:

- Cyclomatic complexity MUST be kept low (<10 per function)
- Functions MUST not exceed 20 lines; classes MUST not exceed 300 lines
- Functions MUST have no side effects unless explicitly named (e.g., `executeMove()`)
- Testable code: Functions MUST be easily testable in isolation (dependency injection, pure functions where possible)

**Rationale**: Clean Code principles ensure long-term maintainability, reduce bugs, and make onboarding faster. Real-time game code requires clarity for debugging latency issues and race conditions.

### VII. Test Driven Development (TDD) (NON-NEGOTIABLE)

All code changes MUST follow the TDD cycle: Red → Green → Refactor.

**The TDD Cycle (Mandatory)**:

1. **Red**: Write a failing test FIRST that describes the desired behavior
   - Test MUST fail for the right reason (expected behavior not yet implemented)
   - Test MUST be minimal—just enough to specify one behavior
2. **Green**: Write the MINIMUM code to make the test pass
   - No premature optimization or extra features
   - Code quality acceptable temporarily; refactoring comes next
3. **Refactor**: Improve code quality while keeping tests green
   - Apply Clean Code principles (Principle VI)
   - Extract methods, improve naming, remove duplication
   - Tests remain passing throughout refactoring

**Commit Frequency**:

- Each passing test MUST be committed separately (frequent, atomic commits)
- Commit message format: `test: [what the test verifies]` or `feat: [feature] - add test for [behavior]`
- NEVER commit failing tests (except as WIP/experimental with clear `[WIP]` prefix)
- NEVER commit production code without a corresponding passing test

**Test Coverage Requirements**:

- All Server Actions MUST have tests (unit tests for logic, integration tests for DB interactions)
- Game engine modules (Trie, WordFinder, Scorer, BoardGenerator) MUST have comprehensive unit tests
- Critical paths (move validation, scoring, clock management) MUST have integration tests
- Frontend components MUST have tests for user interactions and state changes
- Performance-critical paths MUST have performance tests validating SLA targets

**Test Quality Standards**:

- Tests MUST be independent (no shared state between tests)
- Tests MUST be deterministic (same input = same output; no flakiness)
- Tests MUST use descriptive names: `test('should [expected behavior] when [condition]')`
- Test setup MUST be minimal; prefer factories/builders over complex fixtures

**TDD Workflow Enforcement**:

- PRs MUST show evidence of TDD: test commits before implementation commits
- Code reviews MUST verify that tests exist for all new/changed functionality
- CI pipeline MUST run tests before allowing merge; failing tests block PR
- Hotfix exceptions: Emergency production fixes may temporarily skip TDD, but tests MUST be added in immediate follow-up PR

**Rationale**: TDD ensures all code is testable, reduces bugs, and provides living documentation. Frequent commits create a clear history and enable safe rollbacks. The Red-Green-Refactor cycle prevents over-engineering and ensures tests drive design.

### VIII. External Context Providers (Context7)

Agent development MUST proactively fetch and cite authoritative external context from approved
providers when the feature requires reference material (e.g., library APIs, framework behavior,
logo assets, UI components), prioritizing Context7 when applicable.

- Approved providers include Context7; additional providers may be added by governance.
- When user requests libraries/docs/usage or brand assets, the agent MUST fetch current
  context from providers and cite source and version/date in outputs.
- Prefer official, high-trust sources; if unavailable, clearly label alternatives.
- Respect provider rate limits and terms; cache stable IDs (e.g., library IDs) during a session.
- Fallbacks MUST be explicit when a provider is unavailable; do not hallucinate APIs.
- Provenance is mandatory: link or identifier of the fetched context MUST be included in deliverables
  where appropriate (specs, plans, code comments only when necessary for maintainers).

**Rationale**: Ensures up-to-date, authoritative guidance and reduces errors when integrating with
external libraries and assets. Clear provenance builds trust and aids maintenance.

### IX. Commit Message Standards

Commit messages MUST follow a concise, consistent structure to keep history readable and automate
tooling.

- Subject line MUST be a short, single-line summary (<80 characters), imperative mood, no trailing period
- Use Conventional Commits format: `type(scope): subject`
- Separate body from subject with a single blank line
- Body SHOULD explain the what and why, not the how; wrap at ~72 characters
- Reference issues/PRs in the body when relevant
- Test commits follow `test(scope): ...`; refactors use `refactor(scope): ...`

**Rationale**: Short subjects improve scanability and changelog quality; a structured body provides
necessary context without cluttering the one-liner history.

## Technology Stack Standards

**Primary Stack (Mandatory)**:

- **Frontend**: Next.js 16 (App Router), React 19+, TypeScript 5.x, Tailwind CSS 4.x
- **Server**: Next.js Server Actions (primary pattern) with `'use edge'` for performance-critical routes
- **Database**: Supabase (PostgreSQL 15+) with Row-Level Security enabled
- **Real-time**: Supabase Realtime (WebSocket) with REST polling fallback
- **Authentication**: Supabase Auth (JWT) with HttpOnly cookies
- **Hosting**: Vercel (frontend + Server Actions), Supabase Cloud (database + Realtime)

**Limited Use Cases**:

- **Edge Functions**: ONLY for WebSocket event handlers (disconnection) and scheduled cron jobs (time forfeits)
- **Rationale**: Server Actions provide better DX and type safety; Edge Functions only for event-driven operations Server Actions cannot trigger

**Code Organization Patterns**:

- `/app/actions/`: Server Actions grouped by domain (match.ts, game.ts, matchmaking.ts, challenges.ts)
- `/lib/game-engine/`: Shared game logic (board.ts, word-finder.ts, scorer.ts, trie.ts) usable server/client
- `/lib/types/`: Shared TypeScript types for server-client contracts
- `/components/`: React components organized by feature (game/, ui/)
- Animated components MUST use Framer Motion or CSS transforms (GPU-accelerated); avoid layout-triggering properties

**Testing Requirements**:

- Unit: Vitest for game engine modules (Trie, WordFinder, Scorer)
- Integration: Playwright for match flow (login → lobby → match → move)
- Performance: Load testing with Artillery.io; monitor p95 latencies
- All tests MUST pass before deployment; failing tests block PR merge
- TDD workflow: Tests written before implementation (see Principle VII)

## Development Workflow

**Git Flow**:

- Feature branches: `###-feature-name` (e.g., `001-matchmaking`)
- Commits: Conventional format `type(scope): subject` with subject <60 chars; body after a blank line
  - Subject: imperative, no trailing period; keep concise
  - Body: optional details (what/why), ~72-char wraps, references as needed
  - Test commits: `test(scope): verify [behavior]` before implementation
  - Frequent commits: Each passing test committed separately (TDD Principle VII)
- PRs: Required; must pass CI tests and Constitution compliance check

**Constitution Compliance Gates**:

- Phase 0 (Research): Verify planned changes align with Server-Authoritative principle
- Phase 1 (Design): Validate performance impact; ensure <200ms RTT, <50ms validation
- Phase 2 (Implementation): Real-time features must have fallback path
- Phase 3 (Testing): Load test any performance-critical paths
- Before deploy: All performance SLAs validated in staging environment

**Amendment Process**:

- Constitution changes require:
  1. Documentation of rationale
  2. Impact analysis on existing implementations
  3. Approval from tech lead
  4. Update to dependent templates (plan, spec, tasks)
  5. Version bump per semantic versioning (MAJOR.MINOR.PATCH)

## Governance

**Supremacy**: This constitution overrides ad-hoc decisions; all features MUST comply with principles and stack standards.

**Performance as SLA**: PRD performance targets (Section 8) are non-negotiable; violations require optimization or architecture rework.

**Type Safety**: New code MUST use TypeScript; gradual migration allowed for existing untyped modules only with approval.

**Realtime Critical Path**: Any feature touching move execution, clock, or board state MUST test reconnection and degradation paths.

**Complexity Justification**: Introduction of new runtime (e.g., migrating Server Action to Edge Function) requires documented performance/functional justification.

**Documentation**: All Server Actions MUST document input/output types in JSDoc; game engine modules require algorithmic complexity notes.

**Version**: 1.4.0 | **Ratified**: 2025-01-08 | **Last Amended**: 2025-11-05
