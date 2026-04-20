import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MatchLeftRail } from "@/components/match/MatchLeftRail";

describe("MatchLeftRail", () => {
  test("renders all three instructional cards", () => {
    render(<MatchLeftRail selection={null} submittedMove={null} />);
    expect(screen.getByTestId("how-to-play-card")).toBeInTheDocument();
    expect(screen.getByTestId("legend-card")).toBeInTheDocument();
    expect(screen.getByTestId("your-move-card")).toBeInTheDocument();
  });

  test("forwards selection to YourMoveCard", () => {
    render(
      <MatchLeftRail
        selection={{ x: 2, y: 4 }}
        submittedMove={null}
      />,
    );
    expect(screen.getByText("C5")).toBeInTheDocument();
  });

  test("forwards submittedMove to YourMoveCard", () => {
    render(
      <MatchLeftRail
        selection={null}
        submittedMove={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
      />,
    );
    expect(screen.getByText("A1 ↔ B2")).toBeInTheDocument();
  });
});
