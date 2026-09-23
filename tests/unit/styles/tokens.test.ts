import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf-8");
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));

/** Design system §2 — the only colours that may appear on screen: nine since spec 068. */
const NINE: Record<string, string> = {
  "--paper": "#FFFDF7",
  "--ink": "#0F1A24",
  "--rule": "#E6E2D6",
  "--tint": "#F4F1E8",
  "--muted": "#5A6572",
  "--you": "#147D7A",
  /**
   * Spec 068 (23 September 2026): burnished terracotta, OKLCH 0.60 0.10 40 —
   * quieter than coral, an earth pair with teal, never mistaken for an error.
   */
  "--opp": "#B56A4F",
  /** The opponent's text below 17px: same hue, darker (5.2:1 on paper). */
  "--opp-text": "#A1583D",
  /** Spec 068: crimson, points lost and nothing else (OKLCH 0.49 0.18 16). */
  "--err": "#AD1F3D",
};

const DERIVED = ["--you-band", "--you-live", "--opp-band", "--opp-live", "--future-label", "--font-board", "--font-mono"];

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

describe("globals.css — Field & Ledger tokens (design system §2)", () => {
  const decls = declarations(rootBlock);

  test.each(Object.entries(NINE))("declares %s as %s", (token, hex) => {
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

  test("no raw colour outside the nine tokens: every other declaration resolves to a token", () => {
    const allowed = new Set([...Object.keys(NINE), ...DERIVED]);
    for (const [name, value] of decls) {
      if (allowed.has(name)) continue;
      expect(value, `${name} must alias a token, not declare a colour`).toMatch(
        /^(var\(--[a-z0-9-]+\)|color-mix\(in srgb, var\(--[a-z]+\) \d+%, transparent\)|none|0)$/,
      );
    }
  });

  test("no retired token families, shadows, gradients or third-hue names remain", () => {
    // Case-insensitive: the aliases were declared --font-fraunces and
    // --font-jetbrains-mono, which a case-sensitive check sailed past for a
    // whole feature (spec 045 D1, research §8).
    for (const banned of ["oklch(", "--shadow-", "gradient", "--clock-warn", "inter", "fraunces", "jetbrains", "--ochre", "--p1", "--p2", "--good", "--warn", "--bad", "--hair", "--paper-2", "--paper-3", "--ink-2", "--ink-3", "--ink-soft"]) {
      expect(css.toLowerCase(), `${banned} is retired`).not.toContain(banned);
    }
  });

  test("the :root set is exactly the palette — no alias may be kept alive here", () => {
    const declared = [...decls.keys()].sort();
    const expected = [...Object.keys(NINE), ...DERIVED].sort();
    expect(declared).toEqual(expected);
  });

  test("light colour scheme and paper body", () => {
    expect(css).toMatch(/color-scheme:\s*light/);
    expect(css).toMatch(/body\s*{[^}]*background:\s*var\(--paper\)/);
    expect(css).toMatch(/border-radius:\s*0/);
  });
});

/** WCAG 2.1 relative luminance and contrast, for the floors below. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("seat colour contrast on paper (design system §2)", () => {
  test("each seat colour clears 3:1 for fills, lanes and large totals", () => {
    expect(contrast(NINE["--you"], NINE["--paper"])).toBeGreaterThanOrEqual(3);
    expect(contrast(NINE["--opp"], NINE["--paper"])).toBeGreaterThanOrEqual(3);
  });
  test("points lost, crimson, clears 4.5:1 as small text and stays apart from the opponent's colour", () => {
    expect(contrast(NINE["--err"], NINE["--paper"])).toBeGreaterThanOrEqual(4.5);
    expect(NINE["--err"]).not.toBe(NINE["--opp"]);
    expect(NINE["--err"]).not.toBe(NINE["--opp-text"]);
  });
  test("seat colour as small text clears 4.5:1", () => {
    expect(contrast(NINE["--you"], NINE["--paper"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(NINE["--opp-text"], NINE["--paper"])).toBeGreaterThanOrEqual(4.5);
  });
});
