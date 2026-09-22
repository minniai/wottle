import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const layoutSource = readFileSync(resolve(__dirname, "../../../app/[locale]/layout.tsx"), "utf-8");

describe("app/layout.tsx font wiring (design system §3)", () => {
  test("imports Zilla_Slab and Red_Hat_Mono from next/font/google", () => {
    expect(layoutSource).toMatch(/import\s*\{[^}]*Red_Hat_Mono[^}]*\}\s*from\s*"next\/font\/google"/);
    expect(layoutSource).toMatch(/import\s*\{[^}]*Zilla_Slab[^}]*\}\s*from\s*"next\/font\/google"/);
  });

  test("loads the weights the system uses, latin + latin-ext", () => {
    expect(layoutSource).toMatch(/weight:\s*\["500",\s*"600",\s*"700"\]/);
    expect(layoutSource).toMatch(/weight:\s*\["400",\s*"500",\s*"600"\]/);
    expect(layoutSource.match(/subsets:\s*\["latin",\s*"latin-ext"\]/g)).toHaveLength(2);
  });

  test("exposes the font variables that --font-board / --font-mono read", () => {
    expect(layoutSource).toMatch(/variable:\s*"--font-zilla-slab"/);
    expect(layoutSource).toMatch(/variable:\s*"--font-red-hat-mono"/);
    expect(layoutSource).toMatch(/className=\{`\$\{zillaSlab\.variable\}[^`]*\$\{redHatMono\.variable\}`\}/);
  });

  test("retired fonts are gone", () => {
    for (const banned of ["Fraunces", "JetBrains", "Inter"]) expect(layoutSource).not.toContain(banned);
  });

  test("imports the room stylesheet", () => {
    expect(layoutSource).toMatch(/import\s*"\.\.\/styles\/room\.css"/);
  });
});
