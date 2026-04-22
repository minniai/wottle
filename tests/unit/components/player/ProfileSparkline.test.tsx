import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileSparkline } from "@/components/player/ProfileSparkline";

describe("ProfileSparkline", () => {
  test("renders one bar per rating entry", () => {
    render(
      <ProfileSparkline
        ratings={[1180, 1200, 1220, 1195]}
        peak={1220}
        current={1195}
      />,
    );
    expect(screen.getAllByTestId("sparkline-bar")).toHaveLength(4);
  });

  test("renders the peak + current eyebrow", () => {
    render(<ProfileSparkline ratings={[1200]} peak={1200} current={1200} />);
    expect(screen.getByText(/Peak\s+1200/i)).toBeInTheDocument();
    expect(screen.getByText(/Now\s+1200/i)).toBeInTheDocument();
  });

  test("handles empty ratings gracefully", () => {
    render(<ProfileSparkline ratings={[]} peak={1200} current={1200} />);
    expect(screen.getByTestId("profile-sparkline")).toBeInTheDocument();
    expect(screen.queryAllByTestId("sparkline-bar")).toHaveLength(0);
  });
});
