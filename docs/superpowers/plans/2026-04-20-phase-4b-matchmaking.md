# Phase 4b — Matchmaking Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the auto-queue flow off the lobby onto a dedicated `/matchmaking` route with three phases — `searching` (rotating ring + expanding rating window), `found` (vs-block with both avatars), and `starting` (auto-navigate to the match). Keep the existing 3-second polling transport; add a thin `cancelQueueAction` so bailing returns the player to `available`.

**Architecture:** `PlayNowCard`'s "Play Now" button stops starting the queue inline and instead navigates to `/matchmaking` (the server page gates on the session cookie). `MatchmakingClient` owns the phase state machine, polls `startQueueAction()` every 3s until it returns `status: "matched"`, then fetches the opponent identity via a new `getMatchOverviewAction(matchId)` to render `found`, holds for 2s, transitions to `starting`, and navigates to `/match/[matchId]`. Cancelling calls `cancelQueueAction()` to reset the player's server-side status. No new realtime channels — polling stays.

**Tech Stack:** Next.js 16 App Router, React 19 Client Components (`useEffect` polling), existing `startAutoQueue` from `lib/matchmaking/inviteService.ts`, new thin Server Actions, CSS keyframe animation for the rotating ring (GPU-accelerated, no Framer Motion), Vitest + React Testing Library, Playwright.

