import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";

const history = [
  { recordedAt: "2026-08-20T00:00:00Z", rating: 1180 },
  { recordedAt: "2026-08-25T00:00:00Z", rating: 1195 },
  { recordedAt: "2026-09-01T00:00:00Z", rating: 1204 },
];

describe("ProfileRatingChart (design system §5.8)", () => {
  it("one 1.5px polyline in the seat colour over three rule gridlines with ink axes; no fill, markers or tooltip", () => {
    render(<ProfileRatingChart history={history} seat="you" />);
    const svg = screen.getByTestId("profile-rating-chart");
    const line = screen.getByTestId("profile-rating-line");
    expect(line.getAttribute("stroke")).toBe("var(--you)");
    expect(line.getAttribute("stroke-width")).toBe("1.5");
    expect(line.getAttribute("fill")).toBe("none");
    expect(svg.querySelectorAll('line[stroke="var(--rule)"]')).toHaveLength(3);
    expect(svg.querySelectorAll('line[stroke="var(--ink)"]')).toHaveLength(2);
    expect(svg.querySelectorAll("circle, path, title")).toHaveLength(0);
    expect(svg.textContent).toContain("1204");
    expect(svg.textContent).toContain("1180");
  });

  it("other players' charts use the opponent colour; empty history states the fact", () => {
    const { rerender } = render(<ProfileRatingChart history={history} seat="opp" />);
    expect(screen.getByTestId("profile-rating-line").getAttribute("stroke")).toBe("var(--opp)");
    rerender(<ProfileRatingChart history={[]} seat="opp" />);
    expect(screen.getByTestId("profile-rating-chart")).toHaveTextContent("no rated matches in the last 30 days");
  });
});
