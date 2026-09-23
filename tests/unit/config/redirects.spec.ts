import { describe, expect, it } from "vitest";

import config from "../../../next.config";

/** Spec 070 FR-001: the door and the lobby are one URL per locale; the old ones are permanent redirects (308). */
describe("next.config redirects", () => {
  it("sends /lobby and /en/lobby to the lobby's own URL, permanently", async () => {
    const redirects = await config.redirects!();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/lobby", destination: "/", permanent: true },
        { source: "/en/lobby", destination: "/en", permanent: true },
      ]),
    );
  });
});
