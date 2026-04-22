# Phase 5b — `/profile` + `/profile/[handle]` Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

Phase 5a (PR #146) shipped the Warm Editorial profile modal, including the extended `PlayerProfile` shape (`bestWord`, `form`, `peakRating`, `ratingHistory`). Phase 5b builds on that data to deliver the **full-page profile** experience: `/profile` for the logged-in user and `/profile/[handle]` for any other player, with a sidebar + rating chart + word cloud + match history. The TopBar already has a "Profile" link (`components/ui/TopBar.tsx:30`) that 404s today — this phase lights it up.

All data still derives on-the-fly from existing tables (`players`, `match_ratings`, `word_score_entries`, `matches`, `scoreboard_snapshots`). No migrations.

**Intended outcome.** Clicking "Profile" in the TopBar loads `/profile` with your stats; navigating to `/profile/<username>` loads any other player's public profile. Both share the same `ProfilePage` layout.

## Goal

Add the two new routes, one new Server Action (`getPlayerProfileByHandle`), and the composable presentational pieces (`ProfileSidebar`, `ProfileRatingChart`, `ProfileWordCloud`, `ProfileMatchHistoryList`, `ProfilePage`) that render the full page.

## Architecture

1. **Server side:**
   - Add `getPlayerProfileByHandle(handle: string)`: look up `players.id` by `username` (lowercased) then delegate to the existing `getPlayerProfile(playerId)` — zero query duplication.
   - Add `getBestWords(playerId, limit = 12)`: per-word aggregate from `word_score_entries`, ordered by max `total_points` desc, taking the `total_points` as the word's score.
   - Reuse the existing `getRecentGames({ playerId, limit })` for match history.
2. **Pages:**
   - `app/profile/page.tsx` — reads session, redirects to `/` if absent, fetches own profile via `getPlayerProfile(session.player.id)`, renders `<ProfilePage mode="own" ... />`.
   - `app/profile/[handle]/page.tsx` — reads `params.handle`, calls `getPlayerProfileByHandle(handle)`, renders 404 state if not found, `<ProfilePage mode="public" ... />` otherwise.
3. **Presentational components:** all under `components/profile/` (new directory separate from Phase 5a's `components/player/`). Each file < ~120 lines with a single responsibility.

## Tech Stack

TypeScript 5.x, React 19 Server + Client Components, Next.js 16 App Router, Supabase JS v2, Zod, Tailwind CSS 4, Vitest + React Testing Library, Playwright.

## Branch

`026-profile-page-phase-5b`, branched from `origin/main` after PR #146 merged (commit `367148d`).

---

## Scope decisions

**In scope:**

1. `getPlayerProfileByHandle(handle)` Server Action.
2. `getBestWords(playerId, limit?)` Server Action.
3. `ProfileSidebar` component — avatar, italic name, `@handle · member since {YYYY}`, big ochre-deep rating block.
4. `ProfileRatingChart` component — SVG path + area fill + dashed horizontal grid + endpoint dot.
5. `ProfileWordCloud` component — tag-cloud of top words with `font-size: 16 + pts * 0.5` (size formula) and top-3 ochre-deep tinted.
6. `ProfileMatchHistoryList` component — W/L/D chip + opponent + score + relative-time.
7. `ProfilePage` shared layout — sidebar + main column composition.
8. `app/profile/page.tsx` (own) + `app/profile/[handle]/page.tsx` (public) routes.
9. Playwright `@profile-page` smoke.

**Deferred:**

- `rating_history` table migration (Option A from spec) — keep deriving from `match_ratings`.
- "▲ +N today" rating-delta badge on the sidebar — needs today's change only; leave for a follow-up with lightweight analytics.
- "Replay →" link on match history — stubbed "(soon)" inline.
- Avatar upload / profile edit controls.

**Explicitly not in scope:**

- Editing the existing `PlayerProfileModal` — it already renders a subset of the same data.
- Changing the existing `getPlayerProfile(playerId)` signature — extend via a sibling action, not a parameter expansion.

---

## File Structure

**Read (reference only):**

- `app/actions/player/getPlayerProfile.ts` — existing action; reused internally by the new handle action.
- `app/actions/match/getRecentGames.ts` — existing; consumed by `ProfileMatchHistoryList`.
- `lib/types/match.ts` — types `PlayerProfile`, `BestWord`, `MatchResult`, `RatingHistoryEntry` (Phase 5a).
- `components/ui/Avatar.tsx`, `components/ui/Card.tsx`, `components/ui/TopBar.tsx` (has `/profile` link).
- `app/(landing)/page.tsx` and `app/(lobby)/lobby/page.tsx` — patterns for Server Component + session redirect.

**Create:**

- `app/actions/player/getPlayerProfileByHandle.ts`
- `app/actions/player/getBestWords.ts`
- `tests/unit/app/actions/getPlayerProfileByHandle.test.ts`
- `tests/unit/app/actions/getBestWords.test.ts`
- `components/profile/ProfileSidebar.tsx`
- `components/profile/ProfileRatingChart.tsx`
- `components/profile/ProfileWordCloud.tsx`
- `components/profile/ProfileMatchHistoryList.tsx`
- `components/profile/ProfilePage.tsx`
- `tests/unit/components/profile/ProfileSidebar.test.tsx`
- `tests/unit/components/profile/ProfileRatingChart.test.tsx`
- `tests/unit/components/profile/ProfileWordCloud.test.tsx`
- `tests/unit/components/profile/ProfileMatchHistoryList.test.tsx`
- `tests/unit/components/profile/ProfilePage.test.tsx`
- `app/profile/page.tsx`
- `app/profile/[handle]/page.tsx`
- `tests/integration/app/profile-routes.test.ts`
- `tests/integration/ui/profile-page.spec.ts`

**Modify:**

- `CLAUDE.md` — flip Phase 5b status to In progress, add `components/profile` entry + the two new `app/profile/*` routes.

**Not touched:**

- Any `components/player/*` file (Phase 5a).
- `components/ui/TopBar.tsx` — link already exists.
- Any `supabase/migrations/*.sql`.

---

## Test commands (run after every task)

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit + integration suite.
- `pnpm exec playwright test --grep @profile-page` — smoke (new tag added in the last task).

---

## Task 1: `getPlayerProfileByHandle` Server Action

**Files:**
- Create: `app/actions/player/getPlayerProfileByHandle.ts`
- Create: `tests/unit/app/actions/getPlayerProfileByHandle.test.ts`

### Behavior

```ts
getPlayerProfileByHandle("ari") → Promise<GetPlayerProfileResult>
// Looks up player where lower(username) === handle.toLowerCase(),
// then delegates to getPlayerProfile(playerId).
// status: "ok" | "not_found" | "error".
```

- [ ] **Step 1: Write the failing test** (create `tests/unit/app/actions/getPlayerProfileByHandle.test.ts`)

Use the same `buildChain` pattern as `tests/unit/app/actions/getPlayerProfile.test.ts`. Mock `@/lib/supabase/server` and `@/lib/matchmaking/profile` (for `readLobbySession`). Additionally mock `@/app/actions/player/getPlayerProfile` so the test doesn't exercise the full aggregation — just verifies the handle → id hop.

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn().mockResolvedValue({
    token: "tok",
    issuedAt: Date.now(),
    player: {
      id: "viewer",
      username: "viewer",
      displayName: "Viewer",
      status: "available",
      lastSeenAt: new Date().toISOString(),
      eloRating: 1200,
      avatarUrl: null,
    },
  }),
}));
const getPlayerProfileMock = vi.fn();
vi.mock("@/app/actions/player/getPlayerProfile", () => ({
  getPlayerProfile: (...args: unknown[]) => getPlayerProfileMock(...args),
}));

