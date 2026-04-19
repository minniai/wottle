import { describe, expect, test } from "vitest";
import config from "../../../tailwind.config";

const colors = config.theme?.extend?.colors as Record<
  string,
  string | Record<string, string>
>;

describe("tailwind token extension — new Warm Editorial families", () => {
  test("paper scale is declared", () => {
    expect(colors.paper).toEqual({
      DEFAULT: "oklch(0.975 0.012 85)",
      2: "oklch(0.955 0.014 82)",
      3: "oklch(0.925 0.016 80)",
    });
  });

  test("ink scale is declared", () => {
    expect(colors.ink).toMatchObject({
      DEFAULT: "oklch(0.22 0.025 258)",
      2: "oklch(0.29 0.027 258)",
      3: "oklch(0.38 0.024 258)",
      soft: "oklch(0.52 0.020 258)",
    });
  });

  test("ochre family is declared", () => {
    expect(colors.ochre).toMatchObject({
      DEFAULT: "oklch(0.72 0.13 70)",
      deep: "oklch(0.58 0.14 60)",
      tint: "oklch(0.93 0.045 80)",
    });
  });

  test("player families p1 and p2 declared", () => {
    expect(colors.p1).toMatchObject({
      DEFAULT: "oklch(0.68 0.14 60)",
      tint: "oklch(0.92 0.06 70)",
      deep: "oklch(0.48 0.14 55)",
    });
    expect(colors.p2).toMatchObject({
      DEFAULT: "oklch(0.56 0.08 220)",
      tint: "oklch(0.92 0.035 220)",
      deep: "oklch(0.38 0.08 220)",
    });
  });

  test("hair line colours declared", () => {
    expect(colors.hair).toMatchObject({
      DEFAULT: "color-mix(in oklab, oklch(0.22 0.025 258) 14%, transparent)",
      strong: "color-mix(in oklab, oklch(0.22 0.025 258) 22%, transparent)",
    });
  });

  test("legacy surface alias resolves to paper scale", () => {
    expect(colors.surface).toMatchObject({
      0: "oklch(0.975 0.012 85)",
      1: "oklch(0.955 0.014 82)",
      2: "oklch(0.925 0.016 80)",
    });
  });

  test("legacy text alias resolves to ink scale", () => {
    expect(colors.text).toMatchObject({
      primary: "oklch(0.22 0.025 258)",
      secondary: "oklch(0.38 0.024 258)",
      muted: "oklch(0.52 0.020 258)",
      inverse: "oklch(0.975 0.012 85)",
    });
  });

  test("mono font family added", () => {
    const fontFamily = config.theme?.extend?.fontFamily as Record<string, string[]>;
    expect(fontFamily.mono).toEqual([
      "var(--font-jetbrains-mono)",
      "JetBrains Mono",
      "ui-monospace",
      "monospace",
    ]);
  });
});
