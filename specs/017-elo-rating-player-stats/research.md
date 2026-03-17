# Research: Elo Rating & Player Stats

**Feature**: 017-elo-rating-player-stats
**Date**: 2026-03-15

## R1: Elo Calculation Integration Point

**Decision**: Insert Elo calculation in `completeMatchInternal()` (in `/app/actions/match/completeMatch.ts`) immediately after `determineMatchWinner()` returns.

**Rationale**: This is the single authoritative point where match outcomes are finalized. The winner is already determined, both player IDs are available, and the function already updates the `matches` table and resets player statuses. Adding Elo calculation here keeps all post-match mutations in one transaction.

**Alternatives considered**:
- Separate Server Action triggered by client after match ends — rejected: violates server-authoritative principle; client could skip it.
- Database trigger on `matches.state = 'completed'` — rejected: harder to test, debug, and maintain; Elo logic belongs in application layer.
- Background job/queue — rejected: overkill for a synchronous calculation that takes <1ms; adds infrastructure complexity.

## R2: Database Schema Strategy

**Decision**: Use existing `elo_rating` column on `players` table (already exists, nullable integer). Add `games_played`, `wins`, `losses`, `draws` columns to `players`. Create a new `match_ratings` table to store per-match rating snapshots (before/after/delta for both players).

**Rationale**: Aggregate stats on `players` avoid expensive COUNT queries on every profile view. The `match_ratings` table provides audit trail and enables the 5-game trend query without recalculation. Separating per-match rating data from the aggregate avoids overloading the `matches` table.

**Alternatives considered**:
- Store rating deltas as columns on `matches` table — rejected: `matches` already has many columns; separate table is cleaner and supports independent RLS.
- Derive all stats from `match_ratings` table (no aggregate columns) — rejected: requires COUNT/SUM queries on every lobby load; denormalized aggregates are faster.
- Store rating history as JSONB array on `players` — rejected: unbounded growth, harder to query, no relational integrity.

## R3: Elo Formula Implementation

**Decision**: Standard Elo with variable K-factor. Pure function, no side effects.

**Formula**:
```
Expected score: E = 1 / (1 + 10^((opponent_rating - player_rating) / 400))
New rating: R_new = R_old + K * (actual_score - expected_score)
K-factor: 32 if games_played < 20, else 16
Rating floor: max(100, R_new)
Rounding: Round to nearest integer
```

**Rationale**: Standard FIDE-inspired Elo is well-understood, mathematically sound, and maps directly to the spec requirements. Variable K-factor (32/16) allows new players to calibrate quickly while keeping established ratings stable.

**Alternatives considered**:
- Glicko-2 (rating + deviation + volatility) — rejected: more complex, requires tracking additional state; overkill for MVP.
- Fixed K-factor (e.g., always 20) — rejected: spec explicitly requires variable K based on games played.
- Elo with provisional period (unranked until N games) — rejected: spec says display rating from game 0.

## R4: Atomicity Strategy

**Decision**: Single database transaction wrapping: (1) insert into `match_ratings`, (2) update both players' `elo_rating`, `games_played`, `wins`/`losses`/`draws` columns. Use Supabase RPC or sequential queries within the service-role client.

**Rationale**: FR-004 and FR-018 require atomic updates. A single transaction ensures both players update together or neither does. The service-role client bypasses RLS for this privileged operation.

**Alternatives considered**:
- Two separate UPDATE queries without transaction — rejected: violates atomicity requirement.
- Postgres function (PL/pgSQL) for the entire Elo calculation — rejected: moves business logic into database; harder to test with Vitest.
- Postgres function only for the atomic write (calculation stays in TypeScript) — viable alternative but adds migration complexity; simple sequential queries with service-role client are sufficient given single-server architecture.

## R5: Profile View UX Pattern

**Decision**: Modal/dialog overlay triggered by clicking a username. Accessible from both LobbyCard and FinalSummary. Fetches data via a Server Action on open.

**Rationale**: A modal avoids routing changes, keeps implementation small, and works in both lobby and post-game contexts. Server Action fetch ensures fresh data without caching concerns.

**Alternatives considered**:
- Slide-out panel — rejected: more complex layout; modal is simpler and sufficient.
- Separate page route (`/player/[id]`) — rejected: spec explicitly excludes separate profile page.
- Tooltip/popover — rejected: too small for the amount of data (stats + trend).

## R6: Rating Trend Data

**Decision**: Query the 5 most recent rows from `match_ratings` for the target player, ordered by `created_at DESC`. Return the `rating_after` values. Client derives direction (up/down/stable) from the sequence.

**Rationale**: The `match_ratings` table stores `rating_after` per match, making the trend query a simple `SELECT ... ORDER BY created_at DESC LIMIT 5`. No additional storage needed.

**Alternatives considered**:
- Store trend as JSONB array on `players` — rejected: redundant with `match_ratings` data; adds update complexity.
- Cache trend in memory — rejected: unnecessary; query is fast (indexed by player_id + created_at).

## R7: Lobby Rating Display

**Decision**: No changes needed to the presence channel or data fetching. `fetchLobbySnapshot()` already joins `players` and returns `eloRating`. LobbyCard already receives `player.eloRating` but doesn't render it — just add the display element.

**Rationale**: The infrastructure is already in place. The `PlayerIdentity` type has `eloRating?: number | null` and lobby queries already SELECT it. This is purely a UI addition.

**Alternatives considered**:
- Separate API endpoint for ratings — rejected: data already flows through existing presence system.
- WebSocket-specific rating broadcast — rejected: lobby presence sync already handles this.
