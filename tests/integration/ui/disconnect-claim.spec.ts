import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";

test("claim slip can be deferred, then ends the match @two-player-playtest", async ({ browser }) => {
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

    const slip = pageA.getByTestId("slip");
    await expect(slip).toHaveAttribute("data-kind", "claimWin", { timeout: 105_000 });
    await expect(slip).toContainText("is gone");
    await pageA.getByTestId("slip-keep-waiting").click();
    await expect(slip).toHaveCount(0);
    await expect(slip).toHaveAttribute("data-kind", "claimWin", { timeout: 15_000 });
    await pageA.getByTestId("slip-claim-win").click();
    await expect(slip).toHaveAttribute("data-kind", "matchOver", { timeout: 20_000 });
    await expect(slip).toContainText("left");
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
