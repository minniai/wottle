# Lobby Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TopBar user chip and dropdown that lets the logged-in user sign out, optionally forfeiting an active match so a different user can log in during the playtest.

**Architecture:** One new Server Action (`logoutAction`) that clears the session cookie + presence row (and invokes the existing `resignMatch` first when opted-in). Two new client components (`UserMenu`, `LogoutConfirmDialog`) mounted from a now-async `TopBar` server component. Reuses `Avatar`, `Dialog`, `Button`, `useFocusTrap`, `rovingFocus`, `resignMatch`, `findActiveMatchForPlayer`, `expireLobbyPresence`, and the `presenceStore.disconnect` teardown already built in previous work. No schema changes. No new primitives.

**Tech Stack:** Next.js 16 App Router (async server components, Server Actions), Supabase JS v2 (service role for teardown), React 19, Tailwind CSS 4.x with OKLCH tokens, Zustand (`useLobbyPresenceStore`), `lucide-react` for icons, Vitest (unit), Playwright (integration). TDD: Red → Green → Refactor; one atomic commit per passing test per `CLAUDE.md`.

**Spec:** `docs/superpowers/specs/2026-04-20-lobby-logout-design.md`.

---

## File Structure

| File | Kind | Responsibility |
|---|---|---|
| `lib/matchmaking/profile.ts` | **MODIFY** | Export `SESSION_COOKIE_NAME` (currently private const at L28). |
| `app/actions/auth/logout.ts` | **NEW** | `logoutAction({ resignActiveMatch? }): Promise<LogoutResult>` — rate-limited teardown. |
| `tests/unit/app/actions/auth/logout.test.ts` | **NEW** | Unit tests for the above. |
| `components/ui/LogoutConfirmDialog.tsx` | **NEW** | Destructive-styled wrapper around `Dialog`. |
| `tests/unit/components/ui/LogoutConfirmDialog.test.tsx` | **NEW** | Unit tests. |
| `components/ui/UserMenu.tsx` | **NEW** | Chip + dropdown; owns menu and dialog state; calls `logoutAction`. |
| `tests/unit/components/ui/UserMenu.test.tsx` | **NEW** | Unit tests. |
| `components/ui/TopBar.tsx` | **MODIFY** | Becomes `async`; mounts `<UserMenu session={…}/>` when authenticated. |
| `tests/unit/components/ui/TopBar.test.tsx` | **MODIFY** | Covers authenticated + anonymous branches. |
| `tests/integration/ui/lobby-logout.spec.ts` | **NEW** | Two-user Playwright swap, lobby-route only. |

---

## Task 1: Export `SESSION_COOKIE_NAME`

**Files:**
- Modify: `lib/matchmaking/profile.ts:28`

- [ ] **Step 1: Export the constant**

Edit line 28 from:
```ts
const SESSION_COOKIE_NAME = "wottle-playtest-session";
```
To:
```ts
export const SESSION_COOKIE_NAME = "wottle-playtest-session";
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/matchmaking/profile.ts
git commit -m "refactor(auth): export SESSION_COOKIE_NAME

Exposes the cookie name for the upcoming logoutAction so the
literal isn't duplicated across files."
```

---

## Task 2: `logoutAction` — no-session early return (Red)

**Files:**
- Create: `app/actions/auth/logout.ts`
- Create: `tests/unit/app/actions/auth/logout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app/actions/auth/logout.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
  SESSION_COOKIE_NAME: "wottle-playtest-session",
}));
vi.mock("@/lib/matchmaking/service", () => ({
  expireLobbyPresence: vi.fn().mockResolvedValue(undefined),
  findActiveMatchForPlayer: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/matchmaking/presenceCache", () => ({
  forgetPresence: vi.fn(),
}));
vi.mock("@/lib/rate-limiting/middleware", () => ({
  assertWithinRateLimit: vi.fn(),
}));
vi.mock("@/app/actions/match/resignMatch", () => ({
  resignMatch: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const deleteCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ delete: deleteCookie }),
}));

import { logoutAction } from "@/app/actions/auth/logout";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { expireLobbyPresence } from "@/lib/matchmaking/service";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { resignMatch } from "@/app/actions/match/resignMatch";

describe("logoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns signed-out and skips DB + cookie work when no session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    const result = await logoutAction();

    expect(result).toEqual({ status: "signed-out", resignedMatchId: null });
    expect(assertWithinRateLimit).not.toHaveBeenCalled();
    expect(expireLobbyPresence).not.toHaveBeenCalled();
    expect(resignMatch).not.toHaveBeenCalled();
    expect(deleteCookie).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:unit -- tests/unit/app/actions/auth/logout.test.ts
```
Expected: FAIL — "Cannot find module '@/app/actions/auth/logout'".

