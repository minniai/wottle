import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Field } from "@/components/room/Field";

const board = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));
const css = readFileSync(resolve(__dirname, "../../../../app/styles/room.css"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("Field turn frame (spec 048 FR-020)", () => {
  it("marks the field with the seat whose move it is, or nothing", () => {
    const { rerender } = render(<Field board={board} viewerSlot="player_a" turnFrame="you" />);
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    rerender(<Field board={board} viewerSlot="player_a" turnFrame={null} />);
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-turn");
    rerender(<Field board={board} viewerSlot="player_a" />);
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-turn");
  });

  it("is an outline in the seat colour, never a border change", () => {
    const rule = css.match(/\.field\[data-turn="you"\] \{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/outline: 3px solid var\(--you\)/);
    expect(rule).toMatch(/outline-offset: -3px/);
    expect(rule).not.toMatch(/border/);
  });
});
