import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * Spec 068 FR-024–FR-026 (owner decision, game flow §10 Q13): Orðusta and
 * Wottle are capitalised wherever the name is written. Identifiers, URLs,
 * cookie names and file names keep their lowercase spelling.
 */
const ROOT = resolve(__dirname, "../../..");

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? files(path, ext) : ext.test(name) ? [path] : [];
  });
}

const source = (path: string) => readFileSync(join(ROOT, path), "utf-8");
/** A displayed string: the lowercase name alone between quotes or backticks, or as a word in JSX text. */
const LOWERCASE_NAME = /["'`](wottle|orðusta)["'`]|>\s*(wottle|orðusta)\b/;

describe("the brand is capitalised (spec 068)", () => {
  it("the one source, the locale registry, spells Orðusta and Wottle, and the copy reads it", () => {
    expect(LOCALES.is.wordmark).toBe("Orðusta");
    expect(LOCALES.en.wordmark).toBe("Wottle");
    expect(copyIs.WORDMARK).toBe("Orðusta");
    expect(copyEn.WORDMARK).toBe("Wottle");
    expect(copyEn.rulesMetaTitle(copyEn.WORDMARK)).toBe("how to play · Wottle");
  });

  it("no copy file, page, metadata builder or rules text writes the name in lowercase", () => {
    const displayed = [...files("lib/i18n", /\.tsx?$/), ...files("app/[locale]", /\.tsx?$/), ...files("components", /\.tsx$/)];
    const offenders = displayed.filter((path) => LOWERCASE_NAME.test(source(path)));
    expect(offenders).toEqual([]);
  });

  it("no stylesheet lowercases a wordmark", () => {
    for (const path of ["app/styles/room.css", "app/styles/rules.css"]) {
      const rules = source(path).replace(/\/\*[\s\S]*?\*\//g, "");
      const wordmarks = [...rules.matchAll(/([^{}]*wordmark[^{}]*)\{([^}]*)\}/g)];
      for (const [, selector, body] of wordmarks) expect(body, `${path} ${selector.trim()}`).not.toMatch(/text-transform:\s*lowercase/);
    }
  });
});