**Branch:** `024-matchmaking-phase-4b`, branched from `origin/main` **after** Phase 4a (PR #TBD) is merged, so `PlayNowCard` is already touched-free of the login cleanup churn.

**Prerequisites:**

- Design spec: `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §4 Phase 4.
- Prototype reference: `docs/design_documentation/wottle-game-design/project/prototype/screens/Matchmaking.jsx`.
- Existing queue server action: `app/actions/matchmaking/startQueue.ts` (`startQueueAction`, `QueueActionState`). Re-used verbatim.
- Existing service: `lib/matchmaking/inviteService.ts` lines 287–380 (`startAutoQueue`). Reused verbatim.
- Player identity shape: `lib/types/match.ts` (`PlayerIdentity`).
- Phase 4a ships `/`'s landing — `/matchmaking`'s unauth redirect target is `/`.
- Current inline matchmaking lives in `components/lobby/PlayNowCard.tsx` lines 55–128 (polling + local status). That code is **moved**, not duplicated.

**Test commands (run after every task):**

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit + integration suite.
- `pnpm exec playwright test --grep @matchmaking` — new tag added in Task 10.

---

## Scope decisions

**In scope:**

1. Server Action `cancelQueueAction()` — returns the current player's status to `available` if they're `matchmaking`. No-op if they're already `available` or `in_match`.
2. Server Action `getMatchOverviewAction(matchId)` → `{ self: PlayerIdentity, opponent: PlayerIdentity }`. Reads `matches` + `players`; authorises that the caller is one of the two players; 404 if not a participant.
3. Component `MatchRing` — decorative rotating-border ring with the viewer's avatar centered. GPU-accelerated `@keyframes` rotation.
4. Component `MatchmakingClient` — the phase state machine (`searching | found | starting`), poll loop, cancel button, auto-navigation.
5. Component `MatchmakingVsBlock` — shared view between `found` and `starting` phases: two avatars + italic `vs` + both names + ratings + subtitle.
6. Page `app/matchmaking/page.tsx` — Server Component, redirects to `/` if no session; otherwise renders `MatchmakingClient` seeded with `session.player`.
7. Update `components/lobby/PlayNowCard.tsx` — replace inline queue logic with a `router.push("/matchmaking")` on click. Delete the inline `queuing` state, `handleCancel`, status message, elapsed ticker, and polling `useEffect`. Keep mode pills, Elo badge, and `inMatch` disabled state.
8. Playwright `@matchmaking` smoke — lobby "Play Now" → matchmaking ring visible → match found → navigates to `/match/[id]`.
9. Unit tests for every new component + the state machine.
10. Integration tests for the two new server actions.

**Deferred:**

- Realtime matchmaking channel (option b from brainstorming). We keep the 3-second polling loop that ships today. If realtime is needed later, `MatchmakingClient` is the only caller to change.
- Rating-window visualisation as a real Elo filter server-side — the UI shows the expanding `±N` number purely cosmetically; the queue itself still uses `startAutoQueue`'s first-come-first-served selection.
- Multi-region / skill-based matching.
- Cancelled-by-opponent state. If the opponent times out between `found` and `starting`, we still navigate to the match and let the existing match screen handle disconnection (Phase 6 owns the disconnect modal).
- Spectate button (prototype "(soon)").

---

## File Structure

**Create:**

- `app/actions/matchmaking/cancelQueue.ts` — Server Action.
- `app/actions/matchmaking/getMatchOverview.ts` — Server Action.
- `tests/integration/actions/cancelQueue.test.ts` — integration test.
- `tests/integration/actions/getMatchOverview.test.ts` — integration test.
- `app/matchmaking/page.tsx` — Server Component.
- `app/matchmaking/layout.tsx` — thin route layout (inherits `app/layout.tsx` fonts + topbar; provides a neutral wrapper without the lobby's content column width).
- `components/matchmaking/MatchmakingClient.tsx` — client-side state machine + poll loop.
- `components/matchmaking/MatchRing.tsx` — rotating ring component.
- `components/matchmaking/MatchmakingVsBlock.tsx` — shared vs-block for `found`/`starting`.
- `tests/unit/components/matchmaking/MatchmakingClient.test.tsx` — phase transitions.
- `tests/unit/components/matchmaking/MatchRing.test.tsx` — render + avatar slot.
- `tests/unit/components/matchmaking/MatchmakingVsBlock.test.tsx` — render + subtitle by phase.
- `tests/integration/app/matchmaking-redirect.test.ts` — `/matchmaking` redirects when no session.
- `tests/integration/ui/matchmaking-phase-4b.spec.ts` — Playwright `@matchmaking` smoke (named distinct from the existing `matchmaking.spec.ts` which is a dual-session queue test).
- `app/styles/matchmaking.css` — `@keyframes` rotation + `.match-ring` rules. Imported from `app/layout.tsx` alongside the existing globals.

**Modify:**

- `components/lobby/PlayNowCard.tsx` — replace inline queue logic with `router.push("/matchmaking")`. Delete polling `useEffect`, `queueStartedAt`, `elapsedSeconds`, `handleCancel`, and the queuing branch of JSX. Keep the mode pills + the `inMatch` disabled state (the server still owns that).
- `tests/unit/components/lobby/PlayNowCard.test.tsx` — update tests that asserted the inline queue UI; they now assert the navigation push instead.

**Not touched:**

- `app/actions/matchmaking/startQueue.ts` — still the entry point for queuing. No signature change.
- `lib/matchmaking/inviteService.ts` — unchanged.
- `components/lobby/LobbyList.tsx` — the invite polling path is orthogonal to the queue flow.
- `app/match/[matchId]/*` — unchanged.
- `app/(landing)/*` — unchanged (owned by Phase 4a).

---

## Task 1: `cancelQueueAction` server action

**Files:**

- Create: `app/actions/matchmaking/cancelQueue.ts`
- Create: `tests/integration/actions/cancelQueue.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/actions/cancelQueue.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { cancelQueueAction } from "@/app/actions/matchmaking/cancelQueue";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { createTestPlayer, deleteTestPlayer, signInAs } from "../helpers/players";

describe("cancelQueueAction", () => {
  let playerId: string;
  const supabase = getServiceRoleClient();

  beforeEach(async () => {
    const player = await createTestPlayer();
    playerId = player.id;
    await signInAs(player);
    await supabase
      .from("players")
      .update({ status: "matchmaking" })
      .eq("id", playerId);
  });

  afterEach(async () => {
    await deleteTestPlayer(playerId);
  });

  test("resets a matchmaking player back to available", async () => {
    const result = await cancelQueueAction();
    expect(result).toEqual({ status: "cancelled" });

    const { data } = await supabase
      .from("players")
      .select("status")
      .eq("id", playerId)
      .single();
    expect(data?.status).toBe("available");
  });

  test("is a no-op when the player is already available", async () => {
    await supabase
      .from("players")
      .update({ status: "available" })
      .eq("id", playerId);
    const result = await cancelQueueAction();
    expect(result).toEqual({ status: "cancelled" });
  });

  test("refuses to downgrade a player that is already in a match", async () => {
    await supabase
      .from("players")
      .update({ status: "in_match" })
      .eq("id", playerId);
    const result = await cancelQueueAction();
    expect(result).toEqual({ status: "in_match" });

    const { data } = await supabase
      .from("players")
      .select("status")
      .eq("id", playerId)
      .single();
    expect(data?.status).toBe("in_match");
  });

  test("returns unauthenticated when no session cookie is present", async () => {
    await signInAs(null);
    const result = await cancelQueueAction();
    expect(result.status).toBe("unauthenticated");
  });
});
```

Note: `tests/integration/actions/helpers/players.ts` already exists and exposes `createTestPlayer`, `deleteTestPlayer`, `signInAs`. Confirm via `grep -n "export" tests/integration/actions/helpers/players.ts`; if any helper is missing, follow the pattern used in `tests/integration/actions/getTopPlayers.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:integration -- tests/integration/actions/cancelQueue.test.ts`
Expected: FAIL with `Cannot find module '@/app/actions/matchmaking/cancelQueue'`.

- [ ] **Step 3: Implement the Server Action**

Create `app/actions/matchmaking/cancelQueue.ts`:

```ts
"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface CancelQueueActionState {
  status: "cancelled" | "in_match" | "unauthenticated" | "error";
  message?: string;
}

export async function cancelQueueAction(): Promise<CancelQueueActionState> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "unauthenticated", message: "Log in to cancel matchmaking." };
  }

  try {
    const supabase = getServiceRoleClient();
    const { data } = await supabase
      .from("players")
      .select("status")
      .eq("id", session.player.id)
      .single();

    if (data?.status === "in_match") {
      return { status: "in_match" };
    }

    await supabase
      .from("players")
      .update({
        status: "available",
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", session.player.id)
      .in("status", ["matchmaking", "available"]);

    return { status: "cancelled" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Cancel failed.",
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:integration -- tests/integration/actions/cancelQueue.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/actions/matchmaking/cancelQueue.ts tests/integration/actions/cancelQueue.test.ts
git commit -m "feat(matchmaking): add cancelQueueAction to return player to available"
```

---

## Task 2: `getMatchOverviewAction` server action

**Files:**

- Create: `app/actions/matchmaking/getMatchOverview.ts`
- Create: `tests/integration/actions/getMatchOverview.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/actions/getMatchOverview.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  createTestMatch,
  createTestPlayer,
  deleteTestMatch,
  deleteTestPlayer,
  signInAs,
} from "../helpers/players";

describe("getMatchOverviewAction", () => {
  const supabase = getServiceRoleClient();
  let playerA: { id: string };
  let playerB: { id: string };
  let matchId: string;

  beforeEach(async () => {
    playerA = await createTestPlayer({ username: "mover-a" });
    playerB = await createTestPlayer({ username: "mover-b" });
    matchId = await createTestMatch({
      playerAId: playerA.id,
      playerBId: playerB.id,
    });
    await signInAs(playerA);
  });

  afterEach(async () => {
    await deleteTestMatch(matchId);
    await deleteTestPlayer(playerA.id);
    await deleteTestPlayer(playerB.id);
  });

  test("returns self + opponent identities for a match participant", async () => {
    const result = await getMatchOverviewAction({ matchId });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.self.id).toBe(playerA.id);
    expect(result.opponent.id).toBe(playerB.id);
    expect(result.opponent.username).toBe("mover-b");
  });

  test("rejects callers that are not participants", async () => {
    const stranger = await createTestPlayer({ username: "outside" });
    try {
      await signInAs(stranger);
      const result = await getMatchOverviewAction({ matchId });
      expect(result.status).toBe("forbidden");
    } finally {
      await deleteTestPlayer(stranger.id);
    }
  });

  test("returns not_found for unknown match ids", async () => {
    const result = await getMatchOverviewAction({
      matchId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.status).toBe("not_found");
  });

  test("returns unauthenticated when no session cookie is present", async () => {
    await signInAs(null);
    const result = await getMatchOverviewAction({ matchId });
    expect(result.status).toBe("unauthenticated");
  });
});
```

If `createTestMatch` / `deleteTestMatch` don't exist yet in `helpers/players.ts`, extract the minimal insert from `tests/integration/actions/getRecentGames.test.ts` (which seeds matches via the same service-role client) and add them to the helper file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:integration -- tests/integration/actions/getMatchOverview.test.ts`
Expected: FAIL with `Cannot find module '@/app/actions/matchmaking/getMatchOverview'`.

- [ ] **Step 3: Implement the Server Action**

Create `app/actions/matchmaking/getMatchOverview.ts`:

```ts
"use server";

import "server-only";
import { z } from "zod";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { PlayerIdentity } from "@/lib/types/match";

const inputSchema = z.object({
  matchId: z.string().uuid(),
});

export type MatchOverviewState =
  | { status: "ok"; self: PlayerIdentity; opponent: PlayerIdentity }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

export async function getMatchOverviewAction(
  input: z.infer<typeof inputSchema>,
): Promise<MatchOverviewState> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "unauthenticated" };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid matchId." };
  }

  try {
    const supabase = getServiceRoleClient();
    const { data: match } = await supabase
      .from("matches")
      .select("player_a_id, player_b_id")
      .eq("id", parsed.data.matchId)
      .maybeSingle();

    if (!match) {
      return { status: "not_found" };
    }

    const selfId = session.player.id;
    if (match.player_a_id !== selfId && match.player_b_id !== selfId) {
      return { status: "forbidden" };
    }

    const opponentId =
      match.player_a_id === selfId ? match.player_b_id : match.player_a_id;

    const { data: players } = await supabase
      .from("players")
      .select(
        "id, username, display_name, avatar_url, status, last_seen_at, elo_rating",
      )
      .in("id", [selfId, opponentId]);

    if (!players || players.length !== 2) {
      return { status: "error", message: "Player records missing." };
    }

    const toIdentity = (row: (typeof players)[number]): PlayerIdentity => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      status: row.status,
      lastSeenAt: row.last_seen_at,
      eloRating: row.elo_rating,
    });

    const self = toIdentity(players.find((p) => p.id === selfId)!);
    const opponent = toIdentity(players.find((p) => p.id === opponentId)!);

    return { status: "ok", self, opponent };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Lookup failed.",
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:integration -- tests/integration/actions/getMatchOverview.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/actions/matchmaking/getMatchOverview.ts tests/integration/actions/getMatchOverview.test.ts
git commit -m "feat(matchmaking): add getMatchOverviewAction for post-match player lookup"
```

---

## Task 3: `MatchRing` component

**Files:**

- Create: `app/styles/matchmaking.css`
- Create: `components/matchmaking/MatchRing.tsx`
- Create: `tests/unit/components/matchmaking/MatchRing.test.tsx`
- Modify: `app/layout.tsx` (import the new stylesheet)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/matchmaking/MatchRing.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MatchRing } from "@/components/matchmaking/MatchRing";

describe("MatchRing", () => {
  test("renders children centered inside a .match-ring wrapper", () => {
    render(
      <MatchRing>
        <div data-testid="ring-child">A</div>
      </MatchRing>,
    );
    const wrapper = screen.getByTestId("match-ring");
    expect(wrapper.className).toContain("match-ring");
    expect(screen.getByTestId("ring-child")).toBeInTheDocument();
  });

  test("respects prefers-reduced-motion via a css class, not inline style", () => {
    render(
      <MatchRing>
        <span>x</span>
      </MatchRing>,
    );
    const wrapper = screen.getByTestId("match-ring");
    expect(wrapper.getAttribute("style") ?? "").not.toMatch(/animation/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/matchmaking/MatchRing.test.tsx`
Expected: FAIL with `Cannot find module '@/components/matchmaking/MatchRing'`.

- [ ] **Step 3: Create the stylesheet**

Create `app/styles/matchmaking.css`:

```css
.match-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 220px;
  height: 220px;
  border-radius: 9999px;
  border: 2px solid transparent;
  background:
    linear-gradient(var(--paper), var(--paper)) padding-box,
    conic-gradient(
      from 0deg,
      var(--ochre-deep) 0deg,
      transparent 140deg,
      transparent 220deg,
      var(--ochre-deep) 360deg
    ) border-box;
  animation: match-ring-spin 1.8s linear infinite;
}

@keyframes match-ring-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .match-ring {
    animation: none;
  }
}
```

- [ ] **Step 4: Register the stylesheet**

In `app/layout.tsx`, add an import alongside the existing globals:

```ts
import "./styles/matchmaking.css";
```

Place the import next to the other `./styles/*.css` imports (the file already imports board/lobby stylesheets — match that pattern).

- [ ] **Step 5: Create the component**

Create `components/matchmaking/MatchRing.tsx`:

```tsx
import type { ReactNode } from "react";

interface MatchRingProps {
  children: ReactNode;
}

export function MatchRing({ children }: MatchRingProps) {
  return (
    <div data-testid="match-ring" className="match-ring">
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test -- --run tests/unit/components/matchmaking/MatchRing.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add app/styles/matchmaking.css app/layout.tsx \
  components/matchmaking/MatchRing.tsx \
  tests/unit/components/matchmaking/MatchRing.test.tsx
git commit -m "feat(matchmaking): add rotating MatchRing component + reduced-motion respect"
```

---

## Task 4: `MatchmakingVsBlock` component

**Files:**

- Create: `components/matchmaking/MatchmakingVsBlock.tsx`
- Create: `tests/unit/components/matchmaking/MatchmakingVsBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/matchmaking/MatchmakingVsBlock.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MatchmakingVsBlock } from "@/components/matchmaking/MatchmakingVsBlock";
import type { PlayerIdentity } from "@/lib/types/match";

const SELF: PlayerIdentity = {
  id: "self",
  username: "ari",
  displayName: "Ari",
  avatarUrl: null,
  status: "matchmaking",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1234,
};

const OPPONENT: PlayerIdentity = {
  id: "opp",
  username: "birna",
  displayName: "Birna",
  avatarUrl: null,
  status: "matchmaking",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1198,
};

describe("MatchmakingVsBlock", () => {
  test("renders both display names and ratings", () => {
    render(
      <MatchmakingVsBlock self={SELF} opponent={OPPONENT} phase="found" />,
    );
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText("Birna")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("1198")).toBeInTheDocument();
  });

  test("uses 'Opponent found' eyebrow + 'Both players ready.' subtitle for phase=found", () => {
    render(
      <MatchmakingVsBlock self={SELF} opponent={OPPONENT} phase="found" />,
    );
    expect(screen.getByText(/Opponent found/i)).toBeInTheDocument();
    expect(screen.getByText(/Both players ready\./i)).toBeInTheDocument();
  });

  test("uses 'Starting match…' eyebrow + assigning-roles subtitle for phase=starting", () => {
    render(
      <MatchmakingVsBlock self={SELF} opponent={OPPONENT} phase="starting" />,
    );
    expect(screen.getByText(/Starting match…/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Assigning roles · generating board…/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- --run tests/unit/components/matchmaking/MatchmakingVsBlock.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/matchmaking/MatchmakingVsBlock.tsx`:

```tsx
import { Avatar } from "@/components/ui/Avatar";
import type { PlayerIdentity } from "@/lib/types/match";

export type VsBlockPhase = "found" | "starting";

interface MatchmakingVsBlockProps {
  self: PlayerIdentity;
  opponent: PlayerIdentity;
  phase: VsBlockPhase;
}

const EYEBROW: Record<VsBlockPhase, string> = {
  found: "Opponent found",
  starting: "Starting match…",
};

const SUBTITLE: Record<VsBlockPhase, string> = {
  found: "Both players ready.",
  starting: "Assigning roles · generating board…",
};

export function MatchmakingVsBlock({
  self,
  opponent,
  phase,
}: MatchmakingVsBlockProps) {
  return (
    <div data-testid="matchmaking-vs-block" className="w-full text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
        {EYEBROW[phase]}
      </p>

      <div className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-5xl">
        <span className="text-p1-deep">{self.displayName}</span>
        <br />
        <span className="block py-2 font-mono text-sm uppercase tracking-[0.22em] text-ink-soft">
          — vs —
        </span>
        <span className="text-p2-deep">{opponent.displayName}</span>
      </div>

      <div className="mt-8 flex items-center justify-center gap-12">
        <VsAvatar player={self} />
        <span
          aria-hidden="true"
          className="font-display text-2xl italic text-ink-soft"
        >
          ×
        </span>
        <VsAvatar player={opponent} />
      </div>

      <p className="mt-8 text-sm text-ink-3">{SUBTITLE[phase]}</p>
    </div>
  );
}

function VsAvatar({ player }: { player: PlayerIdentity }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar
        size={80}
        displayName={player.displayName}
        avatarUrl={player.avatarUrl}
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        {player.eloRating ?? 1200}
      </span>
    </div>
  );
}
```

Confirm that `@/components/ui/Avatar` accepts `size`, `displayName`, `avatarUrl` props (check `components/ui/Avatar.tsx`). If the prop names differ, adapt this component to match — don't widen the `Avatar` API for this.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- --run tests/unit/components/matchmaking/MatchmakingVsBlock.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/matchmaking/MatchmakingVsBlock.tsx \
  tests/unit/components/matchmaking/MatchmakingVsBlock.test.tsx
git commit -m "feat(matchmaking): add shared VsBlock for found + starting phases"
```

---

## Task 5: `MatchmakingClient` — searching phase

**Files:**

- Create: `components/matchmaking/MatchmakingClient.tsx`
- Create: `tests/unit/components/matchmaking/MatchmakingClient.test.tsx`

- [ ] **Step 1: Write the failing test (searching render)**

Create `tests/unit/components/matchmaking/MatchmakingClient.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerIdentity } from "@/lib/types/match";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const startQueueMock = vi.fn();
vi.mock("@/app/actions/matchmaking/startQueue", () => ({
  startQueueAction: startQueueMock,
}));

const cancelQueueMock = vi.fn();
vi.mock("@/app/actions/matchmaking/cancelQueue", () => ({
  cancelQueueAction: cancelQueueMock,
}));

const overviewMock = vi.fn();
vi.mock("@/app/actions/matchmaking/getMatchOverview", () => ({
  getMatchOverviewAction: overviewMock,
}));

import { MatchmakingClient } from "@/components/matchmaking/MatchmakingClient";

const SELF: PlayerIdentity = {
  id: "self",
  username: "ari",
  displayName: "Ari",
  avatarUrl: null,
  status: "matchmaking",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1234,
};

beforeEach(() => {
  vi.useFakeTimers();
  startQueueMock.mockReset();
  cancelQueueMock.mockReset();
  overviewMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MatchmakingClient — searching phase", () => {
  test("renders the ring, elapsed counter, and cancel button", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    render(<MatchmakingClient self={SELF} />);

    expect(screen.getByTestId("match-ring")).toBeInTheDocument();
    expect(screen.getByText(/Finding an opponent within/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cancel search/i }),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  test("expands the ±rating window by 50 points per second", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText(/±250/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByText(/±350/)).toBeInTheDocument();
  });

  test("polls startQueueAction every 3 seconds while searching", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(startQueueMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(startQueueMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(startQueueMock).toHaveBeenCalledTimes(3);
  });

  test("cancel button calls cancelQueueAction and navigates to /lobby", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    cancelQueueMock.mockResolvedValue({ status: "cancelled" });
    const push = vi.fn();
    const navigation = await import("next/navigation");
    vi.spyOn(navigation, "useRouter").mockReturnValue({
      push,
      replace: vi.fn(),
    } as unknown as ReturnType<typeof navigation.useRouter>);

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    screen.getByRole("button", { name: /Cancel search/i }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(cancelQueueMock).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/lobby");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/matchmaking/MatchmakingClient.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Create the component (searching-only path)**

Create `components/matchmaking/MatchmakingClient.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cancelQueueAction } from "@/app/actions/matchmaking/cancelQueue";
import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MatchRing } from "@/components/matchmaking/MatchRing";
import { MatchmakingVsBlock } from "@/components/matchmaking/MatchmakingVsBlock";
import type { PlayerIdentity } from "@/lib/types/match";

const POLL_INTERVAL_MS = 3_000;
const RATING_WINDOW_BASE = 200;
const RATING_WINDOW_STEP = 50;
const FOUND_HOLD_MS = 2_200;
const STARTING_HOLD_MS = 1_400;

type Phase =
  | { kind: "searching" }
  | { kind: "found"; matchId: string; opponent: PlayerIdentity }
  | { kind: "starting"; matchId: string; opponent: PlayerIdentity };

interface MatchmakingClientProps {
  self: PlayerIdentity;
}

export function MatchmakingClient({ self }: MatchmakingClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "searching" });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (phase.kind !== "searching") return;
    const tick = () =>
      setElapsedSeconds(
        Math.floor((Date.now() - startedAtRef.current) / 1000),
      );
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [phase.kind]);

  useEffect(() => {
    if (phase.kind !== "searching") return;
    let cancelled = false;

    const poll = async () => {
      const result = await startQueueAction();
      if (cancelled) return;
      if (result.status === "matched" && result.matchId) {
        const overview = await getMatchOverviewAction({
          matchId: result.matchId,
        });
        if (cancelled) return;
        if (overview.status === "ok") {
          setPhase({
            kind: "found",
            matchId: result.matchId,
            opponent: overview.opponent,
          });
        } else {
          router.push(`/match/${result.matchId}`);
        }
      }
    };

    void poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase.kind, router]);

  useEffect(() => {
    if (phase.kind !== "found") return;
    const id = setTimeout(() => {
      setPhase({
        kind: "starting",
        matchId: phase.matchId,
        opponent: phase.opponent,
      });
    }, FOUND_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase.kind !== "starting") return;
    const id = setTimeout(() => {
      router.push(`/match/${phase.matchId}`);
    }, STARTING_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, router]);

  const handleCancel = useCallback(async () => {
    await cancelQueueAction();
    router.push("/lobby");
  }, [router]);

  const ratingWindow =
    RATING_WINDOW_BASE + elapsedSeconds * RATING_WINDOW_STEP;

  if (phase.kind === "searching") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-58px)] w-full max-w-2xl items-center justify-center px-6 py-16">
        <div className="w-full text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
            Ranked · 5+0 · Icelandic nouns
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold italic leading-tight sm:text-5xl">
            Finding an opponent within{" "}
            <em className="font-display not-italic text-ochre-deep">
              ±{ratingWindow}
            </em>{" "}
            rating
          </h1>
          <div className="mt-12 grid place-items-center gap-6">
            <MatchRing>
              <Avatar size={96} displayName={self.displayName} avatarUrl={self.avatarUrl} />
            </MatchRing>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
              Elapsed · {elapsedSeconds}s
            </p>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel search
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-58px)] w-full max-w-2xl items-center justify-center px-6 py-16">
      <MatchmakingVsBlock
        self={self}
        opponent={phase.opponent}
        phase={phase.kind === "found" ? "found" : "starting"}
      />
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify searching tests pass**

Run: `pnpm test -- --run tests/unit/components/matchmaking/MatchmakingClient.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/matchmaking/MatchmakingClient.tsx \
  tests/unit/components/matchmaking/MatchmakingClient.test.tsx
git commit -m "feat(matchmaking): add MatchmakingClient searching phase + cancel"
```

---

## Task 6: `MatchmakingClient` — found + starting + navigation

**Files:**

- Modify: `tests/unit/components/matchmaking/MatchmakingClient.test.tsx`

- [ ] **Step 1: Add found + starting tests**

Append to the `describe` block:

```tsx
describe("MatchmakingClient — found/starting phases", () => {
  test("transitions to found when startQueueAction returns matched", async () => {
    startQueueMock.mockResolvedValueOnce({
      status: "matched",
      matchId: "match-123",
    });
    overviewMock.mockResolvedValueOnce({
      status: "ok",
      self: SELF,
      opponent: {
        id: "opp",
        username: "birna",
        displayName: "Birna",
        avatarUrl: null,
        status: "matchmaking",
        lastSeenAt: new Date().toISOString(),
        eloRating: 1198,
      },
    });

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/Opponent found/i)).toBeInTheDocument();
    expect(screen.getByText("Birna")).toBeInTheDocument();
  });

  test("transitions found → starting after 2.2s", async () => {
    startQueueMock.mockResolvedValueOnce({
      status: "matched",
      matchId: "match-123",
    });
    overviewMock.mockResolvedValueOnce({
      status: "ok",
      self: SELF,
      opponent: {
        id: "opp",
        username: "birna",
        displayName: "Birna",
        avatarUrl: null,
        status: "matchmaking",
        lastSeenAt: new Date().toISOString(),
        eloRating: 1198,
      },
    });

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_200);
    });
    expect(screen.getByText(/Starting match…/i)).toBeInTheDocument();
  });

  test("starting phase navigates to /match/:id after 1.4s", async () => {
    const push = vi.fn();
    const navigation = await import("next/navigation");
    vi.spyOn(navigation, "useRouter").mockReturnValue({
      push,
      replace: vi.fn(),
    } as unknown as ReturnType<typeof navigation.useRouter>);

    startQueueMock.mockResolvedValueOnce({
      status: "matched",
      matchId: "match-123",
    });
    overviewMock.mockResolvedValueOnce({
      status: "ok",
      self: SELF,
      opponent: {
        id: "opp",
        username: "birna",
        displayName: "Birna",
        avatarUrl: null,
        status: "matchmaking",
        lastSeenAt: new Date().toISOString(),
        eloRating: 1198,
      },
    });

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_200);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_400);
    });
    expect(push).toHaveBeenCalledWith("/match/match-123");
  });

  test("navigates straight to /match/:id when overview lookup fails", async () => {
    const push = vi.fn();
    const navigation = await import("next/navigation");
    vi.spyOn(navigation, "useRouter").mockReturnValue({
      push,
      replace: vi.fn(),
    } as unknown as ReturnType<typeof navigation.useRouter>);

    startQueueMock.mockResolvedValueOnce({
      status: "matched",
      matchId: "match-xyz",
    });
    overviewMock.mockResolvedValueOnce({ status: "error", message: "boom" });

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(push).toHaveBeenCalledWith("/match/match-xyz");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- --run tests/unit/components/matchmaking/MatchmakingClient.test.tsx`
Expected: PASS (8 tests total).

Task 5's implementation already covers these phase transitions; this task just extends the test coverage. If you prefer stricter TDD, simplify `MatchmakingClient` during Task 5 to only handle `phase.kind === "searching"` (render `null` for other kinds), then layer in the found/starting branches here. Either order converges to the same final component.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/components/matchmaking/MatchmakingClient.test.tsx
git commit -m "test(matchmaking): cover found/starting phase transitions + navigation"
```

---

## Task 7: `/matchmaking` Server Component page + layout

**Files:**

- Create: `app/matchmaking/layout.tsx`
- Create: `app/matchmaking/page.tsx`
- Create: `tests/integration/app/matchmaking-redirect.test.ts`

- [ ] **Step 1: Write the failing route test**

Create `tests/integration/app/matchmaking-redirect.test.ts`:

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

import { readLobbySession } from "@/lib/matchmaking/profile";
import MatchmakingPage from "@/app/matchmaking/page";

describe("MatchmakingPage route", () => {
  test("redirects to / when no session cookie is present", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(MatchmakingPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  test("renders when a session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce({
      token: "tok",
      issuedAt: Date.now(),
      player: {
        id: "abc",
        username: "ari",
        displayName: "Ari",
        status: "available",
        lastSeenAt: new Date().toISOString(),
        eloRating: 1234,
      },
    });
    const element = await MatchmakingPage();
    expect(element).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/integration/app/matchmaking-redirect.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create the layout**

Create `app/matchmaking/layout.tsx`:

```tsx
import type { ReactNode } from "react";

export default function MatchmakingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="matchmaking-shell">{children}</div>;
}
```

- [ ] **Step 4: Create the page**

Create `app/matchmaking/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { MatchmakingClient } from "@/components/matchmaking/MatchmakingClient";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function MatchmakingPage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }
  return <MatchmakingClient self={session.player} />;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- --run tests/integration/app/matchmaking-redirect.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app/matchmaking/layout.tsx app/matchmaking/page.tsx \
  tests/integration/app/matchmaking-redirect.test.ts
git commit -m "feat(matchmaking): add /matchmaking Server Component + auth guard"
```

---

## Task 8: `PlayNowCard` — navigate instead of inline queue

**Files:**

- Modify: `components/lobby/PlayNowCard.tsx`
- Modify: `tests/unit/components/lobby/PlayNowCard.test.tsx` (if it exists; otherwise create it)

- [ ] **Step 1: Check + adjust existing tests**

Run: `ls tests/unit/components/lobby/PlayNowCard.test.tsx`

If it exists, read it and note any tests that assert the inline queue UI (`matchmaker-queue-status`, "Looking for an opponent…", elapsed counter, Cancel button inside the card). Those tests will need to be replaced with "clicking Play Now calls router.push('/matchmaking')".

If it does not exist, create it with just the new assertion below.

Write/update `tests/unit/components/lobby/PlayNowCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerIdentity } from "@/lib/types/match";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

const mockStoreState = {
  players: [] as PlayerIdentity[],
  updateSelfStatus: vi.fn(),
};
vi.mock("@/lib/matchmaking/presenceStore", () => ({
  useLobbyPresenceStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

import { PlayNowCard } from "@/components/lobby/PlayNowCard";

const CURRENT: PlayerIdentity = {
  id: "self",
  username: "ari",
  displayName: "Ari",
  avatarUrl: null,
  status: "available",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1234,
};

beforeEach(() => {
  pushMock.mockReset();
  mockStoreState.players = [CURRENT];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlayNowCard", () => {
  test("Play Now button navigates to /matchmaking", async () => {
    render(<PlayNowCard currentPlayer={CURRENT} />);
    await userEvent.click(screen.getByTestId("matchmaker-start-button"));
    expect(pushMock).toHaveBeenCalledWith("/matchmaking");
  });

  test("Play Now button is disabled when the viewer is already in a match", () => {
    mockStoreState.players = [{ ...CURRENT, status: "in_match" }];
    render(<PlayNowCard currentPlayer={{ ...CURRENT, status: "in_match" }} />);
    expect(screen.getByTestId("matchmaker-start-button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- --run tests/unit/components/lobby/PlayNowCard.test.tsx`
Expected: FAIL — current `PlayNowCard` starts the queue inline instead of navigating.

- [ ] **Step 3: Rewrite `components/lobby/PlayNowCard.tsx`**

Replace contents:

```tsx
"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import type { PlayerIdentity } from "@/lib/types/match";

interface PlayNowCardProps {
  currentPlayer: PlayerIdentity;
}

interface ModePillDef {
  mode: "ranked" | "casual" | "challenge";
  label: string;
  enabled: boolean;
}

const MODE_PILLS: ModePillDef[] = [
  { mode: "ranked", label: "Ranked", enabled: true },
  { mode: "casual", label: "Casual", enabled: false },
  { mode: "challenge", label: "Challenge", enabled: false },
];

export function PlayNowCard({ currentPlayer }: PlayNowCardProps) {
  const router = useRouter();
  const players = useLobbyPresenceStore((state) => state.players);
  const firstInteractionRef = useRef(false);

  const selfStatus =
    players.find((p) => p.id === currentPlayer.id)?.status ??
    currentPlayer.status;
  const inMatch = selfStatus === "in_match";

  const markFirstInteraction = useCallback(() => {
    if (firstInteractionRef.current) return;
    firstInteractionRef.current = true;
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark("lobby:first-interaction");
    }
  }, []);

  const handlePlay = () => {
    markFirstInteraction();
    router.push("/matchmaking");
  };

  return (
    <Card elevation={0} className="lobby-cta-card space-y-5 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-semibold text-text-inverse sm:text-3xl">
            Ready to play?
          </p>
          <p className="text-sm text-text-inverse/70">
            Drop into a ranked match against someone near your rating.
          </p>
        </div>
        <span className="hidden font-display text-xs uppercase tracking-[0.3em] text-accent-focus/70 sm:inline">
          {currentPlayer.eloRating ?? 1200} Elo
        </span>
      </div>

      <div
        role="group"
        aria-label="Match mode"
        className="flex flex-wrap gap-2"
      >
        {MODE_PILLS.map((pill) => {
          const baseClasses =
            "rounded-full border px-3 py-1 text-xs font-medium transition min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0";
          const stateClasses = pill.enabled
            ? "border-ink bg-ink text-paper"
            : "cursor-not-allowed border-hair bg-paper-2 text-ink-soft";
          return (
            <button
              key={pill.mode}
              type="button"
              data-testid={`mode-pill-${pill.mode}`}
              aria-disabled={pill.enabled ? undefined : "true"}
              aria-label={
                pill.enabled ? pill.label : `${pill.label} — coming soon`
              }
              title={pill.enabled ? undefined : "Coming soon"}
              onFocus={markFirstInteraction}
              className={`${baseClasses} ${stateClasses}`}
            >
              {pill.label}
              {pill.enabled ? null : (
                <span className="ml-1 text-[10px] opacity-70">
                  (Coming soon)
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handlePlay}
        onFocus={markFirstInteraction}
        disabled={inMatch}
        data-testid="matchmaker-start-button"
        aria-label={inMatch ? "You are already in a match" : "Play Now"}
        className="lobby-primary-cta lobby-playnow-sticky inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl px-6 py-4 font-display text-lg font-semibold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-focus sm:text-xl"
      >
        {inMatch ? "Already in a match" : "Play Now · Ranked"}
      </button>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --run tests/unit/components/lobby/PlayNowCard.test.tsx`
Expected: PASS (2 tests).

Run: `pnpm test -- --run`
Expected: fix any remaining PlayNowCard-related tests that assumed the inline queue UI.

- [ ] **Step 5: Commit**

```bash
git add components/lobby/PlayNowCard.tsx tests/unit/components/lobby/PlayNowCard.test.tsx
git commit -m "refactor(lobby): PlayNowCard navigates to /matchmaking instead of inline queue"
```

---

## Task 9: Audit existing Playwright matchmaking spec

The existing `tests/integration/ui/matchmaking.spec.ts` verifies the dual-session auto-queue via the lobby. That spec will break once `PlayNowCard` navigates away. Walk through and update it to expect the `/matchmaking` route between "click Play Now" and "match starts".

- [ ] **Step 1: Read the existing spec**

Run:

```bash
cat tests/integration/ui/matchmaking.spec.ts | head -120
```

Identify every location that asserts the lobby's inline queue UI (`matchmaker-queue-status`, the "Looking for an opponent…" text, the cancel button inside the card).

- [ ] **Step 2: Replace those assertions**

Wherever the previous assertion was:

```ts
await expect(page.getByTestId("matchmaker-queue-status")).toBeVisible();
```

update to:

```ts
await page.getByTestId("matchmaker-start-button").click();
await expect(page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 });
await expect(page.getByTestId("match-ring")).toBeVisible({ timeout: 10_000 });
```

Then the existing "match found → navigate to /match/[id]" assertion stays, but will fire after the `found`/`starting` transition (~3.6s on the happy path). If the existing test has a tight timeout, raise it by 5s.

- [ ] **Step 3: Run the spec to confirm it still passes**

Run: `pnpm exec playwright test --grep @matchmaking tests/integration/ui/matchmaking.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ui/matchmaking.spec.ts
git commit -m "test(matchmaking): update dual-session spec for /matchmaking navigation"
```

---

## Task 10: New Playwright `@matchmaking` smoke

**Files:**

- Create: `tests/integration/ui/matchmaking-phase-4b.spec.ts`

- [ ] **Step 1: Write the failing Playwright spec**

Create `tests/integration/ui/matchmaking-phase-4b.spec.ts`:

```ts
import { test, expect, type BrowserContext } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

async function loginNewPlayer(context: BrowserContext) {
  const page = await context.newPage();
  const username = generateTestUsername("mm4b");
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
  await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
  return { page, username };
}

test.describe("@matchmaking Phase 4b matchmaking screen", () => {
  test("clicking Play Now navigates to /matchmaking and renders the ring", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    try {
      const { page } = await loginNewPlayer(context);
      await page.getByTestId("matchmaker-start-button").click();
      await expect(page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 });
      await expect(page.getByTestId("match-ring")).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/Finding an opponent within/i)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("cancel search returns the viewer to /lobby", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const { page } = await loginNewPlayer(context);
      await page.getByTestId("matchmaker-start-button").click();
      await expect(page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 });
      await page.getByRole("button", { name: /Cancel search/i }).click();
      await expect(page).toHaveURL(/\/lobby$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test("two players matching navigate through found/starting into /match/:id", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([loginNewPlayer(ctxA), loginNewPlayer(ctxB)]);
      await Promise.all([
        a.page.getByTestId("matchmaker-start-button").click(),
        b.page.getByTestId("matchmaker-start-button").click(),
      ]);
      await Promise.all([
        expect(a.page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 }),
        expect(b.page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 }),
      ]);
      await Promise.all([
        expect(a.page.getByTestId("matchmaking-vs-block")).toBeVisible({
          timeout: 20_000,
        }),
        expect(b.page.getByTestId("matchmaking-vs-block")).toBeVisible({
          timeout: 20_000,
        }),
      ]);
      await Promise.all([
        expect(a.page).toHaveURL(/\/match\/[0-9a-f-]+$/, { timeout: 15_000 }),
        expect(b.page).toHaveURL(/\/match\/[0-9a-f-]+$/, { timeout: 15_000 }),
      ]);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm exec playwright test --grep @matchmaking tests/integration/ui/matchmaking-phase-4b.spec.ts`
Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/ui/matchmaking-phase-4b.spec.ts
git commit -m "test(matchmaking): add @matchmaking Playwright smoke for /matchmaking route"
```

---

## Task 11: CLAUDE.md refresh

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Add `/matchmaking` to the Critical Directories section**

Update the `/app` sub-list to include:

```
  - `/app/matchmaking` — Matchmaking screen (searching / found / starting phases)
```

- [ ] **Step 2: Add `components/matchmaking` to the Critical Directories section**

```
`/components/matchmaking` — `MatchmakingClient`, `MatchRing`, `MatchmakingVsBlock`
```

- [ ] **Step 3: Flip the Phase table row for Phase 4**

Change Phase 4's `Status` from `Planned` → `Merged` (or leave as `In progress` until the PR lands).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): reflect Phase 4b matchmaking screen + components"
```

---

## Task 12: Manual verification pass

- [ ] `pnpm dev`, open two browsers (or one + incognito) logged in as different users:
  - First browser clicks Play Now → lands on `/matchmaking` with ring rotating, `±200 rating` shown, elapsed ticker counting up.
  - `±N` increments by 50 every second.
  - Second browser clicks Play Now → both transition through a visible "Opponent found · Birna" block (2.2s) → "Starting match…" block (1.4s) → land on `/match/[id]` simultaneously.
  - From a single-player session, clicking Cancel search returns to `/lobby`, and a subsequent Play Now works again.
- [ ] Navigating directly to `/matchmaking` with no session redirects to `/`.
- [ ] Reduced-motion setting disables the ring rotation (macOS System Settings → Accessibility → Display → Reduce motion).
- [ ] No console errors about hanging poll intervals after cancelling (the `useEffect` teardown clears both timers).

---

## Task 13: Open the PR

- [ ] **Step 1: Confirm CI is green locally**

Run: `pnpm lint && pnpm typecheck && pnpm test -- --run`
Expected: all clean.

Run: `pnpm exec playwright test --grep @matchmaking`
Expected: all green.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin 024-matchmaking-phase-4b
gh pr create --title "feat(matchmaking): dedicated /matchmaking screen (Phase 4b)" \
  --body "$(cat <<'EOF'
## Summary

- New `/matchmaking` route with three phases: `searching` (rotating ring + expanding ±rating window + elapsed counter + cancel), `found` (vs-block with both avatars + ratings), `starting` (auto-navigates to `/match/[id]`).
- `PlayNowCard` in the lobby no longer runs the queue inline — it now navigates to `/matchmaking`. The inline queue UI is gone.
- Adds `cancelQueueAction` (server-side dequeue) and `getMatchOverviewAction` (opponent lookup for the `found` phase).
- Transport stays polling-based (3s interval on `startQueueAction`). No realtime matchmaking channel needed yet.

Implements Phase 4b of the Warm Editorial redesign (docs/superpowers/specs/2026-04-19-wottle-design-implementation.md §4).

## Test plan

- [x] Unit: MatchmakingClient (searching + found/starting + cancel), MatchRing, MatchmakingVsBlock, PlayNowCard.
- [x] Integration: `cancelQueueAction`, `getMatchOverviewAction`, `/matchmaking` redirects when no session.
- [x] Playwright @matchmaking: single-player cancel + dual-player match flow.
- [x] Existing `tests/integration/ui/matchmaking.spec.ts` updated for the navigation change.
- [ ] Manual: two browsers confirm searching → found → starting → match, reduced-motion disables ring rotation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance criteria

- [x] `/matchmaking` Server Component redirects to `/` without a session, otherwise renders `MatchmakingClient`.
- [x] Searching phase shows rotating ring, `±200+50·elapsed` copy, elapsed timer, cancel button.
- [x] Cancel calls `cancelQueueAction` and navigates back to `/lobby`.
- [x] Poll interval is 3 seconds; `startQueueAction` is called once on mount and then on each tick.
- [x] On `matched`, `getMatchOverviewAction` fetches opponent; UI transitions `found → starting → /match/[id]`.
- [x] Overview lookup failure falls back to navigating straight to `/match/[id]`.
- [x] `PlayNowCard` no longer runs polling itself; navigation is the only side effect.
- [x] Prefers-reduced-motion disables ring rotation.
- [x] All tests green; lint + typecheck clean.
- [x] CLAUDE.md lists `app/matchmaking`, `components/matchmaking`, and updates the Phase table.
