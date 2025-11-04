# Feature Specification: MVP E2E Board & Swaps

**Feature Branch**: `001-e2e-board-scaffold`  
**Created**: 2025-11-04  
**Status**: Draft  
**Input**: User description: "Based on the @wottle_prd.md and @wottle_technical_architecture.md the first thing to do is to set up the development environment for implmenting the game, all base components, deployment pipeline, scaffolding, and local development environment. It should be an end-to-end implementation for to confirm the development architecture, with minimum functionality. It should only display the game board grid and be able send board moves, tile swaps end to end."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch local Supabase stack (Priority: P1)

A developer clones the project and starts the local Supabase-backed environment to support the MVP board scaffold.

**Why this priority**: Without a working local Supabase back end, the end-to-end scaffold cannot be validated.

**Independent Test**: Follow the documented quickstart to install prerequisites and confirm Supabase services run locally with expected status outputs.

**Acceptance Scenarios**:

1. **Given** a fresh clone, **When** the developer runs the quickstart, **Then** the Supabase CLI installs prerequisites and the local stack starts successfully via `supabase start`.
2. **Given** the local stack is running, **When** the developer checks the status command, **Then** database, auth, realtime, and storage services report healthy states.

---

### User Story 2 - See board grid (Priority: P1)

A player opens the app and sees a 16×16 grid of letters representing the current board state.

**Why this priority**: Without a visible grid, nothing can be validated end-to-end.

**Independent Test**: Load the app and verify a 16×16 grid renders with legible letters; resizing and mobile viewport still display a complete grid.

**Acceptance Scenarios**:

1. **Given** the app loads, **When** the board state is retrieved, **Then** a 16×16 grid is displayed.
2. **Given** a mobile viewport, **When** the page is viewed, **Then** the grid remains readable and scrollable as needed.

---

### User Story 3 - Swap two tiles (Priority: P1)

A player selects two tiles (any positions) and triggers a swap; the system accepts the move if allowed and reflects the new grid state.

**Why this priority**: Confirms end-to-end mutation path and server authority for core gameplay action.

**Independent Test**: Select two tiles, submit the swap, and verify the board updates accordingly (success path) or shows a clear error (rejection path).

**Acceptance Scenarios**:

1. **Given** two valid, movable tiles, **When** the user swaps them, **Then** the grid updates to reflect their exchanged positions.
2. **Given** an invalid swap (e.g., out-of-bounds coordinates), **When** the user attempts it, **Then** the system rejects with a clear message and the board remains unchanged.

---

### User Story 4 - Basic move feedback (Priority: P2)

After a successful swap, the user receives basic confirmation that the move was processed (e.g., brief visual state change or message).

**Why this priority**: Helps verify that the action completed and supports usability during early testing.

**Independent Test**: Perform a valid swap and observe a confirmation signal distinct from the board change itself.

**Acceptance Scenarios**:

1. **Given** a valid swap, **When** it completes, **Then** a confirmation indicator appears briefly.

---

### Edge Cases

