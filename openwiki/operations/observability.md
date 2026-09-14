---
type: operations-guide
title: Observability & Logging
description: How the app emits structured JSON logs, tracks match and round events, records instant-scoring diagnostics, times operations for latency budgets, and exports per-match audit logs from Supabase.
tags: [observability, logging, instrumentation, performance, match-events, instant-scoring, supabase]
verified:
  - by: openwiki/0.5.1
    at: 2026-09-10T18:17:19.733Z
sources:
  - id: openwiki-source-af4dce64a8b0c95aebd15520
    resource: repo://app/actions/match/completeMatch.ts
  - id: openwiki-source-023a96c4e913d6bf0b475986
    resource: repo://app/actions/match/handleDisconnect.ts
  - id: openwiki-source-b8226962a5709809ed52bbe0
    resource: repo://app/actions/match/requestRematch.ts
  - id: openwiki-source-0b00c55e252db5254864933d
    resource: repo://app/actions/match/resignMatch.ts
  - id: openwiki-source-c5c84407512cc31f98d23c84
    resource: repo://app/actions/match/respondToRematch.ts
  - id: openwiki-source-a9606b17cf4351f3f89fcf5c
    resource: repo://app/actions/match/submitMove.ts
  - id: openwiki-source-91f15b5ba54df65745493f6a
    resource: repo://instrumentation.ts
  - id: openwiki-source-7ade10d04fd6c350e1b63718
    resource: repo://lib/match/instantScoring.ts
  - id: openwiki-source-530a0fb79bfe248102861613
    resource: repo://lib/match/logWriter.ts
  - id: openwiki-source-781bec8c10d6a1c8ee22f710
    resource: repo://lib/match/roundEngine.ts
  - id: openwiki-source-577602067100303076a1344f
    resource: repo://lib/observability/instantScoring.ts
  - id: openwiki-source-3c47f675d85ba502f634f011
    resource: repo://lib/observability/log.ts
  - id: openwiki-source-89d8aea4828c52d88c1fa635
    resource: repo://lib/observability/perf.ts
  - id: openwiki-source-999b2406231fecc05dcec28c
    resource: repo://scripts/perf/assert-artillery-thresholds.ts
  - id: openwiki-source-60f9e6661c31567c1623da4d
    resource: repo://scripts/supabase/log-export.ts
  - id: openwiki-source-fb82e9b28fc31b59affeb091
    resource: repo://tests/perf/instant-scoring.yml
  - id: openwiki-source-882e993f08c0b88150ed5c55
    resource: repo://tests/perf/round-resolution.yml
  - id: openwiki-source-85f76d1b7c8443a943049a55
    resource: repo://tests/unit/observability/instantScoring.log.spec.ts
generated: { by: "openwiki/0.5.1", at: "2026-09-10T18:17:19.733Z" }
---

# Observability & Logging

This page documents how the application observes itself: the structured
JSON log helpers in `lib/observability/log.ts`, the instant-scoring
diagnostics in `lib/observability/instantScoring.ts`, the durable match
audit log written by `lib/match/logWriter.ts`, the perf-timer utility in
`lib/observability/perf.ts`, and the `scripts/supabase/log-export.ts`
tooling that reads the audit log back out. It also covers
`instrumentation.ts`, the Next.js server-startup hook.

Two complementary channels exist. **Structured stdout logs** are
best-effort, single-line JSON records emitted with `console.log` /
`console.error` for aggregation by the platform's log pipeline. The
**durable match log** is a `match_logs` Postgres table that records
significant lifecycle transitions for later audit and export. The two are
independent: a match-lifecycle action typically writes both a durable
`match_logs` row and one or more stdout analytics lines.

## Structured logging helpers (`lib/observability/log.ts`)

`logPlaytestInfo` and `logPlaytestError` are the primitives. Each builds a
payload with `level`, `event`, an ISO `timestamp`, and a `playtest: true`
marker, merges any `metadata` keys onto the top level, and prints a single
JSON line — `logPlaytestInfo` via `console.log`, `logPlaytestError` via
`console.error`. When an `error` is supplied, an `Error` is flattened to
`error` (message) and `stack`; any other value is stringified.

On top of these primitives the module exposes three typed event trackers
that the match flow calls at specific transition points:

- `trackInviteAccepted` — emits `matchmaking.invite.accepted`.
- `trackRoundCompleted` — emits `round.completed` with `acceptedMoves`,
  `rejectedMoves`, `durationMs`, and `isGameOver`.
