# Research: MVP E2E Board & Swaps

> Consolidated decisions resolving open implementation questions for the scaffold. Each entry includes the decision, rationale, and alternatives considered.

---

## 1) Application runtime for mutations
- Decision: Use Next.js Server Actions for swap mutations; client invokes typed Server Action; no direct client fetch to REST.
- Rationale: Aligns with constitution (Server Actions primary), enables end-to-end type safety, keeps service_role usage server-only.
- Alternatives considered:
  - REST-only Route Handlers: Simpler contract testing but splits types and validation paths.
  - Supabase Edge Functions: Good for event-driven ops; unnecessary complexity for MVP swap.

## 2) Data model shape for board state
- Decision: Persist the 16×16 grid as JSONB on `boards.grid` with a stable board id; maintain `moves` audit table for swaps and outcomes.
- Rationale: Fast to implement; minimal schema; easy to seed/reset; adequate for MVP without scoring.
- Alternatives considered:
  - Normalized `tiles` table: More flexible queries but slower to scaffold and update in bulk for MVP.
  - Materialized views for board projections: Overkill at this stage.

## 3) Validation scope for MVP
- Decision: Validate only coordinates and in-bounds; no dictionary checks or scoring; ensure immutability flags not required yet.
- Rationale: Matches spec clarifications; confirms end-to-end mutation path with minimum logic.
- Alternatives considered:
  - Include adjacency or match rules: Not needed per MVP scope; risks schedule.

## 4) API contracts exposure for testing
- Decision: Document REST contracts (GET `/api/board`, POST `/api/swap`) for contract/integration tests, while the app uses Server Actions internally.
- Rationale: Facilitates Playwright/contract tests and CI checks without binding UI state; keeps Server Actions first-class.
- Alternatives considered:
  - Server Actions only (no REST): Harder to run black-box contract tests.

## 5) Local development stack
- Decision: Supabase CLI (`supabase start`) + Docker for local DB, auth, realtime; Node.js 20.x; PNPM for package manager.
- Rationale: Matches spec and constitution; reproducible environment.
- Alternatives considered:
  - Plain Docker Compose Postgres: Loses parity with Supabase services and RLS defaults.

## 6) CI pipeline in GitHub Actions
- Decision: Single workflow with jobs: lint, typecheck, unit; optional `integration-db` job that installs Supabase CLI and runs schema + DB-backed tests.
- Rationale: Keeps quick feedback while enabling DB tests where useful; Docker available on runners.
- Alternatives considered:
  - Full e2e with Docker-in-Docker for every PR: Slower feedback; can be a nightly.

## 7) Type safety and validation
- Decision: Shared types in `lib/types`; Zod schemas for Server Action input; explicit return types; OpenAPI describes REST fallback.
- Rationale: Aligns with constitution; prevents drift between client and server.
- Alternatives considered:
  - Ad-hoc types per file: Increases mismatch risk.

## 8) Observability & performance measurement
- Decision: Add `performance.mark()` around swap server action; structured JSON logs with timing; Sentry wiring optional behind env flag.
- Rationale: Enables measurement of SLA impact early.
- Alternatives considered:
  - Defer instrumentation: Would block Constitution gate for performance.

## 9) UI grid rendering and responsiveness
- Decision: CSS grid with fixed ratio cells; Tailwind 4.x; ensure ≥44×44px touch targets; simple success toast post-swap.
- Rationale: Supports mobile-first principle; simple and robust.
- Alternatives considered:
  - Canvas/WebGL: Overkill for static grid; harms accessibility.

## 10) Secrets and key handling (local and CI)
- Decision: `.env.local` for anon key; server-only env for service_role; `.env.example` committed; CI uses temporary secrets and never bundles service_role to client.
- Rationale: Avoids key leakage; consistent with RLS and server-authoritative design.
- Alternatives considered:
  - Hardcoded dev keys: Unsafe; risks accidental commit.

---

All clarifications from the Technical Context are resolved by the decisions above.

