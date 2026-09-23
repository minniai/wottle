/**
 * Spec 050 US5, FR-012 — end early. B leaves; the clock keeps running and A
 * plays all ten moves. Nothing covers the field while A is still playing or
 * the reconnection window runs. Once A has ten and B has been gone 90s, the
 * slip `<B> is gone` offers `end the match ▸`, and the match ends under the
 * normal rules: B is short of ten and loses (`incomplete`).
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { submitSwap } from "./helpers/swaps";

test("an absent opponent: after ten moves and the window, end the match early @two-player-playtest", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const userB = generateTestUsername("end-b");
    await loginViaSlip(pageA, generateTestUsername("end-a"));
    await loginViaSlip(pageB, userB);
    const [matchId] = await startMatchWithDirectInvite(pageA, pageB, { playerBUsername: userB, timeoutMs: 60_000 });
    await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
    const response = await pageB.request.post(`/api/match/${matchId}/disconnect`);
    expect(response.ok()).toBe(true);
    await contextB.close();

    // While the window runs, the opponent's bar carries it and the field is clear.
    const topBar = pageA.getByTestId("scoreboard-row-opp");
    await expect(topBar.getByTestId("scoreboard-subline")).toContainText(/reconnecting · \d:\d\d left/, { timeout: 30_000 });
    await expect(topBar.getByTestId("scoreboard-track")).toHaveAttribute("data-mode", "outlined");
    await expect(pageA.getByTestId("slip")).toHaveCount(0);

    for (let n = 1; n <= 10; n += 1) await submitSwap(pageA);
    await expect(pageA.getByTestId("ledger-live-row")).toContainText("10 of 10 played", { timeout: 20_000 });

    const slip = pageA.getByTestId("slip");
    await expect(slip).toHaveAttribute("data-kind", "endEarly", { timeout: 120_000 });
    await expect(slip).toContainText(new RegExp(`${userB} is gone`, "i"));
    await expect(pageA.getByTestId("room-slot-field")).toHaveAttribute("data-slipped", "true");
    await pageA.getByTestId("slip-end-early").click();

    await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: 30_000 });
    await expect(slip).toHaveAttribute("data-kind", "matchOver", { timeout: 20_000 });
    await expect(pageA.getByTestId("verdict")).toContainText(new RegExp(`${userB} played 0 of 10`, "i"));
  } finally {
    await contextA.close();
    await contextB.close().catch(() => undefined);
  }
});