- [ ] **Step 3: Write the minimal implementation**

Create `app/actions/auth/logout.ts`:

```ts
"use server";

import "server-only";

import { readLobbySession } from "@/lib/matchmaking/profile";

export interface LogoutInput {
  resignActiveMatch?: boolean;
}

export interface LogoutResult {
  status: "signed-out";
  resignedMatchId: string | null;
}

export async function logoutAction(
  _input: LogoutInput = {},
): Promise<LogoutResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "signed-out", resignedMatchId: null };
  }
  // Rest of implementation lands in later tasks.
  return { status: "signed-out", resignedMatchId: null };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test:unit -- tests/unit/app/actions/auth/logout.test.ts
```
Expected: PASS (1/1).

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth/logout.ts tests/unit/app/actions/auth/logout.test.ts
git commit -m "feat(auth): scaffold logoutAction with no-session early return

First slice of the lobby logout feature. When there is no session
cookie we short-circuit without touching the DB, cookies, or the
rate limiter."
```

---

## Task 3: `logoutAction` — presence teardown + cookie delete

**Files:**
- Modify: `app/actions/auth/logout.ts`
- Modify: `tests/unit/app/actions/auth/logout.test.ts`

- [ ] **Step 1: Add the failing test case**

Append to `logoutAction` describe block:

```ts
it("clears presence row, presence cache, and session cookie for an active session", async () => {
  vi.mocked(readLobbySession).mockResolvedValue({
    token: "t",
    issuedAt: 0,
    player: { id: "player-1", username: "ari", displayName: "Ari", status: "available", lastSeenAt: "" },
  } as any);

  const result = await logoutAction();

  expect(result).toEqual({ status: "signed-out", resignedMatchId: null });
  expect(expireLobbyPresence).toHaveBeenCalledWith(expect.anything(), "player-1");
  expect(deleteCookie).toHaveBeenCalledWith("wottle-playtest-session");
});
```

- [ ] **Step 2: Run tests to confirm the new case fails**

```bash
pnpm test:unit -- tests/unit/app/actions/auth/logout.test.ts
```
Expected: FAIL — `expireLobbyPresence` was not called.

- [ ] **Step 3: Implement the teardown**

Replace the body of `logoutAction` in `app/actions/auth/logout.ts`:

```ts
"use server";

import "server-only";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { readLobbySession, SESSION_COOKIE_NAME } from "@/lib/matchmaking/profile";
import { expireLobbyPresence } from "@/lib/matchmaking/service";
import { forgetPresence } from "@/lib/matchmaking/presenceCache";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface LogoutInput {
  resignActiveMatch?: boolean;
}

export interface LogoutResult {
  status: "signed-out";
  resignedMatchId: string | null;
}

export async function logoutAction(
  _input: LogoutInput = {},
): Promise<LogoutResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "signed-out", resignedMatchId: null };
  }

  const playerId = session.player.id;
  const supabase = getServiceRoleClient();

  await expireLobbyPresence(supabase, playerId);
  forgetPresence(playerId);

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  revalidatePath("/", "layout");
  return { status: "signed-out", resignedMatchId: null };
}
```

- [ ] **Step 4: Run tests to confirm both pass**

```bash
pnpm test:unit -- tests/unit/app/actions/auth/logout.test.ts
```
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth/logout.ts tests/unit/app/actions/auth/logout.test.ts
git commit -m "feat(auth): tear down presence and clear cookie on logout

Wires the presence row deletion, presence cache eviction, and
session cookie deletion. revalidatePath('/') so the layout re-renders
and the lobby page falls through to the login form."
```

---

## Task 4: `logoutAction` — optional resign branch

