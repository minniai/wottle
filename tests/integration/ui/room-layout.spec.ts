/**
 * Spec 044 US1 — the room fits without scrolling, nothing sits over the field,
 * the ledger aligns with the bars, no top bar (design system §4; SC-001, SC-002).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";

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
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
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
        await loginViaSlip(pageA, userA);
        await loginViaSlip(pageB, userB);
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
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toBeVisible({ timeout: 20_000 });
      const top = await box(pageA, "player-bar-top");
      const field = await box(pageA, "room-slot-field");
      const bottom = await box(pageA, "player-bar-bottom");
      const live = await box(pageA, "ledger-live-trigger");
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

/**
 * Spec 044 T099 / T102 — WCAG 2.1 AA (axe) in every room state and the profile,
 * plus reference screenshots at 1440×900 and 390×844 attached to the report for
 * comparison with the audit figures (Fig. 2, 5, 6, 7, 8, 9).
 *
 * One deliberate exclusion, and it is the design system's own: the future-move
 * numerals in `#B9B4A6` (§2 names them as the single exception to the palette;
 * they are aria-hidden — the caption carries the count). The two coral
 * exclusions spec 044 carried are gone: decision 2 gave coral a text-only
 * variant, so those selectors pass on their own (spec 045 T036).
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
/**
 * One exclusion, not three. Decision 2 of 15 September gave coral a text-only
 * variant, so the opponent's 14px ledger words and the numerals on scored
 * letters now pass AA on their own (spec 045 FR-032, FR-033). What remains is
 * the design system's single grey exception: future-move numerals, which are
 * aria-hidden because the bottom bar carries the count.
 */
/**
 * The one future-move mark: the ledger's row labels, `aria-hidden` progression
 * marks in the one permitted grey (design system §2); the viewer's move is named
 * by the bottom bar (the ledger's rail went on 2026-09-21).
 */
const CONTRAST_EXCLUSIONS = [".ledger__row--future .ledger__move"];

async function expectAxeClean(page: Page, label: string) {
  let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  for (const selector of CONTRAST_EXCLUSIONS) builder = builder.exclude(selector);
  const results = await builder.analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    `${label} has no axe violations`,
  ).toEqual([]);
}

async function snap(page: Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot({ fullPage: false }), contentType: "image/png" });
}

test.describe("@room-layout accessibility and reference screenshots", () => {
  test("lobby (empty seat), lobby, queue and profile: axe clean at 1440×900 and 390×844", async ({ browser }) => {
    for (const viewport of [
      { width: 1440, height: 900, tag: "desktop" },
      { width: 390, height: 844, tag: "phone" },
    ]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage();
      try {
        await page.goto("/en");
        await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "lobby");
        await expect(page.getByTestId("player-bar-name-input")).toBeVisible();
        await expectAxeClean(page, `lobby-empty-${viewport.tag}`);
        await snap(page, `lobby-empty-${viewport.tag}.png`);

        await loginViaSlip(page, generateTestUsername(`axe-${viewport.tag[0]}`));
        await expectAxeClean(page, `lobby-${viewport.tag}`);
        await snap(page, `lobby-${viewport.tag}.png`);

        await page.getByTestId("player-bar-action-find").click();
        await expect(page.getByTestId("room")).toHaveAttribute("data-phase", /queue|found|match/, { timeout: 15_000 });
        if ((await page.getByTestId("room").getAttribute("data-phase")) === "queue") {
          await expectAxeClean(page, `queue-${viewport.tag}`);
          await snap(page, `queue-${viewport.tag}.png`);
          await page.getByTestId("ledger-cancel-queue").click();
          await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "lobby", { timeout: 15_000 });
        } else {
          // A stray queued player (a failed test's leftover) paired with us; the queue state is covered by matchmaking.spec.
          test.info().annotations.push({ type: "note", description: `queue skipped at ${viewport.tag}: paired immediately` });
        }

        await page.goto("/en/profile");
        await expect(page.getByTestId("profile-page")).toBeVisible({ timeout: 20_000 });
        await expectAxeClean(page, `profile-${viewport.tag}`);
        await snap(page, `profile-${viewport.tag}.png`);
      } finally {
        await context.close();
      }
    }
  });

  test("match and final: axe clean; screenshots at 1440×900 (A) and 390×844 (B)", async ({ browser }) => {
    const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const contextB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("axe-ma");
      const userB = generateTestUsername("axe-mb");
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      for (const p of [pageA, pageB]) await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      await expectAxeClean(pageA, "match-desktop");
      await expectAxeClean(pageB, "match-phone");
      await snap(pageA, "match-desktop.png");
      await snap(pageB, "match-phone.png");

      // Final via resign: menu → resign → the resign slip (spec 048 US7).
      await pageA.getByTestId("ledger-menu-trigger").click();
      await pageA.getByTestId("ledger-menu-item-resign").click();
      await pageA.getByTestId("slip-confirm-resign").click();
      for (const p of [pageA, pageB]) await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: 30_000 });
      await expect(pageA.getByTestId("verdict")).toBeVisible();
      await expectAxeClean(pageA, "final-desktop");
      await expectAxeClean(pageB, "final-phone");
      await snap(pageA, "final-desktop.png");
      await snap(pageB, "final-phone.png");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
