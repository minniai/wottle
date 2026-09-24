/**
 * Spec 072 — invite links, end to end (T041, T048, T056). A link is made and
 * copied from the lobby; a friend with no account accepts it from the invite
 * door and both sit at the table; a signed-in friend accepts it from the line
 * slot; a link works once; the friend may leave a table the sender never came
 * to, at no cost. Tagged @two-player-playtest so CI runs it alone.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip } from "./helpers/matchmaking";

const GUARD_MS = 600;
const MATCH_URL = /\/match\/[0-9a-f-]{36}/;

/** `invite a friend ▸`, then the link as this browser kept it (the clipboard may be refused in a test browser). */
async function makeLink(page: Page): Promise<string> {
  await page.getByTestId("lobby-invite").first().click();
  await expect(page.getByTestId("line-slot-line1").first()).toContainText(/Link (copied|ready) · valid/, { timeout: 20_000 });
  const url = await page.evaluate(() => JSON.parse(localStorage.getItem("wottle-link") ?? "{}").url as string | undefined);
  expect(url).toMatch(/\/en\/c\/[A-Za-z0-9_-]{43}$/);
  return url!;
}

async function hideTab(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

async function twoContexts(browser: Browser) {
  const [contextA, contextB] = [await browser.newContext(), await browser.newContext()];
  return { contextA, contextB, pageA: await contextA.newPage(), pageB: await contextB.newPage() };
}

test.describe("Invite links", () => {
  test("a friend with no account accepts from the invite door; both sit at the table; the link works once @two-player-playtest", async ({ browser }) => {
    test.setTimeout(150_000);
    const { contextA, contextB, pageA, pageB } = await twoContexts(browser);
    try {
      const userA = generateTestUsername("link-a");
      await loginViaSlip(pageA, userA);
      const url = await makeLink(pageA);

      // Opening the link wrote nothing: A's slot still shows it.
      await pageB.goto(url);
      await expect(pageB.getByTestId("invite-band")).toContainText("challenges you");
      await pageB.getByTestId("door-name").fill(generateTestUsername("link-b"));
      await pageB.waitForTimeout(GUARD_MS);
      await pageB.getByTestId("invite-accept").click();

      for (const p of [pageA, pageB]) await expect(p).toHaveURL(MATCH_URL, { timeout: 30_000 });
      expect(pageA.url().split("/match/")[1]).toBe(pageB.url().split("/match/")[1]);

      // A third browser finds the link used; B, now in the match, would be sent to it.
      const contextC = await browser.newContext();
      const pageC = await contextC.newPage();
      await pageC.goto(url);
      await expect(pageC.getByTestId("invite-band")).toHaveText("this link has expired");
      await contextC.close();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("a taken name is refused and the link stays usable @two-player-playtest", async ({ browser }) => {
    test.setTimeout(120_000);
    const { contextA, contextB, pageA, pageB } = await twoContexts(browser);
    try {
      const userA = generateTestUsername("link-taken");
      await loginViaSlip(pageA, userA);
      const url = await makeLink(pageA);
      await pageB.goto(url);
      await pageB.getByTestId("door-name").fill(userA);
      await pageB.waitForTimeout(GUARD_MS);
      await pageB.getByTestId("invite-accept").click();
      await expect(pageB.getByTestId("door-error")).toHaveText("that name is taken · pick another", { timeout: 20_000 });
      await pageB.reload();
      await expect(pageB.getByTestId("invite-band")).toContainText("challenges you");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("a signed-in friend accepts from the line slot; the sender sees their own link @two-player-playtest", async ({ browser }) => {
    test.setTimeout(150_000);
    const { contextA, contextB, pageA, pageB } = await twoContexts(browser);
    try {
      await loginViaSlip(pageA, generateTestUsername("slot-a"));
      await loginViaSlip(pageB, generateTestUsername("slot-b"));
      const url = await makeLink(pageA);

      await pageA.goto(url);
      await expect(pageA).toHaveURL(/\/en\/?$/, { timeout: 20_000 });
      await expect(pageA.getByTestId("line-slot-line1").first()).toHaveText("this is your link");

      await pageB.goto(url);
      await expect(pageB).toHaveURL(/\/en\/?$/, { timeout: 20_000 });
      const accept = pageB.locator("[data-testid=slot-acceptLink]:visible").first();
      await expect(accept).toBeVisible({ timeout: 20_000 });
      await pageB.waitForTimeout(GUARD_MS);
      await accept.click();
      for (const p of [pageA, pageB]) await expect(p).toHaveURL(MATCH_URL, { timeout: 30_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("an Icelandic link opened under /en goes to its own locale @two-player-playtest", async ({ browser }) => {
    test.setTimeout(90_000);
    const { contextA, contextB, pageA, pageB } = await twoContexts(browser);
    try {
      await loginViaSlip(pageA, generateTestUsername("is-link"));
      const url = await makeLink(pageA);
      // The sender's lobby is English here; open its path under the bare (Icelandic) prefix.
      await pageB.goto(url.replace("/en/c/", "/c/"));
      await expect(pageB).toHaveURL(/\/en\/c\//, { timeout: 20_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("the table waits for an absent sender; the friend may leave it at no cost @two-player-playtest", async ({ browser }) => {
    test.setTimeout(150_000);
    const { contextA, contextB, pageA, pageB } = await twoContexts(browser);
    try {
      await loginViaSlip(pageA, generateTestUsername("wait-a"));
      const url = await makeLink(pageA);
      await hideTab(pageA);
      await pageA.waitForTimeout(3_500);

      await loginViaSlip(pageB, generateTestUsername("wait-b"));
      await pageB.goto(url);
      await pageB.waitForTimeout(GUARD_MS);
      await pageB.locator("[data-testid=slot-acceptLink]:visible").first().click();
      await expect(pageB).toHaveURL(MATCH_URL, { timeout: 30_000 });
      await expect(pageB.getByTestId("slip-table-label")).toContainText(/the table waits · \d:\d\d/, { timeout: 20_000 });

      // A was pushed to the table too, hidden.
      await expect(pageA).toHaveURL(MATCH_URL, { timeout: 30_000 });

      await pageB.getByTestId("slip-leave-table").click();
      await expect(pageB).toHaveURL(/\/en\/?$/, { timeout: 20_000 });
      // No table-leave cooldown: find is offered, not `find again in …`.
      await expect(pageB.getByTestId("lobby-find")).toBeVisible();
      await expect(pageB.getByText(/find again in/)).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