**Files:**
- Modify: `app/actions/auth/logout.ts`
- Modify: `tests/unit/app/actions/auth/logout.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to the describe block:

```ts
it("does not resign when the opt-in flag is absent", async () => {
  vi.mocked(readLobbySession).mockResolvedValue({
    token: "t", issuedAt: 0,
    player: { id: "player-1", username: "ari", displayName: "Ari", status: "in_match", lastSeenAt: "" },
  } as any);

  await logoutAction();

  expect(resignMatch).not.toHaveBeenCalled();
});

it("resigns the active match when opted in and a match is live", async () => {
  const { findActiveMatchForPlayer } = await import("@/lib/matchmaking/service");
  vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce("match-42");
  vi.mocked(readLobbySession).mockResolvedValue({
    token: "t", issuedAt: 0,
    player: { id: "player-1", username: "ari", displayName: "Ari", status: "in_match", lastSeenAt: "" },
  } as any);

  const result = await logoutAction({ resignActiveMatch: true });

  expect(resignMatch).toHaveBeenCalledWith("match-42");
  expect(result.resignedMatchId).toBe("match-42");
});

it("continues with teardown when resignMatch throws", async () => {
  const { findActiveMatchForPlayer } = await import("@/lib/matchmaking/service");
  vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce("match-42");
  vi.mocked(resignMatch).mockRejectedValueOnce(new Error("match ended"));
  vi.mocked(readLobbySession).mockResolvedValue({
    token: "t", issuedAt: 0,
    player: { id: "player-1", username: "ari", displayName: "Ari", status: "in_match", lastSeenAt: "" },
  } as any);

  const result = await logoutAction({ resignActiveMatch: true });

  expect(deleteCookie).toHaveBeenCalled();
  expect(result.resignedMatchId).toBeNull();
});

it("skips resign when no active match is found", async () => {
  const { findActiveMatchForPlayer } = await import("@/lib/matchmaking/service");
  vi.mocked(findActiveMatchForPlayer).mockResolvedValueOnce(null);
  vi.mocked(readLobbySession).mockResolvedValue({
    token: "t", issuedAt: 0,
    player: { id: "player-1", username: "ari", displayName: "Ari", status: "available", lastSeenAt: "" },
  } as any);

  const result = await logoutAction({ resignActiveMatch: true });

  expect(resignMatch).not.toHaveBeenCalled();
  expect(result.resignedMatchId).toBeNull();
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test:unit -- tests/unit/app/actions/auth/logout.test.ts
```
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement the resign branch**

Update `app/actions/auth/logout.ts` to import + use `findActiveMatchForPlayer` + `resignMatch`:

```ts
"use server";

import "server-only";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { resignMatch } from "@/app/actions/match/resignMatch";
import { readLobbySession, SESSION_COOKIE_NAME } from "@/lib/matchmaking/profile";
import {
  expireLobbyPresence,
  findActiveMatchForPlayer,
} from "@/lib/matchmaking/service";
import { forgetPresence } from "@/lib/matchmaking/presenceCache";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface LogoutInput {
  resignActiveMatch?: boolean;
}

export interface LogoutResult {
  status: "signed-out";
  resignedMatchId: string | null;
}

export async function logoutAction(
  input: LogoutInput = {},
): Promise<LogoutResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "signed-out", resignedMatchId: null };
  }

  const playerId = session.player.id;
  const supabase = getServiceRoleClient();

  let resignedMatchId: string | null = null;
  if (input.resignActiveMatch) {
    const activeMatchId = await findActiveMatchForPlayer(supabase, playerId);
    if (activeMatchId) {
      try {
        await resignMatch(activeMatchId);
        resignedMatchId = activeMatchId;
      } catch (error) {
        console.warn("[logoutAction] resignMatch failed, continuing with logout", error);
      }
    }
  }

  await expireLobbyPresence(supabase, playerId);
  forgetPresence(playerId);

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  revalidatePath("/", "layout");
  return { status: "signed-out", resignedMatchId };
}
```

**Note:** check the real signature of `findActiveMatchForPlayer` in `lib/matchmaking/service.ts` first — if it doesn't take a supabase client, drop that argument to match.

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- tests/unit/app/actions/auth/logout.test.ts
```
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth/logout.ts tests/unit/app/actions/auth/logout.test.ts
git commit -m "feat(auth): optionally resign active match during logout

