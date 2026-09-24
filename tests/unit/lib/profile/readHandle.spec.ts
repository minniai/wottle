import { describe, expect, it } from "vitest";

import { profileHandlePath, readHandle } from "@/lib/profile/readHandle";

/** Spec 072 T077 (FR-047): a handle in a URL, encoded or not, names one player. */
describe("handles", () => {
  it("reads encoded, unencoded and decomposed forms alike", () => {
    const composed = "kári";
    expect(readHandle("k%C3%A1ri")).toBe(composed);
    expect(readHandle("kári")).toBe(composed);
    expect(readHandle("kári")).toBe(composed);
    expect(readHandle("ka%CC%81ri")).toBe(composed);
  });

  it("does not decode twice", () => {
    expect(readHandle("k%25C3%25A1ri")).toBe("k%C3%A1ri");
  });

  it("keeps a malformed escape for validation to refuse", () => {
    expect(readHandle("%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("builds a profile path with the handle percent-encoded", () => {
    expect(profileHandlePath("kári")).toBe("/profile/k%C3%A1ri");
    expect(profileHandlePath("kári")).toBe("/profile/k%C3%A1ri");
    expect(profileHandlePath("embla")).toBe("/profile/embla");
  });
});