import { getPlayerProfileByHandle } from "@/app/actions/player/getPlayerProfileByHandle";
import { getServiceRoleClient } from "@/lib/supabase/server";

function buildLookupChain(result: { data: { id: string } | null; error: unknown }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  getPlayerProfileMock.mockReset();
  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn(() => buildLookupChain({ data: { id: "p1" }, error: null })),
  } as never);
});

describe("getPlayerProfileByHandle", () => {
  test("looks up player by lowercased username and delegates to getPlayerProfile", async () => {
    getPlayerProfileMock.mockResolvedValue({
      status: "ok",
      profile: { identity: { id: "p1" } } as never,
    });
    const result = await getPlayerProfileByHandle("ARI");
    expect(getPlayerProfileMock).toHaveBeenCalledWith("p1");
    expect(result.status).toBe("ok");
  });

  test("returns not_found when no player matches the handle", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() => buildLookupChain({ data: null, error: null })),
    } as never);
    const result = await getPlayerProfileByHandle("ghost");
    expect(result.status).toBe("not_found");
    expect(getPlayerProfileMock).not.toHaveBeenCalled();
  });

  test("returns error when handle is empty", async () => {
    const result = await getPlayerProfileByHandle("");
    expect(result.status).toBe("error");
    expect(getPlayerProfileMock).not.toHaveBeenCalled();
  });

  test("returns error when handle is over 24 chars", async () => {
    const result = await getPlayerProfileByHandle("a".repeat(25));
    expect(result.status).toBe("error");
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (`Cannot find module`)

- [ ] **Step 3: Implement the action** (create `app/actions/player/getPlayerProfileByHandle.ts`)

```ts
"use server";

import "server-only";
import { z } from "zod";

import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import type { GetPlayerProfileResult } from "@/app/actions/player/getPlayerProfile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const handleSchema = z
  .string()
  .trim()
  .min(3, "Handle must be at least 3 characters.")
  .max(24, "Handle must be fewer than 25 characters.")
  .regex(
    /^[A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö0-9_-]+$/,
    "Invalid handle characters.",
  );

export async function getPlayerProfileByHandle(
  handle: string,
): Promise<GetPlayerProfileResult> {
  const parsed = handleSchema.safeParse(handle);
  if (!parsed.success) {
    return { status: "error", error: "Invalid handle." };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("username", parsed.data.toLowerCase())
    .maybeSingle();

  if (error) {
    return { status: "error", error: "Lookup failed." };
  }
  if (!data) {
    return { status: "not_found" };
  }

  return getPlayerProfile(data.id);
}
```

Note: `GetPlayerProfileResult` is already exported from `getPlayerProfile.ts`; re-use that type. The current action signature is `getPlayerProfile(playerId: string)`.

If `GetPlayerProfileResult` is not exported, add `export` to the interface in the existing file as a trivial amendment (note this in the commit message).

- [ ] **Step 4: Verify PASS, typecheck + lint clean**

```bash
pnpm test -- --run tests/unit/app/actions/getPlayerProfileByHandle.test.ts
pnpm typecheck
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add app/actions/player/getPlayerProfileByHandle.ts tests/unit/app/actions/getPlayerProfileByHandle.test.ts
git commit -m "feat(profile): add getPlayerProfileByHandle Server Action"
```

---

## Task 2: `getBestWords` Server Action

**Files:**
- Create: `app/actions/player/getBestWords.ts`
- Create: `tests/unit/app/actions/getBestWords.test.ts`

### Behavior

```ts
getBestWords(playerId: string, limit = 12) →
  Promise<{ status: "ok" | "error"; words?: { word: string; points: number }[]; error?: string }>
```

Aggregates from `word_score_entries`: for each distinct `word` produced by this player, take the **max `total_points`** row. Order by `total_points` desc and return top `limit`. If Supabase supports a GROUP BY via `.select("word, max(total_points) as points")`, use that; otherwise fetch rows ordered by `(word, total_points desc)` and de-duplicate client-side (keep first occurrence of each word).

- [ ] **Step 1: Failing test** (create `tests/unit/app/actions/getBestWords.test.ts`)

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn().mockResolvedValue({
    token: "tok",
    issuedAt: Date.now(),
    player: {
      id: "viewer",
      username: "viewer",
      displayName: "Viewer",
      status: "available",
      lastSeenAt: new Date().toISOString(),
      eloRating: 1200,
      avatarUrl: null,
    },
  }),
}));

import { getBestWords } from "@/app/actions/player/getBestWords";
import { getServiceRoleClient } from "@/lib/supabase/server";

type Row = { word: string; total_points: number };

function buildChain(rows: Row[]) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn(() => buildChain([])),
  } as never);
});

