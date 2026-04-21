import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

async function loginAs(page: Page, username: string) {
  const input = page.getByTestId("lobby-username-input");
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(username);
  await page.getByTestId("lobby-login-submit").click();
  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("@lobby-logout single-browser user swap", () => {
  test("user A can sign out and user B can log in on the same page", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const userA = generateTestUsername("logout-a");
      const userB = generateTestUsername("logout-b");
      const topbar = page.getByTestId("topbar");

      // Log in as user A.
      await page.goto("/");
      await loginAs(page, userA);

      // UserMenu chip (scoped to TopBar) reflects user A.
      const chipA = topbar.getByRole("button", {
        name: new RegExp(userA, "i"),
      });
      await expect(chipA).toBeVisible({ timeout: 10_000 });

      // Open the UserMenu dropdown and sign out.
      await chipA.click();
      const signOutItem = page.getByRole("menuitem", { name: /sign out/i });
      await expect(signOutItem).toBeVisible();
      await signOutItem.click();

      // Login form reappears after logout.
      await expect(page.getByTestId("lobby-username-input")).toBeVisible({
        timeout: 20_000,
      });
      await expect(chipA).toHaveCount(0);

      // Log in as user B in the same browser context.
      await loginAs(page, userB);

      // UserMenu chip now reflects user B; user A's chip is gone from TopBar.
      const chipB = topbar.getByRole("button", {
        name: new RegExp(userB, "i"),
      });
      await expect(chipB).toBeVisible({ timeout: 10_000 });
      await expect(
        topbar.getByRole("button", { name: new RegExp(userA, "i") }),
      ).toHaveCount(0);
    } finally {
      await page.close();
      await context.close();
    }
  });
});
