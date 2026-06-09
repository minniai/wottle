# Realtime Event Contracts

**Branch**: `042-instant-scoring-reveal` | **Date**: 2026-06-09

This file enumerates the Supabase Realtime broadcasts touched by this feature. No new channel topic is introduced; one existing event payload is extended by a single optional field.

---

## 1. Channel: `match:${matchId}` (existing — no change to topic)

This is the single per-match channel today and remains the single per-match channel after this feature. No new topic name, no new subscription path on the client.

### 1.1 `state` event (existing — payload extended)

**Producer**: `publishMatchState` in `lib/match/statePublisher.ts` (unchanged).

**Payload type**: `MatchState` (see data-model.md § 2.2).

**Payload delta**:

```diff
 {
   matchId: string,
   board: string[][],
   currentRound: number,
   state: "pending" | "collecting" | "resolving" | "completed" | "abandoned",
   timers: { playerA: TimerState, playerB: TimerState },
   scores: ScoreTotals,
   lastSummary?: RoundSummary | null,
   disconnectedPlayerId?: string | null,
   frozenTiles?: FrozenTileMap,
   pendingMoves?: PendingMove[],
+  partialSummary?: PartialRoundSummary | null,
 }
```

**When `partialSummary` is present**:

- The current round is in `collecting` (DB state).
- The fast path has fired successfully and produced at least one scored word for the first mover.
- `partialSummary.firstMoverId` identifies whose words these are.
- `partialSummary.firstSubmissionAt` is the dedupe key for client-side suppression once `lastSummary` arrives for the same round.

**When `partialSummary` is absent (undefined / null)**:

- The round just started (no submissions yet), OR
- The first submission produced no scored words (FR-006: no broadcast), OR
- The fast path failed or deferred to combined (FR-007 / FR-011), OR
- The round has already completed and the partial summary has been cleared in favour of the canonical `lastSummary`.

**Cardinality**: at most one `state` event per round carries `partialSummary` with content. Subsequent `state` events for the same round may carry the same `partialSummary` (it persists until `round.state !== 'collecting'`) and clients deduplicate by `firstSubmissionAt`.

**Backwards compatibility**: clients that don't know about `partialSummary` ignore the field. Servers that don't yet write the field send `partialSummary === undefined`. No deploy ordering required.

---

### 1.2 `round-summary` event (existing — no change)

Continues to broadcast a complete `RoundSummary` at round completion. Unchanged.

### 1.3 `match-error` event (existing — no change)

Unchanged.

---

## 2. Polling-fallback hydration

The polling fallback (`/api/match/[matchId]/state` route → `loadMatchState`) returns the same `MatchState` shape, so a polling client that subscribes mid-round sees `partialSummary` populated as long as the underlying DB state matches the rules in data-model.md § 5.

**Convergence guarantee** (FR-002, SC-001): a polling client receives the partial reveal within one poll interval (~2 s) of the fast path's writes landing in Postgres.

---

## 3. Payload size analysis

A typical `PartialRoundSummary`:

| Field | Typical size |
|---|---|
| `matchId` | 36 bytes (UUID) |
| `roundNumber` | 1–2 bytes |
| `firstMoverId` | 36 bytes (UUID) |
| `firstSubmissionAt` | 24 bytes (ISO timestamp) |
| `words` | ~80 bytes per word × 1–4 words = 80–320 bytes |
| `delta` | ~30 bytes |
| `frozenTiles` | depends on game progress; typically ≤2 KB by round 10 |

Worst-case payload growth on `state` events when `partialSummary` is present: ~2.5 KB.

The full `state` event today is ~3 KB (board grid alone is ~600 bytes serialised, plus timers, scores, `frozenTiles`, `pendingMoves`, `lastSummary` if present). The increment is bounded and well within Supabase Realtime broadcast limits (256 KB per message).

---

## 4. Validation contract

Define a Zod schema for `PartialRoundSummary` and compose it into the existing `MatchState` schema. Clients MUST validate broadcast payloads before applying them to state; an invalid `partialSummary` MUST cause the entire `state` payload to be discarded (falling through to polling for re-hydration).

**Schema location**: `lib/match/schemas.ts` (or wherever the project keeps Realtime payload schemas — confirm during implementation).

**Schema shape**:

```ts
export const partialRoundSummarySchema = z.object({
  matchId: z.string().uuid(),
  roundNumber: z.number().int().min(1).max(10),
  firstMoverId: z.string().uuid(),
  firstSubmissionAt: z.string().datetime(),
  words: z.array(wordScoreSchema).max(20),  // generous upper bound
  delta: scoreTotalsSchema,
  frozenTiles: frozenTileMapSchema,
});
```

The `.max(20)` on `words` is a defensive cap — a single swap producing 20 scored words is astronomically unlikely; a payload claiming more is malformed.

---

## 5. Observability

Every successful `state` event carrying `partialSummary` corresponds to a server-side log event `instant-scoring.fired` with `{matchId, roundNumber, playerId, wordCount, durationMs}` (research.md Decision 9). This pairing lets ops correlate broadcast issues with the fast-path firing.

No new client-side observability is required; the client already logs Realtime subscribe/error events via the existing channel-management code in `MatchClient.tsx`.

---

## 6. Migration path

- **Deploy day**: new server publishes `partialSummary`; old clients ignore it. New clients see `partialSummary` for any newly-started round; in-flight rounds may not produce one (if the first submission happened pre-deploy). No user-visible disruption.
- **Rollback**: removing the server change reverts to no `partialSummary` in payloads; clients gracefully degrade to today's behaviour. No persistent state to roll back (the DB schema is unchanged).
