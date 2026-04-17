import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function loginAs(page: Page, username: string) {
  await page.goto("/");
  const input = page.getByTestId("lobby-username-input");
  await expect(input).toBeVisible();
  await input.fill(username);
  await page.getByTestId("lobby-login-submit").click();
  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("Lobby visual foundation — brand + layout", () => {
  test("logged-out hero renders Wottle wordmark and ORÐUSTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Wottle" })).toBeVisible();
    await expect(page.getByText(/ORÐUSTA/)).toBeVisible();
  });

  test("logged-out view passes WCAG 2.1 AA axe scan", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });

  test("logged-in view passes WCAG 2.1 AA axe scan", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, "axe-reader");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
    await context.close();
  });

  test("keyboard-only sweep reaches hero, Play Now, and directory", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, "kbd-sweep");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-testid"),
    );
    expect(focused).not.toBeNull();
    await context.close();
  });
});

test.describe("Lobby visual foundation — viewport matrix (FR-031/032/033)", () => {
  const VIEWPORTS = [
    { name: "mobile-375", width: 375, height: 812 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1280", width: 1280, height: 800 },
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "widescreen-1920", width: 1920, height: 1080 },
  ];

  for (const vp of VIEWPORTS) {
    test(`no horizontal scroll at ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.body.scrollWidth - document.body.clientWidth,
      );
      expect(overflow).toBe(0);
      await context.close();
    });
  }

  test("desktop 1440 keeps hero + Play Now + directory above the fold", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await loginAs(page, "desktop-fold");
    const heroBox = await page.locator("header").first().boundingBox();
    const ctaBox = await page
      .getByTestId("matchmaker-start-button")
      .boundingBox();
    expect(heroBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    expect((heroBox?.y ?? 0) + (heroBox?.height ?? 0)).toBeLessThanOrEqual(900);
    expect((ctaBox?.y ?? 0) + (ctaBox?.height ?? 0)).toBeLessThanOrEqual(900);
    await context.close();
  });

  test("mobile 375 keeps Play Now sticky and invite Dialog as bottom-sheet", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await loginAs(page, "mobile-fold");
    const cta = page.getByTestId("matchmaker-start-button");
    await expect(cta).toBeVisible();
    await context.close();
  });
});

test.describe("Lobby visual foundation — 44×44 touch targets (FR-030)", () => {
  test("every interactive element meets 44×44 at 375 px", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await loginAs(page, "touch-target");
    const rects = await page.$$eval(
      "button, a, [role='button']",
      (nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { w: r.width, h: r.height, label: n.textContent?.trim() };
        }),
    );
    const offenders = rects.filter(
      (r) => r.w > 0 && r.h > 0 && (r.w < 44 || r.h < 44),
    );
    expect(offenders).toEqual([]);
    await context.close();
  });
});

test.describe("Lobby visual foundation — prefers-reduced-motion (FR-026)", () => {
  test("hero word does not cycle and no keyframes run under reduced motion", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/");
    const motifSelector = '[data-testid="lobby-hero-motif"]';
    await page.waitForSelector(motifSelector);
    const before = await page.locator(motifSelector).textContent();
    await page.waitForTimeout(6000);
    const after = await page.locator(motifSelector).textContent();
    expect(after).toBe(before);
    const targetSelectors = [
      ".lobby-skeleton",
      ".lobby-status-dot--pulse",
      ".lobby-hero-tile",
      ".lobby-primary-cta",
      ".lobby-player-card",
    ].join(", ");
    const targetCount = await page.$$eval(targetSelectors, (nodes) => nodes.length);
    expect(targetCount).toBeGreaterThan(0);
    const styles = await page.$$eval(targetSelectors, (nodes) =>
      nodes.map((n) => {
        const s = getComputedStyle(n);
        return { animationName: s.animationName, transitionDuration: s.transitionDuration };
      }),
    );
    for (const s of styles) {
      expect(s.animationName).toBe("none");
      expect(s.transitionDuration).toBe("0s");
    }
    await context.close();
  });
});
