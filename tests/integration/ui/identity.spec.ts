/**
 * Spec 067 — this browser keeps your name. A claimed name typed in another
 * browser reads `that name is taken · pick another`; a lapsed session renews
 * without the door. Each browser context is its own browser (its own device key).
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";

test.describe("@identity this browser keeps your name", () => {
  test("a name another browser claimed is taken", async ({ browser }) => {
    const name = generateTestUsername("id-taken");
    const first = await browser.newContext();
    const second = await browser.newContext();
    try {
      await loginViaSlip(await first.newPage(), name);

      const page = await second.newPage();
      await page.goto("/en");
      await page.getByTestId("player-bar-name-input").fill(name.toUpperCase());
      await page.getByTestId("player-bar-action-play").click();
      await expect(page.getByTestId("name-input-error")).toHaveText("that name is taken · pick another", { timeout: 15_000 });
      await expect(page.getByTestId("slip")).toHaveAttribute("data-kind", "signIn");
    } finally {
      await first.close();
      await second.close();
    }
  });

  test("a lapsed session renews from the device key, with no door", async ({ browser }) => {
    const name = generateTestUsername("id-renew");
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await loginViaSlip(page, name);
      await context.clearCookies({ name: "wottle-playtest-session" });

      await page.goto("/en/lobby");
      await expect(page.getByTestId("slip")).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByTestId("player-bar-bottom")).toContainText(name, { ignoreCase: true });
      const cookies = await context.cookies();
      expect(cookies.find((c) => c.name === "wottle-playtest-session")?.value).toMatch(/^v1\./);
    } finally {
      await context.close();
    }
  });

  test("an edited session cookie is no session", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await loginViaSlip(page, generateTestUsername("id-forge"));
      const session = (await context.cookies()).find((c) => c.name === "wottle-playtest-session")!;
      await context.clearCookies();
      await context.addCookies([{ ...session, value: session.value.slice(0, 8) + (session.value[8] === "A" ? "B" : "A") + session.value.slice(9) }]);

      await page.goto("/en");
      await expect(page.getByTestId("slip")).toHaveAttribute("data-kind", "signIn", { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test("signing out is not offered during a match, not even on the profile", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();
      const userB = generateTestUsername("id-out-b");
      await loginViaSlip(pageA, generateTestUsername("id-out-a"));
      await loginViaSlip(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });

      await pageA.getByTestId("ledger-menu-trigger").click();
      await expect(pageA.getByTestId("ledger-menu-item-signout")).toHaveCount(0);
      await pageA.keyboard.press("Escape");

      await pageA.goto("/en/profile");
      await expect(pageA.getByTestId("profile-page")).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByTestId("profile-sign-out")).toHaveCount(0);
      await expect(pageA.getByTestId("profile-change-name")).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("the returning door: one press back in, or another name, and the browser keeps both", async ({ page }) => {
    const first = generateTestUsername("id-back-a");
    const second = generateTestUsername("id-back-b");
    const signOut = async () => {
      await page.getByTestId("ledger-menu-trigger").click();
      await page.getByTestId("ledger-menu-item-signout").click();
      await expect(page.getByTestId("slip")).toHaveAttribute("data-kind", "signIn", { timeout: 15_000 });
    };

    await loginViaSlip(page, first);
    await signOut();
    await expect(page.getByTestId("slip")).toContainText("welcome back");
    await expect(page.getByTestId("slip-returning-name")).toContainText(first, { ignoreCase: true });
    await page.getByTestId("slip-enter-returning").click();
    await expect(page.getByTestId("slip")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("player-bar-bottom")).toContainText(first, { ignoreCase: true });

    await signOut();
    await page.getByTestId("slip-use-another-name").click();
    await page.getByTestId("player-bar-name-input").fill(second);
    await page.getByTestId("player-bar-action-play").click();
    await expect(page.getByTestId("player-bar-bottom")).toContainText(second, { timeout: 15_000, ignoreCase: true });

    await signOut();
    await expect(page.getByTestId("slip-returning-name")).toContainText(second, { ignoreCase: true });
    // The same key still claims the first name.
    await page.getByTestId("slip-use-another-name").click();
    await page.getByTestId("player-bar-name-input").fill(first);
    await page.getByTestId("player-bar-action-play").click();
    await expect(page.getByTestId("player-bar-bottom")).toContainText(first, { timeout: 15_000, ignoreCase: true });
  });
});
