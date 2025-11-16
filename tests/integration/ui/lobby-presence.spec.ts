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

    await pageB.close();
    await contextB.close();

    await expect
      .poll(
        async () =>
          listA
            .getByTestId("lobby-card")
            .filter({ hasText: /tester-beta/i })
            .count(),
        {
          timeout: 5_000,
        }
      )
      .toBe(0);

    await pageA.close();
    await contextA.close();
  });
});


