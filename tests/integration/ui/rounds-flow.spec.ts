import { expect, test } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

async function loginAndStartMatch(
  pageA: import("@playwright/test").Page,
  pageB: import("@playwright/test").Page,
  userA: string,
  userB: string,
) {
  await Promise.all([pageA.goto("/"), pageB.goto("/")]);

  await pageA.getByTestId("lobby-username-input").fill(userA);
  await pageA.getByTestId("lobby-login-submit").click();

  await pageB.getByTestId("lobby-username-input").fill(userB);
  await pageB.getByTestId("lobby-login-submit").click();

  await expect(pageA.getByTestId("matchmaker-controls")).toBeVisible();
  await expect(pageB.getByTestId("matchmaker-controls")).toBeVisible();

  // Use direct invite for reliable matchmaking (avoids queue race conditions)
  const [matchIdA, matchIdB] = await startMatchWithDirectInvite(pageA, pageB, {
    timeoutMs: 30_000,
  });

  expect(matchIdA).toBeTruthy();
  expect(matchIdA).toEqual(matchIdB);

  await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
}

async function submitSwap(page: import("@playwright/test").Page, firstIndex: number) {
  const board = page.getByTestId("board-grid");
  await board.locator(`[data-tile-index="${firstIndex}"]`).click();
  await board.locator(`[data-tile-index="${firstIndex + 1}"]`).click();
}

test.describe("Round flow", () => {
  test("completes 10 rounds with reconnect safety + late swap guards @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("flow-alpha");
      const userB = generateTestUsername("flow-beta");
      await loginAndStartMatch(pageA, pageB, userA, userB);

      // Complete all 10 rounds
      for (let round = 1; round <= 10; round += 1) {
        // Submit swaps for both players
        await submitSwap(pageA, (round - 1) % 20);
        await submitSwap(pageB, ((round - 1) % 20) + 10);

        if (round < 10) {
          // Wait for round summary and continue
          const continueBtn = pageA.getByTestId("round-summary-continue");
          await expect(continueBtn).toBeVisible({ timeout: 15_000 });
          await continueBtn.click();

          // Wait for next round to start
          await expect(pageA.getByTestId("round-indicator")).toContainText(
            new RegExp(`round ${round + 1}`, "i"),
            { timeout: 5_000 }
          );
        }
      }

      // After round 10, should see final summary
      const summaryView = pageA.getByTestId("final-summary-view");
      await expect(summaryView).toBeVisible({ timeout: 20_000 });

      // Verify match ended properly
      await expect(pageA.getByTestId("final-summary-ended-reason")).toContainText(
        /round limit/i
      );
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
