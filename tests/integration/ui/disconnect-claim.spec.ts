/**
 * Spec 048 US7 — a disconnected opponent ends the match on a slip.
 *
 * The claim slip itself is not asserted here. `handlePlayerDisconnect` schedules
 * `finalizeMatchOnDisconnectTimeout` at exactly `RECONNECT_WINDOW_MS`, the same
 * moment the client's countdown reaches zero, so the two race and the server
 * usually wins — which is the better outcome for the player. The claim slip is
 * the fallback for when that server timer never fires (a cold start, a restarted
 * process), and it is pinned by the `claim-win` fixture baseline and by
 * `MatchRoomController.spec.tsx` (offered at zero, deferred by `keep waiting ▸`,
 * cleared on reconnect). What this spec pins is the part that must hold either
 * way: nothing covers the field while the window runs, and the match ends on a
 * match-over slip that names the reason.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";

test("a disconnected opponent ends the match on a slip that names the reason @two-player-playtest", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const userB = generateTestUsername("claim-b");
    await loginViaSlip(pageA, generateTestUsername("claim-a"));
    await loginViaSlip(pageB, userB);
    const [matchId] = await startMatchWithDirectInvite(pageA, pageB, { playerBUsername: userB, timeoutMs: 60_000 });
    const response = await pageB.request.post(`/api/match/${matchId}/disconnect`);
    expect(response.ok()).toBe(true);
    await contextB.close();

    // While the window runs, the opponent's bar carries it and the field is clear.
    const topBar = pageA.getByTestId("player-bar-top");
    await expect(topBar.getByTestId("player-bar-subline")).toContainText(/reconnecting · \d:\d\d left/, { timeout: 30_000 });
    await expect(topBar.getByTestId("player-bar-lane")).toHaveAttribute("data-mode", "disconnected");
    await expect(pageA.getByTestId("slip")).toHaveCount(0);

    // Past the window the match ends, and the result is a slip over the faded field.
    const slip = pageA.getByTestId("slip");
    await expect(slip).toHaveAttribute("data-kind", "matchOver", { timeout: 120_000 });
    await expect(slip).toContainText(new RegExp(`${userB} left`, "i"));
    await expect(pageA.getByTestId("room-slot-field")).toHaveAttribute("data-slipped", "true");
    await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "final");
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
