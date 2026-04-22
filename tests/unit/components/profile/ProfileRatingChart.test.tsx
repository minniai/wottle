import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";

describe("ProfileRatingChart", () => {
  test("renders empty-state message when history is empty", () => {
    render(<ProfileRatingChart history={[]} />);
    expect(screen.getByText(/No rated matches/i)).toBeInTheDocument();
  });

  test("renders a line path + area path when history has entries", () => {
    const history = [
      { recordedAt: "2026-01-01T00:00:00Z", rating: 1200 },
      { recordedAt: "2026-01-02T00:00:00Z", rating: 1250 },
      { recordedAt: "2026-01-03T00:00:00Z", rating: 1234 },
    ];
    const { container } = render(<ProfileRatingChart history={history} />);
    const paths = container.querySelectorAll("path");
    // Expect both area-fill path and line-stroke path.
    expect(paths.length).toBeGreaterThanOrEqual(2);
    // Endpoint dot.
    expect(container.querySelector("circle")).not.toBeNull();
  });

  test("renders 4 dashed grid lines", () => {
    const history = [
      { recordedAt: "2026-01-01T00:00:00Z", rating: 1200 },
      { recordedAt: "2026-01-02T00:00:00Z", rating: 1250 },
    ];
    const { container } = render(<ProfileRatingChart history={history} />);
    const dashed = container.querySelectorAll("line[stroke-dasharray]");
    expect(dashed.length).toBeGreaterThanOrEqual(4);
  });
});