When the caller opts in (only the UI path for in_match players does)
we look up the live match via findActiveMatchForPlayer and invoke the
existing resignMatch action before tearing presence down. A failed
resign is logged and the logout completes anyway — a stuck session is
worse than an un-forfeited match."
```

---

## Task 5: `logoutAction` — rate limit

**Files:**
- Modify: `app/actions/auth/logout.ts`
- Modify: `tests/unit/app/actions/auth/logout.test.ts`

- [ ] **Step 1: Add failing test**

Append:

```ts
it("rate-limits against the auth:logout scope", async () => {
  vi.mocked(readLobbySession).mockResolvedValue({
    token: "t", issuedAt: 0,
    player: { id: "player-1", username: "ari", displayName: "Ari", status: "available", lastSeenAt: "" },
  } as any);

  await logoutAction();

  expect(assertWithinRateLimit).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: "player-1",
      scope: "auth:logout",
      limit: 10,
      windowMs: 60_000,
    }),
  );
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test:unit -- tests/unit/app/actions/auth/logout.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Wire the rate limit**

Add the import + call in `app/actions/auth/logout.ts`, immediately after the session check:

```ts
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";

// …inside logoutAction after `const playerId = session.player.id;`:
assertWithinRateLimit({
  identifier: playerId,
  scope: "auth:logout",
  limit: 10,
  windowMs: 60_000,
  errorMessage: "Too many sign-out attempts. Please wait.",
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- tests/unit/app/actions/auth/logout.test.ts
```
Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth/logout.ts tests/unit/app/actions/auth/logout.test.ts
git commit -m "feat(auth): rate-limit logoutAction at 10/min per player"
```

---

## Task 6: `LogoutConfirmDialog` component

**Files:**
- Create: `components/ui/LogoutConfirmDialog.tsx`
- Create: `tests/unit/components/ui/LogoutConfirmDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/ui/LogoutConfirmDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LogoutConfirmDialog } from "@/components/ui/LogoutConfirmDialog";