describe("getBestWords", () => {
  test("returns empty list when player has no scored words", async () => {
    const result = await getBestWords("p1");
    expect(result).toEqual({ status: "ok", words: [] });
  });

  test("dedupes by word keeping the highest-points row", async () => {
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() =>
        buildChain([
          { word: "KAFFI", total_points: 42 },
          { word: "BRAUÐ", total_points: 31 },
          { word: "KAFFI", total_points: 20 },
          { word: "SMJÖR", total_points: 28 },
        ]),
      ),
    } as never);
    const result = await getBestWords("p1", 10);
    expect(result.status).toBe("ok");
    expect(result.words).toEqual([
      { word: "KAFFI", points: 42 },
      { word: "BRAUÐ", points: 31 },
      { word: "SMJÖR", points: 28 },
    ]);
  });

  test("honours the limit parameter", async () => {
    const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({
      word: `WORD${i}`,
      total_points: 20 - i,
    }));
    vi.mocked(getServiceRoleClient).mockReturnValue({
      from: vi.fn(() => buildChain(rows)),
    } as never);
    const result = await getBestWords("p1", 5);
    expect(result.words).toHaveLength(5);
    expect(result.words?.[0]).toEqual({ word: "WORD0", points: 20 });
  });

  test("returns error when playerId is not a UUID", async () => {
    const result = await getBestWords("not-a-uuid");
    expect(result.status).toBe("error");
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement** (create `app/actions/player/getBestWords.ts`)

```ts
"use server";

import "server-only";
import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";

export interface BestWordEntry {
  word: string;
  points: number;
}

export interface GetBestWordsResult {
  status: "ok" | "error";
  words?: BestWordEntry[];
  error?: string;
}

const inputSchema = z.object({
  playerId: z.string().uuid(),
  limit: z.number().int().positive().max(100).default(12),
});

export async function getBestWords(
  playerId: string,
  limit = 12,
): Promise<GetBestWordsResult> {
  const parsed = inputSchema.safeParse({ playerId, limit });
  if (!parsed.success) {
    return { status: "error", error: "Invalid input." };
  }

  const supabase = getServiceRoleClient();
  // Fetch more than we need, then dedupe client-side by (word, max total_points).
  // Simpler than expressing GROUP BY through the supabase-js query builder.
  const { data, error } = await supabase
    .from("word_score_entries")
    .select("word, total_points")
    .eq("player_id", parsed.data.playerId)
    .order("total_points", { ascending: false })
    .limit(parsed.data.limit * 4);

  if (error) {
    return { status: "error", error: "Lookup failed." };
  }

  const seen = new Set<string>();
  const words: BestWordEntry[] = [];
  for (const row of (data ?? []) as { word: string; total_points: number }[]) {
    if (seen.has(row.word)) continue;
    seen.add(row.word);
    words.push({ word: row.word, points: row.total_points });
    if (words.length >= parsed.data.limit) break;
  }

  return { status: "ok", words };
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add app/actions/player/getBestWords.ts tests/unit/app/actions/getBestWords.test.ts
git commit -m "feat(profile): add getBestWords Server Action for word cloud"
```

---

## Task 3: `ProfileSidebar` component

**Files:**
- Create: `components/profile/ProfileSidebar.tsx`
- Create: `tests/unit/components/profile/ProfileSidebar.test.tsx`

### Visual spec

- 180px wide column.
- `<Avatar size="lg">` at the top.
- Italic Fraunces display name (large).
- Mono caption `@{username} · joined {YYYY}` where YYYY is derived from some timestamp (`identity.lastSeenAt` as a fallback if no `createdAt` field on the type).
- Rating block: mono eyebrow "RATING" + italic Fraunces 46px ochre-deep `{eloRating}` + small mono `peak {peakRating}`.
- `data-testid="profile-sidebar"`.

- [ ] **Step 1: Failing test** (`tests/unit/components/profile/ProfileSidebar.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileSidebar } from "@/components/profile/ProfileSidebar";
import type { PlayerProfile } from "@/lib/types/match";

const SAMPLE: PlayerProfile = {
  identity: {
    id: "p1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available",
    lastSeenAt: "2025-09-01T00:00:00Z",
    eloRating: 1234,
  },
  stats: {
    eloRating: 1234,
    gamesPlayed: 5,
    wins: 3,
    losses: 1,
    draws: 1,
    winRate: 0.75,
  },
  ratingTrend: [1200, 1234],
  bestWord: null,
  form: [],
  peakRating: 1250,
  ratingHistory: [],
};

describe("ProfileSidebar", () => {
  test("renders avatar, name, handle, and rating", () => {
    render(<ProfileSidebar profile={SAMPLE} />);
    expect(screen.getByTestId("profile-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText(/@ari/)).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  test("renders peak rating badge", () => {
    render(<ProfileSidebar profile={SAMPLE} />);
    expect(screen.getByText(/peak\s+1250/i)).toBeInTheDocument();
  });

  test("renders joined year from lastSeenAt", () => {
    render(<ProfileSidebar profile={SAMPLE} />);
    expect(screen.getByText(/joined\s+2025/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement** (`components/profile/ProfileSidebar.tsx`)

```tsx
import { Avatar } from "@/components/ui/Avatar";
import type { PlayerProfile } from "@/lib/types/match";

interface ProfileSidebarProps {
  profile: PlayerProfile;
}

export function ProfileSidebar({ profile }: ProfileSidebarProps) {
  const year = new Date(profile.identity.lastSeenAt).getUTCFullYear();
  return (
    <aside
      data-testid="profile-sidebar"
      className="flex w-full flex-col gap-6 sm:w-[180px]"
    >
      <div className="flex flex-col items-start gap-3">
        <Avatar
          playerId={profile.identity.id}
          displayName={profile.identity.displayName}
          avatarUrl={profile.identity.avatarUrl}
          size="lg"
        />
        <h1 className="font-display text-3xl font-semibold italic text-ink">
          {profile.identity.displayName}
        </h1>
        <p className="font-mono text-[11px] text-ink-soft">
          @{profile.identity.username} · joined {year}
        </p>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
          Rating
        </p>
        <p className="mt-1 font-display text-5xl font-semibold italic text-ochre-deep">
          {profile.stats.eloRating}
        </p>
        <p className="mt-1 font-mono text-[11px] text-ink-soft">
          peak {profile.peakRating}
        </p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Verify PASS, typecheck + lint clean**

- [ ] **Step 5: Commit**

```bash
git add components/profile/ProfileSidebar.tsx tests/unit/components/profile/ProfileSidebar.test.tsx
git commit -m "feat(profile): add ProfileSidebar component"
```

---

## Task 4: `ProfileRatingChart` component

**Files:**
- Create: `components/profile/ProfileRatingChart.tsx`
- Create: `tests/unit/components/profile/ProfileRatingChart.test.tsx`

### Visual spec

- SVG canvas, fluid width, fixed 220px height.
- Horizontal dashed grid lines at rating quartiles (min, 25%, 50%, 75%, max).
- `<path fill="url(#grad)" d="…" />` area under the line (gradient from `ochre-deep/30` at top to `ochre-deep/0` at bottom).
- `<path stroke="ochre-deep" stroke-width="2" fill="none" d="…" />` line on top of the area.
- Circle dot at the last point (`r=5`, fill ochre-deep).
- Empty-history fallback: render a single centered text "No rated matches yet" inside the SVG frame.
- `data-testid="profile-rating-chart"`.

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";

describe("ProfileRatingChart", () => {
  test("renders empty-state message when history is empty", () => {
    render(<ProfileRatingChart history={[]} />);
    expect(screen.getByText(/No rated matches/i)).toBeInTheDocument();
  });

  test("renders a line path + area path when history has entries", () => {
    const history = [
      { recordedAt: "2026-01-01T00:00:00Z", rating: 1200 },
      { recordedAt: "2026-01-02T00:00:00Z", rating: 1250 },
      { recordedAt: "2026-01-03T00:00:00Z", rating: 1234 },
    ];
    const { container } = render(<ProfileRatingChart history={history} />);
    const paths = container.querySelectorAll("path");
    // Expect both area-fill path and line-stroke path.
    expect(paths.length).toBeGreaterThanOrEqual(2);
    // Endpoint dot.
    expect(container.querySelector("circle")).not.toBeNull();
  });

  test("renders 4 dashed grid lines", () => {
    const history = [
      { recordedAt: "2026-01-01T00:00:00Z", rating: 1200 },
      { recordedAt: "2026-01-02T00:00:00Z", rating: 1250 },
    ];
    const { container } = render(<ProfileRatingChart history={history} />);
    const dashed = container.querySelectorAll('line[stroke-dasharray]');
    expect(dashed.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement** (`components/profile/ProfileRatingChart.tsx`)

```tsx
import type { RatingHistoryEntry } from "@/lib/types/match";

interface ProfileRatingChartProps {
  history: RatingHistoryEntry[];
}

const VIEWBOX_W = 600;
const VIEWBOX_H = 220;
const PAD_X = 24;
const PAD_Y = 16;

export function ProfileRatingChart({ history }: ProfileRatingChartProps) {
  if (history.length === 0) {
    return (
      <div
        data-testid="profile-rating-chart"
        className="flex h-[220px] w-full items-center justify-center rounded-xl border border-hair bg-paper-2 text-sm text-ink-soft"
      >
        No rated matches yet.
      </div>
    );
  }

  const ratings = history.map((h) => h.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const range = max - min || 1;

  const xStep =
    history.length > 1
      ? (VIEWBOX_W - PAD_X * 2) / (history.length - 1)
      : 0;

  const points = history.map((h, i) => {
    const x = PAD_X + i * xStep;
    const y =
      VIEWBOX_H -
      PAD_Y -
      ((h.rating - min) / range) * (VIEWBOX_H - PAD_Y * 2);
    return { x, y, rating: h.rating };
  });

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD =
    `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${VIEWBOX_H - PAD_Y} ` +
    `L ${points[0].x.toFixed(1)} ${VIEWBOX_H - PAD_Y} Z`;

  const gridYs = [0.2, 0.4, 0.6, 0.8].map(
    (t) => PAD_Y + t * (VIEWBOX_H - PAD_Y * 2),
  );

  const endpoint = points[points.length - 1];

  return (
    <svg
      data-testid="profile-rating-chart"
      role="img"
      aria-label="Rating history chart"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      className="h-[220px] w-full rounded-xl border border-hair bg-paper-2"
    >
      <defs>
        <linearGradient id="rating-chart-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ochre-deep)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--ochre-deep)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridYs.map((y) => (
        <line
          key={y}
          x1={PAD_X}
          x2={VIEWBOX_W - PAD_X}
          y1={y}
          y2={y}
          stroke="var(--hair)"
          strokeDasharray="3 4"
        />
      ))}
      <path d={areaD} fill="url(#rating-chart-grad)" />
      <path
        d={lineD}
        fill="none"
        stroke="var(--ochre-deep)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={endpoint.x} cy={endpoint.y} r={5} fill="var(--ochre-deep)" />
    </svg>
  );
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add components/profile/ProfileRatingChart.tsx tests/unit/components/profile/ProfileRatingChart.test.tsx
git commit -m "feat(profile): add ProfileRatingChart SVG line + area chart"
```

---

## Task 5: `ProfileWordCloud` component

**Files:**
- Create: `components/profile/ProfileWordCloud.tsx`
- Create: `tests/unit/components/profile/ProfileWordCloud.test.tsx`

### Visual spec

- Flex-wrap of word tags.
- Font-size formula: `16 + points * 0.5` (px). Clamp to 16–40.
- Top-3 words (by points) render in `text-ochre-deep`; rest `text-ink`.
- Gap 8px horizontal, 6px vertical.
- Empty state: "No scored words yet."
- `data-testid="profile-word-cloud"`.

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileWordCloud } from "@/components/profile/ProfileWordCloud";

describe("ProfileWordCloud", () => {
  test("renders one tag per word", () => {
    render(
      <ProfileWordCloud
        words={[
          { word: "KAFFI", points: 42 },
          { word: "BRAUÐ", points: 31 },
        ]}
      />,
    );
    expect(screen.getAllByTestId("word-cloud-item")).toHaveLength(2);
  });

  test("applies ochre-deep class to top-3 words", () => {
    render(
      <ProfileWordCloud
        words={[
          { word: "A", points: 40 },
          { word: "B", points: 30 },
          { word: "C", points: 20 },
          { word: "D", points: 10 },
        ]}
      />,
    );
    const items = screen.getAllByTestId("word-cloud-item");
    expect(items[0].className).toContain("ochre-deep");
    expect(items[2].className).toContain("ochre-deep");
    expect(items[3].className).not.toContain("ochre-deep");
  });

  test("clamps font-size to 40px for high-points words", () => {
    render(<ProfileWordCloud words={[{ word: "HUGE", points: 999 }]} />);
    const item = screen.getByTestId("word-cloud-item");
    expect(item.style.fontSize).toBe("40px");
  });

  test("renders empty state when words list is empty", () => {
    render(<ProfileWordCloud words={[]} />);
    expect(screen.getByText(/No scored words/i)).toBeInTheDocument();
    expect(screen.queryAllByTestId("word-cloud-item")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement** (`components/profile/ProfileWordCloud.tsx`)

```tsx
import type { BestWord } from "@/lib/types/match";

interface ProfileWordCloudProps {
  words: BestWord[];
}

function fontSizeFor(points: number): number {
  const raw = 16 + points * 0.5;
  return Math.min(40, Math.max(16, Math.round(raw)));
}

export function ProfileWordCloud({ words }: ProfileWordCloudProps) {
  if (words.length === 0) {
    return (
      <div
        data-testid="profile-word-cloud"
        className="rounded-xl border border-hair bg-paper-2 px-4 py-6 text-center text-sm text-ink-soft"
      >
        No scored words yet.
      </div>
    );
  }

  return (
    <div
      data-testid="profile-word-cloud"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-2"
    >
      {words.map((w, i) => {
        const isTopThree = i < 3;
        const colorClass = isTopThree ? "text-ochre-deep" : "text-ink";
        return (
          <span
            key={`${w.word}-${i}`}
            data-testid="word-cloud-item"
            className={`font-display font-semibold ${colorClass}`}
            style={{ fontSize: `${fontSizeFor(w.points)}px` }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add components/profile/ProfileWordCloud.tsx tests/unit/components/profile/ProfileWordCloud.test.tsx
git commit -m "feat(profile): add ProfileWordCloud component"
```

---

## Task 6: `ProfileMatchHistoryList` component

**Files:**
- Create: `components/profile/ProfileMatchHistoryList.tsx`
- Create: `tests/unit/components/profile/ProfileMatchHistoryList.test.tsx`

### Visual spec

- List of rows; each row: W/L/D chip (matching `ProfileFormChips` colours), `@opponentUsername`, score `yourScore - opponentScore`, "{n} ago" relative time.
- "Replay →" link at row end — stubbed, renders as a disabled span with `(soon)`.
- Empty state: "No recent matches."
- `data-testid="profile-match-history"`.

Input type — reuse `RecentGameRow` from `getRecentGames`:

```ts
interface RecentGameRow {
  matchId: string;
  result: "win" | "loss" | "draw";
  opponentId: string;
  opponentUsername: string;
  opponentDisplayName: string;
  yourScore: number;
  opponentScore: number;
  wordsFound: number;
  completedAt: string;
}
```

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileMatchHistoryList } from "@/components/profile/ProfileMatchHistoryList";

const ROWS = [
  {
    matchId: "m1",
    result: "win" as const,
    opponentId: "o1",
    opponentUsername: "birna",
    opponentDisplayName: "Birna",
    yourScore: 42,
    opponentScore: 18,
    wordsFound: 7,
    completedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    matchId: "m2",
    result: "loss" as const,
    opponentId: "o2",
    opponentUsername: "jon",
    opponentDisplayName: "Jón",
    yourScore: 12,
    opponentScore: 48,
    wordsFound: 2,
    completedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

describe("ProfileMatchHistoryList", () => {
  test("renders one row per match", () => {
    render(<ProfileMatchHistoryList matches={ROWS} />);
    expect(screen.getAllByTestId("match-history-row")).toHaveLength(2);
  });

  test("renders W/L chip per row", () => {
    render(<ProfileMatchHistoryList matches={ROWS} />);
    expect(
      screen.getByTestId("match-history-chip-m1").textContent?.trim(),
    ).toBe("W");
    expect(
      screen.getByTestId("match-history-chip-m2").textContent?.trim(),
    ).toBe("L");
  });

  test("renders opponent username + score", () => {
    render(<ProfileMatchHistoryList matches={ROWS} />);
    expect(screen.getByText(/@birna/)).toBeInTheDocument();
    expect(screen.getByText(/42\s*[–-]\s*18/)).toBeInTheDocument();
  });

  test("renders empty state when matches is empty", () => {
    render(<ProfileMatchHistoryList matches={[]} />);
    expect(screen.getByText(/No recent matches/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement** (`components/profile/ProfileMatchHistoryList.tsx`)

```tsx
import type { RecentGameRow } from "@/app/actions/match/getRecentGames";

interface ProfileMatchHistoryListProps {
  matches: RecentGameRow[];
}

const CHIP_STYLE: Record<RecentGameRow["result"], string> = {
  win: "bg-good/25 text-good",
  loss: "bg-bad/25 text-bad",
  draw: "bg-paper-2 text-ink-3",
};
const CHIP_LABEL: Record<RecentGameRow["result"], string> = {
  win: "W",
  loss: "L",
  draw: "D",
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function ProfileMatchHistoryList({
  matches,
}: ProfileMatchHistoryListProps) {
  if (matches.length === 0) {
    return (
      <div
        data-testid="profile-match-history"
        className="rounded-xl border border-hair bg-paper-2 px-4 py-6 text-center text-sm text-ink-soft"
      >
        No recent matches.
      </div>
    );
  }
  return (
    <ul
      data-testid="profile-match-history"
      className="flex flex-col divide-y divide-hair rounded-xl border border-hair bg-paper"
    >
      {matches.map((m) => (
        <li
          key={m.matchId}
          data-testid="match-history-row"
          className="flex items-center gap-4 px-4 py-3"
        >
          <span
            data-testid={`match-history-chip-${m.matchId}`}
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-sm font-mono text-[10px] font-semibold ${CHIP_STYLE[m.result]}`}
          >
            {CHIP_LABEL[m.result]}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
            @{m.opponentUsername}
          </span>
          <span className="font-mono text-sm text-ink">
            {m.yourScore} – {m.opponentScore}
          </span>
          <span className="font-mono text-[11px] text-ink-soft">
            {relativeTime(m.completedAt)}
          </span>
          <span className="font-mono text-[11px] text-ink-soft/60">
            Replay → (soon)
          </span>
        </li>
      ))}
    </ul>
  );
}
```

If `RecentGameRow` is not exported from `getRecentGames.ts`, add the `export` keyword.

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add components/profile/ProfileMatchHistoryList.tsx tests/unit/components/profile/ProfileMatchHistoryList.test.tsx
git commit -m "feat(profile): add ProfileMatchHistoryList component"
```

---

## Task 7: `ProfilePage` shared layout

**Files:**
- Create: `components/profile/ProfilePage.tsx`
- Create: `tests/unit/components/profile/ProfilePage.test.tsx`

### Layout (CSS grid)

- Desktop: `grid-cols-[200px_1fr] gap-10`.
- Mobile: single column, sidebar on top.
- Main column children: stats grid → rating chart → word cloud → match history.
- `data-testid="profile-page"`.

### Props

```ts
interface ProfilePageProps {
  profile: PlayerProfile;
  words: BestWord[];
  matches: RecentGameRow[];
}
```

- [ ] **Step 1: Failing test** (mocks the child components so we just assert composition)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/profile/ProfileSidebar", () => ({
  ProfileSidebar: () => <div data-testid="stub-sidebar" />,
}));
vi.mock("@/components/profile/ProfileRatingChart", () => ({
  ProfileRatingChart: () => <div data-testid="stub-chart" />,
}));
vi.mock("@/components/profile/ProfileWordCloud", () => ({
  ProfileWordCloud: () => <div data-testid="stub-cloud" />,
}));
vi.mock("@/components/profile/ProfileMatchHistoryList", () => ({
  ProfileMatchHistoryList: () => <div data-testid="stub-matches" />,
}));

import { ProfilePage } from "@/components/profile/ProfilePage";
import type { PlayerProfile } from "@/lib/types/match";

const PROFILE = {
  identity: {
    id: "p1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available",
    lastSeenAt: "2025-09-01T00:00:00Z",
    eloRating: 1234,
  },
  stats: {
    eloRating: 1234,
    gamesPlayed: 9,
    wins: 5,
    losses: 3,
    draws: 1,
    winRate: 5 / 8,
  },
  ratingTrend: [1200, 1234],
  bestWord: null,
  form: [],
  peakRating: 1250,
  ratingHistory: [],
} as PlayerProfile;

describe("ProfilePage", () => {
  test("mounts sidebar + chart + cloud + matches", () => {
    render(<ProfilePage profile={PROFILE} words={[]} matches={[]} />);
    expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    expect(screen.getByTestId("stub-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("stub-chart")).toBeInTheDocument();
    expect(screen.getByTestId("stub-cloud")).toBeInTheDocument();
    expect(screen.getByTestId("stub-matches")).toBeInTheDocument();
  });

  test("renders at-a-glance stats grid with win-rate percentage", () => {
    render(<ProfilePage profile={PROFILE} words={[]} matches={[]} />);
    expect(screen.getByText(/63%|62%/)).toBeInTheDocument(); // 5/8 = 62.5% rounds to 63
    expect(screen.getByText("9")).toBeInTheDocument(); // games played
    expect(screen.getByText("5")).toBeInTheDocument(); // wins
    expect(screen.getByText("1250")).toBeInTheDocument(); // peak rating
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Implement** (`components/profile/ProfilePage.tsx`)

```tsx
import type { RecentGameRow } from "@/app/actions/match/getRecentGames";
import { ProfileMatchHistoryList } from "@/components/profile/ProfileMatchHistoryList";
import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";
import { ProfileSidebar } from "@/components/profile/ProfileSidebar";
import { ProfileWordCloud } from "@/components/profile/ProfileWordCloud";
import type { BestWord, PlayerProfile } from "@/lib/types/match";

interface ProfilePageProps {
  profile: PlayerProfile;
  words: BestWord[];
  matches: RecentGameRow[];
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-hair bg-paper-2 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export function ProfilePage({ profile, words, matches }: ProfilePageProps) {
  const { stats, peakRating, ratingHistory } = profile;
  const winRatePct =
    stats.winRate !== null ? `${Math.round(stats.winRate * 100)}%` : "—";

  return (
    <main
      data-testid="profile-page"
      className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 sm:grid-cols-[200px_1fr] sm:px-8 sm:py-12"
    >
      <ProfileSidebar profile={profile} />

      <div className="flex flex-col gap-8">
        <section
          aria-label="At-a-glance stats"
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
        >
          <StatTile label="Matches" value={stats.gamesPlayed} />
          <StatTile label="Wins" value={stats.wins} />
          <StatTile label="Losses" value={stats.losses} />
          <StatTile label="Win rate" value={winRatePct} />
          <StatTile label="Peak" value={peakRating} />
        </section>

        <section aria-label="Rating history">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">
            Rating
          </h2>
          <ProfileRatingChart history={ratingHistory} />
        </section>

        <section aria-label="Best words">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">
            Best words
          </h2>
          <ProfileWordCloud words={words} />
        </section>

        <section aria-label="Recent matches">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">
            Recent matches
          </h2>
          <ProfileMatchHistoryList matches={matches} />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add components/profile/ProfilePage.tsx tests/unit/components/profile/ProfilePage.test.tsx
git commit -m "feat(profile): add ProfilePage shared layout"
```

---

## Task 8: `/profile` own-profile route

**Files:**
- Create: `app/profile/page.tsx`

### Behavior

- Server Component.
- Calls `readLobbySession()` → redirect to `/` if null.
- Fetches `getPlayerProfile(session.player.id)`, `getBestWords(session.player.id)`, `getRecentGames({ playerId: session.player.id, limit: 10 })` in parallel.
- If profile result is not `ok`, shows a simple error page (the session should never lookup to missing, but guard anyway).
- Otherwise renders `<ProfilePage profile={...} words={...} matches={...} />`.

- [ ] **Step 1: Implement**

```tsx
import { redirect } from "next/navigation";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getBestWords } from "@/app/actions/player/getBestWords";
import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function OwnProfilePage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }

  const [profileResult, bestWordsResult, recentGamesResult] = await Promise.all(
    [
      getPlayerProfile(session.player.id),
      getBestWords(session.player.id, 12),
      getRecentGames({ playerId: session.player.id, limit: 10 }),
    ],
  );

  if (profileResult.status !== "ok" || !profileResult.profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-bad">
          Profile unavailable
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          {profileResult.error ?? "Try again in a moment."}
        </p>
      </main>
    );
  }

  return (
    <ProfilePage
      profile={profileResult.profile}
      words={bestWordsResult.words ?? []}
      matches={recentGamesResult.games ?? []}
    />
  );
}
```

- [ ] **Step 2: Run typecheck + the integration route test (added in Task 9)**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat(profile): add /profile own-profile route"
```

---

## Task 9: `/profile/[handle]` public-profile route

**Files:**
- Create: `app/profile/[handle]/page.tsx`
- Create: `tests/integration/app/profile-routes.test.ts`

### Behavior

- Server Component.
- Reads `params.handle`.
- No session gate — public. (Still readable by unauthenticated visitors in principle, but the TopBar itself requires a session today; revisit in Phase 6 if needed.)
- Calls `getPlayerProfileByHandle(handle)`; on `not_found` renders a 404-style "No such player" page.
- Otherwise fetches `getBestWords(profile.identity.id)` + `getRecentGames({ playerId: profile.identity.id, limit: 10 })` in parallel.

- [ ] **Step 1: Failing route test**

Create `tests/integration/app/profile-routes.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
}));

vi.mock("@/app/actions/player/getPlayerProfile", () => ({
  getPlayerProfile: vi.fn(),
}));

vi.mock("@/app/actions/player/getPlayerProfileByHandle", () => ({
  getPlayerProfileByHandle: vi.fn(),
}));

vi.mock("@/app/actions/player/getBestWords", () => ({
  getBestWords: vi.fn(async () => ({ status: "ok", words: [] })),
}));

vi.mock("@/app/actions/match/getRecentGames", () => ({
  getRecentGames: vi.fn(async () => ({ games: [] })),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import { getPlayerProfileByHandle } from "@/app/actions/player/getPlayerProfileByHandle";
import OwnProfilePage from "@/app/profile/page";
import PublicProfilePage from "@/app/profile/[handle]/page";

const FAKE_PROFILE = {
  identity: {
    id: "p1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available",
    lastSeenAt: "2026-01-01T00:00:00Z",
    eloRating: 1234,
  },
  stats: {
    eloRating: 1234,
    gamesPlayed: 1,
    wins: 1,
    losses: 0,
    draws: 0,
    winRate: 1,
  },
  ratingTrend: [],
  bestWord: null,
  form: [],
  peakRating: 1234,
  ratingHistory: [],
};

describe("/profile route", () => {
  test("redirects to / when no session", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(OwnProfilePage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  test("renders profile page when session + profile exist", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce({
      token: "tok",
      issuedAt: Date.now(),
      player: FAKE_PROFILE.identity,
    });
    vi.mocked(getPlayerProfile).mockResolvedValueOnce({
      status: "ok",
      profile: FAKE_PROFILE,
    } as never);
    const element = await OwnProfilePage();
    expect(element).toBeTruthy();
  });
});

describe("/profile/[handle] route", () => {
  test("renders 'No such player' when handle has no match", async () => {
    vi.mocked(getPlayerProfileByHandle).mockResolvedValueOnce({
      status: "not_found",
    } as never);
    const element = await PublicProfilePage({
      params: Promise.resolve({ handle: "ghost" }),
    });
    expect(element).toBeTruthy();
  });

  test("renders profile page when handle resolves", async () => {
    vi.mocked(getPlayerProfileByHandle).mockResolvedValueOnce({
      status: "ok",
      profile: FAKE_PROFILE,
    } as never);
    const element = await PublicProfilePage({
      params: Promise.resolve({ handle: "ari" }),
    });
    expect(element).toBeTruthy();
  });
});
```

Note: Next.js 16 dynamic route params are passed as a Promise (`{ params: Promise<{ handle: string }> }`). The test should `await` them. If your Next.js version treats params as sync, simplify accordingly — check a reference route under `app/match/[matchId]/page.tsx` for the project's convention.

- [ ] **Step 2: Verify FAIL** (module not found for `@/app/profile/[handle]/page`)

- [ ] **Step 3: Implement** (`app/profile/[handle]/page.tsx`)

```tsx
import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getBestWords } from "@/app/actions/player/getBestWords";
import { getPlayerProfileByHandle } from "@/app/actions/player/getPlayerProfileByHandle";
import { ProfilePage } from "@/components/profile/ProfilePage";

interface Params {
  handle: string;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;
  const profileResult = await getPlayerProfileByHandle(handle);

  if (profileResult.status === "not_found") {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-ink">No such player</h1>
        <p className="mt-2 text-sm text-ink-3">
          @{handle} hasn&apos;t played a round here yet.
        </p>
      </main>
    );
  }
  if (profileResult.status !== "ok" || !profileResult.profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-bad">Profile unavailable</h1>
        <p className="mt-2 text-sm text-ink-3">
          {profileResult.error ?? "Try again in a moment."}
        </p>
      </main>
    );
  }

  const [bestWordsResult, recentGamesResult] = await Promise.all([
    getBestWords(profileResult.profile.identity.id, 12),
    getRecentGames({
      playerId: profileResult.profile.identity.id,
      limit: 10,
    }),
  ]);

  return (
    <ProfilePage
      profile={profileResult.profile}
      words={bestWordsResult.words ?? []}
      matches={recentGamesResult.games ?? []}
    />
  );
}
```

Check `app/match/[matchId]/page.tsx` first for the correct params signature — copy whichever convention is in use (Promise vs sync).

- [ ] **Step 4: Verify PASS**

- [ ] **Step 5: Commit**

```bash
git add app/profile/\[handle\]/page.tsx tests/integration/app/profile-routes.test.ts
git commit -m "feat(profile): add /profile/[handle] public-profile route"
```

---

## Task 10: `@profile-page` Playwright smoke

**Files:**
- Create: `tests/integration/ui/profile-page.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, type BrowserContext } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Phase 5b profile page smoke runs on chromium only",
);

async function loginAs(context: BrowserContext, prefix: string) {
  const page = await context.newPage();
  const username = generateTestUsername(prefix);
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
  await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
  return { page, username };
}

test.describe("@profile-page Phase 5b profile pages", () => {
  test("/profile renders own profile for authenticated viewer", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    try {
      const { page } = await loginAs(ctx, "prof-own");
      await page.goto("/profile");
      await expect(page.getByTestId("profile-page")).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByTestId("profile-sidebar")).toBeVisible();
      await expect(page.getByTestId("profile-rating-chart")).toBeVisible();
      await expect(page.getByTestId("profile-word-cloud")).toBeVisible();
      await expect(page.getByTestId("profile-match-history")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("/profile redirects to / when unauthenticated", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await page.goto("/profile");
      await expect(page).toHaveURL(/^[^/]+:\/\/[^/]+\/?$/, {
        timeout: 10_000,
      });
    } finally {
      await ctx.close();
    }
  });

  test("/profile/[handle] renders a public profile by username", async ({
    browser,
  }) => {
    // First create a user so the handle exists.
    const seedCtx = await browser.newContext();
    const { username } = await loginAs(seedCtx, "prof-public");
    await seedCtx.close();

    // Now visit /profile/<username> from a fresh (possibly unauthenticated)
    // context. Use a logged-in context so TopBar renders without redirect.
    const viewerCtx = await browser.newContext();
    try {
      const { page: viewerPage } = await loginAs(viewerCtx, "prof-viewer");
      await viewerPage.goto(`/profile/${username}`);
      await expect(viewerPage.getByTestId("profile-page")).toBeVisible({
        timeout: 10_000,
      });
      await expect(viewerPage.getByText(`@${username}`)).toBeVisible();
    } finally {
      await viewerCtx.close();
    }
  });

  test("/profile/ghost renders 'No such player' for unknown handle", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    try {
      const { page } = await loginAs(ctx, "prof-404");
      await page.goto("/profile/thisuserdoesnotexist");
      await expect(page.getByText(/No such player/i)).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await ctx.close();
    }
  });
});
```

Keep auth usage modest to stay within the 5/min rate limit — the four tests above create 5 users total (seeds + viewers), which may occasionally trip the limiter. If it does, add a `beforeAll` that creates a shared authed page per test as was done in `profile-modal.spec.ts`.

- [ ] **Step 2: Run the spec**

```bash
pnpm exec playwright test --grep @profile-page tests/integration/ui/profile-page.spec.ts
```

Expected: 4 PASS on chromium.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/ui/profile-page.spec.ts
git commit -m "test(profile): add @profile-page Playwright smoke"
```

---

## Task 11: CLAUDE.md + PR

- [ ] **Step 1: Update CLAUDE.md**

In the Phase table:

```
| 5a | Profile modal refresh — sparkline, best word, form chips, Challenge CTA | Merged |
| 5b | `/profile` + `/profile/[handle]` pages + rating chart + word cloud | In progress |
```

Under Critical Directories `/app`:

```
  - `/app/profile` — own profile + /[handle] public profile pages
```

Under `/components`:

```
  - `/components/profile` — `ProfileSidebar`, `ProfileRatingChart`, `ProfileWordCloud`, `ProfileMatchHistoryList`, `ProfilePage` *(Phase 5b)*
```

- [ ] **Step 2: Push + open PR**

```bash
git add CLAUDE.md
git commit -m "docs(claude): reflect Phase 5b profile pages"

git push -u origin 026-profile-page-phase-5b

gh pr create --title "feat(profile): /profile + /profile/[handle] pages (Phase 5b)" --body "..."
```

PR body should summarise: two new routes, two new Server Actions, five new presentational components, TopBar Profile link now live.

---

## Verification (end-to-end)

After every commit is green, run locally:

```bash
pnpm build
pnpm start
```

Then in a browser:

1. Log in as user A.
2. Click "Profile" in the TopBar → `/profile` loads; verify sidebar + stats + chart + word cloud + match history.
3. Navigate directly to `/profile/<user-A-username>` → same layout, but publicly accessed (viewer is still logged in; public-without-session is a future consideration).
4. Navigate to `/profile/ghost-user-that-does-not-exist` → "No such player".
5. Clear cookies, navigate to `/profile` → redirected to `/`.
6. Navigate to `/profile/<existing-user>` while logged out → renders public profile successfully (if the chart is empty for a fresh player, confirm the "No rated matches yet" fallback).

## Acceptance criteria

- [x] `/profile` redirects unauthenticated → `/`, renders own profile otherwise.
- [x] `/profile/[handle]` resolves by username, 404 fallback for unknown handles.
- [x] `ProfilePage` renders sidebar + stats + chart + word cloud + match history responsively.
- [x] Rating chart renders SVG with line + area + grid + endpoint dot; empty state works.
- [x] Word cloud sizes by `16 + pts * 0.5` clamped 16–40px; top-3 ochre-deep.
- [x] Match history uses W/L/D chips + opponent + score + relative time + "(soon)" replay stub.
- [x] `getPlayerProfileByHandle` returns correct status for valid/invalid/missing handles; uses existing `getPlayerProfile` for the full aggregation.
- [x] `getBestWords` dedupes by word (keeps max-points row); respects `limit`.
- [x] Full unit + integration suite passes; typecheck + lint clean.
- [x] `@profile-page` Playwright smoke green on chromium.
- [x] CLAUDE.md Phase table + directory index updated; plan file committed.

## Critical files referenced

- `app/actions/player/getPlayerProfile.ts` — delegated to by Task 1.
- `app/actions/match/getRecentGames.ts` — consumed by Tasks 6, 8, 9.
- `components/ui/Avatar.tsx`, `components/ui/TopBar.tsx`.
- `app/match/[matchId]/page.tsx` — Next.js 16 dynamic-params convention reference.
- `tests/unit/app/actions/getPlayerProfile.test.ts` — `buildChain` mock pattern.
- `tests/integration/ui/profile-modal.spec.ts` — chromium-scoped dual-session pattern.
- `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §5 — design spec.
