# Phase 6 — Disconnection Modal + Claim-Win Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

**Why this change is being made.** Today's match screen signals an opponent disconnect only as a tiny flag on the `PlayerPanel` (`components/match/MatchClient.tsx:339–350` + `PlayerPanel.tsx:39+`). The backend has a **10s** reconnect window (`app/actions/match/handleDisconnect.ts:9` — `RECONNECT_WINDOW_MS = 10_000`). If the opponent's Realtime channel dies transiently, the match auto-finalizes with barely any chance to reconnect; if the player is on a sketchy network that's a terrible UX.

Phase 6 delivers what the Warm Editorial spec §6 and prototype (`docs/design_documentation/wottle-game-design/project/prototype/screens/Overlays.jsx`) describe: a centered modal with pulse indicator, a 90-second countdown, and a primary **Claim win** button. The reconnect window extends from 10s to 90s; the `claimWin` Server Action lets the still-connected player manually forfeit the opponent once the window has elapsed.

**Intended outcome.** When your opponent drops out, a centered modal appears with a 90-second countdown. You can hit "Keep waiting" (closes the modal but leaves the timer running in the background) or wait for the countdown to enable the "Claim win" button, which ends the match in your favour.

## Goal

1. Extend the server-side reconnect window from **10s → 90s** via one constant change.
2. Ship a new `claimWinAction(matchId)` Server Action that forfeits the opponent once they've been disconnected for ≥90s — **awarding the caller the win regardless of current score**.
3. Replace the existing passive disconnect banner with a dedicated `DisconnectionModal` component, wired into `MatchClient`.

## Architecture

1. **Server side (tiny):**
   - Bump `RECONNECT_WINDOW_MS` from `10_000` to `90_000` in `handleDisconnect.ts`.
   - Extend `completeMatchInternal(matchId, reason, forcedWinnerId?)` with a third optional argument that skips `determineMatchWinner` and uses the forced id. Preserves Elo + publish + reset paths unchanged.
   - New `app/actions/match/claimWin.ts` passes the **caller** as `forcedWinnerId`, so the player who waited is unconditionally awarded the win. Rate-limited under `match:claim-win` (1/min per player).
   - `finalizeMatchOnDisconnectTimeout` (the 90s auto-finaliser already in `handleDisconnect.ts`) passes the **still-connected player** as `forcedWinnerId` for the same reason — consistent semantics whether the user clicks Claim win or the timer self-fires.
   - Idempotent: if the match is already `completed`, the action returns `already_completed` without mutation.
2. **Client side:** one new component `DisconnectionModal`, composed of the existing `<Dialog>` primitive + a new `useCountdown(fromSeconds)` hook. The modal owns its timer and enables its primary button when the countdown hits zero. `MatchClient` conditionally mounts the modal when `matchState.disconnectedPlayerId === opponent.id`.
3. **No database migrations.** Disconnect tracking still lives in the existing in-memory `disconnectStore` + realtime `disconnectedPlayerId` broadcast. The 90s-elapsed check inside `claimWinAction` reads the same store (exported getter).

## Tech Stack

TypeScript 5.x, React 19 Client Components, Next.js 16 Server Actions, Supabase JS v2, Zod, Tailwind CSS 4, Vitest + React Testing Library, Playwright.

## Branch

`027-disconnect-modal-phase-6`, branched from `origin/main` (commit `7ff02ee`, Phase 5b merged).

---

## Scope decisions

**In scope:**

1. Extend `RECONNECT_WINDOW_MS` to 90_000 in `app/actions/match/handleDisconnect.ts`.
2. Expose an internal `getDisconnectedAt(matchId, playerId): number | null` helper from the same module so the new Server Action can query disconnect duration without duplicating state.
3. Add optional `forcedWinnerId` param to `completeMatchInternal` so disconnect flows award the still-connected player regardless of score. (Behaviour change: `finalizeMatchOnDisconnectTimeout` now also forces the non-disconnected player — consistent with the claim-win CTA.)
4. New `claimWinAction(matchId)` Server Action: auth + 90s-elapsed gate + rate-limited `match:claim-win` 1/min + idempotent (`already_completed` on re-call).
5. New `useCountdown` hook (small, well-tested) that ticks every 1s and reports remaining seconds + "expired" boolean.
6. New `DisconnectionModal` component with: pulse indicator, heading (`{opponent} dropped out.`), body copy, countdown display, "Keep waiting" (ghost) + "Claim win" (primary, disabled until countdown expires) buttons.
7. Wire `DisconnectionModal` into `MatchClient` — mounts when `disconnectedPlayerId === opponent.id`; unmounts when the flag clears.
8. Keep the existing `isDisconnected` flag on `PlayerPanel` — the modal is additive (you can close it; the badge stays). This preserves the subtle at-a-glance signal on the panel while adding the actionable modal.
9. Playwright `@disconnect-modal` smoke — simulates a disconnect via `page.context().close()` on the opponent's context, asserts the active player sees the modal.

