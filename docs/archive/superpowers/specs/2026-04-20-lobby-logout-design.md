# Lobby Logout — Design

**Author:** session-scoped draft, 2026-04-20
**Status:** Approved (design-level); implementation to follow.

## Context

During playtest sessions, multiple users share a single browser — one user finishes a match and another needs to log in. Today there is no way to sign out of the app. The `wottle-playtest-session` cookie persists for 4 hours and the `lobby_presence` row for the logged-in user stays attached to their client. The user must either clear cookies manually or wait 4 hours for the cookie to expire. This spec adds a first-class logout control to the global `TopBar` so a playtest facilitator can swap accounts in a single click (or two clicks, with confirmation, if the signed-in user is mid-match).

## Goals

- Signed-in user can sign out from any route (lobby, match, profile, landing).
- Signing out clears the session cookie, tears down presence, and returns the user to the login form.
- Logging out while in an active match forfeits the match via the existing resign path — never leaves an orphan `matches.state != "completed"` row attached to the departing user.
- UI matches the Warm Editorial aesthetic (OKLCH paper/ink, Fraunces display, Inter body, ochre/player-b semantic accents) and uses only existing primitives (`Avatar`, `Dialog`, `Button`, the `SettingsPanel`-style dropdown pattern).

## Non-Goals

- Single-sign-on, multi-account switching, or "remember last N users" — out of scope.
- Session-expiry auto-redirect on 401s from the server — out of scope; today's lobby page already renders the login form when `readLobbySession()` returns null.
- Logout from a separate device / revoking other sessions — not a concept in this app (cookie-only, no refresh tokens).

## User Flow

```
[User on lobby, status=available]
  └── TopBar ▸ UserChip (Avatar + displayName + caret) ▸ click
       └── UserMenu opens ▸ click "Sign out"
            └── logoutAction() ▸ presence row deleted ▸ cookie cleared ▸ revalidate
                 └── Lobby re-renders, session null ▸ login form shown.

[User on match route, status=in_match]
  └── UserChip ▸ click ▸ UserMenu ▸ "Sign out"
       └── LogoutConfirmDialog ("Sign out & forfeit" / "Stay signed in")
            └── confirm ▸ logoutAction({ resignActiveMatch: true })
                 ├── findActiveMatchId(playerId)
                 ├── resignMatch(matchId)  // opponent wins, both status=available
                 ├── expireLobbyPresence + cookie clear
                 └── redirect("/lobby") ▸ login form shown.
```

## Architecture

### New files

| File | Type | Role |
|---|---|---|
| `app/actions/auth/logout.ts` | Server Action | `logoutAction(input?: { resignActiveMatch?: boolean })`. Authoritative teardown path. |
| `components/ui/UserMenu.tsx` | Client Component | The chip (Avatar + displayName + ChevronDown) and its dropdown. Owns dropdown + dialog state. |
| `components/ui/LogoutConfirmDialog.tsx` | Client Component | Destructive-styled wrapper around the existing `Dialog`, shown only when logging out mid-match. |

### Modified files

| File | Change |
|---|---|
| `components/ui/TopBar.tsx` | Becomes `async` server component. Reads `readLobbySession()` and mounts `<UserMenu session={session}/>` when authenticated. Unauthenticated rendering is unchanged. |
| `lib/matchmaking/profile.ts` | Export `SESSION_COOKIE_NAME` so `logoutAction` doesn't duplicate the literal. |
| `lib/rate-limiting/middleware.ts` *(scope list)* | Add `auth:logout` scope (10/min, configurable). |

### Reused

- `app/actions/match/resignMatch.ts` — called inline by `logoutAction` when the opt-in flag is set and the player has an active match.
- `lib/matchmaking/service.ts#expireLobbyPresence`, `forgetPresence` — same teardown path as `DELETE /api/lobby/presence`.
- `lib/matchmaking/presenceStore.ts#disconnect` — called client-side after the action resolves to stop the heartbeat + realtime channel.
- `components/ui/{Avatar,Dialog,Button}` — no changes.
- `lib/a11y/useFocusTrap.ts`, `lib/a11y/rovingFocus.ts` — for the menu keyboard behaviour.

