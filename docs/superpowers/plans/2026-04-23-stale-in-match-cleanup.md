# Stale "In Match" Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-abort orphaned matches (`state='in_progress'` with no live presence for either player) via a pg_cron-driven sweep that reuses `completeMatchInternal`.

**Architecture:** A new SQL function `find_orphaned_matches()` returns affected match ids. A POST route `/api/cron/sweep-stale-matches` (gated by `CRON_SECRET`) calls the function and runs `completeMatchInternal(id, 'abandoned')` for each match, awaiting `Promise.allSettled` so one failure doesn't block the rest. Supabase pg_cron schedules the route every 30s via `net.http_post`. Phase 6 live-disconnect flow stays untouched.

**Tech Stack:** Next.js 16 App Router (route handler), Supabase JS v2 (`getServiceRoleClient`, `.rpc()`), Vitest (unit + integration), Postgres 17 + pg_cron + pg_net (Supabase Cloud).

**Reference:** [Design spec](../specs/2026-04-23-stale-in-match-cleanup-design.md), GitHub issue [#180](https://github.com/minniai/wottle/issues/180).

---

## File Structure

| File | Purpose |
|---|---|
| `lib/types/match.ts` | Add `'abandoned'` to `MatchEndedReason` union. |
| `app/actions/match/completeMatch.ts` | Strengthen idempotency guard so abandoned matches (null winner) short-circuit on re-entry. |
| `supabase/migrations/20260423001_sweep_stale_matches.sql` | Extend CHECK constraint, create `find_orphaned_matches()` SQL fn, enable pg_cron/pg_net (guarded), schedule sweep. |
| `lib/match/findOrphanedMatches.ts` | TS helper wrapping `supabase.rpc('find_orphaned_matches')`. |
| `app/api/cron/sweep-stale-matches/route.ts` | POST handler with `CRON_SECRET` auth, runs the sweep. |
| `tests/unit/lib/match/findOrphanedMatches.test.ts` | Unit test for RPC helper. |
| `tests/unit/app/api/sweepStaleMatches.test.ts` | Unit test for route auth + per-match failure resilience. |
| `tests/unit/app/actions/completeMatchAbandoned.test.ts` | Unit test for `completeMatchInternal('abandoned', undefined)` behavior. |
| `tests/integration/api/sweepStaleMatches.spec.ts` | Integration test against real Supabase: seed orphan, run sweep, assert finalisation. |
| `README.md` | Document `CRON_SECRET` env var and Supabase Cloud `app.cron_secret`/`app.app_url` settings. |

---

## Task 1: Add `'abandoned'` to `MatchEndedReason` type

**Files:**
- Modify: `lib/types/match.ts:36-41`
- Test: `tests/unit/lib/types/matchEndedReason.test.ts` (new)

- [ ] **Step 1.1: Write the failing test**

Create `tests/unit/lib/types/matchEndedReason.test.ts`:

```typescript
import { describe, it, expectTypeOf } from "vitest";
import type { MatchEndedReason } from "@/lib/types/match";

describe("MatchEndedReason", () => {
  it("includes 'abandoned' as a valid reason", () => {
    const reason: MatchEndedReason = "abandoned";
    expectTypeOf(reason).toEqualTypeOf<MatchEndedReason>();
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
pnpm test:unit -- tests/unit/lib/types/matchEndedReason.test.ts
```

Expected: type error `Type '"abandoned"' is not assignable to type 'MatchEndedReason'`.

- [ ] **Step 1.3: Add `'abandoned'` to the union**

Edit `lib/types/match.ts` lines 36-41 — change:

```typescript
export type MatchEndedReason =
  | "round_limit"
  | "timeout"
  | "disconnect"
  | "forfeit"
  | "error";
```

to:

```typescript
export type MatchEndedReason =
  | "round_limit"
  | "timeout"
  | "disconnect"
  | "forfeit"
  | "abandoned"
  | "error";
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
pnpm test:unit -- tests/unit/lib/types/matchEndedReason.test.ts
pnpm typecheck
```

Both expected: PASS.

- [ ] **Step 1.5: Commit**

```bash
git add lib/types/match.ts tests/unit/lib/types/matchEndedReason.test.ts
git commit -m "feat(types): add 'abandoned' to MatchEndedReason union (#180)"
```

---

## Task 2: Strengthen `completeMatchInternal` idempotency guard

The existing guard at `app/actions/match/completeMatch.ts:108-118` only short-circuits when `match.state === "completed" && match.winner_id`. Abandoned matches have `winner_id = NULL`, so a second call would re-execute. Tighten the guard to short-circuit on any `state !== "in_progress"`.

**Files:**
- Modify: `app/actions/match/completeMatch.ts:108-118`
- Test: `tests/unit/app/actions/completeMatchAbandoned.test.ts` (new)

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/app/actions/completeMatchAbandoned.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/match/statePublisher", () => ({
  publishMatchState: vi.fn().mockResolvedValue(undefined),
}));

