# Phase 5a — Profile Modal (Warm Editorial refresh) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

**Why this change is being made.** The existing `PlayerProfileModal` (shipped in spec 017 "Elo + Ratings") is a functional but plain lobby drill-in: elo number + 4-stat grid + a tiny 5-game trend. The Warm Editorial redesign spec §5 (docs/superpowers/specs/2026-04-19-wottle-design-implementation.md:198–230) calls for a richer modal — bar-height sparkline of rating history, a "best word" tile, a 10-square W/L/D form strip, and a "Challenge {first-name} →" CTA that reuses the existing invite flow.

Phase 5a scope is **only the modal refresh** (decided over combined 5a+5b so the extended data shape can ship and validate before `/profile` + `/profile/[handle]` pages consume it in Phase 5b).

**Intended outcome.** Clicking any lobby card's username opens a modal that matches the Warm Editorial prototype (`docs/design_documentation/wottle-game-design/project/prototype/screens/Profile.jsx`) — ochre-deep rating emphasis, sparkline, form chips, best word, Challenge + Later buttons. No visual regressions to the lobby. All data derives on-the-fly from existing tables (`players`, `match_ratings`, `word_score_entries`) — no migrations.

---

## Goal

Evolve `components/player/PlayerProfileModal.tsx` and `app/actions/player/getPlayerProfile.ts` to deliver the Warm Editorial modal, and wire its Challenge CTA to the existing `InviteDialog variant="send"` path already owned by `LobbyList`.

## Architecture

1. **Server side:** Extend `getPlayerProfile(playerId)` to return `{ bestWord, form, peakRating, ratingHistory }` in addition to today's `{ identity, stats, ratingTrend }`. All derived via queries against `match_ratings` (ordered by `created_at`), `word_score_entries` (aggregated by `player_id, word` → max `total_points`), and `matches` (joined on `match_ratings.match_id` for `form` and W/L/D per game). No new tables; Option B from the spec.
2. **Client side:** Split the modal into presentational sub-components — `ProfileStatGrid`, `ProfileSparkline`, `ProfileFormChips`, `ProfileActions` — so each piece is independently testable and the modal itself stays under ~120 lines. Reuse `@/components/ui/Dialog`, `@/components/ui/Avatar`, `@/components/ui/Button`.
3. **Challenge CTA:** Lift the modal's Challenge handler through `onChallenge(playerId)` (new prop), wired in `LobbyList.tsx` the same way card Challenge buttons already are (`handleChallenge` already exists at `components/lobby/LobbyList.tsx:207–214`).

## Tech Stack

TypeScript 5.x, React 19 Client Components, Next.js 16 Server Actions, Supabase JS v2, Zod, Tailwind CSS 4 (Phase 1a theme tokens — `text-ochre-deep`, `font-display`, `font-mono`, W/L/D color tokens from globals), Vitest + React Testing Library, Playwright.

## Branch

`025-profile-modal-phase-5a`, branched from `origin/main` after PR #137 + PR #134 (Phase 4b) have merged.

---

## Scope decisions

**In scope:**

1. Extend `getPlayerProfile` return shape: add `bestWord`, `form` (last 10), `peakRating`, `ratingHistory` (all `match_ratings` entries with timestamp + rating).
2. Update the existing unit tests for `getPlayerProfile` to cover the new fields.
3. Three new presentational sub-components: `ProfileSparkline`, `ProfileFormChips`, `ProfileActions` (+ the existing `ProfileStatGrid` shape preserved but expanded to include "Best word").
4. Rewrite `PlayerProfileModal.tsx` to compose the sub-components per the Warm Editorial design.
5. Thread `onChallenge` from `LobbyList` to the modal so the Challenge CTA reuses the existing invite flow.
6. Playwright `@profile-modal` smoke covering: card-click opens modal, modal shows sparkline + form chips + best word, clicking Later closes, clicking Challenge opens the invite dialog.

**Deferred to Phase 5b:**

- `/profile` and `/profile/[handle]` routes.
- `ProfilePage` shared layout, full SVG rating chart with area fill + dashed grid + endpoint dot.
- Word cloud component + `getBestWords(playerId, limit)` Server Action.
- Full match history list.
- TopBar "Profile" link activation (link exists but renders the 404 today).

**Explicitly not in scope:**

- `rating_history` table migration (Option A from spec). Keep Option B on-the-fly derivation.
- "Replay →" link on match history — stubbed as "(soon)" in the full page; modal doesn't show match history at all.
- Internationalisation.

---

## File Structure

**Read (no changes expected):**