## Server Action — logoutAction

```ts
"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { readLobbySession, SESSION_COOKIE_NAME } from "@/lib/matchmaking/profile";
import { expireLobbyPresence, forgetPresence } from "@/lib/matchmaking/service";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { resignMatch } from "@/app/actions/match/resignMatch";

export interface LogoutInput { resignActiveMatch?: boolean }
export interface LogoutResult { status: "signed-out"; resignedMatchId: string | null }

export async function logoutAction(input: LogoutInput = {}): Promise<LogoutResult> {
  const session = await readLobbySession();
  if (!session) return { status: "signed-out", resignedMatchId: null };

  const playerId = session.player.id;

  assertWithinRateLimit({
    identifier: playerId,
    scope: "auth:logout",
    limit: 10,
    windowMs: 60_000,
    errorMessage: "Too many sign-out attempts. Please wait.",
  });

  let resignedMatchId: string | null = null;
  if (input.resignActiveMatch) {
    const activeMatchId = await findActiveMatchId(playerId);
    if (activeMatchId) {
      try {
        await resignMatch(activeMatchId);
        resignedMatchId = activeMatchId;
      } catch (error) {
        console.warn("[logoutAction] resignMatch failed, continuing with logout", error);
      }
    }
  }

  const supabase = getServiceRoleClient();
  await expireLobbyPresence(supabase, playerId);
  forgetPresence(playerId);

  (await cookies()).delete(SESSION_COOKIE_NAME);

  revalidatePath("/", "layout");
  return { status: "signed-out", resignedMatchId };
}
```

`findActiveMatchId(playerId)` is a small private helper in the same file: selects `id` from `matches` where `state != 'completed'` and the player is a participant, returns the first row or `null`.

## Client — UserMenu

- Renders a `<button>` (the chip) and, while open, a `<div role="menu">` portal.
- Props: `session: LobbySession` — carrying `player.id`, `player.displayName`, `player.avatarUrl`, `player.status`.
- Mobile: displayName hidden behind `sm:inline`; chip stays tappable at 44×44.
- Dropdown positioned via `getBoundingClientRect()` (same pattern as `GearMenu` → `SettingsPanel`).
- Contents, top → bottom: Fraunces-italic `Signed in as {displayName}` caption; hair divider; `Sign out` menu item in `text-[oklch(var(--player-b))]` with a `lucide-react` LogOut icon.
- On click of "Sign out":
  - If `session.player.status !== "in_match"` → call `logoutAction()` directly, then client-side cleanup (see below).
  - Else → open `LogoutConfirmDialog`. On confirm → call `logoutAction({ resignActiveMatch: true })`.
- After the action resolves:
  ```ts
  useLobbyPresenceStore.getState().disconnect(); // stops heartbeat + realtime + tears down the reconnect loop
  router.refresh();
  if (pathname.startsWith("/match/")) router.push("/lobby");
  ```
- Keyboard: `Esc` closes the menu; `Tab` trap via `useFocusTrap`; focus returns to the chip on close.
- ARIA: chip has `aria-haspopup="menu"` + `aria-expanded`; menu item has `role="menuitem"`.

## Client — LogoutConfirmDialog

- Thin wrapper around `Dialog`. Not a new primitive.
- Title: `Sign out now?` (Fraunces 22px italic).
- Body: `You'll forfeit your current match. Your opponent will be awarded the win.` (Inter 14px, `text-ink-3`).
- Footer: `Stay signed in` (`<Button variant="ghost">`) + `Sign out & forfeit` (`<Button variant="danger">`).
- Behaviour: ESC + outside-click close; while the server action is in flight the `Sign out & forfeit` button shows a `Signing out…` disabled state.

