import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Skeleton } from "@/components/ui/Skeleton";

describe("Skeleton", () => {
  test("renders rect shape by default", () => {
    render(<Skeleton data-testid="sk" />);
    expect(screen.getByTestId("sk").className).not.toContain("rounded-full");
  });

  test("renders circle shape when requested", () => {
    render(<Skeleton shape="circle" data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el.className).toContain("rounded-full");
  });

  test("is aria-hidden", () => {
    render(<Skeleton data-testid="sk" />);
    expect(screen.getByTestId("sk").getAttribute("aria-hidden")).toBe("true");
  });

  test("carries the shimmer class for animation hook", () => {
    render(<Skeleton data-testid="sk" />);
    expect(screen.getByTestId("sk").className).toContain("lobby-skeleton");
  });
});
