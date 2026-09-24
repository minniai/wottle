/**
 * Spec 070 US3 (T066): a challenge from the composer. The stakes before
 * sending, the sent state with its drain, a decline and its cooldown, an
 * accept that seats both at the table, a withdraw, and crossed sends.
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test, type Page } from "@playwright/test";

import { acceptCall, generateTestUsername, loginViaSlip } from "./helpers/matchmaking";

const GUARD_MS = 600;
const row = (page: Page, handle: string) => page.getByTestId("lobby-row").filter({ hasText: `@${handle}` });
const slot = (page: Page) => page.getByTestId("line-slot-desktop");
const line1 = (page: Page) => slot(page).getByTestId("line-slot-line1");

async function compose(page: Page, handle: string): Promise<void> {
  await row(page, handle).waitFor({ state: "visible", timeout: 30_000 });
  await row(page, handle).getByRole("button", { name: /challenge/i }).click();
  await page.waitForTimeout(GUARD_MS);
}

test.describe("challenges from the lobby (spec 070 US3) @two-player-playtest", () => {
  test("stakes, sent, declined and its cooldown, then an accept seats both", async ({ browser }) => {
    test.setTimeout(240_000);
    const [ctxA, ctxB] = [await browser.newContext(), await browser.newContext()];
    try {
      const [a, b] = [await ctxA.newPage(), await ctxB.newPage()];
      const [nameA, nameB] = [generateTestUsername("chal-a"), generateTestUsername("chal-b")];
      await loginViaSlip(a, nameA);
      await loginViaSlip(b, nameB);

      // The composer states the stakes before anything is sent.
      await compose(a, nameB);
      await expect(a.getByTestId("composer-send")).toBeFocused();
      await expect(a.locator(".composer-row__terms")).toContainText(/every match rated · win \+\d+ · draw [+−-]?\d+ · loss −\d+/);
      await a.getByTestId("composer-send").click();

      // Sent: A's slot counts with a drain, A's row for B reads sent; B's slot has the call.
      await expect(line1(a)).toContainText(new RegExp(`Challenge sent · ${nameB} · 0:5\\d`, "i"), { timeout: 10_000 });
      await expect(slot(a).locator(".line-slot__drain")).toBeVisible();
      await expect(row(a, nameB).locator(".lobby-row__status")).toContainText(/sent · 0:\d\d/);
      await expect(line1(b)).toContainText(new RegExp(`${nameA} challenges you`, "i"), { timeout: 10_000 });
      await expect(row(b, nameA).locator(".lobby-row__status")).toContainText("challenges you");

      // B declines: A holds `declined`, then the pair cools down and a resend is not offered.
      await b.waitForTimeout(GUARD_MS);
      await slot(b).getByTestId("slot-decline").click();
      await expect(line1(a)).toContainText(new RegExp(`${nameB} · declined`, "i"), { timeout: 10_000 });
      await expect(row(a, nameB)).toContainText(/again in 0:\d\d/, { timeout: 10_000 });
      await expect(row(a, nameB).getByRole("button", { name: /challenge/i })).toHaveCount(0);

      // After the 60s cooldown A sends again, B accepts, and both are at the table, A already seated.
      await expect(row(a, nameB).getByRole("button", { name: /challenge/i })).toBeVisible({ timeout: 75_000 });
      await compose(a, nameB);
      await a.getByTestId("composer-send").click();
      await acceptCall(b);
      for (const p of [a, b]) await expect(p).toHaveURL(/\/match\/[0-9a-f-]{36}/, { timeout: 20_000 });
      await expect(a.getByTestId("slip-ready")).toHaveCount(0);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("a withdrawn challenge leaves both slots; crossed sends start the match", async ({ browser }) => {
    test.setTimeout(120_000);
    const [ctxC, ctxD] = [await browser.newContext(), await browser.newContext()];
    try {
      const [c, d] = [await ctxC.newPage(), await ctxD.newPage()];
      const [nameC, nameD] = [generateTestUsername("chal-c"), generateTestUsername("chal-d")];
      await loginViaSlip(c, nameC);
      await loginViaSlip(d, nameD);

      await compose(c, nameD);
      await c.getByTestId("composer-send").click();
      await expect(line1(d)).toContainText(/challenges you/i, { timeout: 10_000 });
      await c.waitForTimeout(GUARD_MS);
      await slot(c).getByTestId("slot-withdraw").click();
      await expect(line1(c)).toContainText(new RegExp(`${nameD} · withdrawn`, "i"), { timeout: 10_000 });
      await expect(d.locator("[data-testid=slot-accept]:visible")).toHaveCount(0, { timeout: 10_000 });

      // Both send at once: the second send answers the first, and the match starts with both seated.
      await compose(c, nameD);
      await compose(d, nameC);
      await Promise.all([c.getByTestId("composer-send").click(), d.getByTestId("composer-send").click()]);
      for (const p of [c, d]) await expect(p).toHaveURL(/\/match\/[0-9a-f-]{36}/, { timeout: 20_000 });
      expect(c.url().split("/match/")[1]).toBe(d.url().split("/match/")[1]);
      for (const p of [c, d]) await expect(p.getByTestId("slip-ready")).toHaveCount(0);
    } finally {
      await ctxC.close();
      await ctxD.close();
    }
  });
});