describe("<LogoutConfirmDialog>", () => {
  it("does not render when closed", () => {
    render(<LogoutConfirmDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText("Sign out now?")).not.toBeInTheDocument();
  });

  it("renders title, body, and both actions when open", () => {
    render(<LogoutConfirmDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Sign out now?")).toBeInTheDocument();
    expect(
      screen.getByText(/forfeit your current match/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stay signed in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out & forfeit/i })).toBeInTheDocument();
  });

  it("fires onCancel and onConfirm when the matching buttons are clicked", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<LogoutConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /sign out & forfeit/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables the destructive button while pending", () => {
    render(
      <LogoutConfirmDialog open pending onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    const confirm = screen.getByRole("button", { name: /signing out/i });
    expect(confirm).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pnpm test:unit -- tests/unit/components/ui/LogoutConfirmDialog.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `components/ui/LogoutConfirmDialog.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export interface LogoutConfirmDialogProps {
  open: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({
  open,
  pending = false,
  onCancel,
  onConfirm,
}: LogoutConfirmDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      labelledBy="logout-confirm-title"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2
          id="logout-confirm-title"
          className="font-display text-[22px] italic leading-tight text-ink"
        >
          Sign out now?
        </h2>
        <p className="text-[14px] leading-[1.5] text-ink-3">
          You&rsquo;ll forfeit your current match. Your opponent will be
          awarded the win.
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Stay signed in
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Signing out…" : "Sign out & forfeit"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

**Before running tests**, open `components/ui/Dialog.tsx` to confirm the prop names are exactly `open`, `onClose`, and `labelledBy`. If they differ (e.g., `isOpen`, `onDismiss`, `aria-labelledby`), adjust the wrapper and the test's rendered markup to match.

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/LogoutConfirmDialog.test.tsx
```
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add components/ui/LogoutConfirmDialog.tsx tests/unit/components/ui/LogoutConfirmDialog.test.tsx
git commit -m "feat(ui): add LogoutConfirmDialog

Destructive-styled wrapper over the shared Dialog primitive shown
only when signing out mid-match."
```

---

## Task 7: `UserMenu` — chip renders

**Files:**
- Create: `components/ui/UserMenu.tsx`
- Create: `tests/unit/components/ui/UserMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/ui/UserMenu.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/lobby",
}));
vi.mock("@/app/actions/auth/logout", () => ({
  logoutAction: vi.fn().mockResolvedValue({ status: "signed-out", resignedMatchId: null }),
}));
vi.mock("@/lib/matchmaking/presenceStore", () => ({
  useLobbyPresenceStore: { getState: () => ({ disconnect: vi.fn() }) },
}));

import { UserMenu } from "@/components/ui/UserMenu";

const session = {
  token: "t",
  issuedAt: 0,
  player: {
    id: "player-1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available" as const,
    lastSeenAt: "",
    eloRating: null,
  },
};

describe("<UserMenu>", () => {
  it("renders the chip as an expandable button with the displayName", () => {
    render(<UserMenu session={session} />);
    const chip = screen.getByRole("button", { name: /ari/i });
    expect(chip).toHaveAttribute("aria-haspopup", "menu");
    expect(chip).toHaveAttribute("aria-expanded", "false");
  });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm test:unit -- tests/unit/components/ui/UserMenu.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the chip**

Create `components/ui/UserMenu.tsx`:

```tsx
"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import type { LobbySession } from "@/lib/matchmaking/profile";

export interface UserMenuProps {
  session: LobbySession;
}

export function UserMenu({ session }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const { player } = session;

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-1.5 py-1 text-[13px] text-ink-3 hover:text-ink sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1"
      >
        <Avatar
          playerId={player.id}
          displayName={player.displayName}
          avatarUrl={player.avatarUrl ?? undefined}
          size="sm"
        />
        <span className="hidden sm:inline">{player.displayName}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 text-ink-soft" />
      </button>
    </div>
  );
}
```

**Before running tests**, verify `Avatar` accepts exactly those props (`playerId`, `displayName`, `avatarUrl`, `size`). Adjust if it uses `name`, `imageUrl`, etc.

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/UserMenu.test.tsx
```
Expected: PASS (1/1).

- [ ] **Step 5: Commit**

```bash
git add components/ui/UserMenu.tsx tests/unit/components/ui/UserMenu.test.tsx
git commit -m "feat(ui): scaffold UserMenu chip

Renders the avatar + displayName + caret as a single expandable
button. Dropdown behaviour lands in the next task."
```

---

## Task 8: `UserMenu` — open dropdown, Esc to close, focus management

**Files:**
- Modify: `components/ui/UserMenu.tsx`
- Modify: `tests/unit/components/ui/UserMenu.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `tests/unit/components/ui/UserMenu.test.tsx`:

```tsx
import { fireEvent } from "@testing-library/react";

it("opens the menu on chip click and sets aria-expanded", async () => {
  render(<UserMenu session={session} />);
  const chip = screen.getByRole("button", { name: /ari/i });
  fireEvent.click(chip);
  expect(chip).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("menu")).toBeInTheDocument();
  expect(screen.getByText("Signed in as Ari")).toBeInTheDocument();
});

it("closes the menu on Escape", () => {
  render(<UserMenu session={session} />);
  const chip = screen.getByRole("button", { name: /ari/i });
  fireEvent.click(chip);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(chip).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/UserMenu.test.tsx
```
Expected: FAIL on the two new cases.

- [ ] **Step 3: Implement the dropdown**

Replace `UserMenu.tsx` body:

```tsx
"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import type { LobbySession } from "@/lib/matchmaking/profile";

export interface UserMenuProps {
  session: LobbySession;
}

export function UserMenu({ session }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { player } = session;

  const close = useCallback(() => {
    setOpen(false);
    chipRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const onClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        chipRef.current &&
        !chipRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open, close]);

  return (
    <div className="relative">
      <button
        ref={chipRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-1.5 py-1 text-[13px] text-ink-3 hover:text-ink sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1"
      >
        <Avatar
          playerId={player.id}
          displayName={player.displayName}
          avatarUrl={player.avatarUrl ?? undefined}
          size="sm"
        />
        <span className="hidden sm:inline">{player.displayName}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 text-ink-soft" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-[220px] overflow-hidden rounded-md border border-hair bg-paper/95 shadow-lg backdrop-blur-md"
        >
          <div className="px-3 pt-3 pb-2 font-display text-[14px] italic leading-tight text-ink-soft">
            Signed in as {player.displayName}
          </div>
          <div className="border-t border-hair" aria-hidden />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              /* wired in next task */
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[color:var(--player-b,#c54) ] hover:bg-[color:var(--player-b-soft,rgba(197,68,68,0.08))] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus"
          >
            <LogOut aria-hidden className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/UserMenu.test.tsx
```
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add components/ui/UserMenu.tsx tests/unit/components/ui/UserMenu.test.tsx
git commit -m "feat(ui): open/close dropdown for UserMenu

Click toggles, Esc closes and returns focus to the chip, outside
click closes. Menu shows 'Signed in as {name}' caption and a
destructive 'Sign out' item (still inert — wired next)."
```

---

## Task 9: `UserMenu` — logout wiring for non-match players

**Files:**
- Modify: `components/ui/UserMenu.tsx`
- Modify: `tests/unit/components/ui/UserMenu.test.tsx`

- [ ] **Step 1: Add failing test**

Append:

```tsx
import { waitFor } from "@testing-library/react";

import { logoutAction } from "@/app/actions/auth/logout";

it("calls logoutAction without the resign flag for an available user", async () => {
  render(<UserMenu session={session} />);
  fireEvent.click(screen.getByRole("button", { name: /ari/i }));
  fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));

  await waitFor(() => expect(logoutAction).toHaveBeenCalledWith({}));
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/UserMenu.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Wire the happy path**

In `UserMenu.tsx`, add imports and replace the menuitem's `onClick`:

```tsx
import { usePathname, useRouter } from "next/navigation";

import { logoutAction } from "@/app/actions/auth/logout";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
```

Inside the component:

```tsx
const router = useRouter();
const pathname = usePathname();
const [pending, setPending] = useState(false);

const performLogout = useCallback(
  async (resignActiveMatch: boolean) => {
    setPending(true);
    try {
      await logoutAction(resignActiveMatch ? { resignActiveMatch: true } : {});
    } catch (error) {
      console.error("[UserMenu] logout failed", error);
    } finally {
      useLobbyPresenceStore.getState().disconnect();
      setPending(false);
      setOpen(false);
      if (pathname.startsWith("/match/")) {
        router.push("/lobby");
      } else {
        router.refresh();
      }
    }
  },
  [pathname, router],
);
```

Replace the menuitem onClick:

```tsx
onClick={() => void performLogout(false)}
disabled={pending}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/UserMenu.test.tsx
```
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add components/ui/UserMenu.tsx tests/unit/components/ui/UserMenu.test.tsx
git commit -m "feat(ui): wire logoutAction for non-match players

Available / matchmaking players go straight to logout. After the
server action returns we tear down the local presenceStore (stops
heartbeat + realtime) and router.refresh() so the lobby re-renders.
From a /match/[id] route we push('/lobby')."
```

---

## Task 10: `UserMenu` — in-match path with confirmation dialog

**Files:**
- Modify: `components/ui/UserMenu.tsx`
- Modify: `tests/unit/components/ui/UserMenu.test.tsx`

- [ ] **Step 1: Add failing tests**

Append:

```tsx
it("opens the confirm dialog for an in_match player and defers the server call", () => {
  const inMatchSession = {
    ...session,
    player: { ...session.player, status: "in_match" as const },
  };
  render(<UserMenu session={inMatchSession} />);
  fireEvent.click(screen.getByRole("button", { name: /ari/i }));
  fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));

  expect(screen.getByText("Sign out now?")).toBeInTheDocument();
  expect(logoutAction).not.toHaveBeenCalled();
});

it("calls logoutAction with resignActiveMatch=true after confirming", async () => {
  const inMatchSession = {
    ...session,
    player: { ...session.player, status: "in_match" as const },
  };
  render(<UserMenu session={inMatchSession} />);
  fireEvent.click(screen.getByRole("button", { name: /ari/i }));
  fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
  fireEvent.click(screen.getByRole("button", { name: /sign out & forfeit/i }));

  await waitFor(() =>
    expect(logoutAction).toHaveBeenCalledWith({ resignActiveMatch: true }),
  );
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/UserMenu.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement the confirm branch**

Replace the menuitem onClick in `UserMenu.tsx` to branch on status, and render the dialog:

```tsx
import { LogoutConfirmDialog } from "@/components/ui/LogoutConfirmDialog";
```

Add state:

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
```

Replace the menuitem onClick:

```tsx
onClick={() => {
  if (player.status === "in_match") {
    setConfirmOpen(true);
  } else {
    void performLogout(false);
  }
}}
```

Render the dialog (outside the dropdown conditional, so it persists after the menu closes):

```tsx
<LogoutConfirmDialog
  open={confirmOpen}
  pending={pending}
  onCancel={() => setConfirmOpen(false)}
  onConfirm={async () => {
    await performLogout(true);
    setConfirmOpen(false);
  }}
/>
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/UserMenu.test.tsx
```
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add components/ui/UserMenu.tsx tests/unit/components/ui/UserMenu.test.tsx
git commit -m "feat(ui): gate in_match logout behind a confirm dialog

Players whose server-side status is in_match see the
LogoutConfirmDialog before the action runs. Confirming calls
logoutAction with resignActiveMatch=true so the back end forfeits
the match before teardown."
```

---

## Task 11: Mount `UserMenu` from `TopBar`

**Files:**
- Modify: `components/ui/TopBar.tsx`
- Modify: `tests/unit/components/ui/TopBar.test.tsx`

- [ ] **Step 1: Write the failing test first**

Open `tests/unit/components/ui/TopBar.test.tsx` and add cases (keep the existing rendering tests). The TopBar is now async, so the tests need to `await` it. Add:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/matchmaking/profile", async () => ({
  readLobbySession: vi.fn(),
}));

