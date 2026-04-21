# Phase 4a — Landing Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Warm Editorial landing page off the lobby onto a dedicated `/` route. Unauthenticated visitors land on a typography-forward hero with the username form; authenticated visitors redirect to `/lobby`. The lobby page stops carrying the login form.

**Architecture:** `/` becomes a standalone Server Component page. If `readLobbySession()` returns a session, redirect to `/lobby`. Otherwise render a new client-side `LandingScreen` component that reuses the existing `loginAction` via `useActionState`. The lobby page's current "Enter the lobby" `<Card>` branch is deleted — `/lobby` now always redirects to `/` if no session. `app/page.tsx` stops re-exporting the lobby page.

**Tech Stack:** Next.js 16 App Router (Server Components + client form actions), React 19 `useActionState` / `useFormStatus`, Tailwind CSS 4 (Phase 1a OKLCH tokens), `next/font/google` Fraunces + Inter already loaded by `app/layout.tsx`, Vitest + React Testing Library, Playwright.

**Branch:** `023-landing-phase-4a`, branched from `origin/main` (PR #127 merged).

**Prerequisites:**

- Design spec: `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §4 Phase 4.
- Prototype reference: `docs/design_documentation/wottle-game-design/project/prototype/screens/Landing.jsx`.
- Existing auth Server Action: `app/actions/auth/login.ts` (`loginAction`, `LoginActionState`). Reused verbatim.
- Existing login form: `components/lobby/LobbyLoginForm.tsx` lines 15–82 — the interaction pattern (`useActionState(loginAction, ...)` + `router.refresh()` on success) is copied into `LandingScreen`. Do **not** reuse the component directly; the landing's visual language (pill input, centered hero) diverges enough that a parallel component is cleaner.
- `readLobbySession()`: `lib/matchmaking/profile.ts` lines 150–165. Used server-side to gate the redirect.
- Existing theme tokens live in `app/globals.css` under `@theme` (Phase 1a). Reused without extension.

**Test commands (run after every task):**

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit + integration suite.
- `pnpm exec playwright test --grep @landing` — new tag added in Task 8.

---

## Scope decisions

**In scope:**

1. Component `LandingScreen` — hero copy, 6-tile "WOTTLE" vignette, username form backed by `loginAction`.
2. Component `LandingTileVignette` — decorative row of 6 letter tiles ("W","O","T","T","L","E") styled to match the existing letterpress look from `app/styles/board.css`.
3. Page `app/page.tsx` — Server Component that redirects to `/lobby` when a session exists, otherwise renders `LandingScreen`.
4. Route guard update on `/lobby` — when no session, redirect to `/` (today the page falls through to a login Card).
5. Deletion of the "Enter the lobby" Card branch from `components/lobby/`'s parent `app/(lobby)/page.tsx`.
6. Deletion of `LobbyLoginForm.tsx` **only if** nothing else references it after the lobby page is cleaned up (verify first).
7. Integration test (Vitest) — landing redirects when session cookie is present.
8. Integration test (Vitest) — `/lobby` redirects to `/` when no session cookie.
9. Playwright smoke (`@landing`) — full flow: unauthenticated visitor → landing → submit username → lobby.
10. Unit tests for `LandingScreen` + `LandingTileVignette`.

**Deferred:**

- i18n — the current codebase is English-only; Fraunces italic / ochre-deep styling is the focus.
- "Magic link after first game" footer copy — included as static sub-copy only; no magic-link backend is in scope.
- Marketing copy variants / A/B. Single copy block per spec.
- Visual regression baselines — not wired into CI yet for the lobby screens either.

---

## File Structure

**Create:**

- `app/(landing)/layout.tsx` — thin route-group layout so the landing inherits `app/layout.tsx` fonts but renders without the lobby's `<main>` wrapper styling. (Route groups don't change the URL; this gives us a dedicated layout without a path segment.)
- `app/(landing)/page.tsx` — Server Component; redirects to `/lobby` if session, else renders `LandingScreen`.
- `components/landing/LandingScreen.tsx` — client component with the form and hero copy.
- `components/landing/LandingTileVignette.tsx` — decorative six-tile row.
- `tests/unit/components/landing/LandingScreen.test.tsx` — render test + validation hint + submit behavior.
- `tests/unit/components/landing/LandingTileVignette.test.tsx` — renders six letter tiles in the correct order with the letterpress class.
- `tests/integration/app/landing-redirect.test.ts` — Vitest integration: `/` redirects to `/lobby` when session cookie present.
- `tests/integration/app/lobby-redirect.test.ts` — Vitest integration: `/lobby` redirects to `/` when no session cookie.
- `tests/integration/ui/landing.spec.ts` — Playwright `@landing` smoke.

**Modify:**

- `app/page.tsx` — stop re-exporting `/lobby`. Move content to `app/(landing)/page.tsx`; after this task, `app/page.tsx` is deleted (the route-group page owns `/`).
- `app/(lobby)/page.tsx` — delete the session-less "Enter the lobby" Card branch; convert the page to redirect to `/` when `readLobbySession()` returns `null`. The `<LobbyHero>` + authenticated content remain.

**Delete (only after verifying no other references):**

- `components/lobby/LobbyLoginForm.tsx` — verify via `grep -r "LobbyLoginForm" app components lib tests` that only `app/(lobby)/page.tsx` imports it before removing.

**Not touched:**

- `app/actions/auth/login.ts` — reused verbatim.
- `lib/matchmaking/profile.ts` — `readLobbySession` is unchanged.
- `components/lobby/LobbyHero.tsx` — continues to live in the authenticated lobby layout.
- `components/ui/TopBar.tsx` — the nav stays (the landing inherits it via `app/layout.tsx`).

---

## Task 1: Landing tile vignette component

**Files:**

- Create: `components/landing/LandingTileVignette.tsx`
- Create: `tests/unit/components/landing/LandingTileVignette.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/landing/LandingTileVignette.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LandingTileVignette } from "@/components/landing/LandingTileVignette";

