import { test, expect } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("@landing Phase 4a landing screen", () => {
  test("unauthenticated visitor sees the landing hero", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Play with\s+letters\./i }),
    ).toBeVisible();
    await expect(page.getByTestId("landing-username-input")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Enter lobby/i }),
    ).toBeVisible();
  });

  test("submitting a valid username lands on /lobby", async ({ page }) => {
    const username = generateTestUsername("landing");
    await page.goto("/");
    await page.getByTestId("landing-username-input").fill(username);
    await page.getByTestId("landing-login-submit").click();
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
    await expect(page.getByTestId("lobby-shell")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("authenticated visit to / redirects to /lobby", async ({ page }) => {
    const username = generateTestUsername("landing-auth");
    await page.goto("/");
    await page.getByTestId("landing-username-input").fill(username);
    await page.getByTestId("landing-login-submit").click();
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });

    await page.goto("/");
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 10_000 });
  });
});