- `components/player/PlayerProfileModal.tsx` — current implementation; Task 5 rewrites it.
- `app/actions/player/getPlayerProfile.ts` — current implementation; Task 1 extends it.
- `tests/unit/app/actions/getPlayerProfile.test.ts` — expand in Task 2.
- `components/ui/Dialog.tsx` — API: `open`, `onClose`, `ariaLabelledBy`, `bottomSheetOnMobile` (default true).
- `components/ui/Avatar.tsx` — sizes: `sm` | `md` | `lg`; props: `playerId`, `displayName`, `avatarUrl`, `size`.
- `components/lobby/LobbyList.tsx:207–214` — existing `handleChallenge(playerId)` that opens `InviteDialog variant="send"`.

**Create:**

- `components/player/ProfileSparkline.tsx` — reusable bar sparkline.
- `components/player/ProfileFormChips.tsx` — 10-square W/L/D strip.
- `components/player/ProfileActions.tsx` — Challenge + Later buttons row.
- `tests/unit/components/player/ProfileSparkline.test.tsx`
- `tests/unit/components/player/ProfileFormChips.test.tsx`
- `tests/unit/components/player/ProfileActions.test.tsx`
- `tests/integration/ui/profile-modal.spec.ts` — `@profile-modal` Playwright smoke.

**Modify:**

- `app/actions/player/getPlayerProfile.ts` — extended query + response shape.
- `tests/unit/app/actions/getPlayerProfile.test.ts` — cover new fields.
- `components/player/PlayerProfileModal.tsx` — rewrite to compose sub-components.
- `components/lobby/LobbyList.tsx` — pass `onChallenge={handleChallenge}` to `<PlayerProfileModal>`.

**Not touched:**

- `components/player/PlayerProfileModal.test.tsx` (if it exists — update inline as part of the modal rewrite task).
- Any `supabase/migrations/*.sql` file.
- `InviteDialog` send path.

---

## Test commands (run after every task)

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit suite.
- `pnpm exec playwright test --grep @profile-modal` — Phase 5a smoke (new tag added in Task 8).

---

## Task 1: Extend `getPlayerProfile` response shape

**Files:**
- Modify: `app/actions/player/getPlayerProfile.ts`

**Before touching anything, read the current file** to learn the existing return shape and its Zod schema. Preserve every existing field.

- [ ] **Step 1: Define the extended types**

At the top of the file (alongside existing types), add:

```ts
export interface BestWord {
  word: string;
  points: number;
}

export type MatchResult = "W" | "L" | "D";

export interface RatingHistoryEntry {
  recordedAt: string; // ISO
  rating: number;
}
```

- [ ] **Step 2: Extend the returned `PlayerProfile`**

Add four fields to the existing `PlayerProfile` type (keep everything that was there):

```ts
export interface PlayerProfile {
  // ...existing identity + stats + ratingTrend fields...
  bestWord: BestWord | null;
  form: MatchResult[]; // length 0..10, newest first
  peakRating: number;
  ratingHistory: RatingHistoryEntry[]; // all entries, oldest first
}
```

- [ ] **Step 3: Add the aggregations**

Inside `getPlayerProfile(playerId)`, after the existing query calls, add three queries that share the service-role client:

```ts
// Full rating history (oldest first) + peak
const { data: ratingRows } = await supabase
  .from("match_ratings")
  .select("rating_after, created_at")
  .eq("player_id", playerId)
  .order("created_at", { ascending: true });

const ratingHistory: RatingHistoryEntry[] = (ratingRows ?? []).map((r) => ({
  recordedAt: r.created_at as string,
  rating: r.rating_after as number,
}));

const peakRating = ratingHistory.reduce(
  (max, entry) => Math.max(max, entry.rating),
  identity.eloRating ?? 1200,
);

// Last 10 match results → form chips (newest first)
const { data: formRows } = await supabase
  .from("match_ratings")
  .select("match_result, created_at")
  .eq("player_id", playerId)
  .order("created_at", { ascending: false })
  .limit(10);

const RESULT_MAP: Record<"win" | "loss" | "draw", MatchResult> = {
  win: "W",
  loss: "L",
  draw: "D",
};
const form: MatchResult[] = (formRows ?? []).map(
  (r) => RESULT_MAP[r.match_result as "win" | "loss" | "draw"],
);

// Best word = single max-points row this player ever produced
const { data: bestWordRows } = await supabase
  .from("word_score_entries")
  .select("word, total_points")
  .eq("player_id", playerId)
  .order("total_points", { ascending: false })
  .limit(1);

const bestWord: BestWord | null =
  bestWordRows?.[0]
    ? { word: bestWordRows[0].word as string, points: bestWordRows[0].total_points as number }
    : null;
```

Return the extended profile object with `bestWord`, `form`, `peakRating`, `ratingHistory` appended to the existing payload.

- [ ] **Step 4: Update Zod (if the action exports a schema)**

