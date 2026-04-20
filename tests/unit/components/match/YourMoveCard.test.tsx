import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { YourMoveCard } from "@/components/match/YourMoveCard";

describe("YourMoveCard", () => {
  test("renders the 'Your move' eyebrow", () => {
    render(<YourMoveCard selection={null} submittedMove={null} />);
    expect(screen.getByText("Your move")).toBeInTheDocument();
  });

  test("empty state prompts the first pick", () => {
    render(<YourMoveCard selection={null} submittedMove={null} />);
    expect(screen.getByText("Select your first tile.")).toBeInTheDocument();
  });

  test("single selection shows the coordinate", () => {
    render(
      <YourMoveCard
        selection={{ x: 0, y: 0 }}
        submittedMove={null}
      />,
    );
    expect(screen.getByText(/Picked/i)).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText(/Pick a second/i)).toBeInTheDocument();
  });

  test("submitted state shows both coords joined by ↔", () => {
    render(
      <YourMoveCard
        selection={null}
        submittedMove={[
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]}
      />,
    );
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("A1 ↔ B2")).toBeInTheDocument();
    expect(
      screen.getByText(/Hidden from opponent until both submit/i),
    ).toBeInTheDocument();
  });

  test("submitted state overrides selection", () => {
    render(
      <YourMoveCard
        selection={{ x: 2, y: 3 }}
        submittedMove={[
          { x: 4, y: 5 },
          { x: 6, y: 7 },
        ]}
      />,
    );
    expect(screen.queryByText(/Select your first tile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/C4/i)).not.toBeInTheDocument();
    expect(screen.getByText("E6 ↔ G8")).toBeInTheDocument();
  });
});