describe("LandingTileVignette", () => {
  test("renders six letter tiles spelling WOTTLE in order", () => {
    render(<LandingTileVignette />);
    const tiles = screen.getAllByTestId("landing-tile");
    expect(tiles).toHaveLength(6);
    expect(tiles.map((t) => t.textContent?.trim())).toEqual([
      "W",
      "O",
      "T",
      "T",
      "L",
      "E",
    ]);
  });

  test("renders the mono eyebrow caption", () => {
    render(<LandingTileVignette />);
    expect(screen.getByText(/WO-rd · ba-TTLE/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/landing/LandingTileVignette.test.tsx`
Expected: FAIL with `Cannot find module '@/components/landing/LandingTileVignette'`.

- [ ] **Step 3: Create the component**

Create `components/landing/LandingTileVignette.tsx`:

```tsx
const LETTERS = ["W", "O", "T", "T", "L", "E"] as const;

export function LandingTileVignette() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-1 opacity-90"
      >
        {LETTERS.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            data-testid="landing-tile"
            className="tile tile--letterpress flex h-14 w-14 items-center justify-center rounded-md font-display text-2xl font-semibold text-ink"
          >
            {letter}
          </span>
        ))}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        WO-rd · ba-TTLE
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/unit/components/landing/LandingTileVignette.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/landing/LandingTileVignette.tsx tests/unit/components/landing/LandingTileVignette.test.tsx
git commit -m "feat(landing): add decorative WOTTLE tile vignette"
```

---

## Task 2: Landing screen component — render + form fields

**Files:**

- Create: `components/landing/LandingScreen.tsx`
- Create: `tests/unit/components/landing/LandingScreen.test.tsx`

- [ ] **Step 1: Write the failing render test**

Create `tests/unit/components/landing/LandingScreen.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/actions/auth/login", () => ({
  loginAction: vi.fn(async () => ({ status: "idle" })),
}));

import { LandingScreen } from "@/components/landing/LandingScreen";

describe("LandingScreen", () => {
  test("renders the Warm Editorial hero headline and sub-copy", () => {
    render(<LandingScreen />);
    expect(
      screen.getByText(/A real-time word duel/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Play with\s+letters\./i,
    );
    expect(
      screen.getByText(/Two players\. Ten rounds\./i),
    ).toBeInTheDocument();
  });

  test("renders a pill-shaped username input and submit button", () => {
    render(<LandingScreen />);
    const input = screen.getByTestId("landing-username-input");
    expect(input).toHaveAttribute("name", "username");
    expect(input).toHaveAttribute("placeholder", "Choose a username");
    expect(
      screen.getByRole("button", { name: /Enter lobby/i }),
    ).toBeInTheDocument();
  });

  test("renders the validation hint row", () => {
    render(<LandingScreen />);
    expect(
      screen.getByText(/3–24 characters · letters, numbers, dashes/i),
    ).toBeInTheDocument();
  });

  test("mounts the decorative tile vignette", () => {
    render(<LandingScreen />);
    expect(screen.getAllByTestId("landing-tile")).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/landing/LandingScreen.test.tsx`
Expected: FAIL with `Cannot find module '@/components/landing/LandingScreen'`.

- [ ] **Step 3: Create the component**

Create `components/landing/LandingScreen.tsx`:

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { loginAction, type LoginActionState } from "@/app/actions/auth/login";
import { LandingTileVignette } from "@/components/landing/LandingTileVignette";

const INITIAL_STATE: LoginActionState = { status: "idle" };

export function LandingScreen() {
  const [state, formAction] = useActionState(loginAction, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-58px)] w-full max-w-3xl items-center justify-center px-6 py-16">
      <div className="w-full text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
          A real-time word duel · Icelandic
        </p>

        <h1 className="mt-4 font-display text-6xl font-semibold leading-[1.1] text-ink sm:text-7xl">
          Play with{" "}
          <em className="font-display not-italic text-ochre-deep">letters.</em>
        </h1>

        <p className="mx-auto mt-10 max-w-[52ch] text-base leading-relaxed text-ink-3 sm:text-lg">
          Two players. Ten rounds. A ten-by-ten grid. Swap any two tiles to
          forge words in any direction — and claim the letters as territory.
          Best score wins.
        </p>

        <form
          action={formAction}
          data-testid="landing-login-form"
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <input
            id="username"
            name="username"
            type="text"
            inputMode="text"
            autoComplete="off"
            required
            maxLength={24}
            placeholder="Choose a username"
            data-testid="landing-username-input"
            className="w-[280px] rounded-full border border-hair-strong bg-paper px-5 py-3 font-sans text-sm text-ink placeholder:text-ink-soft focus:border-ochre-deep focus:outline-none focus:ring-2 focus:ring-ochre-deep/30"
          />
          <SubmitButton />
        </form>

        {state.status === "error" && state.message ? (
          <p
            role="alert"
            data-testid="landing-login-error"
            className="mx-auto mt-4 max-w-sm rounded-md border border-bad/50 bg-bad/10 px-3 py-2 text-xs text-bad"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-ink-soft">
          <span>3–24 characters · letters, numbers, dashes</span>
          <span aria-hidden="true">·</span>
          <span>Magic link after first game</span>
        </div>

        <div className="mt-16">
          <LandingTileVignette />
        </div>
      </div>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="landing-login-submit"
      className="lobby-primary-cta inline-flex min-h-[52px] items-center justify-center rounded-full px-6 py-3 font-display text-base font-semibold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-focus"
    >
      {pending ? "Joining…" : "Enter lobby →"}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/unit/components/landing/LandingScreen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/landing/LandingScreen.tsx tests/unit/components/landing/LandingScreen.test.tsx
git commit -m "feat(landing): add LandingScreen hero + username form"
```

---

## Task 3: Landing screen — error rendering + success refresh

**Files:**

- Modify: `tests/unit/components/landing/LandingScreen.test.tsx`

- [ ] **Step 1: Add two new tests at the end of the existing `describe` block**

```tsx
  test("renders a server error when loginAction returns status='error'", async () => {
    const { useActionState } = await import("react");
    const spy = vi
      .spyOn({ useActionState }, "useActionState")
      .mockReturnValue([
        { status: "error", message: "Username already taken" } as LoginActionState,
        vi.fn(),
        false,
      ] as unknown as ReturnType<typeof useActionState>);
    render(<LandingScreen />);
    expect(screen.getByTestId("landing-login-error").textContent).toContain(
      "Username already taken",
    );
    spy.mockRestore();
  });

  test("calls router.refresh when loginAction returns status='success'", async () => {
    const refresh = vi.fn();
    const navigationModule = await import("next/navigation");
    vi.spyOn(navigationModule, "useRouter").mockReturnValue({
      refresh,
      push: vi.fn(),
    } as unknown as ReturnType<typeof navigationModule.useRouter>);

    const reactModule = await import("react");
    vi.spyOn(reactModule, "useActionState").mockReturnValue([
      { status: "success" } as LoginActionState,
      vi.fn(),
      false,
    ] as unknown as ReturnType<typeof reactModule.useActionState>);

    render(<LandingScreen />);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
```

Add the import at the top of the test file if missing:

```tsx
import type { LoginActionState } from "@/app/actions/auth/login";
```

- [ ] **Step 2: Run test to verify both new tests pass**

Run: `pnpm test -- --run tests/unit/components/landing/LandingScreen.test.tsx`
Expected: PASS (6 tests total).

If the `vi.spyOn` calls don't work reliably across Vitest versions, simplify by setting `mockStoreState` style mocks at module top (same pattern as `tests/unit/components/lobby/LobbyStatsStrip.test.tsx`). Prefer that pattern if the inline spies flake.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/components/landing/LandingScreen.test.tsx
git commit -m "test(landing): cover error + success states in LandingScreen"
```

---

## Task 4: Landing route group + page

**Files:**

- Create: `app/(landing)/layout.tsx`
- Create: `app/(landing)/page.tsx`
- Delete: `app/page.tsx`

- [ ] **Step 1: Write a route-level test**

Create `tests/integration/app/landing-redirect.test.ts`:

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
import LandingPage from "@/app/(landing)/page";

describe("LandingPage route", () => {
  test("redirects to /lobby when a session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce({
      token: "tok",
      issuedAt: Date.now(),
      player: {
        id: "abc",
        username: "ari",
        displayName: "Ari",
        status: "available",
        lastSeenAt: new Date().toISOString(),
        eloRating: 1200,
      },
    });

    await expect(LandingPage()).rejects.toThrow("NEXT_REDIRECT:/lobby");
  });

  test("renders the landing screen when no session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    const element = await LandingPage();
    expect(element).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- --run tests/integration/app/landing-redirect.test.ts`
Expected: FAIL with `Cannot find module '@/app/(landing)/page'`.

- [ ] **Step 3: Create the route group layout**

Create `app/(landing)/layout.tsx`:

```tsx
import type { ReactNode } from "react";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <div className="landing-shell">{children}</div>;
}
```

- [ ] **Step 4: Create the landing page Server Component**

Create `app/(landing)/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { LandingScreen } from "@/components/landing/LandingScreen";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function LandingPage() {
  const session = await readLobbySession();
  if (session) {
    redirect("/lobby");
  }
  return <LandingScreen />;
}
```

- [ ] **Step 5: Delete the stub re-export**

```bash
git rm app/page.tsx
```

Next.js will resolve `/` to `app/(landing)/page.tsx` via the route group.

- [ ] **Step 6: Run tests**

Run: `pnpm test -- --run tests/integration/app/landing-redirect.test.ts`
Expected: PASS (2 tests).

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/\(landing\)/layout.tsx app/\(landing\)/page.tsx tests/integration/app/landing-redirect.test.ts
git commit -m "feat(landing): wire /(landing)/page with session redirect"
```

---

## Task 5: Lobby page — drop the login branch, redirect instead

**Files:**

- Modify: `app/(lobby)/page.tsx`
- Create: `tests/integration/app/lobby-redirect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/app/lobby-redirect.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
  fetchLobbySnapshot: vi.fn(),
  healStuckInMatchStatus: vi.fn(),
}));

vi.mock("@/app/actions/player/getTopPlayers", () => ({
  getTopPlayers: vi.fn(async () => ({ players: [] })),
}));
vi.mock("@/app/actions/match/getRecentGames", () => ({
  getRecentGames: vi.fn(async () => ({ games: [] })),
}));

import { readLobbySession } from "@/lib/matchmaking/profile";
import LobbyPage from "@/app/(lobby)/page";

describe("LobbyPage route", () => {
  test("redirects to / when no session cookie is present", async () => {
    vi.mocked(readLobbySession).mockResolvedValueOnce(null);
    await expect(LobbyPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/integration/app/lobby-redirect.test.ts`
Expected: FAIL — the lobby currently renders a login Card for null sessions.

- [ ] **Step 3: Edit `app/(lobby)/page.tsx`**

Replace the file contents with (remove the `<Card>` login branch and the unused imports):

```tsx
import { redirect } from "next/navigation";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getTopPlayers } from "@/app/actions/player/getTopPlayers";
import { LobbyHero } from "@/components/lobby/LobbyHero";
import { LobbyList } from "@/components/lobby/LobbyList";
import { LobbyStatsStrip } from "@/components/lobby/LobbyStatsStrip";
import { PlayNowCard } from "@/components/lobby/PlayNowCard";
import { RecentGamesCard } from "@/components/lobby/RecentGamesCard";
import { TopOfBoardCard } from "@/components/lobby/TopOfBoardCard";
import {
  fetchLobbySnapshot,
  healStuckInMatchStatus,
  readLobbySession,
} from "@/lib/matchmaking/profile";

export default async function LobbyPage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }

  await healStuckInMatchStatus(session.player.id);

  const [initialPlayers, topPlayersResult, recentGamesResult] =
    await Promise.all([
      fetchLobbySnapshot(),
      getTopPlayers({ limit: 6 }).catch(() => ({ players: [] })),
      getRecentGames({ playerId: session.player.id, limit: 6 }).catch(
        () => ({ games: [] }),
      ),
    ]);

  return (
    <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 pb-24 pt-6 sm:gap-12 sm:px-8 sm:pb-16 sm:pt-10">
      <LobbyHero />
      <LobbyStatsStrip selfId={session.player.id} />
      <PlayNowCard currentPlayer={session.player} />
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-text-primary">
            Players online
          </h2>
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
            Live lobby
          </p>
        </div>
        <LobbyList
          currentPlayer={session.player}
          initialPlayers={initialPlayers}
        />
      </section>
      <section
        className="grid gap-6 lg:grid-cols-[1.6fr_1fr]"
        aria-label="Lobby activity"
      >
        <RecentGamesCard games={recentGamesResult.games} />
        <TopOfBoardCard players={topPlayersResult.players} />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/integration/app/lobby-redirect.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the broader unit/integration suite**

Run: `pnpm test -- --run`
Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add app/\(lobby\)/page.tsx tests/integration/app/lobby-redirect.test.ts
git commit -m "feat(lobby): redirect to / when no session (login lives on landing now)"
```

---

## Task 6: Delete LobbyLoginForm (if unreferenced)

**Files:**

- Delete: `components/lobby/LobbyLoginForm.tsx` (conditional)

- [ ] **Step 1: Verify no remaining imports**

Run:

```bash
grep -rn "LobbyLoginForm" app components lib tests
```

Expected: **no matches**. If any match remains (other than a CLAUDE.md mention, which is documentation), stop and resolve that reference before deleting.

- [ ] **Step 2: Delete the component**

```bash
git rm components/lobby/LobbyLoginForm.tsx
```

- [ ] **Step 3: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(lobby): remove unused LobbyLoginForm (moved to LandingScreen)"
```

---

## Task 7: Update CLAUDE.md architecture notes

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the `components/lobby` line to drop `LobbyLoginForm`**

In `CLAUDE.md`, find the line:

```
`/components/lobby` — `LobbyHero`, `LobbyList`, `LobbyDirectory`, `LobbyCard`, `LobbyLoginForm`, `LobbyStatsStrip`, ...
```

Replace with:

```
`/components/lobby` — `LobbyHero`, `LobbyList`, `LobbyDirectory`, `LobbyCard`, `LobbyStatsStrip`, ...
```

- [ ] **Step 2: Add a `components/landing` entry near the `components/lobby` line**

Add:

```
`/components/landing` — `LandingScreen`, `LandingTileVignette`
```

- [ ] **Step 3: Update the Phase table**

In the table under `Warm Editorial Redesign`, flip Phase 4's `Status` column from `Planned` to `In progress` (or `Merged` once this PR lands — leave as `In progress` for the PR open state).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): reflect Phase 4a landing screen split"
```

---

## Task 8: Playwright `@landing` smoke

**Files:**

- Create: `tests/integration/ui/landing.spec.ts`

- [ ] **Step 1: Write the failing Playwright test**

Create `tests/integration/ui/landing.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("@landing Phase 4a landing screen", () => {
  test("unauthenticated visitor sees the landing hero", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Play with\s+letters\./i }),
    ).toBeVisible();
    await expect(page.getByTestId("landing-username-input")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Enter lobby/i }),
    ).toBeVisible();
  });

  test("submitting a valid username lands on /lobby", async ({ page }) => {
    const username = generateTestUsername("landing");
    await page.goto("/");
    await page.getByTestId("landing-username-input").fill(username);
    await page.getByTestId("landing-login-submit").click();
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
    await expect(page.getByTestId("lobby-shell")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("authenticated visit to / redirects to /lobby", async ({ page }) => {
    const username = generateTestUsername("landing-auth");
    await page.goto("/");
    await page.getByTestId("landing-username-input").fill(username);
    await page.getByTestId("landing-login-submit").click();
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });

    await page.goto("/");
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm exec playwright test --grep @landing`
Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/ui/landing.spec.ts
git commit -m "test(landing): add @landing Playwright smoke covering form + redirect"
```

---

## Task 9: Manual verification pass

- [ ] `pnpm dev`, open `http://localhost:3000/` in a fresh browser (or incognito):
  - Hero headline reads "Play with *letters.*" with the italic word in `ochre-deep`.
  - Pill-shaped input is 280px wide; button renders "Enter lobby →".
  - Validation hint row reads "3–24 characters · letters, numbers, dashes · Magic link after first game".
  - Decorative six-tile "WOTTLE" vignette + mono caption "WO-rd · ba-TTLE".
  - Submitting a username navigates to `/lobby` and the lobby renders with the correct session.
- [ ] Navigate to `/lobby` without a session (clear cookies) — lands back on `/`.
- [ ] Navigate to `/` while logged in — redirects to `/lobby`.
- [ ] Inspect the `/` page source — no login form rendered on the lobby.

---

## Task 10: Open the PR

- [ ] **Step 1: Confirm CI is green locally**

Run: `pnpm lint && pnpm typecheck && pnpm test -- --run`
Expected: all clean.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin 023-landing-phase-4a
gh pr create --title "feat(landing): dedicated / landing screen (Phase 4a)" \
  --body "$(cat <<'EOF'
## Summary

- Landing at `/` is now its own Server Component page with the Warm Editorial hero (`Play with letters.`), pill username input, validation hint, and decorative WOTTLE tile vignette.
- `/lobby` no longer carries the login form; it redirects unauthenticated users to `/`. Authenticated `/` visits redirect to `/lobby`.
- `components/lobby/LobbyLoginForm.tsx` was removed; `LandingScreen` is the new entry point.

Implements Phase 4a of the Warm Editorial redesign (docs/superpowers/specs/2026-04-19-wottle-design-implementation.md §4).

## Test plan

- [x] Unit: LandingScreen + LandingTileVignette tests.
- [x] Integration: `/` redirects when session exists; `/lobby` redirects when session missing.
- [x] Playwright @landing smoke: hero visible, submit → lobby, authed `/` → lobby.
- [ ] Manual: run locally, confirm typography (Fraunces italic, ochre-deep), pill input width, decorative tiles, redirects both directions.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance criteria

- [x] `/` renders `LandingScreen` for unauthenticated visitors.
- [x] `/` redirects to `/lobby` when `readLobbySession()` returns a session.
- [x] `/lobby` redirects to `/` when `readLobbySession()` returns null.
- [x] `LobbyLoginForm` is removed from the codebase.
- [x] Hero copy, pill input, validation hints, and decorative tile vignette all match the prototype.
- [x] All tests pass, lint/typecheck clean.
- [x] CLAUDE.md component index reflects the new `components/landing` directory.