## Error handling

- `logoutAction` wraps `resignMatch` in `try/catch`; a failed resign is logged and logout still proceeds. The cookie + presence teardown is non-negotiable — better to leave a forfeited-but-not-resigned match than a stuck session.
- Client wraps the action call in `try/catch`; on unexpected error it still runs `presenceStore.disconnect()`, still calls `router.refresh()`, and surfaces a toast ("Signed out locally. Server cleanup may be incomplete."). Next page load with a server-cleared cookie heals the UI; if the server action succeeded but the client crashed, the cookie is gone anyway.
- Rate limit violation surfaces a toast ("Too many sign-out attempts. Please wait.") with no state change.

## Tests (TDD — Red → Green per `CLAUDE.md`)

1. **Unit — `tests/unit/app/actions/auth/logout.test.ts`**
   - No session → early-returns `{status: "signed-out", resignedMatchId: null}`; no cookie mutation asserted; no DB writes.
   - Session + `resignActiveMatch=false` → cookie deleted, `expireLobbyPresence` called, `resignMatch` NOT called.
   - Session + `resignActiveMatch=true` + no active match → same as above, `resignMatch` NOT called, `resignedMatchId: null`.
   - Session + `resignActiveMatch=true` + active match → `resignMatch(matchId)` called before presence teardown; `resignedMatchId` returned.
   - `resignMatch` throws → logout still completes; error logged.
   - Rate limit exceeded → `RateLimitExceededError` thrown; cookie NOT deleted.

2. **Unit — `tests/unit/components/ui/UserMenu.test.tsx`**
   - Renders Avatar + displayName + caret; `aria-expanded="false"` initially.
   - Click chip → menu opens, `aria-expanded="true"`, focus on first menuitem.
   - Esc closes menu; focus returns to chip.
   - `player.status !== "in_match"` + click "Sign out" → calls `logoutAction` with default input; no dialog opens.
   - `player.status === "in_match"` + click "Sign out" → opens `LogoutConfirmDialog`; does NOT call `logoutAction` yet.
   - Confirm dialog → calls `logoutAction({ resignActiveMatch: true })`.
   - Cancel dialog → menu re-closes; action not called.

3. **Unit — `tests/unit/components/ui/TopBar.test.tsx`** (extended)
   - Authenticated session prop → `UserMenu` is rendered with the right `displayName`.
   - No session → `UserMenu` not rendered; nav links still present.

4. **Integration — `tests/integration/ui/lobby-logout.spec.ts`** (Playwright, single browser)
   - Log in as "playtest-a" → lobby renders, UserChip shows "playtest-a".
   - Click chip → menu opens. Click "Sign out" → login form returns.
   - Log in as "playtest-b" → lobby renders, UserChip shows "playtest-b".
   - (Mid-match case deferred to a follow-up integration spec to avoid flakiness in serial Playwright runs — unit coverage is sufficient for the resign branch.)

## Accessibility

- Chip: focusable button, focus ring via existing token, 44×44 minimum touch target on narrow viewports.
- Menu: focus-trapped while open, `role="menu"`, items `role="menuitem"`, arrow-key nav via `rovingFocus` helper, `Esc` to close.
- Confirmation dialog: reuses `Dialog`'s existing focus trap, `aria-labelledby` on the title, autofocus on `Stay signed in` (non-destructive default).

## Open questions

None — all decisions made during design review.

## Implementation sequence (for the plan file)

1. Export `SESSION_COOKIE_NAME` from `lib/matchmaking/profile.ts`.
2. Add `auth:logout` rate-limit scope.
3. Write `logoutAction` + its unit tests (red → green → refactor).
4. Add `LogoutConfirmDialog`.
5. Add `UserMenu` + its unit tests.
6. Mount `UserMenu` from `TopBar`; extend existing TopBar tests.
7. Add Playwright integration spec for the two-user swap.
8. Commit atomically per the project's commit-per-test rule.
