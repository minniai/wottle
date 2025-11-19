import { expect, test } from "@playwright/test";

async function loginAndStartMatch(
  pageA: import("@playwright/test").Page,
  pageB: import("@playwright/test").Page,
  userA: string,
  userB: string
) {
  // Login both users
  await Promise.all([
    pageA.goto("/"),
    pageB.goto("/"),
  ]);

  await pageA.getByTestId("lobby-username-input").fill(userA);
  await pageA.getByTestId("lobby-login-submit").click();
  await pageB.getByTestId("lobby-username-input").fill(userB);
  await pageB.getByTestId("lobby-login-submit").click();

  // Wait for matchmaker controls
  await expect(pageA.getByTestId("matchmaker-controls")).toBeVisible();
  await expect(pageB.getByTestId("matchmaker-controls")).toBeVisible();

  // Start match via queue
  await Promise.all([
    pageA.getByTestId("matchmaker-start-button").click(),
    pageB.getByTestId("matchmaker-start-button").click(),
  ]);

  // Wait for match shell
  await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 15000 });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({ timeout: 15000 });
}

test.describe("Round flow", () => {
  test("completes 10 rounds with simultaneous submissions", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndStartMatch(pageA, pageB, "round-alpha", "round-beta");

      // Loop through 10 rounds
      for (let round = 1; round <= 10; round++) {
        // Verify round indicator
        await expect(pageA.getByTestId("round-indicator")).toHaveText(`Round ${round}`);
        await expect(pageB.getByTestId("round-indicator")).toHaveText(`Round ${round}`);

        // Verify timers are running (mock check or visual)
        await expect(pageA.getByTestId("timer-display")).toBeVisible();

        // Submit move for Player A
        // Assuming board grid interaction - click two tiles
        // This selector strategy depends on BoardGrid implementation
        const boardA = pageA.getByTestId("board-grid");
        await boardA.locator('[data-tile-index="0"]').click();
        await boardA.locator('[data-tile-index="1"]').click();
        await pageA.getByTestId("submit-move-button").click();

        // Verify Player A is waiting
        await expect(pageA.getByTestId("waiting-overlay")).toBeVisible();
        await expect(pageB.getByTestId("waiting-overlay")).not.toBeVisible();

        // Submit move for Player B
        const boardB = pageB.getByTestId("board-grid");
        await boardB.locator('[data-tile-index="10"]').click();
        await boardB.locator('[data-tile-index="11"]').click();
        await pageB.getByTestId("submit-move-button").click();

        // Verify round transition (waiting overlay disappears)
        await expect(pageA.getByTestId("waiting-overlay")).not.toBeVisible({ timeout: 10000 });
        await expect(pageB.getByTestId("waiting-overlay")).not.toBeVisible({ timeout: 10000 });

        // Verify scoring summary appears (User Story 4 - but needed for flow)
        // For now, just check that we are back to board or next round
        if (round < 10) {
             await expect(pageA.getByTestId("round-indicator")).toHaveText(`Round ${round + 1}`, { timeout: 10000 });
        }
      }

      // Verify match completion
      await expect(pageA.getByTestId("final-summary")).toBeVisible();
      await expect(pageB.getByTestId("final-summary")).toBeVisible();

    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
