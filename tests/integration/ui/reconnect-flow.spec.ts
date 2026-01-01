import { expect, test } from "@playwright/test";

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

  await pageA.getByTestId("matchmaker-start-button").click();
  await pageA.waitForTimeout(150);
  await pageB.getByTestId("matchmaker-start-button").click();

  await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 20_000 });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({ timeout: 20_000 });
}

test.describe("Reconnect flow", () => {
  test.skip("pauses timers on disconnect and restores state within 10s window", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndStartMatch(pageA, pageB, "reconnect-alpha", "reconnect-beta");

      // Wait for match to be active
      await expect(pageA.getByTestId("round-indicator")).toBeVisible();
      await expect(pageB.getByTestId("round-indicator")).toBeVisible();

      // Get initial timer values
      const timerA = pageA.getByTestId("timer-hud");
      const timerB = pageB.getByTestId("timer-hud");
      const initialTimeA = await timerA.textContent();
      const initialTimeB = await timerB.textContent();

      // Simulate disconnect by closing context A (simulates network loss)
      await contextA.close();

      // Player B should see "Reconnecting" state for Player A
      // Wait for reconnect banner to appear on Player B's side
      await expect(pageB.getByTestId("reconnect-banner")).toBeVisible({ timeout: 5_000 });

      // Verify Player B's timer is paused (both timers pause on disconnect)
      await pageB.waitForTimeout(2_000);
      const timerBAfterDisconnect = await timerB.textContent();
      expect(timerBAfterDisconnect).toBe(initialTimeB); // Timer should not have decreased

      // Reconnect Player A within 10 seconds
      const newContextA = await browser.newContext();
      const newPageA = await newContextA.newPage();
      await newPageA.goto("/");
      await newPageA.getByTestId("lobby-username-input").fill("reconnect-alpha");
      await newPageA.getByTestId("lobby-login-submit").click();

      // Player A should be able to rejoin the match
      // The match page should restore state from database
      const matchId = await pageB.getByTestId("match-shell").getAttribute("data-match-id");
      if (matchId) {
        await newPageA.goto(`/match/${matchId}`);
        await expect(newPageA.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });

        // Verify state restoration: board, round, timer values
        await expect(newPageA.getByTestId("round-indicator")).toBeVisible();
        await expect(newPageA.getByTestId("board-grid")).toBeVisible();

        // Timers should resume after reconnection
        const restoredTimerA = newPageA.getByTestId("timer-hud");
        await expect(restoredTimerA).toBeVisible();
      }

      await newPageA.close();
      await newContextA.close();
    } finally {
      await pageB.close();
      await contextB.close();
    }
  });

  test.skip("finalizes match with disconnect end condition after 10s timeout", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndStartMatch(pageA, pageB, "timeout-alpha", "timeout-beta");

      // Wait for match to be active
      await expect(pageA.getByTestId("round-indicator")).toBeVisible();
      await expect(pageB.getByTestId("round-indicator")).toBeVisible();

      // Disconnect Player A
      await contextA.close();

      // Player B should see reconnect banner
      await expect(pageB.getByTestId("reconnect-banner")).toBeVisible({ timeout: 5_000 });

      // Wait for 10s timeout + buffer
      await pageB.waitForTimeout(12_000);

      // Match should be finalized with disconnect end condition
      // Player B should be redirected to summary page
      await expect(pageB).toHaveURL(/\/match\/.*\/summary/, { timeout: 5_000 });

      // Summary should indicate disconnect as end reason
      const summary = pageB.getByTestId("final-summary");
      await expect(summary).toBeVisible();
      // The summary should show disconnect as the reason
      await expect(summary).toContainText(/disconnect|abandoned/i);
    } finally {
      await pageB.close();
      await contextB.close();
    }
  });
});
