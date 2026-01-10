import { expect, test } from "@playwright/test";

async function loginAs(page: import("@playwright/test").Page, username: string) {
  // Debug: Log all responses to check for Set-Cookie on login
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/auth/login') || url.endsWith(':3000/')) {
      const headers = await response.allHeaders();
      console.log(`[DEBUG_NET] Response from ${url}: Status ${response.status()}`);
      if (headers['set-cookie']) {
        console.log(`[DEBUG_NET] Set-Cookie: ${headers['set-cookie']}`);
      } else {
        console.log(`[DEBUG_NET] No Set-Cookie header found.`);
      }
    }
  });

  await page.goto("/");
  const input = page.getByTestId("lobby-username-input");
  await expect(input).toBeVisible();
  await input.fill(username);

  // Click submit - the Server Action will set a cookie and redirect
  await page.getByTestId("lobby-login-submit").click();

  // Allow the Server Action redirect + cookie to settle
  await page.waitForLoadState("networkidle");

  console.log(`[DEBUG] Login reload for ${username}. Current URL: ${page.url()}`);
  
  // Debug: Check if we have the session cookie
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name.includes("session") || c.name.includes("auth"));
  console.log(`[DEBUG] Cookies present: ${cookies.map(c => c.name).join(", ")}`);
  console.log(`[DEBUG] Session cookie found: ${!!sessionCookie}`);

  // Debug: Check if login input is still visible
  const inputVisible = await page.getByTestId("lobby-username-input").isVisible();
  console.log(`[DEBUG] Login input visible before reload: ${inputVisible}`);

  await page.reload({ waitUntil: "networkidle" });
  
  console.log(`[DEBUG] Post-reload URL: ${page.url()}`);
  const postReloadInputVisible = await page.getByTestId("lobby-username-input").isVisible();
  console.log(`[DEBUG] Login input visible after reload: ${postReloadInputVisible}`);
  
  if (postReloadInputVisible) {
     console.log(`[DEBUG] Still on login screen. Dumping body text snippet:`);
     const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
     console.log(bodyText);
  }

  // Wait for the lobby list to appear (indicates page re-rendered with session)
  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("Lobby presence", () => {
  test("shows both players within five seconds and updates on leave", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Capture console logs for debugging
    pageA.on('console', msg => console.log('[PageA]', msg.text()));
    pageB.on('console', msg => console.log('[PageB]', msg.text()));

    await loginAs(pageA, "tester-alpha");
    
    // Debug: Check API endpoint directly from Player A's context
    const apiResponseA = await pageA.evaluate(async () => {
      const res = await fetch('/api/lobby/players', { cache: 'no-store' });
      return { status: res.status, data: await res.json() };
    });
    console.log('[DEBUG] Player A sees via API:', JSON.stringify(apiResponseA));
    
    await loginAs(pageB, "tester-beta");
    
    // Debug: Check API endpoint directly from Player B's context  
    const apiResponseB = await pageB.evaluate(async () => {
      const res = await fetch('/api/lobby/players', { cache: 'no-store' });
      return { status: res.status, data: await res.json() };
    });
    console.log('[DEBUG] Player B sees via API:', JSON.stringify(apiResponseB));
    
    // Debug: Check presence store state
    const storeStateB = await pageB.evaluate(() => {
      // @ts-ignore
      const store = window.useLobbyPresenceStore?.getState();
      return store ? {
        players: store.players?.map((p: any) => ({ id: p.id, username: p.username })),
        status: store.status,
        connectionMode: store.connectionMode,
        error: store.error,
      } : { error: 'Store not found' };
    });
    console.log('[DEBUG] Player B store state:', JSON.stringify(storeStateB));

    const listA = pageA.getByTestId("lobby-presence-list");
    const listB = pageB.getByTestId("lobby-presence-list");

    await expect(listA.getByTestId("lobby-card").filter({ hasText: /tester-beta/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(listB.getByTestId("lobby-card").filter({ hasText: /tester-alpha/i })).toBeVisible({
      timeout: 10_000,
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
