import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 068 FR-022: crimson marks points lost and nothing else. It has exactly
 * one door — the `.points-lost` rule, applied only by `PointsLost` — so a seat,
 * a rating change, urgency, a frame, focus or a control can never take it.
 */
const ROOT = resolve(__dirname, "../../..");

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? files(path, ext) : ext.test(name) ? [path] : [];
  });
}

const source = (path: string) => readFileSync(join(ROOT, path), "utf-8");
const code = [...files("app", /\.(tsx?|css)$/), ...files("components", /\.tsx?$/), ...files("lib", /\.tsx?$/)];

describe("--err has one door (spec 068 FR-022)", () => {
  it("var(--err) appears only in the .points-lost rule (the token is declared in globals.css)", () => {
    const uses = code.flatMap((path) => [...source(path).matchAll(/var\(--err\)/g)].map(() => path));
    expect(uses).toEqual(["app/styles/room.css"]);
    const css = source("app/styles/room.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...css.matchAll(/([^{}]+)\{[^}]*var\(--err\)[^}]*\}/g)].map((m) => m[1].trim());
    expect(rules).toEqual([".points-lost"]);
  });

  it("no Tailwind err utility and no raw crimson anywhere in the code", () => {
    for (const path of code) {
      const text = source(path);
      expect(text, path).not.toMatch(/\b(text|bg|border|outline|ring)-err\b/);
      if (path !== "app/globals.css") expect(text.toUpperCase(), path).not.toContain("AD1F3D");
    }
  });

  it("the points-lost class is applied only by PointsLost", () => {
    const appliers = code.filter((path) => path.endsWith(".tsx") && source(path).includes("points-lost"));
    expect(appliers).toEqual(["components/room/PointsLost.tsx"]);
  });
});
