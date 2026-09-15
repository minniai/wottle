import { describe, expect, test } from "vitest";

import config from "../../../tailwind.config";

const theme = config.theme?.extend as {
  colors: Record<string, string | Record<string, string>>;
  fontFamily: Record<string, string[]>;
  borderRadius: Record<string, string>;
  boxShadow?: unknown;
};

const TOKEN_REF = /^var\(--(paper|ink|rule|tint|muted|you|opp|opp-text|you-band|you-live|opp-band|opp-live|future-label)\)$/;

function flatten(colors: Record<string, string | Record<string, string>>): Array<[string, string]> {
  return Object.entries(colors).flatMap(([k, v]) =>
    typeof v === "string" ? [[k, v] as [string, string]] : Object.entries(v).map(([kk, vv]) => [`${k}.${kk}`, vv] as [string, string]),
  );
}

describe("tailwind.config.ts — Field & Ledger theme", () => {
  test("declares the seven tokens as CSS variable references", () => {
    for (const key of ["paper", "ink", "rule", "tint", "muted", "you", "opp"]) {
      const value = theme.colors[key];
      const ref = typeof value === "string" ? value : value.DEFAULT;
      expect(ref).toBe(`var(--${key})`);
    }
  });

  test("every colour utility resolves to one of the tokens (legacy aliases included)", () => {
    for (const [name, value] of flatten(theme.colors)) {
      expect(value, name).toMatch(TOKEN_REF);
    }
  });

  test("two type families only", () => {
    expect(theme.fontFamily.board[0]).toBe("var(--font-board)");
    expect(theme.fontFamily.mono[0]).toBe("var(--font-mono)");
    for (const [name, stack] of Object.entries(theme.fontFamily)) {
      expect(stack[0], name).toMatch(/^var\(--font-(board|mono)\)$/);
    }
  });

  test("no radii and no shadows", () => {
    expect(theme.borderRadius).toEqual({ DEFAULT: "0", none: "0" });
    expect(theme.boxShadow).toBeUndefined();
  });
});
