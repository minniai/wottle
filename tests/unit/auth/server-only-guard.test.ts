import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("identity stays on the server (spec 067)", () => {
  it("should never import lib/auth from a client module", () => {
    const offenders = ROOTS.flatMap(sourceFiles).filter((file) => {
      const text = readFileSync(file, "utf8");
      return /^\s*["']use client["']/m.test(text) && /from ["']@\/lib\/auth\//.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