import { TopBar } from "@/components/ui/TopBar";
import { readLobbySession } from "@/lib/matchmaking/profile";

describe("<TopBar> authenticated state", () => {
  it("renders the UserMenu chip when a session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue({
      token: "t",
      issuedAt: 0,
      player: {
        id: "player-1",
        username: "ari",
        displayName: "Ari",
        avatarUrl: null,
        status: "available",
        lastSeenAt: "",
        eloRating: null,
      },
    } as any);

    render(await TopBar());
    expect(screen.getByRole("button", { name: /ari/i })).toBeInTheDocument();
  });

  it("does not render the UserMenu when no session exists", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
    render(await TopBar());
    expect(screen.queryByRole("button", { name: /sign out|ari/i })).not.toBeInTheDocument();
  });
});
```

If the existing TopBar test file already runs `<TopBar />` synchronously, either adapt those cases to `await TopBar()` or keep them and add the new describe block beside them — whichever matches the existing style.

- [ ] **Step 2: Run tests**

```bash
pnpm test:unit -- tests/unit/components/ui/TopBar.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Make `TopBar` async and mount `UserMenu`**

Replace `components/ui/TopBar.tsx`:

```tsx
import Link from "next/link";

import { UserMenu } from "@/components/ui/UserMenu";
import { readLobbySession } from "@/lib/matchmaking/profile";

export async function TopBar() {
  const session = await readLobbySession();

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-20 flex items-center justify-between border-b border-hair bg-paper/85 px-7 py-3.5 backdrop-blur-md"
    >
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[22px] italic leading-none tracking-tight text-ink">
          Wottle
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          word · battle
        </span>
      </div>
      <nav className="flex items-center gap-2 text-[13px] text-ink-3 sm:gap-5">
        <Link
          href="/lobby"
          className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-ink sm:min-h-0 sm:min-w-0 sm:px-0"
        >
          Lobby
        </Link>
        <Link
          href="/profile"
          className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-ink sm:min-h-0 sm:min-w-0 sm:px-0"
        >
          Profile
        </Link>
        {session ? (
          <>
            <span className="hidden h-5 w-px bg-hair sm:inline-block" aria-hidden />
            <UserMenu session={session} />
          </>
        ) : null}
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Verify `app/layout.tsx` renders the async component correctly**

Next.js App Router supports async server components as children — no change required at the layout call site. Still, run the whole unit + integration path:

```bash
pnpm typecheck
pnpm test:unit -- tests/unit/components/ui/TopBar.test.tsx
pnpm test:unit
```
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add components/ui/TopBar.tsx tests/unit/components/ui/TopBar.test.tsx
git commit -m "feat(ui): mount UserMenu from TopBar when authenticated

TopBar becomes an async server component, reads readLobbySession(),
and renders the UserMenu chip next to the nav links. Unauthenticated
routes (landing / login) render the TopBar unchanged."
```

