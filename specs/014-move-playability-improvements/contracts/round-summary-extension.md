# Contract: RoundSummary Moves Extension

**Date**: 2026-03-07

## Change Summary

Extend the `RoundSummary` Realtime broadcast payload to include accepted move coordinates per player.

## Type Definition

```typescript
// New type in lib/types/match.ts
export interface RoundMove {
  playerId: string;
  from: Coordinate;  // { x: number; y: number }
  to: Coordinate;
}

// Extended field on existing RoundSummary
export interface RoundSummary {
  // ... existing fields unchanged ...
  moves: RoundMove[];  // NEW: one entry per player's accepted move
}
```

## Broadcast Payload

**Event**: `round-summary` on channel `match:{matchId}`

**Before** (existing):
```json
{
  "matchId": "uuid",
  "roundNumber": 3,
  "words": [...],
  "deltas": { "playerA": 15, "playerB": 8 },
  "totals": { "playerA": 42, "playerB": 31 },
  "highlights": [[...], [...]],
  "resolvedAt": "2026-03-07T12:00:00Z"
}
```

**After** (extended):
```json
{
  "matchId": "uuid",
  "roundNumber": 3,
  "words": [...],
  "deltas": { "playerA": 15, "playerB": 8 },
  "totals": { "playerA": 42, "playerB": 31 },
  "highlights": [[...], [...]],
  "resolvedAt": "2026-03-07T12:00:00Z",
  "moves": [
    { "playerId": "player-a-uuid", "from": { "x": 3, "y": 5 }, "to": { "x": 4, "y": 5 } },
    { "playerId": "player-b-uuid", "from": { "x": 7, "y": 2 }, "to": { "x": 7, "y": 3 } }
  ]
}
```

## Data Source

Query `move_submissions` table for the round's accepted submissions:

```sql
SELECT player_id, from_x, from_y, to_x, to_y
FROM move_submissions
WHERE round_id = :roundId
  AND status = 'accepted'
ORDER BY submitted_at ASC;
```

## Backward Compatibility

- `moves` field is additive; existing clients that don't read it are unaffected
- Timeout-pass synthetic submissions (from 0,0 → 0,0) are included but identifiable by coordinates
