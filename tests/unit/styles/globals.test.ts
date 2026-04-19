import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalsCss = readFileSync(
  resolve(__dirname, "../../../app/globals.css"),
  "utf-8",
);

describe("globals.css token declarations", () => {
  test.each([
    ["--paper"],
    ["--paper-2"],
    ["--paper-3"],
    ["--ink"],
    ["--ink-2"],
    ["--ink-3"],
    ["--ink-soft"],
    ["--ochre"],
    ["--ochre-deep"],
    ["--ochre-tint"],
    ["--p1"],
    ["--p1-tint"],
    ["--p1-deep"],
    ["--p2"],
    ["--p2-tint"],
    ["--p2-deep"],
    ["--good"],
    ["--warn"],
    ["--bad"],
    ["--hair"],
    ["--hair-strong"],
    ["--shadow-sm"],
    ["--shadow-md"],
    ["--shadow-lg"],
  ])("declares %s", (token) => {
    expect(globalsCss).toMatch(new RegExp(`${token}\\s*:`));
  });

  test("uses light color-scheme", () => {
    expect(globalsCss).toMatch(/color-scheme:\s*light/);
  });

  test("sets body background to var(--paper)", () => {
    expect(globalsCss).toMatch(/background:\s*var\(--paper\)/);
  });
});