---

## Task 12: Playwright integration spec — single-browser user swap

**Files:**
- Create: `tests/integration/ui/lobby-logout.spec.ts`

- [ ] **Step 1: Look at an existing two-user spec for helpers**

Read `tests/integration/ui/hud-classic.spec.ts` (or any file in `tests/integration/ui/`) to copy the login pattern, selector conventions, and per-spec timeouts used in CI.

- [ ] **Step 2: Write the spec**

Create `tests/integration/ui/lobby-logout.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("lobby logout lets the same browser log in as a different user", async ({ page }) => {
  // Log in as user A
  await page.goto("/lobby");
  await page.getByLabel(/username/i).fill("playtest-a");
  await page.getByRole("button", { name: /enter lobby/i }).click();
  await expect(page.getByRole("button", { name: /playtest-a/i })).toBeVisible();

  // Open UserMenu and sign out
  await page.getByRole("button", { name: /playtest-a/i }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();

  // The login form should re-appear
  await expect(page.getByLabel(/username/i)).toBeVisible();

  // Log in as user B and verify the chip reflects the new identity
  await page.getByLabel(/username/i).fill("playtest-b");
  await page.getByRole("button", { name: /enter lobby/i }).click();
  await expect(page.getByRole("button", { name: /playtest-b/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /playtest-a/i })).not.toBeVisible();
});
```

