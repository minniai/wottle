import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

// `from("matches")` then, before the statement ends, an insert or upsert.
const MATCH_INSERT = /from\(\s*["']matches["']\s*\)[^;]*?\.(insert|upsert)\(/s;

describe("one way to make a match (spec 067 SC-006)", () => {
  it("should create matches only through create_match_between", () => {
    const offenders = ROOTS.flatMap(sourceFiles).filter((file) => MATCH_INSERT.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