**Deferred:**

- Persisting `last_seen_at` to the DB on every round advance (current in-memory store is fine for single-server deployment; when scaling out to multiple server instances, persist then).
- Sending an Ably/Supabase presence ping independent of Realtime channel health (current approach binds to the channel's disconnect event).
- Audio cue when the modal appears (post-launch).

**Explicitly not in scope:**

- `ended_reason` enum additions (we reuse the existing `"disconnect"` reason).
- Rating-adjustment changes for claim-win outcomes beyond the forced-winner plumb — the existing `applyRatingChanges` continues to award full Elo credit based on whoever ends up in `matches.winner_id`.

---

## File Structure

**Read (reference only):**

- `app/actions/match/handleDisconnect.ts` — extend; exports a getter in Task 1.
- `app/actions/match/completeMatch.ts` — reused by the claim-win action via `completeMatchInternal(matchId, "disconnect")`.
- `lib/match/statePublisher.ts` — `publishMatchState(matchId)` for the broadcast.
- `components/match/MatchClient.tsx:339–350` — existing disconnect state machine. Phase 6 adds a modal mount block.
- `components/ui/Dialog.tsx` — reuse with `bottomSheetOnMobile={false}` for centered-everywhere.
- `docs/design_documentation/wottle-game-design/project/prototype/screens/Overlays.jsx` — visual reference.

**Create:**

- `app/actions/match/claimWin.ts`
- `tests/unit/app/actions/claimWin.test.ts`
- `components/match/useCountdown.ts`
- `tests/unit/components/match/useCountdown.test.ts`
- `components/match/DisconnectionModal.tsx`
- `tests/unit/components/match/DisconnectionModal.test.tsx`
- `tests/integration/ui/disconnect-modal.spec.ts`

**Modify:**

- `app/actions/match/handleDisconnect.ts` — 1-line constant bump + export a getter.
- `components/match/MatchClient.tsx` — mount the modal conditionally.
- `CLAUDE.md` — flip Phase 6 status + index the new files.

---

## Test commands (run after every task)

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit suite.
- `pnpm exec playwright test --grep @disconnect-modal` — smoke (new tag in Task 6).

---

## Task 1: Extend reconnect window to 90s + expose getter

**Files:**
- Modify: `app/actions/match/handleDisconnect.ts`

Read the file first. It has:
- `const RECONNECT_WINDOW_MS = 10_000;` (line ~9)
- `disconnectStore: Map<string, DisconnectRecord>` (line ~18) — keyed by `${matchId}:${playerId}`.

### Step 1: Bump the window + export a helper

- [ ] Change the constant to `90_000` (ninety seconds). Update any inline comment referencing 10 seconds.

- [ ] Add an exported getter at the bottom of the file (above `finalizeMatchOnDisconnectTimeout`):

```ts
/**
 * Returns the timestamp (ms since epoch) when the player first lost their
 * connection for this match, or null if they are currently connected.
 *
 * Used by claimWinAction to check whether the 90s window has elapsed.
 */
export function getDisconnectedAt(
  matchId: string,
  playerId: string,
): number | null {
  const key = `${matchId}:${playerId}`;
  const record = disconnectStore.get(key);
  return record?.disconnectedAt ?? null;
}

export const RECONNECT_WINDOW_MS_EXPORT = RECONNECT_WINDOW_MS;
```

(The `_EXPORT` alias keeps the module's original internal name untouched while giving tests + the claim-win action a public handle.)

### Step 2: Run typecheck

```bash
pnpm typecheck
```

Clean.

### Step 3: Commit

```bash
git add app/actions/match/handleDisconnect.ts
git commit -m "feat(match): extend disconnect window to 90s + export getDisconnectedAt"
```

---

## Task 1b: Forced-winner plumb on `completeMatchInternal`

**Files:**
- Modify: `app/actions/match/completeMatch.ts`
- Modify: `app/actions/match/handleDisconnect.ts` (call site only)

### Why

Per the Warm Editorial spec §6: *"marks match completed, writes final MatchState with calling player as winner, awards truncated score (current scores stand)."* The existing `completeMatchInternal(matchId, reason)` uses `determineMatchWinner(scores, frozenCounts)` — so a disconnected player who happens to be leading would still win. Phase 6 treats loss-of-connection as forfeit; the still-connected / claiming player must win unconditionally.

### Step 1: Extend signature

Add a third optional parameter. If present, skip `determineMatchWinner` and build the result object from the forced id.

```ts
export async function completeMatchInternal(
  matchId: string,
  reason: MatchEndedReason,
  forcedWinnerId?: string,
): Promise<CompleteMatchResult> {
  // ... fetch match, early-return on already-completed ...

  const scores = await fetchLatestScores(supabase, matchId);
  const frozenCounts = computeFrozenTileCountByPlayer(
    (match.frozen_tiles as FrozenTileMap) ?? {},
  );

  const result =
    forcedWinnerId !== undefined
      ? {
          winnerId: forcedWinnerId,
          loserId:
            forcedWinnerId === match.player_a_id
              ? match.player_b_id
              : match.player_a_id,
          isDraw: false,
        }
      : determineMatchWinner(
          scores,
          match.player_a_id,
          match.player_b_id,
          frozenCounts,
        );

  // ... rest unchanged: update, applyRatingChanges(…, result), reset, log, publish, track.
}
```

### Step 2: Update `finalizeMatchOnDisconnectTimeout`

```ts
async function finalizeMatchOnDisconnectTimeout(
  supabase: ReturnType<typeof getServiceRoleClient>,
  matchId: string,
  disconnectedPlayerId: string,
): Promise<void> {
  const { completeMatchInternal } = await import("./completeMatch");

  const { data: match } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id")
    .eq("id", matchId)
    .maybeSingle();

  const nonDisconnectedId = match
    ? match.player_a_id === disconnectedPlayerId
      ? match.player_b_id
      : match.player_a_id
    : undefined;

  await completeMatchInternal(matchId, "disconnect", nonDisconnectedId ?? undefined);
}
```

### Step 3: Test

Add `tests/unit/app/actions/completeMatch.test.ts` (or extend if present) with:

```ts
test("uses forcedWinnerId over determineMatchWinner when provided", async () => {
  // Seed scores with player_b leading 30-10, but pass forcedWinnerId = player_a.
  // Assert matches.update() was called with winner_id = player_a.
});
```

### Step 4: Run tests + typecheck + lint

```bash
pnpm test -- --run tests/unit/app/actions/completeMatch.test.ts
pnpm typecheck
pnpm lint
```

All green.

### Step 5: Commit

```bash
git add app/actions/match/completeMatch.ts app/actions/match/handleDisconnect.ts tests/unit/app/actions/completeMatch.test.ts
git commit -m "feat(match): force winner on disconnect paths (claim-win + 90s auto-finalise)"
```

---

## Task 2: `claimWinAction` Server Action

**Files:**
- Create: `app/actions/match/claimWin.ts`
- Create: `tests/unit/app/actions/claimWin.test.ts`

### Behavior

```ts
claimWinAction(matchId: string) → Promise<ClaimWinResult>

type ClaimWinResult =
  | { status: "ok"; matchId: string }
  | { status: "too_early"; remainingMs: number }
  | { status: "not_disconnected" }
  | { status: "already_completed"; matchId: string }
  | { status: "forbidden" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };
```

Logic:
1. `readLobbySession()` — returns `unauthenticated` if null.
2. `assertWithinRateLimit({ scope: "match:claim-win", limit: 1, windowMs: 60_000, identifier: session.player.id })` — prevents rapid-fire claim attempts. Catches `RateLimitExceededError` and returns `{ status: "rate_limited", retryAfterSeconds }`.
3. Zod-validate `matchId: z.string().uuid()`.
4. Look up `matches` row. If state is already `"completed"`, return `{ status: "already_completed", matchId }`.
5. If caller's id is neither `player_a_id` nor `player_b_id`, return `forbidden`.
6. Identify the opponent id. If `getDisconnectedAt(matchId, opponentId)` is null, return `not_disconnected`.
7. Compute `elapsed = Date.now() - disconnectedAt`. If `elapsed < RECONNECT_WINDOW_MS_EXPORT` (90s), return `{ status: "too_early", remainingMs: RECONNECT_WINDOW_MS_EXPORT - elapsed }`.
8. Call `completeMatchInternal(matchId, "disconnect", session.player.id)` — pass the caller as `forcedWinnerId` so the still-connected player always wins.
9. Return `{ status: "ok", matchId }`.

### Step 1: Failing test

Create `tests/unit/app/actions/claimWin.test.ts` using the established `vi.mock` + `buildChain` pattern (reference `tests/unit/app/actions/getPlayerProfile.test.ts`). Mock:

- `@/lib/matchmaking/profile` → `readLobbySession` returns session for `player-a`.
- `@/lib/supabase/server` → `getServiceRoleClient` with a `matches` chain for `.select("state, player_a_id, player_b_id").eq("id", matchId).maybeSingle()`.
- `@/app/actions/match/handleDisconnect` → `{ getDisconnectedAt: vi.fn(), RECONNECT_WINDOW_MS_EXPORT: 90_000 }`.
- `@/app/actions/match/completeMatch` → `completeMatchInternal: vi.fn()`.

Test cases (8):

1. Unauthenticated → `{ status: "unauthenticated" }`; `completeMatchInternal` not called.
2. Invalid matchId (not UUID) → `{ status: "error", message: "Invalid matchId." }`.
3. Match not found (`maybeSingle` returns `{ data: null }`) → `{ status: "error", message: "Match not found." }`.
4. Caller not in `player_a_id/player_b_id` → `{ status: "forbidden" }`.
5. Match already `state: "completed"` → `{ status: "already_completed", matchId }`.
6. Opponent not disconnected (`getDisconnectedAt` returns null) → `{ status: "not_disconnected" }`.
7. Opponent disconnected 30s ago → `{ status: "too_early", remainingMs: 60_000 }` (approximately — use `expect(result.remainingMs).toBeGreaterThan(59_000).toBeLessThan(61_000)`).
8. Opponent disconnected 95s ago → `{ status: "ok", matchId }`; `completeMatchInternal` called with `(matchId, "disconnect")`.

### Step 2: Verify FAIL, then implement

Create `app/actions/match/claimWin.ts`:

```ts
"use server";

import "server-only";
import { z } from "zod";

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import {
  RECONNECT_WINDOW_MS_EXPORT,
  getDisconnectedAt,
} from "@/app/actions/match/handleDisconnect";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

export type ClaimWinResult =
  | { status: "ok"; matchId: string }
  | { status: "too_early"; remainingMs: number }
  | { status: "not_disconnected" }
  | { status: "already_completed"; matchId: string }
  | { status: "forbidden" }
  | { status: "unauthenticated" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "error"; message: string };

const inputSchema = z.object({ matchId: z.string().uuid() });

export async function claimWinAction(
  matchId: string,
): Promise<ClaimWinResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "unauthenticated" };
  }

  const parsed = inputSchema.safeParse({ matchId });
  if (!parsed.success) {
    return { status: "error", message: "Invalid matchId." };
  }

  try {
    const supabase = getServiceRoleClient();
    const { data: match } = await supabase
      .from("matches")
      .select("state, player_a_id, player_b_id")
      .eq("id", parsed.data.matchId)
      .maybeSingle();

    if (!match) {
      return { status: "error", message: "Match not found." };
    }

    if (match.state === "completed") {
      return { status: "already_completed", matchId: parsed.data.matchId };
    }

    const selfId = session.player.id;
    if (match.player_a_id !== selfId && match.player_b_id !== selfId) {
      return { status: "forbidden" };
    }

    const opponentId =
      match.player_a_id === selfId ? match.player_b_id : match.player_a_id;

    const disconnectedAt = getDisconnectedAt(parsed.data.matchId, opponentId);
    if (disconnectedAt === null) {
      return { status: "not_disconnected" };
    }

    const elapsed = Date.now() - disconnectedAt;
    if (elapsed < RECONNECT_WINDOW_MS_EXPORT) {
      return {
        status: "too_early",
        remainingMs: RECONNECT_WINDOW_MS_EXPORT - elapsed,
      };
    }

    await completeMatchInternal(parsed.data.matchId, "disconnect");
    return { status: "ok", matchId: parsed.data.matchId };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Claim win failed.",
    };
  }
}
```

### Step 3: Run tests, typecheck, lint

All green.

### Step 4: Commit

```bash
git add app/actions/match/claimWin.ts tests/unit/app/actions/claimWin.test.ts
git commit -m "feat(match): add claimWinAction for 90s-disconnect forfeit"
```

---

## Task 3: `useCountdown` hook

**Files:**
- Create: `components/match/useCountdown.ts`
- Create: `tests/unit/components/match/useCountdown.test.ts`

### Behavior

```ts
useCountdown(startSeconds: number): { remaining: number; expired: boolean }
```

- On mount: starts at `startSeconds`, ticks once per 1000ms, floors to 0.
- `remaining` is the whole-second value; `expired === remaining === 0`.
- Respects `startSeconds` changes (resets on change).
- Cleanup on unmount (no memory leaks).

### Step 1: Failing test

Create `tests/unit/components/match/useCountdown.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useCountdown } from "@/components/match/useCountdown";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCountdown", () => {
  test("starts at the initial seconds", () => {
    const { result } = renderHook(() => useCountdown(90));
    expect(result.current.remaining).toBe(90);
    expect(result.current.expired).toBe(false);
  });

  test("decrements every second", () => {
    const { result } = renderHook(() => useCountdown(5));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.remaining).toBe(3);
  });

  test("flips `expired` to true when remaining reaches 0", () => {
    const { result } = renderHook(() => useCountdown(2));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.remaining).toBe(0);
    expect(result.current.expired).toBe(true);
  });

  test("resets when startSeconds changes", () => {
    const { result, rerender } = renderHook(({ s }) => useCountdown(s), {
      initialProps: { s: 10 },
    });
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.remaining).toBe(7);
    rerender({ s: 90 });
    expect(result.current.remaining).toBe(90);
  });
});
```

### Step 2: Verify FAIL

### Step 3: Implement `components/match/useCountdown.ts`

```ts
"use client";

import { useEffect, useState } from "react";

export interface CountdownState {
  remaining: number;
  expired: boolean;
}

export function useCountdown(startSeconds: number): CountdownState {
  const [remaining, setRemaining] = useState(startSeconds);

  useEffect(() => {
    setRemaining(startSeconds);
    if (startSeconds <= 0) return;

    const id = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1_000);

    return () => clearInterval(id);
  }, [startSeconds]);

  return { remaining, expired: remaining <= 0 };
}
```

### Step 4: Verify PASS

### Step 5: Commit

```bash
git add components/match/useCountdown.ts tests/unit/components/match/useCountdown.test.ts
git commit -m "feat(match): add useCountdown hook"
```

---

## Task 4: `DisconnectionModal` component

**Files:**
- Create: `components/match/DisconnectionModal.tsx`
- Create: `tests/unit/components/match/DisconnectionModal.test.tsx`

### Visual spec (from `Overlays.jsx:5–34`)

- `<Dialog open onClose={...} bottomSheetOnMobile={false}>` — centered always.
- Pulse indicator: `<span>` with Tailwind animation (reuse `animate-ping` on a small coloured dot).
- Eyebrow (mono, `text-warn` or `text-ochre-deep`, uppercase): "Connection lost".
- Heading: `{opponentDisplayName} dropped out.` — Fraunces italic, 24–26px.
- Body: "The match is paused. We'll wait up to 90 seconds for them to reconnect, or you can claim the win."
- Countdown: mono, tabular-nums, large (32px), format `m:ss` (so `1:30 → 0:29 → 0:00`).
- Two buttons side-by-side:
  - "Keep waiting" (ghost) — calls `onClose`.
  - "Claim win" (primary) — calls `onClaimWin`; disabled while `expired === false`.
- `data-testid="disconnection-modal"` on the outer wrapper.

### API

```ts
interface DisconnectionModalProps {
  opponentDisplayName: string;
  disconnectedAt: number;        // ms since epoch
  windowMs: number;              // expected 90_000
  onClose: () => void;
  onClaimWin: () => void;
  isClaiming: boolean;           // disable Claim button while the action is in-flight
}
```

The modal computes `startSeconds = Math.max(0, Math.round((disconnectedAt + windowMs - Date.now()) / 1000))` on render — so if the parent re-mounts after a poll refresh, the countdown picks up from the right place.

### Step 1: Failing test

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DisconnectionModal } from "@/components/match/DisconnectionModal";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const WINDOW_MS = 90_000;

function renderModal(overrides: Partial<React.ComponentProps<typeof DisconnectionModal>> = {}) {
  const baseTime = Date.now();
  return render(
    <DisconnectionModal
      opponentDisplayName="Birna"
      disconnectedAt={overrides.disconnectedAt ?? baseTime}
      windowMs={overrides.windowMs ?? WINDOW_MS}
      onClose={overrides.onClose ?? vi.fn()}
      onClaimWin={overrides.onClaimWin ?? vi.fn()}
      isClaiming={overrides.isClaiming ?? false}
    />,
  );
}

describe("DisconnectionModal", () => {
  test("renders opponent name + Connection lost eyebrow", () => {
    renderModal();
    expect(screen.getByText(/Connection lost/i)).toBeInTheDocument();
    expect(screen.getByText(/Birna dropped out/i)).toBeInTheDocument();
  });

  test("shows countdown starting near 90 seconds", () => {
    renderModal();
    expect(screen.getByText(/1:30/)).toBeInTheDocument();
  });

  test("Claim win is disabled while countdown has remaining time", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /Claim win/i });
    expect(btn).toBeDisabled();
  });

  test("Claim win becomes enabled after the window elapses", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /Claim win/i });
    expect(btn).toBeDisabled();
    // Advance just past 90s.
    // (useCountdown ticks each 1s; 91 iterations to reach 0.)
    for (let i = 0; i < 91; i += 1) {
      // advanceTimersByTime step; wrapped in act via the library.
      // @ts-expect-error — vi typing for fake timers
      vi.advanceTimersByTime(1_000);
    }
    expect(btn).not.toBeDisabled();
  });

  test("Claim win click invokes onClaimWin", () => {
    const onClaimWin = vi.fn();
    renderModal({
      disconnectedAt: Date.now() - WINDOW_MS - 1_000, // already expired
      onClaimWin,
    });
    fireEvent.click(screen.getByRole("button", { name: /Claim win/i }));
    expect(onClaimWin).toHaveBeenCalledTimes(1);
  });

  test("Keep waiting click invokes onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /Keep waiting/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Claim win button shows spinner copy while isClaiming", () => {
    renderModal({
      disconnectedAt: Date.now() - WINDOW_MS - 1_000,
      isClaiming: true,
    });
    expect(
      screen.getByRole("button", { name: /Claiming/i }),
    ).toBeDisabled();
  });
});
```

Note: the "advances timers" idiom above should actually use `act(() => vi.advanceTimersByTime(...))` from React Testing Library. Reference the existing `MatchmakingClient.test.tsx` for the exact pattern. If `act` requires you to wrap differently, adapt.

### Step 2: Verify FAIL

### Step 3: Implement `components/match/DisconnectionModal.tsx`

```tsx
"use client";