import { getServiceRoleClient } from "@/lib/supabase/server";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";

function buildClientForCompletedMatch(state: string, winnerId: string | null) {
  const matchRow = {
    id: "match-1",
    state,
    winner_id: winnerId,
    player_a_id: "player-a",
    player_b_id: "player-b",
    ended_reason: "abandoned",
  };
  const matchSelect = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: matchRow, error: null }),
      }),
    }),
  };
  const wordScoresSelect = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "matches") return matchSelect;
      if (table === "word_scores") return wordScoresSelect;
      return { select: vi.fn() };
    }),
  } as unknown;
}

describe("completeMatchInternal idempotency for abandoned matches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits when match is already completed with no winner (abandoned)", async () => {
    const client = buildClientForCompletedMatch("completed", null);
    vi.mocked(getServiceRoleClient).mockReturnValue(client as never);

    const result = await completeMatchInternal("match-1", "abandoned");

    expect(result.matchId).toBe("match-1");
    expect(result.winnerId).toBeNull();
    expect(result.endedReason).toBe("abandoned");
  });
});
```

- [ ] **Step 2.2: Run the test to verify it fails**

```bash
pnpm test:unit -- tests/unit/app/actions/completeMatchAbandoned.test.ts
```

Expected: FAIL — current guard at `completeMatch.ts:108` requires `match.winner_id` to be truthy, so the test path falls through and tries to load scores/players from the mock that doesn't fully support that path.

- [ ] **Step 2.3: Update the guard**

Edit `app/actions/match/completeMatch.ts:108-118` — change:

```typescript
if (match.state === "completed" && match.winner_id) {
  return {
    matchId,
    winnerId: match.winner_id,
    loserId:
      match.winner_id === match.player_a_id ? match.player_b_id : match.player_a_id,
    isDraw: false,
    scores: await fetchLatestScores(supabase, matchId),
    endedReason: (match.ended_reason as MatchEndedReason) ?? reason,
  };
}
```

to:

```typescript
if (match.state === "completed") {
  const winnerId = match.winner_id ?? null;
  return {
    matchId,
    winnerId,
    loserId: winnerId
      ? winnerId === match.player_a_id
        ? match.player_b_id
        : match.player_a_id
      : null,
    isDraw: winnerId === null,
    scores: await fetchLatestScores(supabase, matchId),
    endedReason: (match.ended_reason as MatchEndedReason) ?? reason,
  };
}
```

Note: this assumes `CompleteMatchResult.winnerId` and `loserId` accept `null`. Verify `app/actions/match/completeMatch.ts` for the type. If they're `string` (not nullable), update the type in the same file to `string | null`.

- [ ] **Step 2.4: Verify type compatibility**

```bash
pnpm typecheck
```

If errors mention `CompleteMatchResult.winnerId` not accepting `null`, find the type declaration in `app/actions/match/completeMatch.ts` (search for `interface CompleteMatchResult` or `type CompleteMatchResult`) and change the `winnerId` and `loserId` fields to `string | null`. Also check call sites — `winnerId` consumers may need null-handling. Run typecheck again.

- [ ] **Step 2.5: Run all completeMatch tests**

```bash
pnpm test:unit -- tests/unit/app/actions/completeMatch
```

Expected: all pass, including the new abandoned-idempotency test. If existing tests break because of the new `null` widening, narrow the change minimally — add only what's needed for abandoned matches.

- [ ] **Step 2.6: Commit**

```bash
git add app/actions/match/completeMatch.ts tests/unit/app/actions/completeMatchAbandoned.test.ts
git commit -m "fix(match): make completeMatchInternal idempotent for abandoned matches (#180)"
```

---

## Task 3: Migration — extend CHECK constraint, add SQL function, schedule cron

**Files:**
- Create: `supabase/migrations/20260423001_sweep_stale_matches.sql`

- [ ] **Step 3.1: Write the migration**

Create `supabase/migrations/20260423001_sweep_stale_matches.sql`:

```sql
-- Stale "in match" cleanup (issue #180).
-- Adds 'abandoned' to matches.ended_reason, ships the SQL fn used by
-- the /api/cron/sweep-stale-matches route, and (where pg_cron is
-- available) schedules the sweep every 30 seconds via pg_net.
-- pg_cron + pg_net are Supabase Cloud features; the schedule block is
-- guarded so local Supabase (no pg_cron) does not break migrations.

-- 1. Extend matches.ended_reason CHECK to allow 'abandoned'.
alter table public.matches
  drop constraint if exists matches_ended_reason_check;

alter table public.matches
  add constraint matches_ended_reason_check
  check (
    ended_reason is null
    or ended_reason in (
      'round_limit',
      'timeout',
      'disconnect',
      'forfeit',
      'draw',
      'abandoned'
    )
  );

-- 2. find_orphaned_matches() — returns ids of in_progress matches where
--    neither player has a live lobby_presence row.
create or replace function public.find_orphaned_matches()
returns setof uuid
language sql
stable
as $$
  select m.id
  from public.matches m
  where m.state = 'in_progress'
    and not exists (
      select 1
      from public.lobby_presence lp
      where lp.player_id in (m.player_a_id, m.player_b_id)
        and lp.expires_at > now()
    );
$$;

comment on function public.find_orphaned_matches() is
  'Issue #180: matches stuck in_progress with no live presence for either player. Consumed by /api/cron/sweep-stale-matches.';

-- 3. Schedule the sweep — guarded so local environments without
--    pg_cron/pg_net do not fail. Production Supabase Cloud has both.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  -- Unschedule any prior version (idempotent re-runs).
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'sweep-stale-matches';

  perform cron.schedule(
    'sweep-stale-matches',
    '*/30 * * * * *',
    $cron$
      select net.http_post(
        url := current_setting('app.app_url', true) || '/api/cron/sweep-stale-matches',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
exception
  when undefined_file then
    raise notice 'pg_cron/pg_net unavailable in this environment; skipping schedule. Function find_orphaned_matches() is still available for direct invocation.';
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$$;
```

- [ ] **Step 3.2: Apply the migration locally**

```bash
pnpm supabase:migrate
```

Expected: migration applies cleanly. The `do` block emits a `notice` about pg_cron being unavailable on the local image (that's fine — `find_orphaned_matches()` is still created).

- [ ] **Step 3.3: Verify the SQL function exists and runs**

```bash
psql "$DATABASE_URL" -c "SELECT * FROM public.find_orphaned_matches();"
```

(If `DATABASE_URL` isn't set in your shell, use the local Supabase URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.)

Expected: returns 0 rows on a clean local DB.

- [ ] **Step 3.4: Verify the CHECK constraint accepts 'abandoned'**

```bash
psql "$DATABASE_URL" -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'matches_ended_reason_check';"
```

Expected: definition includes `'abandoned'`.

- [ ] **Step 3.5: Commit**

```bash
git add supabase/migrations/20260423001_sweep_stale_matches.sql
git commit -m "feat(db): add find_orphaned_matches() + 'abandoned' reason + pg_cron sweep (#180)"
```

---

## Task 4: TS helper `findOrphanedMatches()`

**Files:**
- Create: `lib/match/findOrphanedMatches.ts`
- Test: `tests/unit/lib/match/findOrphanedMatches.test.ts`

- [ ] **Step 4.1: Write the failing test**

Create `tests/unit/lib/match/findOrphanedMatches.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));

import { getServiceRoleClient } from "@/lib/supabase/server";
import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";

describe("findOrphanedMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ids returned by the SQL function", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "match-1" }, { id: "match-2" }],
      error: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);

    const result = await findOrphanedMatches();

    expect(rpc).toHaveBeenCalledWith("find_orphaned_matches");
    expect(result).toEqual(["match-1", "match-2"]);
  });

  it("returns empty array when no orphans exist", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);

    const result = await findOrphanedMatches();

    expect(result).toEqual([]);
  });

  it("returns empty array when RPC returns null data", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);

    const result = await findOrphanedMatches();

    expect(result).toEqual([]);
  });

  it("throws when the RPC errors", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);

    await expect(findOrphanedMatches()).rejects.toThrow(/boom/);
  });
});
```

- [ ] **Step 4.2: Run the test to verify it fails**

```bash
pnpm test:unit -- tests/unit/lib/match/findOrphanedMatches.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement the helper**

