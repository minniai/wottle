import { describe, expect, it } from "vitest";

import { profileView } from "@/app/[locale]/dev/page/fixtures";

/**
 * Spec 072 FR-041 (T059, T069): a profile never carries a last-seen time, a
 * status or an avatar. The keys a `ProfileView` may hold are pinned here; a new
 * field is a decision, made in this list.
 */
const ALLOWED = [
  "bestWords", "chart", "chartEmpty", "displayName", "firstPlayedAt", "handle", "language", "lastTen", "matches", "matchesList",
  "otherLanguage", "peak", "playerId", "presence", "rating", "record", "weekChange",
].sort();

describe("ProfileView", () => {
  it("holds only the allowed keys", () => {
    expect(Object.keys(profileView("en")).sort()).toEqual(ALLOWED);
  });

  it("names no last-seen time anywhere in it", () => {
    expect(JSON.stringify(profileView("is"))).not.toMatch(/last_?seen|avatar|"status"/i);
  });
});