- `trackMatchResult` — emits `match.completed` with `winnerId`, `loserId`,
  `endedReason`, `isDraw`, `totalRounds`, and `scores`.

Each tracker does two things: it logs the JSON line **and** dispatches a
strongly-typed `AnalyticsEvent` through `emitAnalyticsEvent`. That fan-out
invokes every hook registered via `registerAnalyticsHook` (each wrapped in
its own try/catch so one failing hook cannot break the others) and, in a
browser context (`typeof window !== "undefined"`), dispatches a
`playtest:analytics` `CustomEvent` on `window`. This lets in-page playtest
tooling subscribe to the same events the server logs.

### Where the trackers are emitted in the match flow

- `trackRoundCompleted` fires at the end of `advanceRound` in
  `lib/match/roundEngine.ts`, after the round summary broadcast, with
  `durationMs` computed as `Date.now() - roundStart`.
- `trackMatchResult` fires in the `completeMatch` server action
  (`app/actions/match/completeMatch.ts`) after the match state is
  published, carrying the final winner/loser, draw flag, `endedReason`,
  and score totals.

## Instant-scoring observability (`lib/observability/instantScoring.ts`)

The instant-scoring fast path (spec 042 / Linear O-57) has its own typed
observability module so post-ship analytics can answer "how often does the
fast path fire?", "how often does the race-window deferral happen?", and
"what is the failure rate?" without scraping arbitrary log strings. It
centralises the event names and payload shapes and delegates the actual
emission to `logPlaytestInfo` / `logPlaytestError`:

- `trackInstantScoringFired` → info event `instant-scoring.fired`
  (carries `wordCount`, `durationMs`, and per-phase `phases`).
- `trackInstantScoringDeferred` → info event
  `instant-scoring.deferred-to-combined` (currently only
  `reason: "race-window"`).
- `trackInstantScoringFailed` → error event `instant-scoring.failed`
  (carries a machine-readable `reason`, the `lastPhase` reached, and
  `phases`).

`phases` is a cumulative `Record<phaseName, elapsedMs>` — milliseconds from
the start of the fast path to the completion of each named phase
(`match-loaded`, `round-loaded`, `submissions-loaded`, `scoring`, …), not
per-phase deltas. On a `timeout` failure, `lastPhase` is the attribution:
the stall lives in whatever phase comes *after* the last one that
completed. This diagnostic record was added because 21 production timeouts
in one match previously logged only `roundNumber: 0` and no attribution.

### Fast-path control flow and where events fire

`instantScoreFirstSubmission` (in `lib/match/instantScoring.ts`) races the
fast path against an internal `INSTANT_SCORING_TIMEOUT_MS` (5000 ms) timer.
It builds a mutable `FastPathTrace` shared between the fast path and the
detached timeout branch, calls `markPhase` at each boundary, and emits an
instant-scoring event on each terminal outcome.

```mermaid
flowchart TD
    Start["submitMove after() hook calls instantScoreFirstSubmission"]
    Race["Promise.race fast path vs 5000ms timeout"]
    Load["Load match, round, pending submissions and markPhase each step"]
    RaceWin{"round still collecting and fewer than 2 submissions"}
    Deferred["trackInstantScoringDeferred emits deferred-to-combined"]
    Score["Score first mover, broadcast MatchState"]
    Fired["trackInstantScoringFired emits fired with phases"]
    Failed["trackInstantScoringFailed emits failed with lastPhase"]

    Start --> Race --> Load --> RaceWin
    RaceWin -->|no| Deferred
    RaceWin -->|yes| Score --> Fired
    Race -->|timeout or throw| Failed
```

Terminal outcomes of the instant-scoring fast path and the observability event each emits.

The fast path runs inside `submitMove`'s `after()` hook, post-response, so
nothing user-facing blocks on it; it is best-effort and its
`InstantScoringResult` return value is ignored by the production caller.
See [match-runtime](../architecture/match-runtime.md) for the surrounding
submit/advance flow.

## Durable match log (`lib/match/logWriter.ts`)

`writeMatchLog` is a `"use server"` helper that inserts one row into the
`match_logs` table via the passed Supabase client. Each row records a
`match_id`, an `event_type`, and a JSON `payload` of `{ actorId, metadata }`.
`MatchLogPayload.eventType` is a typed union of the known lifecycle events —
`match.completed`, `match.timeout`, `match.disconnect`,
`match.rematch.requested`, `match.rematch.created` — but stays open to
arbitrary strings (`(string & {})`) so new events can be recorded without a
type change.

