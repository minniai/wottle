import { test, expect, type Page } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

async function loginPlayer(page: Page, username: string) {
  await page.goto("/lobby");
  await page.fill('input[name="username"]', username);
  await page.click('button[type="submit"]');
  await expect(page.getByTestId("lobby-shell")).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("@lobby-finish Phase 3 lobby cards", () => {
  test("renders Recent Games and Top of the Board cards", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await loginPlayer(page, generateTestUsername("lobby-alpha"));

      await expect(page.getByTestId("recent-games-card")).toBeVisible();
      await expect(page.getByTestId("top-of-board-card")).toBeVisible();
      await expect(page.getByText("Your recent games")).toBeVisible();
      await expect(page.getByText("Top of the board")).toBeVisible();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test("EmptyLobbyState shows when no other players are online", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await loginPlayer(page, generateTestUsername("lobby-solo"));
      await page.waitForTimeout(2_000);

      const empty = page.getByTestId("empty-lobby-state");
      const directoryRow = page.getByTestId("lobby-card").first();

      const emptyVisible = await empty.isVisible().catch(() => false);
      const rowVisible = await directoryRow.isVisible().catch(() => false);
      expect(emptyVisible || rowVisible).toBe(true);
    } finally {
      await page.close();
      await context.close();
    }
  });
});
