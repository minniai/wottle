import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../../app/styles/room.css"), "utf-8");

/** Design system §6 — geometry never animates; only transform and opacity do. */
describe("room.css motion (design system §6)", () => {
  const keyframes = [...css.matchAll(/@keyframes\s+([a-z-]+)\s*{([\s\S]*?)}\s*}/g)];

  it("declares the room's keyframes", () => {
    const names = keyframes.map((m) => m[1]);
    for (const k of ["field-shake", "band-draw", "count-up", "lane-blink", "lane-search", "letter-land", "pin-fade"]) expect(names).toContain(k);
  });

  it("every keyframe animates only transform and opacity", () => {
    for (const [, name, body] of keyframes) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => !/^\d|%|from|to$/.test(p));
      for (const p of props) expect(["transform", "opacity"], `${name} animates ${p}`).toContain(p);
    }
  });

  it("reduced motion zeroes durations and holds the low lane solid", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0ms !important/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*\.player-bar__lane--low \.player-bar__lane-fill[\s\S]*animation: none/);
  });

  it("no radii, shadows or gradients", () => {
    expect(css).not.toMatch(/border-radius:\s+(?!0\b)/);
    expect(css).not.toMatch(/box-shadow:\s+(?!inset 0 0 0 2px var\(--ink\)|none)/);
    expect(css).not.toContain("gradient");
  });
});
