import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf-8");
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));

/** Design system §2 — the only colours that may appear on screen. */
const SEVEN: Record<string, string> = {
  "--paper": "#FFFDF7",
  "--ink": "#0F1A24",
  "--rule": "#E6E2D6",
  "--tint": "#F4F1E8",
  "--muted": "#5A6572",
  "--you": "#147D7A",
  "--opp": "#E4573D",
};

const DERIVED = ["--you-band", "--you-live", "--opp-band", "--opp-live", "--future-label", "--font-board", "--font-mono"];

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

describe("globals.css — Field & Ledger tokens (design system §2)", () => {
  const decls = declarations(rootBlock);

  test.each(Object.entries(SEVEN))("declares %s as %s", (token, hex) => {
    expect(decls.get(token)?.toUpperCase()).toBe(hex);
  });

  test.each(DERIVED)("declares %s", (token) => {
    expect(decls.has(token)).toBe(true);
  });

  test("seat alphas are 14% (band) and 30% (live) of the seat colour", () => {
    expect(decls.get("--you-band")).toMatch(/var\(--you\)\s+14%/);
    expect(decls.get("--opp-band")).toMatch(/var\(--opp\)\s+14%/);
    expect(decls.get("--you-live")).toMatch(/var\(--you\)\s+30%/);
    expect(decls.get("--opp-live")).toMatch(/var\(--opp\)\s+30%/);
  });

  test("future-row label grey is the single exception", () => {
    expect(decls.get("--future-label")?.toUpperCase()).toBe("#B9B4A6");
  });

  test("no raw colour outside the seven tokens: every other declaration resolves to a token", () => {
    const allowed = new Set([...Object.keys(SEVEN), ...DERIVED]);
    for (const [name, value] of decls) {
      if (allowed.has(name)) continue;
      expect(value, `${name} must alias a token, not declare a colour`).toMatch(
        /^(var\(--[a-z0-9-]+\)|color-mix\(in srgb, var\(--[a-z]+\) \d+%, transparent\)|none|0)$/,
      );
    }
  });

  test("no retired token families, shadows, gradients or third-hue names remain", () => {
    for (const banned of ["oklch(", "--shadow-", "gradient", "--clock-warn", "Inter", "Fraunces", "JetBrains"]) {
      expect(css).not.toContain(banned);
    }
  });

  test("light colour scheme and paper body", () => {
    expect(css).toMatch(/color-scheme:\s*light/);
    expect(css).toMatch(/body\s*{[^}]*background:\s*var\(--paper\)/);
    expect(css).toMatch(/border-radius:\s*0/);
  });
});
