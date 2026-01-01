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

test.describe("Round summary panel", () => {
  test("shows scoring deltas, highlights, and aria feedback @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("summary-alpha");
      const userB = generateTestUsername("summary-beta");
      await loginAndStartMatch(pageA, pageB, userA, userB);

      // Submit moves for round 1
      await submitSwap(pageA, 0);
      await submitSwap(pageB, 10);

      // Wait for round summary panel to appear
      const summaryPanel = pageA.getByTestId("round-summary-panel");
      await expect(summaryPanel).toBeVisible({ timeout: 15_000 });

      // Verify summary contains expected elements
      await expect(pageA.getByTestId("round-summary-player-a-delta")).toBeVisible();
      await expect(pageA.getByTestId("round-summary-player-b-delta")).toBeVisible();
      await expect(pageA.getByTestId("round-summary-continue")).toBeVisible();

      // Verify aria attributes for accessibility
      await expect(summaryPanel).toHaveAttribute("role", "dialog");
      await expect(summaryPanel).toHaveAttribute("aria-modal", "true");

      // Continue to next round
      await pageA.getByTestId("round-summary-continue").click();

      // Verify round number incremented
      await expect(pageA.getByTestId("round-indicator")).toContainText(/round 2/i, {
        timeout: 5_000,
      });
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
