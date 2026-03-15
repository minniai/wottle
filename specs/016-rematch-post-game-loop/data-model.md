# Data Model: Rematch & Post-Game Loop

**Feature**: 016-rematch-post-game-loop | **Date**: 2026-03-15

## New Table: `rematch_requests`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, DEFAULT gen_random_uuid() | Unique request identifier |
| `match_id` | uuid | FK → matches(id), NOT NULL, UNIQUE | The completed match this request belongs to |
| `requester_id` | uuid | FK → players(id), NOT NULL | Player who initiated the rematch |
| `responder_id` | uuid | FK → players(id), NOT NULL | Player who must accept/decline |
| `status` | text | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','accepted','declined','expired') | Request lifecycle state |
| `new_match_id` | uuid | FK → matches(id), NULLABLE | Set when status=accepted; the newly created match |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | When the request was created |
| `responded_at` | timestamptz | NULLABLE | When the responder acted (or request expired) |

**Indexes:**
- `idx_rematch_requests_match_id` ON (match_id) — lookup by match
- UNIQUE constraint on `match_id` enforces FR-010 (one request per match)

**RLS:**
- SELECT: `requester_id = auth.uid() OR responder_id = auth.uid()`

## Modified Table: `matches`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `rematch_of` | uuid | FK → matches(id), NULLABLE | Previous match in the rematch chain |

**Indexes:**
- `idx_matches_rematch_of` ON (rematch_of) WHERE rematch_of IS NOT NULL — partial index for chain walking

## State Transitions: `rematch_requests.status`

```
pending ──→ accepted   (responder accepts OR simultaneous detection)
        ├─→ declined   (responder declines OR navigates away)
        └─→ expired    (30s timeout with no response)
```

All transitions are one-way (terminal). Once a request leaves `pending`, no further changes are possible.

## Entity Relationships

```
matches 1──* rematch_requests  (via match_id; max 1 due to UNIQUE)
matches 1──? matches           (via rematch_of; self-referential chain)
players 1──* rematch_requests  (via requester_id, responder_id)
```

## Derived Entity: Series

Not stored. Computed at read time by walking `matches.rematch_of` chain:

```
Match C (rematch_of → B) → Match B (rematch_of → A) → Match A (rematch_of → null)
Series chain: [A, B, C] → Game 3
```

**TypeScript type** (`SeriesContext`):
```typescript
interface SeriesContext {
  gameNumber: number;        // Position in chain (1-indexed)
  currentPlayerWins: number; // Wins for the viewing player
  opponentWins: number;      // Wins for the opponent
  draws: number;             // Drawn matches in the chain
}
```
