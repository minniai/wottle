# Research: Two-Player Playtest

## Decision 1: Lobby Presence & Match Event Transport

- **Decision**: Use Supabase Realtime presence channels for lobby availability plus per-match broadcast channels; fall back to Server Action polling every 2 s when sockets drop.
- **Rationale**: Presence API already used in Supabase guides, gives join/leave metadata and supports custom payloads for status + invites; keeps implementation aligned with constitution’s single-stack rule (Next + Supabase).
- **Alternatives Considered**:
  - *Custom WebSocket server*: Higher operational load and violates single-app constraint.
  - *Polling only*: Would exceed 2 s lobby freshness target and waste bandwidth.

## Decision 2: Match State & Round Persistence

- **Decision**: Persist matches, rounds, and move submissions in Supabase PostgreSQL with a deterministic state machine stored alongside timers (`round_state`, `submission_deadline`, `player_timer_ms`).
- **Rationale**: Ensures reconnects load authoritative data, supports auditing via match logs, and leverages Postgres transactions for simultaneous submissions (SELECT … FOR UPDATE per round row).
- **Alternatives Considered**:
  - *In-memory Redis-style room*: Faster but would lose resilience on restart; added complexity not justified for limited playtest cohort.
  - *Client-tracked rounds*: Violates server-authoritative principle and complicates cheating prevention.

## Decision 3: Conflict Resolution & Scoring Summary

- **Decision**: When submissions conflict (identical swap or frozen tile), apply earliest valid submission and mark the later as `ignored_same_move`; scoring summaries include per-word calculations plus reason codes for rejections.
- **Rationale**: Matches PRD fairness rules, simplifies UX messaging (“Your swap was ignored because opponent played it first”) and ensures scoring panels remain trustworthy.
- **Alternatives Considered**:
  - *Random tie-break*: Unpredictable and undermines competitive integrity.
  - *Allow duplicate swaps sequentially*: Would double-apply board mutation and break deterministic recap.

## Decision 4: Dual-Session Test Automation

- **Decision**: Author Playwright fixtures that spin up two browser contexts sharing a Supabase emulator, orchestrating login → lobby → match → 10 rounds to validate independent timers and simultaneous submissions.
- **Rationale**: Mirrors real tester workflow, catches regressions across UI + Server Actions, and satisfies TDD/constitution requirements for performance verification.
- **Alternatives Considered**:
  - *Single-session e2e with mocked opponent*: Easier but fails to detect race conditions and lobby presence issues.
  - *Pure API contract tests*: Needed but insufficient to validate UI flows and timing cues.