Create `lib/match/findOrphanedMatches.ts`:

```typescript
import { getServiceRoleClient } from "@/lib/supabase/server";

type OrphanRow = { id: string };

export async function findOrphanedMatches(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("find_orphaned_matches");

  if (error) {
    throw new Error(`find_orphaned_matches failed: ${error.message}`);
  }

  if (!data) return [];

  return (data as OrphanRow[]).map((row) => row.id);
}
```

- [ ] **Step 4.4: Run the test to verify it passes**

```bash
pnpm test:unit -- tests/unit/lib/match/findOrphanedMatches.test.ts
pnpm typecheck
```

Both expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add lib/match/findOrphanedMatches.ts tests/unit/lib/match/findOrphanedMatches.test.ts
git commit -m "feat(match): add findOrphanedMatches RPC helper (#180)"
```

---

## Task 5: Sweep route — `/api/cron/sweep-stale-matches`

**Files:**
- Create: `app/api/cron/sweep-stale-matches/route.ts`
- Test: `tests/unit/app/api/sweepStaleMatches.test.ts`

- [ ] **Step 5.1: Write the failing test**

Create `tests/unit/app/api/sweepStaleMatches.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/match/findOrphanedMatches", () => ({
  findOrphanedMatches: vi.fn(),
}));

vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn(),
}));

import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { POST } from "@/app/api/cron/sweep-stale-matches/route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

function buildRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set("authorization", authHeader);
  }
  return new Request("http://localhost/api/cron/sweep-stale-matches", {
    method: "POST",
    headers,
    body: "{}",
  });
}

describe("POST /api/cron/sweep-stale-matches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  });

  it("returns 401 when authorization header is missing", async () => {
    const res = await POST(buildRequest());
    expect(res.status).toBe(401);
    expect(findOrphanedMatches).not.toHaveBeenCalled();
  });

  it("returns 401 when bearer token mismatches", async () => {
    const res = await POST(buildRequest("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(findOrphanedMatches).not.toHaveBeenCalled();
  });

  it("returns 200 with empty result when there are no orphans", async () => {
    vi.mocked(findOrphanedMatches).mockResolvedValue([]);

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ swept: [], failed: [] });
    expect(completeMatchInternal).not.toHaveBeenCalled();
  });

  it("finalises every orphan match", async () => {
    vi.mocked(findOrphanedMatches).mockResolvedValue(["m-1", "m-2"]);
    vi.mocked(completeMatchInternal).mockResolvedValue({} as never);

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(completeMatchInternal).toHaveBeenCalledTimes(2);
    expect(completeMatchInternal).toHaveBeenCalledWith("m-1", "abandoned");
    expect(completeMatchInternal).toHaveBeenCalledWith("m-2", "abandoned");
    expect(body.swept).toEqual(["m-1", "m-2"]);
    expect(body.failed).toEqual([]);
  });

  it("continues past per-match failures and reports them", async () => {
    vi.mocked(findOrphanedMatches).mockResolvedValue(["m-ok", "m-bad", "m-ok-2"]);
    vi.mocked(completeMatchInternal).mockImplementation(async (id: string) => {
      if (id === "m-bad") throw new Error("boom");
      return {} as never;
    });

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.swept).toEqual(["m-ok", "m-ok-2"]);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]).toEqual({ matchId: "m-bad", error: "boom" });
  });

  it("returns 500 when find_orphaned_matches throws", async () => {
    vi.mocked(findOrphanedMatches).mockRejectedValue(new Error("rpc down"));

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/rpc down/);
  });
});
```

(Add `import { afterEach } from "vitest";` to the import line if your test file's imports are organized — vitest also picks it up implicitly via globals if `vitest.config.ts` enables them, so check first.)

- [ ] **Step 5.2: Run the test to verify it fails**

```bash
pnpm test:unit -- tests/unit/app/api/sweepStaleMatches.test.ts
```

Expected: FAIL — route module does not exist.

- [ ] **Step 5.3: Implement the route**

Create `app/api/cron/sweep-stale-matches/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";