- What happens when the network round-trip fails during a swap submission? System should show an error and restore prior board state.
- How does the system handle concurrent initial moves? The second submission is rejected with a clear message and the client refreshes the board state.
- What happens when Supabase CLI dependencies or Docker are missing locally? Quickstart documentation must surface prerequisites and remediation steps before startup.
- How does the system handle a port conflict or already-running Supabase instance? Startup flow alerts the developer and provides resolution guidance.
- What happens if environment variables point to a cloud Supabase project? Validation warns and blocks until local settings are restored.
- How are service_role keys protected during local development? Tooling ensures they stay server-side and never ship to client bundles.
- How does the project detect RLS drift between local and production? Checks compare policy snapshots and require alignment before local testing proceeds.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a 16×16 letter grid representing the current match board.
- **FR-002**: Users MUST be able to select any two tiles and submit a swap request.
- **FR-003**: System MUST validate swaps server-side by confirming coordinates exist, tiles are movable, and no dictionary/word checks are required for this MVP, then either accept (apply and return updated board) or reject with a reason.
- **FR-004**: On acceptance, System MUST return the updated grid and reflect it for the user within one interaction cycle.
- **FR-005**: On rejection or failure, System MUST preserve the previous grid and display an actionable error.
- **FR-006**: System MUST support basic responsiveness so the 16×16 grid is viewable on desktop and mobile.
- **FR-007**: System MUST provide a minimal confirmation indicator after a successful swap.
- **FR-008**: System MUST prevent wrap-around or out-of-bounds coordinates in swap requests.
- **FR-009**: System MUST provide a documented quickstart that installs Supabase CLI prerequisites and launches the Docker-backed stack via `supabase start` end-to-end.
- **FR-010**: System MUST supply project configuration files and environment templates that default client contexts to the anon key and server actions to the service_role key.
- **FR-011**: System MUST expose a verification checklist or script confirming Supabase services (database, auth, realtime, storage, RLS policies) are reachable and aligned with production settings.
- **FR-012**: System MUST include seed/reset workflows that populate and restore the database with baseline board and tile data while applying production-equivalent RLS policies.
- **FR-013**: System MUST describe troubleshooting guidance for common local Supabase failures (missing binaries, port conflicts, key mismatches).
- **FR-014**: System MUST ensure local Supabase credentials are stored in developer `.env` files excluded from version control, with service_role keys limited to server-only runtime contexts.

### Key Entities *(include if feature involves data)*

- **Board**: A 16×16 matrix of tiles, each with a letter and immutability flags reserved for future stages; for this feature, only letter and coordinates are required to visualize and swap.
- **Move**: A swap action with source and destination coordinates and a server-evaluated result (accepted/rejected) with updated board state.
- **Local Supabase Project**: Developer-scoped environment including URLs, anon and service_role keys, storage buckets, and RLS policy set that mirrors production defaults.
- **Seed Dataset**: Canonical board and tile records plus metadata used to prime the local database and enable deterministic reset workflows.
- **Developer Environment Config**: `.env` templates and scripts that bind the scaffolded app to the local Supabase instance and enforce key-handling rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can load the app and see a 16×16 grid within 2 seconds on a typical broadband connection.
- **SC-002**: At least 95% of valid swap attempts update the board within 1 second during local development testing.
- **SC-003**: 100% of invalid swap attempts are rejected with a clear error message and no board change.
- **SC-004**: A developer can install prerequisites and start the local Supabase stack within 20 minutes following the quickstart.
- **SC-005**: 100% of application requests during local testing route to the local Supabase instance (verified via provided checklist or tooling).
- **SC-006**: Seed/reset workflows complete successfully in under 2 minutes and reproduce the documented baseline board state.
- **SC-007**: At least 90% of developers in onboarding surveys report confidence running the app end-to-end without relying on cloud Supabase resources.

### Performance Requirements (if applicable)

- **PERF-001**: End-to-end swap action appears complete to the user within 1 second in local testing.
- **PERF-002**: Board render maintains smooth visual updates without stutter during a single swap interaction.
- **PERF-003**: Local Supabase stack startup (command execution to ready state) completes within 3 minutes on standard developer hardware.
- **PERF-004**: Application connection health checks detect misconfigured Supabase endpoints within 10 seconds and surface actionable guidance.

## Clarifications

### Session 2025-11-04

- Q: What level of server-side swap validation is required for this MVP? → A: Validate coordinates/move legality only (no dictionary checks)
- Q: Which local Supabase setup approach should the scaffold standardize? → A: Use Supabase CLI `supabase start` with Docker services.
- Q: How should local Supabase keys be used for client versus server paths? → A: Use anon key for client calls and service_role key for server actions.
- Q: Should local RLS policies mirror production rules? → A: Mirror production RLS policies in local schema.

## Assumptions

- Developers have permission to install the Supabase CLI and run Docker-based services required by `supabase start` on their machines.
- The MVP board scaffold continues to use Supabase as the backing service for all server-authoritative actions and keeps the service_role key restricted to server environments while mirroring production RLS rules locally.
- Documentation updates ship alongside the scaffold so onboarding teams can reference a single source of truth.