**Before running:** confirm the exact label text on the login form input and the submit-button copy — `tests/integration/ui/*.spec.ts` files will reveal it. Adjust the selectors if they differ.

- [ ] **Step 3: Run the spec**

```bash
pnpm exec playwright test tests/integration/ui/lobby-logout.spec.ts --reporter=list
```
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ui/lobby-logout.spec.ts
git commit -m "test(lobby): playwright spec for single-browser user swap"
```

---

## Task 13: Full verification pass

- [ ] **Step 1: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2: Lint (zero-warnings policy)**

```bash
pnpm lint
```

- [ ] **Step 3: Unit suite**

```bash
pnpm test:unit
```

- [ ] **Step 4: Integration suite — lobby-logout + neighbours**

```bash
pnpm exec playwright test tests/integration/ui/lobby-logout.spec.ts
```

- [ ] **Step 5: Manual smoke**

```bash
pnpm dev
# Visit http://localhost:3000/lobby
# Log in as "alpha", confirm UserChip says alpha + connection badge "Live"
# Click chip → menu opens → click "Sign out"
# Login form returns; log in as "beta"; confirm chip says beta
# (in_match path manually tested later against a real match)
```

- [ ] **Step 6: Push & PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat(auth): add lobby logout with optional match forfeit" --body "…"
```

Title + body can be drawn from the spec's **Goals** / **User Flow** sections.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `findActiveMatchForPlayer` signature differs from what Task 4 assumes. | Task 4 Step 3 includes an explicit "verify signature" note. Adjust the `logoutAction` call site to match before running tests. |
| `Dialog` primitive exposes different prop names than Task 6 assumes. | Task 6 Step 3 includes an explicit prop-check note — open `components/ui/Dialog.tsx` first and adjust. |
| `Avatar` props (`playerId`, `avatarUrl`) differ. | Task 7 Step 3 includes an explicit prop-check note. |
| Existing `tests/unit/components/ui/TopBar.test.tsx` renders TopBar synchronously. | Task 11 Step 1 notes: migrate to `await TopBar()` or keep existing describe block and add the new one beside. |
| `lucide-react` not installed. | Confirm with `grep -r "from \"lucide-react\"" components/` — it's already used by `GearMenu`/`SettingsPanel`. If missing, add to deps in a separate commit before Task 7. |
| Mid-match logout Playwright test is too flaky to ship. | Spec explicitly defers that path — unit coverage in Task 10 is sufficient. |

---

## Success criteria

- Signed-in user can sign out from any route in a single or confirmed two-click flow.
- `wottle-playtest-session` cookie is cleared after logout (verify via DevTools → Application → Cookies).
- `lobby_presence` row is gone after logout (verify via `select * from lobby_presence where player_id = '…'` against Supabase).
- A logout mid-match forfeits the match; the opponent sees a forfeit result on the match recap.
- Zero lint warnings, typecheck green, all unit + integration tests passing.
- No change to the visual rhythm of the TopBar for anonymous users.
