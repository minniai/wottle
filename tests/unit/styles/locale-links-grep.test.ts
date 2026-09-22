import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Spec 060 FR-003: every internal link, redirect and address rewrite keeps the
 * page's language prefix, so none of them may be written as a bare path. Build
 * paths with `localePath` / `useLocalePath` instead. API routes are unprefixed
 * and stay out of scope.
 */
const ROOT = resolve(__dirname, "../../..");
const SCOPE = ["app/[locale]", "components", "lib/room"];
const BARE_PATH =
  /href=["{`]+\/|(?:profileHref|href):\s*["`]\/|(?:push|replace|redirect|signOut)\(\s*["`]\/|replaceState\([^,]*,[^,]*,\s*["`]\//;
const PAGE_PATH = /\/(?:lobby|matchmaking|match|profile|rules)\b|["`]\/["`?]/;

function files(path: string): string[] {
  const abs = join(ROOT, path);
  if (!statSync(abs, { throwIfNoEntry: false })) return [];
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(path, e.name)) : /\.tsx?$/.test(e.name) ? [join(abs, e.name)] : [],
  );
}

describe("locale links grep (spec 060 FR-003)", () => {
  test("no bare internal path in pages, components or room logic", () => {
    const offenders = SCOPE.flatMap(files).flatMap((file) =>
      readFileSync(file, "utf-8")
        .split("\n")
        .map((line, i) => ({ line, at: `${relative(ROOT, file)}:${i + 1}` }))
        .filter(({ line }) => BARE_PATH.test(line) && PAGE_PATH.test(line) && !line.includes("/api/"))
        .map(({ at, line }) => `${at}  ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
