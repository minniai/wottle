import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { RoundRail } from "@/components/room/RoundRail";

const css = readFileSync(resolve(__dirname, "../../../../app/styles/room.css"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
const block = (selector: string) => css.match(new RegExp(`${selector.replace(/[.[\]"=]/g, "\\$&")} \\{[^}]*\\}`))?.[0] ?? "";

describe("RoundRail (spec 048 US3)", () => {
  it("is one image with one name; ten hidden numerals with states", () => {
    render(<RoundRail currentRound={4} completed={false} />);
    const rail = screen.getByTestId("round-rail");
    expect(rail).toHaveAttribute("role", "img");
    expect(rail).toHaveAttribute("aria-label", "round 4 of 10");
    const cells = rail.querySelectorAll(".rail__cell");
    expect(cells).toHaveLength(10);
    expect(Array.from(cells).map((c) => c.textContent)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(Array.from(cells).map((c) => c.getAttribute("data-state"))).toEqual(["past", "past", "past", "current", ...Array(6).fill("future")]);
    expect(Array.from(cells).every((c) => c.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("all past when the match is complete", () => {
    render(<RoundRail currentRound={10} completed />);
    expect(screen.getByTestId("round-rail").querySelectorAll('[data-state="past"]')).toHaveLength(10);
  });

  it("draws past as ink, current as tint with a 2px ink frame, future outlined, with no motion", () => {
    expect(block(".rail")).toMatch(/grid-template-columns: repeat\(10, minmax\(0, 1fr\)\)/);
    expect(block(".rail__cell")).toMatch(/height: 26px/);
    expect(block(".rail__cell")).not.toMatch(/transition|animation/);
    expect(block('.rail__cell[data-state="past"]')).toMatch(/background: var\(--ink\)/);
    expect(block('.rail__cell[data-state="past"]')).toMatch(/color: var\(--paper\)/);
    expect(block('.rail__cell[data-state="current"]')).toMatch(/background: var\(--tint\)/);
    expect(block('.rail__cell[data-state="current"]')).toMatch(/border: 2px solid var\(--ink\)/);
    expect(block('.rail__cell[data-state="current"]')).toMatch(/font-weight: 600/);
    expect(block('.rail__cell[data-state="future"]')).toMatch(/border: 1px solid var\(--rule\)/);
    expect(block('.rail__cell[data-state="future"]')).toMatch(/color: #B9B4A6/i);
  });
});
