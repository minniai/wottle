import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  test.each([
    "available",
    "matchmaking",
    "in_match",
    "offline",
    "info",
    "warning",
  ] as const)("renders %s variant", (variant) => {
    render(<Badge variant={variant}>label</Badge>);
    expect(screen.getByText("label")).toBeInTheDocument();
  });

  test("renders no pulse dot by default", () => {
    render(<Badge variant="available">label</Badge>);
    expect(document.querySelector(".lobby-status-dot--pulse")).toBeNull();
  });

  test("renders pulse dot when pulse prop is true", () => {
    render(
      <Badge variant="available" pulse>
        label
      </Badge>,
    );
    expect(document.querySelector(".lobby-status-dot--pulse")).not.toBeNull();
  });
});
