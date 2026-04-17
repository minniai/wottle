import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Card } from "@/components/ui/Card";

describe("Card", () => {
  test.each([0, 1, 2, 3] as const)("renders elevation %s", (elevation) => {
    render(<Card elevation={elevation}>body</Card>);
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  test("interactive variant adds focus-visible ring classes", () => {
    render(
      <Card interactive tabIndex={0} data-testid="c">
        body
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toContain("focus-visible");
    expect(el.className).toContain("hover:");
  });

  test("non-interactive variant omits hover/focus transform classes", () => {
    render(<Card data-testid="c">body</Card>);
    const el = screen.getByTestId("c");
    expect(el.className).not.toContain("hover:-translate-y");
  });
});
