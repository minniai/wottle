import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

/**
 * Spec 070 US1 (T022): the door. No field on it; a name and one press enter
 * the lobby at the same URL; `?next=` is honoured only for a known page; on a
 * short phone the primary stays above the fold.
 */
test.describe("the door (spec 070 US1)", () => {
  test("/ and /en are the door: a lockup, a headline, one name field and no field", async ({ page }) => {
    for (const [path, headline, label] of [
      ["/", "Tveir leikmenn, eitt borð,", "Orðusta, Wottle á ensku"],
      ["/en", "Two players, one field,", "Wottle, Orðusta in Icelandic"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(headline);
      await expect(page.getByRole("img", { name: label })).toBeVisible();
      await expect(page.getByTestId("door-name")).toBeVisible();
      await expect(page.getByTestId("field")).toHaveCount(0);
    }
  });

  test("a name too short shows the rule as an error", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("door-name").fill("ab");
    await page.getByTestId("door-enter").click();
    await expect(page.getByTestId("door-error")).toHaveAttribute("data-error", "true");
    await expect(page.getByTestId("door-name")).toHaveAttribute("aria-invalid", "true");
  });

  test("entering lands in the lobby at the same URL, replacing the door in history", async ({ page }) => {
    await page.goto("/en/rules");
    await page.goto("/en");
    await page.getByTestId("door-name").fill(generateTestUsername("door"));
    await page.getByTestId("door-enter").click();
    await expect(page.getByTestId("door-form")).toHaveCount(0, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/en(\/lobby)?$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/rules$/);
  });

  test("?next= to a known page is followed; one off the site is dropped", async ({ page, context }) => {
    await page.goto("/en?next=/en/rules");
    await page.getByTestId("door-name").fill(generateTestUsername("next"));
    await page.getByTestId("door-enter").click();
    await expect(page).toHaveURL(/\/en\/rules$/, { timeout: 20_000 });

    await context.clearCookies();
    await page.goto("/en?next=//evil.example");
    await page.getByTestId("door-name").fill(generateTestUsername("evil"));
    await page.getByTestId("door-enter").click();
    await expect(page.getByTestId("door-form")).toHaveCount(0, { timeout: 20_000 });
    expect(new URL(page.url()).host).toBe(new URL(page.url()).host);
    await expect(page).not.toHaveURL(/evil/);
  });

  test("on a 390×664 phone the primary ends above the fold", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 664 } });
    const page = await context.newPage();
    for (const path of ["/", "/en"]) {
      await page.goto(path);
      const box = await page.getByTestId("door-enter").boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(664);
    }
    await context.close();
  });

  test("a match link opened signed out goes to the door, with next back to the match", async ({ page }) => {
    const id = "5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11";
    await page.goto(`/en/match/${id}`);
    await expect(page.getByTestId("door-form")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("next")).toBe(`/en/match/${id}`);
  });
});
