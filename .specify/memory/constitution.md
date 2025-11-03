# Wottle Constitution
<!-- Sync Impact Report:
  Version: 1.0.0 → 1.1.0 (MINOR: new principle added)
  Created: 2025-01-08
  Last Amended: 2025-01-08
  
  Principles Added (v1.0.0):
  - I. Server-Authoritative Game Logic (NON-NEGOTIABLE)
  - II. Real-Time Performance Standards
  - III. Type-Safe End-to-End
  - IV. Progressive Enhancement & Mobile-First
  - V. Observability & Resilience
  
  Principles Added (v1.1.0):
  - VI. Clean Code Principles (Uncle Bob)
  
  Sections Added:
  - Technology Stack Standards
  - Code Organization & Patterns
  - Development Workflow
  
  Templates Requiring Updates:
  - ✅ updated: .specify/templates/plan-template.md - added constitution compliance checks + Clean Code gate
  - ✅ updated: .specify/templates/spec-template.md - added performance requirements section
  - ✅ updated: .specify/templates/tasks-template.md - added performance test tasks
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

## Development Workflow

**Git Flow**:

- Feature branches: `###-feature-name` (e.g., `001-matchmaking`)
- Commits: Conventional format `type(scope): message` (e.g., `feat(game): add tile swap animation`)
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

**Version**: 1.1.0 | **Ratified**: 2025-01-08 | **Last Amended**: 2025-01-08