import { useId } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useCountdown } from "@/components/match/useCountdown";

interface DisconnectionModalProps {
  opponentDisplayName: string;
  disconnectedAt: number;
  windowMs: number;
  onClose: () => void;
  onClaimWin: () => void;
  isClaiming: boolean;
}

function formatCountdown(remaining: number): string {
  const clamped = Math.max(0, remaining);
  const minutes = Math.floor(clamped / 60);
  const seconds = (clamped % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function DisconnectionModal({
  opponentDisplayName,
  disconnectedAt,
  windowMs,
  onClose,
  onClaimWin,
  isClaiming,
}: DisconnectionModalProps) {
  const titleId = useId();
  const startSeconds = Math.max(
    0,
    Math.round((disconnectedAt + windowMs - Date.now()) / 1000),
  );
  const { remaining, expired } = useCountdown(startSeconds);
  const canClaim = expired && !isClaiming;

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabelledBy={titleId}
      bottomSheetOnMobile={false}
    >
      <div
        data-testid="disconnection-modal"
        className="flex flex-col items-center gap-5 text-center"
      >
        <div className="relative flex h-10 w-10 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn/60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-warn" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-warn">
          Connection lost
        </p>
        <h2
          id={titleId}
          className="font-display text-2xl font-semibold italic text-ink sm:text-3xl"
        >
          {opponentDisplayName} dropped out.
        </h2>
        <p className="max-w-xs text-sm text-ink-3">
          The match is paused. We&apos;ll wait up to 90 seconds for them to
          reconnect, or you can claim the win.
        </p>
        <p
          className="font-mono text-3xl tabular-nums tracking-[0.04em] text-ink"
          aria-live="polite"
        >
          {formatCountdown(remaining)}
        </p>
        <div className="mt-2 grid w-full grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isClaiming}>
            Keep waiting
          </Button>
          <Button onClick={onClaimWin} disabled={!canClaim}>
            {isClaiming ? "Claiming…" : "Claim win"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

### Step 4: Verify PASS, typecheck + lint clean

### Step 5: Commit

```bash
git add components/match/DisconnectionModal.tsx tests/unit/components/match/DisconnectionModal.test.tsx
git commit -m "feat(match): add DisconnectionModal with 90s countdown + claim-win CTA"
```

---

## Task 5: Wire `DisconnectionModal` into `MatchClient`

**Files:**
- Modify: `components/match/MatchClient.tsx`

### Changes

1. Import `DisconnectionModal`, `claimWinAction`, and the `RECONNECT_WINDOW_MS_EXPORT` constant (to pass as `windowMs`).
2. Add local state:
   - `const [showDisconnectModal, setShowDisconnectModal] = useState(true);` — so the user can close it via "Keep waiting" and not be pestered by re-opens on every state broadcast while the opponent is still away.
   - `const [claiming, setClaiming] = useState(false);`
   - `const [disconnectStartedAt, setDisconnectStartedAt] = useState<number | null>(null);` — records local wall-clock when the opponent first drops, so the countdown stays consistent across re-renders.
3. In the existing `onState` handler, when `snapshot.disconnectedPlayerId` matches the opponent and `disconnectStartedAt === null`, call `setDisconnectStartedAt(Date.now())` and `setShowDisconnectModal(true)`. When the flag clears, reset both to `null`/`false`.
4. Add a `handleClaim` callback that calls `claimWinAction(matchId)`, toasts any error, and on success clears local state (the realtime broadcast will navigate the client to the post-game screen naturally).
5. Mount the modal conditionally:

```tsx
{matchState.disconnectedPlayerId === opponentId &&
 showDisconnectModal &&
 disconnectStartedAt ? (
  <DisconnectionModal
    opponentDisplayName={opponentDisplayName}
    disconnectedAt={disconnectStartedAt}
    windowMs={90_000}
    onClose={() => setShowDisconnectModal(false)}
    onClaimWin={handleClaim}
    isClaiming={claiming}
  />
) : null}
```

`windowMs` is hard-coded to `90_000` here; if we ever need to tune it dynamically we can re-export from the Server Action side.

- [ ] **Step 1: Implement the wiring** — read the file first to learn where `opponentId` / `opponentDisplayName` are derived. They should already be computed (see the existing `PlayerPanel` `isDisconnected` wiring around line 802).

- [ ] **Step 2: Write a focused MatchClient test** covering the new mount block. Mock `claimWinAction` and assert:
  - The modal renders when `matchState.disconnectedPlayerId === opponentId` after state broadcast.
  - Clicking "Keep waiting" hides the modal.
  - Clicking "Claim win" after the countdown expires calls `claimWinAction` once.

Existing MatchClient tests likely live at `tests/unit/components/match/MatchClient.test.tsx` (if present) — extend there. If no MatchClient test exists, create one scoped just to the disconnect-modal behaviour.

- [ ] **Step 3: Run typecheck + unit suite**

```bash
pnpm typecheck
pnpm lint
pnpm test -- --run
```

- [ ] **Step 4: Commit**

```bash
git add components/match/MatchClient.tsx tests/unit/components/match/MatchClient.test.tsx
git commit -m "feat(match): mount DisconnectionModal when opponent drops"
```

(If no pre-existing MatchClient test file, include whatever new test file you create in the `git add`.)

---

## Task 6: `@disconnect-modal` Playwright smoke

**Files:**
- Create: `tests/integration/ui/disconnect-modal.spec.ts`

### Approach

Simulating a real disconnect end-to-end is expensive. A pragmatic smoke test:

1. Two players log in and start a match via `startMatchWithDirectInvite` helper.
2. Close Player B's context mid-match.
3. On Player A, wait for the `disconnection-modal` testid (the backend broadcasts `disconnectedPlayerId` within ~1-2s of channel closure).
4. Assert the countdown and the disabled Claim-win button.
5. Optional: inject fake time via `page.evaluate` to advance the countdown past 90s, then click Claim-win and confirm match completion.

Full-scale claim-win flow tested at unit level (server action), so the Playwright smoke can stop at step 3-4.

- [ ] **Step 1: Write the spec** (scope to chromium, pattern from `matchmaking-phase-4b.spec.ts`)

```ts
import { test, expect, type BrowserContext } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Phase 6 disconnect-modal runs on chromium only",
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

test.describe("@disconnect-modal Phase 6", () => {
  test("opponent disconnect shows the modal on the remaining player's page", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([
        loginAs(ctxA, "dc-alpha"),
        loginAs(ctxB, "dc-beta"),
      ]);

      await startMatchWithDirectInvite(a.page, b.page, {
        playerBUsername: b.username,
      });

      // Player B "disconnects" — close their context.
      await ctxB.close();

      // Player A should see the disconnection modal within a few seconds.
      await expect(a.page.getByTestId("disconnection-modal")).toBeVisible({
        timeout: 15_000,
      });
      // Claim win is disabled while the 90s countdown is running.
      await expect(
        a.page.getByRole("button", { name: /Claim win/i }),
      ).toBeDisabled();
    } finally {
      await ctxA.close();
      // ctxB already closed
    }
  });

  test("Keep waiting dismisses the modal but the banner/badge stays", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([
        loginAs(ctxA, "dc-keep-a"),
        loginAs(ctxB, "dc-keep-b"),
      ]);

      await startMatchWithDirectInvite(a.page, b.page, {
        playerBUsername: b.username,
      });

      await ctxB.close();

      const modal = a.page.getByTestId("disconnection-modal");
      await expect(modal).toBeVisible({ timeout: 15_000 });

      await a.page.getByRole("button", { name: /Keep waiting/i }).click();
      await expect(modal).toBeHidden({ timeout: 5_000 });
    } finally {
      await ctxA.close();
    }
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm exec playwright test --grep @disconnect-modal tests/integration/ui/disconnect-modal.spec.ts
```

Expected: 2 chromium pass + 2 skipped on firefox.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/ui/disconnect-modal.spec.ts
git commit -m "test(match): add @disconnect-modal Playwright smoke"
```

---

## Task 7: CLAUDE.md + PR

- [ ] **Step 1: Update CLAUDE.md**

```
| 5b | `/profile` + `/profile/[handle]` pages + rating chart + word cloud | Merged |
| 6  | Disconnection modal + claim-win Server Action | In progress |
```

Under `components/match` in the Directory Structure section, extend the existing line:

```
`/components/match` — ...existing list..., `DisconnectionModal`, `useCountdown` *(Phase 6)*
```

- [ ] **Step 2: Commit docs + plan**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-04-22-phase-6-disconnect-modal.md
git commit -m "docs(claude): reflect Phase 6 disconnection modal"
```

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin 027-disconnect-modal-phase-6
gh pr create --title "feat(match): disconnection modal + claimWinAction (Phase 6)" --body "..."
```

PR body should include: 10s → 90s reconnect window bump, new `claimWinAction`, new `DisconnectionModal` + `useCountdown`, replaced passive banner with centered modal.

---

## Verification (end-to-end)

After all commits land locally:

1. `pnpm build && pnpm start` (or `pnpm dev`).
2. Log in two browsers, start a match.
3. Close one browser window — the remaining player should see the disconnection modal within a few seconds.
4. "Keep waiting" dismisses the modal; wait a few more seconds, nothing should break.
5. Wait for the 90-second auto-finalize: the match page should navigate to the post-game summary on the remaining player's side.
6. As a follow-up (manual test with system clock manipulation, or by adjusting `RECONNECT_WINDOW_MS` to e.g. 10s temporarily): click Claim win after countdown expires; confirm match completes with `ended_reason = "disconnect"` and the clicker is the winner.

## Acceptance criteria

- [x] `RECONNECT_WINDOW_MS` bumped to 90_000.
- [x] `getDisconnectedAt(matchId, playerId)` exported from `handleDisconnect.ts`.
- [x] `claimWinAction(matchId)` implements auth + 90s gate + idempotent completion.
- [x] `useCountdown` ticks every second, handles re-init, cleans up on unmount.
- [x] `DisconnectionModal` renders Warm Editorial design: pulse, copy, countdown, Keep-waiting + Claim-win (disabled while ticking).
- [x] `MatchClient` mounts the modal when `disconnectedPlayerId === opponentId` and unmounts when cleared.
- [x] Playwright `@disconnect-modal` green on chromium.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test -- --run` all clean.
- [x] CLAUDE.md Phase table + directory index updated.

---

## Critical files referenced

- `app/actions/match/handleDisconnect.ts` — 1-line constant change + export in Task 1.
- `app/actions/match/completeMatch.ts` — `completeMatchInternal(matchId, "disconnect")` reused.
- `lib/match/statePublisher.ts` — broadcast on state change (already in place).
- `components/ui/Dialog.tsx` — centered modal primitive.
- `components/match/MatchClient.tsx:339–350` — existing disconnect state-machine site.
- `docs/design_documentation/wottle-game-design/project/prototype/screens/Overlays.jsx` — pixel reference.
- `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §6 — design spec.
