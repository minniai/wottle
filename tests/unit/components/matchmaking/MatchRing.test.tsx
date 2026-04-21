import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MatchRing } from "@/components/matchmaking/MatchRing";

describe("MatchRing", () => {
  test("renders children centered inside a .match-ring wrapper", () => {
    render(
      <MatchRing>
        <div data-testid="ring-child">A</div>
      </MatchRing>,
    );
    const wrapper = screen.getByTestId("match-ring");
    expect(wrapper.className).toContain("match-ring");
    expect(screen.getByTestId("ring-child")).toBeInTheDocument();
  });

  test("respects prefers-reduced-motion via a css class, not inline style", () => {
    render(
      <MatchRing>
        <span>x</span>
      </MatchRing>,
    );
    const wrapper = screen.getByTestId("match-ring");
    expect(wrapper.getAttribute("style") ?? "").not.toMatch(/animation/);
  });
});
