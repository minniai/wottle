import { expect, test } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

async function loginPlayer(
  page: import("@playwright/test").Page,
  username: string,
) {
  await page.goto("/");
  await page.getByTestId("lobby-username-input").fill(username);

  // Click submit - the Server Action will set a cookie and redirect
  await page.getByTestId("lobby-login-submit").click();
  
  // Wait for the action to complete and cookie to settle
  await page.waitForTimeout(1000);
  
  // Force a reload to ensure the server-rendered page picks up the session
  // This bypasses potential Client Router Cache issues in the test environment
  await page.reload();

  // Wait for lobby list to appear (indicates page re-rendered with session)
  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({
    timeout: 20_000,
  });

  // Then check for matchmaker controls
  await expect(page.getByTestId("matchmaker-controls")).toBeVisible({
    timeout: 10_000,
  });
}

async function loginAndStartMatch(
  pageA: import("@playwright/test").Page,
  pageB: import("@playwright/test").Page,
  userA: string,
  userB: string,
) {
  // Login players sequentially to avoid race conditions
  await loginPlayer(pageA, userA);
  await loginPlayer(pageB, userB);

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