const NO_CACHE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request): Promise<Response> {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }

  const startedAt = Date.now();
  let matchIds: string[];
  try {
    matchIds = await findOrphanedMatches();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({
        event: "sweep_stale_matches.find_failed",
        error: message,
      }),
    );
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  const settled = await Promise.allSettled(
    matchIds.map((id) => completeMatchInternal(id, "abandoned")),
  );

  const swept: string[] = [];
  const failed: Array<{ matchId: string; error: string }> = [];
  settled.forEach((outcome, index) => {
    const matchId = matchIds[index];
    if (outcome.status === "fulfilled") {
      swept.push(matchId);
    } else {
      const reason = outcome.reason;
      failed.push({
        matchId,
        error: reason instanceof Error ? reason.message : String(reason),
      });
    }
  });

  console.log(
    JSON.stringify({
      event: "sweep_stale_matches",
      swept_count: swept.length,
      failed_count: failed.length,
      duration_ms: Date.now() - startedAt,
    }),
  );

  return NextResponse.json(
    { swept, failed },
    { status: 200, headers: NO_CACHE_HEADERS },
  );
}
```

- [ ] **Step 5.4: Run the test to verify it passes**

```bash
pnpm test:unit -- tests/unit/app/api/sweepStaleMatches.test.ts
pnpm typecheck
```

Both expected: PASS. If `afterEach` was missing in the test file, add it to the vitest import line.

- [ ] **Step 5.5: Commit**

```bash
git add app/api/cron/sweep-stale-matches/route.ts tests/unit/app/api/sweepStaleMatches.test.ts
git commit -m "feat(api): add /api/cron/sweep-stale-matches with CRON_SECRET auth (#180)"
```

---

## Task 6: Integration test against real Supabase

**Files:**
- Create: `tests/integration/api/sweepStaleMatches.spec.ts`

This test runs against the real local Supabase (`pnpm test:integration` boots it). It seeds a stuck match with no live presence, calls the route handler, and asserts the match was finalised.

- [ ] **Step 6.1: Write the integration test**

Create `tests/integration/api/sweepStaleMatches.spec.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/cron/sweep-stale-matches/route";

const SECRET = "test-cron-secret";

async function createPlayer(displayName: string): Promise<string> {
  const supabase = getServiceRoleClient();
  const id = randomUUID();
  const { error } = await supabase.from("players").insert({
    id,
    username: `sweep-${id.slice(0, 8)}`,
    display_name: displayName,
    status: "in_match",
  });
  if (error) throw error;
  return id;
}

async function createMatch(
  playerAId: string,
  playerBId: string,
  state: "pending" | "in_progress" | "completed" = "in_progress",
): Promise<string> {
  const supabase = getServiceRoleClient();
  const id = randomUUID();
  const { error } = await supabase.from("matches").insert({
    id,
    state,
    player_a_id: playerAId,
    player_b_id: playerBId,
    board_seed: "test-seed",
    current_round: 1,
    round_limit: 10,
    player_a_timer_ms: 600000,
    player_b_timer_ms: 600000,
  });
  if (error) throw error;
  return id;
}