`writeMatchLog` is deliberately non-throwing: on insert error it logs
`[MatchLog] Failed to insert log entry` with `console.error` and returns
normally. Audit logging must never fail the surrounding match action, so
callers do not depend on its success.

Callers that write durable match-log rows include:

- `completeMatch` — `match.completed` on round-limit, otherwise
  `match.${reason}` (e.g. `match.timeout`).
- `resignMatch` and `handleDisconnect` — resignation/disconnect events.
- `requestRematch` and `respondToRematch` — the
  `match.rematch.requested` / `match.rematch.created` pair.

## Exporting match logs (`scripts/supabase/log-export.ts`)

`scripts/supabase/log-export.ts` is a `tsx` CLI that reads the durable
audit trail back out for a single match. Invoked as
`tsx scripts/supabase/log-export.ts <matchId>`, it builds a service-role
Supabase client, selects `match_id, event_type, payload, created_at` from
`match_logs` filtered by the match id and ordered by `created_at`
ascending, and prints a pretty-printed JSON document
`{ matchId, events }`. A missing `matchId` argument or a query error exits
with status 1. Because it uses the service-role client it bypasses RLS and
is intended for operator/debugging use, not end-user access. See
[supabase](../integrations/supabase.md) for the service-role client.

## Performance instrumentation (`lib/observability/perf.ts`)

`perf.ts` provides `createPerfTimer(event, metadata)`, which returns a
`PerfTimer` with `start()`, `success(extra?)`, and `failure(error, extra?)`.
The timer selects a monotonic clock: it prefers `globalThis.performance.now()`
when available and falls back to `Date.now()`. Calling any terminal method
auto-starts the timer if `start()` was never called, computes a
non-negative rounded `durationMs`, and emits a single JSON line —
`success` records `status: "success"` via `console.log`; `failure` records
`status: "error"` plus a flattened `error`/`stack` via `console.error`.
`createPlaytestPerfTimer` is a thin wrapper that pre-tags the metadata with
`playtest: true`.

### Relationship to latency budgets and Artillery perf assertions

`perf.ts` is the *in-process* timing primitive: it stamps a `durationMs`
onto emitted log lines so operators can reason about how long an operation
took. The *external* latency budgets are enforced separately by the
Artillery load tests under `tests/perf/` and the
`scripts/perf/assert-artillery-thresholds.ts` gate:

- The Artillery scenarios (`round-resolution.yml`, `instant-scoring.yml`,
  `swap.yml`, `lobby-presence.yml`) drive real HTTP requests and declare
  `ensure` expectations such as `median < 200` and `p95 < 200` for move
  submission, and `p95 < 400` for round-resolution broadcast (PERF-002).
- `assert-artillery-thresholds.ts` parses an Artillery JSON report and
  fails the perf gate unless the sample size and the median/p95 latencies
  clear a threshold (default 200 ms via `SWAP_LATENCY_THRESHOLD_MS`,
  minimum sample via `SWAP_LATENCY_MIN_SAMPLE`). It exits non-zero on a
  breach so CI can block regressions.

Together, `perf.ts` gives per-operation timing inside logs, while the
Artillery assertions gate end-to-end request latency against the
constitution's SLAs. The instant-scoring fast path's own `durationMs` and
`phases` timings (above) are what those budgets are compared against when a
timeout is investigated.

## Server startup hook (`instrumentation.ts`)

`instrumentation.ts` exports Next.js's `register()` instrumentation hook,
which runs once on server startup. When the runtime is Node
(`NEXT_RUNTIME === "nodejs"`) it dynamically imports and calls
`loadDictionary("is")` to pre-warm the Icelandic dictionary, so round 1
does not pay the ~600–1000 ms cold-start cost of loading its 3.7M entries.
The call is wrapped in try/catch: a dictionary load failure is swallowed
here (it is logged inside `loadDictionary`) so the server does not crash;
the game instead fails gracefully when a match first tries to resolve a
round.

## Testing

Focused unit coverage lives in
`tests/unit/observability/instantScoring.log.spec.ts`, which spies on
`console.log`/`console.error` and asserts the exact event names
(`instant-scoring.fired`, `instant-scoring.deferred-to-combined`,
`instant-scoring.failed`), levels, and payload fields the trackers emit.
The instant-scoring fast-path behaviour (timeout diagnostics, race-window
deferral, cold-start budget) is exercised by the
`tests/unit/match/instantScoring.*.spec.ts` suite.
