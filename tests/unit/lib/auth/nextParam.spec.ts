import { describe, expect, it } from "vitest";

import { nextParam } from "@/lib/auth/nextParam";

/** Spec 070 FR-004, game flow §7.5 invariant 12: only a same-origin path to a known page survives. */
describe("nextParam", () => {
  it.each([
    ["/", "/"],
    ["/rules", "/rules"],
    ["/en/rules", "/en/rules"],
    ["/profile", "/profile"],
    ["/profile/k%C3%A1ri", "/profile/k%C3%A1ri"],
    ["/en/profile/embla", "/en/profile/embla"],
    ["/match/5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11", "/match/5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11"],
    ["/en/match/5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11?review=last", "/en/match/5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11?review=last"],
  ])("keeps %s", (raw, kept) => {
    expect(nextParam(raw)).toBe(kept);
  });

  it.each([null, "", "//evil.example", "https://evil.example/", "javascript:alert(1)", "/\\evil.example", "/unknown", "/match/not-a-uuid", "rules", "/en/../rules", "/lobby"])(
    "drops %s",
    (raw) => {
      expect(nextParam(raw)).toBeNull();
    },
  );
});
