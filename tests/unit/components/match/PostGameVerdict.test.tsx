import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PostGameVerdict } from "@/components/match/PostGameVerdict";

describe("PostGameVerdict", () => {
  test("eyebrow shows round count and duration", () => {
    render(
      <PostGameVerdict
        outcome="win"
        totalRounds={10}
        durationMs={552_000}
        pointMargin={34}
        opponentName="Sigríður"
        reasonLabel="10 rounds completed"
      />,
    );
    expect(
      screen.getByText(/Match complete · 10 rounds · 9m 12s/i),
    ).toBeInTheDocument();
  });

  test("win outcome shows Victory. and you-outread sub-display", () => {
    render(
      <PostGameVerdict
        outcome="win"
        totalRounds={10}
        durationMs={300_000}
        pointMargin={34}
        opponentName="Sigríður"
        reasonLabel="10 rounds completed"
      />,
    );
    expect(screen.getByText("Victory.")).toBeInTheDocument();
    expect(
      screen.getByText(/You out-read Sigríður by 34 points\./i),
    ).toBeInTheDocument();
    const verdict = screen.getByTestId("post-game-verdict");
    expect(verdict.className).toMatch(/post-game-verdict--win/);
  });

  test("loss outcome shows Defeat. and opponent-outread sub-display", () => {
    render(
      <PostGameVerdict
        outcome="loss"
        totalRounds={10}
        durationMs={300_000}
        pointMargin={22}
        opponentName="Sigríður"
        reasonLabel="10 rounds completed"
      />,
    );
    expect(screen.getByText("Defeat.")).toBeInTheDocument();
    expect(
      screen.getByText(/Sigríður out-read you by 22 points\./i),
    ).toBeInTheDocument();
    const verdict = screen.getByTestId("post-game-verdict");
    expect(verdict.className).toMatch(/post-game-verdict--loss/);
  });

  test("draw outcome shows Draw. with tied sub-display", () => {
    render(
      <PostGameVerdict
        outcome="draw"
        totalRounds={10}
        durationMs={300_000}
        pointMargin={0}
        opponentName="Sigríður"
        reasonLabel="10 rounds completed"
      />,
    );
    expect(screen.getByText("Draw.")).toBeInTheDocument();
    expect(
      screen.getByText(/Tied with Sigríður after the final round\./i),
    ).toBeInTheDocument();
  });

  test("reason label is rendered verbatim", () => {
    render(
      <PostGameVerdict
        outcome="win"
        totalRounds={10}
        durationMs={0}
        pointMargin={1}
        opponentName="X"
        reasonLabel="Disconnected opponent"
      />,
    );
    expect(screen.getByText("Disconnected opponent")).toBeInTheDocument();
  });
});
