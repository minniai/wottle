/**
 * Spec 070 US4, US9 (T082, T111): the line slot follows the player on every
 * page. A call reaches a hidden tab on another page (title and favicon), is
 * answered there, arrives within 1s over the socket (3s by polling), a sent
 * challenge follows its sender, a running match offers `back to the match ▸`,
 * and nothing under the masthead moves as the slot changes (SC-006).
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test, type Page } from "@playwright/test";

import { acceptCall, challenge, generateTestUsername, loginViaSlip } from "./helpers/matchmaking";

const GUARD_MS = 600;
/** SC-001: a call appears within 1s with the socket, 3s by the fallback poll (plus the test's own latency). */
const CALL_WITHIN_MS = process.env.NEXT_PUBLIC_DISABLE_REALTIME === "true" ? 3_500 : 1_500;
const slot = (page: Page) => page.getByTestId("line-slot-desktop");
const line1 = (page: Page) => slot(page).getByTestId("line-slot-line1");

async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test.describe("the line slot on every page (spec 070 US4) @two-player-playtest", () => {
  test("a call reaches a hidden tab on /rules in time, is answered there, and the match waits on any page", async ({ browser }) => {
    test.setTimeout(150_000);
    const [ctxA, ctxB] = [await browser.newContext(), await browser.newContext()];
    try {
      const [a, b] = [await ctxA.newPage(), await ctxB.newPage()];
      const [nameA, nameB] = [generateTestUsername("slot-a"), generateTestUsername("slot-b")];
      await loginViaSlip(a, nameA);
      await loginViaSlip(b, nameB);
      await a.getByTestId("lobby-row").filter({ hasText: `@${nameB}` }).waitFor({ timeout: 30_000 });
      await b.goto("/en/rules");
      await expect(slot(b)).toBeVisible();
      await setHidden(b, true);
      const favicon = () => b.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute("href") ?? "");
      const before = await favicon();

      await challenge(a, nameB);
      const sentAt = Date.now();
      await expect(line1(b)).toContainText(/challenges you/i, { timeout: 10_000 });
      expect(Date.now() - sentAt, "the call arrives in time (SC-001)").toBeLessThan(CALL_WITHIN_MS);
      await expect(b).toHaveTitle(new RegExp(`^\\(1\\) ${nameA} challenges you · `, "i"));
      expect(await favicon()).not.toBe(before);

      // Back in the tab, B accepts on /rules: both go to the table.
      await setHidden(b, false);
      await acceptCall(b);
      for (const p of [a, b]) await expect(p).toHaveURL(/\/match\/[0-9a-f-]{36}/, { timeout: 20_000 });
      const matchUrl = a.url();
      // A table waiting takes its player to it from any page; leave only once the match runs.
      await expect(a.getByTestId("ledger-live-row")).toContainText("move 1 · your move", { timeout: 20_000 });

      // The match runs while A reads the rules: the slot offers the way back.
      await a.goto("/en/rules");
      await expect(line1(a)).toContainText(new RegExp(`Your match · ${nameB}`, "i"), { timeout: 15_000 });
      await a.waitForTimeout(GUARD_MS);
      await slot(a).getByTestId("slot-backToMatch").click();
      await expect(a).toHaveURL(matchUrl, { timeout: 15_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("a sent challenge follows its sender to /profile; the slot's changes move nothing below it", async ({ browser }) => {
    test.setTimeout(120_000);
    const [ctxC, ctxD] = [await browser.newContext(), await browser.newContext()];
    try {
      const [c, d] = [await ctxC.newPage(), await ctxD.newPage()];
      const [nameC, nameD] = [generateTestUsername("slot-c"), generateTestUsername("slot-d")];
      await loginViaSlip(c, nameC);
      await loginViaSlip(d, nameD);

      // SC-006: watch for layout shift under the masthead while the slot cycles.
      c.on("console", (m) => m.text().startsWith("layout-shift") && console.log(m.text()));
      await c.evaluate(() => {
        (window as unknown as { __shift: number }).__shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
            if (entry.hadRecentInput) continue;
            // Who is here is live content: rows come and go with other players, not with the slot.
            const nodes = ((entry as unknown as { sources?: Array<{ node?: Element }> }).sources ?? []).map((s) => s.node);
            if (nodes.length > 0 && nodes.every((n) => n?.closest?.(".lobby-table-wrap"))) continue;
            (window as unknown as { __shift: number }).__shift += entry.value;
            const sources = (entry as unknown as { sources?: Array<{ node?: Element }> }).sources ?? [];
            console.log(`layout-shift ${entry.value} ${sources.map((s) => (s.node as HTMLElement | undefined)?.className ?? "?").join(" | ")}`);
          }
        }).observe({ type: "layout-shift", buffered: false });
      });
      // empty → call → (declined) → sent → (withdrawn) → search → empty
      await challenge(d, nameC);
      await expect(line1(c)).toContainText(/challenges you/i, { timeout: 10_000 });
      await c.waitForTimeout(GUARD_MS);
      await slot(c).getByTestId("slot-decline").click();
      await expect(line1(d)).toContainText(/declined/i, { timeout: 10_000 });
      await d.waitForTimeout(5_000);
      await challenge(c, nameD);
      await expect(line1(c)).toContainText(/Challenge sent/i, { timeout: 10_000 });
      await c.waitForTimeout(GUARD_MS);
      await slot(c).getByTestId("slot-withdraw").click();
      await c.waitForTimeout(4_500);
      await c.getByTestId("lobby-find").click();
      await expect(line1(c)).toContainText(/Searching/i, { timeout: 10_000 });
      await c.waitForTimeout(GUARD_MS);
      await slot(c).locator("[data-testid=slot-cancelSearch]").click();
      await c.waitForTimeout(1_000);
      expect(await c.evaluate(() => (window as unknown as { __shift: number }).__shift), "cumulative layout shift").toBe(0);

      // The sent state follows C to their profile.
      await challenge(c, nameD);
      await expect(line1(c)).toContainText(/Challenge sent/i, { timeout: 10_000 });
      await c.goto("/en/profile");
      await expect(line1(c)).toContainText(new RegExp(`Challenge sent · ${nameD}`, "i"), { timeout: 15_000 });
    } finally {
      await ctxC.close();
      await ctxD.close();
    }
  });
});
