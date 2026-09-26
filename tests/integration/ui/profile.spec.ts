/**
 * Spec 072 — profiles, end to end (T076, T080). Your own profile; another
 * player's, with challenge ▸ and the stakes; a signed-out visitor's view;
 * handles in URLs, encoded or not; an unknown handle is a 404.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip } from "./helpers/matchmaking";

const GUARD_MS = 600;

async function login(page: Page, prefix: string): Promise<string> {
  const username = generateTestUsername(prefix);
  await loginViaSlip(page, username);
  return username;
}

test.describe("Profiles", () => {
  test("your own profile: rating, sub-lines, chart, form, record, find ▸ and sign out", async ({ page }) => {
    const username = await login(page, "prof-me");
    await page.getByTestId("page-menu-trigger").click();
    await page.getByTestId("page-menu-profile").click();
    await expect(page).toHaveURL(/\/en\/profile$/);
    await expect(page.getByTestId("profile-page")).toHaveAttribute("data-seat", "you");
    await expect(page.getByTestId("profile-sub-left")).toHaveText(`@${username}`);
    await expect(page.getByTestId("profile-sub-right")).toContainText("no matches yet");
    await expect(page.getByTestId("profile-chart")).toBeVisible();
    await expect(page.getByTestId("profile-record")).toContainText("win rate");
    await expect(page.getByTestId("profile-find")).toBeVisible();
    await expect(page.getByTestId("profile-sign-out")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(`profile · ${username}`, { ignoreCase: true });
  });

  test("another player's profile: here now, challenge ▸ with the stakes, then sent · and the call on their side", async ({ browser }) => {
    test.setTimeout(120_000);
    const [ctxA, ctxB] = [await browser.newContext(), await browser.newContext()];
    try {
      const [pageA, pageB] = [await ctxA.newPage(), await ctxB.newPage()];
      await login(pageA, "prof-view");
      const userB = await login(pageB, "prof-seen");
      await pageA.goto(`/en/profile/${encodeURIComponent(userB)}`);
      await expect(pageA.getByTestId("profile-page")).toHaveAttribute("data-seat", "opp");
      await expect(pageA.getByTestId("profile-presence")).toHaveText(/here now/i, { timeout: 20_000 });
      await expect(pageA.getByTestId("profile-stakes")).toContainText(/english words · win \+\d+ · draw [−+]?\d+ · loss −\d+/);
      await expect(pageA.getByText(/last seen/i)).toHaveCount(0);

      await pageA.getByTestId("profile-challenge").click();
      await pageA.waitForTimeout(GUARD_MS);
      await pageA.getByTestId("composer-send").click();
      await expect(pageA.getByTestId("profile-sent")).toContainText(/sent · 0:\d\d/, { timeout: 20_000 });
      await expect(pageA.locator("[data-testid=slot-withdraw]:visible").first()).toBeVisible();
      await expect(pageB.locator("[data-testid=slot-accept]:visible").first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("your own handle goes to /profile; an unknown handle is a 404", async ({ page }) => {
    const username = await login(page, "prof-self");
    await page.goto(`/en/profile/${encodeURIComponent(username)}`);
    await expect(page).toHaveURL(/\/en\/profile$/);
    const response = await page.goto("/en/profile/thisuserdoesnotexist");
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("profile-not-found")).toHaveText("No player by that name.");
  });

  test("a visitor reads a profile, and enter the lobby ▸ returns to it", async ({ browser }) => {
    test.setTimeout(90_000);
    const [seedCtx, ctx] = [await browser.newContext(), await browser.newContext()];
    try {
      const seed = await login(await seedCtx.newPage(), "prof-pub");
      const page = await ctx.newPage();
      await page.goto(`/en/profile/${encodeURIComponent(seed)}`);
      await expect(page.getByTestId("profile-page")).toHaveAttribute("data-seat", "you");
      await expect(page.getByTestId("profile-challenge")).toHaveCount(0);
      await page.getByTestId("profile-enter-lobby").click();
      await page.getByTestId("door-name").fill(generateTestUsername("prof-in"));
      await page.getByTestId("door-enter").click();
      await expect(page).toHaveURL(new RegExp(`/en/profile/${encodeURIComponent(seed)}$`), { timeout: 20_000 });
    } finally {
      await seedCtx.close();
      await ctx.close();
    }
  });

  test("/profile signed out goes to the door and back", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page).toHaveURL(/\/en\?next=%2Fen%2Fprofile$/);
  });

  // Reported 2026-09-24: a lobby row's link to a handle with an Icelandic letter must open the profile.
  test("a handle with an Icelandic letter opens from the lobby row", async ({ browser }) => {
    const [seedCtx, ctx] = [await browser.newContext(), await browser.newContext()];
    try {
      const seed = await login(await seedCtx.newPage(), "þóra");
      const page = await ctx.newPage();
      await login(page, "prof-row");
      const row = page.getByTestId("lobby-row").filter({ hasText: `@${seed}` });
      await row.waitFor({ timeout: 30_000 });
      await row.getByRole("link").first().click();
      await expect(page.getByTestId("profile-sub-left")).toContainText(`@${seed}`, { timeout: 15_000 });
    } finally {
      await seedCtx.close();
      await ctx.close();
    }
  });
});
