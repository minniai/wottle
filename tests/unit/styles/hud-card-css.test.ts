import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardCss = readFileSync(
  resolve(__dirname, "../../../app/styles/board.css"),
  "utf-8",
);

describe(".hud-card CSS", () => {
  test("declares .hud-card with paper background and hair border", () => {
    const block = boardCss.match(/\.hud-card\s*\{[^}]*\}/s);
    expect(block).not.toBeNull();
    expect(block?.[0]).toMatch(/background:\s*var\(--paper\)/);
    expect(block?.[0]).toMatch(/border:\s*1px solid var\(--hair\)/);
  });

  test("declares .hud-card--you::after stripe using var(--p1)", () => {
    expect(boardCss).toMatch(
      /\.hud-card--you::after\s*\{[^}]*background:\s*var\(--p1\)/s,
    );
  });

  test("declares .hud-card--opp::after stripe using var(--p2)", () => {
    expect(boardCss).toMatch(
      /\.hud-card--opp::after\s*\{[^}]*background:\s*var\(--p2\)/s,
    );
  });

  test("declares .hud-card__score with font-display italic", () => {
    const block = boardCss.match(/\.hud-card__score\s*\{[^}]*\}/s);
    expect(block).not.toBeNull();
    expect(block?.[0]).toMatch(/font-family:\s*var\(--font-fraunces\)/);
    expect(block?.[0]).toMatch(/font-style:\s*italic/);
  });

  test("declares .hud-card__clock with mono font + tabular-nums", () => {
    const block = boardCss.match(/\.hud-card__clock\s*\{[^}]*\}/s);
    expect(block).not.toBeNull();
    expect(block?.[0]).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
