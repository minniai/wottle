/**
 * Spec 044 US10 — the profile on the room grid: own profile teal, another
 * player's coral; a recent match opens its final room read-only.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });
test.skip(({ browserName }) => browserName !== "chromium", "profile smoke runs on chromium only");

async function login(page: Page, prefix: string) {
  const username = generateTestUsername(prefix);
  await loginViaSlip(page, username);
  return username;
}

test.describe("@profile-room", () => {
  test("own profile is teal with identity, hairline chart, record row and foot actions", async ({ page }) => {
    const username = await login(page, "prof-me");
    await page.goto("/en/profile");
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-seat", "you", { timeout: 15_000 });
    await expect(page.getByTestId("profile-handle")).toContainText(`@${username}`);
    await expect(page.getByTestId("profile-rating-chart")).toBeVisible();
    expect(await page.getByTestId("profile-rating-chart").locator("circle").count()).toBe(0);
    await expect(page.getByTestId("profile-record")).toContainText("win rate");
    await expect(page.getByTestId("profile-change-name")).toBeVisible();
    await expect(page.getByTestId("profile-sign-out")).toBeVisible();
    await expect(page.getByTestId("topbar")).toHaveCount(0);
  });

  test("another player's profile is coral and has no sign out; unknown handles state the fact", async ({ browser }) => {
    const seedCtx = await browser.newContext();
    const seedPage = await seedCtx.newPage();
    const seed = await login(seedPage, "prof-seed");
    await seedCtx.close();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await login(page, "prof-view");
      await page.goto(`/en/profile/${seed}`);
      await expect(page.getByTestId("profile-page")).toHaveAttribute("data-seat", "opp", { timeout: 15_000 });
      await expect(page.getByTestId("profile-sign-out")).toHaveCount(0);
      await expect(page.getByTestId("profile-back-lobby")).toBeVisible();
      await page.goto("/en/profile/thisuserdoesnotexist");
      await expect(page.getByTestId("profile-not-found")).toContainText("No such player");
    } finally {
      await ctx.close();
    }
  });

  // Reported 2026-09-24: a lobby row's link to a player whose handle holds an Icelandic letter read
  // `profile unavailable`, since the route hands the handle over percent-encoded.
  test("a handle with an Icelandic letter opens from the lobby row", async ({ browser }) => {
    const seedCtx = await browser.newContext();
    const ctx = await browser.newContext();
    try {
      const seedPage = await seedCtx.newPage();
      const seed = await login(seedPage, "þóra");
      const page = await ctx.newPage();
      await login(page, "prof-row");
      const row = page.getByTestId("lobby-row").filter({ hasText: `@${seed}` });
      await row.waitFor({ timeout: 30_000 });
      await row.getByRole("link").first().click();
      await expect(page.getByTestId("profile-page")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("profile-handle")).toContainText(`@${seed}`);
      await expect(page.getByTestId("profile-unavailable")).toHaveCount(0);
    } finally {
      await seedCtx.close();
      await ctx.close();
    }
  });
});
