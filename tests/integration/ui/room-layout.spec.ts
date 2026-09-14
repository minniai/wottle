/**
 * Spec 044 US1 — the room fits without scrolling, nothing sits over the field,
 * the ledger aligns with the bars, no top bar (design system §4; SC-001, SC-002).
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, startMatchWithDirectInvite } from "./helpers/matchmaking";

async function loginPlayer(page: Page, username: string) {
  await page.goto("/");
  await page.getByTestId("player-bar-name-input").fill(username);
  await page.getByTestId("player-bar-action-play").click();
  await expect(page.getByTestId("ledger-here-now")).toBeVisible({ timeout: 20_000 });
}

async function box(page: Page, testId: string) {
  const b = await page.getByTestId(testId).boundingBox();
  expect(b, `${testId} has a box`).not.toBeNull();
  return b!;
}

function intersects(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("@room-layout room fits and nothing covers the field", () => {
  test("desktop 1440×900: stack order, ledger alignment, no scroll, no overlap, no top bar", async ({ browser }) => {
    const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("room-a");
      const userB = generateTestUsername("room-b");
      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toBeVisible({ timeout: 20_000 });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match");

      const top = await box(pageA, "player-bar-top");
      const field = await box(pageA, "room-slot-field");
      const bottom = await box(pageA, "player-bar-bottom");
      const ledger = await box(pageA, "ledger");

      expect(top.y + top.height).toBeLessThanOrEqual(field.y + 1);
      expect(field.y + field.height).toBeLessThanOrEqual(bottom.y + 1);
      expect(ledger.x).toBeGreaterThan(field.x + field.width);
      expect(Math.abs(ledger.y - top.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(ledger.y + ledger.height - (bottom.y + bottom.height))).toBeLessThanOrEqual(2);
      expect(Math.abs(field.width - field.height)).toBeLessThanOrEqual(2);

      const scrollable = await pageA.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
      expect(scrollable).toBe(false);

      // Nothing may be positioned over the field (FR-005).
      const overlappers = await pageA.evaluate((rect) => {
        const field = document.querySelector('[data-testid="room-slot-field"]')!;
        return Array.from(document.body.querySelectorAll<HTMLElement>("*"))
          .filter((el) => !field.contains(el) && !el.contains(field))
          .filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.position !== "fixed" && cs.position !== "absolute") return false;
            if (cs.pointerEvents === "none" || cs.visibility === "hidden" || cs.display === "none") return false;
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.height > 0 && b.x < rect.x + rect.width && b.x + b.width > rect.x && b.y < rect.y + rect.height && b.y + b.height > rect.y;
          })
          .map((el) => el.getAttribute("data-testid") ?? el.className);
      }, field);
      expect(overlappers).toEqual([]);

      expect(intersects(top, field)).toBe(false);
      expect(intersects(bottom, field)).toBe(false);
      await expect(pageA.getByTestId("topbar")).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("laptop 1000px: ledger narrows to 260px; 1280×800: field ≥ 560px", async ({ browser }) => {
    for (const { width, height, ledgerMax, fieldMin } of [
      { width: 1000, height: 800, ledgerMax: 261, fieldMin: 0 },
      { width: 1280, height: 800, ledgerMax: 341, fieldMin: 560 },
    ]) {
      const contextA = await browser.newContext({ viewport: { width, height } });
      const contextB = await browser.newContext({ viewport: { width, height } });
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();
      try {
        const userA = generateTestUsername("room-l");
        const userB = generateTestUsername("room-m");
        await loginPlayer(pageA, userA);
        await loginPlayer(pageB, userB);
        await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
        await expect(pageA.getByTestId("room")).toBeVisible({ timeout: 20_000 });
        const ledger = await box(pageA, "ledger");
        const field = await box(pageA, "room-slot-field");
        expect(ledger.width).toBeLessThanOrEqual(ledgerMax);
        expect(field.width).toBeGreaterThanOrEqual(fieldMin);
      } finally {
        await contextA.close();
        await contextB.close();
      }
    }
  });

  test("phone 390×844: bar / field / bar / live row visible without scrolling", async ({ browser }) => {
    const contextA = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("room-p");
      const userB = generateTestUsername("room-q");
      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toBeVisible({ timeout: 20_000 });
      const top = await box(pageA, "player-bar-top");
      const field = await box(pageA, "room-slot-field");
      const bottom = await box(pageA, "player-bar-bottom");
      const live = await box(pageA, "ledger-live-row");
      for (const b of [top, field, bottom, live]) expect(b.y + b.height).toBeLessThanOrEqual(844);
      expect(field.width).toBeGreaterThanOrEqual(358); // full width minus 16px gutters
      const cell = await pageA.getByTestId("field-cell").first().boundingBox();
      expect(cell!.width).toBeGreaterThanOrEqual(34);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
