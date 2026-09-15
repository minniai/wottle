import { expect, test } from "@playwright/test";

/**
 * The visual suite (spec 045 US1, FR-004). Every room state, from static
 * fixtures, with no Supabase running — this is the check whose absence let the
 * paint defects of spec 044 ship.
 *
 * One test per phase; the viewport comes from the project (`visual-1440x900`,
 * `visual-1280x800`, `visual-390x844`), so Playwright resolves a separate
 * baseline per viewport and a failure names the one that broke.
 *
 * Baselines are not committed until US7 — they would enshrine defects A1–A4.
 * Until then, run with `--update-snapshots` and compare by eye against the
 * figures. `pnpm test:visual --update-snapshots` is the only way to change one.
 */
const PHASES = [
  "landing",
  "lobby",
  "queue",
  "found",
  "match",
  "reveal",
  "final",
  "disconnect",
  "profile",
] as const;

test.describe("@visual the room, from fixtures", () => {
  for (const phase of PHASES) {
    test(`${phase} matches its baseline`, async ({ page }) => {
      await page.goto(`/dev/room?phase=${phase}`);

      // Application state, not font state: Playwright already awaits
      // document.fonts.ready before every screenshot.
      if (phase === "profile") await expect(page.getByTestId("profile-page")).toBeVisible();
      else await expect(page.getByTestId("field")).toBeVisible();

      await expect(page).toHaveScreenshot(`${phase}.png`);
    });
  }
});

test.describe("@visual the room renders without a database", () => {
  test("no request reaches Supabase", async ({ page }) => {
    const supabaseCalls: string[] = [];
    page.on("request", (request) => {
      if (/supabase|\/api\/match|\/api\/lobby/.test(request.url())) supabaseCalls.push(request.url());
    });

    await page.goto("/dev/room?phase=match");
    await expect(page.getByTestId("field")).toBeVisible();
    await expect(page.getByTestId("field").getByRole("gridcell")).toHaveCount(100);

    expect(supabaseCalls, "the fixture route must reach no backend").toEqual([]);
  });
});
