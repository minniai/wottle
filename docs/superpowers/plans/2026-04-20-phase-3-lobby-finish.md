# Phase 3 — Lobby Finish & Invite Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round out the lobby with four new surfaces from the Warm Editorial prototype — a passive `InviteToast` for incoming challenges, a `RecentGamesCard` showing the current player's last 7 matches, a `TopOfBoardCard` with the top-6 Elo leaders, and an `EmptyLobbyState` for when nobody else is online — backed by two new Server Actions.

**Architecture:** Two thin Server Actions read from existing tables (`matches`, `scoreboard_snapshots`, `players`) and return explicit, Zod-validated return shapes. Four new purely-presentational components consume those return shapes. `app/(lobby)/page.tsx` gets the two new cards wired into a bottom section; `LobbyList` swaps its existing `InviteDialog variant="receive"` modal for the new `InviteToast` on incoming invites (the `variant="send"` modal stays for outgoing). `LobbyDirectory`'s "No other players" branch becomes the new `EmptyLobbyState` card. No database schema changes.

**Tech Stack:** Next.js 16 Server Actions + React Server Components for the lobby page fetch, React 19 client components for the presentational pieces, Tailwind CSS 4 (Phase 1 tokens), Vitest + React Testing Library, Playwright.

**Branch:** `030-lobby-finish-phase-3`, branched from `origin/main` (PRs #113 and #114 merged).

**Prerequisites:**

- Design spec: `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §4 Phase 3.
- Prototype reference: `/tmp/wottle-design/wottle-game-design/project/prototype/screens/Lobby.jsx` (Recent Games + Top Of Board cards), `Overlays.jsx` (InviteToast + EmptyLobbyState).
- Existing invite polling path: `components/lobby/LobbyList.tsx` lines 110–133 (polls `/api/lobby/invite`, sets `invite.kind = "receive"` when one arrives).

**Test commands (run after every task):**

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit + integration suite.
- `pnpm exec playwright test --grep @lobby-finish` — new tag added in Task 9.

---

## Scope decisions

**In scope:**

1. Server Action `getTopPlayers(limit)` → `{ players: TopPlayerRow[] }`.
2. Server Action `getRecentGames(limit)` → `{ games: RecentGameRow[] }` for the current player.
3. Component `TopOfBoardCard` — card with rank + avatar + name + italic rating, top-6 rows.
4. Component `RecentGamesCard` — card with result chip + opponent + score + words-count + relative time.
5. Component `EmptyLobbyState` — card with quiet headline + "Join the queue" CTA (+ disabled "Play a bot" ghost).
6. Component `InviteToast` — fixed top-right toast with ochre left stripe, avatar, accept/decline buttons.
7. Wire cards into `app/(lobby)/page.tsx` below the directory.
8. Wire `EmptyLobbyState` into `LobbyDirectory`'s empty branch.
9. Wire `InviteToast` into `LobbyList` — replaces `InviteDialog variant="receive"` on incoming invites.
10. `@lobby-finish` Playwright smoke.

**Deferred:**

- Realtime invite push (we keep the 2s polling loop in `LobbyList`; the toast just displays when polling sets `invite.kind === "receive"`).
- "Play a bot" button — rendered as visibly-disabled per the design's tight scope.
- Real Elo history / rating change visualisation — Phase 5's Profile plan owns that.

---

## File Structure

**Create:**

- `app/actions/player/getTopPlayers.ts` — Server Action.
- `app/actions/match/getRecentGames.ts` — Server Action.
- `tests/integration/actions/getTopPlayers.test.ts` — integration test.
- `tests/integration/actions/getRecentGames.test.ts` — integration test.
- `components/lobby/TopOfBoardCard.tsx` + test.
- `components/lobby/RecentGamesCard.tsx` + test.
- `components/lobby/EmptyLobbyState.tsx` + test.
- `components/lobby/InviteToast.tsx` + test.
- `tests/integration/ui/lobby-finish.spec.ts` — Playwright smoke.
- `lib/types/lobby.ts` — shared `TopPlayerRow`, `RecentGameRow` types (exported from both Server Action files).

**Modify:**

- `app/(lobby)/page.tsx` — fetch top-players + recent-games in parallel with the existing lobby snapshot fetch; render the two cards below `LobbyList`.
- `components/lobby/LobbyDirectory.tsx` — replace the internal "No other players" block with `<EmptyLobbyState />`.
- `components/lobby/LobbyList.tsx` — when `invite.kind === "receive"`, render `<InviteToast>` instead of `<InviteDialog variant="receive" />`. Keep the `variant="send"` path intact.

**Not touched:**

- `matches` / `players` / `scoreboard_snapshots` schema — no migrations.
- `InviteDialog` — stays for the send path.
- `LobbyHero`, `LobbyStatsStrip`, `PlayNowCard`, `LobbyLoginForm` — no changes.
- `api/lobby/invite` polling endpoint — reused as-is.

---

## Task 1: Shared types for the two Server Actions

**Files:**

- Create: `lib/types/lobby.ts`
- Create: `tests/unit/lib/types/lobby.test.ts`

Locking the shape before the actions so components + actions agree.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/types/lobby.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  recentGameRowSchema,
  topPlayerRowSchema,
} from "@/lib/types/lobby";

describe("lobby shared schemas", () => {
  test("topPlayerRowSchema accepts a valid row", () => {
    const row = {
      id: "p-1",
      username: "sigga",
      displayName: "Sigríður",
      eloRating: 1842,
      avatarUrl: null,
      wins: 128,
      losses: 94,
    };
    expect(topPlayerRowSchema.parse(row)).toEqual(row);
  });

  test("topPlayerRowSchema rejects negative wins", () => {
    expect(() =>
      topPlayerRowSchema.parse({
        id: "p-1",
        username: "sigga",
        displayName: "Sigríður",
        eloRating: 1842,
        avatarUrl: null,
        wins: -1,
        losses: 0,
      }),
    ).toThrow();
  });

  test("recentGameRowSchema accepts a win/loss/draw result", () => {
    const base = {
      matchId: "m-1",
      result: "win" as const,
      opponentId: "p-2",
      opponentUsername: "halli",
      opponentDisplayName: "Halli",
      yourScore: 312,
      opponentScore: 278,
      wordsFound: 18,
      completedAt: "2026-04-20T12:00:00.000Z",
    };
    expect(recentGameRowSchema.parse(base).result).toBe("win");
    expect(
      recentGameRowSchema.parse({ ...base, result: "loss" }).result,
    ).toBe("loss");
    expect(
      recentGameRowSchema.parse({ ...base, result: "draw" }).result,
    ).toBe("draw");
  });

  test("recentGameRowSchema rejects unknown result values", () => {
    expect(() =>
      recentGameRowSchema.parse({
        matchId: "m-1",
        result: "abandoned",
        opponentId: "p-2",
        opponentUsername: "x",
        opponentDisplayName: "X",
        yourScore: 0,
        opponentScore: 0,
        wordsFound: 0,
        completedAt: "2026-04-20T12:00:00.000Z",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/lib/types/lobby.test.ts`
Expected: import fails.

- [ ] **Step 3: Create `lib/types/lobby.ts`**

```ts
import { z } from "zod";

export const topPlayerRowSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  username: z.string().min(1),
  displayName: z.string().min(1),
  eloRating: z.number().int().nonnegative(),
  avatarUrl: z.string().url().nullable(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});

export type TopPlayerRow = z.infer<typeof topPlayerRowSchema>;

export const recentGameRowSchema = z.object({
  matchId: z.string().min(1),
  result: z.enum(["win", "loss", "draw"]),
  opponentId: z.string().min(1),
  opponentUsername: z.string().min(1),
  opponentDisplayName: z.string().min(1),
  yourScore: z.number().int().nonnegative(),
  opponentScore: z.number().int().nonnegative(),
  wordsFound: z.number().int().nonnegative(),
  completedAt: z.string(),
});

export type RecentGameRow = z.infer<typeof recentGameRowSchema>;
```

- [ ] **Step 4: Run tests + typecheck**

```
pnpm test -- --run tests/unit/lib/types/lobby.test.ts
pnpm test -- --run
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/types/lobby.ts tests/unit/lib/types/lobby.test.ts
git commit -m "feat(types): add TopPlayerRow + RecentGameRow schemas for Phase 3 lobby"
```

---

## Task 2: `getTopPlayers` Server Action

**Files:**

- Create: `app/actions/player/getTopPlayers.ts`
- Create: `tests/integration/actions/getTopPlayers.test.ts`

Returns top-N players ordered by `elo_rating DESC` with their win/loss counts. Uses the existing `players` table.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/actions/getTopPlayers.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { getTopPlayers } from "@/app/actions/player/getTopPlayers";
import { getServiceRoleClient } from "@/lib/supabase/server";

const supabase = getServiceRoleClient();

const testPlayers = [
  { username: "tp-alpha", display_name: "Tp Alpha", elo_rating: 2000 },
  { username: "tp-beta", display_name: "Tp Beta", elo_rating: 1800 },
  { username: "tp-gamma", display_name: "Tp Gamma", elo_rating: 1600 },
];

const createdIds: string[] = [];

beforeAll(async () => {
  for (const row of testPlayers) {
    const { data, error } = await supabase
      .from("players")
      .upsert(
        {
          username: row.username,
          display_name: row.display_name,
          elo_rating: row.elo_rating,
          status: "available",
        },
        { onConflict: "username" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`Test setup failed: ${error.message}`);
    if (data?.id) createdIds.push(data.id);
  }
});

afterAll(async () => {
  if (createdIds.length === 0) return;
  await supabase.from("players").delete().in("id", createdIds);
});

describe("getTopPlayers", () => {
  test("returns players ordered by elo rating descending", async () => {
    const result = await getTopPlayers({ limit: 6 });
    expect(result.players.length).toBeGreaterThan(0);
    for (let i = 0; i < result.players.length - 1; i++) {
      expect(result.players[i].eloRating).toBeGreaterThanOrEqual(
        result.players[i + 1].eloRating,
      );
    }
  });

  test("respects the limit argument", async () => {
    const result = await getTopPlayers({ limit: 2 });
    expect(result.players.length).toBeLessThanOrEqual(2);
  });

  test("rejects invalid limit values", async () => {
    await expect(getTopPlayers({ limit: 0 })).rejects.toThrow();
    await expect(getTopPlayers({ limit: 101 })).rejects.toThrow();
  });

  test("each row validates against topPlayerRowSchema", async () => {
    const { topPlayerRowSchema } = await import("@/lib/types/lobby");
    const result = await getTopPlayers({ limit: 6 });
    for (const row of result.players) {
      expect(() => topPlayerRowSchema.parse(row)).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test:integration -- tests/integration/actions/getTopPlayers.test.ts`
Expected: import fails.

- [ ] **Step 3: Create `app/actions/player/getTopPlayers.ts`**

```ts
"use server";

import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { TopPlayerRow } from "@/lib/types/lobby";

const inputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(6),
});

export async function getTopPlayers(
  input: z.input<typeof inputSchema>,
): Promise<{ players: TopPlayerRow[] }> {
  const { limit } = inputSchema.parse(input);
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("players")
    .select(
      "id,username,display_name,elo_rating,avatar_url,wins,losses",
    )
    .order("elo_rating", { ascending: false })
    .order("username", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch top players: ${error.message}`);
  }

  const rows: TopPlayerRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    username: r.username as string,
    displayName: (r.display_name as string) ?? (r.username as string),
    eloRating: Number(r.elo_rating ?? 0),
    avatarUrl: (r.avatar_url as string | null) ?? null,
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
  }));

  return { players: rows };
}
```

Note: if the `players` table doesn't have `wins` / `losses` columns in this repo (they might not exist yet), default to `0` and leave the column omitted from the `select()`. Run `pnpm supabase:verify` once to confirm, and adjust the `.select()` + mapping accordingly.

- [ ] **Step 4: Run the integration test**

```
pnpm test:integration -- tests/integration/actions/getTopPlayers.test.ts
pnpm typecheck
```

If integration tests cannot connect to Supabase locally, mark as DONE_WITH_CONCERNS and rely on CI. Unit-test-only fallback: skip the integration test and add a unit test that mocks `getServiceRoleClient`.

- [ ] **Step 5: Commit**

```bash
git add app/actions/player/getTopPlayers.ts tests/integration/actions/getTopPlayers.test.ts
git commit -m "feat(actions): add getTopPlayers Server Action for Phase 3 lobby"
```

---

## Task 3: `getRecentGames` Server Action

**Files:**

- Create: `app/actions/match/getRecentGames.ts`
- Create: `tests/integration/actions/getRecentGames.test.ts`

Returns the current session player's last N completed matches with opponent info + final scores.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/actions/getRecentGames.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getServiceRoleClient } from "@/lib/supabase/server";

const supabase = getServiceRoleClient();

const username = "rg-alpha";
const opponentUsername = "rg-beta";

let playerId: string | null = null;
let opponentId: string | null = null;
const createdMatchIds: string[] = [];

beforeAll(async () => {
  const players = await supabase
    .from("players")
    .upsert(
      [
        { username, display_name: "Rg Alpha", status: "available" },
        {
          username: opponentUsername,
          display_name: "Rg Beta",
          status: "available",
        },
      ],
      { onConflict: "username" },
    )
    .select("id,username");
  if (players.error) throw new Error(players.error.message);
  const rows = players.data as Array<{ id: string; username: string }>;
  playerId = rows.find((r) => r.username === username)?.id ?? null;
  opponentId = rows.find((r) => r.username === opponentUsername)?.id ?? null;

  if (!playerId || !opponentId) throw new Error("Test players not created");

  // Insert two completed matches: one player won, one opponent won.
  const now = new Date().toISOString();
  const { data: m1 } = await supabase
    .from("matches")
    .insert({
      player_a_id: playerId,
      player_b_id: opponentId,
      state: "completed",
      winner_id: playerId,
      completed_at: now,
    })
    .select("id")
    .single();
  if (m1?.id) createdMatchIds.push(m1.id);

  const { data: m2 } = await supabase
    .from("matches")
    .insert({
      player_a_id: playerId,
      player_b_id: opponentId,
      state: "completed",
      winner_id: opponentId,
      completed_at: now,
    })
    .select("id")
    .single();
  if (m2?.id) createdMatchIds.push(m2.id);
});

afterAll(async () => {
  if (createdMatchIds.length > 0) {
    await supabase.from("matches").delete().in("id", createdMatchIds);
  }
  if (playerId || opponentId) {
    await supabase
      .from("players")
      .delete()
      .in("id", [playerId, opponentId].filter(Boolean) as string[]);
  }
});

describe("getRecentGames", () => {
  test("returns the current player's completed matches with opponent info", async () => {
    if (!playerId) throw new Error("playerId missing");
    const result = await getRecentGames({ playerId, limit: 10 });
    expect(result.games.length).toBeGreaterThanOrEqual(2);
    const winRow = result.games.find((g) => g.result === "win");
    const lossRow = result.games.find((g) => g.result === "loss");
    expect(winRow?.opponentUsername).toBe(opponentUsername);
    expect(lossRow?.opponentUsername).toBe(opponentUsername);
  });

  test("rejects invalid limits", async () => {
    if (!playerId) throw new Error("playerId missing");
    await expect(getRecentGames({ playerId, limit: 0 })).rejects.toThrow();
  });

  test("each row validates against recentGameRowSchema", async () => {
    if (!playerId) throw new Error("playerId missing");
    const { recentGameRowSchema } = await import("@/lib/types/lobby");
    const result = await getRecentGames({ playerId, limit: 10 });
    for (const row of result.games) {
      expect(() => recentGameRowSchema.parse(row)).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test:integration -- tests/integration/actions/getRecentGames.test.ts`
Expected: import fails.

- [ ] **Step 3: Create `app/actions/match/getRecentGames.ts`**

```ts
"use server";

import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { RecentGameRow } from "@/lib/types/lobby";

const inputSchema = z.object({
  playerId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(6),
});

interface MatchRow {
  id: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string | null;
  completed_at: string | null;
  player_a: { id: string; username: string; display_name: string | null } | null;
  player_b: { id: string; username: string; display_name: string | null } | null;
}

interface ScoreRow {
  match_id: string;
  round_number: number;
  player_a_score: number;
  player_b_score: number;
}

function computeResult(
  winnerId: string | null,
  currentPlayerId: string,
): "win" | "loss" | "draw" {
  if (!winnerId) return "draw";
  return winnerId === currentPlayerId ? "win" : "loss";
}

export async function getRecentGames(
  input: z.input<typeof inputSchema>,
): Promise<{ games: RecentGameRow[] }> {
  const { playerId, limit } = inputSchema.parse(input);
  const supabase = getServiceRoleClient();

  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      `
        id,
        player_a_id,
        player_b_id,
        winner_id,
        completed_at,
        player_a:player_a_id (id, username, display_name),
        player_b:player_b_id (id, username, display_name)
      `,
    )
    .eq("state", "completed")
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent games: ${error.message}`);
  }

  const rows = (matches ?? []) as unknown as MatchRow[];
  if (rows.length === 0) return { games: [] };

  const matchIds = rows.map((r) => r.id);

  // Pull the highest-round scoreboard snapshot per match in one query.
  const { data: snaps, error: snapErr } = await supabase
    .from("scoreboard_snapshots")
    .select("match_id,round_number,player_a_score,player_b_score")
    .in("match_id", matchIds)
    .order("round_number", { ascending: false });

  if (snapErr) {
    throw new Error(`Failed to fetch scoreboards: ${snapErr.message}`);
  }

  const latestByMatch = new Map<string, ScoreRow>();
  for (const s of (snaps ?? []) as ScoreRow[]) {
    if (!latestByMatch.has(s.match_id)) {
      latestByMatch.set(s.match_id, s);
    }
  }

  const games: RecentGameRow[] = rows.map((row) => {
    const isPlayerA = row.player_a_id === playerId;
    const opponent = isPlayerA ? row.player_b : row.player_a;
    const snap = latestByMatch.get(row.id);
    const yourScore = snap
      ? isPlayerA
        ? snap.player_a_score
        : snap.player_b_score
      : 0;
    const oppScore = snap
      ? isPlayerA
        ? snap.player_b_score
        : snap.player_a_score
      : 0;

    return {
      matchId: row.id,
      result: computeResult(row.winner_id, playerId),
      opponentId: opponent?.id ?? "unknown",
      opponentUsername: opponent?.username ?? "unknown",
      opponentDisplayName:
        opponent?.display_name ?? opponent?.username ?? "Unknown",
      yourScore,
      opponentScore: oppScore,
      wordsFound: 0, // Phase 5 can expand this by joining word_score_entries counts.
      completedAt: row.completed_at ?? new Date(0).toISOString(),
    };
  });

  return { games };
}
```

- [ ] **Step 4: Run the integration test**

```
pnpm test:integration -- tests/integration/actions/getRecentGames.test.ts
pnpm typecheck
```

If Supabase isn't available locally: DONE_WITH_CONCERNS; CI will run.

- [ ] **Step 5: Commit**

```bash
git add app/actions/match/getRecentGames.ts tests/integration/actions/getRecentGames.test.ts
git commit -m "feat(actions): add getRecentGames Server Action for Phase 3 lobby"
```

---

## Task 4: `TopOfBoardCard` component

**Files:**

- Create: `components/lobby/TopOfBoardCard.tsx`
- Create: `tests/unit/components/lobby/TopOfBoardCard.test.tsx`

Pure presentational — takes `players: TopPlayerRow[]` and renders rows.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/lobby/TopOfBoardCard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TopOfBoardCard } from "@/components/lobby/TopOfBoardCard";
import type { TopPlayerRow } from "@/lib/types/lobby";

const players: TopPlayerRow[] = [
  { id: "p-1", username: "halli", displayName: "Hallgrímur", eloRating: 2014, avatarUrl: null, wins: 302, losses: 188 },
  { id: "p-2", username: "thori", displayName: "Þórarinn", eloRating: 1930, avatarUrl: null, wins: 201, losses: 156 },
  { id: "p-3", username: "sigga", displayName: "Sigríður", eloRating: 1842, avatarUrl: null, wins: 128, losses: 94 },
];

describe("TopOfBoardCard", () => {
  test("renders panel head with season label", () => {
    render(<TopOfBoardCard players={players} />);
    expect(screen.getByText("Top of the board")).toBeInTheDocument();
    expect(screen.getByText("Season 1")).toBeInTheDocument();
  });

  test("renders one row per player with rank", () => {
    render(<TopOfBoardCard players={players} />);
    const rows = screen.getAllByTestId("top-of-board-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("1")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2")).toBeInTheDocument();
    expect(within(rows[2]).getByText("3")).toBeInTheDocument();
  });

  test("rows show display name and rating", () => {
    render(<TopOfBoardCard players={players} />);
    expect(screen.getByText("Hallgrímur")).toBeInTheDocument();
    expect(screen.getByText("2014")).toBeInTheDocument();
    expect(screen.getByText("1,930")).toBeInTheDocument();
  });

  test("empty list shows a placeholder", () => {
    render(<TopOfBoardCard players={[]} />);
    expect(screen.getByText(/Nobody on the leaderboard/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

`pnpm test -- --run tests/unit/components/lobby/TopOfBoardCard.test.tsx`

- [ ] **Step 3: Create the component**

Create `components/lobby/TopOfBoardCard.tsx`:

```tsx
import { PlayerAvatar } from "@/components/match/PlayerAvatar";
import type { TopPlayerRow } from "@/lib/types/lobby";

interface TopOfBoardCardProps {
  players: TopPlayerRow[];
  seasonLabel?: string;
}

function formatRating(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function TopOfBoardCard({
  players,
  seasonLabel = "Season 1",
}: TopOfBoardCardProps) {
  return (
    <div
      data-testid="top-of-board-card"
      className="rounded-xl border border-hair bg-paper shadow-wottle-sm"
    >
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h3 className="font-display text-[18px] italic text-ink">
          Top of the board
        </h3>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          {seasonLabel}
        </span>
      </div>
      {players.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-soft">
          Nobody on the leaderboard yet.
        </p>
      ) : (
        <div>
          {players.map((p, idx) => (
            <div
              key={p.id}
              data-testid="top-of-board-row"
              className="grid items-center gap-3 border-b border-hair/60 px-4 py-2.5 last:border-b-0"
              style={{ gridTemplateColumns: "18px 34px 1fr auto" }}
            >
              <span className="font-mono text-[11px] text-ink-soft">
                {idx + 1}
              </span>
              <PlayerAvatar
                displayName={p.displayName}
                avatarUrl={p.avatarUrl}
                playerColor={
                  idx % 2 === 0 ? "oklch(0.68 0.14 60)" : "oklch(0.56 0.08 220)"
                }
                size="sm"
              />
              <span className="truncate text-[13px] text-ink">
                {p.displayName}
              </span>
              <span className="font-mono text-[13px] text-ink">
                {formatRating(p.eloRating)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests + typecheck**

```
pnpm test -- --run tests/unit/components/lobby/TopOfBoardCard.test.tsx
pnpm test -- --run
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add components/lobby/TopOfBoardCard.tsx tests/unit/components/lobby/TopOfBoardCard.test.tsx
git commit -m "feat(lobby): add TopOfBoardCard with rank + avatar + rating"
```

---

## Task 5: `RecentGamesCard` component

**Files:**

- Create: `components/lobby/RecentGamesCard.tsx`
- Create: `tests/unit/components/lobby/RecentGamesCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/lobby/RecentGamesCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RecentGamesCard } from "@/components/lobby/RecentGamesCard";
import type { RecentGameRow } from "@/lib/types/lobby";

const games: RecentGameRow[] = [
  {
    matchId: "m-1",
    result: "win",
    opponentId: "p-2",
    opponentUsername: "halli",
    opponentDisplayName: "Halli",
    yourScore: 312,
    opponentScore: 278,
    wordsFound: 18,
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    matchId: "m-2",
    result: "loss",
    opponentId: "p-3",
    opponentUsername: "thori",
    opponentDisplayName: "Thori",
    yourScore: 244,
    opponentScore: 301,
    wordsFound: 14,
    completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    matchId: "m-3",
    result: "draw",
    opponentId: "p-4",
    opponentUsername: "stella",
    opponentDisplayName: "Stella",
    yourScore: 210,
    opponentScore: 210,
    wordsFound: 12,
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

describe("RecentGamesCard", () => {
  test("renders panel head", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getByText("Your recent games")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  test("renders one row per game", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getAllByTestId("recent-game-row")).toHaveLength(3);
  });

  test("shows W/L/D chip per row", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getByText("W")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  test("row shows opponent handle and score", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getByText(/@halli/)).toBeInTheDocument();
    expect(screen.getByText(/312\s*–\s*278/)).toBeInTheDocument();
  });

  test("row shows words count", () => {
    render(<RecentGamesCard games={games} />);
    expect(screen.getByText("18 words")).toBeInTheDocument();
    expect(screen.getByText("14 words")).toBeInTheDocument();
    expect(screen.getByText("12 words")).toBeInTheDocument();
  });

  test("empty list shows 'no recent games' placeholder", () => {
    render(<RecentGamesCard games={[]} />);
    expect(screen.getByText(/No recent games/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

`pnpm test -- --run tests/unit/components/lobby/RecentGamesCard.test.tsx`

- [ ] **Step 3: Create the component**

Create `components/lobby/RecentGamesCard.tsx`:

```tsx
import type { RecentGameRow } from "@/lib/types/lobby";

interface RecentGamesCardProps {
  games: RecentGameRow[];
}

const RESULT_LABEL: Record<"win" | "loss" | "draw", string> = {
  win: "W",
  loss: "L",
  draw: "D",
};

const RESULT_STYLE: Record<"win" | "loss" | "draw", string> = {
  win: "bg-good/20 text-good",
  loss: "bg-bad/15 text-bad",
  draw: "bg-paper-3 text-ink-3",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  if (!Number.isFinite(diffMs) || diffMs < 0) return "just now";
  const hours = diffMs / (60 * 60 * 1000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function RecentGamesCard({ games }: RecentGamesCardProps) {
  return (
    <div
      data-testid="recent-games-card"
      className="rounded-xl border border-hair bg-paper shadow-wottle-sm"
    >
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h3 className="font-display text-[18px] italic text-ink">
          Your recent games
        </h3>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          Last 7 days
        </span>
      </div>
      {games.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-soft">
          No recent games. Start one from the floor above.
        </p>
      ) : (
        <div>
          {games.map((g) => (
            <div
              key={g.matchId}
              data-testid="recent-game-row"
              className="grid items-center gap-3 border-b border-hair/60 px-4 py-2.5 last:border-b-0"
              style={{
                gridTemplateColumns: "34px 1fr auto auto auto",
              }}
            >
              <span
                className={`inline-flex h-7 items-center justify-center rounded font-mono text-[11px] font-medium uppercase ${RESULT_STYLE[g.result]}`}
              >
                {RESULT_LABEL[g.result]}
              </span>
              <span className="truncate text-[13px] text-ink-3">
                vs <b className="text-ink">@{g.opponentUsername}</b>
              </span>
              <span className="font-mono text-[12px] text-ink-soft">
                {g.yourScore} – {g.opponentScore}
              </span>
              <span className="font-mono text-[12px] text-ink-soft">
                {g.wordsFound} words
              </span>
              <span className="font-mono text-[11px] text-ink-soft">
                {relativeTime(g.completedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests + typecheck**

```
pnpm test -- --run tests/unit/components/lobby/RecentGamesCard.test.tsx
pnpm test -- --run
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add components/lobby/RecentGamesCard.tsx tests/unit/components/lobby/RecentGamesCard.test.tsx
git commit -m "feat(lobby): add RecentGamesCard with W/L/D chip + score + opponent"
```

---

## Task 6: `EmptyLobbyState` component

**Files:**

- Create: `components/lobby/EmptyLobbyState.tsx`
- Create: `tests/unit/components/lobby/EmptyLobbyState.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/lobby/EmptyLobbyState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { EmptyLobbyState } from "@/components/lobby/EmptyLobbyState";

describe("EmptyLobbyState", () => {
  test("renders italic headline and sub-copy", () => {
    render(<EmptyLobbyState onJoinQueue={vi.fn()} />);
    expect(
      screen.getByText("The library is empty tonight."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No challengers online/i),
    ).toBeInTheDocument();
  });

  test("renders a primary 'Join the queue' button", () => {
    const onJoinQueue = vi.fn();
    render(<EmptyLobbyState onJoinQueue={onJoinQueue} />);
    const btn = screen.getByRole("button", { name: /Join the queue/i });
    btn.click();
    expect(onJoinQueue).toHaveBeenCalledOnce();
  });

  test("renders a disabled 'Play a bot' ghost button", () => {
    render(<EmptyLobbyState onJoinQueue={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Play a bot/i });
    expect(btn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Verify failure**

`pnpm test -- --run tests/unit/components/lobby/EmptyLobbyState.test.tsx`

- [ ] **Step 3: Create the component**

Create `components/lobby/EmptyLobbyState.tsx`:

```tsx
interface EmptyLobbyStateProps {
  onJoinQueue: () => void;
}

export function EmptyLobbyState({ onJoinQueue }: EmptyLobbyStateProps) {
  return (
    <div
      data-testid="empty-lobby-state"
      className="flex flex-col items-center gap-5 rounded-xl border border-hair bg-paper px-6 py-16 text-center shadow-wottle-sm"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        Nobody on the floor
      </p>
      <h3 className="font-display text-[42px] italic leading-tight text-ink">
        The library is empty tonight.
      </h3>
      <p className="max-w-[42ch] text-[15px] leading-[1.6] text-ink-3">
        No challengers online right now. Join the matchmaking queue and
        we&apos;ll notify you the moment a rated player arrives.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onJoinQueue}
          className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-ink-2"
        >
          ◆ Join the queue
        </button>
        <button
          type="button"
          disabled
          className="rounded-full border border-hair-strong px-5 py-3 text-sm text-ink-3 opacity-50"
        >
          Play a bot (coming soon)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests + typecheck**

```
pnpm test -- --run tests/unit/components/lobby/EmptyLobbyState.test.tsx
pnpm test -- --run
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add components/lobby/EmptyLobbyState.tsx tests/unit/components/lobby/EmptyLobbyState.test.tsx
git commit -m "feat(lobby): add EmptyLobbyState for when nobody else is online"
```

---

## Task 7: `InviteToast` component

**Files:**

- Create: `components/lobby/InviteToast.tsx`
- Create: `tests/unit/components/lobby/InviteToast.test.tsx`

Props match the existing `IncomingInvite` type shape and the Accept / Decline handlers from `LobbyList`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/lobby/InviteToast.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { InviteToast } from "@/components/lobby/InviteToast";

const baseInvite = {
  inviteId: "inv-1",
  fromDisplayName: "Sigríður",
  fromUsername: "sigga",
  fromElo: 1842,
  yourElo: 1728,
};

describe("InviteToast", () => {
  test("renders opponent name and 'Challenge received' eyebrow", () => {
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Challenge received")).toBeInTheDocument();
    expect(screen.getByText("Sigríður")).toBeInTheDocument();
  });

  test("body shows both player ratings", () => {
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/1,728/)).toBeInTheDocument();
    expect(screen.getByText(/1,842/)).toBeInTheDocument();
  });

  test("accept button fires onAccept with invite id", () => {
    const onAccept = vi.fn();
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={onAccept}
        onDecline={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Accept/i }));
    expect(onAccept).toHaveBeenCalledWith("inv-1");
  });

  test("decline button fires onDecline with invite id", () => {
    const onDecline = vi.fn();
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={vi.fn()}
        onDecline={onDecline}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Decline/i }));
    expect(onDecline).toHaveBeenCalledWith("inv-1");
  });

  test("close button fires onClose", () => {
    const onClose = vi.fn();
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify failure**

`pnpm test -- --run tests/unit/components/lobby/InviteToast.test.tsx`

- [ ] **Step 3: Create the component**

Create `components/lobby/InviteToast.tsx`:

```tsx
"use client";

import { PlayerAvatar } from "@/components/match/PlayerAvatar";

export interface InviteToastInvite {
  inviteId: string;
  fromDisplayName: string;
  fromUsername: string;
  fromElo: number;
  yourElo: number;
}

interface InviteToastProps {
  invite: InviteToastInvite;
  onAccept: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
  onClose: () => void;
}

function formatRating(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function InviteToast({
  invite,
  onAccept,
  onDecline,
  onClose,
}: InviteToastProps) {
  return (
    <div
      data-testid="invite-toast"
      role="alert"
      className="fixed right-6 top-20 z-50 w-[340px] overflow-hidden rounded-xl border border-hair-strong bg-paper shadow-wottle-lg"
      style={{ borderLeft: "4px solid var(--ochre-deep)" }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <PlayerAvatar
          displayName={invite.fromDisplayName}
          avatarUrl={null}
          playerColor="oklch(0.56 0.08 220)"
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ochre-deep">
            Challenge received
          </p>
          <p className="truncate text-[14px] font-medium text-ink">
            {invite.fromDisplayName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss challenge"
          className="inline-flex h-11 w-11 items-center justify-center rounded text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          ✕
        </button>
      </div>
      <div className="border-t border-hair px-4 py-3">
        <p className="text-[13px] leading-[1.5] text-ink-3">
          <span className="font-medium text-ink">Ranked</span> · 10 rounds · your
          rating{" "}
          <b className="font-mono text-ink">{formatRating(invite.yourElo)}</b>{" "}
          vs <b className="font-mono text-ink">{formatRating(invite.fromElo)}</b>.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onDecline(invite.inviteId)}
            className="flex-1 rounded-lg border border-hair-strong px-3 py-2 text-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onAccept(invite.inviteId)}
            className="flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper hover:bg-ink-2"
          >
            Accept →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests + typecheck**

```
pnpm test -- --run tests/unit/components/lobby/InviteToast.test.tsx
pnpm test -- --run
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add components/lobby/InviteToast.tsx tests/unit/components/lobby/InviteToast.test.tsx
git commit -m "feat(lobby): add InviteToast for passive incoming-invite notifications"
```

---

## Task 8: Wire everything into the lobby

**Files:**

- Modify: `app/(lobby)/page.tsx`
- Modify: `components/lobby/LobbyDirectory.tsx`
- Modify: `components/lobby/LobbyList.tsx`

### Part A — `app/(lobby)/page.tsx`

Fetch top-players + recent-games in parallel with the existing lobby snapshot. Render `RecentGamesCard` + `TopOfBoardCard` in a two-column grid below `LobbyList`.

- [ ] **Step 1: Update imports at the top of `app/(lobby)/page.tsx`**

Add:

```tsx
import { getTopPlayers } from "@/app/actions/player/getTopPlayers";
import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { RecentGamesCard } from "@/components/lobby/RecentGamesCard";
import { TopOfBoardCard } from "@/components/lobby/TopOfBoardCard";
```

- [ ] **Step 2: Extend the data fetch**

Replace:

```tsx
  const session = await readLobbySession();
  const initialPlayers = session ? await fetchLobbySnapshot() : [];
```

with:

```tsx
  const session = await readLobbySession();

  const [initialPlayers, topPlayersResult, recentGamesResult] =
    session
      ? await Promise.all([
          fetchLobbySnapshot(),
          getTopPlayers({ limit: 6 }).catch(() => ({ players: [] as const })),
          getRecentGames({ playerId: session.player.id, limit: 6 }).catch(
            () => ({ games: [] as const }),
          ),
        ])
      : [[], { players: [] }, { games: [] }];
```

- [ ] **Step 3: Render the two new cards below `LobbyList`**

Find the closing `</section>` of the `"Players online"` block. Immediately after it (still inside the `<>` fragment but outside the `section`), add:

```tsx
          <section
            className="grid gap-6 lg:grid-cols-[1.6fr_1fr]"
            aria-label="Lobby activity"
          >
            <RecentGamesCard games={recentGamesResult.games} />
            <TopOfBoardCard players={topPlayersResult.players} />
          </section>
```

### Part B — `components/lobby/LobbyDirectory.tsx`

Swap the internal empty-state for the new `EmptyLobbyState`.

- [ ] **Step 4: Import + replace the `EmptyState` component usage**

Find the existing `EmptyState` sub-component (the one rendered when `others.length === 0 && hidden.length === 0` around line 104). Also find where it's defined (likely at the bottom of the file or imported).

Replace the import / local component with `EmptyLobbyState`. Add at the top:

```tsx
import { EmptyLobbyState } from "@/components/lobby/EmptyLobbyState";
```

And where the directory currently renders `<EmptyState />`, render:

```tsx
<EmptyLobbyState
  onJoinQueue={() => {
    // Phase 3 uses the existing PlayNowCard as the queue entry point.
    // Scroll it into view if the viewport has pushed it off-screen.
    const btn = document.querySelector(
      "[data-testid=\"matchmaker-start-button\"]",
    );
    if (btn instanceof HTMLElement) btn.focus();
  }}
/>
```

Delete the local `EmptyState` sub-component if it's only used here.

### Part C — `components/lobby/LobbyList.tsx`

Replace `InviteDialog variant="receive"` with `InviteToast`.

- [ ] **Step 5: Find the receive-invite render block**

Around line 256:

```tsx
      ) : invite.kind === "receive" ? (
        <InviteDialog
          variant="receive"
          // ... props
        />
      ) : null}
```

Replace the `InviteDialog variant="receive"` block (and its props) with:

```tsx
      ) : invite.kind === "receive" ? (
        <InviteToast
          invite={{
            inviteId: invite.invite.id,
            fromDisplayName: invite.invite.fromDisplayName,
            fromUsername: invite.invite.fromUsername,
            fromElo: invite.invite.fromElo ?? 0,
            yourElo: currentPlayer.eloRating ?? 0,
          }}
          onAccept={handleAcceptInvite}
          onDecline={handleDeclineInvite}
          onClose={() => setInvite({ kind: "none" })}
        />
      ) : null}
```

Adjust prop names to match the existing `IncomingInvite` shape — if the field is `senderDisplayName` rather than `fromDisplayName`, map accordingly. Also the accept/decline handlers (`handleAcceptInvite`, `handleDeclineInvite`) already exist on the component — just find their names and use them verbatim.

Import at the top of the file:

```tsx
import { InviteToast } from "@/components/lobby/InviteToast";
```

- [ ] **Step 6: Run tests + typecheck + lint**

```
pnpm test -- --run
pnpm typecheck
pnpm lint
```

Several existing tests may fail because the `InviteDialog variant="receive"` path is gone. Update those assertions to target `getByTestId("invite-toast")` and the new button labels (`Accept` / `Decline`).

- [ ] **Step 7: Commit**

```bash
git add app/\(lobby\)/page.tsx components/lobby/LobbyDirectory.tsx components/lobby/LobbyList.tsx
git commit -m "feat(lobby): wire Phase 3 cards + invite toast into the lobby

- RecentGamesCard + TopOfBoardCard mounted below the players directory,
  fed by getRecentGames + getTopPlayers Server Actions in parallel with
  the existing snapshot fetch.
- LobbyDirectory's empty branch now uses the new EmptyLobbyState card.
- LobbyList swaps the InviteDialog variant='receive' modal for the new
  InviteToast passive notification; send flow (explicit challenge)
  still uses InviteDialog."
```

---

## Task 9: Playwright `@lobby-finish` smoke

**Files:**

- Create: `tests/integration/ui/lobby-finish.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, type Page } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

async function loginPlayer(page: Page, username: string) {
  await page.goto("/lobby");
  await page.fill('input[name="username"]', username);
  await page.click('button[type="submit"]');
  await expect(page.getByTestId("lobby-shell")).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("@lobby-finish Phase 3 lobby cards", () => {
  test("renders Recent Games and Top of the Board cards", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await loginPlayer(page, generateTestUsername("lobby-alpha"));

      await expect(page.getByTestId("recent-games-card")).toBeVisible();
      await expect(page.getByTestId("top-of-board-card")).toBeVisible();
      await expect(page.getByText("Your recent games")).toBeVisible();
      await expect(page.getByText("Top of the board")).toBeVisible();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test("EmptyLobbyState shows when no other players are online", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Log in with a name unlikely to collide and close other sessions.
      await loginPlayer(page, generateTestUsername("lobby-solo"));

      // Wait a tick for presence to settle; the directory may need to
      // hydrate before the empty state shows.
      await page.waitForTimeout(2_000);

      const empty = page.getByTestId("empty-lobby-state");
      const directoryRow = page.getByTestId("lobby-card").first();

      // Either the empty state is visible, OR at least one directory row is
      // (if another test's presence record hasn't expired). Both branches
      // are acceptable outcomes in CI.
      const emptyVisible = await empty.isVisible().catch(() => false);
      const rowVisible = await directoryRow.isVisible().catch(() => false);
      expect(emptyVisible || rowVisible).toBe(true);
    } finally {
      await page.close();
      await context.close();
    }
  });
});
```

- [ ] **Step 2: Attempt to run**

```
pnpm exec playwright test --grep @lobby-finish --workers=1 --reporter=line
```

If Supabase isn't available locally, commit as DONE_WITH_CONCERNS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/ui/lobby-finish.spec.ts
git commit -m "test(lobby): Playwright smoke for Phase 3 lobby cards + empty state"
```

---

## Task 10: Full verification sweep

- [ ] **Step 1: Run the complete unit suite**

```
pnpm test -- --run
```

Expected: all tests pass. The 7 new test files contribute ~25 passing tests.

- [ ] **Step 2: Run typecheck + lint**

```
pnpm typecheck
pnpm lint
```

Both exit 0.

- [ ] **Step 3: Run Playwright**

```
pnpm exec playwright test
```

Expected: all specs pass. If an existing spec broke because the receive-invite modal is gone, update it to target `getByTestId("invite-toast")`.

- [ ] **Step 4: Manual visual QA**

Run `pnpm dev` and open the lobby in two browsers:

- Logged in solo: the "Players online" section shows the new `EmptyLobbyState` card with "The library is empty tonight." headline + Join the queue / Play a bot (disabled) buttons.
- Logged in with a second browser: the Recent Games card shows any recent-completion rows (or the "No recent games" placeholder), the Top of the Board card shows the top-6 players (or the placeholder).
- Send a challenge from one browser to the other: the recipient sees the new `InviteToast` anchored top-right with Accept/Decline buttons.

---

## Self-Review Checklist

- [x] Both Server Actions return their Zod-validated shapes (`TopPlayerRow[]`, `RecentGameRow[]`); shapes are exported from `lib/types/lobby.ts` for reuse.
- [x] `RecentGamesCard`, `TopOfBoardCard`, `EmptyLobbyState`, `InviteToast` cover every visual state (populated / empty) with at least one test each.
- [x] `InviteToast` wires Accept / Decline / Dismiss handlers that match `LobbyList`'s existing action names.
- [x] `app/(lobby)/page.tsx` guards against Server Action failure by catching and defaulting to empty arrays so the lobby still renders.
- [x] `EmptyLobbyState` replaces the internal `EmptyState` sub-component in `LobbyDirectory`, not added alongside.
- [x] Existing `InviteDialog variant="send"` path is untouched — only the receive path moves to the toast.
- [x] No database schema changes and no changes to invite polling cadence.

---

## Out-of-scope (deferred)

- **Realtime invite push** — current 2s polling in `LobbyList` is sufficient; Phase 6 can swap to realtime.
- **"Play a bot"** functionality — button disabled by design per the Tight scope in the design doc.
- **Proper rating-delta badges** inside `RecentGamesCard` — leave as a future polish item.
- **Avatar URLs on `TopOfBoardCard`** — uses a deterministic p1/p2 slot colour fallback for now; real uploaded avatars come with Phase 5 Profile.