async function setLivePresence(playerId: string): Promise<void> {
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from("lobby_presence").upsert({
    player_id: playerId,
    connection_id: randomUUID(),
    mode: "auto",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (error) throw error;
}

async function fetchMatch(id: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("matches")
    .select("state, ended_reason, winner_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function fetchPlayerStatus(id: string): Promise<string> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("players")
    .select("status")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data.status as string;
}

function buildRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set("authorization", authHeader);
  return new Request("http://localhost/api/cron/sweep-stale-matches", {
    method: "POST",
    headers,
    body: "{}",
  });
}

describe("POST /api/cron/sweep-stale-matches (integration)", () => {
  const createdMatchIds: string[] = [];
  const createdPlayerIds: string[] = [];

  beforeAll(() => {
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(async () => {
    const supabase = getServiceRoleClient();
    if (createdMatchIds.length) {
      await supabase.from("matches").delete().in("id", createdMatchIds);
    }
    if (createdPlayerIds.length) {
      await supabase
        .from("lobby_presence")
        .delete()
        .in("player_id", createdPlayerIds);
      await supabase.from("players").delete().in("id", createdPlayerIds);
    }
    createdMatchIds.length = 0;
    createdPlayerIds.length = 0;
  });

  it("finalises an orphaned match (no presence for either player)", async () => {
    const a = await createPlayer("Alice");
    const b = await createPlayer("Bob");
    createdPlayerIds.push(a, b);
    const matchId = await createMatch(a, b);
    createdMatchIds.push(matchId);

    const res = await POST(buildRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.swept).toContain(matchId);
    expect(body.failed).toEqual([]);

    const match = await fetchMatch(matchId);
    expect(match.state).toBe("completed");
    expect(match.ended_reason).toBe("abandoned");
    expect(match.winner_id).toBeNull();

    expect(await fetchPlayerStatus(a)).toBe("available");
    expect(await fetchPlayerStatus(b)).toBe("available");
  });

  it("does not finalise a match with one live presence", async () => {
    const a = await createPlayer("Alive");
    const b = await createPlayer("Gone");
    createdPlayerIds.push(a, b);
    await setLivePresence(a);
    const matchId = await createMatch(a, b);
    createdMatchIds.push(matchId);

    const res = await POST(buildRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.swept).not.toContain(matchId);

    const match = await fetchMatch(matchId);
    expect(match.state).toBe("in_progress");
  });

  it("does not finalise a match already completed", async () => {
    const a = await createPlayer("Alpha");
    const b = await createPlayer("Beta");
    createdPlayerIds.push(a, b);
    const matchId = await createMatch(a, b, "completed");
    createdMatchIds.push(matchId);

    const res = await POST(buildRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.swept).not.toContain(matchId);
  });

  it("is idempotent — second call is a no-op", async () => {
    const a = await createPlayer("Idem-A");
    const b = await createPlayer("Idem-B");
    createdPlayerIds.push(a, b);
    const matchId = await createMatch(a, b);
    createdMatchIds.push(matchId);

    const first = await POST(buildRequest(`Bearer ${SECRET}`));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.swept).toContain(matchId);

    const second = await POST(buildRequest(`Bearer ${SECRET}`));
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.swept).not.toContain(matchId);
  });

  it("does not write a match_ratings row for abandoned matches", async () => {
    const a = await createPlayer("NoRating-A");
    const b = await createPlayer("NoRating-B");
    createdPlayerIds.push(a, b);
    const matchId = await createMatch(a, b);
    createdMatchIds.push(matchId);

    await POST(buildRequest(`Bearer ${SECRET}`));

    const supabase = getServiceRoleClient();
    const { count, error } = await supabase
      .from("match_ratings")
      .select("*", { count: "exact", head: true })
      .eq("match_id", matchId);
    expect(error).toBeNull();
    expect(count ?? 0).toBe(0);
  });
});
```

- [ ] **Step 6.2: Run the integration test**

```bash
pnpm test:integration -- tests/integration/api/sweepStaleMatches.spec.ts
```

Expected: all tests pass. If the "match_ratings" assertion fails (a row was written), it means `completeMatchInternal` is taking the rating-write path with no winner. Re-check Task 2's idempotency guard plus the rating branch — the function should skip Elo when `winnerId` is null. If needed, add an explicit guard in `applyRatingChanges` (or wherever ratings are written) that returns early when `winnerId === null`.

- [ ] **Step 6.3: Commit**

```bash
git add tests/integration/api/sweepStaleMatches.spec.ts
git commit -m "test(integration): cover sweep-stale-matches end-to-end (#180)"
```

---

## Task 7: Document `CRON_SECRET` and Supabase settings

**Files:**
- Modify: `README.md` (env-vars section)

- [ ] **Step 7.1: Locate the env-vars section in README**

Open `README.md` and find the section that lists required env variables. (If the README hands off to `CLAUDE.md` for env vars, edit `CLAUDE.md`'s "Environment Variables" section instead.)

- [ ] **Step 7.2: Add the new env var**

Append to the env-vars list:

```markdown
- `CRON_SECRET` - Shared secret for `/api/cron/*` routes. Must match the bearer token configured in pg_cron's `app.cron_secret` Postgres setting.
```

And add a new subsection (place under the env-vars list or wherever ops setup lives):

```markdown
### pg_cron sweep (Supabase Cloud)

The `/api/cron/sweep-stale-matches` route is called every 30s by pg_cron on Supabase Cloud. After deploy:

1. Set `CRON_SECRET` in Vercel project env (any random value).
2. In Supabase Cloud SQL editor, run:
   ```sql
   alter database postgres set app.app_url = 'https://wottle.example.com';
   alter database postgres set app.cron_secret = 'same-value-as-CRON_SECRET';
   ```
3. Verify in Supabase: `select * from cron.job_run_details where jobname = 'sweep-stale-matches' order by start_time desc limit 5;`

Local Supabase does not have `pg_cron` enabled; the migration creates the SQL function but skips the schedule.
```

- [ ] **Step 7.3: Commit**

```bash
git add README.md  # or CLAUDE.md if that's where env vars live
git commit -m "docs: document CRON_SECRET + Supabase pg_cron settings (#180)"
```

---

## Task 8: Final verification

- [ ] **Step 8.1: Run the full test suite**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
```

All expected: PASS.

- [ ] **Step 8.2: Sanity check the route handler against staging shape**

Manually fire the route from your local Next.js dev server:

```bash
pnpm dev   # in another terminal
CRON_SECRET=test-secret  # ensure this matches your local .env.local
curl -X POST http://localhost:3000/api/cron/sweep-stale-matches \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `200 {"swept":[],"failed":[]}` (empty arrays since no orphans on a clean DB). Without the header: `401`.

- [ ] **Step 8.3: Push and open PR**

```bash
git push -u origin feat/sweep-stale-matches-180
gh pr create --title "feat: pg_cron sweep finalises orphaned in_progress matches (#180)" --body "$(cat <<'EOF'
## Summary
- Adds `find_orphaned_matches()` SQL function returning `in_progress` matches with no live `lobby_presence` for either player.
- Adds `POST /api/cron/sweep-stale-matches` (gated by `CRON_SECRET`) that calls `completeMatchInternal(id, 'abandoned')` for each orphan via `Promise.allSettled`.
- Schedules pg_cron to invoke the route every 30s via `pg_net.http_post` (guarded so local migrations don't fail).
- Strengthens `completeMatchInternal` idempotency for abandoned matches (null winner).
- Adds `'abandoned'` to `MatchEndedReason` and the `matches.ended_reason` CHECK constraint.

Phase 6 live-disconnect flow (DisconnectionModal + claim-win) is unchanged.

Closes #180.

## Test plan
- [ ] `pnpm test:unit`
- [ ] `pnpm test:integration -- tests/integration/api/sweepStaleMatches.spec.ts`
- [ ] After deploy: confirm `cron.job_run_details` shows 200s and lobby `players in match` count drops to reality.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (post-write)

- ✅ Spec coverage: every section of the design spec maps to a task (types → 1, idempotency → 2, migration/SQL/cron → 3, RPC helper → 4, route → 5, integration tests → 6, docs → 7, verification → 8).
- ✅ No "TODO" / "implement later" / "similar to above" placeholders — every code step has the actual code.
- ✅ Exact file paths and line ranges where modifying.
- ✅ Type consistency: `MatchEndedReason` includes `'abandoned'` after Task 1; route uses `'abandoned'` literal in Task 5; `findOrphanedMatches` returns `string[]` consistently used by route.
- ✅ Frequent commits — one per task at minimum.
- ✅ TDD ordering: failing test → minimal code → passing test → commit, in every functional task.

## Risk Notes

- **Task 2 type widening.** Changing `winnerId` / `loserId` to `string | null` may surface call-site nulls. Mitigation: only widen if Step 2.4's typecheck demands it; otherwise keep types narrow by returning the existing shape with an extra branch.
- **Local migration.** If the `do $$` block leaks an unexpected error class on a particular Postgres version, Task 3.2 will fail. Mitigation: the `when others` arm catches any exception; verify by inspecting `pnpm supabase:migrate` output.
- **Integration test isolation.** Tests run against a shared local DB; the `afterEach` cleanup is critical. If concurrent integration suites flake, gate this spec with `describe.sequential` or move it into the existing serial pool.
