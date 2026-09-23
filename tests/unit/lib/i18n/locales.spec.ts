import { describe, expect, test } from "vitest";

import {
  DEFAULT_LOCALE,
  LOCALES,
  createLocaleRegistry,
  isLandingPath,
  isLocale,
  localeForLanguage,
  localePath,
  switchLocalePath,
} from "@/lib/i18n/locales";

describe("locale registry", () => {
  test("Icelandic is the default and has no path segment", () => {
    expect(DEFAULT_LOCALE).toBe("is");
    expect(LOCALES.is).toMatchObject({ segment: "", htmlLang: "is", language: "is", wordmark: "Orðusta" });
  });

  test("English lives under /en and is called Wottle", () => {
    expect(LOCALES.en).toMatchObject({ segment: "en", htmlLang: "en", language: "en", wordmark: "Wottle" });
  });

  test("isLocale accepts registered ids only", () => {
    expect(isLocale("is")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("dk")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  test("localeForLanguage maps a game language back to its locale", () => {
    expect(localeForLanguage("is")).toBe("is");
    expect(localeForLanguage("en")).toBe("en");
  });
});

describe("localePath", () => {
  test("leaves Icelandic paths unprefixed", () => {
    expect(localePath("is", "/lobby")).toBe("/lobby");
    expect(localePath("is", "/")).toBe("/");
  });

  test("prefixes English paths with /en", () => {
    expect(localePath("en", "/lobby")).toBe("/en/lobby");
    expect(localePath("en", "/match/abc?x=1")).toBe("/en/match/abc?x=1");
    expect(localePath("en", "/")).toBe("/en");
  });

  test("rejects a path without a leading slash", () => {
    expect(() => localePath("en", "lobby")).toThrow();
  });
});

describe("switchLocalePath", () => {
  test("moves a path between locales", () => {
    expect(switchLocalePath("/en/lobby", "en", "is")).toBe("/lobby");
    expect(switchLocalePath("/lobby", "is", "en")).toBe("/en/lobby");
    expect(switchLocalePath("/en", "en", "is")).toBe("/");
    expect(switchLocalePath("/", "is", "en")).toBe("/en");
  });
});

describe("isLandingPath", () => {
  test("is true for each locale's root only", () => {
    expect(isLandingPath("/", "is")).toBe(true);
    expect(isLandingPath("/en", "en")).toBe(true);
    expect(isLandingPath("/en/", "en")).toBe(true);
    expect(isLandingPath("/lobby", "is")).toBe(false);
    expect(isLandingPath("/en/lobby", "en")).toBe(false);
  });
});

describe("a third language is data only (SC-007)", () => {
  test("a stub Danish entry routes under /dk and declares da", () => {
    const registry = createLocaleRegistry({
      ...LOCALES,
      dk: { id: "dk", segment: "dk", htmlLang: "da", language: "dk", wordmark: "wottle", switchTo: "is" },
    });
    expect(registry.isLocale("dk")).toBe(true);
    expect(registry.localePath("dk", "/lobby")).toBe("/dk/lobby");
    expect(registry.get("dk").htmlLang).toBe("da");
    expect(registry.localeForLanguage("dk")).toBe("dk");
  });
});
