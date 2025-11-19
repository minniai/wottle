import { expect, test } from "@playwright/test";

async function loginAs(page: import("@playwright/test").Page, username: string) {
  await page.goto("/");
  const input = page.getByTestId("lobby-username-input");
  await expect(input).toBeVisible();
  await input.fill(username);
  await page.getByTestId("lobby-login-submit").click();

  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({
    timeout: 5_000,
  });
}

test.describe("Lobby presence", () => {
  test("shows both players within five seconds and updates on leave", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await loginAs(pageA, "tester-alpha");
    await loginAs(pageB, "tester-beta");

    const listA = pageA.getByTestId("lobby-presence-list");
    const listB = pageB.getByTestId("lobby-presence-list");

    await expect(listA.getByTestId("lobby-card").filter({ hasText: /tester-beta/i })).toBeVisible({
      timeout: 5_000,
    });
    await expect(listB.getByTestId("lobby-card").filter({ hasText: /tester-alpha/i })).toBeVisible({
      timeout: 5_000,
    });

    // Explicitly disconnect before closing to ensure cleanup completes
    await pageB.evaluate(() => {
      // @ts-ignore - accessing global store for test cleanup
      window.useLobbyPresenceStore?.getState().disconnect();
    });

    // Give time for DELETE request + Realtime propagation + polling cycles
    await pageB.waitForTimeout(2500);

    await pageB.close();
    await contextB.close();

    // Wait for presence cleanup to propagate (polling runs every 500ms)
    await expect
      .poll(
        async () =>
          listA
            .getByTestId("lobby-card")
            .filter({ hasText: /tester-beta/i })
            .count(),
        {
          timeout: 15_000,
          intervals: [500, 1000, 2000],
        }
      )
      .toBe(0);

    await pageA.close();
    await contextA.close();
  });
});


