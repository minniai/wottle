/**
 * Spec 072 T088 (FR-060, FR-061): `how to play ▸` reaches the rules from every
 * page, and a rules tab opened from a match offers `close this tab ▸`.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip } from "./helpers/matchmaking";

const MATCH = "/en/match/0b8f2a1c-3d4e-4f5a-8b6c-7d8e9f0a1b2c";

test.describe("how to play ▸", () => {
  test("from the door, a profile, the lobby and the phone ⋯", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("main").getByRole("link", { name: "how to play ▸" })).toHaveAttribute("href", "/en/rules");
    const user = generateTestUsername("rules-l");
    await loginViaSlip(page, user);
    await expect(page.getByTestId("masthead-rules")).toHaveAttribute("href", "/en/rules");
    await page.goto("/en/profile");
    await expect(page.getByTestId("masthead-rules")).toHaveAttribute("href", "/en/rules");
    await page.goto("/en/rules");
    await expect(page.getByTestId("masthead-rules")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("rules-find")).toBeVisible();
    await expect(page.getByTestId("rules-page")).toContainText("your 10 moves");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/profile");
    await page.getByTestId("page-menu").getByRole("button").first().click();
    await expect(page.getByTestId("page-menu-rules")).toHaveAttribute("href", "/en/rules");
  });

  test("from the invite door", async ({ page }) => {
    await page.goto("/en/c/Xq7Vt2pLm9KcR4sWn8BjYd3HfA6gZe1uQo5iNw0bTyE");
    await expect(page.getByRole("main").getByRole("link", { name: "how to play ▸" })).toHaveAttribute("href", "/en/rules");
  });

  test("opened from a match, close this tab ▸ closes it, or returns to the match", async ({ context }) => {
    const opener = await context.newPage();
    await opener.goto("/en");
    const [tab] = await Promise.all([context.waitForEvent("page"), opener.evaluate((url) => window.open(url, "_blank"), `/en/rules?from=${encodeURIComponent(MATCH)}`)]);
    await tab.waitForLoadState();
    await expect(tab.getByTestId("rules-closeTab")).toHaveText("close this tab ▸");
    await Promise.all([tab.waitForEvent("close"), tab.getByTestId("rules-closeTab").click()]);
    expect(tab.isClosed()).toBe(true);
  });

  test("a from that is not a match is ignored", async ({ page }) => {
    await page.goto(`/en/rules?from=${encodeURIComponent("https://evil.test/")}`);
    await expect(page.getByTestId("rules-closeTab")).toHaveCount(0);
    await expect(page.getByTestId("rules-enterLobby")).toBeVisible();
  });
});