If the file exports a `playerProfileSchema`, extend it to include the four new keys with the correct types. If the file only has a TypeScript interface, this step is a no-op.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/actions/player/getPlayerProfile.ts
git commit -m "feat(profile): extend getPlayerProfile with bestWord, form, peakRating, ratingHistory"
```

---

## Task 2: Update unit tests for `getPlayerProfile`

**Files:**
- Modify: `tests/unit/app/actions/getPlayerProfile.test.ts`

Read the existing file to learn the established mock-chain pattern used across `tests/unit/app/actions/*.test.ts` (it uses `vi.mock("@/lib/supabase/server", …)` with a `buildChain` factory — see `tests/unit/app/actions/getTopPlayers.test.ts:11–23` for the canonical shape).

- [ ] **Step 1: Extend the Supabase `from()` mock to dispatch three new tables/query shapes**

In the existing `beforeEach`, wire `from(table)` to return chain factories for:
- `from("match_ratings")` with `.select(...).eq("player_id", ...).order(..., { ascending: true })` returning the full ratingHistory rows.
- A second call shape `from("match_ratings")` chained `.select(...).eq(...).order(..., { ascending: false }).limit(10)` returning form rows.
- `from("word_score_entries")` chained `.select(...).eq(...).order(...).limit(1)` returning best-word rows.

Keep the existing mock for `from("players")`.

- [ ] **Step 2: Add four tests**

```tsx
test("returns peakRating as the max of rating history and current elo", async () => {
  // Seed ratingHistory with ascending rating_after: [1180, 1210, 1190]
  // Current identity.eloRating: 1205
  // Assert: result.profile.peakRating === 1210
});

test("returns form as last 10 match results mapped to W/L/D (newest first)", async () => {
  // Seed: win, draw, loss, win → result.profile.form === ["W", "D", "L", "W"]
});

test("returns bestWord when word_score_entries has at least one row", async () => {
  // Seed: { word: "KAFFI", total_points: 42 }
  // Assert: result.profile.bestWord === { word: "KAFFI", points: 42 }
});

test("returns bestWord=null when the player has no word_score_entries", async () => {
  // Seed: []
  // Assert: result.profile.bestWord === null
});
```

For each test, flesh out the mock fixture rows using snake_case column names matching the DB schema (`rating_after`, `created_at`, `match_result`, `total_points`).

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --run tests/unit/app/actions/getPlayerProfile.test.ts`
Expected: PASS (all existing tests + 4 new).

- [ ] **Step 4: Commit**

```bash
git add tests/unit/app/actions/getPlayerProfile.test.ts
git commit -m "test(profile): cover bestWord, form, peakRating, ratingHistory aggregations"
```

---

## Task 3: `ProfileSparkline` component

**Files:**
- Create: `components/player/ProfileSparkline.tsx`
- Create: `tests/unit/components/player/ProfileSparkline.test.tsx`

### Visual spec (from `Profile.jsx:31–42`)

- Horizontal row of thin bars, one per entry in `ratings`.
- Bar height: `8 + ((value - min) / (max - min)) * 46` px → range 8–54px. If `min === max`, use a flat 24px.
- Last bar: `bg-ochre-deep`; others: `bg-p2` at 50% opacity.
- Mono eyebrow below: `Peak {peak} · Now {current}`.
- Wrapper: `data-testid="profile-sparkline"`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileSparkline } from "@/components/player/ProfileSparkline";

describe("ProfileSparkline", () => {
  test("renders one bar per rating entry", () => {
    render(
      <ProfileSparkline
        ratings={[1180, 1200, 1220, 1195]}
        peak={1220}
        current={1195}
      />,
    );
    expect(screen.getAllByTestId("sparkline-bar")).toHaveLength(4);
  });

  test("renders the peak + current eyebrow", () => {
    render(
      <ProfileSparkline ratings={[1200]} peak={1200} current={1200} />,
    );
    expect(screen.getByText(/Peak\s+1220|Peak\s+1200/i)).toBeInTheDocument();
    expect(screen.getByText(/Now\s+1200/i)).toBeInTheDocument();
  });

  test("handles empty ratings gracefully (renders placeholder)", () => {
    render(<ProfileSparkline ratings={[]} peak={1200} current={1200} />);
    expect(screen.getByTestId("profile-sparkline")).toBeInTheDocument();
    expect(screen.queryAllByTestId("sparkline-bar")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test -- --run tests/unit/components/player/ProfileSparkline.test.tsx`
Expected: FAIL with `Cannot find module '@/components/player/ProfileSparkline'`.

- [ ] **Step 3: Create the component**

```tsx
interface ProfileSparklineProps {
  ratings: number[];
  peak: number;
  current: number;
}

export function ProfileSparkline({
  ratings,
  peak,
  current,
}: ProfileSparklineProps) {
  const min = ratings.length > 0 ? Math.min(...ratings) : 0;
  const max = ratings.length > 0 ? Math.max(...ratings) : 1;
  const range = max - min;
  const lastIndex = ratings.length - 1;

  return (
    <div
      data-testid="profile-sparkline"
      className="flex flex-col gap-2"
      aria-label="Rating history sparkline"
    >
      <div className="flex h-[54px] items-end gap-[3px]">
        {ratings.map((value, index) => {
          const height =
            range === 0 ? 24 : 8 + ((value - min) / range) * 46;
          const isLast = index === lastIndex;
          return (
            <span
              key={`${index}-${value}`}
              data-testid="sparkline-bar"
              className={`w-[6px] rounded-sm ${
                isLast ? "bg-ochre-deep" : "bg-p2/50"
              }`}
              style={{ height: `${height}px` }}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Peak {peak} · Now {current}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test -- --run tests/unit/components/player/ProfileSparkline.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/player/ProfileSparkline.tsx tests/unit/components/player/ProfileSparkline.test.tsx
git commit -m "feat(profile): add ProfileSparkline component"
```

---

## Task 4: `ProfileFormChips` component

**Files:**
- Create: `components/player/ProfileFormChips.tsx`
- Create: `tests/unit/components/player/ProfileFormChips.test.tsx`

### Visual spec (from `Profile.jsx:45–59`)

- 10 square chips, 22×22px, rounded-sm, mono text.
- `W`: `bg-good/25`, `text-good`.
- `L`: `bg-bad/25`, `text-bad`.
- `D`: `bg-paper-2`, `text-ink-3`.
- If fewer than 10 entries, pad with empty placeholder chips (`bg-paper-2/30`, no text).
- Wrapper: `data-testid="profile-form-chips"`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileFormChips } from "@/components/player/ProfileFormChips";

describe("ProfileFormChips", () => {
  test("renders one chip per W/L/D entry", () => {
    render(<ProfileFormChips form={["W", "W", "L", "D"]} />);
    const chips = screen
      .getAllByTestId("form-chip")
      .filter((c) => c.textContent?.trim().length ?? 0 > 0);
    expect(chips.map((c) => c.textContent?.trim())).toEqual(["W", "W", "L", "D"]);
  });

  test("pads to 10 chips with empty placeholders when form is shorter", () => {
    render(<ProfileFormChips form={["W"]} />);
    expect(screen.getAllByTestId("form-chip")).toHaveLength(10);
  });

  test("renders 10 chips for a full-form input", () => {
    render(
      <ProfileFormChips
        form={["W", "W", "L", "D", "W", "L", "W", "W", "D", "L"]}
      />,
    );
    expect(screen.getAllByTestId("form-chip")).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test -- --run tests/unit/components/player/ProfileFormChips.test.tsx`
Expected: FAIL with module resolution error.

- [ ] **Step 3: Create the component**

```tsx
import type { MatchResult } from "@/app/actions/player/getPlayerProfile";

interface ProfileFormChipsProps {
  form: MatchResult[]; // newest first
}

const STYLE: Record<MatchResult, string> = {
  W: "bg-good/25 text-good",
  L: "bg-bad/25 text-bad",
  D: "bg-paper-2 text-ink-3",
};

export function ProfileFormChips({ form }: ProfileFormChipsProps) {
  const chips: (MatchResult | null)[] = Array.from(
    { length: 10 },
    (_, i) => form[i] ?? null,
  );

  return (
    <div
      data-testid="profile-form-chips"
      className="flex flex-wrap gap-1"
      aria-label="Last 10 match results"
    >
      {chips.map((result, i) => (
        <span
          key={i}
          data-testid="form-chip"
          className={`flex h-[22px] w-[22px] items-center justify-center rounded-sm font-mono text-[10px] font-semibold ${
            result ? STYLE[result] : "bg-paper-2/30"
          }`}
        >
          {result ?? ""}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test -- --run tests/unit/components/player/ProfileFormChips.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/player/ProfileFormChips.tsx tests/unit/components/player/ProfileFormChips.test.tsx
git commit -m "feat(profile): add ProfileFormChips component"
```

---

## Task 5: `ProfileActions` component (Challenge + Later)

**Files:**
- Create: `components/player/ProfileActions.tsx`
- Create: `tests/unit/components/player/ProfileActions.test.tsx`

### Visual spec (from `Profile.jsx:62–68`)

- Two buttons side by side.
- Primary: `Challenge {firstName} →` — uses `@/components/ui/Button` default primary variant.
- Ghost: `Later` — uses `variant="ghost"`.
- When viewing own profile (`isSelf={true}`), the Challenge button is hidden and only "Close" is shown.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { ProfileActions } from "@/components/player/ProfileActions";

describe("ProfileActions", () => {
  test("renders Challenge {firstName} when not viewing self", () => {
    render(
      <ProfileActions
        firstName="Ari"
        isSelf={false}
        onChallenge={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Challenge Ari/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Later/i })).toBeInTheDocument();
  });

  test("hides Challenge button when viewing self", () => {
    render(
      <ProfileActions
        firstName="Ari"
        isSelf={true}
        onChallenge={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Challenge/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  test("clicking Challenge invokes onChallenge", async () => {
    const onChallenge = vi.fn();
    render(
      <ProfileActions
        firstName="Ari"
        isSelf={false}
        onChallenge={onChallenge}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Challenge Ari/i }),
    );
    expect(onChallenge).toHaveBeenCalledTimes(1);
  });

  test("clicking Later invokes onClose", async () => {
    const onClose = vi.fn();
    render(
      <ProfileActions
        firstName="Ari"
        isSelf={false}
        onChallenge={vi.fn()}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Later/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test -- --run tests/unit/components/player/ProfileActions.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Create the component**

```tsx
import { Button } from "@/components/ui/Button";

interface ProfileActionsProps {
  firstName: string;
  isSelf: boolean;
  onChallenge: () => void;
  onClose: () => void;
}

export function ProfileActions({
  firstName,
  isSelf,
  onChallenge,
  onClose,
}: ProfileActionsProps) {
  if (isSelf) {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose}>
        Later
      </Button>
      <Button onClick={onChallenge}>{`Challenge ${firstName} →`}</Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test -- --run tests/unit/components/player/ProfileActions.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/player/ProfileActions.tsx tests/unit/components/player/ProfileActions.test.tsx
git commit -m "feat(profile): add ProfileActions (Challenge + Later / Close)"
```

---

## Task 6: Rewrite `PlayerProfileModal`

**Files:**
- Modify: `components/player/PlayerProfileModal.tsx`
- Modify: `tests/unit/components/player/PlayerProfileModal.test.tsx` (if present — update; otherwise create)

**Before touching:** read the current modal file to understand its fetch pattern (`useEffect` + `getPlayerProfile`), loading/error states, and testids. Preserve loading and error UI but layer the new sub-components on top.

### Visual layout (from `Profile.jsx`)

```
┌───────────────────────────────────────┐
│ [Avatar 84px]  [eyebrow: "Player profile"]
│                {displayName} (italic)
│                @{handle} · member since {YYYY}
│ ─────────────────────────────────────
│ [StatGrid: Rating (ochre-deep), Wins, Losses, Best word]
│ [ProfileSparkline]
│ [ProfileFormChips]
│ [ProfileActions]
└───────────────────────────────────────┘
```

- [ ] **Step 1: Update the modal's props**

```ts
interface PlayerProfileModalProps {
  playerId: string;
  viewerId: string;              // session player id, to detect isSelf
  onClose: () => void;
  onChallenge: (playerId: string) => void;
}
```

`viewerId` is the session user's id (so the modal knows whether the caller is viewing their own profile and should swap "Challenge" for "Close"). `onChallenge` is lifted from `LobbyList`'s existing `handleChallenge`.

- [ ] **Step 2: Rewrite the render tree**

Replace the existing body layout with:

```tsx
"use client";

import { useEffect, useId, useState } from "react";

import { Dialog } from "@/components/ui/Dialog";
import { Avatar } from "@/components/ui/Avatar";
import { ProfileSparkline } from "@/components/player/ProfileSparkline";
import { ProfileFormChips } from "@/components/player/ProfileFormChips";
import { ProfileActions } from "@/components/player/ProfileActions";
import {
  getPlayerProfile,
  type PlayerProfile,
} from "@/app/actions/player/getPlayerProfile";

interface PlayerProfileModalProps {
  playerId: string;
  viewerId: string;
  onClose: () => void;
  onChallenge: (playerId: string) => void;
}

export function PlayerProfileModal({
  playerId,
  viewerId,
  onClose,
  onChallenge,
}: PlayerProfileModalProps) {
  const titleId = useId();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getPlayerProfile(playerId);
      if (cancelled) return;
      if (result.status === "ok" && result.profile) {
        setProfile(result.profile);
      } else {
        setError(result.error ?? "Unable to load profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const isSelf = viewerId === playerId;
  const firstName =
    profile?.identity.displayName?.split(/\s+/)[0] ??
    profile?.identity.username ??
    "Player";

  return (
    <Dialog open onClose={onClose} ariaLabelledBy={titleId}>
      {profile ? (
        <div
          data-testid="player-profile-modal"
          className="flex flex-col gap-6"
        >
          <header className="flex items-start gap-4">
            <Avatar
              playerId={profile.identity.id}
              displayName={profile.identity.displayName}
              avatarUrl={profile.identity.avatarUrl}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                {isSelf ? "Your profile" : "Player profile"}
              </p>
              <h2
                id={titleId}
                className="font-display text-3xl font-semibold italic text-ink"
              >
                {profile.identity.displayName}
              </h2>
              <p className="font-mono text-[11px] text-ink-soft">
                @{profile.identity.username}
              </p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Rating" value={profile.stats.elo} emphasised />
            <StatTile label="Wins" value={profile.stats.wins} />
            <StatTile label="Losses" value={profile.stats.losses} />
            <BestWordTile bestWord={profile.bestWord} />
          </div>

          <ProfileSparkline
            ratings={profile.ratingHistory.map((r) => r.rating)}
            peak={profile.peakRating}
            current={profile.stats.elo}
          />

          <ProfileFormChips form={profile.form} />

          <ProfileActions
            firstName={firstName}
            isSelf={isSelf}
            onChallenge={() => onChallenge(playerId)}
            onClose={onClose}
          />
        </div>
      ) : error ? (
        <div role="alert" data-testid="player-profile-modal-error">
          <p id={titleId} className="font-display text-lg text-bad">
            Unable to load profile
          </p>
          <p className="mt-2 text-sm text-ink-3">{error}</p>
        </div>
      ) : (
        <div data-testid="player-profile-modal-loading">
          <p id={titleId} className="font-display text-lg text-ink">
            Loading profile…
          </p>
        </div>
      )}
    </Dialog>
  );
}

function StatTile({
  label,
  value,
  emphasised,
}: {
  label: string;
  value: number | string;
  emphasised?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hair bg-paper-2 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          emphasised ? "text-ochre-deep" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function BestWordTile({ bestWord }: { bestWord: PlayerProfile["bestWord"] }) {
  return (
    <div className="rounded-xl border border-hair bg-paper-2 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Best word
      </p>
      {bestWord ? (
        <>
          <p className="mt-1 font-display text-xl font-semibold text-ink">
            {bestWord.word}
          </p>
          <p className="font-mono text-[10px] text-ink-soft">
            {bestWord.points} pts
          </p>
        </>
      ) : (
        <p className="mt-1 font-display text-xl text-ink-soft">—</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update (or create) the component test**

If `tests/unit/components/player/PlayerProfileModal.test.tsx` exists, update it; otherwise create it. Mock `getPlayerProfile` and render the modal with a seeded profile.

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerProfile } from "@/app/actions/player/getPlayerProfile";

const getPlayerProfileMock = vi.fn();
vi.mock("@/app/actions/player/getPlayerProfile", () => ({
  getPlayerProfile: (...args: unknown[]) => getPlayerProfileMock(...args),
}));

import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";

const SAMPLE: PlayerProfile = {
  identity: {
    id: "p1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available",
    lastSeenAt: new Date().toISOString(),
    eloRating: 1234,
  },
  stats: { elo: 1234, gamesPlayed: 5, wins: 3, losses: 1, draws: 1, winRate: 60 },
  ratingTrend: [1200, 1210, 1234],
  bestWord: { word: "KAFFI", points: 42 },
  form: ["W", "W", "L", "D", "W"],
  peakRating: 1250,
  ratingHistory: [
    { recordedAt: "2026-04-01T10:00:00Z", rating: 1200 },
    { recordedAt: "2026-04-02T10:00:00Z", rating: 1250 },
    { recordedAt: "2026-04-03T10:00:00Z", rating: 1234 },
  ],
};

beforeEach(() => {
  getPlayerProfileMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlayerProfileModal", () => {
  test("renders stats, sparkline, form chips, and Challenge CTA for non-self", async () => {
    getPlayerProfileMock.mockResolvedValue({ status: "ok", profile: SAMPLE });
    render(
      <PlayerProfileModal
        playerId="p1"
        viewerId="p2"
        onClose={vi.fn()}
        onChallenge={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("player-profile-modal")).toBeInTheDocument(),
    );
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText("@ari")).toBeInTheDocument();
    expect(screen.getByText("KAFFI")).toBeInTheDocument();
    expect(screen.getByTestId("profile-sparkline")).toBeInTheDocument();
    expect(screen.getByTestId("profile-form-chips")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Challenge Ari/i }),
    ).toBeInTheDocument();
  });

  test("swaps Challenge for Close when viewerId === playerId", async () => {
    getPlayerProfileMock.mockResolvedValue({ status: "ok", profile: SAMPLE });
    render(
      <PlayerProfileModal
        playerId="p1"
        viewerId="p1"
        onClose={vi.fn()}
        onChallenge={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Your profile/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /Challenge/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  test("Challenge invokes onChallenge with playerId", async () => {
    getPlayerProfileMock.mockResolvedValue({ status: "ok", profile: SAMPLE });
    const onChallenge = vi.fn();
    render(
      <PlayerProfileModal
        playerId="p1"
        viewerId="p2"
        onClose={vi.fn()}
        onChallenge={onChallenge}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("player-profile-modal")).toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Challenge Ari/i }),
    );
    expect(onChallenge).toHaveBeenCalledWith("p1");
  });

  test("shows error state when getPlayerProfile fails", async () => {
    getPlayerProfileMock.mockResolvedValue({
      status: "error",
      error: "Database offline",
    });
    render(
      <PlayerProfileModal
        playerId="p1"
        viewerId="p2"
        onClose={vi.fn()}
        onChallenge={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("player-profile-modal-error")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Database offline/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests + typecheck + lint**

```bash
pnpm test -- --run tests/unit/components/player/PlayerProfileModal.test.tsx
pnpm typecheck
pnpm lint
```

All green.

- [ ] **Step 5: Commit**

```bash
git add components/player/PlayerProfileModal.tsx tests/unit/components/player/PlayerProfileModal.test.tsx
git commit -m "feat(profile): rewrite PlayerProfileModal to Warm Editorial design"
```

---

## Task 7: Wire `onChallenge` + `viewerId` through `LobbyList`

**Files:**
- Modify: `components/lobby/LobbyList.tsx`

`LobbyList.tsx` already owns `handleChallenge(playerId)` (it opens `<InviteDialog variant="send" opponent={...} />`). Reuse it.

- [ ] **Step 1: Pass the new props**

Find the existing mount block:

```tsx
{profilePlayerId ? (
  <PlayerProfileModal
    playerId={profilePlayerId}
    onClose={() => setProfilePlayerId(null)}
  />
) : null}
```

Replace with:

```tsx
{profilePlayerId ? (
  <PlayerProfileModal
    playerId={profilePlayerId}
    viewerId={currentPlayer.id}
    onClose={() => setProfilePlayerId(null)}
    onChallenge={(playerId) => {
      setProfilePlayerId(null);
      handleChallenge(playerId);
    }}
  />
) : null}
```

The local `handleChallenge` is already defined in the file (around line 207). It looks up the opponent in the presence store and opens the send-invite dialog.

- [ ] **Step 2: Run typecheck + unit suite**

```bash
pnpm typecheck
pnpm test -- --run
```

Expected: exit 0, no regressions.

- [ ] **Step 3: Commit**

```bash
git add components/lobby/LobbyList.tsx
git commit -m "feat(lobby): wire PlayerProfileModal Challenge CTA through LobbyList"
```

---

## Task 8: `@profile-modal` Playwright smoke

**Files:**
- Create: `tests/integration/ui/profile-modal.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, type BrowserContext } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

async function loginAs(context: BrowserContext, prefix: string) {
  const page = await context.newPage();
  const username = generateTestUsername(prefix);
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
  await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
  return { page, username };
}

test.describe("@profile-modal Phase 5a modal", () => {
  test("clicking a lobby card opens the profile modal with stats + sparkline + form chips", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([
        loginAs(ctxA, "prof-alpha"),
        loginAs(ctxB, "prof-beta"),
      ]);
      // Wait for Player B's card to appear on Player A's lobby
      await expect(
        a.page
          .getByTestId("lobby-card")
          .filter({ hasText: `@${b.username}` }),
      ).toBeVisible({ timeout: 15_000 });
      // Click the username button inside Player B's card
      await a.page
        .getByTestId("lobby-card")
        .filter({ hasText: `@${b.username}` })
        .getByTestId("lobby-username-btn")
        .click();
      // Modal renders
      await expect(a.page.getByTestId("player-profile-modal")).toBeVisible({
        timeout: 10_000,
      });
      await expect(a.page.getByTestId("profile-sparkline")).toBeVisible();
      await expect(a.page.getByTestId("profile-form-chips")).toBeVisible();
      await expect(
        a.page.getByRole("button", { name: new RegExp(`Challenge `, "i") }),
      ).toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("Later closes the modal without opening the invite flow", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([
        loginAs(ctxA, "prof-close-a"),
        loginAs(ctxB, "prof-close-b"),
      ]);
      await a.page
        .getByTestId("lobby-card")
        .filter({ hasText: `@${b.username}` })
        .getByTestId("lobby-username-btn")
        .click();
      await expect(a.page.getByTestId("player-profile-modal")).toBeVisible({
        timeout: 10_000,
      });
      await a.page.getByRole("button", { name: /Later/i }).click();
      await expect(a.page.getByTestId("player-profile-modal")).toBeHidden({
        timeout: 5_000,
      });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("Challenge opens the InviteDialog send flow", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([
        loginAs(ctxA, "prof-ch-a"),
        loginAs(ctxB, "prof-ch-b"),
      ]);
      await a.page
        .getByTestId("lobby-card")
        .filter({ hasText: `@${b.username}` })
        .getByTestId("lobby-username-btn")
        .click();
      await expect(a.page.getByTestId("player-profile-modal")).toBeVisible({
        timeout: 10_000,
      });
      await a.page
        .getByRole("button", { name: new RegExp(`Challenge `, "i") })
        .click();
      // InviteDialog send confirms via data-testid="invite-dialog-confirm"
      await expect(
        a.page.getByTestId("invite-dialog-confirm"),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm exec playwright test --grep @profile-modal tests/integration/ui/profile-modal.spec.ts
```

Expected: 3 tests pass (or 6 if both chromium + playtest-firefox run — scope to chromium via `test.skip({ browserName }, …)` if cross-project races surface, matching the pattern in `matchmaking-phase-4b.spec.ts`).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/ui/profile-modal.spec.ts
git commit -m "test(profile): add @profile-modal Playwright smoke"
```

---

## Task 9: CLAUDE.md + PR

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Phase table row**

Change Phase 5's status:

```
| 5a | Profile modal refresh — sparkline, best word, form chips, Challenge CTA | In progress |
| 5b | `/profile` + `/profile/[handle]` pages + rating chart + word cloud | Planned |
| 6  | Disconnection modal + claim-win Server Action | Planned |
```

- [ ] **Step 2: Update the components/player line**

Find the existing `components/player` entry under Critical Directories and extend it:

```
  - `/components/player` — `PlayerProfileModal`, `ProfileSparkline`, `ProfileFormChips`, `ProfileActions` *(Phase 5a refresh)*
```

- [ ] **Step 3: Commit + push + PR**

```bash
git add CLAUDE.md
git commit -m "docs(claude): reflect Phase 5a profile modal refresh"

git push -u origin 025-profile-modal-phase-5a

gh pr create --title "feat(profile): Warm Editorial modal refresh (Phase 5a)" --body "## Summary

- Rewrites PlayerProfileModal to match the Warm Editorial prototype (docs/superpowers/specs/2026-04-19-wottle-design-implementation.md §5).
- Extends getPlayerProfile to return bestWord, form (last 10), peakRating, ratingHistory — all derived on-the-fly from match_ratings + word_score_entries (no migrations).
- Adds three presentational sub-components: ProfileSparkline, ProfileFormChips, ProfileActions.
- Wires the Challenge CTA through LobbyList to reuse the existing InviteDialog send path.

Phase 5b (/profile + /profile/[handle] pages) follows as a separate PR.

## Test plan

- [x] Unit: getPlayerProfile aggregations, sparkline, form chips, actions, modal.
- [x] Playwright @profile-modal: card click → modal renders, Later closes, Challenge opens invite dialog.
- [x] pnpm typecheck + pnpm lint clean.
- [ ] Manual: verify sparkline bars scale, ochre-deep rating emphasis, form chips colour W/L/D correctly.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Verification (end-to-end)

Run locally after the last commit:

```bash
pnpm install
pnpm build
pnpm dev  # serves http://localhost:3000
```

Then in two browsers (or one + incognito):

1. Log in as two different users (navigate to `/`, submit unique usernames).
2. On Browser A: click Browser B's username in the lobby directory. The profile modal should render with:
   - Large Fraunces italic display name + `@username` mono caption.
   - Four stat tiles: Rating (ochre-deep), Wins, Losses, Best word (shows "—" if the player has no word scores yet).
   - Sparkline row of bars (flat or mostly flat for a brand-new player; last bar ochre-deep).
   - 10 form chips — mostly empty placeholders for a new player.
   - "Later" (ghost) + "Challenge {firstName} →" (primary) buttons.
3. Click Later — modal closes, lobby unchanged.
4. Click the card again, click Challenge → the `InviteDialog variant="send"` ("Challenge {name}" with "Send invite" button) opens.
5. On Browser A: click your own username. The modal shows "Your profile" eyebrow and a single "Close" button (no Challenge).
6. Programmatic: `pnpm lint && pnpm typecheck && pnpm test -- --run && pnpm exec playwright test --grep @profile-modal` — all green.

## Acceptance criteria

- [x] `getPlayerProfile` returns the four new fields with correct aggregations (verified by unit tests).
- [x] `PlayerProfileModal` renders the Warm Editorial layout: header block, 4-stat grid (ochre-deep rating), sparkline, form chips, actions.
- [x] Challenge CTA hidden on self-view; replaced by a Close button.
- [x] Challenge click opens the existing `InviteDialog variant="send"` for that opponent.
- [x] No migrations; no schema changes.
- [x] Full unit suite + typecheck + lint green; Playwright `@profile-modal` green.
- [x] CLAUDE.md Phase table + `components/player` entry updated.

---

## Critical files referenced

- `components/player/PlayerProfileModal.tsx` — rewritten in Task 6.
- `app/actions/player/getPlayerProfile.ts` — extended in Task 1.
- `components/lobby/LobbyList.tsx:207–214` — existing `handleChallenge` reused in Task 7.
- `components/ui/Dialog.tsx` — modal primitive, unchanged.
- `components/ui/Avatar.tsx` — `size="lg"` (16×16) used in the modal header.
- `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §5 — design source of truth.
- `docs/design_documentation/wottle-game-design/project/prototype/screens/Profile.jsx` — pixel-level reference.
- `supabase/migrations/20260315001_elo_rating.sql` — schema for `match_ratings` (Task 1 queries it).
- `tests/unit/app/actions/getTopPlayers.test.ts` — canonical mock-chain pattern for Task 2.
