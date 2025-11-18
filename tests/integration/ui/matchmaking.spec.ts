import { expect, test } from "@playwright/test";

async function loginAndAwaitMatchmaker(
  page: import("@playwright/test").Page,
  username: string
) {
  await page.goto("/");
  const input = page.getByTestId("lobby-username-input");
  await expect(input).toBeVisible();
  await input.fill(username);
  await page.getByTestId("lobby-login-submit").click();

  await expect(page.getByTestId("matchmaker-controls")).toBeVisible({
    timeout: 10_000,
  });
}

async function waitForMatchShell(
  page: import("@playwright/test").Page,
  timeout = 15_000
) {
  const shell = page.getByTestId("match-shell");
  await expect(shell).toBeVisible({ timeout });
  await expect(page).toHaveURL(/\/match\/[0-9a-f-]+$/i);
  const matchId = await shell.getAttribute("data-match-id");
  return matchId;
}

test.describe("Matchmaking flows", () => {
  test("auto queue pairs two players into a shared match", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndAwaitMatchmaker(pageA, "queue-alpha");
      await loginAndAwaitMatchmaker(pageB, "queue-beta");

      const startA = pageA.getByTestId("matchmaker-start-button");
      const startB = pageB.getByTestId("matchmaker-start-button");

      await Promise.all([startA.click(), startB.click()]);

      await expect(pageA.getByTestId("matchmaker-queue-status")).toHaveText(
        /looking/,
        { timeout: 5_000 }
      );

      const [matchIdA, matchIdB] = await Promise.all([
        waitForMatchShell(pageA),
        waitForMatchShell(pageB),
      ]);

      expect(matchIdA).toBeTruthy();
      expect(matchIdA).toEqual(matchIdB);
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });

  test("direct invite flow notifies recipient and accepts into match", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndAwaitMatchmaker(pageA, "invite-alfa");
      await loginAndAwaitMatchmaker(pageB, "invite-bravo");

      // Wait for Player A to see Player B in their presence list
      const listA = pageA.getByTestId("lobby-presence-list");
      await expect(
        listA.getByTestId("lobby-card").filter({ hasText: /invite-bravo/i })
      ).toBeVisible({ timeout: 10_000 });

      await pageA.getByTestId("matchmaker-invite-button").click();
      const modal = pageA.getByTestId("matchmaker-invite-modal");
      await expect(modal).toBeVisible();

      const targetRow = modal
        .getByTestId("invite-option")
        .filter({ hasText: /invite-bravo/i });
      await expect(targetRow).toBeVisible();
      await targetRow.getByRole("button", { name: /invite/i }).click();

      await expect(pageA.getByTestId("matchmaker-toast")).toHaveText(
        /invite sent/i,
        { timeout: 5_000 }
      );

      const banner = pageB.getByTestId("matchmaker-invite-banner");
      await expect(banner).toContainText(/invite-alfa/i, { timeout: 10_000 });

      await Promise.all([
        pageB.getByTestId("matchmaker-invite-accept").click(),
        expect(pageB.getByTestId("matchmaker-toast")).toHaveText(/match found/i),
      ]);

      const [matchIdA, matchIdB] = await Promise.all([
        waitForMatchShell(pageA),
        waitForMatchShell(pageB),
      ]);

      expect(matchIdA).toBeTruthy();
      expect(matchIdA).toEqual(matchIdB);
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});


