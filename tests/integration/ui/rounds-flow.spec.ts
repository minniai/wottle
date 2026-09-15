/**
 * Spec 002 / 044 — a whole match in the room: ten rounds of pick → commit on
 * both fields, the caption advancing each round, then the final room state.
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaBar, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { submitSwap } from "./helpers/swaps";

test.describe("Round flow", () => {
  test("completes 10 rounds with reconnect safety + late swap guards @two-player-playtest", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("flow-alpha");
      const userB = generateTestUsername("flow-beta");
      await loginViaBar(pageA, userA);
      await loginViaBar(pageB, userB);

      const [matchIdA, matchIdB] = await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 120_000, playerBUsername: userB });
      expect(matchIdA).toBeTruthy();
      expect(matchIdA).toEqual(matchIdB);
      for (const p of [pageA, pageB]) await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      for (let round = 1; round <= 10; round += 1) {
        await submitSwap(pageA);
        await submitSwap(pageB);
        // advanceRound runs after the second submit; round 1 pays the word-engine cold start.
        await pageA.waitForTimeout(round === 1 ? 6_000 : 3_000);
        if (round < 10) {
          await expect(pageA.getByTestId("round-indicator")).toContainText(`round ${round + 1} of 10`, { timeout: 45_000 });
        }
      }

      // After round 10 the same room turns final: verdict in the ledger, field kept.
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: 30_000 });
      await expect(pageA.getByTestId("verdict")).toBeVisible();
      await expect(pageA.getByTestId("ledger-caption")).toContainText(/final · 10 rounds · \d+:\d\d/);
      await expect(pageA.getByTestId("field")).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
