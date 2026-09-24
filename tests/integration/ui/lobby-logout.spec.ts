/**
 * Spec 044 US7, spec 070: sign out lives in the masthead's ⋯ menu; the page returns to the door.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe("@lobby-logout sign out from the ⋯ menu", () => {
  test("user A signs out and user B signs in on the same page", async ({ page }) => {
    const userA = generateTestUsername("out-a");
    const userB = generateTestUsername("out-b");
    const lobbyName = page.getByRole("heading", { level: 1 });
    await page.goto("/en");
    await page.getByTestId("door-name").fill(userA);
    await page.getByTestId("door-enter").click();
    // The lobby's h1 is the display name (first letter capitalised); compare case-insensitively.
    await expect(lobbyName).toContainText(userA, { timeout: 15_000, ignoreCase: true });

    await page.getByTestId("page-menu").getByRole("button", { name: "menu" }).click();
    await page.getByTestId("page-menu-sign-out").click();
    // Spec 067: the door greets this browser's player; another name is one press away.
    await expect(page.getByTestId("door-returning")).toContainText(userA, { timeout: 15_000, ignoreCase: true });
    await page.getByTestId("door-another-name").click();
    await expect(page.getByTestId("door-name")).toBeVisible();

    await page.getByTestId("door-name").fill(userB);
    await page.getByTestId("door-enter").click();
    await expect(lobbyName).toContainText(userB, { timeout: 15_000, ignoreCase: true });
    await expect(lobbyName).not.toContainText(userA, { ignoreCase: true });
  });
});
