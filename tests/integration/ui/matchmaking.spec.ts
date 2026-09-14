import { expect, test } from "@playwright/test";

async function loginAndAwaitMatchmaker(
  page: import("@playwright/test").Page,
  username: string
) {
  await page.goto("/");
  const input = page.getByTestId("player-bar-name-input");
  await expect(input).toBeVisible();
  await input.fill(username);
  await page.getByTestId("player-bar-action-play").click();

  await expect(page.getByTestId("player-bar-action-ranked")).toBeVisible({
    timeout: 10_000,
  });
}

async function waitForMatchShell(
  page: import("@playwright/test").Page,
  timeout = 15_000
) {
  const shell = page.getByTestId("room");
  await expect(shell).toBeVisible({ timeout });
  await expect(page).toHaveURL(/\/match\/[0-9a-f-]+$/i);
  const matchId = await shell.getAttribute("data-match-id");
  return matchId;
}

test.describe("Matchmaking flows", () => {
  test.skip("auto queue pairs two players into a shared match", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndAwaitMatchmaker(pageA, "queue-alpha");
      await loginAndAwaitMatchmaker(pageB, "queue-beta");

      const startA = pageA.getByTestId("player-bar-action-ranked");
      const startB = pageB.getByTestId("player-bar-action-ranked");

      // Click start buttons simultaneously - the queue logic handles race conditions
      await Promise.all([startA.click(), startB.click()]);

      // Wait a moment for queue processing
      await pageA.waitForTimeout(500);

      // Wait for match to be created - polling happens every 3 seconds
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


