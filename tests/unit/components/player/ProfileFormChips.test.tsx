import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileFormChips } from "@/components/player/ProfileFormChips";

describe("ProfileFormChips", () => {
  test("renders one chip per W/L/D entry", () => {
    render(<ProfileFormChips form={["W", "W", "L", "D"]} />);
    const chips = screen
      .getAllByTestId("form-chip")
      .filter((c) => (c.textContent?.trim().length ?? 0) > 0);
    expect(chips.map((c) => c.textContent?.trim())).toEqual([
      "W",
      "W",
      "L",
      "D",
    ]);
  });

  test("pads to 10 chips with empty placeholders when form is shorter", () => {
    render(<ProfileFormChips form={["W"]} />);
    expect(screen.getAllByTestId("form-chip")).toHaveLength(10);
  });

  test("renders 10 chips for a full-form input", () => {
    render(
      <ProfileFormChips
        form={["W", "W", "L", "D", "W", "L", "W", "W", "D", "L"]}
      />,
    );
    expect(screen.getAllByTestId("form-chip")).toHaveLength(10);
  });
});
