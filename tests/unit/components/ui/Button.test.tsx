import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, test } from "vitest";

import { Button } from "@/components/ui/Button";

describe("Button", () => {
  test.each(["primary", "secondary", "ghost", "danger"] as const)(
    "renders %s variant",
    (variant) => {
      render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
    },
  );

  test.each(["sm", "md", "lg"] as const)("renders %s size", (size) => {
    render(<Button size={size}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  test("honours disabled attribute", () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
  });

  test("applies focus-visible ring classes", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" }).className).toContain(
      "focus-visible",
    );
  });

  test("forwards refs to the underlying button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
